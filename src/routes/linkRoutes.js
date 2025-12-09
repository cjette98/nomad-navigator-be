const express = require("express");
const { summarizeLink } = require("../controllers/linkController");

const router = express.Router();

router.post("/summarize-link", summarizeLink);

module.exports = router;
