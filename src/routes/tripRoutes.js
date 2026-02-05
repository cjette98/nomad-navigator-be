const express = require("express");
const {
  createTrip,
  createTripWithCollaboration,
  getTrips,
  getTrip,
  updateActivities,
  addActivities,
  addInspirationsToTrip,
  updateActivityById,
  deleteActivityById,
  updateTripStatusController,
  updateMultipleTripStatusesController,
  regenerateDay,
  getActivityAlternatives,
  getDayVersions,
  rollbackDayVersion,
  deleteTripController,
  updateTripNameController,
  updateTripCoverPhotoUrlController,
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
 * /api/trips/collaborate:
 *   post:
 *     summary: Create a trip with AI collaboration (user has full control)
 *     description: Creates a new trip where the user has full control over trip details. AI helps by importing bookings from confirmations, saved inspirations, and generating an itinerary in seconds.
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - trip_name
 *               - destination
 *             properties:
 *               trip_name:
 *                 type: string
 *                 description: Name of the trip
 *                 example: "Summer Adventure in Tokyo"
 *               destination:
 *                 type: string
 *                 description: Destination of the trip
 *                 example: "Tokyo, Japan"
 *               description:
 *                 type: string
 *                 description: Description of the trip
 *                 example: "A 7-day adventure exploring Tokyo's culture and cuisine"
 *               start_date:
 *                 type: string
 *                 format: date
 *                 description: Start date of the trip (YYYY-MM-DD)
 *                 example: "2025-07-01"
 *               end_date:
 *                 type: string
 *                 format: date
 *                 description: End date of the trip (YYYY-MM-DD)
 *                 example: "2025-07-07"
 *               durationDays:
 *                 type: integer
 *                 description: Duration of the trip in days
 *                 example: 7
 *               travelers:
 *                 type: string
 *                 description: Number of travelers
 *                 example: "2"
 *               budget:
 *                 type: string
 *                 description: Budget for the trip
 *                 example: "mid"
 *               interestAndVibes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of interests and vibes
 *                 example: ["food", "culture", "history"]
 *               inspirationIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional array of inspiration item IDs to include
 *                 example: ["abc123", "def456"]
 *               confirmationIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional array of confirmation IDs to include
 *                 example: ["conf1", "conf2"]
 *           example:
 *             trip_name: "Summer Adventure in Tokyo"
 *             destination: "Tokyo, Japan"
 *             description: "A 7-day adventure exploring Tokyo's culture and cuisine"
 *             start_date: "2025-07-01"
 *             end_date: "2025-07-07"
 *             durationDays: 7
 *             travelers: "2"
 *             budget: "mid"
 *             interestAndVibes: ["food", "culture", "history"]
 *             inspirationIDs: []
 *             confirmationIDs: []
 *     responses:
 *       201:
 *         description: Trip created successfully with AI collaboration
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
router.post("/trips/collaborate", createTripWithCollaboration);

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
 *               autoArrange:
 *                 type: boolean
 *                 description: Whether to auto-arrange the day to fit new inspirations
 *                 example: false
 *               timeBlock:
 *                 type: string
 *                 enum: [morning, afternoon, evening]
 *                 description: Single timeBlock to apply to all inspiration items (optional)
 *                 example: "morning"
 *               timeBlocks:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *                   enum: [morning, afternoon, evening]
 *                 description: Object mapping itemId to timeBlock for individual timeblocks (optional, takes precedence over timeBlock)
 *                 example:
 *                   "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6": "morning"
 *                   "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7": "afternoon"
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
 * /api/trips/{tripId}/confirmations:
 *   post:
 *     summary: Add confirmations to a trip (AI auto-determines day and time block)
 *     description: Adds travel confirmations to a trip. AI automatically determines the day and time block based on the parsed date and time in the confirmation data, then slots them into the itinerary.
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
 *               - confirmationIds
 *             properties:
 *               confirmationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of confirmation IDs to add to the trip
 *                 example: ["conf1", "conf2", "conf3"]
 *               autoSlot:
 *                 type: boolean
 *                 default: true
 *                 description: "Whether to automatically slot confirmations into the itinerary (default: true)"
 *                 example: true
 *     responses:
 *       200:
 *         description: Confirmations added successfully
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
 *                   example: "Successfully linked 3 confirmation(s) to trip with auto-slotting"
 *                 data:
 *                   $ref: '#/components/schemas/Trip'
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
router.post("/trips/:tripId/confirmations", linkConfirmationsToTripDays);

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
 * /api/trips/status:
 *   patch:
 *     summary: Update status for multiple trips
 *     description: Updates the status of multiple trips. Valid status values are draft, planning, active, completed, and archive.
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tripIds
 *               - status
 *             properties:
 *               tripIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of trip IDs to update
 *                 example: ["trip123", "trip456", "trip789"]
 *               status:
 *                 type: string
 *                 enum: [draft, planning, active, completed, archive]
 *                 description: The new status for all trips
 *                 example: "planning"
 *     responses:
 *       200:
 *         description: Trip statuses updated successfully
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
 *                   example: "Successfully updated status for 3 trip(s)"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Trip'
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       tripId:
 *                         type: string
 *                       error:
 *                         type: string
 *                   description: Array of errors for trips that could not be updated (if any)
 *       400:
 *         description: Bad request - invalid status, missing required fields, or invalid trip IDs
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
 *         description: Forbidden - trips do not belong to user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: No trips found or no trips could be updated
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
router.patch("/trips/status", updateMultipleTripStatusesController);

/**
 * @swagger
 * /api/trips/{tripId}/name:
 *   patch:
 *     summary: Update trip name
 *     description: Updates the name of a trip.
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
 *               - tripName
 *             properties:
 *               tripName:
 *                 type: string
 *                 description: The new name for the trip
 *                 example: "Summer Adventure in Tokyo"
 *     responses:
 *       200:
 *         description: Trip name updated successfully
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
 *                   example: "Trip name updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Trip'
 *       400:
 *         description: Bad request - missing trip name or invalid format
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
router.patch("/trips/:tripId/name", updateTripNameController);

/**
 * @swagger
 * /api/trips/{tripId}/coverPhotoUrl:
 *   patch:
 *     summary: Generate and update trip cover photo
 *     description: Generates a new cover photo using AI based on the trip name and updates the trip's cover photo URL. The cover photo is generated using DALL-E and uploaded to Google Cloud Storage.
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
 *         description: Trip cover photo generated and updated successfully
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
 *                   example: "Trip cover photo generated and updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Trip'
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
 *         description: Internal server error - failed to generate or upload cover photo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch("/trips/:tripId/coverPhotoUrl", updateTripCoverPhotoUrlController);

/**
 * @swagger
 * /api/trips/{tripId}/days/{dayNumber}/regenerate:
 *   post:
 *     summary: Regenerate activities for a specific day
 *     description: "Regenerates activities for a specific day using AI. Fixed activities (like confirmations with isFixed: true) are automatically preserved, and duplicates from other days are avoided."
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
 * /api/trips/{tripId}/days/{dayNumber}/versions:
 *   get:
 *     summary: Get version history for a specific day
 *     description: Returns the version history (up to 2 versions) for activities on a specific day. Versions are automatically saved when activities are regenerated.
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
 *     responses:
 *       200:
 *         description: Version history retrieved successfully
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
 *                       versionNumber:
 *                         type: integer
 *                         description: Version number (1 or 2)
 *                         example: 1
 *                       activities:
 *                         type: array
 *                         description: Array of activities for this version
 *                         items:
 *                           type: object
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: Timestamp when this version was created
 *                         example: "2025-01-15T10:30:00.000Z"
 *       400:
 *         description: Bad request - invalid parameters
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Trip not found
 *       500:
 *         description: Internal server error
 */
router.get("/trips/:tripId/days/:dayNumber/versions", getDayVersions);

/**
 * @swagger
 * /api/trips/{tripId}/days/{dayNumber}/versions/{versionNumber}/rollback:
 *   post:
 *     summary: Rollback to a previous version of activities
 *     description: Restores activities for a specific day to a previous version (1 or 2). The current activities are saved to version history before rollback.
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
 *         name: versionNumber
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 2
 *         description: The version number to rollback to (1 or 2)
 *         example: 1
 *     responses:
 *       200:
 *         description: Successfully rolled back to previous version
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
 *                   example: "Successfully rolled back to version 1 for day 1"
 *                 data:
 *                   $ref: '#/components/schemas/Trip'
 *       400:
 *         description: Bad request - invalid parameters or version number
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Trip not found or version does not exist
 *       500:
 *         description: Internal server error
 */
router.post("/trips/:tripId/days/:dayNumber/versions/:versionNumber/rollback", rollbackDayVersion);

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

