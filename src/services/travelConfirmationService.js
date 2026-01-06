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

module.exports = {
  saveConfirmation,
  saveConfirmations,
  getUserConfirmations,
  getTripConfirmations,
  linkConfirmationToTrip,
  linkConfirmationsToTrip,
  getUnlinkedConfirmations,
  linkConfirmationsToTripWithDays,
};

