import express from "express";
import { analyzeTikTok } from "../controllers/videoController.js";

const router = express.Router();

router.post("/analyze-tiktok", analyzeTikTok);

export default router;
