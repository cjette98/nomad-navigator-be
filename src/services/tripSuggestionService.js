const OpenAI = require("openai");
const { getTravelPreferences } = require("./travelPreferenceService");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate trip suggestions tailored to the request form + saved preferences.
 * Each suggestion follows a consistent shape for the UI.
 * @param {string} userId - The user ID from Clerk
 * @param {object} requestDetails - Trip request form fields
 * @returns {Promise<object>} - Object containing trip suggestions
 */
const generateTripSuggestions = async (userId, requestDetails = {}) => {
  try {
    // Get user's travel preferences (optional context)
    const preferences = await getTravelPreferences(userId);
    const preferencesText = preferences ? JSON.stringify(preferences, null, 2) : "None saved";

    const requestText = JSON.stringify(requestDetails, null, 2);

    const prompt = `You are a travel planning expert. Use the user's saved travel preferences (if any) AND the trip request form fields to tailor exactly 3 trip suggestions with different vibes.

Saved Travel Preferences (may be "None saved"):
${preferencesText}

Trip Request Form Fields (all user-provided; prefer these over defaults):
${requestText}

Generate three distinct trip suggestions, each with a different vibe/theme (adventure, relaxing, cultural or other appropriate theme). Ensure variety.

Rules:
- Honor the requested destination or vibe. If both are vague, pick fitting options.
- If startDate/endDate are provided, use them as start_date/end_date. If only durationDays is provided, propose dates that fit (start_date today+14 days by default). If none, propose a sensible 4-7 day window.
- Incorporate mustHaves into highlights.
- Match the tone to travelPace, travelers, and budget.

For each trip suggestion, provide:
- name: Catchy trip name
- destination: Main destination (city/region/country)
- start_date: ISO date string (YYYY-MM-DD)
- end_date: ISO date string (YYYY-MM-DD) aligned with duration
- description: 2-3 sentence overview
- theme: Short theme label (e.g., "Nature and Wellness")
- highlights: 3-5 concise highlight strings that reflect mustHaves, pace, travelers, budget
- dateNotes: Brief note on how dates/duration were chosen

Return ONLY a valid JSON object in this exact format (no markdown, no explanations):
{
  "suggestions": [
    {
      "name": "string",
      "destination": "string",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "description": "string",
      "theme": "string",
      "highlights": ["string", "string", "string"],
      "dateNotes": "string"
    },
    {
      "name": "string",
      "destination": "string",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "description": "string",
      "theme": "string",
      "highlights": ["string", "string", "string"],
      "dateNotes": "string"
    },
    {
      "name": "string",
      "destination": "string",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "description": "string",
      "theme": "string",
      "highlights": ["string", "string", "string"],
      "dateNotes": "string"
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

      parsed.suggestions.forEach((s, idx) => {
        if (
          !s.name ||
          !s.destination ||
          !s.start_date ||
          !s.end_date ||
          !s.description ||
          !s.theme ||
          !Array.isArray(s.highlights) ||
          s.highlights.length === 0
        ) {
          throw new Error(`Suggestion ${idx + 1} missing required fields`);
        }
      });

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
