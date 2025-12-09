require("dotenv").config();
const express = require("express");
var cors = require("cors");
const { google } = require("googleapis");
const rateLimit = require("./middleware/rateLimit");
const OpenAI = require("openai");
const videoRoutes = require("./routes/videoRoutes");
const linkRoutes = require("./routes/linkRoutes");
const travelPreferenceRoutes = require("./routes/travelPreferenceRoutes");
const tripSuggestionRoutes = require("./routes/tripSuggestionRoutes");
const tripRoutes = require("./routes/tripRoutes");
const { initializeFirebase } = require("./config/database");


const app = express();
const PORT = process.env.PORT || 3000;

let getAuth;


// Initialize Firebase
initializeFirebase();
app.use(cors());
app.use(express.json());
app.use(rateLimit());

const protectEndpoint = (req, res, next) => {
    if (!getAuth) {
        console.error("Clerk getAuth utility not loaded yet!");
        return res.status(503).send('Service Unavailable: Server still initializing.');
    }
    try {
        const auth = getAuth(req); 

        if (!auth.userId) {
            return res.status(401).send('Unauthorized: Invalid or missing session.');
        }
        req.userId = auth.userId; 
        console.log(auth.userId)

        next();

    } catch (error) {
        console.error('Error verifying Clerk session:', error);
        return res.status(401).send('Unauthorized: Session verification failed.');
    }
};

async function loadClerkAndStartServer() {
    try {
        const clerkModule = await import('@clerk/express');
        
        const { clerkMiddleware, getAuth: importedGetAuth } = clerkModule;
        getAuth = importedGetAuth
        
        app.use(clerkMiddleware()) 
        app.use("/api",protectEndpoint, videoRoutes);
        app.use("/api",protectEndpoint, linkRoutes);
        app.use("/api", protectEndpoint, travelPreferenceRoutes);
        app.use("/api", protectEndpoint, tripSuggestionRoutes);
        app.use("/api", protectEndpoint, tripRoutes);

    } catch (error) {
        console.error("Failed to load Clerk module:", error);
    }
}
loadClerkAndStartServer()



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

// Helper: recursively extract plain text from Gmail message
function extractPlainText(payload) {
  let text = "";
  if (!payload) return text;

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    text += Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      text += extractPlainText(part);
    }
  }

  return text;
}

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

    console.log(tokens);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Gmail Connected</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f9f9f9; text-align: center; padding: 40px; }
          h2 { color: #2b7de9; }
          button {
            background: #2b7de9; color: white; border: none; padding: 12px 20px;
            border-radius: 6px; cursor: pointer; font-size: 16px;
          }
          button:hover { background: #1a5fd0; }
        </style>
      </head>
      <body>
        <h2>✅ Gmail Connected Successfully!</h2>
        <p>Click below to sync your emails and generate booking summaries.</p>
        <form action="/gmail/sync" method="GET">
          <button type="submit">SYNC MY EMAILS + Generate Summary from Booking Confirmations</button>
        </form>
      </body>
      </html>
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

    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: "subject:(booking OR reservation OR confirmation OR itinerary OR ticket) newer_than:7d",
      maxResults: 5,
    });

    const messages = listRes.data.messages || [];
    if (messages.length === 0)
      return res.send("<h3>No recent booking emails found.</h3>");

    const results = [];

    for (const msg of messages) {
      const fullEmail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      });

      const emailText = extractPlainText(fullEmail.data.payload);
      if (!emailText.trim()) continue;

      const prompt = `
You are a data extraction assistant that reads booking-related emails and outputs a clean JSON object.
The JSON structure must adapt to the booking category.

You must:
1. Detect the category (hotel, flight, car, restaurant, or unknown).
2. Return a JSON object specific to that category, with only the relevant fields.
3. If data is missing, set the value to null.
4. Return ONLY valid JSON (no explanations or text).

Use the following templates:

📘 Hotel Booking:
{
  "category": "hotel",
  "bookingId": string | null,
  "customerName": string | null,
  "hotelName": string | null,
  "checkInDate": string | null,
  "checkOutDate": string | null,
  "totalAmount": string | null,
  "email": string | null,
  "location": string | null
}

✈️ Flight Booking:
{
  "category": "flight",
  "bookingId": string | null,
  "customerName": string | null,
  "airline": string | null,
  "flightNumber": string | null,
  "departureAirport": string | null,
  "arrivalAirport": string | null,
  "departureDate": string | null,
  "arrivalDate": string | null,
  "totalAmount": string | null,
  "email": string | null
}

🚗 Car Booking:
{
  "category": "car",
  "bookingId": string | null,
  "customerName": string | null,
  "carModel": string | null,
  "rentalCompany": string | null,
  "pickupLocation": string | null,
  "pickupDate": string | null,
  "dropoffDate": string | null,
  "totalAmount": string | null,
  "email": string | null
}

🍽️ Restaurant Booking:
{
  "category": "restaurant",
  "bookingId": string | null,
  "customerName": string | null,
  "restaurantName": string | null,
  "reservationDate": string | null,
  "reservationTime": string | null,
  "numberOfGuests": number | null,
  "totalAmount": string | null,
  "email": string | null
}

❓ Unknown Category:
{
  "category": "unknown",
  "bookingId": string | null,
  "customerName": string | null,
  "email": string | null,
  "summary": string | null
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
        structuredData = {
          category: "unknown",
          summary: "Failed to parse response.",
        };
      }

      results.push({ emailId: msg.id, structuredData });
    }

    const grouped = results.reduce((acc, { structuredData }) => {
      const category = structuredData.category || "unknown";
      if (!acc[category]) acc[category] = [];
      acc[category].push(structuredData);
      return acc;
    }, {});

    const renderCategory = (title, items) => {
      const renderItem = (b) => {
        switch (b.category) {
          case "hotel":
            return `
              <div class="card">
                <h3>${b.hotelName || "Hotel Booking"}</h3>
                <p><strong>Customer:</strong> ${b.customerName || "-"}</p>
                <p><strong>Check-in:</strong> ${b.checkInDate || "-"}</p>
                <p><strong>Check-out:</strong> ${b.checkOutDate || "-"}</p>
                <p><strong>Total:</strong> ${b.totalAmount || "-"}</p>
                <p><strong>Email:</strong> ${b.email || "-"}</p>
              </div>`;
          case "flight":
            return `
              <div class="card">
                <h3>${b.airline || "Flight Booking"}</h3>
                <p><strong>Customer:</strong> ${b.customerName || "-"}</p>
                <p><strong>Flight No:</strong> ${b.flightNumber || "-"}</p>
                <p><strong>Departure:</strong> ${b.departureAirport || "-"}</p>
                <p><strong>Arrival:</strong> ${b.arrivalAirport || "-"}</p>
                <p><strong>Date:</strong> ${b.departureDate || "-"}</p>
                <p><strong>Total:</strong> ${b.totalAmount || "-"}</p>
              </div>`;
          case "car":
            return `
              <div class="card">
                <h3>${b.rentalCompany || "Car Booking"}</h3>
                <p><strong>Customer:</strong> ${b.customerName || "-"}</p>
                <p><strong>Car Model:</strong> ${b.carModel || "-"}</p>
                <p><strong>Pickup:</strong> ${b.pickupLocation || "-"}</p>
                <p><strong>Pickup Date:</strong> ${b.pickupDate || "-"}</p>
                <p><strong>Drop-off:</strong> ${b.dropoffDate || "-"}</p>
                <p><strong>Total:</strong> ${b.totalAmount || "-"}</p>
              </div>`;
          case "restaurant":
            return `
              <div class="card">
                <h3>${b.restaurantName || "Restaurant Booking"}</h3>
                <p><strong>Customer:</strong> ${b.customerName || "-"}</p>
                <p><strong>Reservation Date:</strong> ${
                  b.reservationDate || "-"
                }</p>
                <p><strong>Time:</strong> ${b.reservationTime || "-"}</p>
                <p><strong>Guests:</strong> ${b.numberOfGuests || "-"}</p>
                <p><strong>Total:</strong> ${b.totalAmount || "-"}</p>
              </div>`;
          default:
            return `
              <div class="card">
                <h3>Unknown Booking</h3>
                <p><strong>Customer:</strong> ${b.customerName || "-"}</p>
                <p><strong>Email:</strong> ${b.email || "-"}</p>
                <p><strong>Summary:</strong> ${b.summary || "Not available"}</p>
              </div>`;
        }
      };

      return `
        <h2>${title.toUpperCase()} BOOKINGS</h2>
        ${items.map(renderItem).join("")}
      `;
    };

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Booking Summaries</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f9fafb; padding: 40px; color: #333; }
          h1 { color: #2b7de9; }
          h2 { color: #444; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 30px; }
          .card {
            background: white; padding: 15px 20px; border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 15px;
          }
          .card h3 { margin: 0 0 8px; color: #2b7de9; }
          button {
            background: #2b7de9; color: white; border: none; padding: 12px 20px;
            border-radius: 6px; cursor: pointer; font-size: 16px;
          }
          button:hover { background: #1a5fd0; }
        </style>
      </head>
      <body>
        <h1>📬 Booking Confirmation from Gmail</h1>
        ${Object.entries(grouped)
          .map(([cat, data]) => renderCategory(cat, data))
          .join("")}
        <br><br>
        <form action="/gmail/sync" method="GET">
          <button type="submit">🔁 Resync Emails</button>
        </form>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Gmail Sync Error:", error);
    res.status(500).send("Failed to sync Gmail messages.");
  }
});

// Root route with BOTH UIs
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Generate Inspiration & Gmail Sync</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 40px; background: #f4f4f4; text-align: center; }
            h1 { color: #2b7de9; }
            input[type="text"] { width: 60%; padding: 10px; margin-right: 10px; border-radius: 5px; border: 1px solid #ccc; }
            button { padding: 10px 20px; border: none; border-radius: 5px; background: #2b7de9; color: white; cursor: pointer; font-size: 16px; }
            button:hover { background: #1a5fd0; }
            .result { margin-top: 20px; }
            .item { background: white; padding: 10px; margin-bottom: 10px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .category { font-size: 0.9em; color: #555; }
            hr { margin: 40px 0; border: 0; border-top: 1px solid #ccc; }
        </style>
    </head>
    <body>
        <h1>Generate Inspiration from TT url 🔥</h1>
        <input type="text" id="tiktokUrl" placeholder="Paste TikTok URL here..." />
        <button id="generateBtn">Generate</button>

        <div class="result" id="result"></div>

        <hr>

        <h1>📧 Gmail Booking Sync</h1>
        <p>Connect Gmail to automatically extract booking summaries.</p>
        <form action="/gmail/auth" method="GET">
          <button type="submit">🔗 CONNECT GMAIL ACCOUNT</button>
        </form>

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
  console.log(`🚀 Server is running on port ${PORT}`);
});

module.exports = app;
