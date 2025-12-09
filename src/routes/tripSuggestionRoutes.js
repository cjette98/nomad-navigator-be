const express = require("express");
const { getTripSuggestions } = require("../controllers/tripSuggestionController");

const router = express.Router();

// Generate trip suggestions
router.get("/trip-suggestions", getTripSuggestions);

module.exports = router;
