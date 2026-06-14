const pool = require("../db");

exports.createUser = async ({
  username,
  email,
  password
}) => {
  const result = await pool.query(
    `
    INSERT INTO users (
      username,
      email,
      password,
      avatar,
      is_online,
      top_score,
      xp
    )
    VALUES (
      $1,
      $2,
      $3,
      NULL,
      FALSE,
      0,
      0
    )
    RETURNING
      id,
      username,
      email,
      avatar,
      is_online,
      last_seen,
      top_score,
      xp,
      created_at
    `,
    [username, email, password]
  );

  return result.rows[0];
};

exports.getUserWithLevel = async (id) => {
  const result = await pool.query(
    `
    SELECT
      id,
      username,
      email,
      avatar,
      is_online,
      last_seen,
      top_score,
      xp,
      FLOOR(xp / 100) + 1 AS level,
      created_at
    FROM users
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0];
};

exports.findUserByEmail = async (email) => {
  const result = await pool.query(
    `
    SELECT *
    FROM users
    WHERE email = $1
    `,
    [email]
  );

  return result.rows[0];
};

exports.findUserByUsername = async (username) => {
  const result = await pool.query(
    `
    SELECT *
    FROM users
    WHERE username = $1
    `,
    [username]
  );

  return result.rows[0];
};

exports.findUserById = async (id) => {
  const result = await pool.query(
    `
    SELECT *
    FROM users
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0];
};

exports.getUser = async (id) => {
  const result = await pool.query(
    `
    SELECT
      id,
      username,
      email,
      avatar,
      is_online,
      last_seen,
      top_score,
      xp,
      created_at
    FROM users
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0];
};

exports.getAllUsers = async () => {
  const result = await pool.query(
    `
    SELECT
      id,
      username,
      email,
      avatar,
      is_online,
      last_seen,
      top_score,
      xp,
      created_at
    FROM users
    ORDER BY top_score DESC
    `
  );

  return result.rows;
};

exports.updateUser = async (
  id,
  {
    username,
    avatar
  }
) => {
  const result = await pool.query(
    `
    UPDATE users
    SET
      username = COALESCE($1, username),
      avatar = COALESCE($2, avatar)
    WHERE id = $3
    RETURNING
      id,
      username,
      email,
      avatar,
      is_online,
      last_seen,
      top_score,
      xp,
      created_at
    `,
    [username, avatar, id]
  );

  return result.rows[0];
};

exports.updateOnlineStatus = async (
  userId,
  isOnline
) => {
  const result = await pool.query(
    `
    UPDATE users
    SET
      is_online = $1,
      last_seen = NOW()
    WHERE id = $2
    RETURNING *
    `,
    [isOnline, userId]
  );

  return result.rows[0];
};

exports.updateScoreAndXp = async (
  userId,
  score,
  xp
) => {
  const result = await pool.query(
    `
    UPDATE users
    SET
      top_score = GREATEST(top_score, $1),
      xp = xp + $2
    WHERE id = $3
    RETURNING
      id,
      username,
      email,
      avatar,
      is_online,
      last_seen,
      top_score,
      xp,
      created_at
    `,
    [score, xp, userId]
  );

  return result.rows[0];
};

exports.saveLoginOtp = async (
  userId,
  otp,
  expiresAt
) => {
  await pool.query(
    `
    INSERT INTO login_otps (
      user_id,
      otp,
      expires_at
    )
    VALUES ($1, $2, $3)
    `,
    [userId, otp, expiresAt]
  );
};

exports.getLatestOtp = async (userId) => {
  const result = await pool.query(
    `
    SELECT *
    FROM login_otps
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0];
};

exports.deleteOtp = async (userId) => {
  await pool.query(
    `
    DELETE FROM login_otps
    WHERE user_id = $1
    `,
    [userId]
  );
};