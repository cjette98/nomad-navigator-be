const OpenAI = require("openai");
const { getTravelPreferences } = require("./travelPreferenceService");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate three trip suggestions with different vibes based on user's travel preferences
 * @param {string} userId - The user ID from Clerk
 * @returns {Promise<object>} - Object containing three trip suggestions (adventure, relaxing, cultural)
 */
const generateTripSuggestions = async (userId) => {
  try {
    // Get user's travel preferences
    const preferences = await getTravelPreferences(userId);

    if (!preferences) {
      throw new Error("Travel preferences not found. Please save your preferences first.");
    }

    // Build a descriptive prompt based on preferences
    const preferencesText = JSON.stringify(preferences, null, 2);

    const prompt = `You are a travel planning expert. Based on the following user travel preferences, generate exactly 3 trip suggestions with different "vibes":

User Travel Preferences:
${preferencesText}

Generate three distinct trip suggestions, each with a different vibe:
1. **Adventure** - Active, thrilling, outdoor activities, exploration
2. **Relaxing** - Peaceful, rejuvenating, spa-like, low-key
3. **Cultural** - Historical sites, local traditions, museums, authentic experiences

For each trip suggestion, provide:
- destination: The main destination (city, region, or country)
- vibe: "adventure", "relaxing", or "cultural"
- title: A catchy title for the trip (e.g., "Mountain Adventure in the Alps")
- description: A 2-3 sentence description of what makes this trip special
- highlights: An array of 3-5 key highlights/activities
- duration: Suggested trip duration (e.g., "5-7 days")
- bestTimeToVisit: When to visit (e.g., "May-September")
- estimatedBudget: Budget range (e.g., "$1,500-$2,500" or "Moderate")

Return ONLY a valid JSON object in this exact format (no markdown, no explanations):
{
  "suggestions": [
    {
      "destination": "string",
      "vibe": "adventure",
      "title": "string",
      "description": "string",
      "highlights": ["string", "string", "string"],
      "duration": "string",
      "bestTimeToVisit": "string",
      "estimatedBudget": "string"
    },
    {
      "destination": "string",
      "vibe": "relaxing",
      "title": "string",
      "description": "string",
      "highlights": ["string", "string", "string"],
      "duration": "string",
      "bestTimeToVisit": "string",
      "estimatedBudget": "string"
    },
    {
      "destination": "string",
      "vibe": "cultural",
      "title": "string",
      "description": "string",
      "highlights": ["string", "string", "string"],
      "duration": "string",
      "bestTimeToVisit": "string",
      "estimatedBudget": "string"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });

    try {
      let content = response.choices[0].message.content.trim();

      content = content
        .replace(/```json\s*/g, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(content);

      if (!parsed.suggestions || !Array.isArray(parsed.suggestions) || parsed.suggestions.length !== 3) {
        throw new Error("Invalid response structure from AI");
      }

      return parsed;
    } catch (err) {
      console.error("❌ JSON parsing failed:", err);
      console.log("Raw content:", response.choices[0].message.content);
      throw new Error("Failed to parse AI response");
    }
  } catch (error) {
    console.error("Error generating trip suggestions:", error);
    throw error;
  }
};

module.exports = { generateTripSuggestions };
