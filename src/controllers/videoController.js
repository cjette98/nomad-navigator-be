const { getTikTokVideo } = require("../services/tiktokService.js");
const { uploadToGCS,deleteFromGCS } = require("../services/gcsService.js");
const { analyzeVideo } = require("../services/videoAIService.js");
const { generateAISummary } = require("../services/aiSummaryService.js");
const { saveCategorizedContent, getAllCategories } = require("../services/categorizationService.js");

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
    try {
      const categorizationResult = await saveCategorizedContent(
        summary,
        "video",
        url,
        userId
      );
      console.log("✅ Content categorized and saved:", categorizationResult);
    } catch (categorizationError) {
      console.error("⚠️ Error during categorization (continuing anyway):", categorizationError.message);
    }

    return res.json({ success: true, data: summary });
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

module.exports = { analyzeTikTok, getAllInspirations };
