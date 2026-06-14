const express = require("express");

const router = express.Router();

const verifyToken =
  require("../middlewares/auth");

const {
  getLeaderboard
} = require("../controllers/dashboard");

router.get(
  "/leaderboard",
  verifyToken,
  getLeaderboard
);

module.exports = router;