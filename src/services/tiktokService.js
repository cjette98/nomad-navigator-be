const axios = require("axios");

const getTikTokVideo = async (videoUrl) => {
  const options = {
    method: "GET",
    url: "https://tiktok-video-downloader-api.p.rapidapi.com/media",
    params: { videoUrl },
    headers: {
      "x-rapidapi-key": process.env.RAPIDAPI_KEY,
      "x-rapidapi-host": "tiktok-video-downloader-api.p.rapidapi.com",
    },
  };

  try {
    const response = await axios.request(options);
    const { downloadUrl, description } = response.data;

    if (!downloadUrl) {
      throw new Error("No downloadable video URL found");
    }

    return { downloadUrl, description };
  } catch (error) {
    console.error("❌ Error fetching TikTok video:", error.message);
    throw error;
  }
};

module.exports = { getTikTokVideo };
