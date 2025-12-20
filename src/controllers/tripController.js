const { saveTrip, getUserTrips, getTripById, updateDayActivities, addDayActivities, addInspirationItemsToTrip, updateActivity, deleteActivity } = require("../services/tripService");
const { generateItinerary } = require("../services/itineraryService");
const { getInspirationItemsByIds, formatInspirationItemsToActivities } = require("../services/categorizationService");

/**
 * Create a new trip with generated itinerary
 * POST /api/trips
 */
const createTrip = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const { selectedTrip } = req.body;

    if (!selectedTrip) {
      return res.status(400).json({
        success: false,
        message: "Selected trip data is required",
      });
    }

    // Generate 3-day itinerary using AI
    console.log("🎯 Generating itinerary for trip...");
    const itinerary = await generateItinerary(selectedTrip);
    console.log("✅ Itinerary generated successfully");

    // Save trip with itinerary to Firestore
    const savedTrip = await saveTrip(userId, selectedTrip, itinerary);

    return res.status(201).json({
      success: true,
      message: "Trip created successfully with itinerary",
      data: savedTrip,
    });
  } catch (error) {
    console.error("Error in createTrip controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create trip",
      error: error.message,
    });
  }
};

/**
 * Get all trips for the current user
 * GET /api/trips
 */
const getTrips = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const trips = await getUserTrips(userId);

    return res.status(200).json({
      success: true,
      data: trips,
    });
  } catch (error) {
    console.error("Error in getTrips controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get trips",
      error: error.message,
    });
  }
};

/**
 * Get a specific trip by ID
 * GET /api/trips/:tripId
 */
const getTrip = async (req, res) => {
  try {
    const userId = req.userId;
    const { tripId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Trip ID is required",
      });
    }

    const trip = await getTripById(tripId, userId);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: trip,
    });
  } catch (error) {
    console.error("Error in getTrip controller:", error);
    
    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to get trip",
      error: error.message,
    });
  }
};

/**
 * Update activities for a specific day
 * PUT /api/trips/:tripId/days/:dayNumber/activities
 */
const updateActivities = async (req, res) => {
  try {
    const userId = req.userId;
    const { tripId, dayNumber } = req.params;
    const { activities } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    if (!tripId || !dayNumber) {
      return res.status(400).json({
        success: false,
        message: "Trip ID and day number are required",
      });
    }

    const dayNum = parseInt(dayNumber, 10);
    if (isNaN(dayNum) || dayNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Day number must be a positive integer",
      });
    }

    if (!Array.isArray(activities)) {
      return res.status(400).json({
        success: false,
        message: "Activities must be an array",
      });
    }

    const updatedTrip = await updateDayActivities(tripId, userId, dayNum, activities);

    return res.status(200).json({
      success: true,
      message: `Activities updated for day ${dayNum}`,
      data: updatedTrip,
    });
  } catch (error) {
    console.error("Error in updateActivities controller:", error);
    
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update activities",
      error: error.message,
    });
  }
};

/**
 * Add activities to a specific day
 * POST /api/trips/:tripId/days/:dayNumber/activities
 */
const addActivities = async (req, res) => {
  try {
    const userId = req.userId;
    const { tripId, dayNumber } = req.params;
    const { activities } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    if (!tripId || !dayNumber) {
      return res.status(400).json({
        success: false,
        message: "Trip ID and day number are required",
      });
    }

    const dayNum = parseInt(dayNumber, 10);
    if (isNaN(dayNum) || dayNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Day number must be a positive integer",
      });
    }

    if (!Array.isArray(activities) || activities.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Activities must be a non-empty array",
      });
    }

    const updatedTrip = await addDayActivities(tripId, userId, dayNum, activities);

    return res.status(200).json({
      success: true,
      message: `Activities added to day ${dayNum}`,
      data: updatedTrip,
    });
  } catch (error) {
    console.error("Error in addActivities controller:", error);
    
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to add activities",
      error: error.message,
    });
  }
};

/**
 * Add inspiration items to a specific day of a trip
 * POST /api/trips/:tripId/days/:dayNumber/inspirations
 */
const addInspirationsToTrip = async (req, res) => {
  try {
    const userId = req.userId;
    const { tripId, dayNumber } = req.params;
    const { itemIds } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    if (!tripId || !dayNumber) {
      return res.status(400).json({
        success: false,
        message: "Trip ID and day number are required",
      });
    }

    const dayNum = parseInt(dayNumber, 10);
    if (isNaN(dayNum) || dayNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Day number must be a positive integer",
      });
    }

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "itemIds must be a non-empty array",
      });
    }

    // Validate that all items in the array are strings
    if (!itemIds.every((id) => typeof id === "string" && id.trim().length > 0)) {
      return res.status(400).json({
        success: false,
        message: "All itemIds must be non-empty strings",
      });
    }

    console.log(`✨ Getting ${itemIds.length} inspiration item(s) and formatting them...`);
    
    // Get inspiration items by IDs
    const inspirationItems = await getInspirationItemsByIds(itemIds, userId);
    
    if (inspirationItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No inspiration items found with the provided IDs",
      });
    }

    // Format inspiration items to activity format
    const formattedActivities = formatInspirationItemsToActivities(inspirationItems);
    
    console.log(`✅ Formatted ${formattedActivities.length} inspiration item(s) into activities`);

    // Add formatted activities to the trip day
    const updatedTrip = await addInspirationItemsToTrip(tripId, userId, dayNum, formattedActivities);

    return res.status(200).json({
      success: true,
      message: `Successfully added ${formattedActivities.length} inspiration item(s) to day ${dayNum}`,
      data: updatedTrip,
    });
  } catch (error) {
    console.error("Error in addInspirationsToTrip controller:", error);
    
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to add inspiration items to trip",
      error: error.message,
    });
  }
};

/**
 * Update a specific activity in a trip day
 * PUT /api/trips/:tripId/days/:dayNumber/activities/:activityId
 */
const updateActivityById = async (req, res) => {
  try {
    const userId = req.userId;
    const { tripId, dayNumber, activityId } = req.params;
    const updatedActivityData = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    if (!tripId || !dayNumber || !activityId) {
      return res.status(400).json({
        success: false,
        message: "Trip ID, day number, and activity ID are required",
      });
    }

    const dayNum = parseInt(dayNumber, 10);
    if (isNaN(dayNum) || dayNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Day number must be a positive integer",
      });
    }

    if (!updatedActivityData || Object.keys(updatedActivityData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Updated activity data is required",
      });
    }

    // Remove id from updatedActivityData if present (shouldn't be changed)
    const { id, ...activityUpdateData } = updatedActivityData;

    const updatedTrip = await updateActivity(tripId, userId, dayNum, activityId, activityUpdateData);

    return res.status(200).json({
      success: true,
      message: `Activity updated successfully for day ${dayNum}`,
      data: updatedTrip,
    });
  } catch (error) {
    console.error("Error in updateActivityById controller:", error);
    
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update activity",
      error: error.message,
    });
  }
};

/**
 * Delete a specific activity from a trip day
 * DELETE /api/trips/:tripId/days/:dayNumber/activities/:activityId
 */
const deleteActivityById = async (req, res) => {
  try {
    const userId = req.userId;
    const { tripId, dayNumber, activityId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    if (!tripId || !dayNumber || !activityId) {
      return res.status(400).json({
        success: false,
        message: "Trip ID, day number, and activity ID are required",
      });
    }

    const dayNum = parseInt(dayNumber, 10);
    if (isNaN(dayNum) || dayNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Day number must be a positive integer",
      });
    }

    const updatedTrip = await deleteActivity(tripId, userId, dayNum, activityId);

    return res.status(200).json({
      success: true,
      message: `Activity deleted successfully from day ${dayNum}`,
      data: updatedTrip,
    });
  } catch (error) {
    console.error("Error in deleteActivityById controller:", error);
    
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete activity",
      error: error.message,
    });
  }
};

module.exports = {
  createTrip,
  getTrips,
  getTrip,
  updateActivities,
  addActivities,
  addInspirationsToTrip,
  updateActivityById,
  deleteActivityById,
};
