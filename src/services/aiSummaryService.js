const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generateAISummary = async (labels, texts, caption) => {
  const prompt = `
You are analyzing a TikTok video about travel, food, or lifestyle.

Use the provided data to infer what the video is about. There can be multiple subjects, places, or items mentioned in the labels, detected text, or caption.

Visual Analysis:
- Labels: ${labels.join(", ") || "none"}
- Detected Text: ${texts.join(", ") || "none"}
- Video Caption: ${caption || "none"}

Now, generate a structured JSON array. Each element in the array represents one distinct subject, place, or item found in the video, in this format:
[
  {
    "title": "the name of the place, event, or subject featured in the video",
    "description": "a short, natural description (1–2 sentences) based on the title and context",
    "category": "Restaurant | Cafe | Travel | Food | Product | Lifestyle"
  }
]

Rules:
- Include up to 3 relevant items max.
- Titles must sound like real-world places, events, or subjects.
- Descriptions must be concise but informative.
- Categories must be one of the six listed.
- Output only valid JSON array, no extra text or explanations.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const content = response.choices[0].message.content.trim();
    return JSON.parse(content);
  } catch (err) {
    console.error("❌ JSON parsing failed:", err);
    return [];
  }
};

module.exports = { generateAISummary };
