const express = require("express");
const router = express.Router();

const verifyToken = require("../middlewares/auth");
const { getQuestion, submitAnswer } = require("../controllers/game");

router.get("/question/:sessionId", verifyToken, getQuestion);
router.post("/answer", verifyToken, submitAnswer);

module.exports = router;