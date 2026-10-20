const pool = require("../db");

const sameId = (a, b) =>
  a != null && b != null && String(a) === String(b);

const toJson = (settings) =>
  settings ? JSON.stringify(settings) : null;

const stable = (settings) =>
  settings == null
    ? "null"
    : JSON.stringify(
        Object.keys(settings)
          .sort()
          .map((key) => [key, settings[key]])
      );


const EFFECTIVE_TIMER = `COALESCE((d.custom_settings->>'timer')::int, c.timer)`;


exports.finishExpiredDuels = async (db = pool) => {
  await db.query(
    `
    UPDATE duels d
    SET
      ended_at = NOW(),
      is_finished = TRUE,
      winner_id = CASE
        WHEN d.player1_score > d.player2_score THEN d.player1_id
        WHEN d.player2_score > d.player1_score THEN d.player2_id
        ELSE NULL
      END
    FROM configurations c
    WHERE c.id = d.configuration_id
      AND d.is_finished = FALSE
      AND d.started_at IS NOT NULL
      AND d.started_at + (${EFFECTIVE_TIMER} * INTERVAL '1 second') <= NOW()
    `
  );
};

exports.matchOpponent = async (
  userId,
  configurationId,
  minLevel,
  maxLevel,
  customSettings = null
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await exports.finishExpiredDuels(client);

    const { rows } = await client.query(
      `
      SELECT dq.id AS queue_id, dq.user_id
      FROM duel_queue dq
      JOIN users u ON u.id = dq.user_id
      WHERE dq.configuration_id = $1
        AND dq.matched = FALSE
        AND dq.user_id != $2
        AND dq.custom_settings IS NOT DISTINCT FROM $5::jsonb
        AND u.is_online = TRUE
        AND FLOOR(u.xp / 100) + 1 BETWEEN $3 AND $4
        AND NOT EXISTS (
          SELECT 1
          FROM duels d
          WHERE d.is_finished = FALSE
            AND (
              d.player1_id = dq.user_id
              OR d.player2_id = dq.user_id
            )
        )
      ORDER BY dq.queued_at ASC
      LIMIT 1
      FOR UPDATE OF dq SKIP LOCKED
      `,
      [configurationId, userId, minLevel, maxLevel, toJson(customSettings)]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const opponent = rows[0];

    const activeDuel = await client.query(
      `
      SELECT id
      FROM duels
      WHERE is_finished = FALSE
        AND (
          player1_id = $1 OR player2_id = $1
          OR player1_id = $2 OR player2_id = $2
        )
      LIMIT 1
      `,
      [userId, opponent.user_id]
    );

    if (activeDuel.rows.length > 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const duelResult = await client.query(
      `
      INSERT INTO duels (
        player1_id,
        player2_id,
        configuration_id,
        custom_settings
      )
      VALUES ($1, $2, $3, $4::jsonb)
      RETURNING *
      `,
      [opponent.user_id, userId, configurationId, toJson(customSettings)]
    );

    const duel = duelResult.rows[0];

    const queueUpdate = await client.query(
      `
      UPDATE duel_queue
      SET matched = TRUE, duel_id = $1
      WHERE id = $2
        AND matched = FALSE
      RETURNING id
      `,
      [duel.id, opponent.queue_id]
    );

    if (queueUpdate.rows.length === 0) {
      throw new Error("Opponent is no longer available");
    }

    await client.query("COMMIT");
    return duel;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

exports.joinQueue = async (
  userId,
  configurationId,
  customSettings = null
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await exports.finishExpiredDuels(client);

    const activeDuel = await client.query(
      `
      SELECT id
      FROM duels
      WHERE is_finished = FALSE
        AND (player1_id = $1 OR player2_id = $1)
      LIMIT 1
      `,
      [userId]
    );

    if (activeDuel.rows.length > 0) {
      const error = new Error("Already in an active duel");
      error.statusCode = 409;
      throw error;
    }

    const existing = await client.query(
      `
      SELECT *
      FROM duel_queue
      WHERE user_id = $1
        AND matched = FALSE
      ORDER BY queued_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [userId]
    );

    if (existing.rows.length > 0) {
      const entry = existing.rows[0];

      if (
        String(entry.configuration_id) === String(configurationId) &&
        stable(entry.custom_settings) === stable(customSettings)
      ) {
        await client.query("COMMIT");
        return entry;
      }

      await client.query(
        `
        DELETE FROM duel_queue
        WHERE user_id = $1
          AND matched = FALSE
        `,
        [userId]
      );
    }

    const result = await client.query(
      `
      INSERT INTO duel_queue (
        user_id,
        configuration_id,
        matched,
        custom_settings
      )
      VALUES ($1, $2, FALSE, $3::jsonb)
      RETURNING *
      `,
      [userId, configurationId, toJson(customSettings)]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

exports.leaveQueue = async (userId) => {
  const result = await pool.query(
    `
    DELETE FROM duel_queue
    WHERE user_id = $1
      AND matched = FALSE
    RETURNING *
    `,
    [userId]
  );

  return result.rows;
};

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

  return result.rows[0] || null;
};

exports.getDuel = async (duelId) => {
  const result = await pool.query(
    `
    SELECT d.*, c.level, ${EFFECTIVE_TIMER} AS timer
    FROM duels d
    JOIN configurations c ON c.id = d.configuration_id
    WHERE d.id = $1
    `,
    [duelId]
  );

  return result.rows[0] || null;
};


exports.getActiveDuelForUser = async (userId) => {
  await exports.finishExpiredDuels();

  const result = await pool.query(
    `
    SELECT d.id
    FROM duels d
    JOIN configurations c ON c.id = d.configuration_id
    WHERE d.is_finished = FALSE
      AND (d.player1_id = $1 OR d.player2_id = $1)
      AND (
        d.started_at IS NULL
        OR d.started_at + (${EFFECTIVE_TIMER} * INTERVAL '1 second') > NOW()
      )
    ORDER BY d.id DESC
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
};

exports.saveCurrentQuestion = async (
  duelId,
  question,
  answer
) => {
  const result = await pool.query(
    `
    UPDATE duels
    SET
      current_question = $2,
      current_answer = $3,
      player1_answered = FALSE,
      player2_answered = FALSE
    WHERE id = $1
      AND is_finished = FALSE
      AND current_question IS NULL
    RETURNING *
    `,
    [duelId, question, answer]
  );

  return result.rows[0] || exports.getDuel(duelId);
};

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
      AND is_finished = FALSE
      AND current_question IS NOT NULL
    RETURNING *
    `,
    [duelId]
  );

  return result.rows[0] || null;
};

exports.markAnswered = async (duelId, playerId) => {
  const result = await pool.query(
    `
    UPDATE duels
    SET
      player1_answered = CASE
        WHEN player1_id = $2 THEN TRUE
        ELSE player1_answered
      END,
      player2_answered = CASE
        WHEN player2_id = $2 THEN TRUE
        ELSE player2_answered
      END
    WHERE id = $1
      AND is_finished = FALSE
      AND current_question IS NOT NULL
      AND (
        (player1_id = $2 AND player1_answered = FALSE)
        OR
        (player2_id = $2 AND player2_answered = FALSE)
      )
    RETURNING *
    `,
    [duelId, playerId]
  );

  return result.rows[0] || null;
};

exports.updateScore = async (
  duelId,
  playerId,
  score
) => {
  const result = await pool.query(
    `
    UPDATE duels
    SET
      player1_score = CASE
        WHEN player1_id = $2 THEN $3
        ELSE player1_score
      END,
      player2_score = CASE
        WHEN player2_id = $2 THEN $3
        ELSE player2_score
      END
    WHERE id = $1
      AND is_finished = FALSE
      AND (player1_id = $2 OR player2_id = $2)
    RETURNING *
    `,
    [duelId, playerId, score]
  );

  return result.rows[0] || null;
};


exports.resolveAnswer = async (
  duelId,
  playerId,
  answer,
  question
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      SELECT *
      FROM duels
      WHERE id = $1
      FOR UPDATE
      `,
      [duelId]
    );

    const duel = result.rows[0];

    if (!duel) {
      await client.query("ROLLBACK");
      return { status: "not_found" };
    }

    if (duel.is_finished) {
      await client.query("COMMIT");
      return {
        status: "game_over",
        duel
      };
    }

    const isPlayer1 = sameId(duel.player1_id, playerId);
    const isPlayer2 = sameId(duel.player2_id, playerId);

    if (!isPlayer1 && !isPlayer2) {
      await client.query("ROLLBACK");
      return { status: "forbidden" };
    }

    if (!duel.current_question) {
      await client.query("COMMIT");
      return {
        status: "no_question",
        duel
      };
    }


    if (
      question != null &&
      String(question) !== String(duel.current_question)
    ) {
      await client.query("COMMIT");
      return {
        status: "stale",
        duel
      };
    }

    const alreadyAnswered = isPlayer1
      ? duel.player1_answered
      : duel.player2_answered;

    if (alreadyAnswered) {
      await client.query("COMMIT");
      return {
        status: "already_answered",
        duel
      };
    }

    const correct =
      Math.abs(Number(answer) - Number(duel.current_answer)) < 1e-6;

    if (correct) {
      await client.query(
        `
        UPDATE duels
        SET
          player1_score = CASE
            WHEN player1_id = $2 THEN player1_score + 1
            ELSE player1_score
          END,
          player2_score = CASE
            WHEN player2_id = $2 THEN player2_score + 1
            ELSE player2_score
          END,
          current_question = NULL,
          current_answer = NULL,
          player1_answered = FALSE,
          player2_answered = FALSE
        WHERE id = $1
        `,
        [duelId, playerId]
      );
    }


    const latestResult = await client.query(
      `
      SELECT *
      FROM duels
      WHERE id = $1
      `,
      [duelId]
    );

    const latest = latestResult.rows[0];

    await client.query("COMMIT");

    return {
      status: "resolved",
      correct,
      score: isPlayer1
        ? latest.player1_score
        : latest.player2_score,
      player1Score: latest.player1_score,
      player2Score: latest.player2_score,
      player1Answered: latest.player1_answered,
      player2Answered: latest.player2_answered,
      question: latest.current_question,
      nextQuestion: latest.current_question == null,
      duel: latest
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
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
      AND is_finished = FALSE
    RETURNING *
    `,
    [duelId]
  );

  return result.rows[0] || exports.getDuel(duelId);
};

exports.areFriends = async (userId1, userId2) => {
  const result = await pool.query(
    `
    SELECT 1
    FROM friends
    WHERE (
      user_id = $1 AND friend_id = $2
    )
    OR (
      user_id = $2 AND friend_id = $1
    )
    LIMIT 1
    `,
    [userId1, userId2]
  );

  return result.rows.length > 0;
};

exports.createDuel = async (
  player1Id,
  player2Id,
  configurationId,
  customSettings = null
) => {
  await exports.finishExpiredDuels();

  const result = await pool.query(
    `
    INSERT INTO duels (
      player1_id,
      player2_id,
      configuration_id,
      custom_settings
    )
    VALUES ($1, $2, $3, $4::jsonb)
    RETURNING *
    `,
    [player1Id, player2Id, configurationId, toJson(customSettings)]
  );

  return result.rows[0];
};

exports.findConfigurationId = async (level, timer) => {
  const exact = await pool.query(
    `
    SELECT id
    FROM configurations
    WHERE level = $1
      AND timer = $2
      AND is_custom IS NOT TRUE
    ORDER BY id
    LIMIT 1
    `,
    [level, timer]
  );
  if (exact.rows[0]) return exact.rows[0].id;

  // Fallback: any standard configuration for that level
  const fallback = await pool.query(
    `
    SELECT id
    FROM configurations
    WHERE level = $1
      AND is_custom IS NOT TRUE
    ORDER BY timer, id
    LIMIT 1
    `,
    [level]
  );
  return fallback.rows[0]?.id ?? null;
};

exports.createChallenge = async (
  challengerId,
  challengedId,
  configurationId,
  customSettings = null
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const configuration = await client.query(
      `SELECT id FROM configurations WHERE id = $1`,
      [configurationId]
    );

    if (configuration.rows.length === 0) {
      const error = new Error("Configuration not found");
      error.statusCode = 400;
      throw error;
    }

    const existing = await client.query(
      `
      SELECT id
      FROM duel_challenges
      WHERE status = 'pending'
        AND (
          (challenger_id = $1 AND challenged_id = $2)
          OR
          (challenger_id = $2 AND challenged_id = $1)
        )
      LIMIT 1
      `,
      [challengerId, challengedId]
    );

    if (existing.rows.length > 0) {
      const error = new Error(
        "A pending challenge already exists"
      );
      error.statusCode = 409;
      throw error;
    }

    const result = await client.query(
      `
      INSERT INTO duel_challenges (
        challenger_id,
        challenged_id,
        configuration_id,
        status,
        custom_settings
      )
      VALUES ($1, $2, $3, 'pending', $4::jsonb)
      RETURNING *
      `,
      [challengerId, challengedId, configurationId, toJson(customSettings)]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

exports.getPendingChallengeBetween = async (
  userId1,
  userId2
) => {
  const result = await pool.query(
    `
    SELECT *
    FROM duel_challenges
    WHERE status = 'pending'
      AND (
        (challenger_id = $1 AND challenged_id = $2)
        OR
        (challenger_id = $2 AND challenged_id = $1)
      )
    LIMIT 1
    `,
    [userId1, userId2]
  );

  return result.rows[0] || null;
};

exports.getChallenge = async (challengeId) => {
  const result = await pool.query(
    `
    SELECT *
    FROM duel_challenges
    WHERE id = $1
    `,
    [challengeId]
  );

  return result.rows[0] || null;
};

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

exports.respondToChallenge = async (
  challengeId,
  status,
  duelId = null
) => {
  if (!["accepted", "declined"].includes(status)) {
    throw new Error("Invalid challenge response status");
  }

  const result = await pool.query(
    `
    UPDATE duel_challenges
    SET
      status = $2,
      duel_id = $3,
      responded_at = NOW()
    WHERE id = $1
      AND status = 'pending'
    RETURNING *
    `,
    [challengeId, status, duelId]
  );

  return result.rows[0] || null;
};

exports.cancelChallenge = async (
  challengeId,
  challengerId
) => {
  const result = await pool.query(
    `
    UPDATE duel_challenges
    SET
      status = 'cancelled',
      responded_at = NOW()
    WHERE id = $1
      AND challenger_id = $2
      AND status = 'pending'
    RETURNING *
    `,
    [challengeId, challengerId]
  );

  return result.rows[0] || null;
};