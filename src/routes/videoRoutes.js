const express = require("express");
const { analyzeTikTok, getAllInspirations } = require("../controllers/videoController.js");

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

module.exports = router;
