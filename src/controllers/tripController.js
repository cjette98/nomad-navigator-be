const { saveTrip, getUserTrips, getTripById, updateDayActivities, addDayActivities, addInspirationItemsToTrip, updateActivity, deleteActivity, updateTripStatus, regenerateDayActivities, getDayVersionHistory, rollbackToVersion, deleteTrip } = require("../services/tripService");
const { generateItinerary } = require("../services/itineraryService");
const { getInspirationItemsByIds, formatInspirationItemsToActivities } = require("../services/categorizationService");
const { generateTripCoverPhoto } = require("../services/imageGenerationService");
const { uploadImageToGCS } = require("../services/gcsService");

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

    // Generate and save trip cover photo
    let coverPhotoUrl = null;
    try {
      const destination = selectedTrip.destination || selectedTrip.name || "travel destination";
      console.log("🖼️ Generating cover photo for trip...");
      
      // Generate the image
      const imageBuffer = await generateTripCoverPhoto(destination);
      
      // Upload to GCS
      const timestamp = Date.now();
      const filename = `trip-covers/${userId}/${timestamp}_cover.png`;
      coverPhotoUrl = await uploadImageToGCS(imageBuffer, filename);
      
      console.log("✅ Cover photo generated and saved successfully");
    } catch (coverPhotoError) {
      console.error("⚠️ Error generating cover photo (continuing without it):", coverPhotoError.message);
      // Continue without cover photo if generation fails
    }

    // Save trip with itinerary and cover photo to Firestore
    const savedTrip = await saveTrip(userId, selectedTrip, itinerary, coverPhotoUrl);

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
    const { itemIds, autoArrange, timeBlock, timeBlocks } = req.body;

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

    // Validate timeBlock if provided (single timeBlock for all)
    if (timeBlock !== undefined) {
      const validTimeBlocks = ["morning", "afternoon", "evening"];
      if (!validTimeBlocks.includes(timeBlock)) {
        return res.status(400).json({
          success: false,
          message: `Invalid timeBlock. Must be one of: ${validTimeBlocks.join(", ")}`,
        });
      }
    }

    // Validate timeBlocks if provided (object mapping itemId -> timeBlock)
    if (timeBlocks !== undefined) {
      if (typeof timeBlocks !== "object" || Array.isArray(timeBlocks) || timeBlocks === null) {
        return res.status(400).json({
          success: false,
          message: "timeBlocks must be an object mapping itemId to timeBlock",
        });
      }

      const validTimeBlocks = ["morning", "afternoon", "evening"];
      for (const [itemId, tb] of Object.entries(timeBlocks)) {
        if (!validTimeBlocks.includes(tb)) {
          return res.status(400).json({
            success: false,
            message: `Invalid timeBlock "${tb}" for itemId "${itemId}". Must be one of: ${validTimeBlocks.join(", ")}`,
          });
        }
      }
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

    // Format inspiration items to activity format with timeblocks
    const formattedActivities = formatInspirationItemsToActivities(inspirationItems, timeBlock, timeBlocks);
    
    console.log(`✅ Formatted ${formattedActivities.length} inspiration item(s) into activities`);

    let updatedTrip;

    if (autoArrange === true) {
      // Auto-arrange: Use AI to rearrange the day
      console.log("🔄 Auto-arranging day to fit new inspiration(s)...");
      
      const { arrangeDayWithInspiration } = require("../services/autoArrangementService");
      const trip = await getTripById(tripId, userId);
      
      if (!trip) {
        return res.status(404).json({
          success: false,
          message: "Trip not found",
        });
      }

      // For multiple inspirations, add them one by one with auto-arrangement
      let currentTrip = trip;
      for (const activity of formattedActivities) {
        const rearrangedActivities = await arrangeDayWithInspiration(
          currentTrip,
          dayNum,
          activity
        );
        
        // Update the trip with rearranged activities
        currentTrip = await updateDayActivities(tripId, userId, dayNum, rearrangedActivities);
      }
      
      updatedTrip = currentTrip;
      console.log("✅ Day auto-arranged successfully");
    } else {
      // Manual placement: Just add activities
      updatedTrip = await addInspirationItemsToTrip(tripId, userId, dayNum, formattedActivities);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully added ${formattedActivities.length} inspiration item(s) to day ${dayNum}${autoArrange ? " with auto-arrangement" : ""}`,
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

/**
 * Update trip status
 * PATCH /api/trips/:tripId/status
 */
const updateTripStatusController = async (req, res) => {
  try {
    const userId = req.userId;
    const { tripId } = req.params;
    const { status } = req.body;

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

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const updatedTrip = await updateTripStatus(tripId, userId, status);

    return res.status(200).json({
      success: true,
      message: "Trip status updated successfully",
      data: updatedTrip,
    });
  } catch (error) {
    console.error("Error in updateTripStatusController:", error);
    
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

    if (error.message.includes("Invalid status")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update trip status",
      error: error.message,
    });
  }
};

/**
 * Regenerate activities for a specific day
 * POST /api/trips/:tripId/days/:dayNumber/regenerate
 */
const regenerateDay = async (req, res) => {
  try {
    const userId = req.userId;
    const { tripId, dayNumber } = req.params;

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

    // Fixed activities (like confirmations) are automatically preserved
    const updatedTrip = await regenerateDayActivities(
      tripId,
      userId,
      dayNum,
      [] // No excludeActivityIds needed - fixed activities are preserved automatically
    );

    return res.status(200).json({
      success: true,
      message: `Day ${dayNum} activities regenerated successfully`,
      data: updatedTrip,
    });
  } catch (error) {
    console.error("Error in regenerateDay controller:", error);

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
      message: "Failed to regenerate day activities",
      error: error.message,
    });
  }
};

/**
 * Get alternative activity recommendations
 * GET /api/trips/:tripId/days/:dayNumber/activities/:activityId/alternatives
 */
const getActivityAlternatives = async (req, res) => {
  try {
    const userId = req.userId;
    const { tripId, dayNumber, activityId } = req.params;
    const { timeBlock } = req.query;

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

    // Get the trip
    const trip = await getTripById(tripId, userId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // Get alternatives
    const { getActivityAlternatives: getAlternatives } = require("../services/activityRecommendationService");
    const alternatives = await getAlternatives(trip, dayNum, activityId, timeBlock || null);

    return res.status(200).json({
      success: true,
      data: alternatives,
    });
  } catch (error) {
    console.error("Error in getActivityAlternatives controller:", error);

    if (error.message.includes("not found") || error.message.includes("Activity not found")) {
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
      message: "Failed to get activity alternatives",
      error: error.message,
    });
  }
};

/**
 * Get version history for a specific day
 * GET /api/trips/:tripId/days/:dayNumber/versions
 */
const getDayVersions = async (req, res) => {
  try {
    const userId = req.userId;
    const { tripId, dayNumber } = req.params;

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

    const versionHistory = await getDayVersionHistory(tripId, userId, dayNum);

    return res.status(200).json({
      success: true,
      data: versionHistory,
    });
  } catch (error) {
    console.error("Error in getDayVersions controller:", error);

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
      message: "Failed to get version history",
      error: error.message,
    });
  }
};

/**
 * Rollback to a previous version of activities for a specific day
 * POST /api/trips/:tripId/days/:dayNumber/versions/:versionNumber/rollback
 */
const rollbackDayVersion = async (req, res) => {
  try {
    const userId = req.userId;
    const { tripId, dayNumber, versionNumber } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    if (!tripId || !dayNumber || !versionNumber) {
      return res.status(400).json({
        success: false,
        message: "Trip ID, day number, and version number are required",
      });
    }

    const dayNum = parseInt(dayNumber, 10);
    if (isNaN(dayNum) || dayNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Day number must be a positive integer",
      });
    }

    const versionNum = parseInt(versionNumber, 10);
    if (isNaN(versionNum) || versionNum < 1 || versionNum > 2) {
      return res.status(400).json({
        success: false,
        message: "Version number must be 1 or 2",
      });
    }

    const updatedTrip = await rollbackToVersion(tripId, userId, dayNum, versionNum);

    return res.status(200).json({
      success: true,
      message: `Successfully rolled back to version ${versionNum} for day ${dayNum}`,
      data: updatedTrip,
    });
  } catch (error) {
    console.error("Error in rollbackDayVersion controller:", error);

    if (error.message.includes("not found") || error.message.includes("does not exist")) {
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

    if (error.message.includes("Version number must be") || error.message.includes("No version history")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to rollback to version",
      error: error.message,
    });
  }
};

/**
 * Delete a trip
 * DELETE /api/trips/:tripId
 */
const deleteTripController = async (req, res) => {
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

    const updatedTrip = await deleteTrip(tripId, userId);

    return res.status(200).json({
      success: true,
      message: "Trip deleted successfully",
      data: updatedTrip,
    });
  } catch (error) {
    console.error("Error in deleteTripController:", error);

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
      message: "Failed to delete trip",
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
  updateTripStatusController,
  regenerateDay,
  getActivityAlternatives,
  getDayVersions,
  rollbackDayVersion,
  deleteTripController,
};
