const { getTikTokVideo } = require("../services/tiktokService.js");
const { uploadToGCS,deleteFromGCS } = require("../services/gcsService.js");
const { analyzeVideo } = require("../services/videoAIService.js");
const { generateAISummary } = require("../services/aiSummaryService.js");
const { saveCategorizedContent, getAllCategories, deleteInspirationItems, filterInspirations } = require("../services/categorizationService.js");
const { sendInspirationProcessedNotification } = require("../services/pushNotificationService.js");

const analyzeTikTok = async (req, res) => {
  let gcsUri = null;
  let filename = null;
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: User ID not found" });
    }

    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "TikTok URL required" });

    console.log("🎥 Fetching TikTok video info...");
    const { downloadUrl, description } = await getTikTokVideo(url);

    filename = `tiktok_${Date.now()}.mp4`;

    console.log("⬇️ Downloading & uploading video to GCS...");
    gcsUri = await uploadToGCS(downloadUrl, filename);
    // const gcsUri = "gs://nomad-navigator-bucker/tiktok_1762158146471.mp4";

    console.log("🧠 Analyzing video content...");
    console.log("gcsUri", gcsUri);
    const { labels, texts, transcript } = await analyzeVideo(gcsUri);

    console.log("✨ Generating AI summary...");
    const summary = await generateAISummary(labels, texts, transcript, description);
    console.log("✅ Done creating AI summary...");

    // Auto-categorize and save content by location
    console.log("📂 Auto-categorizing content by location...");
    let responseData = summary;
    try {
      const categorizationResult = await saveCategorizedContent(
        summary,
        "video",
        url,
        userId
      );
      console.log("✅ Content categorized and saved:", categorizationResult);
      // Use savedItems with IDs if available, otherwise fall back to original summary
      responseData = categorizationResult.savedItems && categorizationResult.savedItems.length > 0 
        ? categorizationResult.savedItems 
        : summary;

      // Send push notification (fire and forget - don't wait for it)
      const itemCount = categorizationResult.savedItems?.length || summary.length || 0;
      if (itemCount > 0) {
        sendInspirationProcessedNotification(userId, itemCount, "video")
          .catch((error) => {
            // Log error but don't fail the request
            console.error("Failed to send push notification:", error);
          });
      }
    } catch (categorizationError) {
      console.error("⚠️ Error during categorization (continuing anyway):", categorizationError.message);
    }

    return res.json({ success: true, data: responseData });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (gcsUri && filename) {
      console.log("🗑️ Deleting video from GCS...");
      try {
        // Assuming deleteFromGCS takes the filename, e.g., 'tiktok_1762158146471.mp4'
        await deleteFromGCS(filename); 
        console.log("✅ GCS cleanup successful.");
      } catch (cleanupErr) {
        console.error("❌ Failed to clean up GCS file:", cleanupErr.message);
      }
    }
  }
};

const getAllInspirations = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    console.log("📚 Fetching all inspirations...");
    const categories = await getAllCategories(userId);
    
    // Transform the data organized by location
    const organizedByLocation = categories.map((category) => ({
      location: category.location,
      itemCount: category.itemCount,
      items: category.items || [],
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    }));

    // Calculate total items across all categories
    const totalItems = organizedByLocation.reduce(
      (sum, category) => sum + category.itemCount,
      0
    );

    return res.json({
      success: true,
      data: {
        organizedByLocation,
        totalCategories: categories.length,
        totalItems,
      },
    });
  } catch (err) {
    console.error("❌ Error fetching inspirations:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteInspirations = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const { itemIds } = req.body;
    
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "itemIds array is required and must not be empty",
      });
    }

    // Validate that all items in the array are strings
    if (!itemIds.every((id) => typeof id === "string" && id.trim().length > 0)) {
      return res.status(400).json({
        success: false,
        message: "All itemIds must be non-empty strings",
      });
    }

    console.log(`🗑️ Deleting ${itemIds.length} inspiration item(s)...`);
    const result = await deleteInspirationItems(itemIds, userId);

    return res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} inspiration item(s)`,
      data: result,
    });
  } catch (err) {
    console.error("❌ Error deleting inspirations:", err.message);
    
    if (err.message === "None of the inspiration items were found" || err.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: err.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to delete inspiration items",
    });
  }
};

const filterInspirationsController = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    // Get filter parameters from query string
    const { status, tripId, category } = req.query;
    
    const filters = {
      status: status || "All Inspiration",
      tripId: tripId || "all",
      category: category || null,
    };

    console.log("🔍 Filtering inspirations with filters:", filters);
    const result = await filterInspirations(userId, filters);

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("❌ Error filtering inspirations:", err.message);
    
    if (err.message.includes("Invalid status") || err.message.includes("Invalid category")) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to filter inspirations",
    });
  }
};

module.exports = { analyzeTikTok, getAllInspirations, deleteInspirations, filterInspirationsController };
