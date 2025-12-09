const express = require("express");
const {
  createTrip,
  getTrips,
  getTrip,
  updateActivities,
  addActivities,
} = require("../controllers/tripController");

const router = express.Router();

// Create a new trip with generated itinerary
router.post("/trips", createTrip);

// Get all trips for the current user
router.get("/trips", getTrips);

// Get a specific trip by ID
router.get("/trips/:tripId", getTrip);

// Update activities for a specific day
router.put("/trips/:tripId/days/:dayNumber/activities", updateActivities);

// Add activities to a specific day
router.post("/trips/:tripId/days/:dayNumber/activities", addActivities);

module.exports = router;
