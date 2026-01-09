const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Get alternative activity recommendations for replacing an existing activity
 * @param {object} trip - The trip object
 * @param {number} dayNumber - The day number
 * @param {string} activityId - The ID of the activity to replace
 * @param {string|null} timeBlock - Optional time block filter
 * @returns {Promise<Array>} - Array of alternative activity options (3-5 activities)
 */
const getActivityAlternatives = async (trip, dayNumber, activityId, timeBlock = null) => {
  try {
    const dayKey = `day${dayNumber}`;
    const itinerary = trip.itinerary || {};
    const day = itinerary[dayKey] || {};
    const existingActivities = day.activities || [];

    // Find the activity to replace
    const activityToReplace = existingActivities.find((a) => a.id === activityId);
    if (!activityToReplace) {
      throw new Error("Activity not found");
    }

    // Use activity's timeBlock if not provided
    const targetTimeBlock = timeBlock || activityToReplace.timeBlock || "morning";

    // Get all activity names from the trip to avoid duplicates
    const allActivityNames = new Set();
    Object.keys(itinerary).forEach((key) => {
      if (key.startsWith("day")) {
        const dayData = itinerary[key];
        if (dayData?.activities) {
          dayData.activities.forEach((activity) => {
            if (activity.name && activity.id !== activityId) {
              allActivityNames.add(activity.name.toLowerCase().trim());
            }
          });
        }
      }
    });

    const tripInfo = {
      destination: trip.selectedTrip?.destination || "destination",
      vibe: trip.selectedTrip?.vibe || trip.selectedTrip?.theme || "mixed",
      budget: trip.selectedTrip?.budget || "mid",
      travelers: trip.selectedTrip?.travelers || 1,
    };

    // Get other activities for the same day for context
    const otherDayActivities = existingActivities.filter((a) => a.id !== activityId);

    const prompt = `You are an expert travel planner. Generate alternative activity recommendations to replace an existing activity.

Trip Context:
- Destination: ${tripInfo.destination}
- Vibe: ${tripInfo.vibe}
- Budget: ${tripInfo.budget}
- Travelers: ${tripInfo.travelers}

Activity to Replace:
${JSON.stringify(activityToReplace, null, 2)}

Other Activities on Day ${dayNumber} (for context):
${JSON.stringify(otherDayActivities, null, 2)}

Requirements:
- Time Block: ${targetTimeBlock}
- Activity Type: ${activityToReplace.type || "activity"}
- Should fit the same time slot and general theme
- Should match the trip's vibe and budget

Activities Already Scheduled (DO NOT duplicate):
${Array.from(allActivityNames).join(", ")}

Task:
Generate 3-5 alternative activities that:
1. Fit the same time block (${targetTimeBlock})
2. Match or complement the activity type (${activityToReplace.type || "activity"})
3. Are appropriate for the destination and trip vibe
4. Fit within the budget
5. Are NOT in the "Already Scheduled" list
6. Make sense in the context of other day activities

Return ONLY a valid JSON array of alternative activities in this exact format (no markdown, no explanations):
[
  {
    "name": "string",
    "timeBlock": "${targetTimeBlock}",
    "time": "optional specific time",
    "description": "string (1-2 sentences)",
    "type": "${activityToReplace.type || "activity"}",
    "location": "string",
    "sourceType": "ai"
  }
]

Rules:
- Return exactly 3-5 alternative activities
- All activities must have timeBlock: "${targetTimeBlock}"
- Do not duplicate any activities from the "Already Scheduled" list
- Activities should be diverse and interesting
- Each activity should be a viable replacement option`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8, // Slightly higher for more variety
    });

    let content = response.choices[0].message.content.trim();
    content = content.replace(/```json\s*/g, "").replace(/```/g, "").trim();

    const alternatives = JSON.parse(content);

    // Ensure all alternatives have required fields
    return alternatives.map((activity) => ({
      ...activity,
      timeBlock: activity.timeBlock || targetTimeBlock,
      type: activity.type || activityToReplace.type || "activity",
      sourceType: "ai",
    }));
  } catch (error) {
    console.error("Error getting activity alternatives:", error);
    throw error;
  }
};

module.exports = {
  getActivityAlternatives,
};

