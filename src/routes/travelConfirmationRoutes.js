const express = require("express");
const multer = require("multer");
const {
  syncGmail,
  uploadPDF,
  uploadImage,
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

module.exports = router;
