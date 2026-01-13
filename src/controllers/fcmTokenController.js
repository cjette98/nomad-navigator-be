const {
  registerFcmToken,
  getFcmToken,
  deleteFcmToken,
} = require("../services/fcmTokenService");

/**
 * Register or update FCM token for the current user
 * POST /api/fcm/token
 */
const registerToken = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const { fcmToken } = req.body;

    // Validate that fcmToken is provided
    if (!fcmToken || typeof fcmToken !== "string" || fcmToken.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "FCM token is required and must be a non-empty string",
      });
    }

    const tokenData = await registerFcmToken(userId, fcmToken.trim());

    return res.status(200).json({
      success: true,
      message: "FCM token registered successfully",
      data: tokenData,
    });
  } catch (error) {
    console.error("Error in registerToken controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to register FCM token",
      error: error.message,
    });
  }
};

/**
 * Get FCM token for the current user
 * GET /api/fcm/token
 */
const getToken = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const tokenData = await getFcmToken(userId);

    if (!tokenData) {
      return res.status(404).json({
        success: false,
        message: "FCM token not found",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      data: tokenData,
    });
  } catch (error) {
    console.error("Error in getToken controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get FCM token",
      error: error.message,
    });
  }
};

/**
 * Delete FCM token for the current user
 * DELETE /api/fcm/token
 */
const deleteToken = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const deleted = await deleteFcmToken(userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "FCM token not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "FCM token deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteToken controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete FCM token",
      error: error.message,
    });
  }
};

module.exports = {
  registerToken,
  getToken,
  deleteToken,
};

