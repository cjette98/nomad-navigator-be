const express = require("express");
const {
  savePreferences,
  getPreferences,
  deletePreferences,
} = require("../controllers/travelPreferenceController");

const router = express.Router();

// Save or update travel preferences
router.post("/", savePreferences);

// Get travel preferences
router.get("/", getPreferences);

// Delete travel preferences
router.delete("/", deletePreferences);

module.exports = router;

