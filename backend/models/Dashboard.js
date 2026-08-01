const pool = require("../db");

exports.getLeaderboard = async () => {
  const result = await pool.query(`
    SELECT
      RANK() OVER (
        ORDER BY top_score DESC, xp DESC
      ) AS rank,
      id,
      username,
      avatar,
      xp,
      FLOOR(xp / 500) + 1 AS level,
      top_score,
      top_score_at,
      difficulty_level,
      is_online
    FROM users
    ORDER BY top_score DESC, xp DESC
  `);

  return result.rows;
};