const pool = require("../db");

exports.getLeaderboard = async () => {
  const result = await pool.query(`
    SELECT
      RANK() OVER (
        ORDER BY top_score DESC
      ) AS rank,
      id,
      username,
      avatar,
      FLOOR(xp / 500) + 1 AS level,
      top_score,
      difficulty_level,
      is_online
    FROM users
    ORDER BY top_score DESC
  `);

  return result.rows;
};