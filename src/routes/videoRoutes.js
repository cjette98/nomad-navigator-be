const express = require("express");
const { analyzeTikTok, getAllInspirations, deleteInspirations, filterInspirationsController } = require("../controllers/videoController.js");

const router = express.Router();

/**
 * @swagger
 * /api/inspiration/analyze-tiktok:
 *   post:
 *     summary: Analyze TikTok video to extract travel inspiration
 *     description: Downloads a TikTok video, analyzes its content (labels, text, transcript), and generates structured inspiration items including places, restaurants, and activities featured in the video
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 description: TikTok video URL
 *                 example: "https://www.tiktok.com/@user/video/1234567890"
 *     responses:
 *       200:
 *         description: Successfully analyzed TikTok video and extracted inspiration items
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TikTokAnalysisResponse'
 *       400:
 *         description: Bad request - missing or invalid URL
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
router.post("/analyze-tiktok", analyzeTikTok);

/**
 * @swagger
 * /api/inspiration:
 *   get:
 *     summary: Get all saved inspirations
 *     description: Retrieves all inspiration items organized by location categories. Returns both organized by location and a flat list of all items.
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved all inspirations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     organizedByLocation:
 *                       type: array
 *                       description: Inspirations grouped by location
 *                       items:
 *                         type: object
 *                         properties:
 *                           location:
 *                             type: string
 *                             example: "Paris"
 *                           itemCount:
 *                             type: number
 *                             example: 5
 *                           items:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 title:
 *                                   type: string
 *                                 description:
 *                                   type: string
 *                                 category:
 *                                   type: string
 *                                 sourceType:
 *                                   type: string
 *                                   enum: [video, link]
 *                                 sourceUrl:
 *                                   type: string
 *                                 addedAt:
 *                                   type: string
 *                     totalCategories:
 *                       type: number
 *                       example: 10
 *                     totalItems:
 *                       type: number
 *                       example: 45
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
router.get("/", getAllInspirations);

/**
 * @swagger
 * /api/inspiration:
 *   delete:
 *     summary: Delete inspiration items in bulk
 *     description: Deletes multiple inspiration items from the user's inspiration collection by providing an array of item IDs
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
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
 *                 description: Array of inspiration item IDs to delete
 *                 example: ["a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6", "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7"]
 *     responses:
 *       200:
 *         description: Successfully deleted the inspiration items
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
 *                   example: "Successfully deleted 2 inspiration item(s)"
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedItems:
 *                       type: array
 *                       description: Array of deleted inspiration items
 *                       items:
 *                         type: object
 *                     deletedCount:
 *                       type: number
 *                       example: 2
 *                     updatedCategories:
 *                       type: array
 *                       description: Array of updated categories
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           location:
 *                             type: string
 *                           itemCount:
 *                             type: number
 *                     notFoundIds:
 *                       type: array
 *                       description: Array of item IDs that were not found (optional, only present if some IDs were not found)
 *                       items:
 *                         type: string
 *       400:
 *         description: Bad request - missing or invalid itemIds array
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
 *       404:
 *         description: None of the inspiration items were found
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
router.delete("/", deleteInspirations);

/**
 * @swagger
 * /api/inspiration/filter:
 *   get:
 *     summary: Filter inspiration items
 *     description: Filter inspiration items by assignment status (Unassigned, Assigned to trip, All Inspiration), trip (all trips or specific trip ID), and category (Restaurant, Activity, Landmark, Shop, Accomodation, Other)
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Unassigned, "Assigned to trip", "All Inspiration"]
 *           default: "All Inspiration"
 *         description: Filter by assignment status
 *         example: "Unassigned"
 *       - in: query
 *         name: tripId
 *         schema:
 *           type: string
 *         description: Filter by trip - use "all" for all trips or provide a specific trip ID
 *         example: "all"
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Restaurant, Activity, Landmark, Shop, Accomodation, Other]
 *         description: "Filter by inspiration category (Note: Accomodation is spelled with one 'm' to match existing data)"
 *         example: "Restaurant"
 *     responses:
 *       200:
 *         description: Successfully filtered inspirations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     organizedByLocation:
 *                       type: array
 *                       description: Filtered inspirations grouped by location
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           location:
 *                             type: string
 *                             example: "Paris"
 *                           itemCount:
 *                             type: number
 *                             example: 3
 *                           items:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: string
 *                                 title:
 *                                   type: string
 *                                 description:
 *                                   type: string
 *                                 category:
 *                                   type: string
 *                                 sourceType:
 *                                   type: string
 *                                   enum: [video, link]
 *                                 sourceUrl:
 *                                   type: string
 *                                 addedAt:
 *                                   type: string
 *                           createdAt:
 *                             type: string
 *                           updatedAt:
 *                             type: string
 *                     totalCategories:
 *                       type: number
 *                       example: 2
 *                     totalItems:
 *                       type: number
 *                       example: 5
 *                     filters:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         tripId:
 *                           type: string
 *                         category:
 *                           type: string
 *                           nullable: true
 *       400:
 *         description: Bad request - invalid filter parameters
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
router.get("/filter", filterInspirationsController);

module.exports = router;
