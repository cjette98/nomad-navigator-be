const express = require("express");
const { createTripSuggestions } = require("../controllers/tripSuggestionController");

const router = express.Router();

/**
 * @swagger
 * /api/trip-suggestions:
 *   post:
 *     summary: Generate AI-powered trip suggestions
 *     description: Creates personalized trip suggestions based on destination, preferences, and travel details. Requires user travel preferences to be set up first.
 *     tags: [Trip Suggestions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TripSuggestionRequest'
 *           example:
 *             destinationOrVibe: "Lisbon, food + culture"
 *             mustHaves: ["great coffee", "walkable areas", "historic sites"]
 *             durationDays: 5
 *             startDate: "2025-02-10"
 *             endDate: "2025-02-15"
 *             travelPace: "slow"
 *             travelers: 2
 *             budget: "mid"
 *     responses:
 *       200:
 *         description: Trip suggestions generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TripSuggestionResponse'
 *       400:
 *         description: Bad request - missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "Destination or vibe is required"
 *       401:
 *         description: Unauthorized - missing or invalid authentication
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Travel preferences not found for user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/trip-suggestions", createTripSuggestions);

module.exports = router;
