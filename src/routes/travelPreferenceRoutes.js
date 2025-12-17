const express = require("express");
const {
  savePreferences,
  getPreferences,
  updatePreferences,
  deletePreferences,
  getTravelPreferencesItems
} = require("../controllers/travelPreferenceController");

const router = express.Router();

/**
 * @swagger
 * /api/travel-preferences:
 *   post:
 *     summary: Create travel preferences
 *     description: Creates new travel preferences for the authenticated user. If preferences already exist, they will be merged with existing data.
 *     tags: [Travel Preferences]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TravelPreferencesRequest'
 *           example:
 *             whoIsGoing: "solo"
 *             preferredTravelDocuments: ["passport", "visa"]
 *             preferredFlightStyle: "business"
 *             preferredInDestinationTransport: "rent a car"
 *             travelPerYear: "rarely (1-2) trips"
 *             travelerType: "hybrid"
 *             preferredTripDuration: "standard vacation"
 *             tripBudget: "cheap"
 *             accommodationStyle: "luxury hotel"
 *             loyaltyPrograms: "both"
 *             interestsAndVibes: ["beaches", "mountains", "nightlife", "culture", "adventure"]
 *     responses:
 *       200:
 *         description: Travel preferences saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TravelPreferencesResponse'
 *       400:
 *         description: Bad request - missing or invalid preferences data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "Travel preferences data is required"
 *       401:
 *         description: Unauthorized - missing or invalid authentication
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
router.post("/travel-preferences", savePreferences);

/**
 * @swagger
 * /api/travel-preferences:
 *   get:
 *     summary: Get travel preferences
 *     description: Retrieves the travel preferences for the authenticated user
 *     tags: [Travel Preferences]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Travel preferences retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TravelPreferencesGetResponse'
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
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Travel preferences not found"
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   example: null
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/travel-preferences", getPreferences);

/**
 * @swagger
 * /api/travel-preferences:
 *   put:
 *     summary: Update travel preferences
 *     description: Updates existing travel preferences for the authenticated user. Returns 404 if preferences don't exist (use POST to create).
 *     tags: [Travel Preferences]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TravelPreferencesRequest'
 *           example:
 *             whoIsGoing: "solo"
 *             preferredTravelDocuments: ["passport", "visa"]
 *             preferredFlightStyle: "business"
 *             preferredInDestinationTransport: "rent a car"
 *             travelPerYear: "rarely (1-2) trips"
 *             travelerType: "hybrid"
 *             preferredTripDuration: "standard vacation"
 *             tripBudget: "cheap"
 *             accommodationStyle: "luxury hotel"
 *             loyaltyPrograms: "both"
 *             interestsAndVibes: ["beaches", "mountains", "nightlife", "culture", "adventure"]
 *     responses:
 *       200:
 *         description: Travel preferences updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Travel preferences updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/TravelPreferences'
 *       400:
 *         description: Bad request - missing or invalid preferences data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "Travel preferences data is required"
 *       401:
 *         description: Unauthorized - missing or invalid authentication
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Travel preferences not found - use POST to create new preferences
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "Travel preferences not found. Use POST to create new preferences."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put("/travel-preferences", updatePreferences);

/**
 * @swagger
 * /api/travel-preferences-settings:
 *   get:
 *     summary: Get travel preferences settings
 *     description: Retrieves the travel preferences setttings requirements for user onboarding
 *     tags: [Travel Preferences Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Travel preferences retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TravelPreferencesSettingsGetResponse'
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
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Travel preferences not found"
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   example: null
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

router.get("/travel-preferences-settings", getTravelPreferencesItems);

module.exports = router;
