const { getFirestore } = require("../config/database");
const admin = require("firebase-admin");

const COLLECTION_NAME = "trips";

/**
 * Save a new trip with itinerary to Firestore
 * @param {string} userId - The user ID from Clerk
 * @param {object} selectedTrip - The selected trip suggestion data
 * @param {object} itinerary - The generated 3-day itinerary
 * @returns {Promise<object>} - The saved trip document
 */
const saveTrip = async (userId, selectedTrip, itinerary) => {
  try {
    const db = getFirestore();
    const tripsRef = db.collection(COLLECTION_NAME);

    const tripData = {
      userId,
      selectedTrip,
      itinerary,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await tripsRef.add(tripData);

    // Return the saved data
    const savedDoc = await docRef.get();
    return {
      id: savedDoc.id,
      ...savedDoc.data(),
    };
  } catch (error) {
    console.error("Error saving trip:", error);
    throw error;
  }
};

/**
 * Get all trips for a user
 * @param {string} userId - The user ID from Clerk
 * @returns {Promise<Array>} - Array of trip documents
 */
const getUserTrips = async (userId) => {
  try {
    const db = getFirestore();
    const tripsRef = db.collection(COLLECTION_NAME);
    const snapshot = await tripsRef.where("userId", "==", userId).get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting user trips:", error);
    throw error;
  }
};

/**
 * Get a specific trip by ID
 * @param {string} tripId - The trip document ID
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @returns {Promise<object|null>} - The trip document or null if not found
 */
const getTripById = async (tripId, userId) => {
  try {
    const db = getFirestore();
    const docRef = db.collection(COLLECTION_NAME).doc(tripId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const tripData = doc.data();

    // Verify the trip belongs to the user
    if (tripData.userId !== userId) {
      throw new Error("Unauthorized: Trip does not belong to this user");
    }

    return {
      id: doc.id,
      ...tripData,
    };
  } catch (error) {
    console.error("Error getting trip by ID:", error);
    throw error;
  }
};

/**
 * Update activities for a specific day of a trip
 * @param {string} tripId - The trip document ID
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @param {number} dayNumber - The day number (1, 2, or 3)
 * @param {Array} activities - The new activities array
 * @returns {Promise<object>} - The updated trip document
 */
const updateDayActivities = async (tripId, userId, dayNumber, activities) => {
  try {
    const db = getFirestore();
    const docRef = db.collection(COLLECTION_NAME).doc(tripId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error("Trip not found");
    }

    const tripData = doc.data();

    // Verify the trip belongs to the user
    if (tripData.userId !== userId) {
      throw new Error("Unauthorized: Trip does not belong to this user");
    }

    const dayKey = `day${dayNumber}`;

    // Get current itinerary or initialize it
    const currentItinerary = tripData.itinerary || {};
    const currentDay = currentItinerary[dayKey] || {};

    // Update the activities for the specific day
    const updatedItinerary = {
      ...currentItinerary,
      [dayKey]: {
        ...currentDay,
        activities: activities,
      },
    };

    const updateData = {
      itinerary: updatedItinerary,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.update(updateData);

    // Return the updated data
    const updatedDoc = await docRef.get();
    return {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    };
  } catch (error) {
    console.error("Error updating day activities:", error);
    throw error;
  }
};

/**
 * Add activities to a specific day of a trip
 * @param {string} tripId - The trip document ID
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @param {number} dayNumber - The day number (1, 2, or 3)
 * @param {Array} newActivities - The new activities to add
 * @returns {Promise<object>} - The updated trip document
 */
const addDayActivities = async (tripId, userId, dayNumber, newActivities) => {
  try {
    const db = getFirestore();
    const docRef = db.collection(COLLECTION_NAME).doc(tripId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error("Trip not found");
    }

    const tripData = doc.data();

    // Verify the trip belongs to the user
    if (tripData.userId !== userId) {
      throw new Error("Unauthorized: Trip does not belong to this user");
    }

    const dayKey = `day${dayNumber}`;
    const currentItinerary = tripData.itinerary || {};
    const currentDay = currentItinerary[dayKey] || {};
    const currentActivities = currentDay.activities || [];

    // Combine existing activities with new ones
    const updatedActivities = [...currentActivities, ...newActivities];

    // Update the itinerary structure
    const updatedItinerary = {
      ...currentItinerary,
      [dayKey]: {
        ...currentDay,
        activities: updatedActivities,
      },
    };

    const updateData = {
      itinerary: updatedItinerary,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.update(updateData);

    // Return the updated data
    const updatedDoc = await docRef.get();
    return {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    };
  } catch (error) {
    console.error("Error adding day activities:", error);
    throw error;
  }
};

module.exports = {
  saveTrip,
  getUserTrips,
  getTripById,
  updateDayActivities,
  addDayActivities,
};

