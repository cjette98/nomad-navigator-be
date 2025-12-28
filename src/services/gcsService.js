const { storage } = require("../config/googleClient");
const axios = require("axios");

const deleteFromGCS = async (filename) => {
  const bucket = storage.bucket(process.env.GCS_BUCKET);
  await bucket.file(filename).delete();
};

const uploadToGCS = async (downloadUrl, filename) => {
  console.log("Download URL -->", downloadUrl);

  const bucket = storage.bucket(process.env.GCS_BUCKET);
  const file = bucket.file(filename);

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  };

  console.log("⬇️ Downloading & uploading video to GCS...");
  const totalStart = Date.now();

  const downloadStart = Date.now();
  console.log("⬇️ Downloading TikTok video...");

  const response = await axios.get(downloadUrl, {
    responseType: "stream",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "video/mp4,video/*;q=0.9,*/*;q=0.8",
      Referer: "https://www.tiktok.com/",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  console.log("⬆️ Uploading to GCS (streaming, resumable)...");
  const uploadStart = Date.now();

  await new Promise((resolve, reject) => {
    const gcsStream = file.createWriteStream({
      resumable: true,
      gzip: false, // ✅ don't compress binary files
      metadata: { contentType: "video/mp4" },
    });

    response.data
      .on("end", () => {
        const downloadDuration = Date.now() - downloadStart;
        console.log(
          `✅ Download complete in ${formatDuration(downloadDuration)}`
        );
      })
      .pipe(gcsStream)
      .on("finish", () => {
        const uploadDuration = Date.now() - uploadStart;
        console.log(`✅ Upload complete in ${formatDuration(uploadDuration)}`);
        resolve();
      })
      .on("error", (err) => {
        console.error("❌ Stream error:", err.message);
        reject(err);
      });
  });

  const totalDuration = Date.now() - totalStart;
  console.log(`⏱️ Total process time: ${formatDuration(totalDuration)}`);

  return `gs://${process.env.GCS_BUCKET}/${filename}`;
};

/**
 * Upload an image buffer to Google Cloud Storage
 * @param {Buffer} imageBuffer - The image buffer to upload
 * @param {string} filename - The filename to use in GCS
 * @returns {Promise<string>} - The GCS URI (gs://bucket/filename)
 */
const uploadImageToGCS = async (imageBuffer, filename) => {
  try {
    const bucket = storage.bucket(process.env.GCS_BUCKET);
    const file = bucket.file(filename);

    console.log(`⬆️ Uploading image to GCS: ${filename}`);

    await new Promise((resolve, reject) => {
      const gcsStream = file.createWriteStream({
        resumable: false,
        gzip: false,
        metadata: { contentType: "image/png" },
      });

      gcsStream
        .on("finish", () => {
          console.log(`✅ Image upload complete: ${filename}`);
          resolve();
        })
        .on("error", (err) => {
          console.error("❌ Image upload error:", err.message);
          reject(err);
        });

      // Write the buffer to the stream
      gcsStream.end(imageBuffer);
    });

    return `gs://${process.env.GCS_BUCKET}/${filename}`;
  } catch (error) {
    console.error("Error uploading image to GCS:", error);
    throw error;
  }
};

/**
 * Convert a gs:// URI to a signed HTTP URL that can be used in Expo/React Native
 * @param {string} gsUri - The GCS URI (e.g., gs://bucket-name/path/to/file.png)
 * @param {number} expiresInHours - Number of hours until the URL expires (default: 24 * 7 = 7 days)
 * @returns {Promise<string>} - The signed HTTP URL
 */
const getSignedUrl = async (gsUri, expiresInHours = 24 * 7) => {
  try {
    if (!gsUri || !gsUri.startsWith("gs://")) {
      return gsUri; // Return as-is if not a gs:// URI
    }

    // Extract bucket and filename from gs:// URI
    // Format: gs://bucket-name/path/to/file.png
    const uriParts = gsUri.replace("gs://", "").split("/");
    const bucketName = uriParts[0];
    const filename = uriParts.slice(1).join("/");

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filename);

    // Generate signed URL that expires in specified hours
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + expiresInHours * 60 * 60 * 1000, // Convert hours to milliseconds
    });

    return url;
  } catch (error) {
    console.error("Error generating signed URL:", error);
    // Return original URI if signing fails (graceful degradation)
    return gsUri;
  }
};

module.exports = { uploadToGCS, deleteFromGCS, uploadImageToGCS, getSignedUrl };
