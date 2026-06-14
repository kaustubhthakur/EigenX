const express = require("express");
const router = express.Router();

const verifyToken = require("../middlewares/auth");

const gameController = require("../controllers/game");
router.post(
  "/start",
  verifyToken,
  gameController.startGame
);

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
router.get(
  "/state",
  verifyToken,
  gameController.getGameState
);

router.get(
  "/leaderboard",
  gameController.getLeaderboard
);

module.exports = router;