require("dotenv").config();
const express = require("express");
var cors = require("cors");
const { google } = require("googleapis");
const videoRoutes = require("./routes/videoRoutes");
const OpenAI = require("openai");

console.log("Environment check:", process.env);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/api", videoRoutes);

// -------------------------
// 📧 GMAIL + AI EXTRACTION
// -------------------------
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 1️⃣ Redirect user to Gmail Consent Screen
app.get("/gmail/auth", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
    prompt: "consent",
  });
  res.redirect(url);
});

// 2️⃣ Handle OAuth Callback (Google → Our Server)
app.get("/auth/google/callback", async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    res.send(`
      <h3>✅ Gmail connected successfully!</h3>
      <p>Now you can go to <a href="/gmail/sync">/gmail/sync</a> to fetch booking confirmations.</p>
      <pre>${JSON.stringify(tokens, null, 2)}</pre>
    `);
  } catch (error) {
    console.error("OAuth Error:", error);
    res.status(500).send("Failed to authenticate with Gmail.");
  }
});

// 3️⃣ Sync Booking Confirmation Emails + Use OpenAI
app.get("/gmail/sync", async (req, res) => {
  try {
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Search recent emails with "Booking Confirmation" in subject
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: "subject:(booking OR reservation OR confirmation OR itinerary OR ticket) newer_than:7d",
      maxResults: 3,
    });

    const messages = listRes.data.messages || [];
    if (messages.length === 0)
      return res.json({ message: "No recent booking emails found." });

    const results = [];

    for (const msg of messages) {
      const fullEmail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      });

      const bodyData =
        fullEmail.data.payload.parts?.[0]?.body?.data ||
        fullEmail.data.payload.body?.data;

      if (!bodyData) continue;
      const emailText = Buffer.from(bodyData, "base64").toString("utf-8");

      // Send to OpenAI for structured extraction
      const prompt = `
        Extract structured booking details from this email and return JSON only: 
        {
          "bookingId": string,
          "customerName": string,
          "checkInDate": string,
          "checkOutDate": string,
          "hotelName": string,
          "totalAmount": string,
          "email": string,
          "category" : if hotel, flight, car, restaurant
        }

        Email content:
        """${emailText}"""
      `;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You extract structured booking data from emails.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0,
      });

      let structuredData;
      try {
        structuredData = JSON.parse(completion.choices[0].message.content);
      } catch {
        structuredData = completion.choices[0].message.content;
      }

      results.push({ emailId: msg.id, structuredData });
    }

    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error("Gmail Sync Error:", error);
    res.status(500).json({ error: "Failed to sync Gmail messages." });
  }
});

// Root route with UI
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Generate Inspiration from TT Url link - Playground</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f4f4f4; }
            h1 { color: #333; }
            input[type="text"] { width: 60%; padding: 10px; margin-right: 10px; border-radius: 5px; border: 1px solid #ccc; }
            button { padding: 10px 20px; border: none; border-radius: 5px; background: #007bff; color: white; cursor: pointer; }
            button:hover { background: #0056b3; }
            .result { margin-top: 20px; }
            .item { background: white; padding: 10px; margin-bottom: 10px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .category { font-size: 0.9em; color: #555; }
        </style>
    </head>
    <body>
        <h1>Generate Inspiration from TT url 🔥</h1>
        <input type="text" id="tiktokUrl" placeholder="Paste TikTok URL here..." />
        <button id="generateBtn">Generate</button>

        <div class="result" id="result"></div>

        <script>
            const button = document.getElementById('generateBtn');
            const resultDiv = document.getElementById('result');

            button.addEventListener('click', async () => {
                const url = document.getElementById('tiktokUrl').value.trim();
                if (!url) {
                    alert('Please enter a TikTok URL!');
                    return;
                }

                resultDiv.innerHTML = '<p>Loading...</p>';

                try {
                    const response = await fetch('/api/analyze-tiktok', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url })
                    });

                    const data = await response.json();

                    if (!data.success) {
                        resultDiv.innerHTML = '<p>Error generating inspiration.</p>';
                        return;
                    }

                    resultDiv.innerHTML = data.data.map(item => \`
                        <div class="item">
                            <strong>\${item.title}</strong>
                            <p>\${item.description}</p>
                            <div class="category">Category: \${item.category}</div>
                        </div>
                    \`).join('');
                } catch (err) {
                    console.error(err);
                    resultDiv.innerHTML = '<p>Failed to fetch results.</p>';
                }
            });
        </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
