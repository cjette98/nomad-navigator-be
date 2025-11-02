import { videoClient } from "../config/googleClient.js";

export const analyzeVideo = async (gcsUri) => {
  const request = {
    inputUri: gcsUri,
    features: ["LABEL_DETECTION", "TEXT_DETECTION", "OBJECT_TRACKING"],
  };

  const [operation] = await videoClient.annotateVideo(request);
  const [result] = await operation.promise();

  const annotations = result.annotationResults[0];
  const labels =
    annotations.segmentLabelAnnotations?.map((x) => x.entity.description) || [];
  const texts = annotations.textAnnotations?.map((x) => x.text) || [];

  return { labels, texts };
};
