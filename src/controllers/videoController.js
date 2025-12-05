const { getTikTokVideo } = require("../services/tiktokService.js");
const { uploadToGCS,deleteFromGCS } = require("../services/gcsService.js");
const { analyzeVideo } = require("../services/videoAIService.js");
const { generateAISummary } = require("../services/aiSummaryService.js");

const analyzeTikTok = async (req, res) => {
  let gcsUri = null;
  let filename = null;
  try {
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

module.exports = { analyzeTikTok };
