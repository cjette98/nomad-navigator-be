const express = require("express");
const { analyzeTikTok } = require("../controllers/videoController.js");

const router = express.Router();

router.post("/analyze-tiktok", analyzeTikTok);

module.exports = router;
