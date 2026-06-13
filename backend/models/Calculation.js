const pool = require("../db");

exports.getAllCalculations = async () => {
  const result = await pool.query(`
    SELECT
      id,
      name,
      operation,
      difficulty_level,
      left_min_digits,
      left_max_digits,
      right_min_digits,
      right_max_digits,
      decimal_places,
      is_active
    FROM calculations
    WHERE is_active = true
    ORDER BY difficulty_level, id
  `);

  return result.rows;
};

exports.getCalculationsByLevel = async (difficultyLevel) => {
  const result = await pool.query(
    `
    SELECT
      id,
      name,
      operation,
      difficulty_level,
      left_min_digits,
      left_max_digits,
      right_min_digits,
      right_max_digits,
      decimal_places
    FROM calculations
    WHERE difficulty_level = $1
      AND is_active = true
    ORDER BY id
    `,
    [difficultyLevel]
  );

  return result.rows;
};

exports.getCalculationById = async (id) => {
  const result = await pool.query(
    `
    SELECT *
    FROM calculations
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0];
};