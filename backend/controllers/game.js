const Game = require("../models/Game");
const { calculateXp } = require("../utils/scoring");

const randomNumber = (digits) => {
  const safeDigits = Number.isFinite(digits) && digits > 0 ? digits : 1;
  const min = Math.pow(10, safeDigits - 1);
  const max = Math.pow(10, safeDigits) - 1;

  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const randomNumberInRange = (minDigits, maxDigits) => {
  const min = Number.isFinite(minDigits) ? minDigits : 1;
  const max = Number.isFinite(maxDigits) ? maxDigits : min;
  const digits = Math.floor(Math.random() * (max - min + 1)) + min;
  return randomNumber(digits);
};


const randomRight = (rule) => {
  let r;
  do {
    r = randomNumberInRange(rule.right_min_digits, rule.right_max_digits);
  } while ((rule.operation === "*" || rule.operation === "/") && r <= 2);
  return r;
};

const generateQuestion = (rule) => {
  let left;
  let right;
  let answer;

  switch (rule.operation) {
    case "+":
      left = randomNumberInRange(rule.left_min_digits, rule.left_max_digits);
      right = randomNumberInRange(rule.right_min_digits, rule.right_max_digits);
      answer = left + right;
      break;

    case "-":
      left = randomNumberInRange(rule.left_min_digits, rule.left_max_digits);
      right = randomNumberInRange(rule.right_min_digits, rule.right_max_digits);

      if (left < right) {
        [left, right] = [right, left];
      }

      answer = left - right;
      break;

    case "*":
      left = randomNumberInRange(rule.left_min_digits, rule.left_max_digits);
      right = randomRight(rule);
      answer = left * right;
      break;

    case "/":
      if (!rule.decimal_places) {
      
        const lowLeft = Math.pow(10, rule.left_min_digits - 1);
        const highLeft = Math.pow(10, rule.left_max_digits) - 1;

        for (let i = 0; i < 100; i++) {
          const r = randomRight(rule);
          const minAns = Math.max(2, Math.ceil(lowLeft / r));
          const maxAns = Math.floor(highLeft / r);

          if (minAns <= maxAns) {
            right = r;
            answer = Math.floor(Math.random() * (maxAns - minAns + 1)) + minAns;
            left = answer * right;
            break;
          }
        }

    
        if (left === undefined) {
          right = 10;
          answer = randomNumber(1) + 1; // 2-10
          left = answer * right;
        }
      } else {
        left = randomNumberInRange(rule.left_min_digits, rule.left_max_digits);
        right = randomRight(rule);
        answer = Number((left / right).toFixed(rule.decimal_places));
      }
      break;

    default:
      left = 0;
      right = 0;
      answer = 0;
  }

  return {
    question: `${left} ${rule.operation} ${right}`,
    answer
  };
};

exports.getQuestion = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Game.getGameSession(sessionId);

    if (!session || session.is_finished) {
      return res.status(404).json({
        success: false,
        message: "Game session not found"
      });
    }

    const elapsed = Math.floor(
      (Date.now() - new Date(session.started_at).getTime()) / 1000
    );

    if (elapsed >= session.timer) {
      await Game.finishGame(session.id);
      await Game.updateTopScore(
        session.user_id,
        session.score,
        calculateXp(session.score, session.level)
      );
      return res.status(200).json({
        success: true,
        gameOver: true,
        score: session.score
      });
    }

    const rule = await Game.getRandomArithmetic(
      session.level,
      session.custom_settings
    );

    if (!rule) {
      return res.status(500).json({
        success: false,
        message: `No arithmetic rules configured for level ${session.level}`
      });
    }

    const arithmetic = generateQuestion(rule);

    await Game.saveCurrentQuestion(
      session.id,
      arithmetic.question,
      arithmetic.answer
    );

    return res.status(200).json({
      success: true,
      score: session.score,
      remainingTime: session.timer - elapsed,
      question: arithmetic.question,
      decimalPlaces: rule.decimal_places || 0
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.getMyLevelStats = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const levels = await Game.getBestScoreByLevel(userId);
    return res.status(200).json({ success: true, levels });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitAnswer = async (req, res) => {
  try {
    const { sessionId, answer } = req.body;

    const session = await Game.getGameSession(sessionId);

    if (!session || session.is_finished) {
      return res.status(404).json({
        success: false,
        message: "Game session not found"
      });
    }

    const elapsed = Math.floor(
      (Date.now() - new Date(session.started_at).getTime()) / 1000
    );

    if (elapsed >= session.timer) {
      await Game.finishGame(session.id);
      await Game.updateTopScore(
        session.user_id,
        session.score,
        calculateXp(session.score, session.level)
      );

      return res.status(200).json({
        success: true,
        gameOver: true,
        score: session.score
      });
    }

    const current = await Game.getCurrentQuestion(session.id);

    if (!current) {
      return res.status(409).json({
        success: false,
        message: "No active question for this session — fetch a question first"
      });
    }

    let score = session.score;
    let correct = false;

    if (Number(answer) === Number(current.current_answer)) {
      score++;
      correct = true;
      await Game.updateScore(session.id, score);
    }

    return res.status(200).json({
      success: true,
      correct,
      score,
      nextQuestion: true
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.cancelGame = async (req, res) => {
  try {
    const { sessionId } = req.body;

    const session = await Game.getGameSession(sessionId);

    if (!session || session.is_finished) {
      return res.status(404).json({
        success: false,
        message: "Game session not found"
      });
    }

    if (String(session.user_id) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Not your session"
      });
    }


    await Game.finishGame(session.id);

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.generateQuestion = generateQuestion;