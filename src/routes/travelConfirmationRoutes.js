const express = require("express");
const multer = require("multer");
const {
  syncGmail,
  uploadPDF,
  uploadImage,
  getConfirmations,
  getConfirmationsByTrip,
  getUnlinked,
  linkToTrip,
  linkMultipleToTrip,
} = require("../controllers/travelConfirmationController");

const router = express.Router();

// Configure multer for memory storage (no disk writes)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * @swagger
 * /api/travel-confirmations/sync-gmail:
 *   post:
 *     summary: Sync Gmail and extract booking confirmations
 *     tags: [Travel Confirmations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accessToken
 *             properties:
 *               accessToken:
 *                 type: string
 *                 description: Gmail OAuth access token
 *               refreshToken:
 *                 type: string
 *                 description: Gmail OAuth refresh token (optional)
 *     responses:
 *       200:
 *         description: Successfully synced and extracted booking confirmations
 *       400:
 *         description: Missing access token
 *       500:
 *         description: Server error
 */
router.post("/sync-gmail", syncGmail);

/**
 * @swagger
 * /api/travel-confirmations/upload-pdf:
 *   post:
 *     summary: Upload PDF and extract booking details
 *     tags: [Travel Confirmations]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 *         description: PDF file containing booking confirmation
 *     responses:
 *       200:
 *         description: Successfully extracted booking details from PDF
 *       400:
 *         description: Invalid file or missing PDF
 *       500:
 *         description: Server error
 */
router.post("/upload-pdf", upload.single("file"), uploadPDF);

/**
 * @swagger
 * /api/travel-confirmations/upload-image:
 *   post:
 *     summary: Upload image/screenshot and extract booking details
 *     tags: [Travel Confirmations]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 *         description: Image file (JPEG, PNG, GIF, WebP) containing booking confirmation
 *     responses:
 *       200:
 *         description: Successfully extracted booking details from image
 *       400:
 *         description: Invalid file or missing image
 *       500:
 *         description: Server error
 */
router.post("/upload-image", upload.single("file"), uploadImage);

/**
 * @swagger
 * /api/travel-confirmations:
 *   get:
 *     summary: Get all travel confirmations for the current user
 *     tags: [Travel Confirmations]
 *     responses:
 *       200:
 *         description: Successfully retrieved confirmations
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", getConfirmations);

/**
 * @swagger
 * /api/travel-confirmations/trip/{tripId}:
 *   get:
 *     summary: Get all confirmations for a specific trip
 *     tags: [Travel Confirmations]
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *         description: The trip ID
 *     responses:
 *       200:
 *         description: Successfully retrieved trip confirmations
 *       400:
 *         description: Missing trip ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/trip/:tripId", getConfirmationsByTrip);

/**
 * @swagger
 * /api/travel-confirmations/unlinked:
 *   get:
 *     summary: Get all unlinked confirmations (not associated with any trip)
 *     tags: [Travel Confirmations]
 *     responses:
 *       200:
 *         description: Successfully retrieved unlinked confirmations
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/unlinked", getUnlinked);

/**
 * @swagger
 * /api/travel-confirmations/{confirmationId}/link:
 *   patch:
 *     summary: Link a confirmation to a trip
 *     tags: [Travel Confirmations]
 *     parameters:
 *       - in: path
 *         name: confirmationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The confirmation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tripId
 *             properties:
 *               tripId:
 *                 type: string
 *                 description: The trip ID to link to
 *     responses:
 *       200:
 *         description: Successfully linked confirmation to trip
 *       400:
 *         description: Missing confirmation ID or trip ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.patch("/:confirmationId/link", linkToTrip);

/**
 * @swagger
 * /api/travel-confirmations/link-multiple:
 *   patch:
 *     summary: Link multiple confirmations to a trip
 *     tags: [Travel Confirmations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - confirmationIds
 *               - tripId
 *             properties:
 *               confirmationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of confirmation IDs
 *               tripId:
 *                 type: string
 *                 description: The trip ID to link to
 *     responses:
 *       200:
 *         description: Successfully linked confirmations to trip
 *       400:
 *         description: Missing confirmation IDs or trip ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.patch("/link-multiple", linkMultipleToTrip);

module.exports = router;
