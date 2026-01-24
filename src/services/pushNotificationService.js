const admin = require("firebase-admin");
const { getFcmToken } = require("./fcmTokenService");

/**
 * Send a push notification to a user
 * @param {string} userId - The user ID to send notification to
 * @param {object} notification - Notification object with title and body
 * @param {object} data - Optional data payload
 * @param {string} type - Notification type: 'trip' | 'inspiration' | 'confirmation'
 * @returns {Promise<boolean>} - True if sent successfully, false if user has no FCM token
 */
const sendPushNotification = async (userId, notification, data = {}, type = null) => {
  try {
    // Get user's FCM token
    const fcmTokenData = await getFcmToken(userId);
    
    if (!fcmTokenData || !fcmTokenData.fcmToken) {
      console.log(`⚠️ No FCM token found for user ${userId}, skipping push notification`);
      return false;
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        ...Object.keys(data).reduce((acc, key) => {
          // FCM data payload values must be strings
          acc[key] = String(data[key]);
          return acc;
        }, {}),
        ...(type && { type: String(type) }),
      },
      token: fcmTokenData.fcmToken,
    };

    // Send the notification
    const response = await admin.messaging().send(message);
    console.log(`✅ Push notification sent successfully to user ${userId}:`, response);
    return true;
  } catch (error) {
    console.error(`❌ Error sending push notification to user ${userId}:`, error);
    
    // Handle invalid token errors (e.g., token expired, unregistered)
    if (error.code === "messaging/invalid-registration-token" || 
        error.code === "messaging/registration-token-not-registered") {
      console.log(`⚠️ FCM token for user ${userId} is invalid or unregistered, consider removing it`);
      // Optionally delete the invalid token here
      // await deleteFcmToken(userId);
    }
    
    // Don't throw error - we don't want notification failures to break the main flow
    return false;
  }
};

/**
 * Send a push notification when trip itinerary is created
 * @param {string} userId - The user ID
 * @param {string} tripId - The trip ID
 * @param {string} tripName - The trip name/destination
 * @returns {Promise<boolean>} - True if sent successfully
 */
const sendTripItineraryCreatedNotification = async (userId, tripId, tripName) => {
  const destination = tripName || "your trip";
  
  return await sendPushNotification(
    userId,
    {
      title: "🎉 Your Trip Itinerary is Ready!",
      body: `Your itinerary for ${destination} has been created successfully. Start planning your adventure!`,
    },
    {
      tripId: tripId,
      tripName: destination,
    },
    "trip"
  );
};

/**
 * Send a push notification when inspiration items are processed and saved
 * @param {string} userId - The user ID
 * @param {number} itemCount - Number of inspiration items saved
 * @param {string} sourceType - Source type (e.g., "video", "link")
 * @returns {Promise<boolean>} - True if sent successfully
 */
const sendInspirationProcessedNotification = async (userId, itemCount, sourceType = "inspiration") => {
  const sourceLabel = sourceType === "video" ? "video" : sourceType === "link" ? "link" : "content";
  const itemText = itemCount === 1 ? "item" : "items";
  
  return await sendPushNotification(
    userId,
    {
      title: "✨ Inspiration Items Ready!",
      body: `We've extracted ${itemCount} inspiration ${itemText} from the ${sourceLabel}. Check them out!`,
    },
    {
      itemCount: String(itemCount),
      sourceType: sourceType,
    },
    "inspiration"
  );
};

/**
 * Send a push notification when travel confirmation is processed and saved
 * @param {string} userId - The user ID
 * @param {number} confirmationCount - Number of travel confirmations processed
 * @param {string} confirmationType - Type of confirmation (e.g., "flight", "hotel", "restaurant")
 * @returns {Promise<boolean>} - True if sent successfully
 */
const sendTravelConfirmationProcessedNotification = async (userId, confirmationCount, confirmationType = "travel") => {
  const itemText = confirmationCount === 1 ? "confirmation" : "confirmations";
  const typeLabel = confirmationType === "flight" ? "flight" : 
                   confirmationType === "hotel" ? "hotel" : 
                   confirmationType === "restaurant" ? "restaurant" : 
                   confirmationType === "activity" ? "activity" : "travel";
  
  return await sendPushNotification(
    userId,
    {
      title: "📋 Travel Confirmation Processed!",
      body: `Your ${typeLabel} ${itemText} has been processed and saved. View your booking details now!`,
    },
    {
      confirmationCount: String(confirmationCount),
      confirmationType: confirmationType,
    },
    "confirmation"
  );
};

module.exports = {
  sendPushNotification,
  sendTripItineraryCreatedNotification,
  sendInspirationProcessedNotification,
  sendTravelConfirmationProcessedNotification,
};

