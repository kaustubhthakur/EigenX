
const Duel = require("../models/Duel");
const Game = require("../models/Game");
const User = require("../models/User");
const { generateQuestion } = require("./game");

const LEVEL_RANGE = 5;

const sameId = (a, b) =>
  a != null && b != null && String(a) === String(b);

const isValidId = (value) =>
  (typeof value === "string" && value.trim().length > 0) ||
  (typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0);

const getElapsedSeconds = (startedAt) => {
  const start = new Date(startedAt).getTime();

  if (!Number.isFinite(start)) {
    throw new Error("Invalid duel start time");
  }

  return Math.max(0, Math.floor((Date.now() - start) / 1000));
};

const getGameOverResponse = (duel) => ({
  success: true,
  gameOver: true,
  player1Score: duel.player1_score,
  player2Score: duel.player2_score,
  winnerId: duel.winner_id
});

const getParticipant = (duel, userId) => {
  if (sameId(duel.player1_id, userId)) return 1;
  if (sameId(duel.player2_id, userId)) return 2;
  return 0;
};

exports.joinDuel = async (req, res) => {
  try {
    const { configurationId } = req.body;
    const userId = req.user.id;

    if (!isValidId(configurationId)) {
      return res.status(400).json({
        success: false,
        message: "Valid configurationId is required"
      });
    }

    const me = await User.getUserWithLevel(userId);

    if (!me) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (!Number.isFinite(Number(me.level))) {
      return res.status(409).json({
        success: false,
        message: "User level is not configured"
      });
    }

    const minLevel = Number(me.level) - LEVEL_RANGE;
    const maxLevel = Number(me.level) + LEVEL_RANGE;

    const duel = await Duel.matchOpponent(
      userId,
      configurationId,
      minLevel,
      maxLevel
    );

    if (duel) {
      return res.status(200).json({
        success: true,
        matched: true,
        duel
      });
    }

    await Duel.joinQueue(userId, configurationId);

    return res.status(200).json({
      success: true,
      matched: false,
      message: "Waiting for an opponent"
    });
  } catch (err) {
    console.error("joinDuel error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to join duel queue"
    });
  }
};

exports.getDuelStatus = async (req, res) => {
  try {
    const queueEntry = await Duel.getQueueStatus(req.user.id);

    if (!queueEntry) {
      return res.status(404).json({
        success: false,
        message: "Not in queue"
      });
    }

    if (!queueEntry.matched || !queueEntry.duel_id) {
      return res.status(200).json({
        success: true,
        matched: false
      });
    }

    const duel = await Duel.getDuel(queueEntry.duel_id);

    if (!duel) {
      return res.status(404).json({
        success: false,
        message: "Matched duel not found"
      });
    }

    if (!getParticipant(duel, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Not a participant in this duel"
      });
    }

    return res.status(200).json({
      success: true,
      matched: true,
      duel
    });
  } catch (err) {
    console.error("getDuelStatus error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve duel status"
    });
  }
};

exports.leaveDuelQueue = async (req, res) => {
  try {
    await Duel.leaveQueue(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Left queue"
    });
  } catch (err) {
    console.error("leaveDuelQueue error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to leave duel queue"
    });
  }
};

exports.getQuestion = async (req, res) => {
  try {
    const { duelId } = req.params;

    if (!isValidId(duelId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid duelId"
      });
    }

    const duel = await Duel.getDuel(duelId);

    if (!duel) {
      return res.status(404).json({
        success: false,
        message: "Duel not found"
      });
    }

    if (duel.is_finished) {
      return res.status(200).json(getGameOverResponse(duel));
    }

    const participant = getParticipant(duel, req.user.id);

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: "Not a participant in this duel"
      });
    }

    const elapsed = getElapsedSeconds(duel.started_at);
    const timer = Number(duel.timer);

    if (!Number.isFinite(timer) || timer <= 0) {
      return res.status(500).json({
        success: false,
        message: "Invalid duel timer"
      });
    }

    if (elapsed >= timer) {
      const finished = await Duel.finishDuel(duel.id);

      return res.status(200).json(
        getGameOverResponse(finished)
      );
    }

    const alreadyAnswered = participant === 1
      ? duel.player1_answered
      : duel.player2_answered;

    if (alreadyAnswered) {
      return res.status(200).json({
        success: true,
        waitingForOpponent: true,
        player1Score: duel.player1_score,
        player2Score: duel.player2_score,
        remainingTime: Math.max(0, timer - elapsed)
      });
    }

    let currentQuestion = duel.current_question;

    if (!currentQuestion) {
      const rule = await Game.getRandomArithmetic(duel.level);

      if (!rule) {
        return res.status(500).json({
          success: false,
          message: "No arithmetic rule available"
        });
      }

      const arithmetic = generateQuestion(rule);

      if (
        !arithmetic ||
        arithmetic.question == null ||
        arithmetic.answer == null ||
        !Number.isFinite(Number(arithmetic.answer))
      ) {
        throw new Error("Invalid generated arithmetic question");
      }

      const updated = await Duel.saveCurrentQuestion(
        duel.id,
        arithmetic.question,
        arithmetic.answer
      );

      currentQuestion = updated.current_question;
    }

    if (currentQuestion == null) {
      throw new Error("Failed to save current question");
    }

    return res.status(200).json({
      success: true,
      question: currentQuestion,
      player1Score: duel.player1_score,
      player2Score: duel.player2_score,
      remainingTime: Math.max(0, timer - elapsed)
    });
  } catch (err) {
    console.error("getQuestion error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve question"
    });
  }
};

exports.submitAnswer = async (req, res) => {
  try {
    const { duelId, answer } = req.body;

    if (!isValidId(duelId)) {
      return res.status(400).json({
        success: false,
        message: "Valid duelId is required"
      });
    }

    if (
      (typeof answer !== "number" && typeof answer !== "string") ||
      String(answer).trim() === "" ||
      !Number.isFinite(Number(answer))
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid numeric answer is required"
      });
    }

    const duel = await Duel.getDuel(duelId);

    if (!duel) {
      return res.status(404).json({
        success: false,
        message: "Duel not found"
      });
    }

    if (duel.is_finished) {
      return res.status(200).json(getGameOverResponse(duel));
    }

    const participant = getParticipant(duel, req.user.id);

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: "Not a participant in this duel"
      });
    }

    const elapsed = getElapsedSeconds(duel.started_at);
    const timer = Number(duel.timer);

    if (!Number.isFinite(timer) || timer <= 0) {
      return res.status(500).json({
        success: false,
        message: "Invalid duel timer"
      });
    }

    if (elapsed >= timer) {
      const finished = await Duel.finishDuel(duel.id);

      return res.status(200).json(
        getGameOverResponse(finished)
      );
    }

    if (!duel.current_question) {
      return res.status(409).json({
        success: false,
        message: "No active question. Fetch the current question first."
      });
    }

    const alreadyAnswered = participant === 1
      ? duel.player1_answered
      : duel.player2_answered;

    if (alreadyAnswered) {
      return res.status(409).json({
        success: false,
        message: "Already answered this question"
      });
    }

    const correct =
      Number(answer) === Number(duel.current_answer);

    const myScore = Number(
      participant === 1
        ? duel.player1_score
        : duel.player2_score
    ) + (correct ? 1 : 0);

    if (correct) {
      await Duel.updateScore(duel.id, req.user.id, myScore);
    }

    const updated = await Duel.markAnswered(
      duel.id,
      req.user.id
    );

    const opponentAnswered = participant === 1
      ? updated.player2_answered
      : updated.player1_answered;

    const roundCompleted = Boolean(
      updated.player1_answered && updated.player2_answered
    );

    if (roundCompleted) {
      await Duel.clearCurrentQuestion(duel.id);
    }

    return res.status(200).json({
      success: true,
      correct,
      score: myScore,
      opponentAnswered,
      nextQuestion: roundCompleted
    });
  } catch (err) {
    console.error("submitAnswer error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to submit answer"
    });
  }
};

exports.challengeFriend = async (req, res) => {
  try {
    const { friendId, configurationId } = req.body;
    const userId = req.user.id;

    if (!isValidId(friendId) || !isValidId(configurationId)) {
      return res.status(400).json({
        success: false,
        message: "Valid friendId and configurationId are required"
      });
    }

    if (sameId(friendId, userId)) {
      return res.status(400).json({
        success: false,
        message: "You can't challenge yourself"
      });
    }

    const friend = await User.getUser(friendId);

    if (!friend) {
      return res.status(404).json({
        success: false,
        message: "Friend not found"
      });
    }

    const areFriends = await Duel.areFriends(userId, friendId);

    if (!areFriends) {
      return res.status(403).json({
        success: false,
        message: "You can only challenge a friend"
      });
    }

    if (!friend.is_online) {
      return res.status(409).json({
        success: false,
        message: "This friend isn't online right now"
      });
    }

    const existing = await Duel.getPendingChallengeBetween(
      userId,
      friendId
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "You already have a pending challenge to this friend"
      });
    }

    const challenge = await Duel.createChallenge(
      userId,
      friendId,
      configurationId
    );

    return res.status(201).json({
      success: true,
      challenge
    });
  } catch (err) {
    console.error("challengeFriend error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to create friend challenge"
    });
  }
};

exports.getIncomingChallenges = async (req, res) => {
  try {
    const challenges = await Duel.getIncomingChallenges(req.user.id);

    return res.status(200).json({
      success: true,
      challenges
    });
  } catch (err) {
    console.error("getIncomingChallenges error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve incoming challenges"
    });
  }
};

exports.respondToChallenge = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { accept } = req.body;

    if (!isValidId(challengeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid challengeId"
      });
    }

    if (typeof accept !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "accept must be a boolean"
      });
    }

    const challenge = await Duel.getChallenge(challengeId);

    if (!challenge || challenge.status !== "pending") {
      return res.status(404).json({
        success: false,
        message: "Challenge not found"
      });
    }

    if (!sameId(challenge.challenged_id, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "This challenge isn't yours to respond to"
      });
    }

    if (!accept) {
      const declined = await Duel.respondToChallenge(
        challenge.id,
        "declined"
      );

      return res.status(200).json({
        success: true,
        challenge: declined
      });
    }

    const duel = await Duel.createDuel(
      challenge.challenger_id,
      challenge.challenged_id,
      challenge.configuration_id
    );

    const accepted = await Duel.respondToChallenge(
      challenge.id,
      "accepted",
      duel.id
    );

    return res.status(200).json({
      success: true,
      challenge: accepted,
      duel
    });
  } catch (err) {
    console.error("respondToChallenge error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to respond to challenge"
    });
  }
};

exports.cancelChallenge = async (req, res) => {
  try {
    const { challengeId } = req.params;

    if (!isValidId(challengeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid challengeId"
      });
    }

    const cancelled = await Duel.cancelChallenge(
      challengeId,
      req.user.id
    );

    if (!cancelled) {
      return res.status(404).json({
        success: false,
        message: "No pending challenge found to cancel"
      });
    }

    return res.status(200).json({
      success: true,
      challenge: cancelled
    });
  } catch (err) {
    console.error("cancelChallenge error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel challenge"
    });
  }
};
