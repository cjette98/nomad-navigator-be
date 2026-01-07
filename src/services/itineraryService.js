const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate an itinerary sized to the provided start/end dates or duration.
 * @param {object} selectedTrip - The selected trip suggestion data
 * @returns {Promise<object>} - Object containing itinerary with per-day activities
 */
const generateItinerary = async (selectedTrip) => {
  try {
    const toDate = (value) => (value ? new Date(value) : null);
    const formatDate = (date) =>
      date instanceof Date && !isNaN(date) ? date.toISOString().split("T")[0] : null;

    const startDateInput = selectedTrip.start_date || selectedTrip.startDate;
    const endDateInput = selectedTrip.end_date || selectedTrip.endDate;
    const durationInput = selectedTrip.durationDays || selectedTrip.duration || selectedTrip.days;

    const startDate = toDate(startDateInput);
    const endDate = toDate(endDateInput);
    const durationDays = Number.isFinite(Number(durationInput)) ? Number(durationInput) : null;

    let computedStart = startDate;
    let computedEnd = endDate;
    let dayCount = 3;

    if (startDate && endDate) {
      const diffMs = endDate - startDate;
      const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
      dayCount = diffDays;
    } else if (startDate && durationDays) {
      computedStart = startDate;
      computedEnd = new Date(startDate);
      computedEnd.setDate(startDate.getDate() + durationDays - 1);
      dayCount = durationDays;
    } else if (durationDays) {
      // No dates; use a sensible default window ~2 weeks out
      const seed = new Date();
      seed.setDate(seed.getDate() + 14);
      computedStart = seed;
      computedEnd = new Date(seed);
      computedEnd.setDate(seed.getDate() + durationDays - 1);
      dayCount = durationDays;
    } else {
      // fallback to 4-day default window
      const seed = new Date();
      seed.setDate(seed.getDate() + 14);
      computedStart = seed;
      computedEnd = new Date(seed);
      computedEnd.setDate(seed.getDate() + 3);
      dayCount = 4;
    }

    const startDateStr = formatDate(computedStart || startDate) || formatDate(startDate) || "";
    const endDateStr = formatDate(computedEnd || endDate) || formatDate(endDate) || "";

    const tripInfo = JSON.stringify(selectedTrip, null, 2);

    const prompt = `You are an expert travel planner. Generate a detailed itinerary for the following trip:

Trip Details:
${tripInfo}

Dates and duration:
- start_date: ${startDateStr || "unset"}
- end_date: ${endDateStr || "unset"}
- total_days to produce: ${dayCount}

Create a comprehensive itinerary with specific activities for EACH day (day1 to day${dayCount}). Each day should have:
- A variety of activities that match the trip's vibe/theme (${selectedTrip.vibe || selectedTrip.theme || "mixed"})
- Realistic timing and locations
- Mix of must-see attractions, local experiences, and meals
- Activities that align with the destination and trip highlights

IMPORTANT: Organize activities by time blocks (mornxing, afternoon, evening) instead of exact times:
- Morning: 6:00 AM - 12:00 PM
- Afternoon: 12:00 PM - 6:00 PM
- Evening: 6:00 PM - 12:00 AM

For each activity, provide:
- name: The name of the activity/place
- timeBlock: One of "morning", "afternoon", or "evening" (REQUIRED)
- time: Optional specific time if needed (e.g., "9:00 AM" for a specific reservation, otherwise omit)
- description: A brief description (1-2 sentences)
- type: One of: "attraction", "restaurant", "activity", "transport", "accommodation", "other"
- location: The location/address if relevant

Return ONLY a valid JSON object in this exact format (no markdown, no explanations):
{
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "total_days": ${dayCount},
  "day1": {
    "date": "YYYY-MM-DD",
    "summary": "short overview of the day",
    "activities": [
      { "name": "string", "timeBlock": "morning", "time": "optional specific time", "description": "string", "type": "attraction", "location": "string" }
    ]
  },
  "day2": {
    "date": "YYYY-MM-DD",
    "summary": "short overview of the day",
    "activities": [
      { "name": "string", "timeBlock": "afternoon", "description": "string", "type": "attraction", "location": "string" }
    ]
  },
  "...": {}
}

Rules:
- Include day1 through day${dayCount} (no extra days).
- If a date is missing, infer sequential dates from start_date.
- Each day should have 2-3 activities per time block (morning, afternoon, evening).
- All activities MUST have a timeBlock field ("morning", "afternoon", or "evening").
- Only include the "time" field if there's a specific time requirement (e.g., reservation, flight).`;

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
      if (!parsed.total_days || typeof parsed.total_days !== "number") {
        throw new Error("Invalid response structure from AI - missing total_days");
      }

      const expectedDays = parsed.total_days;
      for (let i = 1; i <= expectedDays; i++) {
        const dayKey = `day${i}`;
        const day = parsed[dayKey];
        if (!day || !Array.isArray(day.activities)) {
          throw new Error(`Invalid response structure from AI - missing ${dayKey} activities`);
        }

        // Ensure all activities have timeBlock field and add sourceType
        day.activities = day.activities.map((activity) => {
          // If timeBlock is missing, try to infer from time field
          if (!activity.timeBlock && activity.time) {
            const timeStr = activity.time.toLowerCase();
            if (timeStr.includes("morning") || timeStr.includes("am") && !timeStr.includes("pm")) {
              activity.timeBlock = "morning";
            } else if (timeStr.includes("afternoon") || (timeStr.includes("pm") && !timeStr.includes("am"))) {
              activity.timeBlock = "afternoon";
            } else if (timeStr.includes("evening") || timeStr.includes("night")) {
              activity.timeBlock = "evening";
            } else {
              // Default to morning if can't determine
              activity.timeBlock = "morning";
            }
          } else if (!activity.timeBlock) {
            // Default to morning if no time info
            activity.timeBlock = "morning";
          }

          // Ensure timeBlock is valid
          if (!["morning", "afternoon", "evening"].includes(activity.timeBlock)) {
            activity.timeBlock = "morning";
          }

          // Add sourceType for AI-generated activities
          activity.sourceType = "ai";

          return activity;
        });
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
