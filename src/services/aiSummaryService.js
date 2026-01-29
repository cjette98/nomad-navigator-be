const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generateAISummary = async (labels, texts, transcript, description) => {
  const allTranscript = transcript?.join(" ") || "none";
  const allTexts = texts?.join(", ") || "none";

  const prompt = `
You are an expert Content Analyst. Your task is to extract a comprehensive, deduplicated list of specific entities (places, or venues) mentioned in a video.

INPUT DATA:
- Visual Text (OCR): ${allTexts}
- Speech Transcript: ${allTranscript}
- Video Caption: ${description || "none"}
- Labels: ${labels?.join(", ") || "none"}

====================================
🎯 TASK
====================================
- **FILTER**: Remove UI elements (e.g., "Order Here", "Link in Bio"), time stamps, or generic metadata that aren't actual entities.
- Identify all unique travel venues, cities, or landmarks mentioned **EXTRACT**: Identify every unique subject, venue, that is the focus of a segment in the video.
- **CLEAN & DEDUPLICATE**: OCR data is noisy. Group variations (e.g., "Lke Como", "10. Lake Como", "LAKECOMO") into one clean, professional title (e.g., "Lake Como").
- SCRAPE the Visual Text for every possible venue name. 
- For each unique venue, create a summary item.

====================================
🧱 OUTPUT FORMAT
====================================
Return ONLY a valid JSON array:

[
  {
    "title": "Clean Venue Name",
    "description": "Brief 1-2 sentence description based on the video context",
    "category": "Restaurant | Activity | Landmark | Shop | Accommodation | Other"
  }
]

====================================
🚨 RULES
====================================
- Do not include generic country names (e.g., "Italy") if specific cities/landmarks are mentioned.
- No duplicates or "gibberish" strings from the OCR.
- If no specific venues are found, return an empty array [].
- Return ONLY the JSON array.
`.trim();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are a travel assistant that extracts specific locations and returns data in valid JSON format." 
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0].message.content.trim();
    const parsedData = JSON.parse(content);
    
    // Extract the array regardless of the key the AI uses
    const results = Array.isArray(parsedData) ? parsedData : Object.values(parsedData)[0];

    if (!Array.isArray(results)) {
      return [];
    }

    console.log(`✅ Extracted and summarized ${results.length} venues.`);
    return results;

  } catch (err) {
    console.error("❌ generateAISummary failed:", err.message);
    return [];
  }
};

module.exports = { generateAISummary };