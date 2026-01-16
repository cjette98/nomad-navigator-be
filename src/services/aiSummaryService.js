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

Now, generate a structured JSON array. Each element represents one distinct subject, place, or item found in the video:
[
  {
    "title": "MUST use OCR text if it contains venue names/addresses, otherwise use transcript, then labels",
    "description": "1-2 sentences incorporating the title, OCR context, labels, and transcript",
    "category": "Restaurant | Activity | Landmark | Shop | Accomodation | Other"
  }
]

STRICT RULES (follow in order):
1. **If VENUE NAMES are detected above: Use the FIRST venue name as the title (e.g., "Nubeluz")**
2. **If ADDRESSES are detected: Include in description or combine with venue name (e.g., "Nubeluz, 25 W 28TH ST")**
3. **If both VENUE NAMES and ADDRESSES exist: Combine them (e.g., title: "Nubeluz", description: "A rooftop venue at 25 W 28TH ST...")**
4. **If OCR is empty or only numbers: Use transcript for specific names**
5. **If transcript is empty: Only then use labels for generic titles**
6. **NEVER create generic titles like "Skyscraper View" or "City View" when VENUE NAMES are detected in OCR**

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

    return JSON.parse(content);
  } catch (err) {
    console.error("❌ JSON parsing failed:", err);
    console.log("Raw content:", response.choices[0].message.content);
    return [];
  }
};

module.exports = { generateAISummary };
