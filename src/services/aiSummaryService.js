const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- OCR cleanup / normalization helpers ---
const normalizeWhitespace = (s) => s.replace(/\s+/g, " ").trim();

const stripListPrefix = (s) =>
  s
    // "15. Place", "7: Place", "3) Place", "14Place" (OCR sometimes drops the separator)
    .replace(/^\s*\[?\s*\d{1,3}\s*[\.\:\)\-\]]\s*/i, "")
    .replace(/^\s*\d{1,3}\s*/i, "")
    .trim();

const stripTrailingPunctuation = (s) => s.replace(/[\s,.;:!?\-]+$/g, "").trim();

const makeKey = (s) =>
  normalizeWhitespace(
    s
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/[^a-z0-9\s]/g, " ")
  );

const isLikelyPlaceName = (raw) => {
  if (!raw) return false;
  const s = normalizeWhitespace(raw);
  if (s.length < 3) return false;

  // Avoid pure numbers / short codes
  if (/^\d+$/.test(s)) return false;

  // Avoid shouting-y slogan text: long all-caps phrases are rarely venue names
  const letters = s.replace(/[^A-Za-z]/g, "");
  const upper = s.replace(/[^A-Z]/g, "").length;
  if (letters.length >= 10 && upper / Math.max(letters.length, 1) > 0.85 && s.split(" ").length >= 3) {
    return false;
  }

  const key = makeKey(s);

  // Common non-place fragments
  if (key.startsWith("days") || key.includes("days &") || key.includes("nights")) return false;

  return true;
};

const cleanVenueCandidate = (raw) => {
  if (!raw) return "";
  let s = normalizeWhitespace(raw);
  s = stripListPrefix(s);
  s = stripTrailingPunctuation(s);
  return normalizeWhitespace(s);
};

const generateAISummary = async (labels, texts,transcript, description) => {
  const allTranscript = transcript.join(" ");
  
  // Preprocess OCR texts to identify venue names and addresses
  const venueNames = Array.from(
    new Map(
      (texts || [])
        .map((t) => cleanVenueCandidate(t))
        .filter((t) => isLikelyPlaceName(t))
        // Not an address (basic heuristic)
        .filter((t) => !/^\d+\s+[A-Z]/.test(t.trim()))
        .map((t) => [makeKey(t), t])
    ).values()
  );
  
  const addresses = (texts || []).filter(
    (text) => text && /^\d+\s+[A-Z]/.test(text.trim()) // Matches patterns like "25 W 28TH ST"
  );
  
  // Format OCR context for the prompt
  const ocrContext = venueNames.length > 0 || addresses.length > 0
    ? `VENUE NAMES: ${venueNames.join(", ") || "none"}\nADDRESSES: ${addresses.join(", ") || "none"}`
    : "No specific venue names or addresses detected";
  
  const prompt = `
You are summarizing a TikTok video related to travel, food, or lifestyle.

You are given visual, audio, and text signals extracted from the video. Your task is to identify and summarize ALL DISTINCT PLACES or VENUES mentioned or shown.

INPUT DATA:
- Visual Labels (objects/scenes): ${labels.join(", ") || "none"}
- OCR Text (raw, unfiltered): ${texts.join(", ") || "none"}
- OCR Context: ${ocrContext}
- Speech Transcript: ${allTranscript || "none"}
- Video Caption: ${description || "none"}

====================================
🎯 GOAL
====================================
Generate a clean, non-redundant summary of ALL DISTINCT places found in the video.

Each place should appear EXACTLY ONCE in the output.

====================================
🏷️ PLACE DETECTION PRIORITY
====================================
Use the following priority order to identify place names:

1. OCR text (highest priority)
2. Speech transcript
3. Video caption
4. Visual labels (ONLY if no names exist anywhere else)

====================================
🧹 OCR CLEANUP RULES
====================================
From OCR text:
- KEEP: venue names, shop names, restaurants, cafes, landmarks, hotels, attractions, addresses
- IGNORE:
  - UI text (e.g., "ORDER HERE", "WELCOME", "OPEN DAILY")
  - Slogans or marketing phrases
  - Trip titles (e.g., "4 DAYS & 3 NIGHTS", "Places We Visited")
  - Facilities (e.g., "Comfort Room", "Toilet")
  - List numbers or prefixes (e.g., "15. Salagdoong Beach" → "Salagdoong Beach")

Deduplicate OCR results:
- If the same place appears multiple times with small variations, keep ONE clean version.

====================================
🔗 MERGING RULES (NO REDUNDANCY)
====================================
- A venue name + its address = ONE place
- A venue + its view or surrounding area = ONE place
- DO NOT split the same venue into multiple items
- If multiple DISTINCT venue names exist → create ONE item per venue
- If only ONE venue exists → return ONE item

====================================
🧱 OUTPUT STRUCTURE
====================================
Return a JSON ARRAY only.

Each item represents ONE distinct place:
[
  {
    "title": "Place or venue name (use detected name, never generic if a name exists)",
    "description": "1–2 sentence summary combining what the place is, where it is (if known), and what happens there",
    "category": "Restaurant | Activity | Landmark | Shop | Accommodation | Other"
  }
]

====================================
🚨 STRICT RULES
====================================
- Include ALL distinct places found
- NEVER invent places
- NEVER use generic titles if a real place name exists
- DO NOT repeat the same place in multiple items
- If no place names exist anywhere, create ONE generic item using labels
- Output ONLY valid JSON (no explanations, no markdown)
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { 
        role: "system", 
        content: "You are a precise data extraction assistant. You MUST prioritize OCR-detected text (venue names, addresses) over generic labels. When OCR text contains multiple distinct venue names, create ONE item for EACH distinct venue. When OCR text contains specific venue names or addresses, use them as titles - never create generic titles based on scene labels. Include ALL distinct venues found in the OCR text." 
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.1, // Lower temperature for more deterministic, instruction-following behavior
  });

  try {
    let content = response.choices[0].message.content.trim();

    // 🧹 Remove Markdown formatting if present
    content = content
      .replace(/```json\s*/g, "")
      .replace(/```/g, "")
      .trim();

    const results = JSON.parse(content);
    
    // Post-processing: Normalize/dedupe titles and ensure all OCR venues are present (without adding OCR-noise)
    if (Array.isArray(results) && venueNames.length > 0) {
      // Clean result titles a bit (strip numbering prefixes if model echoes them)
      const cleanedResults = results
        .map((item) => {
          if (!item || typeof item !== "object") return item;
          const next = { ...item };
          if (typeof next.title === "string") {
            next.title = cleanVenueCandidate(next.title);
          }
          return next;
        })
        // drop obvious non-place junk if model emitted it
        .filter((item) => !item?.title || isLikelyPlaceName(item.title));

      // Dedupe results by normalized key (prefer first richer description/category)
      const byKey = new Map();
      for (const item of cleanedResults) {
        if (!item?.title) continue;
        const key = makeKey(item.title);
        if (!byKey.has(key)) {
          byKey.set(key, item);
          continue;
        }
        const existing = byKey.get(key);
        const existingDescLen = (existing.description || "").length;
        const candidateDescLen = (item.description || "").length;
        if (candidateDescLen > existingDescLen) {
          byKey.set(key, item);
        }
      }
      const uniqueResults = [...byKey.values()];

      // Which OCR venues are already represented?
      const resultKeys = new Set(uniqueResults.map((r) => makeKey(r.title)));
      const missingVenueNames = venueNames.filter((vn) => !resultKeys.has(makeKey(vn)));

      // Only add missing venues if they look like real places (venueNames is already filtered/deduped)
      for (const vn of missingVenueNames) {
        uniqueResults.push({
          title: vn,
          description: `A place mentioned in the video: ${vn}.`,
          category: "Other",
        });
      }
      
      // If we have only one venue name and multiple results, check if they're about the same place
      if (venueNames.length === 1 && uniqueResults.length > 1) {
        const venueName = makeKey(venueNames[0]);
        const venueItem = uniqueResults.find(item => 
          item.title && makeKey(item.title).includes(venueName)
        );
        
        if (venueItem) {
          // Check if other items are generic (View, Experience, etc.) - if so, keep only venue item
          const otherItems = uniqueResults.filter(item => item !== venueItem);
          const allGeneric = otherItems.every(item => 
            !item.title || 
            ["View", "Experience", "Scene", "Location", "City", "Area"].some(generic => 
              item.title.toLowerCase().includes(generic.toLowerCase())
            )
          );
          
          if (allGeneric) {
            // Merge address if available
            if (addresses.length > 0 && !venueItem.description.includes(addresses[0])) {
              venueItem.description = `${venueItem.description || ""} Located at ${addresses[0]}.`.trim();
            }
            return [venueItem];
          }
        }
      }
      
      // If no venue names but we have addresses and only one address, and multiple results, prioritize address-based item
      if (addresses.length === 1 && venueNames.length === 0 && uniqueResults.length > 1) {
        const addressBasedItem = uniqueResults.find(item => 
          (item.title && item.title.includes(addresses[0])) ||
          (item.description && item.description.includes(addresses[0]))
        );
        if (addressBasedItem) {
          return [addressBasedItem];
        }
      }
      
      return uniqueResults;
    }
    
    return results;
  } catch (err) {
    console.error("❌ JSON parsing failed:", err);
    console.log("Raw content:", response.choices[0].message.content);
    return [];
  }
};

module.exports = { generateAISummary };



