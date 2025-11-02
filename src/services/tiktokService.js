import axios from "axios";

export const getTikTokVideo = async (videoUrl) => {
  const options = {
    method: "GET",
    url: "https://tiktok-video-downloader-api.p.rapidapi.com/media",
    params: { videoUrl },
    headers: {
      "x-rapidapi-key": process.env.RAPIDAPI_KEY,
      "x-rapidapi-host": "tiktok-video-downloader-api.p.rapidapi.com",
    },
  };

  const response = await axios.request(options);
  const { downloadUrl, caption } = response.data;
  if (!downloadUrl) throw new Error("No downloadable video URL found");
  return { downloadUrl, caption };
};
