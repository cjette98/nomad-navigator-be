const videoIntelligence = require("@google-cloud/video-intelligence");

// Creates a client using your decoded key file
const client = new videoIntelligence.VideoIntelligenceServiceClient({
  keyFilename: "google-service-key.json", // or /tmp/google-service-key.json on Vercel
});

async function testVideoIntelligence() {
  const gcsUri = "gs://nomad-navigator-bucker/tiktok_1762158146471.mp4"; // ✅ known working video
  const request = {
    inputUri: gcsUri,
    features: ["LABEL_DETECTION", "TEXT_DETECTION", "OBJECT_TRACKING"],
  };

  console.log("Analyzing sample video...");

  const [operation] = await client.annotateVideo(request);
  const [operationResult] = await operation.promise();

  const annotations = operationResult.annotationResults[0];
  const labels = annotations.segmentLabelAnnotations || [];

  if (labels.length === 0) {
    console.log("⚠️ No labels found in result.");
    return;
  }

  console.log(`✅ Found ${labels.length} labels:`);
  labels.slice(0, 10).forEach((label) => {
    console.log(`- ${label.entity.description}`);
  });
}

testVideoIntelligence().catch((err) => {
  console.error("❌ Error:", err.message);
});
