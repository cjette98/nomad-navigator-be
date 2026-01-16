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
- If there is ONE main venue/place (identified by venue name or address), return ONLY ONE item in the array
- Only create multiple items if there are CLEARLY DISTINCT, SEPARATE venues/places (e.g., "Restaurant A" AND "Restaurant B" mentioned separately)
- DO NOT create separate items for: venue name vs address, venue vs view, or venue vs general location
- If venue name and address both exist, they belong to the SAME item - combine them into ONE item

Now, generate a structured JSON array. Each element represents one distinct subject, place, or item found in the video:
[
  {
    "title": "MUST use OCR text if it contains venue names/addresses, otherwise use transcript, then labels",
    "description": "1-2 sentences incorporating the title, OCR context, labels, and transcript",
    "category": "Restaurant | Activity | Landmark | Shop | Accomodation | Other"
  }
]

STRICT RULES (follow in order):
1. **OUTPUT COUNT: If ONE venue name is detected, return array with ONE item only. Only return multiple items if there are clearly multiple distinct venues.**
2. **If VENUE NAMES are detected above: Use the FIRST venue name as the title (e.g., "Nubeluz")**
3. **If ADDRESSES are detected: Include in description or combine with venue name (e.g., "Nubeluz, 25 W 28TH ST")**
4. **If both VENUE NAMES and ADDRESSES exist: Combine them into ONE item (e.g., title: "Nubeluz", description: "A rooftop venue at 25 W 28TH ST...")**
5. **DO NOT create separate items for: venue + address, venue + view, or venue + location - these are all ONE place**
6. **If OCR is empty or only numbers: Use transcript for specific names**
7. **If transcript is empty: Only then use labels for generic titles**
8. **NEVER create generic titles like "Skyscraper View" or "City View" when VENUE NAMES are detected in OCR**

**VERY IMPORTANT: Output ONLY the valid JSON array, without any leading/trailing text, explanations, or JSON markdown (e.g., \`\`\`json).**
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { 
        role: "system", 
        content: "You are a precise data extraction assistant. You MUST prioritize OCR-detected text (venue names, addresses) over generic labels. When OCR text contains specific venue names or addresses, use them as titles - never create generic titles based on scene labels." 
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
    
    // Post-processing: Ensure consistency - if we have one main venue, return only one item
    if (Array.isArray(results) && results.length > 1) {
      // If we detected venue names, prioritize items that use those venue names
      if (venueNames.length > 0) {
        const venueBasedItems = results.filter(item => 
          venueNames.some(venueName => 
            item.title && item.title.toLowerCase().includes(venueName.toLowerCase())
          )
        );
        
        if (venueBasedItems.length > 0) {
          // If multiple venue-based items, take the first one (most specific)
          // Merge address if available
          const primaryItem = venueBasedItems[0];
          if (addresses.length > 0 && !primaryItem.description.includes(addresses[0])) {
            primaryItem.description = `${primaryItem.description} Located at ${addresses[0]}.`;
          }
          return [primaryItem];
        }
      }
      
      // If no venue names but we have addresses, prioritize items with addresses
      if (addresses.length > 0 && venueNames.length === 0) {
        const addressBasedItems = results.filter(item => 
          addresses.some(address => 
            (item.title && item.title.includes(address)) ||
            (item.description && item.description.includes(address))
          )
        );
        if (addressBasedItems.length > 0) {
          return [addressBasedItems[0]];
        }
      }
      
      // If multiple items but they seem to be about the same place, take the first one
      // Check if items have similar titles or are clearly about the same venue
      const firstItem = results[0];
      const otherItems = results.slice(1);
      
      // If other items are generic (like "View", "Experience") and first item has a specific name, keep only first
      const hasSpecificName = firstItem.title && 
        !["View", "Experience", "Scene", "Location"].some(generic => 
          firstItem.title.toLowerCase().includes(generic.toLowerCase())
        );
      
      if (hasSpecificName) {
        const allGeneric = otherItems.every(item => 
          !item.title || 
          ["View", "Experience", "Scene", "Location", "City", "Area"].some(generic => 
            item.title.toLowerCase().includes(generic.toLowerCase())
          )
        );
        
        if (allGeneric) {
          return [firstItem];
        }
      }
    }
    
    // If we have venue names but results don't include them, fix the first result
    if (Array.isArray(results) && results.length > 0 && venueNames.length > 0) {
      const hasVenueInResults = results.some(item => 
        venueNames.some(venueName => 
          item.title && item.title.toLowerCase().includes(venueName.toLowerCase())
        )
      );
      
      if (!hasVenueInResults) {
        // Replace first result with venue name
        const correctedItem = { ...results[0] };
        correctedItem.title = venueNames[0];
        if (addresses.length > 0 && !correctedItem.description.includes(addresses[0])) {
          correctedItem.description = `${correctedItem.description || ""} Located at ${addresses[0]}.`.trim();
        }
        return [correctedItem]; // Return only the corrected item
      }
    }
    
    // Final check: if we have one venue name and multiple results, return only one
    if (Array.isArray(results) && results.length > 1 && venueNames.length === 1) {
      // Find the item that uses the venue name, or use the first item and correct it
      const venueItem = results.find(item => 
        item.title && item.title.toLowerCase().includes(venueNames[0].toLowerCase())
      );
      
      if (venueItem) {
        return [venueItem];
      } else {
        // Correct the first item to use the venue name
        const correctedItem = { ...results[0] };
        correctedItem.title = venueNames[0];
        if (addresses.length > 0 && !correctedItem.description.includes(addresses[0])) {
          correctedItem.description = `${correctedItem.description || ""} Located at ${addresses[0]}.`.trim();
        }
        return [correctedItem];
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
