const express = require("express");
const { createTripSuggestions } = require("../controllers/tripSuggestionController");

const router = express.Router();

// Generate trip suggestions - Start with AI 
router.post("/trip-suggestions", createTripSuggestions);

module.exports = router;
