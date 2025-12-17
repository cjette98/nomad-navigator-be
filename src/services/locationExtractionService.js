const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract primary locations from AI summary data
 * @param {Array} summaryData - Array of items from AI summary (video or link)
 * @returns {Promise<Array<string>>} - Array of location names
 */
const extractLocations = async (summaryData) => {
  if (!Array.isArray(summaryData) || summaryData.length === 0) {
    return [];
  }

  // Extract titles and descriptions for location detection
  const contentText = summaryData
    .map((item) => `${item.title || ""} ${item.description || ""}`)
    .join(" ");

  if (!contentText.trim()) {
    return [];
  }

  const prompt = `You are a location extraction assistant. Analyze the following content and identify the PRIMARY location where the content is actually filmed, featured, or takes place.

Content:
${contentText}

CRITICAL RULES:
1. Focus on the ACTUAL location where the content is filmed/featured, NOT where food items or dishes originate from
2. If a cafe/restaurant is mentioned with a location (e.g., "Cesar's Cafe in Legazpi, Albay"), that is the PRIMARY location
3. Do NOT extract locations based on food origins (e.g., don't extract "Indonesia" just because "Nasi Goreng" is mentioned - extract the location where the restaurant/cafe actually is)
4. If multiple locations are mentioned, prioritize the most specific and relevant one (city/region over country)
5. Return ONLY the PRIMARY location - a single location string, not an array

Return ONLY a single location string in the format "City/Place, Country" without any explanations, markdown, or JSON formatting.
If no clear location is found, return an empty string "".

Examples of correct extraction:
- Content mentions "Cesar's Cafe in Legazpi, Albay" and dishes like "Nasi Goreng" → Return: "Legazpi, Philippines" (NOT "Indonesia")
- Content mentions "Restaurant in Paris" and "Pizza" → Return: "Paris, France" (NOT "Italy")
- Content mentions "Tokyo cafe" and "French pastries" → Return: "Tokyo, Japan" (NOT "France")

Examples of valid locations: 
- "Paris, France"
- "Tokyo, Japan"
- "Legazpi, Philippines"
- "New York, United States"
- "Bali, Indonesia"
- "Tuscany, Italy"

Output format: "City/Place, Country" or "" if no location found`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2, // Lower temperature for more consistent location extraction
    });

    let content = response.choices[0].message.content.trim();
    // Remove markdown formatting if present
    content = content.replace(/```json\s*/g, "").replace(/```/g, "").replace(/"/g, "").trim();

    // Return as array with single location, or empty array
    if (!content || content === "" || content === "null") {
      return [];
    }
    
    return [content]; // Return as array with single primary location
  } catch (err) {
    console.error("❌ Error extracting locations:", err);
    // Fallback: try to extract location-like words from titles
    const fallbackLocations = summaryData
      .map((item) => {
        const title = item.title || "";
        // Simple heuristic: if title looks like a location (capitalized, not a category)
        if (title && title[0] === title[0].toUpperCase() && title.length > 2) {
          const categories = ["Restaurant", "Cafe", "Travel", "Food", "Product", "Lifestyle", "Lodging", "Sightseeing", "Experience", "Logistics", "Shopping", "Other"];
          if (!categories.includes(title)) {
            return title;
          }
        }
        return null;
      })
      .filter((loc) => loc !== null);

    return [...new Set(fallbackLocations)]; // Remove duplicates
  }
};

module.exports = { extractLocations };
