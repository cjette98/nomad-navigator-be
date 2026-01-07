const express = require("express");
const {
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
  deleteTripController,
} = require("../controllers/tripController");
const { linkConfirmationsToTripDays } = require("../controllers/travelConfirmationController");

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

/**
 * @swagger
 * /api/trips/{tripId}/days/{dayNumber}/inspirations:
 *   post:
 *     summary: Add inspiration items to a specific day
 *     description: Adds selected inspiration items to a specific day in the trip itinerary. Inspiration items are formatted into activity format and appended to existing activities for that day.
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
 *             type: object
 *             required:
 *               - itemIds
 *             properties:
 *               itemIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of inspiration item IDs to add to the trip
 *                 example: ["a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6", "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7"]
 *     responses:
 *       200:
 *         description: Inspiration items added successfully
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
 *                   example: "Successfully added 2 inspiration item(s) to day 1"
 *                 data:
 *                   $ref: '#/components/schemas/Trip'
 *       400:
 *         description: Bad request - invalid parameters or empty itemIds array
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
 *         description: Trip not found or no inspiration items found with provided IDs
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
router.post("/trips/:tripId/days/:dayNumber/inspirations", addInspirationsToTrip);

/**
 * @swagger
 * /api/trips/{tripId}/days/{dayNumber}/confirmations:
 *   post:
 *     summary: Link confirmations to a trip with specific day
 *     description: Links travel confirmations to a trip and associates them with a specific day number. Similar to the inspiration module endpoint.
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
 *             type: object
 *             required:
 *               - confirmationIds
 *             properties:
 *               confirmationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of confirmation IDs to link to the trip
 *                 example: ["conf1", "conf2", "conf3"]
 *     responses:
 *       200:
 *         description: Confirmations linked successfully
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
 *                   example: "Successfully linked 3 confirmation(s) to trip for day 1"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Bad request - invalid parameters or empty confirmationIds array
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
 *         description: Forbidden - confirmations do not belong to user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: No confirmations found with provided IDs
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
router.post("/trips/:tripId/days/:dayNumber/confirmations", linkConfirmationsToTripDays);

/**
 * @swagger
 * /api/trips/{tripId}/days/{dayNumber}/activities/{activityId}:
 *   put:
 *     summary: Update a specific activity in a trip day
 *     description: Updates a specific activity by its ID in a trip day. Only provided fields will be updated.
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
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the activity
 *         example: "activity123"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Activity Name"
 *               time:
 *                 type: string
 *                 example: "2:00 PM"
 *               description:
 *                 type: string
 *                 example: "Updated description"
 *               type:
 *                 type: string
 *                 enum: [attraction, restaurant, activity, transport, accommodation, other]
 *                 example: "restaurant"
 *               location:
 *                 type: string
 *                 example: "Updated Location"
 *           example:
 *             name: "Updated Breakfast at Cafe"
 *             time: "9:30 AM"
 *             description: "Updated description of the activity"
 *     responses:
 *       200:
 *         description: Activity updated successfully
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
 *                   example: "Activity updated successfully for day 1"
 *                 data:
 *                   $ref: '#/components/schemas/Trip'
 *       400:
 *         description: Bad request - invalid parameters or missing activity data
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
 *         description: Trip or activity not found
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
router.put("/trips/:tripId/days/:dayNumber/activities/:activityId", updateActivityById);

/**
 * @swagger
 * /api/trips/{tripId}/days/{dayNumber}/activities/{activityId}:
 *   delete:
 *     summary: Delete a specific activity from a trip day
 *     description: Deletes a specific activity by its ID from a trip day.
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
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the activity
 *         example: "activity123"
 *     responses:
 *       200:
 *         description: Activity deleted successfully
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
 *                   example: "Activity deleted successfully from day 1"
 *                 data:
 *                   $ref: '#/components/schemas/Trip'
 *       400:
 *         description: Bad request - invalid parameters
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
 *         description: Trip or activity not found
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
router.delete("/trips/:tripId/days/:dayNumber/activities/:activityId", deleteActivityById);

/**
 * @swagger
 * /api/trips/{tripId}/status:
 *   patch:
 *     summary: Update trip status
 *     description: Updates the status of a trip. Valid status values are draft, planning, active, completed, and archive.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, planning, active, completed, archive]
 *                 description: The new status for the trip
 *                 example: "planning"
 *     responses:
 *       200:
 *         description: Trip status updated successfully
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
 *                   example: "Trip status updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Trip'
 *       400:
 *         description: Bad request - invalid status or missing required fields
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
router.patch("/trips/:tripId/status", updateTripStatusController);

/**
 * @swagger
 * /api/trips/{tripId}/days/{dayNumber}/regenerate:
 *   post:
 *     summary: Regenerate activities for a specific day
 *     description: Regenerates activities for a specific day using AI, while preserving fixed activities (like confirmations) and avoiding duplicates from other days.
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               excludeActivityIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of activity IDs to keep (not regenerate)
 *                 example: ["activity123", "activity456"]
 *     responses:
 *       200:
 *         description: Day activities regenerated successfully
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
 *                   example: "Day 1 activities regenerated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Trip'
 *       400:
 *         description: Bad request - invalid parameters
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Trip not found
 *       500:
 *         description: Internal server error
 */
router.post("/trips/:tripId/days/:dayNumber/regenerate", regenerateDay);

/**
 * @swagger
 * /api/trips/{tripId}/days/{dayNumber}/activities/{activityId}/alternatives:
 *   get:
 *     summary: Get alternative activity recommendations
 *     description: Returns alternative activity options to replace an existing activity. Uses AI to generate relevant alternatives based on the trip context.
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
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the activity to replace
 *         example: "activity123"
 *       - in: query
 *         name: timeBlock
 *         required: false
 *         schema:
 *           type: string
 *           enum: [morning, afternoon, evening]
 *         description: Optional time block filter
 *         example: "morning"
 *     responses:
 *       200:
 *         description: Alternative activities retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       timeBlock:
 *                         type: string
 *                         enum: [morning, afternoon, evening]
 *                       description:
 *                         type: string
 *                       type:
 *                         type: string
 *                       location:
 *                         type: string
 *       400:
 *         description: Bad request - invalid parameters
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Trip or activity not found
 *       500:
 *         description: Internal server error
 */
router.get("/trips/:tripId/days/:dayNumber/activities/:activityId/alternatives", getActivityAlternatives);

/**
 * @swagger
 * /api/trips/{tripId}:
 *   delete:
 *     summary: Delete a trip
 *     description: Soft deletes a trip by setting its status to "archive". The trip will no longer appear in regular trip listings.
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
 *         description: Trip deleted successfully
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
 *                   example: "Trip deleted successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Trip'
 *       400:
 *         description: Bad request - invalid trip ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Trip not found
 *       500:
 *         description: Internal server error
 */
router.delete("/trips/:tripId", deleteTripController);

module.exports = router;

