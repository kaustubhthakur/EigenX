const pool = require("../db");

exports.createGameSession = async (userId, configurationId, customSettings = null) => {
  const result = await pool.query(
    `
    INSERT INTO game_sessions (
      user_id,
      configuration_id,
      score,
      started_at,
      ended_at,
      is_finished,
      custom_settings
    )
    VALUES ($1, $2, 0, NOW(), NULL, FALSE, $3)
    RETURNING *
    `,
    [userId, configurationId, customSettings]
  );

  return result.rows[0];
};

exports.getGameSession = async (sessionId) => {
  const result = await pool.query(
    `
    SELECT
      gs.*,
      c.level,
      c.is_custom,
      COALESCE((gs.custom_settings->>'timer')::int, c.timer) AS timer
    FROM game_sessions gs
    JOIN configurations c
      ON gs.configuration_id = c.id
    WHERE gs.id = $1
    `,
    [sessionId]
  );

  return result.rows[0];
};

exports.getRandomArithmetic = async (level, customSettings = null) => {
  // Custom level: build the rule from the player's own settings
  if (customSettings) {
    const ops = customSettings.operations;
    const operation = ops[Math.floor(Math.random() * ops.length)];

    return {
      id: null,
      name: `Custom ${operation}`,
      operation,
      left_min_digits: customSettings.left_min_digits,
      left_max_digits: customSettings.left_max_digits,
      right_min_digits: customSettings.right_min_digits,
      right_max_digits: customSettings.right_max_digits,
      decimal_places: customSettings.decimal_places,
    };
  }

  // Normal levels: unchanged
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

exports.updateTopScore = async (userId, score) => {
  const result = await pool.query(
    `
    UPDATE users
    SET
      top_score = GREATEST(top_score, $2),
      xp = xp + $2,
      top_score_at = CASE
        WHEN $2 > top_score THEN NOW()
        ELSE top_score_at
      END
    WHERE id = $1
    RETURNING id, top_score, top_score_at, xp
    `,
    [userId, score]
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

exports.getBestScoreByLevel = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      CASE WHEN c.is_custom THEN 'custom' ELSE c.level::text END AS level,
      MAX(gs.score) AS best_score,
      COUNT(*)::int AS games_played
    FROM game_sessions gs
    JOIN configurations c
      ON gs.configuration_id = c.id
    WHERE gs.user_id = $1
      AND gs.is_finished = TRUE
    GROUP BY 1
    ORDER BY best_score DESC
    `,
    [userId]
  );

  return result.rows;
};