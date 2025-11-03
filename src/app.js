require("dotenv").config();
const express = require("express");
var cors = require("cors");
const videoRoutes = require("./routes/videoRoutes");

console.log("Environment check:", process.env);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/api", videoRoutes);

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
