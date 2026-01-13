const OpenAI = require("openai");
const axios = require("axios");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a trip cover photo using DALL-E
 * @param {string} destination - The trip destination
 * @returns {Promise<Buffer>} - The generated image as a buffer
 */
const generateTripCoverPhoto = async (destination) => {
  try {
    if (!destination) {
      throw new Error("Destination is required to generate cover photo");
    }

    const prompt = `Luxury travel photo of ${destination}, stunning landscape, cinematic lighting, high-resolution, vibrant colors, iconic landmark, professional photography, travel magazine style, breathtaking view, golden hour lighting, ultra-detailed, 8k quality`;

    console.log(`🎨 Generating cover photo for destination: ${destination}`);
    console.log(`📝 Prompt: ${prompt}`);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
      style: "vivid",
    });

    const imageUrl = response.data[0].url;

    if (!imageUrl) {
      throw new Error("Failed to generate image URL from DALL-E");
    }

    console.log("⬇️ Downloading generated image...");
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });

    const imageBuffer = Buffer.from(imageResponse.data, "binary");
    console.log(`✅ Image generated and downloaded (${imageBuffer.length} bytes)`);

    return imageBuffer;
  } catch (error) {
    console.error("Error generating trip cover photo:", error);
    throw error;
  }
};

module.exports = { generateTripCoverPhoto };










