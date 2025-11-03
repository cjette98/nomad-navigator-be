require("dotenv").config();
const express = require("express");
var cors = require("cors");
const videoRoutes = require("./routes/videoRoutes");

console.log("Environment check:", process.env);

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.use("/api", videoRoutes);

app.get("/", (req, res) => {
  console.log("✅ Root route hit!");
  res.send("Nomad Navigator API is running 🚀");
});

module.exports = app;
