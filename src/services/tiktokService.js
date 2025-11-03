const axios = require("axios");

const getTikTokVideo = async (videoUrl) => {
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(
      videoUrl
    )}`;
    const { data } = await axios.get(apiUrl);

    if (!data || !data.data || !data.data.play) {
      throw new Error("Failed to get downloadable video link");
    }

    const downloadUrl = data.data.play;
    const description = data.data.title;

    return { downloadUrl, description };
  } catch (error) {
    console.error("❌ Error fetching TikTok download info:", error.message);
    throw error;
  }
};

module.exports = { getTikTokVideo };
