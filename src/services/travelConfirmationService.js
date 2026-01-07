const { getFirestore } = require("../config/database");
const admin = require("firebase-admin");

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
 * Extract date from confirmation data
 * @param {object} confirmation - The confirmation object
 * @returns {Date|null} - Extracted date or null
 */
const extractDateFromConfirmation = (confirmation) => {
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
    ];
    
    for (const field of dateFields) {
      if (data[field]) {
        const date = new Date(data[field]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    // Try parsing date string
    if (data.date) {
      const date = new Date(data.date);
      if (!isNaN(date.getTime())) {
        return date;
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
 * @returns {number|null} - Day number (1, 2, 3, etc.) or null if cannot determine
 */
const determineDayFromConfirmation = (confirmation, trip) => {
  try {
    const confirmationDate = extractDateFromConfirmation(confirmation);
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
    if (category.includes("flight") || category.includes("transport")) {
      activityType = "transport";
    } else if (category.includes("hotel") || category.includes("accommodation")) {
      activityType = "accommodation";
    } else if (category.includes("restaurant") || category.includes("dining")) {
      activityType = "restaurant";
    } else if (category.includes("activity") || category.includes("tour")) {
      activityType = "activity";
    }
    
    // Build activity name
    let activityName = data.title || data.name || "Travel Confirmation";
    if (data.flightNumber) {
      activityName = `Flight ${data.flightNumber}`;
    } else if (data.hotelName) {
      activityName = data.hotelName;
    } else if (data.restaurantName) {
      activityName = data.restaurantName;
    }
    
    // Build description
    let description = "";
    if (data.description) {
      description = data.description;
    } else if (data.flightNumber) {
      description = `Flight ${data.flightNumber}${data.departureLocation && data.arrivalLocation ? ` from ${data.departureLocation} to ${data.arrivalLocation}` : ""}`;
    } else if (data.hotelName) {
      description = `Check-in at ${data.hotelName}${data.location ? `, ${data.location}` : ""}`;
    } else {
      description = activityName;
    }
    
    // Determine time block
    const timeBlock = determineTimeBlock(time, activityType);
    
    // Build location
    const location = data.location || data.address || data.departureLocation || data.arrivalLocation || "";
    
    return {
      name: activityName,
      timeBlock,
      time: time || undefined,
      description,
      type: activityType,
      location,
      sourceType: "confirmation",
      sourceId: confirmation.id,
      isFixed: true, // Confirmations are fixed
    };
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
};

