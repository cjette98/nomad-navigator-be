require("dotenv").config();
const express = require("express");
var cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const { google } = require("googleapis");
const rateLimit = require("./middleware/rateLimit");
const videoRoutes = require("./routes/videoRoutes");
const linkRoutes = require("./routes/linkRoutes");
const travelPreferenceRoutes = require("./routes/travelPreferenceRoutes");
const tripSuggestionRoutes = require("./routes/tripSuggestionRoutes");
const tripRoutes = require("./routes/tripRoutes");
const travelConfirmationRoutes = require("./routes/travelConfirmationRoutes");
const fcmTokenRoutes = require("./routes/fcmTokenRoutes");
const { initializeFirebase } = require("./config/database");
const { syncGmail } = require("./controllers/travelConfirmationController");

const app = express();
const PORT = process.env.PORT || 3000;

let getAuth;

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Nomad Navigator API Documentation",
  })
);

// Initialize Firebase
initializeFirebase();
app.use(cors());
app.use(express.json());
app.use(rateLimit());

// Swagger Documentation
// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
//   customCss: '.swagger-ui .topbar { display: none }',
//   customSiteTitle: "Nomad Navigator API Documentation"
// }));

const protectEndpoint = (req, res, next) => {
  if (!getAuth) {
    console.error("Clerk getAuth utility not loaded yet!");
    return res
      .status(503)
      .send("Service Unavailable: Server still initializing.");
  }
  try {
    const auth = getAuth(req);
    console.log(auth);
    if (!auth.userId) {
      return res.status(401).send("Unauthorized: Invalid or missing session.");
    }
    req.userId = auth.userId;
    

    next();
  } catch (error) {
    console.error("Error verifying Clerk session:", error);
    return res.status(401).send("Unauthorized: Session verification failed.");
  }
};

async function loadClerkAndStartServer() {
  try {
    const clerkModule = await import("@clerk/express");

    const { clerkMiddleware, getAuth: importedGetAuth } = clerkModule;
    getAuth = importedGetAuth;

    app.use(clerkMiddleware());
    app.use("/api/inspiration", protectEndpoint, videoRoutes);
    app.use("/api/inspiration", protectEndpoint, linkRoutes);
    app.use("/api", protectEndpoint, travelPreferenceRoutes);
    app.use("/api", protectEndpoint, tripSuggestionRoutes);
    app.use("/api", protectEndpoint, tripRoutes);
    app.use("/api/travel-confirmations", protectEndpoint, travelConfirmationRoutes);
    app.use("/api", protectEndpoint, fcmTokenRoutes);
  } catch (error) {
    console.error("Failed to load Clerk module:", error);
  }
}
loadClerkAndStartServer();

// -------------------------
// 📧 GMAIL + AI EXTRACTION
// -------------------------
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

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

// 3️⃣ Sync Booking Confirmation Emails (uses travelConfirmationController.syncGmail)
app.get("/gmail/sync", async (req, res) => {
  const credentials = oauth2Client.credentials;
  if (!credentials?.access_token) {
    return res.redirect("/gmail/auth");
  }

  const syncReq = {
    userId: req.userId || process.env.GMAIL_DEMO_USER_ID || "gmail-demo-user",
    body: {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || undefined,
      tripId: req.query.tripId || undefined,
    },
  };

  return syncGmail(syncReq, res);
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
                    const response = await fetch('/api/inspiration/analyze-tiktok', {
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
