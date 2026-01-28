const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- OCR cleanup / normalization helpers ---
const normalizeWhitespace = (s) => s.replace(/\s+/g, " ").trim();

const stripListPrefix = (s) =>
  s
    .replace(/^\s*\[?\s*\d{1,3}\s*[\.\:\)\-\]]\s*/i, "")
    .replace(/^\s*\d{1,3}\s*/i, "")
    .trim();

const stripTrailingPunctuation = (s) => s.replace(/[\s,.;:!?\-]+$/g, "").trim();

// Super normalized key for matching
const makeKey = (s) => {
  return normalizeWhitespace(
    s
      .toLowerCase()
      .replace(/['']/g, "'")
      // Remove ALL punctuation and special chars
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
  ).trim();
};

// Calculate similarity with word-level matching prioritized
const stringSimilarity = (str1, str2) => {
  const s1 = makeKey(str1);
  const s2 = makeKey(str2);
  
  if (s1 === s2) return 1.0;
  
  // Extract main words (filter out common suffixes like "falls", "beach", "spring")
  const extractCoreWords = (s) => {
    const words = s.split(' ').filter(w => w.length > 0);
    // Keep all words for now
    return words;
  };
  
  const words1 = extractCoreWords(s1);
  const words2 = extractCoreWords(s2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Count common words
  const commonWords = words1.filter(w => words2.includes(w)).length;
  const maxWords = Math.max(words1.length, words2.length);
  const minWords = Math.min(words1.length, words2.length);
  
  // If they share most words, they're likely the same place
  const wordSimilarity = commonWords / maxWords;
  
  // Special handling: if shorter phrase is fully contained in longer
  if (words1.length !== words2.length) {
    const shorter = words1.length < words2.length ? words1 : words2;
    const longer = words1.length < words2.length ? words2 : words1;
    const allContained = shorter.every(w => longer.includes(w));
    if (allContained) {
      return 0.95; // Very high similarity
    }
  }
  
  // Substring containment check
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return minLen / maxLen;
  }
  
  return wordSimilarity;
};

const isLikelyPlaceName = (raw) => {
  if (!raw) return false;
  const s = normalizeWhitespace(raw);
  if (s.length < 2) return false;

  if (/^\d+$/.test(s)) return false;

  const letters = s.replace(/[^A-Za-z]/g, "");
  const upper = s.replace(/[^A-Z]/g, "").length;
  if (letters.length >= 10 && upper / Math.max(letters.length, 1) > 0.85 && s.split(" ").length >= 3) {
    return false;
  }

  const key = makeKey(s);

  // Expanded exclusions
  const excludePatterns = [
    "days", "nights", "days &", "order here", "toilet", "tolet", "comfort room",
    "the healthy alternative", "smoothies so fresh", "places we visited",
    "carport room", "desheka", "ba", "ruaik"
  ];
  
  for (const pattern of excludePatterns) {
    if (key === pattern || key.includes(pattern)) return false;
  }
  
  // Very short ambiguous words
  if (key.length < 3 && !['jj', 'jjs'].includes(key)) return false;

  return true;
};

const cleanVenueCandidate = (raw) => {
  if (!raw) return "";
  let s = normalizeWhitespace(raw);
  s = stripListPrefix(s);
  s = stripTrailingPunctuation(s);
  s = s.replace(/^[\.\,\s]+/, "");
  return normalizeWhitespace(s);
};

// Prefer the most complete/formatted version when deduplicating
const chooseBetterVersion = (v1, v2) => {
  // Prefer version with proper spacing and hyphens
  const hasProperHyphen1 = v1.includes('-');
  const hasProperHyphen2 = v2.includes('-');
  
  if (hasProperHyphen1 && !hasProperHyphen2) return v1;
  if (hasProperHyphen2 && !hasProperHyphen1) return v2;
  
  // Prefer longer version (usually more complete)
  if (v1.length !== v2.length) {
    return v1.length > v2.length ? v1 : v2;
  }
  
  // Prefer version with proper capitalization (not all caps)
  const hasLowerCase1 = /[a-z]/.test(v1);
  const hasLowerCase2 = /[a-z]/.test(v2);
  
  if (hasLowerCase1 && !hasLowerCase2) return v1;
  if (hasLowerCase2 && !hasLowerCase1) return v2;
  
  // Default: alphabetically later (arbitrary tiebreaker)
  return v1 > v2 ? v1 : v2;
};

// Deduplicate venue names with fuzzy matching
const deduplicateVenues = (venues) => {
  if (!venues || venues.length === 0) return [];
  
  const uniqueVenues = [];
  
  for (const venue of venues) {
    if (!venue) continue;
    
    let bestMatchIndex = -1;
    let bestSimilarity = 0;
    
    // Find best match
    for (let i = 0; i < uniqueVenues.length; i++) {
      const existing = uniqueVenues[i];
      const similarity = stringSimilarity(venue, existing);
      
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatchIndex = i;
      }
    }
    
    // Threshold: 0.7 for matching
    if (bestSimilarity > 0.7 && bestMatchIndex >= 0) {
      const existingVenue = uniqueVenues[bestMatchIndex];
      const betterVersion = chooseBetterVersion(venue, existingVenue);
      uniqueVenues[bestMatchIndex] = betterVersion;
    } else {
      uniqueVenues.push(venue);
    }
  }
  
  return uniqueVenues;
};

const generateAISummary = async (labels, texts, transcript, description) => {
  const allTranscript = transcript?.join(" ") || "";
  
  // Preprocess OCR texts
  const rawVenues = (texts || [])
    .map(cleanVenueCandidate)
    .filter(isLikelyPlaceName);
  
  // Deduplicate
  const venueNames = deduplicateVenues(rawVenues);
  
  console.log(`📊 OCR Processing: ${texts?.length || 0} raw → ${rawVenues.length} filtered → ${venueNames.length} unique venues`);
  console.log(`📍 Unique venues: ${venueNames.join(', ')}`);
  
  const addresses = (texts || []).filter(
    (text) => text && /^\d+\s+[A-Z]/.test(text.trim())
  );
  
  const ocrContext = venueNames.length > 0 || addresses.length > 0
    ? `VENUE NAMES (${venueNames.length} unique):\n${venueNames.map((v, i) => `${i + 1}. ${v}`).join('\n')}\n\nADDRESSES: ${addresses.join(", ") || "none"}`
    : "No specific venue names or addresses detected";
  
  const prompt = `
You are summarizing a TikTok video about travel in Siquijor, Philippines.

CRITICAL: The venue names below have been pre-processed and deduplicated. Each is UNIQUE.

INPUT DATA:
- Visual Labels: ${labels?.join(", ") || "none"}
- Speech Transcript: ${allTranscript || "none"}
- Video Caption: ${description || "none"}

${ocrContext}

====================================
🎯 TASK
====================================
Create EXACTLY ${venueNames.length} summary items - one for each venue listed above.

====================================
🧱 OUTPUT FORMAT
====================================
Return ONLY a valid JSON array:

[
  {
    "title": "Exact venue name from the numbered list",
    "description": "Brief 1-2 sentence description",
    "category": "Restaurant | Activity | Landmark | Shop | Accommodation | Other"
  }
]

====================================
🚨 RULES
====================================
- Output exactly ${venueNames.length} items
- Use exact venue names as titles
- No duplicates
- No invented places
- Only JSON output
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { 
        role: "system", 
        content: `Create exactly ${venueNames.length} summary items using the provided venue names.`
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.05,
  });

  try {
    let content = response.choices[0].message.content.trim();
    content = content.replace(/```json\s*/g, "").replace(/```/g, "").trim();

    const results = JSON.parse(content);
    
    if (!Array.isArray(results)) {
      console.error("❌ Response is not an array");
      return [];
    }
    
    // Final deduplication safety check
    const finalResults = [];
    const seenKeys = new Set();
    
    for (const item of results) {
      if (!item?.title) continue;
      
      const key = makeKey(item.title);
      
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        finalResults.push(item);
      }
    }
    
    console.log(`✅ Generated ${finalResults.length} unique summaries`);
    
    return finalResults;
    
  } catch (err) {
    console.error("❌ JSON parsing failed:", err);
    console.log("Raw content:", response.choices[0].message.content);
    return [];
  }
};

module.exports = { generateAISummary };