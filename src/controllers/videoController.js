import axios from "axios";
import { getTikTokVideo } from "../services/tiktokService.js";
import { uploadToGCS } from "../services/gcsService.js";
import { analyzeVideo } from "../services/videoAIService.js";
import { generateAISummary } from "../services/aiSummaryService.js";

export const analyzeTikTok = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "TikTok URL required" });

    console.log("Fetching TikTok video...");
    const { downloadUrl, caption } = await getTikTokVideo(url);

    console.log("Downloading video...");
    const videoStream = await axios({
      method: "GET",
      url: downloadUrl,
      responseType: "stream",
    });

    console.log("Video stream data ===>", videoStream);

    const filename = `tiktok_${Date.now()}.mp4`;
    console.log("Uploading to GCS...", filename);
    const gcsUri = await uploadToGCS(videoStream.data, filename);

    console.log("Analyzing video content...");
    const { labels, texts } = await analyzeVideo(gcsUri);

    console.log("Generating AI summary...");
    const summary = await generateAISummary(labels, texts, caption);

    return res.json({ success: true, data: summary });
  } catch (err) {
    console.log("Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
