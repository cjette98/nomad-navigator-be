const { generateTripSuggestions } = require("../services/tripSuggestionService");

/**
 * Generate trip suggestions for the current user
 * GET /api/trip-suggestions
 */
const getTripSuggestions = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const suggestions = await generateTripSuggestions(userId);

    return res.status(200).json({
      success: true,
      message: "Trip suggestions generated successfully",
      data: suggestions,
    });
  } catch (error) {
    console.error("Error in getTripSuggestions controller:", error);
    
    // Handle specific error cases
    if (error.message.includes("Travel preferences not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to generate trip suggestions",
      error: error.message,
    });
  }
};

module.exports = {
  getTripSuggestions,
};
