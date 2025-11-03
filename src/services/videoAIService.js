const { videoClient } = require("../config/googleClient.js");

const analyzeVideo = async (gcsUri) => {
  const request = {
    inputUri: gcsUri,
    features: ["LABEL_DETECTION", "TEXT_DETECTION", "OBJECT_TRACKING"],
  };

  try {
    const [operation] = await videoClient.annotateVideo(request);
    const [result] = await operation.promise();

    const annotations = result.annotationResults[0];
    const labels =
      annotations.segmentLabelAnnotations?.map((x) => x.entity.description) ||
      [];
    const texts = annotations.textAnnotations?.map((x) => x.text) || [];

    return { labels, texts };
  } catch (error) {
    console.error("❌ Error analyzing video:", error.message);
    throw error;
  }
};

module.exports = { analyzeVideo };
