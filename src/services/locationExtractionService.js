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

  const prompt = `You are a location extraction assistant. Analyze the following content and identify all primary locations (cities, countries, regions, or specific places) mentioned.

Content:
${contentText}

Return ONLY a valid JSON array of location names (strings), without any explanations or markdown.
If no clear locations are found, return an empty array [].

Examples of valid locations: "Paris", "Tokyo", "New York", "Bali", "Tuscany", "Eiffel Tower", "Shibuya District"
Examples of invalid (not locations): "Restaurant", "Cafe", "Food", "Travel", "Lifestyle"

Output format: ["Location1", "Location2", ...]`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    let content = response.choices[0].message.content.trim();
    // Remove markdown formatting if present
    content = content.replace(/```json\s*/g, "").replace(/```/g, "").trim();

    const locations = JSON.parse(content);
    return Array.isArray(locations) ? locations.filter((loc) => loc && typeof loc === "string") : [];
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
