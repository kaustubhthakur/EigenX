const pool = require("../db");

exports.createGameSession = async (userId, configurationId) => {
  const result = await pool.query(
    `
    INSERT INTO game_sessions (
      user_id,
      configuration_id,
      score,
      started_at,
      ended_at,
      is_finished
    )
    VALUES ($1, $2, 0, NOW(), NULL, FALSE)
    RETURNING *
    `,
    [userId, configurationId]
  );

  return result.rows[0];
};

exports.getGameSession = async (sessionId) => {
  const result = await pool.query(
    `
    SELECT
      gs.*,
      c.level,
      c.timer
    FROM game_sessions gs
    JOIN configurations c
      ON gs.configuration_id = c.id
    WHERE gs.id = $1
    `,
    [sessionId]
  );

  return result.rows[0];
};

exports.getRandomArithmetic = async (level) => {
  const result = await pool.query(
    `
    SELECT
      id,
      name,
      operation,
      left_min_digits,
      left_max_digits,
      right_min_digits,
      right_max_digits,
      decimal_places
    FROM calculations
    WHERE difficulty_level = $1
      AND is_active = TRUE
    ORDER BY RANDOM()
    LIMIT 1
    `,
    [level]
  );

  return result.rows[0];
};

// Stores the question/answer currently being asked for this session,
// so submitAnswer can later check the answer against it.
exports.saveCurrentQuestion = async (sessionId, question, answer) => {
  const result = await pool.query(
    `
    UPDATE game_sessions
    SET
      current_question = $2,
      current_answer = $3
    WHERE id = $1
    RETURNING *
    `,
    [sessionId, question, answer]
  );

  return result.rows[0];
};

// Reads back the question/answer stored by saveCurrentQuestion.
exports.getCurrentQuestion = async (sessionId) => {
  const result = await pool.query(
    `
    SELECT
      current_question,
      current_answer
    FROM game_sessions
    WHERE id = $1
    `,
    [sessionId]
  );

  return result.rows[0];
};

exports.updateScore = async (sessionId, score) => {
  const result = await pool.query(
    `
    UPDATE game_sessions
    SET score = $2
    WHERE id = $1
    RETURNING *
    `,
    [sessionId, score]
  );

  return result.rows[0];
};

exports.finishGame = async (sessionId) => {
  const result = await pool.query(
    `
    UPDATE game_sessions
    SET
      ended_at = NOW(),
      is_finished = TRUE
    WHERE id = $1
    RETURNING *
    `,
    [sessionId]
  );

  return result.rows[0];
};

exports.updateTopScore = async (userId, score) => {
  const result = await pool.query(
    `
    UPDATE users
    SET
      top_score = GREATEST(top_score, $2),
      xp = xp + $2
    WHERE id = $1
    RETURNING id, top_score, xp
    `,
    [userId, score]
  );

  return result.rows[0];
};