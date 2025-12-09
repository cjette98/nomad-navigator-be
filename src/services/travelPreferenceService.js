const { getFirestore } = require("../config/database");
const admin = require("firebase-admin");

const COLLECTION_NAME = "travelPreferences";

/**
 * Save or update travel preferences for a user
 * @param {string} userId - The user ID from Clerk
 * @param {object} preferences - The travel preferences data
 * @returns {Promise<object>} - The saved travel preferences
 */
const saveTravelPreferences = async (userId, preferences) => {
  try {
    const db = getFirestore();
    const docRef = db.collection(COLLECTION_NAME).doc(userId);

    const data = {
      userId,
      ...preferences,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Check if document exists to set createdAt only on creation
    const doc = await docRef.get();
    if (!doc.exists) {
      data.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await docRef.set(data, { merge: true });

    // Return the saved data
    const savedDoc = await docRef.get();
    return {
      id: savedDoc.id,
      ...savedDoc.data(),
    };
  } catch (error) {
    console.error("Error saving travel preferences:", error);
    throw error;
  }
};

/**
 * Get travel preferences for a user
 * @param {string} userId - The user ID from Clerk
 * @returns {Promise<object|null>} - The user's travel preferences or null if not found
 */
const getTravelPreferences = async (userId) => {
  try {
    const db = getFirestore();
    const docRef = db.collection(COLLECTION_NAME).doc(userId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    };
  } catch (error) {
    console.error("Error getting travel preferences:", error);
    throw error;
  }
};

/**
 * Delete travel preferences for a user
 * @param {string} userId - The user ID from Clerk
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
const deleteTravelPreferences = async (userId) => {
  try {
    const db = getFirestore();
    const docRef = db.collection(COLLECTION_NAME).doc(userId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return false;
    }

    await docRef.delete();
    return true;
  } catch (error) {
    console.error("Error deleting travel preferences:", error);
    throw error;
  }
};

module.exports = {
  saveTravelPreferences,
  getTravelPreferences,
  deleteTravelPreferences,
};
