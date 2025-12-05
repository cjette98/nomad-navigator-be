const { videoClient } = require("../config/googleClient.js");
const util = require("util");

const analyzeVideo = async (gcsUri) => {
  // const request = {
  //   inputUri: gcsUri,
  //   features: ["LABEL_DETECTION", "TEXT_DETECTION", "OBJECT_TRACKING"],
  // };

   const request = {
    inputUri: gcsUri,
    features: ["LABEL_DETECTION", "TEXT_DETECTION", "SPEECH_TRANSCRIPTION"],
  };

  try {
    const [operation] = await videoClient.annotateVideo(request);
    console.log("⏳ Video analysis in progress...");

    const [result] = await operation.promise();

    console.log(
      "✅ Video intelligence result:",
      util.inspect(result, { depth: 5, colors: true })
    );

    console.log(
      "✅ Video intelligence result:",
      JSON.stringify(result, null, 2)
    );

    const annotations = result.annotationResults?.[0];
    if (!annotations) {
      console.warn("⚠️ No annotations found in the result.");
      return { labels: [], texts: [],transcript: [] };
    }

    const labels =
      annotations.segmentLabelAnnotations?.map((x) => x.entity.description) ||
      [];

    const texts = annotations.textAnnotations?.map((x) => x.text) || [];

    const transcript =
      annotations.speechTranscriptions?.map((t) => t.alternatives?.[0]?.transcript) ||
      [];

    console.log("🧠 Extracted Labels:", labels);
    console.log("🧾 Extracted Texts:", texts);
    console.log("🎤 Extracted Transcript:", transcript);

    return { labels, texts,transcript };
  } catch (error) {
    console.error("❌ Error analyzing video:", error.message);
    throw error;
  }
};

module.exports = { analyzeVideo };
