const { summarizeLinkContent } = require("../services/linkSummaryService");
const { saveCategorizedContent } = require("../services/categorizationService.js");

const summarizeLink = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: "URL is required" });
    }

    const linkData = await summarizeLinkContent(url);
    
    const activities = linkData.suggestedActivities || [];
    
    // Auto-categorize and save content by location
    if (activities.length > 0) {
      console.log("📂 Auto-categorizing link content by location...");
      try {
        const categorizationResult = await saveCategorizedContent(
          activities,
          "link",
          linkData.sourceUrl || url
        );
        console.log("✅ Link content categorized and saved:", categorizationResult);
      } catch (categorizationError) {
        console.error("⚠️ Error during categorization (continuing anyway):", categorizationError.message);
      }
    }
    
    return res.json({ success: true, data: activities });
  } catch (err) {
    console.error("❌ Error summarizing link:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to summarize link content" });
  }
};

module.exports = { summarizeLink };
