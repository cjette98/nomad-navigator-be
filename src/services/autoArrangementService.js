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
 * Regenerate day activities by reshuffling existing activities across time blocks
 * @param {object} trip - The trip object
 * @param {number} dayNumber - The day number
 * @param {Array<string>} excludeActivityIds - Activity IDs to exclude from reshuffling (keep their timeblocks)
 * @returns {Promise<Array>} - Reshuffled activities array
 */
const regenerateDayActivities = async (trip, dayNumber, excludeActivityIds = []) => {
  try {
    const dayKey = `day${dayNumber}`;
    const itinerary = trip.itinerary || {};
    const day = itinerary[dayKey] || {};
    const existingActivities = day.activities || [];

    if (existingActivities.length === 0) {
      return [];
    }

    // Separate activities into fixed (cannot be moved) and flexible (can be reshuffled)
    const fixedActivities = existingActivities.filter(
      (activity) => activity.isFixed === true || excludeActivityIds.includes(activity.id)
    );
    const flexibleActivities = existingActivities.filter(
      (activity) => activity.isFixed !== true && !excludeActivityIds.includes(activity.id)
    );

    // If no flexible activities, return as-is
    if (flexibleActivities.length === 0) {
      return existingActivities;
    }

    const tripInfo = {
      destination: trip.selectedTrip?.destination || "destination",
      vibe: trip.selectedTrip?.vibe || trip.selectedTrip?.theme || "mixed",
    };

    const prompt = `You are an expert travel planner. Reshuffle the activities for day ${dayNumber} by redistributing them across time blocks.

Trip Context:
- Destination: ${tripInfo.destination}
- Vibe: ${tripInfo.vibe}

Fixed Activities (these MUST keep their current timeBlock and cannot be moved):
${JSON.stringify(fixedActivities, null, 2)}

Flexible Activities (these need to be reshuffled across time blocks: morning, afternoon, evening):
${JSON.stringify(flexibleActivities, null, 2)}

Task:
1. Keep ALL fixed activities exactly as they are (same timeBlock, same position)
2. Reshuffle ONLY the flexible activities across the three time blocks: morning, afternoon, evening
3. Ensure activities are logically distributed across morning, afternoon, and evening
4. Create a logical flow throughout the day
5. DO NOT create new activities - only use the existing flexible activities
6. DO NOT change any activity properties except timeBlock (and optionally time for better flow)

Return ONLY a valid JSON array of ALL activities (fixed + reshuffled flexible) in this exact format (no markdown, no explanations):
[
  {
    "id": "string (preserve all existing IDs)",
    "name": "string (preserve existing names)",
    "timeBlock": "morning" | "afternoon" | "evening" (reshuffle flexible activities only)",
    "time": "optional specific time",
    "description": "string (preserve existing descriptions)",
    "type": "attraction" | "restaurant" | "activity" | "transport" | "accommodation" | "other",
    "location": "string (preserve existing locations)",
    "sourceType": "ai" | "inspiration" | "confirmation" | "manual",
    "sourceId": "optional string",
    "isFixed": "optional boolean"
  }
]

Rules:
- Include ALL activities (fixed + flexible) in the result
- Preserve ALL IDs, names, descriptions, types, locations, and other properties
- Fixed activities MUST keep their original timeBlock
- Only reshuffle flexible activities across morning, afternoon, evening time blocks
- Do NOT create, remove, or modify any activities beyond changing timeBlock for flexible ones
- Ensure good distribution across the three time blocks`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    let content = response.choices[0].message.content.trim();
    content = content.replace(/```json\s*/g, "").replace(/```/g, "").trim();

    const reshuffledActivities = JSON.parse(content);

    // Validate that all activities are preserved
    const existingIds = new Set(existingActivities.map((a) => a.id).filter(Boolean));
    const resultIds = new Set(reshuffledActivities.map((a) => a.id).filter(Boolean));

    // Ensure all activities are included
    if (existingIds.size !== resultIds.size) {
      console.warn("Warning: Some activities may have been lost during reshuffle. Falling back to simple reshuffle.");
      // Fallback: simple reshuffle keeping fixed activities in place
      return simpleReshuffle(existingActivities, fixedActivities.map(a => a.id));
    }

    // Ensure all activities have valid timeBlock (morning, afternoon, or evening)
    // Preserve all original properties while using reshuffled timeBlock
    return reshuffledActivities.map((activity) => {
      // Find original activity to preserve all properties
      const originalActivity = existingActivities.find(a => a.id === activity.id);
      
      if (originalActivity) {
        // Preserve all original properties, but use reshuffled timeBlock for flexible activities
        const isFixed = originalActivity.isFixed === true || excludeActivityIds.includes(originalActivity.id);
        
        // For fixed activities, keep original timeBlock; for flexible, use reshuffled
        const finalTimeBlock = isFixed 
          ? originalActivity.timeBlock 
          : (activity.timeBlock || originalActivity.timeBlock);
        
        // Merge original with reshuffled timeBlock, ensuring all original properties are preserved
        const mergedActivity = {
          ...originalActivity,
          timeBlock: finalTimeBlock,
        };

        // Ensure timeBlock is one of the three valid options
        if (!["morning", "afternoon", "evening"].includes(mergedActivity.timeBlock)) {
          mergedActivity.timeBlock = determineTimeBlock(mergedActivity.time, mergedActivity.type);
        }

        // Final validation - ensure timeBlock is valid
        if (!["morning", "afternoon", "evening"].includes(mergedActivity.timeBlock)) {
          mergedActivity.timeBlock = "morning"; // Default fallback
        }

        return mergedActivity;
      }

      // If original not found (shouldn't happen), use reshuffled with validation
      if (!["morning", "afternoon", "evening"].includes(activity.timeBlock)) {
        activity.timeBlock = determineTimeBlock(activity.time, activity.type);
      }
      
      if (!["morning", "afternoon", "evening"].includes(activity.timeBlock)) {
        activity.timeBlock = "morning"; // Default fallback
      }

      return activity;
    });
  } catch (error) {
    console.error("Error regenerating day activities:", error);
    // Fallback: simple reshuffle
    try {
      const dayKey = `day${dayNumber}`;
      const itinerary = trip.itinerary || {};
      const day = itinerary[dayKey] || {};
      const existingActivities = day.activities || [];
      const fixedActivityIds = existingActivities
        .filter(a => a.isFixed === true || excludeActivityIds.includes(a.id))
        .map(a => a.id);
      return simpleReshuffle(existingActivities, fixedActivityIds);
    } catch (fallbackError) {
      console.error("Error in fallback reshuffle:", fallbackError);
      // Last resort: return original activities
      const dayKey = `day${dayNumber}`;
      const itinerary = trip.itinerary || {};
      const day = itinerary[dayKey] || {};
      return day.activities || [];
    }
  }
};

/**
 * Simple reshuffle fallback that redistributes activities across time blocks
 * @param {Array} activities - Activities to reshuffle
 * @param {Array<string>} fixedActivityIds - IDs of activities that should keep their timeBlock
 * @returns {Array} - Reshuffled activities
 */
const simpleReshuffle = (activities, fixedActivityIds = []) => {
  const timeBlocks = ["morning", "afternoon", "evening"];
  
  // Separate fixed and flexible activities
  const fixedActivities = activities.filter(a => fixedActivityIds.includes(a.id));
  const flexibleActivities = activities.filter(a => !fixedActivityIds.includes(a.id));

  // Shuffle flexible activities
  const shuffled = [...flexibleActivities].sort(() => Math.random() - 0.5);

  // Distribute shuffled activities across time blocks
  const distributed = shuffled.map((activity, index) => ({
    ...activity,
    timeBlock: timeBlocks[index % timeBlocks.length],
  }));

  // Combine fixed (with original timeBlock) and redistributed flexible activities
  return [...fixedActivities, ...distributed];
};

module.exports = {
  determineTimeBlock,
  arrangeDayWithInspiration,
  arrangeDayWithConfirmation,
  regenerateDayActivities,
};

