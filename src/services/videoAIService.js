const { videoClient } = require("../config/googleClient.js");

const { storage } = require("../config/googleClient.js");

async function testFileAccess() {
  try {
    await storage
      .bucket("nomad-navigator-bucker")
      .file("tiktok_1762158146471.mp4")
      .getMetadata();
    console.log("✅ Service account can access the file");
  } catch (err) {
    console.error("❌ Access error:", err.message);
  }
}

testFileAccess();

const analyzeVideo = async (gcsUri) => {
  const request = {
    inputUri: gcsUri,
    features: ["LABEL_DETECTION", "TEXT_DETECTION", "OBJECT_TRACKING"],
  };

  try {
    const [operation] = await videoClient.annotateVideo(request);
    console.log("⏳ Video analysis in progress...");

    const [result] = await operation.promise();

    console.log(
      "✅ Video intelligence result:",
      JSON.stringify(result, null, 2)
    );

    const annotations = result.annotationResults?.[0];
    if (!annotations) {
      console.warn("⚠️ No annotations found in the result.");
      return { labels: [], texts: [] };
    }

    const labels =
      annotations.segmentLabelAnnotations?.map((x) => x.entity.description) ||
      [];

    const texts = annotations.textAnnotations?.map((x) => x.text) || [];

    console.log("🧠 Extracted Labels:", labels);
    console.log("🧾 Extracted Texts:", texts);

    return { labels, texts };
  } catch (error) {
    console.error("❌ Error analyzing video:", error.message);
    throw error;
  }
};

module.exports = { analyzeVideo };
