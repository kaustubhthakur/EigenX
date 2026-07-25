const express = require("express");
const router = express.Router();

const verifyToken = require("../middlewares/auth");
const gameController = require("../controllers/game");

router.post(
  "/answer",
  verifyToken,
  gameController.submitAnswer
);

router.post(
  "/end",
  verifyToken,
  gameController.endGame
);

module.exports = router;