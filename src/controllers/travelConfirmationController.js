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
  filterConfirmations,
  formatConfirmationToActivity,
  determineDayFromConfirmation,
  findDuplicateConfirmationForUser,
  checkDuplicateWithAI,
} = require("../services/travelConfirmationService");
const { getTripById, updateDayActivities } = require("../services/tripService");
const { arrangeDayWithConfirmation } = require("../services/autoArrangementService");
const { sendTravelConfirmationProcessedNotification } = require("../services/pushNotificationService");

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
    const nonDuplicateResults = [];
    const duplicateItems = [];

    // Fetch existing confirmations once for duplicate comparison
    let existingConfirmations = [];
    try {
      existingConfirmations = await getUserConfirmations(userId);
    } catch (existingErr) {
      console.error("Failed to fetch existing confirmations for duplicate check:", existingErr);
      existingConfirmations = [];
    }

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

        // AI-based duplicate detection against existing confirmations
        const duplicateCheckResult = await checkDuplicateWithAI(
          structuredData,
          existingConfirmations
        );

        if (duplicateCheckResult.isDuplicate) {
          console.log(
            `⚠️ Detected duplicate confirmation for email ${msg.id}. Duplicate of: ${duplicateCheckResult.duplicateIds.join(
              ", "
            )}`
          );
          duplicateItems.push({
            emailId: msg.id,
            structuredData,
            duplicateIds: duplicateCheckResult.duplicateIds,
          });
        } else {
          results.push({
            emailId: msg.id,
            structuredData,
          });
          nonDuplicateResults.push({
            emailId: msg.id,
            structuredData,
          });

          // Optionally add to in-memory existing list so subsequent messages in this sync run
          // can also be compared against newly accepted confirmations
          existingConfirmations.push({
            id: `pending-${msg.id}`,
            confirmationData: structuredData,
          });
        }
      } catch (error) {
        console.error(`Error processing email ${msg.id}:`, error);
        // Continue with next email even if one fails
      }
    }

    // Save all non-duplicate extracted confirmations to Firestore
    let savedConfirmations = [];
    if (nonDuplicateResults.length > 0) {
      try {
        const confirmationsData = nonDuplicateResults.map(
          (result) => result.structuredData
        );
        savedConfirmations = await saveConfirmations(userId, confirmationsData, tripId || null);
        console.log(`✅ Saved ${savedConfirmations.length} confirmations to Firestore`);
        
        // Send push notification for processed confirmations
        if (savedConfirmations.length > 0) {
          // Determine the most common category for the notification
          const categories = confirmationsData.map(data => data.category).filter(Boolean);
          const mostCommonCategory = categories.length > 0 ? categories[0] : "travel";
          
          // Send notification asynchronously (don't wait for it)
          sendTravelConfirmationProcessedNotification(userId, savedConfirmations.length, mostCommonCategory)
            .catch(error => console.error("Failed to send confirmation notification:", error));
        }
      } catch (saveError) {
        console.error("Error saving confirmations to Firestore:", saveError);
        // Continue even if save fails, still return the extracted data
      }
    }

    // Group by category (all processed, including ones flagged as duplicates)
    const grouped = results.reduce((acc, { structuredData }) => {
      const category = structuredData.category || "unknown";
      if (!acc[category]) acc[category] = [];
      acc[category].push(structuredData);
      return acc;
    }, {});

    const baseResponse = {
      totalProcessed: results.length,
      grouped,
      results,
      nonDuplicateResults,
      duplicateItems,
      savedConfirmations: savedConfirmations.map((conf) => ({
        id: conf.id,
        tripId: conf.tripId,
      })),
    };

    // If any duplicates were found, return an error with duplicate details
    if (duplicateItems.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Some confirmations already exist in your account.",
        data: baseResponse,
      });
    }

    return res.json({
      success: true,
      data: baseResponse,
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

    // AI duplicate detection before saving
    const { isDuplicate, duplicateIds } = await findDuplicateConfirmationForUser(
      userId,
      structuredData
    );

    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: "This confirmation already exists in your account.",
        duplicates: duplicateIds,
      });
    }

    // Save confirmation to Firestore
    let savedConfirmation = null;
    const { tripId } = req.body;
    try {
      savedConfirmation = await saveConfirmation(userId, structuredData, tripId || null);
      console.log("✅ Saved confirmation to Firestore");
      
      // Send push notification for processed confirmation
      const category = structuredData.category || "travel";
      sendTravelConfirmationProcessedNotification(userId, 1, category)
        .catch(error => console.error("Failed to send confirmation notification:", error));
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

    // AI duplicate detection before saving
    const { isDuplicate, duplicateIds } = await findDuplicateConfirmationForUser(
      userId,
      structuredData
    );

    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: "This confirmation already exists in your account.",
        duplicates: duplicateIds,
      });
    }

    // Save confirmation to Firestore
    let savedConfirmation = null;
    const { tripId, autoSlot = true } = req.body;
    try {
      savedConfirmation = await saveConfirmation(userId, structuredData, tripId || null);
      console.log("✅ Saved confirmation to Firestore");
      
      // Send push notification for processed confirmation
      const category = structuredData.category || "travel";
      sendTravelConfirmationProcessedNotification(userId, 1, category)
        .catch(error => console.error("Failed to send confirmation notification:", error));
    } catch (saveError) {
      console.error("Error saving confirmation to Firestore:", saveError);
      // Continue even if save fails, still return the extracted data
    }

    // If tripId is provided, automatically link confirmation to trip days
    let updatedTrip = null;
    if (savedConfirmation && tripId) {
      console.log(`🔗 Starting auto-link process for confirmation ${savedConfirmation.id} to trip ${tripId}`);
      try {
        // Get the trip
        console.log(`📋 Fetching trip ${tripId}...`);
        const trip = await getTripById(tripId, userId);
        if (trip) {
          console.log(`✅ Trip ${tripId} found, determining target day from confirmation date...`);
          
          // Determine day from confirmation date
          let targetDay = await determineDayFromConfirmation(savedConfirmation, trip);
          if (!targetDay) {
            // If can't determine, default to day 1
            console.log(`⚠️  Could not determine day from confirmation date, defaulting to day 1`);
            targetDay = 1;
          } else {
            console.log(`📅 Determined target day: ${targetDay}`);
          }

          // Link confirmation to trip with days
          console.log(`🔗 Linking confirmation ${savedConfirmation.id} to trip ${tripId}, day ${targetDay}...`);
          await linkConfirmationsToTripWithDays(
            [savedConfirmation.id],
            tripId,
            [targetDay],
            userId
          );
          console.log(`✅ Linked confirmation to trip ${tripId}, day ${targetDay}`);

          // Auto-slot confirmation into itinerary if autoSlot is true
          if (autoSlot === true) {
            console.log(`🔄 Auto-sloting confirmation into day ${targetDay}...`);

            // Format confirmation as activity
            const confirmationActivity = formatConfirmationToActivity(savedConfirmation);
            console.log(`📝 Formatted confirmation as activity: ${confirmationActivity.name || 'Unnamed'}`);

            // Arrange day with confirmation
            console.log(`🎯 Arranging activities for day ${targetDay}...`);
            const rearrangedActivities = await arrangeDayWithConfirmation(
              trip,
              targetDay,
              confirmationActivity
            );
            console.log(`✅ Arranged ${rearrangedActivities.length} activity/activities for day ${targetDay}`);

            // Update the trip with rearranged activities
            console.log(`💾 Updating trip with rearranged activities...`);
            updatedTrip = await updateDayActivities(tripId, userId, targetDay, rearrangedActivities);

            console.log(`✅ Auto-sloted confirmation into day ${targetDay}`);
          } else {
            console.log(`⏭️  Auto-slotting disabled (autoSlot=${autoSlot}), skipping itinerary update`);
          }
        } else {
          console.warn(`⚠️  Trip ${tripId} not found, skipping auto-link`);
        }
      } catch (linkError) {
        console.error(`❌ Error linking confirmation to trip days:`, linkError);
        console.error(`   Confirmation ID: ${savedConfirmation?.id}`);
        console.error(`   Trip ID: ${tripId}`);
        console.error(`   Error stack:`, linkError.stack);
        // Continue even if linking fails, still return the saved confirmation
      }
    } else {
      if (!savedConfirmation) {
        console.log(`⏭️  No saved confirmation, skipping auto-link`);
      }
      if (!tripId) {
        console.log(`⏭️  No tripId provided, skipping auto-link`);
      }
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
      ...(updatedTrip && { trip: updatedTrip }),
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
 * Enhanced: Auto-determines day from confirmation date if dayNumber not provided, auto-slots into time block
 */
const linkConfirmationsToTripDays = async (req, res) => {
  try {
    const userId = req.userId;
    const { tripId, dayNumber } = req.params;
    const { confirmationIds, autoSlot = true } = req.body;

    console.log(`🔗 Starting linkConfirmationsToTripDays process`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Trip ID: ${tripId}`);
    console.log(`   Day Number (from params): ${dayNumber || 'not provided'}`);
    console.log(`   Confirmation IDs: ${confirmationIds?.length || 0} provided`);
    console.log(`   Auto-slot: ${autoSlot}`);

    if (!userId) {
      console.error(`❌ Validation failed: User ID not found`);
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    if (!tripId) {
      console.error(`❌ Validation failed: Trip ID is required`);
      return res.status(400).json({
        success: false,
        message: "Trip ID is required",
      });
    }

    if (!confirmationIds || !Array.isArray(confirmationIds) || confirmationIds.length === 0) {
      console.error(`❌ Validation failed: Confirmation IDs array is required and must not be empty`);
      return res.status(400).json({
        success: false,
        message: "Confirmation IDs array is required and must not be empty",
      });
    }

    // Validate that all confirmation IDs are strings
    if (!confirmationIds.every((id) => typeof id === "string" && id.trim().length > 0)) {
      console.error(`❌ Validation failed: All confirmation IDs must be non-empty strings`);
      return res.status(400).json({
        success: false,
        message: "All confirmation IDs must be non-empty strings",
      });
    }

    console.log(`✅ Validation passed for ${confirmationIds.length} confirmation ID(s)`);

    // Get the trip
    console.log(`📋 Fetching trip ${tripId}...`);
    let trip = await getTripById(tripId, userId);
    if (!trip) {
      console.error(`❌ Trip ${tripId} not found`);
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }
    console.log(`✅ Trip ${tripId} found`);

    // Get confirmations by IDs
    console.log(`📋 Fetching confirmations for user ${userId}...`);
    const { getUserConfirmations } = require("../services/travelConfirmationService");
    const allConfirmations = await getUserConfirmations(userId);
    console.log(`   Found ${allConfirmations.length} total confirmation(s) for user`);
    
    const confirmationsToLink = allConfirmations.filter((conf) =>
      confirmationIds.includes(conf.id)
    );
    console.log(`   Matched ${confirmationsToLink.length} confirmation(s) from provided IDs`);

    if (confirmationsToLink.length === 0) {
      console.error(`❌ No confirmations found with the provided IDs or they don't belong to this user`);
      console.error(`   Requested IDs: ${confirmationIds.join(', ')}`);
      return res.status(404).json({
        success: false,
        message: "No confirmations found with the provided IDs or they don't belong to this user",
      });
    }

    // Determine days for each confirmation
    console.log(`📅 Determining target days for ${confirmationsToLink.length} confirmation(s)...`);
    const confirmationsByDay = {};
    
    for (const confirmation of confirmationsToLink) {
      let targetDay = dayNumber ? parseInt(dayNumber, 10) : null;
      console.log(`   Processing confirmation ${confirmation.id}...`);

      // Auto-determine day from confirmation date if not provided
      if (!targetDay) {
        console.log(`   Auto-determining day from confirmation date...`);
        targetDay = await determineDayFromConfirmation(confirmation, trip);
        if (!targetDay) {
          // If can't determine, default to day 1
          console.log(`   ⚠️  Could not determine day from confirmation date, defaulting to day 1`);
          targetDay = 1;
        } else {
          console.log(`   ✅ Determined day: ${targetDay}`);
        }
      } else {
        console.log(`   Using provided day number: ${targetDay}`);
      }

      if (isNaN(targetDay) || targetDay < 1) {
        console.error(`❌ Invalid day number: ${targetDay}`);
        return res.status(400).json({
          success: false,
          message: "Day number must be a positive integer",
        });
      }

      if (!confirmationsByDay[targetDay]) {
        confirmationsByDay[targetDay] = [];
      }
      confirmationsByDay[targetDay].push(confirmation);
      console.log(`   ✅ Assigned confirmation ${confirmation.id} to day ${targetDay}`);
    }

    console.log(`📊 Grouped confirmations by day:`, Object.keys(confirmationsByDay).map(day => `Day ${day}: ${confirmationsByDay[day].length} confirmation(s)`).join(', '));

    // Link confirmations to trip with days
    console.log(`🔗 Linking confirmations to trip with days...`);
    const linkedConfirmations = [];
    for (const [dayStr, confirmations] of Object.entries(confirmationsByDay)) {
      const dayNum = parseInt(dayStr, 10);
      const confIds = confirmations.map((c) => c.id);
      console.log(`   Linking ${confIds.length} confirmation(s) to day ${dayNum}...`);

      const linked = await linkConfirmationsToTripWithDays(confIds, tripId, [dayNum], userId);
      linkedConfirmations.push(...linked);
      console.log(`   ✅ Linked ${linked.length} confirmation(s) to day ${dayNum}`);

      // Auto-slot confirmations into itinerary if autoSlot is true
      if (autoSlot === true) {
        console.log(`🔄 Auto-sloting ${confirmations.length} confirmation(s) into day ${dayNum}...`);

        for (const confirmation of confirmations) {
          console.log(`   Processing confirmation ${confirmation.id} for auto-slotting...`);
          
          // Format confirmation as activity
          const confirmationActivity = formatConfirmationToActivity(confirmation);
          console.log(`   📝 Formatted as activity: ${confirmationActivity.name || 'Unnamed'} (${confirmationActivity.type || 'unknown type'})`);

          // Arrange day with confirmation
          console.log(`   🎯 Arranging activities for day ${dayNum}...`);
          const rearrangedActivities = await arrangeDayWithConfirmation(
            trip,
            dayNum,
            confirmationActivity
          );
          console.log(`   ✅ Arranged ${rearrangedActivities.length} activity/activities for day ${dayNum}`);

          // Update the trip with rearranged activities
          console.log(`   💾 Updating trip with rearranged activities...`);
          trip = await updateDayActivities(tripId, userId, dayNum, rearrangedActivities);
          console.log(`   ✅ Updated trip with activities for day ${dayNum}`);
        }

        console.log(`✅ Auto-sloted confirmations into day ${dayNum}`);
      } else {
        console.log(`⏭️  Auto-slotting disabled (autoSlot=${autoSlot}), skipping itinerary update for day ${dayNum}`);
      }
    }

    // Get updated trip if auto-slotting was performed
    const updatedTrip = autoSlot === true ? trip : null;

    console.log(`✅ Successfully completed linkConfirmationsToTripDays`);
    console.log(`   Total linked: ${linkedConfirmations.length} confirmation(s)`);
    console.log(`   Auto-slotting: ${autoSlot ? 'enabled' : 'disabled'}`);

    return res.status(200).json({
      success: true,
      message: `Successfully linked ${linkedConfirmations.length} confirmation(s) to trip${autoSlot ? " with auto-slotting" : ""}`,
      data: autoSlot ? updatedTrip : linkedConfirmations,
    });
  } catch (error) {
    console.error(`❌ Error linking confirmations to trip days:`, error);
    console.error(`   Trip ID: ${req.params?.tripId}`);
    console.error(`   User ID: ${req.userId}`);
    console.error(`   Confirmation IDs: ${req.body?.confirmationIds?.join(', ') || 'N/A'}`);
    console.error(`   Error stack:`, error.stack);

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

/**
 * Filter confirmations by assignment and category
 * GET /api/travel-confirmations/filter
 */
const getFilteredConfirmations = async (req, res) => {
  try {
    const userId = req.userId;
    const { assignment = "all", category = "all" } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const confirmations = await filterConfirmations(userId, { assignment, category });

    return res.json({
      success: true,
      data: confirmations,
      filters: {
        assignment: assignment || "all",
        category: category || "all",
      },
    });
  } catch (error) {
    console.error("Error filtering confirmations:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to filter confirmations.",
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
  getFilteredConfirmations,
};
