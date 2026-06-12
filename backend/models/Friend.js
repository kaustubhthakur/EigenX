const pool = require("../db");

exports.sendFriendRequest = async (
  senderId,
  receiverId
) => {
  const result = await pool.query(
    `
    INSERT INTO friend_requests (
      sender_id,
      receiver_id
    )
    VALUES ($1, $2)
    RETURNING *
    `,
    [senderId, receiverId]
  );

  return result.rows[0];
};
exports.acceptFriendRequest = async (
  requestId
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const request = await client.query(
      `
      SELECT *
      FROM friend_requests
      WHERE id = $1
      `,
      [requestId]
    );

    if (!request.rows.length) {
      throw new Error("Request not found");
    }

    const {
      sender_id,
      receiver_id
    } = request.rows[0];

    await client.query(
      `
      INSERT INTO friends (
        user_id,
        friend_id
      )
      VALUES
      ($1, $2),
      ($2, $1)
      `,
      [sender_id, receiver_id]
    );

    await client.query(
      `
      UPDATE friend_requests
      SET status = 'accepted'
      WHERE id = $1
      `,
      [requestId]
    );

    await client.query("COMMIT");

    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
exports.getFriends = async (
  userId
) => {
  const result = await pool.query(
    `
    SELECT
      u.id,
      u.username,
      u.avatar,
      u.is_online,
      u.top_score,
      FLOOR(u.xp / 500) + 1 AS level
    FROM friends f
    JOIN users u
      ON u.id = f.friend_id
    WHERE f.user_id = $1
    ORDER BY u.username
    `,
    [userId]
  );

  return result.rows;
};
exports.getPendingRequests = async (
  userId
) => {
  const result = await pool.query(
    `
    SELECT
      fr.id,
      u.id AS sender_id,
      u.username,
      u.avatar,
      fr.created_at
    FROM friend_requests fr
    JOIN users u
      ON u.id = fr.sender_id
    WHERE fr.receiver_id = $1
      AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
    `,
    [userId]
  );

  return result.rows;
};

exports.removeFriend = async (
  userId,
  friendId
) => {
  await pool.query(
    `
    DELETE FROM friends
    WHERE
      (user_id = $1 AND friend_id = $2)
      OR
      (user_id = $2 AND friend_id = $1)
    `,
    [userId, friendId]
  );
};