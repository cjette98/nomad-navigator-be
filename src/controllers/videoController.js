import { getTikTokVideo } from "../services/tiktokService.js";
import { uploadToGCS } from "../services/gcsService.js";
import { analyzeVideo } from "../services/videoAIService.js";
import { generateAISummary } from "../services/aiSummaryService.js";

export const analyzeTikTok = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "TikTok URL required" });

    console.log("🎥 Fetching TikTok video info...");
    const { downloadUrl, caption } = await getTikTokVideo(url);

    const filename = `tiktok_${Date.now()}.mp4`;

    console.log("⬇️ Downloading & uploading video to GCS...");
    const gcsUri = await uploadToGCS(downloadUrl, filename); // ✅ now passes URL directly

    console.log("🧠 Analyzing video content...");
    const { labels, texts } = await analyzeVideo(gcsUri);

    console.log("✨ Generating AI summary...");
    const summary = await generateAISummary(labels, texts, caption);
    console.log("✨ Done creating AI summary...");

    return res.json({ success: true, data: summary });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
