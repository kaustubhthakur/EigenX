const Duel = require("../models/Duel");
const Game = require("../models/Game");
const User = require("../models/User");
const { generateQuestion } = require("./game"); // requires the one-line export noted below

const LEVEL_RANGE = 5;

exports.joinDuel = async (req, res) => {
  try {
    const { configurationId } = req.body;

    if (!configurationId) {
      return res.status(400).json({
        success: false,
        message: "configurationId is required"
      });
    }

    const me = await User.getUserWithLevel(req.user.id);

    if (!me) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const minLevel = me.level - LEVEL_RANGE;
    const maxLevel = me.level + LEVEL_RANGE;

    const duel = await Duel.matchOpponent(req.user.id, configurationId, minLevel, maxLevel);

    if (duel) {
      return res.status(200).json({
        success: true,
        matched: true,
        duel
      });
    }

    await Duel.joinQueue(req.user.id, configurationId);

    return res.status(200).json({
      success: true,
      matched: false,
      message: "Waiting for an opponent"
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Poll this after joinDuel returns matched: false, to find out once someone matches you.
exports.getDuelStatus = async (req, res) => {
  try {
    const queueEntry = await Duel.getQueueStatus(req.user.id);

    if (!queueEntry) {
      return res.status(404).json({ success: false, message: "Not in queue" });
    }

    if (!queueEntry.matched) {
      return res.status(200).json({ success: true, matched: false });
    }

    const duel = await Duel.getDuel(queueEntry.duel_id);

    return res.status(200).json({ success: true, matched: true, duel });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.leaveDuelQueue = async (req, res) => {
  try {
    await Duel.leaveQueue(req.user.id);
    return res.status(200).json({ success: true, message: "Left queue" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getQuestion = async (req, res) => {
  try {
    const { duelId } = req.params;

    const duel = await Duel.getDuel(duelId);

    if (!duel || duel.is_finished) {
      return res.status(404).json({ success: false, message: "Duel not found" });
    }

    if (duel.player1_id !== req.user.id && duel.player2_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not a participant in this duel" });
    }

    const elapsed = Math.floor(
      (Date.now() - new Date(duel.started_at).getTime()) / 1000
    );

    if (elapsed >= duel.timer) {
      const finished = await Duel.finishDuel(duel.id);
      return res.status(200).json({
        success: true,
        gameOver: true,
        player1Score: finished.player1_score,
        player2Score: finished.player2_score,
        winnerId: finished.winner_id
      });
    }

    let currentQuestion = duel.current_question;

 
    if (!currentQuestion) {
      const rule = await Game.getRandomArithmetic(duel.level);
      const arithmetic = generateQuestion(rule);
      const updated = await Duel.saveCurrentQuestion(duel.id, arithmetic.question, arithmetic.answer);
      currentQuestion = updated.current_question;
    }

    return res.status(200).json({
      success: true,
      question: currentQuestion,
      player1Score: duel.player1_score,
      player2Score: duel.player2_score,
      remainingTime: duel.timer - elapsed
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitAnswer = async (req, res) => {
  try {
    const { duelId, answer } = req.body;

    const duel = await Duel.getDuel(duelId);

    if (!duel || duel.is_finished) {
      return res.status(404).json({ success: false, message: "Duel not found" });
    }

    const isPlayer1 = duel.player1_id === req.user.id;
    const isPlayer2 = duel.player2_id === req.user.id;

    if (!isPlayer1 && !isPlayer2) {
      return res.status(403).json({ success: false, message: "Not a participant in this duel" });
    }

    const elapsed = Math.floor(
      (Date.now() - new Date(duel.started_at).getTime()) / 1000
    );

    if (elapsed >= duel.timer) {
      const finished = await Duel.finishDuel(duel.id);
      return res.status(200).json({
        success: true,
        gameOver: true,
        player1Score: finished.player1_score,
        player2Score: finished.player2_score,
        winnerId: finished.winner_id
      });
    }

    if (!duel.current_question) {
      return res.status(409).json({
        success: false,
        message: "No active question for this duel — fetch a question first"
      });
    }

    const alreadyAnswered = isPlayer1 ? duel.player1_answered : duel.player2_answered;

    if (alreadyAnswered) {
      return res.status(409).json({
        success: false,
        message: "Already answered this question — waiting for opponent"
      });
    }

    let myScore = isPlayer1 ? duel.player1_score : duel.player2_score;
    let correct = false;

    if (Number(answer) === Number(duel.current_answer)) {
      myScore++;
      correct = true;
      await Duel.updateScore(duel.id, req.user.id, myScore);
    }

    const updated = await Duel.markAnswered(duel.id, req.user.id);
    const opponentAnswered = isPlayer1 ? updated.player2_answered : updated.player1_answered;

 
    if (updated.player1_answered && updated.player2_answered) {
      await Duel.clearCurrentQuestion(duel.id);
    }

    return res.status(200).json({
      success: true,
      correct,
      score: myScore,
      opponentAnswered,
      nextQuestion: true
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};



exports.challengeFriend = async (req, res) => {
  try {
    const { friendId, configurationId } = req.body;

    if (!friendId || !configurationId) {
      return res.status(400).json({
        success: false,
        message: "friendId and configurationId are required"
      });
    }

    if (friendId === req.user.id) {
      return res.status(400).json({ success: false, message: "You can't challenge yourself" });
    }

    const areFriends = await Duel.areFriends(req.user.id, friendId);

    if (!areFriends) {
      return res.status(403).json({ success: false, message: "You can only challenge a friend" });
    }

    const friend = await User.getUser(friendId);

    if (!friend || !friend.is_online) {
      return res.status(409).json({ success: false, message: "This friend isn't online right now" });
    }

    const existing = await Duel.getPendingChallengeBetween(req.user.id, friendId);

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "You already have a pending challenge to this friend"
      });
    }

    const challenge = await Duel.createChallenge(req.user.id, friendId, configurationId);

    return res.status(200).json({ success: true, challenge });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};


exports.getIncomingChallenges = async (req, res) => {
  try {
    const challenges = await Duel.getIncomingChallenges(req.user.id);
    return res.status(200).json({ success: true, challenges });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.respondToChallenge = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { accept } = req.body;

    const challenge = await Duel.getChallenge(challengeId);

    if (!challenge || challenge.status !== "pending") {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }

    if (challenge.challenged_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "This challenge isn't yours to respond to" });
    }

    if (!accept) {
      const declined = await Duel.respondToChallenge(challenge.id, "declined");
      return res.status(200).json({ success: true, challenge: declined });
    }

    const duel = await Duel.createDuel(
      challenge.challenger_id,
      challenge.challenged_id,
      challenge.configuration_id
    );

    const accepted = await Duel.respondToChallenge(challenge.id, "accepted", duel.id);

    return res.status(200).json({ success: true, challenge: accepted, duel });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.cancelChallenge = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const cancelled = await Duel.cancelChallenge(challengeId, req.user.id);

    if (!cancelled) {
      return res.status(404).json({ success: false, message: "No pending challenge found to cancel" });
    }

    return res.status(200).json({ success: true, challenge: cancelled });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};