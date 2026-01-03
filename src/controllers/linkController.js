const { summarizeLinkContent } = require("../services/linkSummaryService");
const { saveCategorizedContent } = require("../services/categorizationService.js");

const summarizeLink = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: "URL is required" });
    }

    const linkData = await summarizeLinkContent(url);
    
    const activities = linkData.suggestedActivities || [];
    
    // Auto-categorize and save content by location
    let responseData = activities;
    if (activities.length > 0) {
      console.log("📂 Auto-categorizing link content by location...");
      try {
        const categorizationResult = await saveCategorizedContent(
          activities,
          "link",
          linkData.sourceUrl || url,
          userId
        );
        console.log("✅ Link content categorized and saved:", categorizationResult);
        // Use savedItems with IDs if available, otherwise fall back to original activities
        responseData = categorizationResult.savedItems && categorizationResult.savedItems.length > 0 
          ? categorizationResult.savedItems 
          : activities;
      } catch (categorizationError) {
        console.error("⚠️ Error during categorization (continuing anyway):", categorizationError.message);
      }
    }
    
    return res.json({ success: true, data: responseData });
  } catch (err) {
    console.error("❌ Error summarizing link:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to summarize link content" });
  }
};

module.exports = { summarizeLink };
