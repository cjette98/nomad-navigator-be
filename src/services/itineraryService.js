const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a 3-day itinerary for a selected trip
 * @param {object} selectedTrip - The selected trip suggestion data
 * @returns {Promise<object>} - Object containing 3-day itinerary with activities
 */
const generateItinerary = async (selectedTrip) => {
  try {
    const tripInfo = JSON.stringify(selectedTrip, null, 2);

    const prompt = `You are an expert travel planner. Generate a detailed 3-day itinerary for the following trip:

Trip Details:
${tripInfo}

Create a comprehensive 3-day itinerary with specific activities for each day. Each day should have:
- A variety of activities that match the trip's vibe (${selectedTrip.vibe || "mixed"})
- Realistic timing and locations
- Mix of must-see attractions, local experiences, and meals
- Activities that align with the destination and trip highlights

For each activity, provide:
- name: The name of the activity/place
- time: Suggested time (e.g., "9:00 AM", "2:00 PM", "Evening")
- description: A brief description (1-2 sentences)
- type: One of: "attraction", "restaurant", "activity", "transport", "accommodation", "other"
- location: The location/address if relevant

Return ONLY a valid JSON object in this exact format (no markdown, no explanations):
{
  "day1": {
    "activities": [
      {
        "name": "string",
        "time": "string",
        "description": "string",
        "type": "attraction",
        "location": "string"
      }
    ]
  },
  "day2": {
    "activities": [
      {
        "name": "string",
        "time": "string",
        "description": "string",
        "type": "attraction",
        "location": "string"
      }
    ]
  },
  "day3": {
    "activities": [
      {
        "name": "string",
        "time": "string",
        "description": "string",
        "type": "attraction",
        "location": "string"
      }
    ]
  }
}

Each day should have at least 4-6 activities covering morning, afternoon, and evening.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    try {
      let content = response.choices[0].message.content.trim();

      content = content
        .replace(/```json\s*/g, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(content);

      // Validate the structure
      if (!parsed.day1 || !parsed.day2 || !parsed.day3) {
        throw new Error("Invalid response structure from AI - missing days");
      }

      if (
        !parsed.day1.activities ||
        !parsed.day2.activities ||
        !parsed.day3.activities
      ) {
        throw new Error("Invalid response structure from AI - missing activities");
      }

      return parsed;
    } catch (err) {
      console.error("❌ JSON parsing failed:", err);
      console.log("Raw content:", response.choices[0].message.content);
      throw new Error("Failed to parse AI response");
    }
  } catch (error) {
    console.error("Error generating itinerary:", error);
    throw error;
  }
};

module.exports = { generateItinerary };
