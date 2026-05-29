const pool = require("../db");

exports.createUser = async ({ username, email, password }) => {
  const res = await pool.query(
    "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *",
    [username, email, password] 
  );
  return res.rows[0];
};
exports.findUserByEmail = async (email) => {
  const res = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );
  return res.rows[0];
};
exports.getUser = async (id) => {
  const result = await pool.query(
    `SELECT id, username, email, profile_pic, favorite_team, created_at 
     FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0];
};

exports.getAllUsers = async () => {
  const result = await pool.query(
    `SELECT id, username, email, profile_pic, favorite_team, created_at 
     FROM users`
  );
  return result.rows;
};
exports.updateUser = async (id, { profile_pic, favorite_team }) => {
  const result = await pool.query(
    `UPDATE users
     SET profile_pic = COALESCE($1, profile_pic),
         favorite_team = COALESCE($2, favorite_team)
     WHERE id = $3
     RETURNING id, username, email, profile_pic, favorite_team, created_at`,
    [profile_pic, favorite_team, id]
  );

  return result.rows[0];
};
exports.findUserByUsername = async (username) => {
  const res = await pool.query(
    "SELECT * FROM users WHERE username=$1",
    [username]
  );
  return res.rows[0];
};