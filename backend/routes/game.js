const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/auth");
const { getQuestion, submitAnswer, getMyLevelStats } = require("../controllers/game");

router.get("/level-stats", verifyToken, getMyLevelStats);
router.get("/question/:sessionId", verifyToken, getQuestion);
router.post("/answer", verifyToken, submitAnswer);

module.exports = router;