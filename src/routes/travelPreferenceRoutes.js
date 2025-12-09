const express = require("express");
const {
  savePreferences,
  getPreferences,
  deletePreferences,
} = require("../controllers/travelPreferenceController");

const router = express.Router();

// Save or update travel preferences
router.post("/travel-preferences", savePreferences);

// Get travel preferences
router.get("/travel-preferences", getPreferences);

// Delete travel preferences
router.delete("/travel-preferences", deletePreferences);

module.exports = router;

