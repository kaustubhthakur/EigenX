const pool = require("../db");


const MAX_MESSAGE_LENGTH = 500;
const REQUEST_TTL_SECONDS = 60;


// World duels use a real row from the `configurations` table (level + timer),
// the same as friend challenges and matchmaking.
exports.WORLD_DUEL_CONFIG = Object.freeze({
  level: 2,
  timer: 60,
});


const PUBLIC_USER_FIELDS = `
  u.id AS user_id,
  u.username,
  u.avatar,
  u.is_online,
  u.last_seen,
  u.top_score,
  u.xp,
  FLOOR(u.xp / 100) + 1 AS level
`;


exports.sendMessage = async ({ userId, content }) => {
  const text = typeof content === "string" ? content.trim() : "";
  if (!text || text.length > MAX_MESSAGE_LENGTH) return null;

  const result = await pool.query(
    `
    WITH inserted AS (
      INSERT INTO world_messages (user_id, content)
      VALUES ($1, $2)
      RETURNING id, user_id, content, created_at
    )
    SELECT
      i.id,
      i.content,
      i.created_at,
      ${PUBLIC_USER_FIELDS}
    FROM inserted i
    JOIN users u ON u.id = i.user_id
    `,
    [userId, text]
  );

  return result.rows[0];
};


exports.getRecentMessages = async ({ limit = 50, beforeId = null } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const result = await pool.query(
    `
    SELECT
      m.id,
      m.content,
      m.created_at,
      ${PUBLIC_USER_FIELDS}
    FROM world_messages m
    JOIN users u ON u.id = m.user_id
    WHERE ($1::BIGINT IS NULL OR m.id < $1)
    ORDER BY m.id DESC
    LIMIT $2
    `,
    [beforeId, safeLimit]
  );

  return result.rows.reverse();
};

exports.deleteOwnMessage = async ({ messageId, userId }) => {
  const result = await pool.query(
    `
    DELETE FROM world_messages
    WHERE id = $1 AND user_id = $2
    RETURNING id
    `,
    [messageId, userId]
  );

  return result.rows[0];
};



exports.getWorldProfile = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      ${PUBLIC_USER_FIELDS},
      u.created_at
    FROM users u
    WHERE u.id = $1
    `,
    [userId]
  );

  return result.rows[0];
};

exports.getOnlineUsers = async (limit = 100) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);

  const result = await pool.query(
    `
    SELECT ${PUBLIC_USER_FIELDS}
    FROM users u
    WHERE u.is_online = TRUE
    ORDER BY u.top_score DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
};


exports.expireStaleRequests = async () => {
  const result = await pool.query(
    `
    UPDATE world_duel_requests
    SET status = 'expired', responded_at = NOW()
    WHERE status = 'pending' AND expires_at <= NOW()
    RETURNING id, sender_id, receiver_id
    `
  );

  return result.rows;
};


exports.createDuelRequest = async ({ senderId, receiverId }) => {
  if (Number(senderId) === Number(receiverId)) return null;


  await pool.query(
    `
    UPDATE world_duel_requests
    SET status = 'expired', responded_at = NOW()
    WHERE status = 'pending'
      AND expires_at <= NOW()
      AND LEAST(sender_id, receiver_id) = LEAST($1::INTEGER, $2::INTEGER)
      AND GREATEST(sender_id, receiver_id) = GREATEST($1::INTEGER, $2::INTEGER)
    `,
    [senderId, receiverId]
  );

  try {
    const result = await pool.query(
      `
      INSERT INTO world_duel_requests (sender_id, receiver_id, expires_at)
      SELECT $1, u.id, NOW() + make_interval(secs => $3)
      FROM users u
      WHERE u.id = $2 AND u.is_online = TRUE
      RETURNING id, sender_id, receiver_id, status, created_at, expires_at
      `,
      [senderId, receiverId, REQUEST_TTL_SECONDS]
    );

    return result.rows[0] || null;
  } catch (err) {
    if (err.code === "23505") {
      const e = new Error("A duel request is already pending between these users");
      e.code = "REQUEST_ALREADY_PENDING";
      throw e;
    }
    throw err;
  }
};

const REQUEST_WITH_USERS = `
  SELECT
    r.id,
    r.status,
    r.duel_id,
    r.created_at,
    r.expires_at,
    r.responded_at,
    s.id AS sender_id,
    s.username AS sender_username,
    s.avatar AS sender_avatar,
    FLOOR(s.xp / 100) + 1 AS sender_level,
    t.id AS receiver_id,
    t.username AS receiver_username,
    t.avatar AS receiver_avatar,
    FLOOR(t.xp / 100) + 1 AS receiver_level
  FROM world_duel_requests r
  JOIN users s ON s.id = r.sender_id
  JOIN users t ON t.id = r.receiver_id
`;

exports.getRequestById = async (requestId) => {
  const result = await pool.query(
    `${REQUEST_WITH_USERS} WHERE r.id = $1`,
    [requestId]
  );

  return result.rows[0];
};

exports.getIncomingRequests = async (userId) => {
  const result = await pool.query(
    `
    ${REQUEST_WITH_USERS}
    WHERE r.receiver_id = $1
      AND r.status = 'pending'
      AND r.expires_at > NOW()
    ORDER BY r.created_at DESC
    `,
    [userId]
  );

  return result.rows;
};

exports.getOutgoingRequests = async (userId) => {
  const result = await pool.query(
    `
    ${REQUEST_WITH_USERS}
    WHERE r.sender_id = $1
      AND r.status = 'pending'
      AND r.expires_at > NOW()
    ORDER BY r.created_at DESC
    `,
    [userId]
  );

  return result.rows;
};


exports.respondToRequest = async ({ requestId, receiverId, accept }) => {
  const result = await pool.query(
    `
    UPDATE world_duel_requests
    SET status = $3, responded_at = NOW()
    WHERE id = $1
      AND receiver_id = $2
      AND status = 'pending'
      AND expires_at > NOW()
    RETURNING id, sender_id, receiver_id, status, responded_at
    `,
    [requestId, receiverId, accept ? "accepted" : "declined"]
  );

  return result.rows[0];
};

exports.cancelRequest = async ({ requestId, senderId }) => {
  const result = await pool.query(
    `
    UPDATE world_duel_requests
    SET status = 'cancelled', responded_at = NOW()
    WHERE id = $1
      AND sender_id = $2
      AND status = 'pending'
    RETURNING id, sender_id, receiver_id, status, responded_at
    `,
    [requestId, senderId]
  );

  return result.rows[0];
};

exports.attachDuel = async ({ requestId, duelId }) => {
  const result = await pool.query(
    `
    UPDATE world_duel_requests
    SET duel_id = $2
    WHERE id = $1 AND status = 'accepted'
    RETURNING id, duel_id
    `,
    [requestId, duelId]
  );

  return result.rows[0];
};

/** Undo an accept when the duel could not be created, so the request is not left stuck. */
exports.revertAcceptedRequest = async ({ requestId }) => {
  const result = await pool.query(
    `
    UPDATE world_duel_requests
    SET status = 'cancelled', responded_at = NOW()
    WHERE id = $1
      AND status = 'accepted'
      AND duel_id IS NULL
    RETURNING id, sender_id, receiver_id, status
    `,
    [requestId]
  );

  return result.rows[0];
};