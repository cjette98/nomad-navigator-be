const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generateAISummary = async (labels, texts,transcript, description) => {
  const allTranscript = transcript.join(" ");
  const prompt = `You are analyzing a TikTok video about travel, food, or lifestyle.

Use the provided data to infer what the video is about. There can be multiple subjects, places, or items mentioned in the labels, detected text, or caption.

Visual and Audio Analysis Data:
- Labels (Objects/Scenes): ${labels.join(", ") || "none"}
- Detected Text (OCR): ${texts.join(", ") || "none"}
- Speech Transcript: ${allTranscript || "none"} 👈 New data source
- Video Caption: ${description || "none"}

Now, generate a structured JSON array. Each element in the array represents one distinct subject, place, or item found in the video, in this format:
[
  {
    "title": "the name of the place, event, or subject featured in the video",
    "description": "a short, natural description (1–2 sentences) based on the title and context",
    "category": "Restaurant | Cafe | Travel | Food | Product | Lifestyle"
  }
]

Rules:
- Include up to 5 relevant items max.
- Titles must sound like real-world places, events, or subjects.
- Descriptions must be concise but informative.
- Categories must be one of the six listed.
- **VERY IMPORTANT: Output ONLY the valid JSON array, without any leading/trailing text, explanations, or JSON markdown (e.g., \`\`\`json).**
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  try {
    let content = response.choices[0].message.content.trim();

    // 🧹 Remove Markdown formatting if present
    content = content
      .replace(/```json\s*/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(content);
  } catch (err) {
    console.error("❌ JSON parsing failed:", err);
    console.log("Raw content:", response.choices[0].message.content);
    return [];
  }
};

module.exports = { generateAISummary };
