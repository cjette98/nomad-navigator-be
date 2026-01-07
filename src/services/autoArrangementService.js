const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Determine time block from a time string or activity type
 * @param {string|null} time - Time string (e.g., "2:00 PM", "morning")
 * @param {string} activityType - Activity type
 * @returns {string} - "morning", "afternoon", or "evening"
 */
const determineTimeBlock = (time, activityType = null) => {
  if (!time) {
    // Default based on activity type
    if (activityType === "restaurant") {
      // Restaurants default to lunch (afternoon) or dinner (evening)
      return "afternoon";
    }
    if (activityType === "accommodation") {
      return "afternoon"; // Check-in typically afternoon
    }
    return "morning"; // Default to morning
  }

  const timeStr = time.toLowerCase().trim();

  // Check for explicit time block mentions
  if (timeStr.includes("morning")) return "morning";
  if (timeStr.includes("afternoon")) return "afternoon";
  if (timeStr.includes("evening") || timeStr.includes("night")) return "evening";

  // Parse time strings
  const timeMatch = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const period = timeMatch[3].toLowerCase();

    if (period.includes("pm") || period.includes("p")) {
      if (hours !== 12) hours += 12;
    } else if (period.includes("am") || period.includes("a")) {
      if (hours === 12) hours = 0;
    }

    // Determine time block
    if (hours >= 6 && hours < 12) return "morning";
    if (hours >= 12 && hours < 18) return "afternoon";
    return "evening";
  }

  // Default based on activity type
  if (activityType === "restaurant") return "afternoon";
  return "morning";
};

/**
 * Rearrange a day's activities to fit a new inspiration activity
 * @param {object} trip - The trip object
 * @param {number} dayNumber - The day number (1, 2, 3, etc.)
 * @param {object} inspirationActivity - The new inspiration activity to add
 * @returns {Promise<Array>} - Rearranged activities array
 */
const arrangeDayWithInspiration = async (trip, dayNumber, inspirationActivity) => {
  try {
    const dayKey = `day${dayNumber}`;
    const itinerary = trip.itinerary || {};
    const day = itinerary[dayKey] || {};
    const existingActivities = day.activities || [];

    // Ensure inspiration activity has timeBlock
    if (!inspirationActivity.timeBlock) {
      inspirationActivity.timeBlock = determineTimeBlock(
        inspirationActivity.time,
        inspirationActivity.type
      );
    }

    // Add sourceType and sourceId if not present
    if (!inspirationActivity.sourceType) {
      inspirationActivity.sourceType = "inspiration";
    }

    // Prepare context for AI
    const tripInfo = {
      destination: trip.selectedTrip?.destination || "destination",
      vibe: trip.selectedTrip?.vibe || trip.selectedTrip?.theme || "mixed",
      budget: trip.selectedTrip?.budget || "mid",
    };

    const prompt = `You are an expert travel planner. Rearrange the activities for day ${dayNumber} of a trip to fit in a new inspiration activity.

Trip Context:
- Destination: ${tripInfo.destination}
- Vibe: ${tripInfo.vibe}
- Budget: ${tripInfo.budget}

Existing Activities for Day ${dayNumber}:
${JSON.stringify(existingActivities, null, 2)}

New Inspiration Activity to Add:
${JSON.stringify(inspirationActivity, null, 2)}

Task:
1. Add the new inspiration activity to the appropriate time block (${inspirationActivity.timeBlock})
2. Rearrange existing activities to create a logical flow throughout the day
3. Maintain a good distribution across morning, afternoon, and evening time blocks
4. Ensure activities make sense sequentially (e.g., breakfast before lunch)
5. Keep fixed activities (those with isFixed: true) in their current positions

Return ONLY a valid JSON array of activities in this exact format (no markdown, no explanations):
[
  {
    "id": "string (preserve existing IDs)",
    "name": "string",
    "timeBlock": "morning" | "afternoon" | "evening",
    "time": "optional specific time",
    "description": "string",
    "type": "attraction" | "restaurant" | "activity" | "transport" | "accommodation" | "other",
    "location": "string",
    "sourceType": "ai" | "inspiration" | "confirmation" | "manual",
    "sourceId": "optional string",
    "isFixed": "optional boolean"
  }
]

Rules:
- Include ALL existing activities plus the new inspiration activity
- Preserve all activity IDs from existing activities
- Maintain time block structure (morning, afternoon, evening)
- Do not duplicate activities
- Ensure the new inspiration activity is included in the result`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    let content = response.choices[0].message.content.trim();
    content = content.replace(/```json\s*/g, "").replace(/```/g, "").trim();

    const rearrangedActivities = JSON.parse(content);

    // Validate that all existing activity IDs are preserved
    const existingIds = new Set(existingActivities.map((a) => a.id).filter(Boolean));
    const resultIds = new Set(rearrangedActivities.map((a) => a.id).filter(Boolean));

    // Ensure new inspiration activity is included (may not have ID yet)
    const hasNewActivity = rearrangedActivities.some(
      (a) => a.name === inspirationActivity.name && a.sourceType === "inspiration"
    );

    if (!hasNewActivity) {
      // If AI didn't include it, add it manually
      rearrangedActivities.push({
        ...inspirationActivity,
        id: inspirationActivity.id || `insp_${Date.now()}`,
      });
    }

    return rearrangedActivities;
  } catch (error) {
    console.error("Error arranging day with inspiration:", error);
    // Fallback: just append the inspiration activity
    const dayKey = `day${dayNumber}`;
    const itinerary = trip.itinerary || {};
    const day = itinerary[dayKey] || {};
    const existingActivities = day.activities || [];

    if (!inspirationActivity.timeBlock) {
      inspirationActivity.timeBlock = determineTimeBlock(
        inspirationActivity.time,
        inspirationActivity.type
      );
    }

    return [...existingActivities, inspirationActivity];
  }
};

/**
 * Auto-slot a confirmation activity and rearrange the day
 * @param {object} trip - The trip object
 * @param {number} dayNumber - The day number
 * @param {object} confirmationActivity - The confirmation activity to add
 * @returns {Promise<Array>} - Rearranged activities array
 */
const arrangeDayWithConfirmation = async (trip, dayNumber, confirmationActivity) => {
  try {
    const dayKey = `day${dayNumber}`;
    const itinerary = trip.itinerary || {};
    const day = itinerary[dayKey] || {};
    const existingActivities = day.activities || [];

    // Confirmations are fixed and should not be moved
    confirmationActivity.isFixed = true;
    confirmationActivity.sourceType = "confirmation";

    // Ensure timeBlock is set
    if (!confirmationActivity.timeBlock) {
      confirmationActivity.timeBlock = determineTimeBlock(
        confirmationActivity.time,
        confirmationActivity.type
      );
    }

    // Prepare context for AI
    const tripInfo = {
      destination: trip.selectedTrip?.destination || "destination",
      vibe: trip.selectedTrip?.vibe || trip.selectedTrip?.theme || "mixed",
      budget: trip.selectedTrip?.budget || "mid",
    };

    const prompt = `You are an expert travel planner. Rearrange the activities for day ${dayNumber} of a trip to accommodate a fixed confirmation activity (like a flight or reservation).

Trip Context:
- Destination: ${tripInfo.destination}
- Vibe: ${tripInfo.vibe}
- Budget: ${tripInfo.budget}

Existing Activities for Day ${dayNumber}:
${JSON.stringify(existingActivities, null, 2)}

New Fixed Confirmation Activity (MUST be included and cannot be moved):
${JSON.stringify(confirmationActivity, null, 2)}

Task:
1. Include the fixed confirmation activity in its appropriate time block (${confirmationActivity.timeBlock})
2. Rearrange OTHER activities around the fixed confirmation
3. Ensure activities before/after the confirmation make logical sense
4. Maintain good distribution across time blocks
5. DO NOT move or change the fixed confirmation activity

Return ONLY a valid JSON array of activities in this exact format (no markdown, no explanations):
[
  {
    "id": "string (preserve existing IDs)",
    "name": "string",
    "timeBlock": "morning" | "afternoon" | "evening",
    "time": "optional specific time",
    "description": "string",
    "type": "attraction" | "restaurant" | "activity" | "transport" | "accommodation" | "other",
    "location": "string",
    "sourceType": "ai" | "inspiration" | "confirmation" | "manual",
    "sourceId": "optional string",
    "isFixed": "boolean (true for confirmation)"
  }
]

Rules:
- Include ALL existing activities plus the new confirmation activity
- The confirmation activity MUST have isFixed: true
- Preserve all activity IDs from existing activities
- Do not duplicate activities`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    let content = response.choices[0].message.content.trim();
    content = content.replace(/```json\s*/g, "").replace(/```/g, "").trim();

    const rearrangedActivities = JSON.parse(content);

    // Ensure confirmation is included
    const hasConfirmation = rearrangedActivities.some(
      (a) => a.isFixed === true && a.sourceType === "confirmation"
    );

    if (!hasConfirmation) {
      rearrangedActivities.push({
        ...confirmationActivity,
        id: confirmationActivity.id || `conf_${Date.now()}`,
      });
    }

    return rearrangedActivities;
  } catch (error) {
    console.error("Error arranging day with confirmation:", error);
    // Fallback: append confirmation activity
    const dayKey = `day${dayNumber}`;
    const itinerary = trip.itinerary || {};
    const day = itinerary[dayKey] || {};
    const existingActivities = day.activities || [];

    if (!confirmationActivity.timeBlock) {
      confirmationActivity.timeBlock = determineTimeBlock(
        confirmationActivity.time,
        confirmationActivity.type
      );
    }

    return [...existingActivities, confirmationActivity];
  }
};

/**
 * Regenerate day activities while avoiding duplicates
 * @param {object} trip - The trip object
 * @param {number} dayNumber - The day number
 * @param {Array<string>} excludeActivityIds - Activity IDs to exclude from regeneration (keep these)
 * @returns {Promise<Array>} - Regenerated activities array
 */
const regenerateDayActivities = async (trip, dayNumber, excludeActivityIds = []) => {
  try {
    const dayKey = `day${dayNumber}`;
    const itinerary = trip.itinerary || {};
    const day = itinerary[dayKey] || {};
    const existingActivities = day.activities || [];

    // Get activities to keep (fixed activities and those in excludeActivityIds)
    const activitiesToKeep = existingActivities.filter(
      (activity) => activity.isFixed === true || excludeActivityIds.includes(activity.id)
    );

    // Get all activity names from other days to avoid duplicates
    const allActivityNames = new Set();
    Object.keys(itinerary).forEach((key) => {
      if (key.startsWith("day") && key !== dayKey) {
        const otherDay = itinerary[key];
        if (otherDay?.activities) {
          otherDay.activities.forEach((activity) => {
            if (activity.name) {
              allActivityNames.add(activity.name.toLowerCase().trim());
            }
          });
        }
      }
    });

    // Also add names from activities to keep
    activitiesToKeep.forEach((activity) => {
      if (activity.name) {
        allActivityNames.add(activity.name.toLowerCase().trim());
      }
    });

    const tripInfo = {
      destination: trip.selectedTrip?.destination || "destination",
      vibe: trip.selectedTrip?.vibe || trip.selectedTrip?.theme || "mixed",
      budget: trip.selectedTrip?.budget || "mid",
      travelers: trip.selectedTrip?.travelers || 1,
    };

    const prompt = `You are an expert travel planner. Regenerate activities for day ${dayNumber} of a trip.

Trip Context:
- Destination: ${tripInfo.destination}
- Vibe: ${tripInfo.vibe}
- Budget: ${tripInfo.budget}
- Travelers: ${tripInfo.travelers}

Activities to Keep (these must be included and cannot be changed):
${JSON.stringify(activitiesToKeep, null, 2)}

Activities Already Scheduled on Other Days (DO NOT duplicate these):
${Array.from(allActivityNames).join(", ")}

Task:
1. Include all activities from "Activities to Keep" exactly as they are
2. Generate NEW activities to fill out the day (morning, afternoon, evening)
3. Ensure activities are organized by time blocks
4. Do NOT duplicate any activities from the "Already Scheduled" list
5. Create a logical flow throughout the day
6. Match the trip's vibe and budget

Return ONLY a valid JSON array of activities in this exact format (no markdown, no explanations):
[
  {
    "id": "string (preserve IDs for kept activities, generate new for others)",
    "name": "string",
    "timeBlock": "morning" | "afternoon" | "evening",
    "time": "optional specific time",
    "description": "string",
    "type": "attraction" | "restaurant" | "activity" | "transport" | "accommodation" | "other",
    "location": "string",
    "sourceType": "ai" | "inspiration" | "confirmation" | "manual",
    "sourceId": "optional string",
    "isFixed": "optional boolean"
  }
]

Rules:
- Include all activities from "Activities to Keep"
- Generate 2-3 new activities per time block (morning, afternoon, evening)
- Preserve IDs for kept activities
- Do not duplicate activities from other days
- All new activities should have sourceType: "ai"`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    let content = response.choices[0].message.content.trim();
    content = content.replace(/```json\s*/g, "").replace(/```/g, "").trim();

    const regeneratedActivities = JSON.parse(content);

    // Ensure all kept activities are included
    const keptIds = new Set(activitiesToKeep.map((a) => a.id).filter(Boolean));
    const resultIds = new Set(regeneratedActivities.map((a) => a.id).filter(Boolean));

    activitiesToKeep.forEach((keptActivity) => {
      if (!resultIds.has(keptActivity.id)) {
        regeneratedActivities.push(keptActivity);
      }
    });

    // Ensure all activities have timeBlock
    return regeneratedActivities.map((activity) => {
      if (!activity.timeBlock) {
        activity.timeBlock = determineTimeBlock(activity.time, activity.type);
      }
      if (!activity.sourceType && !activity.isFixed) {
        activity.sourceType = "ai";
      }
      return activity;
    });
  } catch (error) {
    console.error("Error regenerating day activities:", error);
    throw error;
  }
};

module.exports = {
  determineTimeBlock,
  arrangeDayWithInspiration,
  arrangeDayWithConfirmation,
  regenerateDayActivities,
};

