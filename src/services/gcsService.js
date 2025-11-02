import { storage } from "../config/googleClient.js";

export const uploadToGCS = async (videoStream, filename) => {
  const bucket = storage.bucket(process.env.GCS_BUCKET);
  const file = bucket.file(filename);

  return new Promise((resolve, reject) => {
    const writeStream = file.createWriteStream({
      metadata: { contentType: "video/mp4" },
      resumable: false,
    });

    videoStream
      .pipe(writeStream)
      .on("finish", () => resolve(`gs://${process.env.GCS_BUCKET}/${filename}`))
      .on("error", reject);
  });
};
