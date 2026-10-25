const pool = require("../db");


const STANDARD_LEVELS = [1, 2];


const STANDARD_LEVEL = 1;

exports.STANDARD_LEVELS = STANDARD_LEVELS;
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
    WHERE level = ANY($1)
       OR is_custom = TRUE
    ORDER BY level, timer
    `,
    [STANDARD_LEVELS]
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