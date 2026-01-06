const { google } = require("googleapis");
const OpenAI = require("openai");
const pdf = require("pdf-parse");
const {
  extractBookingData,
  extractBookingDataFromImage,
} = require("../services/bookingExtractionService");
const {
  saveConfirmation,
  saveConfirmations,
  getUserConfirmations,
  getTripConfirmations,
  linkConfirmationToTrip,
  linkConfirmationsToTrip,
  getUnlinkedConfirmations,
  linkConfirmationsToTripWithDays,
} = require("../services/travelConfirmationService");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to create OAuth2 client
const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

// Helper: recursively extract plain text from Gmail message
function extractPlainText(payload) {
  let text = "";
  if (!payload) return text;

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    text += Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      text += extractPlainText(part);
    }
  }

  return text;
}

/**
 * Sync Gmail and extract booking confirmations
 * POST /api/travel-confirmations/sync-gmail
 */
const syncGmail = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    // Get OAuth tokens from request (should be stored per user in production)
    // For now, we'll use the existing oauth2Client setup
    // In production, you'd retrieve tokens from database based on userId
    const { accessToken, refreshToken, tripId } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: "Access token is required. Please authenticate with Gmail first.",
      });
    }

    // Create a new OAuth2 client for this request to avoid race conditions
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: "subject:(booking OR reservation OR confirmation OR itinerary OR ticket) newer_than:7d",
      maxResults: 10,
    });

    const messages = listRes.data.messages || [];
    if (messages.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: "No recent booking emails found.",
      });
    }

    const results = [];

    for (const msg of messages) {
      const fullEmail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      });

      const emailText = extractPlainText(fullEmail.data.payload);
      if (!emailText.trim()) continue;

      try {
        const structuredData = await extractBookingData(emailText);
        results.push({
          emailId: msg.id,
          structuredData,
        });
      } catch (error) {
        console.error(`Error processing email ${msg.id}:`, error);
        // Continue with next email even if one fails
      }
    }

    // Save all extracted confirmations to Firestore
    let savedConfirmations = [];
    if (results.length > 0) {
      try {
        const confirmationsData = results.map((result) => result.structuredData);
        savedConfirmations = await saveConfirmations(userId, confirmationsData, tripId || null);
        console.log(`✅ Saved ${savedConfirmations.length} confirmations to Firestore`);
      } catch (saveError) {
        console.error("Error saving confirmations to Firestore:", saveError);
        // Continue even if save fails, still return the extracted data
      }
    }

    // Group by category
    const grouped = results.reduce((acc, { structuredData }) => {
      const category = structuredData.category || "unknown";
      if (!acc[category]) acc[category] = [];
      acc[category].push(structuredData);
      return acc;
    }, {});

    return res.json({
      success: true,
      data: {
        total: results.length,
        grouped,
        results,
        savedConfirmations: savedConfirmations.map((conf) => ({
          id: conf.id,
          tripId: conf.tripId,
        })),
      },
    });
  } catch (error) {
    console.error("Gmail Sync Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to sync Gmail messages.",
      error: error.message,
    });
  }
};

/**
 * Upload PDF and extract booking details
 * POST /api/travel-confirmations/upload-pdf
 */
const uploadPDF = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "PDF file is required.",
      });
    }

    // Check if file is PDF
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({
        success: false,
        message: "File must be a PDF.",
      });
    }

    // Extract text from PDF
    const pdfData = await pdf(req.file.buffer);
    const pdfText = pdfData.text;

    if (!pdfText || pdfText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Could not extract text from PDF. The PDF might be image-based or corrupted.",
      });
    }

    // Extract booking data using AI
    const structuredData = await extractBookingData(pdfText);

    // Save confirmation to Firestore
    let savedConfirmation = null;
    const { tripId } = req.body;
    try {
      savedConfirmation = await saveConfirmation(userId, structuredData, tripId || null);
      console.log("✅ Saved confirmation to Firestore");
    } catch (saveError) {
      console.error("Error saving confirmation to Firestore:", saveError);
      // Continue even if save fails, still return the extracted data
    }

    return res.json({
      success: true,
      data: structuredData,
      savedConfirmation: savedConfirmation
        ? {
            id: savedConfirmation.id,
            tripId: savedConfirmation.tripId,
          }
        : null,
    });
  } catch (error) {
    console.error("PDF Upload Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process PDF.",
      error: error.message,
    });
  }
};

/**
 * Upload image and extract booking details
 * POST /api/travel-confirmations/upload-image
 */
const uploadImage = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image file is required.",
      });
    }

    // Check if file is an image
    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "File must be an image (JPEG, PNG, GIF, or WebP).",
      });
    }

    // Extract booking data from image using OpenAI Vision
    const structuredData = await extractBookingDataFromImage(
      req.file.buffer,
      req.file.mimetype
    );

    // Save confirmation to Firestore
    let savedConfirmation = null;
    const { tripId } = req.body;
    try {
      savedConfirmation = await saveConfirmation(userId, structuredData, tripId || null);
      console.log("✅ Saved confirmation to Firestore");
    } catch (saveError) {
      console.error("Error saving confirmation to Firestore:", saveError);
      // Continue even if save fails, still return the extracted data
    }

    return res.json({
      success: true,
      data: structuredData,
      savedConfirmation: savedConfirmation
        ? {
            id: savedConfirmation.id,
            tripId: savedConfirmation.tripId,
          }
        : null,
    });
  } catch (error) {
    console.error("Image Upload Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process image.",
      error: error.message,
    });
  }
};

/**
 * Get all confirmations for the current user
 * GET /api/travel-confirmations
 */
const getConfirmations = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const confirmations = await getUserConfirmations(userId);

    return res.json({
      success: true,
      data: confirmations,
    });
  } catch (error) {
    console.error("Error getting confirmations:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get confirmations.",
      error: error.message,
    });
  }
};

/**
 * Get confirmations for a specific trip
 * GET /api/travel-confirmations/trip/:tripId
 */
const getConfirmationsByTrip = async (req, res) => {
  try {
    const userId = req.userId;
    const { tripId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Trip ID is required",
      });
    }

    const confirmations = await getTripConfirmations(tripId, userId);

    return res.json({
      success: true,
      data: confirmations,
    });
  } catch (error) {
    console.error("Error getting trip confirmations:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get trip confirmations.",
      error: error.message,
    });
  }
};

/**
 * Get unlinked confirmations (not associated with any trip)
 * GET /api/travel-confirmations/unlinked
 */
const getUnlinked = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const confirmations = await getUnlinkedConfirmations(userId);

    return res.json({
      success: true,
      data: confirmations,
    });
  } catch (error) {
    console.error("Error getting unlinked confirmations:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get unlinked confirmations.",
      error: error.message,
    });
  }
};

/**
 * Link a confirmation to a trip
 * PATCH /api/travel-confirmations/:confirmationId/link
 */
const linkToTrip = async (req, res) => {
  try {
    const userId = req.userId;
    const { confirmationId } = req.params;
    const { tripId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    if (!confirmationId) {
      return res.status(400).json({
        success: false,
        message: "Confirmation ID is required",
      });
    }

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Trip ID is required",
      });
    }

    const confirmation = await linkConfirmationToTrip(confirmationId, tripId, userId);

    return res.json({
      success: true,
      data: confirmation,
    });
  } catch (error) {
    console.error("Error linking confirmation to trip:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to link confirmation to trip.",
      error: error.message,
    });
  }
};

/**
 * Link multiple confirmations to a trip
 * PATCH /api/travel-confirmations/link-multiple
 */
const linkMultipleToTrip = async (req, res) => {
  try {
    const userId = req.userId;
    const { confirmationIds, tripId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    if (!confirmationIds || !Array.isArray(confirmationIds) || confirmationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Confirmation IDs array is required",
      });
    }

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Trip ID is required",
      });
    }

    const confirmations = await linkConfirmationsToTrip(confirmationIds, tripId, userId);

    return res.json({
      success: true,
      data: confirmations,
      message: `Successfully linked ${confirmations.length} confirmation(s) to trip`,
    });
  } catch (error) {
    console.error("Error linking confirmations to trip:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to link confirmations to trip.",
      error: error.message,
    });
  }
};

/**
 * Link confirmations to a trip with specific days
 * POST /api/trips/:tripId/days/:dayNumber/confirmations
 */
const linkConfirmationsToTripDays = async (req, res) => {
  try {
    const userId = req.userId;
    const { tripId, dayNumber } = req.params;
    const { confirmationIds } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Trip ID is required",
      });
    }

    if (!dayNumber) {
      return res.status(400).json({
        success: false,
        message: "Day number is required",
      });
    }

    const dayNum = parseInt(dayNumber, 10);
    if (isNaN(dayNum) || dayNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Day number must be a positive integer",
      });
    }

    if (!confirmationIds || !Array.isArray(confirmationIds) || confirmationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Confirmation IDs array is required and must not be empty",
      });
    }

    // Validate that all confirmation IDs are strings
    if (!confirmationIds.every((id) => typeof id === "string" && id.trim().length > 0)) {
      return res.status(400).json({
        success: false,
        message: "All confirmation IDs must be non-empty strings",
      });
    }

    const confirmations = await linkConfirmationsToTripWithDays(
      confirmationIds,
      tripId,
      [dayNum],
      userId
    );

    if (confirmations.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No confirmations found with the provided IDs or they don't belong to this user",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully linked ${confirmations.length} confirmation(s) to trip for day ${dayNum}`,
      data: confirmations,
    });
  } catch (error) {
    console.error("Error linking confirmations to trip days:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to link confirmations to trip days.",
      error: error.message,
    });
  }
};

module.exports = {
  syncGmail,
  uploadPDF,
  uploadImage,
  getConfirmations,
  getConfirmationsByTrip,
  getUnlinked,
  linkToTrip,
  linkMultipleToTrip,
  linkConfirmationsToTripDays,
};
