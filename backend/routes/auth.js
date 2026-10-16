
const express = require("express");
const router = express.Router();

const {
  login,
  register,
  logout,
  verifyOtp,
} = require("../controllers/auth");

const verifyToken = require("../middlewares/auth");

router.post("/register", register);
router.post("/login", login);
router.post("/verifyOtp", verifyOtp);
router.post("/logout", verifyToken, logout);

module.exports = router;
