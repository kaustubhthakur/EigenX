const pool = require("../db");

// The only fixed (non-custom) level players can use.
// Levels 2 and 3 stay in the database but are hidden.
const STANDARD_LEVEL = 1;

exports.STANDARD_LEVEL = STANDARD_LEVEL;

exports.getAllConfigurations = async () => {
  const result = await pool.query(
    `
    SELECT
      id,
      level,
      timer,
      is_custom
    FROM configurations
    WHERE level = $1
       OR is_custom = TRUE
    ORDER BY level, timer
    `,
    [STANDARD_LEVEL]
  );

  return result.rows;
};

exports.getConfiguration = async (level, timer) => {
  const result = await pool.query(
    `
    SELECT
      id,
      level,
      timer,
      is_custom
    FROM configurations
    WHERE level = $1
      AND timer = $2
    `,
    [level, timer]
  );

  return result.rows[0];
};

exports.getCustomConfiguration = async () => {
  const result = await pool.query(
    `
    SELECT id, level, timer, is_custom
    FROM configurations
    WHERE is_custom = TRUE
    LIMIT 1
    `
  );

  return result.rows[0];
};