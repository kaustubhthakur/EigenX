const Duel = require("../models/Duel");
const User = require("../models/User");
const { normalizeCustomSettings, buildQuestion } = require("./duelQuestion");

const LEVEL_RANGE = 5;

const sameId = (a, b) =>
  a != null && b != null && String(a) === String(b);

const isValidId = (value) =>
  (typeof value === "string" && value.trim().length > 0) ||
  (typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0);

const getElapsedSeconds = (startedAt) => {
  if (!startedAt) return 0;

  const start = new Date(startedAt).getTime();

  if (!Number.isFinite(start)) {
    throw new Error("Invalid duel start time");
  }

  return Math.max(0, Math.floor((Date.now() - start) / 1000));
};

const getGameOverResponse = (duel) => ({
  success: true,
  gameOver: true,
  duel,
  player1Score: duel.player1_score,
  player2Score: duel.player2_score,
  winnerId: duel.winner_id
});

const getParticipant = (duel, userId) => {
  if (sameId(duel.player1_id, userId)) return 1;
  if (sameId(duel.player2_id, userId)) return 2;
  return 0;
};

/* ------------------------------------------------------------------ */
/* Matchmaking queue                                                   */
/* ------------------------------------------------------------------ */

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

    const parsedSettings = normalizeCustomSettings(req.body.customSettings);

    if (!parsedSettings.ok) {
      return res.status(400).json({
        success: false,
        message: parsedSettings.message
      });
    }

    const customSettings = parsedSettings.value;

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
      maxLevel,
      customSettings
    );

    if (duel) {
      return res.status(200).json({
        success: true,
        matched: true,
        duel
      });
    }

    await Duel.joinQueue(userId, configurationId, customSettings);

    return res.status(200).json({
      success: true,
      matched: false,
      message: "Waiting for an opponent"
    });
  } catch (err) {
    console.error("joinDuel error:", err);

    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode
        ? err.message
        : "Failed to join duel queue"
    });
  }
};

exports.getDuelById = async (req, res) => {
  try {
    const { duelId } = req.params;
    const userId = req.user.id;

    // "/duel/active" can be swallowed by "/:duelId" depending on route
    // order, so handle it here too.
    if (duelId === "active") {
      return exports.getActiveDuel(req, res);
    }

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

    if (!getParticipant(duel, userId)) {
      return res.status(403).json({
        success: false,
        message: "Not a participant in this duel"
      });
    }

    return res.status(200).json({
      success: true,
      duel
    });
  } catch (err) {
    console.error("getDuelById error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve duel details"
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

/* ------------------------------------------------------------------ */
/* Active duel lookup (so the challenger can be sent into the duel)    */
/* Route must be registered BEFORE any "/:duelId" route:               */
/*   router.get("/active", auth, duelController.getActiveDuel);        */
/* Requires Duel.getActiveDuelForUser in the model.                    */
/* ------------------------------------------------------------------ */

exports.getActiveDuel = async (req, res) => {
  try {
    const duel = await Duel.getActiveDuelForUser(req.user.id);

    return res.status(200).json({
      success: true,
      duelId: duel ? duel.id : null
    });
  } catch (err) {
    console.error("getActiveDuel error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to check active duel"
    });
  }
};

/* ------------------------------------------------------------------ */
/* Gameplay                                                            */
/* ------------------------------------------------------------------ */

exports.getQuestion = async (req, res) => {
  try {
    const { duelId } = req.params;
    const playerId = req.user.id;

    if (!isValidId(duelId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid duelId"
      });
    }

    let duel = await Duel.getDuel(duelId);

    if (!duel) {
      return res.status(404).json({
        success: false,
        message: "Duel not found"
      });
    }

    const participant = getParticipant(duel, playerId);

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant in this duel"
      });
    }

    const isPlayer1 = participant === 1;

    if (duel.is_finished) {
      return res.json({
        ...getGameOverResponse(duel),
        isPlayer1
      });
    }

    const elapsedSeconds = getElapsedSeconds(duel.started_at);
    const remainingTime = Math.max(0, Number(duel.timer) - elapsedSeconds);

    if (remainingTime <= 0) {
      duel = await Duel.finishDuel(duelId);

      return res.json({
        ...getGameOverResponse(duel),
        isPlayer1,
        remainingTime: 0
      });
    }

    if (!duel.current_question) {
      const { question, answer } = buildQuestion(duel.custom_settings);

      duel = await Duel.saveCurrentQuestion(duelId, question, answer);

      if (!duel || duel.is_finished || !duel.current_question) {
        return res.status(409).json({
          success: false,
          message: "Unable to load the current question"
        });
      }
    }

    const playerAnswered = isPlayer1
      ? duel.player1_answered
      : duel.player2_answered;

    const opponentAnswered = isPlayer1
      ? duel.player2_answered
      : duel.player1_answered;

    return res.json({
      success: true,
      isPlayer1,
      question: duel.current_question,
      player1Score: duel.player1_score,
      player2Score: duel.player2_score,
      player1Answered: duel.player1_answered,
      player2Answered: duel.player2_answered,
      answered: playerAnswered,
      opponentAnswered,
      waitingForOpponent: playerAnswered && !opponentAnswered,
      remainingTime
    });
  } catch (err) {
    console.error("getQuestion error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to get duel question"
    });
  }
};

// First correct answer wins the point and immediately moves to the next
// question. A wrong answer locks that player out until the question changes.
exports.submitAnswer = async (req, res) => {
  try {
    const duelId = req.params.duelId ?? req.body.duelId;
    const { answer, question } = req.body;
    const playerId = req.user.id;

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

    const participant = getParticipant(duel, playerId);

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: "Not a participant in this duel"
      });
    }

    if (duel.is_finished) {
      return res.status(200).json({
        ...getGameOverResponse(duel),
        isPlayer1: participant === 1
      });
    }

    const timer = Number(duel.timer);

    if (!Number.isFinite(timer) || timer <= 0) {
      return res.status(500).json({
        success: false,
        message: "Invalid duel timer"
      });
    }

    if (getElapsedSeconds(duel.started_at) >= timer) {
      const finished = await Duel.finishDuel(duelId);

      return res.status(200).json({
        ...getGameOverResponse(finished),
        isPlayer1: participant === 1
      });
    }

    const result = await Duel.resolveAnswer(
      duelId,
      playerId,
      answer,
      question
    );

    switch (result.status) {
      case "not_found":
        return res.status(404).json({
          success: false,
          message: "Duel not found"
        });

      case "forbidden":
        return res.status(403).json({
          success: false,
          message: "Not a participant in this duel"
        });

      case "game_over":
        return res.status(200).json({
          ...getGameOverResponse(result.duel),
          isPlayer1: participant === 1
        });

      case "already_answered":
        return res.status(409).json({
          success: false,
          message: "You already answered this question"
        });

      case "stale":
      case "no_question":
        // Opponent was faster and the question has already changed
        return res.status(409).json({
          success: false,
          stale: true,
          message: "Too late, the question changed"
        });

      default:
        break;
    }

    const isPlayer1 = participant === 1;

    return res.status(200).json({
      success: true,
      correct: result.correct,
      score: result.score,
      isPlayer1,
      player1Score: result.player1Score,
      player2Score: result.player2Score,
      player1Answered: result.player1Answered,
      player2Answered: result.player2Answered,
      answered: isPlayer1
        ? result.player1Answered
        : result.player2Answered,
      opponentAnswered: isPlayer1
        ? result.player2Answered
        : result.player1Answered,
      question: result.question,
      nextQuestion: result.nextQuestion
    });
  } catch (err) {
    console.error("submitAnswer error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to submit answer"
    });
  }
};

/* ------------------------------------------------------------------ */
/* Friend challenges                                                   */
/* ------------------------------------------------------------------ */

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

    const parsedSettings = normalizeCustomSettings(req.body.customSettings);

    if (!parsedSettings.ok) {
      return res.status(400).json({
        success: false,
        message: parsedSettings.message
      });
    }

    const customSettings = parsedSettings.value;

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
      configurationId,
      customSettings
    );

    return res.status(201).json({
      success: true,
      challenge
    });
  } catch (err) {
    console.error("challengeFriend error:", err);

    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode
        ? err.message
        : "Failed to create friend challenge"
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
      challenge.configuration_id,
      challenge.custom_settings ?? null
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