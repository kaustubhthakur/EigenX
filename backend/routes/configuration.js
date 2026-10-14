const express = require("express");
const router = express.Router();
const {
  startGame,
  startCustomGame,
  getConfigurations,
} = require("../controllers/configuration");
const verifyToken = require("../middlewares/auth");

router.post("/start", verifyToken, startGame);
router.post("/start-custom", verifyToken, startCustomGame);
router.get("/", getConfigurations);

module.exports = router;