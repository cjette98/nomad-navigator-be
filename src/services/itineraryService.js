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

IMPORTANT: Organize activities by time blocks (morning, afternoon, evening) instead of exact times:
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
- Each day should have 3-5 activities per time block (morning, afternoon, evening).
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

/**
 * Generate an itinerary with user-controlled trip details, incorporating confirmations and inspirations
 * @param {object} tripData - The trip data with full user control
 * @param {Array<string>} confirmationIds - Optional array of confirmation IDs
 * @param {Array<string>} inspirationIds - Optional array of inspiration IDs
 * @param {string} userId - The user ID for fetching confirmations and inspirations
 * @returns {Promise<object>} - Object containing itinerary with per-day activities
 */
const generateItineraryWithCollaboration = async (tripData, confirmationIds = [], inspirationIds = [], userId) => {
  try {
    const { getUserConfirmations, formatConfirmationToActivity, determineDayFromConfirmation } = require("./travelConfirmationService");
    const { getInspirationItemsByIds, formatInspirationItemsToActivities } = require("./categorizationService");
    
    const toDate = (value) => (value ? new Date(value) : null);
    const formatDate = (date) =>
      date instanceof Date && !isNaN(date) ? date.toISOString().split("T")[0] : null;

    const startDateInput = tripData.start_date || tripData.startDate;
    const endDateInput = tripData.end_date || tripData.endDate;
    const durationInput = tripData.durationDays || tripData.duration || tripData.days;

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
      const seed = new Date();
      seed.setDate(seed.getDate() + 14);
      computedStart = seed;
      computedEnd = new Date(seed);
      computedEnd.setDate(seed.getDate() + durationDays - 1);
      dayCount = durationDays;
    } else {
      const seed = new Date();
      seed.setDate(seed.getDate() + 14);
      computedStart = seed;
      computedEnd = new Date(seed);
      computedEnd.setDate(seed.getDate() + 3);
      dayCount = 4;
    }

    const startDateStr = formatDate(computedStart || startDate) || formatDate(startDate) || "";
    const endDateStr = formatDate(computedEnd || endDate) || formatDate(endDate) || "";

    // Get confirmations if IDs provided
    let confirmations = [];
    let confirmationActivities = [];
    if (confirmationIds && confirmationIds.length > 0 && userId) {
      try {
        const allConfirmations = await getUserConfirmations(userId);
        confirmations = allConfirmations.filter((conf) => confirmationIds.includes(conf.id));
        console.log(`📋 Found ${confirmations.length} confirmation(s) to incorporate`);
        
        // Create a temporary trip object for day determination
        const tempTrip = {
          selectedTrip: {
            start_date: startDateStr,
            end_date: endDateStr,
          },
          itinerary: {},
        };
        
        // Format confirmations to activities and determine their days
        for (const confirmation of confirmations) {
          const activity = formatConfirmationToActivity(confirmation);
          const day = (await determineDayFromConfirmation(confirmation, tempTrip)) || 1;
          activity._day = day;
          confirmationActivities.push({ activity, day });
        }
      } catch (error) {
        console.error("Error fetching confirmations:", error);
      }
    }

    // Get inspirations if IDs provided
    let inspirationActivities = [];
    if (inspirationIds && inspirationIds.length > 0 && userId) {
      try {
        const inspirations = await getInspirationItemsByIds(inspirationIds, userId);
        console.log(`✨ Found ${inspirations.length} inspiration(s) to incorporate`);
        
        if (inspirations.length > 0) {
          const formatted = formatInspirationItemsToActivities(inspirations);
          inspirationActivities = formatted;
        }
      } catch (error) {
        console.error("Error fetching inspirations:", error);
      }
    }

    // If no inspirations or confirmations provided, create empty itinerary structure
    if (confirmationActivities.length === 0 && inspirationActivities.length === 0) {
      const emptyItinerary = {
        start_date: startDateStr,
        end_date: endDateStr,
        total_days: dayCount,
      };

      // Calculate dates for each day
      const start = computedStart || startDate || new Date();
      for (let i = 1; i <= dayCount; i++) {
        const dayDate = new Date(start);
        dayDate.setDate(start.getDate() + (i - 1));
        const dayKey = `day${i}`;
        emptyItinerary[dayKey] = {
          date: formatDate(dayDate),
          summary: "",
          activities: [],
        };
      }

      return emptyItinerary;
    }

    let confirmationsText = "";
    if (confirmationActivities.length > 0) {
      confirmationsText = "\n\nEXISTING BOOKINGS/CONFIRMATIONS (must be included in itinerary):\n";
      confirmationActivities.forEach(({ activity, day }) => {
        confirmationsText += `- Day ${day}: ${activity.name} (${activity.timeBlock})${activity.time ? ` at ${activity.time}` : ""} - ${activity.description}\n`;
      });
    }

    let inspirationsText = "";
    if (inspirationActivities.length > 0) {
      inspirationsText = "\n\nSAVED INSPIRATIONS (must be included in itinerary - use AI to determine best day and time block):\n";
      inspirationActivities.forEach((activity, index) => {
        inspirationsText += `${index + 1}. ${activity.name}${activity.location ? ` (${activity.location})` : ""} - ${activity.description || activity.name}\n`;
      });
    }

    const tripInfoText = JSON.stringify({
      trip_name: tripData.trip_name || tripData.name || "",
      destination: tripData.destination || "",
      description: tripData.description || "",
      travelers: tripData.travelers || "",
      budget: tripData.budget || "",
      interestAndVibes: tripData.interestAndVibes || tripData.vibe || [],
    }, null, 2);

    const prompt = `You are an expert travel planner. Create an itinerary structure for the following trip with ONLY the provided confirmations and inspirations (do NOT generate any additional activities):

Trip Details:
${tripInfoText}
${confirmationsText}${inspirationsText}
Dates and duration:
- start_date: ${startDateStr || "unset"}
- end_date: ${endDateStr || "unset"}
- total_days to produce: ${dayCount}

IMPORTANT RULES:
1. Include ALL confirmations listed above on their specified days and times
2. Include ALL inspirations listed above - use your expertise to determine the best day (1-${dayCount}) and time block (morning/afternoon/evening) for each inspiration based on the trip context, destination, and trip details
3. DO NOT generate any additional activities beyond the confirmations and inspirations provided
4. Keep activities arrays empty for days that don't have confirmations or inspirations

IMPORTANT: Organize activities by time blocks (morning, afternoon, evening):
- Morning: 6:00 AM - 12:00 PM
- Afternoon: 12:00 PM - 6:00 PM
- Evening: 6:00 PM - 12:00 AM

For each activity, provide:
- name: The name of the activity/place (exactly as provided)
- timeBlock: One of "morning", "afternoon", or "evening" (REQUIRED)
- time: Optional specific time if needed (e.g., "9:00 AM" for a specific reservation, otherwise omit)
- description: The description provided (or brief description if not provided)
- type: One of: "attraction", "restaurant", "activity", "transport", "accommodation", "other"
- location: The location/address if relevant

Return ONLY a valid JSON object in this exact format (no markdown, no explanations):
{
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "total_days": ${dayCount},
  "day1": {
    "date": "YYYY-MM-DD",
    "summary": "",
    "activities": []
  },
  "day2": {
    "date": "YYYY-MM-DD",
    "summary": "",
    "activities": []
  },
  "...": {}
}

Rules:
- Include day1 through day${dayCount} (no extra days).
- If a date is missing, infer sequential dates from start_date.
- Only include the confirmations and inspirations provided above - DO NOT generate additional activities.
- All activities MUST have a timeBlock field ("morning", "afternoon", or "evening").
- Only include the "time" field if there's a specific time requirement (e.g., reservation, flight).
- Keep activities arrays empty for days without confirmations/inspirations.`;

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

      const start = computedStart || startDate || new Date();
      for (let i = 1; i <= expectedDays; i++) {
        const dayKey = `day${i}`;
        if (!parsed[dayKey]) {
          const dayDate = new Date(start);
          dayDate.setDate(start.getDate() + (i - 1));
          parsed[dayKey] = {
            date: formatDate(dayDate),
            summary: "",
            activities: [],
          };
        } else {
          if (!Array.isArray(parsed[dayKey].activities)) {
            parsed[dayKey].activities = [];
          }
        }

        // Ensure all activities have timeBlock and sourceType
        parsed[dayKey].activities = parsed[dayKey].activities.map((activity) => {
          // If timeBlock is missing, try to infer from time field
          if (!activity.timeBlock && activity.time) {
            const timeStr = activity.time.toLowerCase();
            if (timeStr.includes("morning") || (timeStr.includes("am") && !timeStr.includes("pm"))) {
              activity.timeBlock = "morning";
            } else if (timeStr.includes("afternoon") || (timeStr.includes("pm") && !timeStr.includes("am"))) {
              activity.timeBlock = "afternoon";
            } else if (timeStr.includes("evening") || timeStr.includes("night")) {
              activity.timeBlock = "evening";
            } else {
              activity.timeBlock = "morning";
            }
          } else if (!activity.timeBlock) {
            activity.timeBlock = "morning";
          }

          // Ensure timeBlock is valid
          if (!["morning", "afternoon", "evening"].includes(activity.timeBlock)) {
            activity.timeBlock = "morning";
          }

          // Determine sourceType by matching with our confirmations/inspirations
          // First check if it matches a confirmation
          const matchesConfirmation = confirmationActivities.some(
            ({ activity: confActivity }) => confActivity.name === activity.name
          );
          
          if (matchesConfirmation) {
            activity.sourceType = "confirmation";
            activity.isFixed = true;
            // Find and add sourceId from confirmation
            const matchingConf = confirmationActivities.find(
              ({ activity: confActivity }) => confActivity.name === activity.name
            );
            if (matchingConf) {
              activity.sourceId = matchingConf.activity.sourceId;
            }
          } else {
            // Otherwise it's an inspiration
            activity.sourceType = "inspiration";
            // Find and add sourceId from inspiration
            const matchingInsp = inspirationActivities.find(
              (inspActivity) => inspActivity.name === activity.name
            );
            if (matchingInsp && matchingInsp.sourceId) {
              activity.sourceId = matchingInsp.sourceId;
            }
          }

          // Ensure isFixed is set for confirmations
          if (activity.sourceType === "confirmation" && activity.isFixed === undefined) {
            activity.isFixed = true;
          }

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
    console.error("Error generating itinerary with collaboration:", error);
    throw error;
  }
};

module.exports = { generateItinerary, generateItineraryWithCollaboration };
