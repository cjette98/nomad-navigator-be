const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generateAISummary = async (labels, texts,transcript, description) => {
  const allTranscript = transcript.join(" ");
  
  // Preprocess OCR texts to identify venue names and addresses
  const venueNames = texts.filter(text => 
    text && 
    text.length > 2 && 
    !/^\d+$/.test(text.trim()) && // Not just numbers
    !/^\d+\s+[A-Z]/.test(text.trim()) // Not just addresses starting with numbers
  );
  
  const addresses = texts.filter(text => 
    text && /^\d+\s+[A-Z]/.test(text.trim()) // Matches patterns like "25 W 28TH ST"
  );
  
  // Format OCR context for the prompt
  const ocrContext = venueNames.length > 0 || addresses.length > 0
    ? `VENUE NAMES: ${venueNames.join(", ") || "none"}\nADDRESSES: ${addresses.join(", ") || "none"}`
    : "No specific venue names or addresses detected";
  
  const prompt = `You are analyzing a TikTok video about travel, food, or lifestyle.

Visual and Audio Analysis Data:
- Labels (Objects/Scenes): ${labels.join(", ") || "none"}
- Detected Text (OCR - ALL): ${texts.join(", ") || "none"}
- ${ocrContext}
- Speech Transcript: ${allTranscript || "none"}
- Video Caption: ${description || "none"}

**🚨 CRITICAL RULE: OCR TEXT IS MANDATORY WHEN PRESENT 🚨**

If Detected Text (OCR) contains venue names or addresses, you MUST use them as the title. DO NOT create generic titles based on labels.

EXAMPLES OF CORRECT BEHAVIOR:

Example 1:
- OCR: ["Nubeluz", "25 W 28TH ST", "6806"]
- Labels: ["skyscraper", "cityscape", "metropolitan area"]
- ❌ WRONG: { "title": "Skyscraper View", "description": "An overview of skyscrapers..." }
- ✅ CORRECT: { "title": "Nubeluz", "description": "A rooftop venue at 25 W 28TH ST featuring stunning cityscape and skyscraper views of the metropolitan area." }

Example 2:
- OCR: ["Cesar's Cafe", "Legazpi"]
- Labels: ["restaurant", "food"]
- ❌ WRONG: { "title": "Restaurant Experience", "description": "A dining experience..." }
- ✅ CORRECT: { "title": "Cesar's Cafe", "description": "A restaurant in Legazpi offering local cuisine and dining experience." }

Example 3:
- OCR: [] (empty)
- Labels: ["beach", "ocean"]
- ✅ CORRECT: { "title": "Beach View", "description": "A scenic beach with ocean views..." } (Only use labels when OCR is empty)

**🎯 CRITICAL: OUTPUT CONSISTENCY RULE 🎯**
- **MULTIPLE DISTINCT VENUES: If there are MULTIPLE distinct venue names in OCR, create ONE item for EACH distinct venue**
- **SINGLE VENUE: If there is ONE main venue/place (identified by venue name or address), return ONLY ONE item in the array**
- **DO NOT create separate items for: venue name vs address of the SAME venue, venue vs view of the SAME venue, or venue vs general location**
- **If venue name and address both exist for the SAME venue, they belong to the SAME item - combine them into ONE item**
- **Each distinct venue name should get its own item in the array**

Now, generate a structured JSON array. Each element represents one distinct subject, place, or item found in the video:
[
  {
    "title": "MUST use OCR text if it contains venue names/addresses, otherwise use transcript, then labels",
    "description": "1-2 sentences incorporating the title, OCR context, labels, and transcript",
    "category": "Restaurant | Activity | Landmark | Shop | Accomodation | Other"
  }
]

STRICT RULES (follow in order):
1. **OUTPUT COUNT: Create ONE item for EACH distinct venue name found in OCR. If there are 15 distinct venue names, return 15 items.**
2. **If MULTIPLE VENUE NAMES are detected: Create separate items for each distinct venue name (e.g., "Restaurant A", "Restaurant B", "Cafe C" = 3 items)**
3. **If ONE venue name is detected: Return array with ONE item only**
4. **If VENUE NAMES are detected: Use each venue name as a title for its respective item**
5. **If ADDRESSES are detected: Match addresses to their corresponding venue names and include in description (e.g., "Restaurant A", description: "A restaurant at 123 Main St...")**
6. **If both VENUE NAMES and ADDRESSES exist: Match them logically - same venue name and nearby address = same item**
7. **DO NOT create separate items for: venue + address of the SAME venue, venue + view of the SAME venue, or venue + location of the SAME venue**
8. **If OCR is empty or only numbers: Use transcript for specific names**
9. **If transcript is empty: Only then use labels for generic titles**
10. **NEVER create generic titles like "Skyscraper View" or "City View" when VENUE NAMES are detected in OCR**
11. **IMPORTANT: Include ALL distinct venues found in the OCR text - do not skip any**

**VERY IMPORTANT: Output ONLY the valid JSON array, without any leading/trailing text, explanations, or JSON markdown (e.g., \`\`\`json).**
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
    
    // Post-processing: Ensure all venue names from OCR are included in results
    if (Array.isArray(results) && venueNames.length > 0) {
      // Check which venue names are already in the results
      const venueNamesInResults = new Set();
      results.forEach(item => {
        if (item.title) {
          venueNames.forEach(venueName => {
            if (item.title.toLowerCase().includes(venueName.toLowerCase())) {
              venueNamesInResults.add(venueName.toLowerCase());
            }
          });
        }
      });
      
      // Find venue names that are missing from results
      const missingVenueNames = venueNames.filter(venueName => 
        !venueNamesInResults.has(venueName.toLowerCase())
      );
      
      // Add missing venue names as new items
      missingVenueNames.forEach(venueName => {
        results.push({
          title: venueName,
          description: `A place mentioned in the video: ${venueName}.`,
          category: "Other"
        });
      });
      
      // Remove duplicate items (same venue name mentioned multiple times)
      const seenTitles = new Set();
      const uniqueResults = results.filter(item => {
        if (!item.title) return true;
        const titleLower = item.title.toLowerCase();
        // Check if this title matches a venue name (to identify duplicates)
        const isVenueName = venueNames.some(vn => titleLower.includes(vn.toLowerCase()));
        if (isVenueName) {
          // For venue names, check for exact matches
          const venueMatch = venueNames.find(vn => titleLower.includes(vn.toLowerCase()));
          if (venueMatch) {
            const key = venueMatch.toLowerCase();
            if (seenTitles.has(key)) {
              return false; // Duplicate venue, skip
            }
            seenTitles.add(key);
            return true;
          }
        }
        // For non-venue items, check for similar titles
        if (seenTitles.has(titleLower)) {
          return false;
        }
        seenTitles.add(titleLower);
        return true;
      });
      
      // If we have only one venue name and multiple results, check if they're about the same place
      if (venueNames.length === 1 && uniqueResults.length > 1) {
        const venueName = venueNames[0].toLowerCase();
        const venueItem = uniqueResults.find(item => 
          item.title && item.title.toLowerCase().includes(venueName)
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
    
    // If we have venue names but results don't include them, add them
    if (Array.isArray(results) && results.length > 0 && venueNames.length > 0) {
      const hasVenueInResults = results.some(item => 
        venueNames.some(venueName => 
          item.title && item.title.toLowerCase().includes(venueName.toLowerCase())
        )
      );
      
      if (!hasVenueInResults) {
        // Add all venue names as items
        const newItems = venueNames.map(venueName => ({
          title: venueName,
          description: addresses.length > 0 
            ? `A place mentioned in the video: ${venueName}. Located at ${addresses[0]}.`
            : `A place mentioned in the video: ${venueName}.`,
          category: "Other"
        }));
        return newItems;
      }
    }
    
    return results;
  } catch (err) {
    console.error("❌ JSON parsing failed:", err);
    console.log("Raw content:", response.choices[0].message.content);
    return [];
  }
};

module.exports = { generateAISummary };
