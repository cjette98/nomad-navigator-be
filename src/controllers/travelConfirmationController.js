const { google } = require("googleapis");
const OpenAI = require("openai");
const pdf = require("pdf-parse");
const {
  extractBookingData,
  extractBookingDataFromImage,
} = require("../services/bookingExtractionService");

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
    // Get OAuth tokens from request (should be stored per user in production)
    // For now, we'll use the existing oauth2Client setup
    // In production, you'd retrieve tokens from database based on userId
    const { accessToken, refreshToken } = req.body;

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

    return res.json({
      success: true,
      data: structuredData,
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

    return res.json({
      success: true,
      data: structuredData,
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

module.exports = {
  syncGmail,
  uploadPDF,
  uploadImage,
};
