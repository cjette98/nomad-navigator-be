const express = require("express");
const { summarizeLink } = require("../controllers/linkController");

const router = express.Router();

/**
 * @swagger
 * /api/inspiration/summarize-link:
 *   post:
 *     summary: Summarize travel blog or article link
 *     description: Parses a travel blog or article URL, extracts key information, and generates a summary with suggested activities that can be attached to trip itineraries
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
 *                 description: URL of the travel blog post or article to summarize
 *                 example: "https://example.com/travel-blog-post"
 *     responses:
 *       200:
 *         description: Successfully summarized link and extracted travel information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LinkSummaryResponse'
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
router.post("/summarize-link", summarizeLink);

module.exports = router;
