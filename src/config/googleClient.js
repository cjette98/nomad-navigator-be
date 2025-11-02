import { VideoIntelligenceServiceClient } from "@google-cloud/video-intelligence";
import { Storage } from "@google-cloud/storage";

export const videoClient = new VideoIntelligenceServiceClient({
  keyFilename: "google-service-key.json",
});

export const storage = new Storage({
  keyFilename: "google-service-key.json",
});
