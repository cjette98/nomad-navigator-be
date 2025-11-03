const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generateAISummary = async (labels, texts, caption) => {
  const prompt = `
You are analyzing a TikTok video about travel, food, or lifestyle.

Use the provided data to infer what the video is about.

Visual Analysis:
- Labels: ${labels.join(", ") || "none"}
- Detected Text: ${texts.join(", ") || "none"}
- Video Caption: ${caption || "none"}

Now, generate a structured JSON output in this format:
{
  "title": "the name of the place, event, or subject featured in the video",
  "description": "a short, natural description (1–2 sentences) based on the title and context",
  "category": "Restaurant | Cafe | Travel | Food | Product | Lifestyle"
}

Rules:
- The title must sound like a real-world place, event, or subject.
- The description must be concise but descriptive.
- Category must be one of the six listed.
- Output only valid JSON, no extra text.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    console.error("❌ JSON parsing failed:", err);
    return { title: "", description: "", category: "" };
  }
};

module.exports = { generateAISummary };
