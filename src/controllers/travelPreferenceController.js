const {
  saveTravelPreferences,
  getTravelPreferences,
  deleteTravelPreferences,
} = require("../services/travelPreferenceService");

/**
 * Save or update travel preferences
 * POST /api/travel-preferences
 */
const savePreferences = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const preferences = req.body;

    // Validate that preferences object is provided
    if (!preferences || Object.keys(preferences).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Travel preferences data is required",
      });
    }

    const savedPreferences = await saveTravelPreferences(userId, preferences);

    return res.status(200).json({
      success: true,
      message: "Travel preferences saved successfully",
      data: savedPreferences,
    });
  } catch (error) {
    console.error("Error in savePreferences controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save travel preferences",
      error: error.message,
    });
  }
};

/**
 * Get travel preferences for the current user
 * GET /api/travel-preferences
 */
const getPreferences = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const preferences = await getTravelPreferences(userId);

    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: "Travel preferences not found",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error("Error in getPreferences controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get travel preferences",
      error: error.message,
    });
  }
};

/**
 * Update travel preferences for the current user
 * PUT /api/travel-preferences
 */
const updatePreferences = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    // Check if preferences exist
    const existingPreferences = await getTravelPreferences(userId);
    if (!existingPreferences) {
      return res.status(404).json({
        success: false,
        message: "Travel preferences not found. Use POST to create new preferences.",
      });
    }

    const preferences = req.body;

    // Validate that preferences object is provided
    if (!preferences || Object.keys(preferences).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Travel preferences data is required",
      });
    }

    const updatedPreferences = await saveTravelPreferences(userId, preferences);

    return res.status(200).json({
      success: true,
      message: "Travel preferences updated successfully",
      data: updatedPreferences,
    });
  } catch (error) {
    console.error("Error in updatePreferences controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update travel preferences",
      error: error.message,
    });
  }
};

/**
 * Delete travel preferences for the current user
 * DELETE /api/travel-preferences
 */
const deletePreferences = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const deleted = await deleteTravelPreferences(userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Travel preferences not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Travel preferences deleted successfully",
    });
  } catch (error) {
    console.error("Error in deletePreferences controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete travel preferences",
      error: error.message,
    });
  }
};

module.exports = {
  savePreferences,
  getPreferences,
  updatePreferences,
  deletePreferences,
};

