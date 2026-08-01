const express = require("express");
const router = express.Router();
const {startGame,getConfigurations} = require('../controllers/configuration')
const verifyToken = require("../middlewares/auth");
router.post('/start',verifyToken,startGame);
router.get("/", getConfigurations);
module.exports = router;