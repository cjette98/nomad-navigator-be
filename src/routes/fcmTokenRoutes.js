const express = require("express");
const {
  registerToken,
  getToken,
  deleteToken,
} = require("../controllers/fcmTokenController");

const router = express.Router();

/**
 * @swagger
 * /api/fcm/token:
 *   post:
 *     summary: Register FCM token
 *     description: Registers or updates the FCM token for the authenticated user
 *     tags: [FCM Token]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fcmToken
 *             properties:
 *               fcmToken:
 *                 type: string
 *                 description: The FCM token to register
 *                 example: "dXJhYmxlVG9rZW5Vc2VkSW5FeGFtcGxl"
 *     responses:
 *       200:
 *         description: FCM token registered successfully
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
 *                   example: "FCM token registered successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     fcmToken:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                     updatedAt:
 *                       type: string
 *       400:
 *         description: Bad request - missing or invalid FCM token
 *       401:
 *         description: Unauthorized - missing or invalid authentication
 *       500:
 *         description: Internal server error
 */
router.post("/fcm/token", registerToken);

/**
 * @swagger
 * /api/fcm/token:
 *   get:
 *     summary: Get FCM token
 *     description: Retrieves the FCM token for the authenticated user
 *     tags: [FCM Token]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: FCM token retrieved successfully
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
 *                     id:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     fcmToken:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                     updatedAt:
 *                       type: string
 *       401:
 *         description: Unauthorized - missing or invalid authentication
 *       404:
 *         description: FCM token not found for user
 *       500:
 *         description: Internal server error
 */
router.get("/fcm/token", getToken);

/**
 * @swagger
 * /api/fcm/token:
 *   delete:
 *     summary: Delete FCM token
 *     description: Deletes the FCM token for the authenticated user
 *     tags: [FCM Token]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: FCM token deleted successfully
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
 *                   example: "FCM token deleted successfully"
 *       401:
 *         description: Unauthorized - missing or invalid authentication
 *       404:
 *         description: FCM token not found for user
 *       500:
 *         description: Internal server error
 */
router.delete("/fcm/token", deleteToken);

module.exports = router;

