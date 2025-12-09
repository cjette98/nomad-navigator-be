const { summarizeLinkContent } = require("../services/linkSummaryService");

const summarizeLink = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: "URL is required" });
    }

    const data = await summarizeLinkContent(url);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Error summarizing link:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to summarize link content" });
  }
};

module.exports = { summarizeLink };
