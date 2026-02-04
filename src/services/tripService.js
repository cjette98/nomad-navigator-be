const { getFirestore } = require("../config/database");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { getSignedUrl } = require("./gcsService");

const COLLECTION_NAME = "trips";

/**
 * Generate a unique ID for an activity
 * @returns {string} - Unique ID string
 */
const generateActivityId = () => {
  return crypto.randomBytes(16).toString("hex");
};

/**
 * Remove undefined values from an object (Firestore doesn't allow undefined)
 * @param {object} obj - Object to clean
 * @returns {object} - Cleaned object without undefined values
 */
const removeUndefinedValues = (obj) => {
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
        cleaned[key] = removeUndefinedValues(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
};

/**
 * Normalize an activity to ensure it has all required fields
 * @param {object} activity - Activity object
 * @returns {object} - Normalized activity
 */
const normalizeActivity = (activity) => {
  const { determineTimeBlock } = require("./autoArrangementService");
  
  // Ensure ID
  if (!activity.id) {
    activity.id = generateActivityId();
  }
  
  // Ensure timeBlock - infer from time if missing
  if (!activity.timeBlock) {
    activity.timeBlock = determineTimeBlock(activity.time, activity.type);
  }
  
  // Ensure sourceType defaults to "ai" if not set
  if (!activity.sourceType) {
    activity.sourceType = "ai";
  }
  
  // Ensure isFixed defaults to false if not set (unless it's a confirmation)
  if (activity.isFixed === undefined) {
    activity.isFixed = activity.sourceType === "confirmation";
  }
  
  // Remove undefined values before returning (Firestore doesn't allow undefined)
  return removeUndefinedValues(activity);
};

/**
 * Ensure activities have IDs and required fields (add IDs to activities that don't have them)
 * @param {Array} activities - Array of activity objects
 * @returns {Array} - Array of activities with IDs and required fields
 */
const ensureActivitiesHaveIds = (activities) => {
  return activities.map((activity) => normalizeActivity({ ...activity }));
};

/**
 * Convert coverPhotoUrl from gs:// to signed HTTP URL if present
 * @param {object} trip - The trip object
 * @returns {Promise<object>} - The trip object with converted URL
 */
const convertCoverPhotoUrl = async (trip) => {
  if (trip && trip.coverPhotoUrl) {
    try {
      trip.coverPhotoUrl = await getSignedUrl(trip.coverPhotoUrl);
    } catch (error) {
      console.error("Error converting cover photo URL:", error);
    }
  }
  return trip;
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

    // Clean undefined values from itinerary before saving (Firestore doesn't allow undefined)
    const cleanedItinerary = removeUndefinedValues(itineraryWithIds);

    const tripData = {
      userId,
      selectedTrip,
      itinerary: cleanedItinerary,
      status: "draft",
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
    const savedTrip = {
      id: savedDoc.id,
      ...savedDoc.data(),
    };

    // Convert coverPhotoUrl from gs:// to signed HTTP URL if present
    return await convertCoverPhotoUrl(savedTrip);
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

    const trips = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const tripData = {
          id: doc.id,
          ...doc.data(),
        };

        // Convert coverPhotoUrl from gs:// to signed HTTP URL if present
        return await convertCoverPhotoUrl(tripData);
      })
    );

    return trips.filter((trip) => trip.status !== "archive");
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

    const trip = {
      id: doc.id,
      ...tripData,
    };

    // Convert coverPhotoUrl from gs:// to signed HTTP URL if present
    return await convertCoverPhotoUrl(trip);
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

    // Ensure all activities have IDs and clean undefined values
    const activitiesWithIds = ensureActivitiesHaveIds(activities);

    // Update the activities for the specific day
    const updatedItinerary = {
      ...currentItinerary,
      [dayKey]: {
        ...currentDay,
        activities: activitiesWithIds,
      },
    };

    // Clean undefined values from itinerary before saving (Firestore doesn't allow undefined)
    const cleanedItinerary = removeUndefinedValues(updatedItinerary);

    const updateData = {
      itinerary: cleanedItinerary,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.update(updateData);

    // Return the updated data
    const updatedDoc = await docRef.get();
    const updatedTrip = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    };

    // Convert coverPhotoUrl from gs:// to signed HTTP URL if present
    return await convertCoverPhotoUrl(updatedTrip);
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

    // Clean undefined values from itinerary before saving (Firestore doesn't allow undefined)
    const cleanedItinerary = removeUndefinedValues(updatedItinerary);

    const updateData = {
      itinerary: cleanedItinerary,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.update(updateData);

    // Return the updated data
    const updatedDoc = await docRef.get();
    const updatedTrip = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    };

    // Convert coverPhotoUrl from gs:// to signed HTTP URL if present
    return await convertCoverPhotoUrl(updatedTrip);
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

    // Clean undefined values from itinerary before saving (Firestore doesn't allow undefined)
    const cleanedItinerary = removeUndefinedValues(updatedItinerary);

    const updateData = {
      itinerary: cleanedItinerary,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.update(updateData);

    // Return the updated data
    const updatedDoc = await docRef.get();
    const updatedTrip = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    };

    // Convert coverPhotoUrl from gs:// to signed HTTP URL if present
    return await convertCoverPhotoUrl(updatedTrip);
  } catch (error) {
    console.error("Error updating activity:", error);
    throw error;
  }
};

/**
 * Update trip status
 * @param {string} tripId - The trip document ID
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @param {string} status - The new status value (draft, planning, active, completed, archive)
 * @returns {Promise<object>} - The updated trip document
 */
const updateTripStatus = async (tripId, userId, status) => {
  try {
    const validStatuses = ["draft", "planning", "active", "completed", "archive"];
    
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
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

    const updateData = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.update(updateData);

    // Return the updated data
    const updatedDoc = await docRef.get();
    const updatedTrip = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    };

    // Convert coverPhotoUrl from gs:// to signed HTTP URL if present
    return await convertCoverPhotoUrl(updatedTrip);
  } catch (error) {
    console.error("Error updating trip status:", error);
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

    // Clean undefined values from itinerary before saving (Firestore doesn't allow undefined)
    const cleanedItinerary = removeUndefinedValues(updatedItinerary);

    const updateData = {
      itinerary: cleanedItinerary,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.update(updateData);

    // Return the updated data
    const updatedDoc = await docRef.get();
    const updatedTrip = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    };

    // Convert coverPhotoUrl from gs:// to signed HTTP URL if present
    return await convertCoverPhotoUrl(updatedTrip);
  } catch (error) {
    console.error("Error deleting activity:", error);
    throw error;
  }
};

/**
 * Save current activities to version history (max 2 versions)
 * @param {string} tripId - The trip document ID
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @param {number} dayNumber - The day number (1, 2, 3, etc.)
 * @param {Array} currentActivities - The current activities to save
 * @returns {Promise<void>}
 */
const saveToVersionHistory = async (tripId, userId, dayNumber, currentActivities) => {
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
    const existingVersionHistory = currentDay.versionHistory || [];

    // Create new version entry
    // Use Timestamp.now() instead of serverTimestamp() because serverTimestamp() 
    // cannot be used inside arrays in Firestore
    const newVersion = {
      activities: JSON.parse(JSON.stringify(currentActivities)), // Deep copy
      createdAt: admin.firestore.Timestamp.now(),
    };

    // Add new version and keep only the last 2 versions
    const updatedVersionHistory = [newVersion, ...existingVersionHistory].slice(0, 2);

    // Update the day with new version history
    const updatedItinerary = {
      ...currentItinerary,
      [dayKey]: {
        ...currentDay,
        versionHistory: updatedVersionHistory,
      },
    };

    // Clean undefined values from itinerary before saving
    const cleanedItinerary = removeUndefinedValues(updatedItinerary);

    const updateData = {
      itinerary: cleanedItinerary,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.update(updateData);
  } catch (error) {
    console.error("Error saving to version history:", error);
    throw error;
  }
};

/**
 * Regenerate activities for a specific day
 * @param {string} tripId - The trip document ID
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @param {number} dayNumber - The day number (1, 2, 3, etc.)
 * @param {Array<string>} excludeActivityIds - Activity IDs to keep (not regenerate)
 * @returns {Promise<object>} - The updated trip document
 */
const regenerateDayActivities = async (tripId, userId, dayNumber, excludeActivityIds = []) => {
  try {
    const { regenerateDayActivities: regenerateActivities } = require("./autoArrangementService");
    
    // Get the trip
    const trip = await getTripById(tripId, userId);
    if (!trip) {
      throw new Error("Trip not found");
    }

    // Get current activities before regenerating
    const dayKey = `day${dayNumber}`;
    const currentItinerary = trip.itinerary || {};
    const currentDay = currentItinerary[dayKey] || {};
    const currentActivities = currentDay.activities || [];

    // Save current activities to version history if there are any
    if (currentActivities.length > 0) {
      await saveToVersionHistory(tripId, userId, dayNumber, currentActivities);
    }

    // Regenerate activities using the auto-arrangement service
    const regeneratedActivities = await regenerateActivities(trip, dayNumber, excludeActivityIds);

    // Update the day with regenerated activities
    return await updateDayActivities(tripId, userId, dayNumber, regeneratedActivities);
  } catch (error) {
    console.error("Error regenerating day activities:", error);
    throw error;
  }
};

/**
 * Get version history for a specific day
 * @param {string} tripId - The trip document ID
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @param {number} dayNumber - The day number (1, 2, 3, etc.)
 * @returns {Promise<Array>} - Array of version history entries
 */
const getDayVersionHistory = async (tripId, userId, dayNumber) => {
  try {
    const trip = await getTripById(tripId, userId);
    if (!trip) {
      throw new Error("Trip not found");
    }

    const dayKey = `day${dayNumber}`;
    const itinerary = trip.itinerary || {};
    const day = itinerary[dayKey] || {};
    const versionHistory = day.versionHistory || [];

    // Convert Firestore timestamps to readable format
    return versionHistory.map((version, index) => ({
      versionNumber: index + 1,
      activities: version.activities || [],
      createdAt: version.createdAt ? (version.createdAt.toDate ? version.createdAt.toDate().toISOString() : version.createdAt) : null,
    }));
  } catch (error) {
    console.error("Error getting day version history:", error);
    throw error;
  }
};

/**
 * Rollback to a previous version of activities for a specific day
 * @param {string} tripId - The trip document ID
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @param {number} dayNumber - The day number (1, 2, 3, etc.)
 * @param {number} versionNumber - The version number to rollback to (1 or 2)
 * @returns {Promise<object>} - The updated trip document
 */
const rollbackToVersion = async (tripId, userId, dayNumber, versionNumber) => {
  try {
    if (versionNumber < 1 || versionNumber > 2) {
      throw new Error("Version number must be 1 or 2");
    }

    const trip = await getTripById(tripId, userId);
    if (!trip) {
      throw new Error("Trip not found");
    }

    const dayKey = `day${dayNumber}`;
    const itinerary = trip.itinerary || {};
    const day = itinerary[dayKey] || {};
    const versionHistory = day.versionHistory || [];

    if (versionHistory.length === 0) {
      throw new Error("No version history available for this day");
    }

    if (versionNumber > versionHistory.length) {
      throw new Error(`Version ${versionNumber} does not exist. Only ${versionHistory.length} version(s) available.`);
    }

    // Get the version to rollback to (versionNumber is 1-indexed, array is 0-indexed)
    const versionToRestore = versionHistory[versionNumber - 1];
    const activitiesToRestore = versionToRestore.activities || [];

    // Save current activities to version history before rollback
    const currentActivities = day.activities || [];
    if (currentActivities.length > 0) {
      await saveToVersionHistory(tripId, userId, dayNumber, currentActivities);
    }

    // Restore the activities from the selected version
    return await updateDayActivities(tripId, userId, dayNumber, activitiesToRestore);
  } catch (error) {
    console.error("Error rolling back to version:", error);
    throw error;
  }
};

/**
 * Delete a trip (soft delete by setting status to archive)
 * @param {string} tripId - The trip document ID
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @returns {Promise<object>} - The updated trip document
 */
const deleteTrip = async (tripId, userId) => {
  try {
    // Soft delete by setting status to archive
    return await updateTripStatus(tripId, userId, "archive");
  } catch (error) {
    console.error("Error deleting trip:", error);
    throw error;
  }
};

/**
 * Update trip name
 * @param {string} tripId - The trip document ID
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @param {string} tripName - The new trip name
 * @returns {Promise<object>} - The updated trip document
 */
const updateTripName = async (tripId, userId, tripName) => {
  try {
    if (!tripName || typeof tripName !== "string" || tripName.trim().length === 0) {
      throw new Error("Trip name is required and must be a non-empty string");
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

    // Update the selectedTrip.name field
    const updatedSelectedTrip = {
      ...tripData.selectedTrip,
      name: tripName.trim(),
    };

    const updateData = {
      selectedTrip: updatedSelectedTrip,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.update(updateData);

    // Return the updated data
    const updatedDoc = await docRef.get();
    const updatedTrip = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    };

    // Convert coverPhotoUrl from gs:// to signed HTTP URL if present
    return await convertCoverPhotoUrl(updatedTrip);
  } catch (error) {
    console.error("Error updating trip name:", error);
    throw error;
  }
};

/**
 * Update trip cover photo URL by generating a new cover photo based on trip name
 * @param {string} tripId - The trip document ID
 * @param {string} userId - The user ID from Clerk (for authorization)
 * @param {string} coverPhotoUrl - The new cover photo URL (GCS URI)
 * @returns {Promise<object>} - The updated trip document
 */
const updateTripCoverPhotoUrl = async (tripId, userId, coverPhotoUrl) => {
  try {
    if (!coverPhotoUrl || typeof coverPhotoUrl !== "string" || coverPhotoUrl.trim().length === 0) {
      throw new Error("Cover photo URL is required and must be a non-empty string");
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

    const updateData = {
      coverPhotoUrl: coverPhotoUrl.trim(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.update(updateData);

    // Return the updated data
    const updatedDoc = await docRef.get();
    const updatedTrip = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    };

    // Convert coverPhotoUrl from gs:// to signed HTTP URL if present
    return await convertCoverPhotoUrl(updatedTrip);
  } catch (error) {
    console.error("Error updating trip cover photo URL:", error);
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
  updateTripStatus,
  regenerateDayActivities,
  getDayVersionHistory,
  rollbackToVersion,
  deleteTrip,
  updateTripName,
  updateTripCoverPhotoUrl,
};

