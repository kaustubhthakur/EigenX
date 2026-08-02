const pool = require("../db");

// Attempts to atomically claim a waiting opponent for this user. Uses a
// transaction + FOR UPDATE SKIP LOCKED so two players joining at the same
// moment can't both match the same waiting queue entry.
exports.matchOpponent = async (userId, configurationId, minLevel, maxLevel) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
      SELECT dq.id AS queue_id, dq.user_id
      FROM duel_queue dq
      JOIN users u ON u.id = dq.user_id
      WHERE dq.configuration_id = $1
        AND dq.matched = FALSE
        AND dq.user_id != $2
        AND u.is_online = TRUE
        AND FLOOR(u.xp / 100) + 1 BETWEEN $3 AND $4
      ORDER BY dq.queued_at ASC
      LIMIT 1
      FOR UPDATE OF dq SKIP LOCKED
      `,
      [configurationId, userId, minLevel, maxLevel]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const opponent = rows[0];

    const duelResult = await client.query(
      `
      INSERT INTO duels (player1_id, player2_id, configuration_id)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [opponent.user_id, userId, configurationId]
    );

    const duel = duelResult.rows[0];

    await client.query(
      `UPDATE duel_queue SET matched = TRUE, duel_id = $1 WHERE id = $2`,
      [duel.id, opponent.queue_id]
    );

    await client.query("COMMIT");
    return duel;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

exports.joinQueue = async (userId, configurationId) => {
  const result = await pool.query(
    `
    INSERT INTO duel_queue (user_id, configuration_id)
    VALUES ($1, $2)
    RETURNING *
    `,
    [userId, configurationId]
  );

  return result.rows[0];
};

exports.leaveQueue = async (userId) => {
  await pool.query(
    `DELETE FROM duel_queue WHERE user_id = $1 AND matched = FALSE`,
    [userId]
  );
};

// Called by whoever queued first, to find out if someone has since matched them.
exports.getQueueStatus = async (userId) => {
  const result = await pool.query(
    `
    SELECT *
    FROM duel_queue
    WHERE user_id = $1
    ORDER BY queued_at DESC
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0];
};

exports.getDuel = async (duelId) => {
  const result = await pool.query(
    `
    SELECT
      d.*,
      c.level,
      c.timer
    FROM duels d
    JOIN configurations c ON d.configuration_id = c.id
    WHERE d.id = $1
    `,
    [duelId]
  );

  return result.rows[0];
};

// Sets a new shared question for the round and resets both players' "answered" flags.
exports.saveCurrentQuestion = async (duelId, question, answer) => {
  const result = await pool.query(
    `
    UPDATE duels
    SET
      current_question = $2,
      current_answer = $3,
      player1_answered = FALSE,
      player2_answered = FALSE
    WHERE id = $1
    RETURNING *
    `,
    [duelId, question, answer]
  );

  return result.rows[0];
};

// Clears the round so the next getQuestion call mints a fresh one for both players.
exports.clearCurrentQuestion = async (duelId) => {
  const result = await pool.query(
    `
    UPDATE duels
    SET
      current_question = NULL,
      current_answer = NULL,
      player1_answered = FALSE,
      player2_answered = FALSE
    WHERE id = $1
    RETURNING *
    `,
    [duelId]
  );

  return result.rows[0];
};

exports.markAnswered = async (duelId, playerId) => {
  const result = await pool.query(
    `
    UPDATE duels
    SET
      player1_answered = CASE WHEN player1_id = $2 THEN TRUE ELSE player1_answered END,
      player2_answered = CASE WHEN player2_id = $2 THEN TRUE ELSE player2_answered END
    WHERE id = $1
    RETURNING *
    `,
    [duelId, playerId]
  );

  return result.rows[0];
};

exports.updateScore = async (duelId, playerId, score) => {
  const result = await pool.query(
    `
    UPDATE duels
    SET
      player1_score = CASE WHEN player1_id = $2 THEN $3 ELSE player1_score END,
      player2_score = CASE WHEN player2_id = $2 THEN $3 ELSE player2_score END
    WHERE id = $1
    RETURNING *
    `,
    [duelId, playerId, score]
  );

  return result.rows[0];
};

exports.finishDuel = async (duelId) => {
  const result = await pool.query(
    `
    UPDATE duels
    SET
      ended_at = NOW(),
      is_finished = TRUE,
      winner_id = CASE
        WHEN player1_score > player2_score THEN player1_id
        WHEN player2_score > player1_score THEN player2_id
        ELSE NULL
      END
    WHERE id = $1
    RETURNING *
    `,
    [duelId]
  );

  return result.rows[0];
};

// ASSUMPTION: friends(id, requester_id, receiver_id, status, created_at) with
// status = 'accepted' once a friend request has been accepted. Adjust if your
// actual friends table is shaped differently.
exports.areFriends = async (userId1, userId2) => {
  const result = await pool.query(
    `
    SELECT 1
    FROM friends
    WHERE status = 'accepted'
      AND (
        (requester_id = $1 AND receiver_id = $2)
        OR (requester_id = $2 AND receiver_id = $1)
      )
    LIMIT 1
    `,
    [userId1, userId2]
  );

  return result.rows.length > 0;
};

// Plain (non-queue) duel creation, used once a challenge is accepted.
exports.createDuel = async (player1Id, player2Id, configurationId) => {
  const result = await pool.query(
    `
    INSERT INTO duels (player1_id, player2_id, configuration_id)
    VALUES ($1, $2, $3)
    RETURNING *
    `,
    [player1Id, player2Id, configurationId]
  );

  return result.rows[0];
};

exports.createChallenge = async (challengerId, challengedId, configurationId) => {
  const result = await pool.query(
    `
    INSERT INTO duel_challenges (challenger_id, challenged_id, configuration_id)
    VALUES ($1, $2, $3)
    RETURNING *
    `,
    [challengerId, challengedId, configurationId]
  );

  return result.rows[0];
};

exports.getPendingChallengeBetween = async (challengerId, challengedId) => {
  const result = await pool.query(
    `
    SELECT *
    FROM duel_challenges
    WHERE challenger_id = $1
      AND challenged_id = $2
      AND status = 'pending'
    LIMIT 1
    `,
    [challengerId, challengedId]
  );

  return result.rows[0];
};

exports.getChallenge = async (challengeId) => {
  const result = await pool.query(
    `SELECT * FROM duel_challenges WHERE id = $1`,
    [challengeId]
  );

  return result.rows[0];
};

// Incoming pending challenges for a user, with the challenger's basic info attached.
exports.getIncomingChallenges = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      dc.*,
      u.username AS challenger_username,
      u.avatar AS challenger_avatar,
      FLOOR(u.xp / 100) + 1 AS challenger_level
    FROM duel_challenges dc
    JOIN users u ON u.id = dc.challenger_id
    WHERE dc.challenged_id = $1
      AND dc.status = 'pending'
    ORDER BY dc.created_at DESC
    `,
    [userId]
  );

  return result.rows;
};

exports.respondToChallenge = async (challengeId, status, duelId = null) => {
  const result = await pool.query(
    `
    UPDATE duel_challenges
    SET
      status = $2,
      duel_id = $3,
      responded_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [challengeId, status, duelId]
  );

  return result.rows[0];
};

exports.cancelChallenge = async (challengeId, challengerId) => {
  const result = await pool.query(
    `
    UPDATE duel_challenges
    SET status = 'cancelled', responded_at = NOW()
    WHERE id = $1
      AND challenger_id = $2
      AND status = 'pending'
    RETURNING *
    `,
    [challengeId, challengerId]
  );

  return result.rows[0];
};