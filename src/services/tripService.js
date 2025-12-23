const { getFirestore } = require("../config/database");
const admin = require("firebase-admin");
const crypto = require("crypto");

const COLLECTION_NAME = "trips";

/**
 * Generate a unique ID for an activity
 * @returns {string} - Unique ID string
 */
const generateActivityId = () => {
  return crypto.randomBytes(16).toString("hex");
};

/**
 * Ensure activities have IDs (add IDs to activities that don't have them)
 * @param {Array} activities - Array of activity objects
 * @returns {Array} - Array of activities with IDs
 */
const ensureActivitiesHaveIds = (activities) => {
  return activities.map((activity) => {
    if (!activity.id) {
      return { ...activity, id: generateActivityId() };
    }
    return activity;
  });
};

/**
 * Save a new trip with itinerary to Firestore
 * @param {string} userId - The user ID from Clerk
 * @param {object} selectedTrip - The selected trip suggestion data
 * @param {object} itinerary - The generated 3-day itinerary
 * @param {string|null} coverPhotoUrl - The GCS URL of the generated cover photo (optional)
 * @returns {Promise<object>} - The saved trip document
 */
const saveTrip = async (userId, selectedTrip, itinerary, coverPhotoUrl = null) => {
  try {
    const db = getFirestore();
    const tripsRef = db.collection(COLLECTION_NAME);

    // Ensure all activities in the itinerary have IDs
    const itineraryWithIds = { ...itinerary };
    if (itineraryWithIds) {
      Object.keys(itineraryWithIds).forEach((key) => {
        if (key.startsWith("day") && itineraryWithIds[key]?.activities) {
          itineraryWithIds[key].activities = ensureActivitiesHaveIds(
            itineraryWithIds[key].activities
          );
        }
      });
    }

    const tripData = {
      userId,
      selectedTrip,
      itinerary: itineraryWithIds,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Add cover photo URL if provided
    if (coverPhotoUrl) {
      tripData.coverPhotoUrl = coverPhotoUrl;
    }

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

    // Ensure all activities have IDs
    const activitiesWithIds = ensureActivitiesHaveIds(activities);

    // Update the activities for the specific day
    const updatedItinerary = {
      ...currentItinerary,
      [dayKey]: {
        ...currentDay,
        activities: activitiesWithIds,
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

    // Ensure new activities have IDs
    const newActivitiesWithIds = ensureActivitiesHaveIds(newActivities);

    // Combine existing activities with new ones
    const updatedActivities = [...currentActivities, ...newActivitiesWithIds];

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

/**
 * Add inspiration items to a specific day of a trip
 * @param {string} tripId - The trip document ID
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @param {number} dayNumber - The day number (1, 2, 3, etc.)
 * @param {Array} formattedActivities - The formatted activities from inspiration items
 * @returns {Promise<object>} - The updated trip document
 */
const addInspirationItemsToTrip = async (tripId, userId, dayNumber, formattedActivities) => {
  try {
    if (!formattedActivities || !Array.isArray(formattedActivities) || formattedActivities.length === 0) {
      throw new Error("Formatted activities array is required and must not be empty");
    }

    // Use the existing addDayActivities function
    return await addDayActivities(tripId, userId, dayNumber, formattedActivities);
  } catch (error) {
    console.error("Error adding inspiration items to trip:", error);
    throw error;
  }
};

/**
 * Update a specific activity in a trip day
 * @param {string} tripId - The trip document ID
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @param {number} dayNumber - The day number (1, 2, 3, etc.)
 * @param {string} activityId - The ID of the activity to update
 * @param {object} updatedActivityData - The updated activity data
 * @returns {Promise<object>} - The updated trip document
 */
const updateActivity = async (tripId, userId, dayNumber, activityId, updatedActivityData) => {
  try {
    if (!activityId) {
      throw new Error("Activity ID is required");
    }

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

    // Find the activity index
    const activityIndex = currentActivities.findIndex((activity) => activity.id === activityId);

    if (activityIndex === -1) {
      throw new Error("Activity not found");
    }

    // Update the activity, preserving the ID
    const updatedActivities = [...currentActivities];
    updatedActivities[activityIndex] = {
      ...updatedActivities[activityIndex],
      ...updatedActivityData,
      id: activityId, // Ensure ID is preserved
    };

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
    console.error("Error updating activity:", error);
    throw error;
  }
};

/**
 * Delete a specific activity from a trip day
 * @param {string} tripId - The trip document ID
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @param {number} dayNumber - The day number (1, 2, 3, etc.)
 * @param {string} activityId - The ID of the activity to delete
 * @returns {Promise<object>} - The updated trip document
 */
const deleteActivity = async (tripId, userId, dayNumber, activityId) => {
  try {
    if (!activityId) {
      throw new Error("Activity ID is required");
    }

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

    // Filter out the activity to delete
    const updatedActivities = currentActivities.filter((activity) => activity.id !== activityId);

    // Check if activity was found
    if (updatedActivities.length === currentActivities.length) {
      throw new Error("Activity not found");
    }

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
    console.error("Error deleting activity:", error);
    throw error;
  }
};

module.exports = {
  saveTrip,
  getUserTrips,
  getTripById,
  updateDayActivities,
  addDayActivities,
  addInspirationItemsToTrip,
  updateActivity,
  deleteActivity,
};

