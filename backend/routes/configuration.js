const express = require("express");
const router = express.Router();
const {startGame} = require('../controllers/configuration')
const verifyToken = require("../middlewares/auth");
router.post('/start',verifyToken,startGame);
module.exports = router;