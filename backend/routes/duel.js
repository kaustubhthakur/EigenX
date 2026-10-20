
const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/auth");

const {
  joinDuel,
  getDuelStatus,
  leaveDuelQueue,
  getQuestion,
  submitAnswer,
  challengeFriend,
  getIncomingChallenges,
  respondToChallenge,
  cancelChallenge,
  getDuelById,
  
} = require("../controllers/duel");

router.post("/join", verifyToken, joinDuel);
router.get("/status", verifyToken, getDuelStatus);
router.delete("/queue", verifyToken, leaveDuelQueue);

router.post("/challenge", verifyToken, challengeFriend);
router.get("/challenges", verifyToken, getIncomingChallenges);
router.post(
  "/challenges/:challengeId/respond",
  verifyToken,
  respondToChallenge
);
router.delete("/challenges/:challengeId", verifyToken, cancelChallenge);

router.get("/question/:duelId", verifyToken, getQuestion);


router.get("/:duelId", verifyToken, getDuelById);

router.post("/answer", verifyToken, submitAnswer);
router.get("/:duelId", verifyToken, getDuelById);
module.exports = router;
