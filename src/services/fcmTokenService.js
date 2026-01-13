const { getFirestore } = require("../config/database");
const admin = require("firebase-admin");

const COLLECTION_NAME = "fcm";

/**
 * Register or update FCM token for a user
 * @param {string} userId - The user ID from Clerk
 * @param {string} fcmToken - The FCM token to register
 * @returns {Promise<object>} - The saved FCM token data
 */
const registerFcmToken = async (userId, fcmToken) => {
  try {
    const db = getFirestore();
    const docRef = db.collection(COLLECTION_NAME).doc(userId);

    const data = {
      userId,
      fcmToken,
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
    console.error("Error registering FCM token:", error);
    throw error;
  }
};

/**
 * Get FCM token for a user
 * @param {string} userId - The user ID from Clerk
 * @returns {Promise<object|null>} - The user's FCM token data or null if not found
 */
const getFcmToken = async (userId) => {
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
    console.error("Error getting FCM token:", error);
    throw error;
  }
};

/**
 * Delete FCM token for a user
 * @param {string} userId - The user ID from Clerk
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
const deleteFcmToken = async (userId) => {
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
    console.error("Error deleting FCM token:", error);
    throw error;
  }
};

module.exports = {
  registerFcmToken,
  getFcmToken,
  deleteFcmToken,
};

