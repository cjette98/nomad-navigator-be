const express = require("express");
const {
  createTrip,
  getTrips,
  getTrip,
  updateActivities,
  addActivities,
} = require("../controllers/tripController");

const router = express.Router();

/**
 * @swagger
 * /api/trips:
 *   post:
 *     summary: Create a new trip with AI-generated itinerary
 *     description: Creates a new trip from a selected trip suggestion and generates a 3-day itinerary using AI
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTripRequest'
 *           example:
 *             selectedTrip:
 *               destination: "Lisbon"
 *               title: "Food + Culture long weekend"
 *               startDate: "2025-02-10"
 *               endDate: "2025-02-13"
 *               durationDays: 4
 *               travelers: 2
 *               budget: "mid"
 *               vibe: ["food", "history", "walkable core"]
 *     responses:
 *       201:
 *         description: Trip created successfully with itinerary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TripResponse'
 *       400:
 *         description: Bad request - missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
router.post("/trips", createTrip);

/**
 * @swagger
 * /api/trips:
 *   get:
 *     summary: Get all trips for the current user
 *     description: Retrieves all trips belonging to the authenticated user
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of trips retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TripsListResponse'
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
router.get("/trips", getTrips);

/**
 * @swagger
 * /api/trips/{tripId}:
 *   get:
 *     summary: Get a specific trip by ID
 *     description: Retrieves a single trip by its ID. Only returns trips belonging to the authenticated user.
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the trip
 *         example: "trip123"
 *     responses:
 *       200:
 *         description: Trip retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Trip'
 *       400:
 *         description: Bad request - missing trip ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - missing or invalid authentication
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - trip does not belong to user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Trip not found
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
router.get("/trips/:tripId", getTrip);

/**
 * @swagger
 * /api/trips/{tripId}/days/{dayNumber}/activities:
 *   put:
 *     summary: Update activities for a specific day
 *     description: Replaces all activities for a specific day in the trip itinerary. The activities array will completely replace existing activities for that day.
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the trip
 *         example: "trip123"
 *       - in: path
 *         name: dayNumber
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: The day number (1, 2, 3, etc.)
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateActivitiesRequest'
 *           example:
 *             activities:
 *               - name: "Arrival at Sorsogon Airport"
 *                 time: "10:00 AM"
 *                 description: "Arrive in Sorsogon and transfer to your accommodation."
 *                 type: "transport"
 *                 location: "Sorsogon Airport"
 *               - name: "Check-in and lunch"
 *                 time: "12:30 PM"
 *                 description: "Check into hotel and grab lunch nearby."
 *                 type: "meal"
 *                 location: "Sorsogon City"
 *     responses:
 *       200:
 *         description: Activities updated successfully
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
 *                   example: "Activities updated for day 1"
 *                 data:
 *                   $ref: '#/components/schemas/Trip'
 *       400:
 *         description: Bad request - invalid parameters or missing activities array
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - missing or invalid authentication
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - trip does not belong to user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Trip not found
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
router.put("/trips/:tripId/days/:dayNumber/activities", updateActivities);

/**
 * @swagger
 * /api/trips/{tripId}/days/{dayNumber}/activities:
 *   post:
 *     summary: Add activities to a specific day
 *     description: Adds new activities to an existing day in the trip itinerary. New activities are appended to the existing activities for that day.
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the trip
 *         example: "trip123"
 *       - in: path
 *         name: dayNumber
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: The day number (1, 2, 3, etc.)
 *         example: 2
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddActivitiesRequest'
 *           example:
 *             activities:
 *               - name: "Sunset by the bay"
 *                 time: "05:30 PM"
 *                 description: "Relax by Sorsogon Bay and enjoy the view."
 *                 type: "sightseeing"
 *                 location: "Sorsogon Bay"
 *               - name: "Dinner at local restaurant"
 *                 time: "07:00 PM"
 *                 description: "Enjoy local cuisine at a recommended restaurant."
 *                 type: "meal"
 *                 location: "Sorsogon City"
 *     responses:
 *       200:
 *         description: Activities added successfully
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
 *                   example: "Activities added to day 2"
 *                 data:
 *                   $ref: '#/components/schemas/Trip'
 *       400:
 *         description: Bad request - invalid parameters or empty activities array
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - missing or invalid authentication
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - trip does not belong to user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Trip not found
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
router.post("/trips/:tripId/days/:dayNumber/activities", addActivities);

module.exports = router;

