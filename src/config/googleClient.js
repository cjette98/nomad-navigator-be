const {
  VideoIntelligenceServiceClient,
} = require("@google-cloud/video-intelligence");
const { Storage } = require("@google-cloud/storage");
const fs = require("fs");
const path = require("path");

let keyFilePath = "google-service-key.json"; // default local path

// ✅ If running on Vercel or env includes base64-encoded credentials
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64) {
  try {
    const decodedKey = Buffer.from(
      process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64,
      "base64"
    ).toString("utf-8");

    // Use /tmp directory for write access in serverless environments
    const tempPath = path.join("/tmp", "google-service-key.json");

    fs.writeFileSync(tempPath, decodedKey);
    keyFilePath = tempPath;

    console.log("✅ Google credentials decoded and written to /tmp");
  } catch (error) {
    console.error("❌ Failed to decode Google credentials:", error.message);
  }
}

// Initialize Google clients
const videoClient = new VideoIntelligenceServiceClient({
  keyFilename: keyFilePath,
});

const storage = new Storage({
  keyFilename: keyFilePath,
});

module.exports = { videoClient, storage };
