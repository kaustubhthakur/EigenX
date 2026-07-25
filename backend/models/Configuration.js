const pool = require("../db");

exports.getAllConfigurations = async () => {
  const result = await pool.query(`
    SELECT
      id,
      level,
      timer
    FROM configurations
    ORDER BY level, timer
  `);

  return result.rows;
};

exports.getConfiguration = async (level, timer) => {
  const result = await pool.query(
    `
    SELECT
      id,
      level,
      timer
    FROM configurations
    WHERE level = $1
      AND timer = $2
    `,
    [level, timer]
  );

  return result.rows[0];
};