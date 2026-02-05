const { getFirestore } = require("../config/database");
const admin = require("firebase-admin");
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DUPLICATE_CHECK_MODEL = "gpt-4o-mini";

const COLLECTION_NAME = "travelConfirmations";

/**
 * Save a travel confirmation to Firestore
 * @param {string} userId - The user ID from Clerk
 * @param {object} confirmationData - The extracted booking/confirmation data
 * @param {string|null} tripId - Optional trip ID to link the confirmation to
 * @returns {Promise<object>} - The saved confirmation document
 */
const saveConfirmation = async (userId, confirmationData, tripId = null) => {
  try {
    const db = getFirestore();
    const confirmationsRef = db.collection(COLLECTION_NAME);

    const confirmationDoc = {
      userId,
      tripId: tripId || null,
      confirmationData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await confirmationsRef.add(confirmationDoc);

    // Return the saved data
    const savedDoc = await docRef.get();
    return {
      id: savedDoc.id,
      ...savedDoc.data(),
    };
  } catch (error) {
    console.error("Error saving travel confirmation:", error);
    throw error;
  }
};

/**
 * Use AI to compare a new confirmation against existing ones and detect duplicates.
 * @param {object} newConfirmationData - The extracted booking/confirmation data for the new item
 * @param {Array<object>} existingConfirmations - Array of existing confirmation documents for the user
 * @returns {Promise<{isDuplicate: boolean, duplicateIds: string[]}>}
 */
const checkDuplicateWithAI = async (newConfirmationData, existingConfirmations) => {
  // Short-circuit if there is nothing to compare against
  if (!Array.isArray(existingConfirmations) || existingConfirmations.length === 0) {
    return { isDuplicate: false, duplicateIds: [] };
  }

  // Limit the number of existing confirmations we send to the model for cost/perf
  const maxComparisons = 50;
  const confirmationsSample = existingConfirmations.slice(0, maxComparisons).map((conf) => ({
    id: conf.id,
    confirmationData: conf.confirmationData || null,
  }));

  const prompt = `
You are a strict duplicate-detection assistant for travel confirmations.

You receive:
- ONE "new" confirmation (structured JSON)
- An ARRAY of "existing" confirmations, each with an "id" and "confirmationData".

Two confirmations should be considered duplicates if they clearly refer to the SAME booking or reservation, even if:
- Some fields are missing on one side
- Formatting of dates, amounts, or names is slightly different

You MUST use booking identifiers and key fields such as:
- bookingId or reservation/confirmation numbers
- category (hotel, flight, car, restaurant, event, ticket, unknown)
- hotelName / restaurantName / eventName / airline / flightNumber / carModel / rentalCompany
- important dates (check-in/out, departure/arrival, eventDate, reservationDate, etc.)
- customerName / email when available

Be conservative: ONLY mark as duplicate when it is very likely the same real-world booking.

Return ONLY a JSON object with this exact shape:
{
  "isDuplicate": boolean,
  "duplicateIds": string[]
}

Where:
- "isDuplicate" is true if the new confirmation clearly matches ANY of the existing ones.
- "duplicateIds" is an array of the ids from the existing confirmations that are considered duplicates (empty array if none).

New confirmation:
${JSON.stringify(newConfirmationData, null, 2)}

Existing confirmations:
${JSON.stringify(confirmationsSample, null, 2)}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: DUPLICATE_CHECK_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an assistant that determines if a new travel confirmation is a duplicate of existing confirmations and returns strict JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
    });

    const rawContent = completion.choices[0].message.content.trim();
    const cleaned = rawContent
      .replace(/```json\s*/gi, "")
      .replace(/```/g, "")
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      if (
        typeof parsed.isDuplicate === "boolean" &&
        Array.isArray(parsed.duplicateIds)
      ) {
        return {
          isDuplicate: parsed.isDuplicate,
          duplicateIds: parsed.duplicateIds.map((id) => String(id)),
        };
      }
    } catch (parseError) {
      console.error("Failed to parse AI duplicate check response:", parseError, cleaned);
    }

    // Fallback: if parsing fails, treat as non-duplicate to avoid blocking user
    return { isDuplicate: false, duplicateIds: [] };
  } catch (error) {
    console.error("Error running AI duplicate check:", error);
    // On AI failure, we do NOT block saving; treat as non-duplicate
    return { isDuplicate: false, duplicateIds: [] };
  }
};

/**
 * Convenience helper: check if a confirmation is a duplicate for a specific user.
 * @param {string} userId
 * @param {object} confirmationData
 * @returns {Promise<{isDuplicate: boolean, duplicateIds: string[]}>}
 */
const findDuplicateConfirmationForUser = async (userId, confirmationData) => {
  try {
    const existing = await getUserConfirmations(userId);
    return checkDuplicateWithAI(confirmationData, existing);
  } catch (error) {
    console.error("Error checking duplicate confirmation for user:", error);
    // Fail-open: do not block saving on errors
    return { isDuplicate: false, duplicateIds: [] };
  }
};

/**
 * Save multiple travel confirmations to Firestore
 * @param {string} userId - The user ID from Clerk
 * @param {Array<object>} confirmationsData - Array of extracted booking/confirmation data
 * @param {string|null} tripId - Optional trip ID to link all confirmations to
 * @returns {Promise<Array<object>>} - Array of saved confirmation documents
 */
const saveConfirmations = async (userId, confirmationsData, tripId = null) => {
  try {
    const db = getFirestore();
    const batch = db.batch();
    const confirmationsRef = db.collection(COLLECTION_NAME);

    const savedConfirmations = [];

    confirmationsData.forEach((confirmationData) => {
      const docRef = confirmationsRef.doc();
      const confirmationDoc = {
        userId,
        tripId: tripId || null,
        confirmationData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      batch.set(docRef, confirmationDoc);
      savedConfirmations.push({
        id: docRef.id,
        ...confirmationDoc,
      });
    });

    await batch.commit();

    // Convert timestamps to actual values for response
    return savedConfirmations;
  } catch (error) {
    console.error("Error saving travel confirmations:", error);
    throw error;
  }
};

/**
 * Get all confirmations for a user
 * @param {string} userId - The user ID from Clerk
 * @returns {Promise<Array<object>>} - Array of confirmation documents
 */
const getUserConfirmations = async (userId) => {
  try {
    const db = getFirestore();
    const confirmationsRef = db.collection(COLLECTION_NAME);
    const snapshot = await confirmationsRef.where("userId", "==", userId).get();

    if (snapshot.empty) {
      return [];
    }

    const confirmations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return confirmations;
  } catch (error) {
    console.error("Error getting user confirmations:", error);
    throw error;
  }
};

/**
 * Get all confirmations for a specific trip
 * @param {string} tripId - The trip document ID
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @returns {Promise<Array<object>>} - Array of confirmation documents
 */
const getTripConfirmations = async (tripId, userId) => {
  try {
    const db = getFirestore();
    const confirmationsRef = db.collection(COLLECTION_NAME);
    const snapshot = await confirmationsRef
      .where("tripId", "==", tripId)
      .where("userId", "==", userId)
      .get();

    if (snapshot.empty) {
      return [];
    }

    const confirmations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return confirmations;
  } catch (error) {
    console.error("Error getting trip confirmations:", error);
    throw error;
  }
};

/**
 * Link a confirmation to a trip
 * @param {string} confirmationId - The confirmation document ID
 * @param {string} tripId - The trip document ID to link to
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @returns {Promise<object>} - The updated confirmation document
 */
const linkConfirmationToTrip = async (confirmationId, tripId, userId) => {
  try {
    const db = getFirestore();
    const confirmationRef = db.collection(COLLECTION_NAME).doc(confirmationId);
    const confirmationDoc = await confirmationRef.get();

    if (!confirmationDoc.exists) {
      throw new Error("Confirmation not found");
    }

    const confirmationData = confirmationDoc.data();

    // Verify the confirmation belongs to the user
    if (confirmationData.userId !== userId) {
      throw new Error("Unauthorized: Confirmation does not belong to this user");
    }

    const updateData = {
      tripId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await confirmationRef.update(updateData);

    // Return the updated data
    const updatedDoc = await confirmationRef.get();
    return {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    };
  } catch (error) {
    console.error("Error linking confirmation to trip:", error);
    throw error;
  }
};

/**
 * Link multiple confirmations to a trip
 * @param {Array<string>} confirmationIds - Array of confirmation document IDs
 * @param {string} tripId - The trip document ID to link to
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @returns {Promise<Array<object>>} - Array of updated confirmation documents
 */
const linkConfirmationsToTrip = async (confirmationIds, tripId, userId) => {
  try {
    const db = getFirestore();
    const batch = db.batch();
    const updatedConfirmations = [];

    for (const confirmationId of confirmationIds) {
      const confirmationRef = db.collection(COLLECTION_NAME).doc(confirmationId);
      const confirmationDoc = await confirmationRef.get();

      if (!confirmationDoc.exists) {
        console.warn(`Confirmation ${confirmationId} not found, skipping`);
        continue;
      }

      const confirmationData = confirmationDoc.data();

      // Verify the confirmation belongs to the user
      if (confirmationData.userId !== userId) {
        console.warn(`Confirmation ${confirmationId} does not belong to user ${userId}, skipping`);
        continue;
      }

      batch.update(confirmationRef, {
        tripId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      updatedConfirmations.push({
        id: confirmationId,
        ...confirmationData,
        tripId,
      });
    }

    await batch.commit();
    return updatedConfirmations;
  } catch (error) {
    console.error("Error linking confirmations to trip:", error);
    throw error;
  }
};

/**
 * Get confirmations that are not linked to any trip
 * @param {string} userId - The user ID from Clerk
 * @returns {Promise<Array<object>>} - Array of unlinked confirmation documents
 */
const getUnlinkedConfirmations = async (userId) => {
  try {
    const db = getFirestore();
    const confirmationsRef = db.collection(COLLECTION_NAME);
    const snapshot = await confirmationsRef.where("userId", "==", userId).get();

    if (snapshot.empty) {
      return [];
    }

    // Filter confirmations where tripId is null or doesn't exist
    const confirmations = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((confirmation) => !confirmation.tripId);

    return confirmations;
  } catch (error) {
    console.error("Error getting unlinked confirmations:", error);
    throw error;
  }
};

/**
 * Link confirmations to a trip with specific days
 * @param {Array<string>} confirmationIds - Array of confirmation document IDs
 * @param {string} tripId - The trip document ID to link to
 * @param {Array<number>} days - Array of day numbers to link confirmations to
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @returns {Promise<Array<object>>} - Array of updated confirmation documents
 */
const linkConfirmationsToTripWithDays = async (confirmationIds, tripId, days, userId) => {
  try {
    if (!Array.isArray(confirmationIds) || confirmationIds.length === 0) {
      throw new Error("Confirmation IDs array is required and must not be empty");
    }

    if (!Array.isArray(days) || days.length === 0) {
      throw new Error("Days array is required and must not be empty");
    }

    // Validate day numbers are positive integers
    const validDays = days.filter((day) => Number.isInteger(day) && day > 0);
    if (validDays.length === 0) {
      throw new Error("Days must be an array of positive integers");
    }

    const db = getFirestore();
    const batch = db.batch();
    const updatedConfirmations = [];

    for (const confirmationId of confirmationIds) {
      const confirmationRef = db.collection(COLLECTION_NAME).doc(confirmationId);
      const confirmationDoc = await confirmationRef.get();

      if (!confirmationDoc.exists) {
        console.warn(`Confirmation ${confirmationId} not found, skipping`);
        continue;
      }

      const confirmationData = confirmationDoc.data();

      // Verify the confirmation belongs to the user
      if (confirmationData.userId !== userId) {
        console.warn(`Confirmation ${confirmationId} does not belong to user ${userId}, skipping`);
        continue;
      }

      // Update confirmation with tripId and days
      batch.update(confirmationRef, {
        tripId,
        days: validDays,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      updatedConfirmations.push({
        id: confirmationId,
        ...confirmationData,
        tripId,
        days: validDays,
      });
    }

    await batch.commit();
    return updatedConfirmations;
  } catch (error) {
    console.error("Error linking confirmations to trip with days:", error);
    throw error;
  }
};

/**
 * Filter confirmations by assignment status and category
 * @param {string} userId - The user ID from Clerk
 * @param {object} options
 * @param {"all"|"assigned"|"unassigned"} [options.assignment="all"] - Filter by assignment to trips
 * @param {string} [options.category="all"] - Filter by category (all, flight, hotel, car, restaurant, activity, other)
 * @returns {Promise<Array<object>>} - Array of filtered confirmation documents
 */
const filterConfirmations = async (userId, { assignment = "all", category = "all" } = {}) => {
  try {
    const confirmations = await getUserConfirmations(userId);

    const normalizedAssignment = (assignment || "all").toLowerCase();
    const normalizedCategory = (category || "all").toLowerCase();

    // Helper to check assignment
    const matchesAssignment = (confirmation) => {
      const hasTrip = !!confirmation.tripId;
      if (normalizedAssignment === "assigned") return hasTrip;
      if (normalizedAssignment === "unassigned") return !hasTrip;
      return true; // "all" or unknown -> no filter
    };

    // Helper to map category aliases
    const mapCategory = (value) => {
      const v = (value || "").toLowerCase();
      if (v === "flight" || v === "flights") return "flight";
      if (v === "hotel" || v === "hotels") return "hotel";
      if (v === "car" || v === "car rental" || v === "car_rental") return "car";
      if (v === "restaurant" || v === "restaurants") return "restaurant";
      if (v === "activity" || v === "activities") return "activity";
      if (v === "other") return "other";
      return v;
    };

    const targetCategory = mapCategory(normalizedCategory);

    const filtered = confirmations.filter((conf) => {
      if (!matchesAssignment(conf)) return false;

      if (targetCategory === "all" || targetCategory === "") return true;

      const confirmationCategory = mapCategory(conf.confirmationData?.category);
      return confirmationCategory === targetCategory;
    });

    return filtered;
  } catch (error) {
    console.error("Error filtering confirmations:", error);
    throw error;
  }
};

/**
 * Extract time from confirmation data
 * @param {object} confirmation - The confirmation object
 * @returns {string|null} - Extracted time string or null
 */
const extractTimeFromConfirmation = (confirmation) => {
  try {
    const data = confirmation.confirmationData || confirmation;
    
    // Check various time fields
    if (data.time) return data.time;
    if (data.departureTime) return data.departureTime;
    if (data.arrivalTime) return data.arrivalTime;
    if (data.checkInTime) return data.checkInTime;
    if (data.checkOutTime) return data.checkOutTime;
    if (data.reservationTime) return data.reservationTime;
    if (data.bookingTime) return data.bookingTime;
    if (data.eventTime) return data.eventTime;
    
    // Check dateTime fields
    if (data.dateTime) {
      const dt = new Date(data.dateTime);
      if (!isNaN(dt.getTime())) {
        return dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      }
    }
    
    // Check date and time separately
    if (data.date && data.time) {
      return data.time;
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting time from confirmation:", error);
    return null;
  }
};

/**
 * Use AI to parse a date string into ISO format
 * @param {string} dateString - The date string to parse
 * @returns {Promise<string|null>} - ISO date string or null
 */
const parseDateWithAI = async (dateString) => {
  try {
    const prompt = `
You are a date parsing assistant. Your task is to extract and normalize dates from various formats.

Given a date string, return ONLY a valid ISO 8601 date string (YYYY-MM-DD format) in UTC timezone.
If the date cannot be parsed, return null.

Examples:
- "Saturday, February 21, 2026" -> "2026-02-21"
- "Feb 21, 2026" -> "2026-02-21"
- "21/02/2026" -> "2026-02-21"
- "2026-02-21" -> "2026-02-21"
- "February 21st, 2026" -> "2026-02-21"

Date to parse: "${dateString}"

Return ONLY the ISO date string (YYYY-MM-DD) or "null" if unparseable. No explanations, no markdown, just the date string or "null".
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You parse dates and return ISO 8601 format (YYYY-MM-DD) or null.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
    });

    const content = completion.choices[0].message.content.trim().toLowerCase();
    
    // Handle "null" response
    if (content === "null" || content === "null.") {
      return null;
    }

    // Try to extract ISO date from response
    const isoDateMatch = content.match(/\d{4}-\d{2}-\d{2}/);
    if (isoDateMatch) {
      return isoDateMatch[0];
    }

    // Try parsing the response as a date
    const parsedDate = new Date(content);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split("T")[0];
    }

    return null;
  } catch (error) {
    console.error("Error parsing date with AI:", error);
    return null;
  }
};

/**
 * Extract date from confirmation data using AI when needed
 * @param {object} confirmation - The confirmation object
 * @returns {Promise<Date|null>} - Extracted date or null
 */
const extractDateFromConfirmation = async (confirmation) => {
  try {
    const data = confirmation.confirmationData || confirmation;
    
    // Check various date fields
    const dateFields = [
      "date",
      "departureDate",
      "arrivalDate",
      "checkInDate",
      "checkOutDate",
      "reservationDate",
      "bookingDate",
      "dateTime",
      "eventDate",
    ];
    
    // Use AI parsing for each date field
    for (const field of dateFields) {
      if (data[field] && typeof data[field] === "string") {
        const isoDate = await parseDateWithAI(data[field]);
        if (isoDate) {
          const date = new Date(isoDate);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting date from confirmation:", error);
    return null;
  }
};

/**
 * Determine which day a confirmation belongs to based on its date
 * @param {object} confirmation - The confirmation object
 * @param {object} trip - The trip object
 * @returns {Promise<number|null>} - Day number (1, 2, 3, etc.) or null if cannot determine
 */
const determineDayFromConfirmation = async (confirmation, trip) => {
  try {
    const confirmationDate = await extractDateFromConfirmation(confirmation);
    if (!confirmationDate) {
      return null;
    }
    
    // Get trip start date
    const selectedTrip = trip.selectedTrip || {};
    const startDateInput = selectedTrip.start_date || selectedTrip.startDate;
    
    if (!startDateInput) {
      return null;
    }
    
    const startDate = new Date(startDateInput);
    if (isNaN(startDate.getTime())) {
      return null;
    }
    
    // Calculate day difference
    const diffTime = confirmationDate - startDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    // Ensure day is positive and within reasonable range
    if (diffDays < 1 || diffDays > 30) {
      return null;
    }
    
    return diffDays;
  } catch (error) {
    console.error("Error determining day from confirmation:", error);
    return null;
  }
};

/**
 * Format a confirmation as an activity
 * @param {object} confirmation - The confirmation object
 * @returns {object} - Activity object
 */
const formatConfirmationToActivity = (confirmation) => {
  try {
    const data = confirmation.confirmationData || confirmation;
    const { determineTimeBlock } = require("./autoArrangementService");
    
    // Extract time
    const time = extractTimeFromConfirmation(confirmation);
    
    // Determine activity type from category
    const category = (data.category || "").toLowerCase();
    let activityType = "other";
    if (category === "flight" || category.includes("transport")) {
      activityType = "transport";
    } else if (category === "hotel" || category.includes("accommodation")) {
      activityType = "accommodation";
    } else if (category === "restaurant" || category.includes("dining")) {
      activityType = "restaurant";
    } else if (category === "event" || category === "ticket" || category.includes("activity") || category.includes("tour")) {
      activityType = "activity";
    } else if (category === "car" || category.includes("rental")) {
      activityType = "transport";
    }
    
    // Build activity name based on category and available data
    let activityName = "Travel Confirmation";
    
    if (category === "flight") {
      if (data.flightNumber) {
        activityName = `Flight ${data.flightNumber}`;
      } else if (data.airline) {
        activityName = `${data.airline} Flight`;
      } else {
        activityName = "Flight";
      }
    } else if (category === "hotel") {
      activityName = data.hotelName || "Hotel Check-in";
    } else if (category === "restaurant") {
      activityName = data.restaurantName || "Restaurant Reservation";
    } else if (category === "event" || category === "ticket") {
      if (data.eventName) {
        activityName = data.eventName;
        if (category === "ticket" && data.performer) {
          activityName = `${data.performer} - ${data.eventName}`;
        }
      } else if (data.performer) {
        activityName = data.performer;
      } else {
        activityName = "Event";
      }
    } else if (category === "car") {
      if (data.carModel && data.rentalCompany) {
        activityName = `${data.carModel} from ${data.rentalCompany}`;
      } else if (data.rentalCompany) {
        activityName = `Car Rental - ${data.rentalCompany}`;
      } else if (data.carModel) {
        activityName = `Car Rental - ${data.carModel}`;
      } else {
        activityName = "Car Rental";
      }
    } else {
      // Fallback to any available name field
      activityName = data.title || data.name || data.eventName || data.hotelName || data.restaurantName || "Travel Confirmation";
    }
    
    // Build description
    let description = "";
    if (data.description) {
      description = data.description;
    } else if (category === "flight") {
      const parts = [];
      if (data.flightNumber) parts.push(`Flight ${data.flightNumber}`);
      if (data.airline) parts.push(data.airline);
      if (data.departureAirport && data.arrivalAirport) {
        parts.push(`${data.departureAirport} → ${data.arrivalAirport}`);
      } else if (data.departureAirport) {
        parts.push(`Departing from ${data.departureAirport}`);
      } else if (data.arrivalAirport) {
        parts.push(`Arriving at ${data.arrivalAirport}`);
      }
      description = parts.length > 0 ? parts.join(" - ") : activityName;
    } else if (category === "hotel") {
      const parts = [];
      if (data.hotelName) parts.push(data.hotelName);
      if (data.location) parts.push(data.location);
      description = parts.length > 0 ? parts.join(", ") : activityName;
    } else if (category === "restaurant") {
      const parts = [];
      if (data.restaurantName) parts.push(data.restaurantName);
      if (data.location) parts.push(data.location);
      if (data.numberOfGuests) parts.push(`${data.numberOfGuests} guest(s)`);
      description = parts.length > 0 ? parts.join(" - ") : activityName;
    } else if (category === "event" || category === "ticket") {
      const parts = [];
      if (data.eventName) parts.push(data.eventName);
      if (data.performer) parts.push(`by ${data.performer}`);
      if (data.venue) parts.push(`at ${data.venue}`);
      if (data.section) parts.push(`Section: ${data.section}`);
      if (data.seat) parts.push(`Seat: ${data.seat}`);
      if (data.numberOfTickets) parts.push(`${data.numberOfTickets} ticket(s)`);
      description = parts.length > 0 ? parts.join(" - ") : activityName;
    } else if (category === "car") {
      const parts = [];
      if (data.rentalCompany) parts.push(data.rentalCompany);
      if (data.carModel) parts.push(data.carModel);
      if (data.pickupLocation) parts.push(`Pickup: ${data.pickupLocation}`);
      description = parts.length > 0 ? parts.join(" - ") : activityName;
    } else {
      description = activityName;
    }
    
    // Determine time block
    const timeBlock = determineTimeBlock(time, activityType);
    
    // Build location - prioritize category-specific location fields
    let location = "";
    if (category === "flight") {
      location = data.arrivalAirport || data.departureAirport || data.location || "";
    } else if (category === "event" || category === "ticket") {
      location = data.venue || data.location || "";
    } else if (category === "car") {
      location = data.pickupLocation || data.location || "";
    } else {
      location = data.location || data.address || data.venue || "";
    }
    
    const activity = {
      name: activityName,
      timeBlock,
      description,
      type: activityType,
      location,
      sourceType: "confirmation",
      sourceId: confirmation.id,
      isFixed: true, // Confirmations are fixed
    };
    
    // Only include time if it exists (Firestore doesn't allow undefined)
    if (time) {
      activity.time = time;
    }
    
    return activity;
  } catch (error) {
    console.error("Error formatting confirmation to activity:", error);
    // Return a basic activity as fallback
    return {
      name: "Travel Confirmation",
      timeBlock: "afternoon",
      description: "Travel confirmation",
      type: "other",
      location: "",
      sourceType: "confirmation",
      sourceId: confirmation.id,
      isFixed: true,
    };
  }
};

module.exports = {
  saveConfirmation,
  saveConfirmations,
  getUserConfirmations,
  getTripConfirmations,
  linkConfirmationToTrip,
  linkConfirmationsToTrip,
  getUnlinkedConfirmations,
  linkConfirmationsToTripWithDays,
  filterConfirmations,
  extractTimeFromConfirmation,
  extractDateFromConfirmation,
  determineDayFromConfirmation,
  formatConfirmationToActivity,
  checkDuplicateWithAI,
  findDuplicateConfirmationForUser,
};

