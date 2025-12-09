const axios = require("axios");
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Remove scripts/styles and collapse HTML into readable text
const htmlToText = (html) => {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const withoutTags = withoutScripts.replace(/<[^>]+>/g, " ");
  return withoutTags.replace(/\s+/g, " ").trim();
};

const fetchPageText = async (url) => {
  const response = await axios.get(url, {
    headers: {
      // Some sites require a browser-like UA to return full HTML
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    timeout: 15000,
  });

  const text = htmlToText(response.data || "");
  // keep prompt small enough for model while preserving context
  return text.slice(0, 8000);
};

const summarizeLinkContent = async (url) => {
  if (!url) {
    throw new Error("URL is required");
  }

  const pageText = await fetchPageText(url);

  const prompt = `You are a travel content summarizer. Based on the article content below, create a concise JSON payload a user can attach to trip activities.

Source URL: ${url}
Article Content:
${pageText}

Return ONLY valid JSON (no markdown) in this shape:
{
  "sourceUrl": "string",
  "summary": "2-3 sentence overview of the article focused on travel takeaways",
  "keyPoints": ["3-5 short bullet points highlighting places, tips, or logistics"],
  "suggestedActivities": [
    {
      "title": "short activity/place name",
      "description": "1-2 sentence description of what to do/expect",
      "category": "Food | Lodging | Sightseeing | Experience | Logistics | Shopping | Other"
    }
  ]
}

Rules:
- Keep descriptions practical for itinerary building.
- If the content isn't strongly travel-related, infer the most relevant activities or leave suggestedActivities empty.
- Do not invent details not implied by the content.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.5,
  });

  try {
    let content = response.choices[0].message.content.trim();
    content = content.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(content);

    // ensure required fields exist even if model omits some
    return {
      sourceUrl: parsed.sourceUrl || url,
      summary: parsed.summary || "",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      suggestedActivities: Array.isArray(parsed.suggestedActivities)
        ? parsed.suggestedActivities
        : [],
    };
  } catch (err) {
    console.error("❌ Failed to parse link summary JSON:", err);
    console.log("Raw content:", response.choices[0].message.content);
    throw new Error("Failed to parse AI response");
  }
};

module.exports = { summarizeLinkContent };
