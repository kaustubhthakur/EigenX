const express = require('express')
const router = express.Router();
const {login,register,logout,verifyOtp} = require('../controllers/auth')
router.post('/register',register);
router.post('/login',login);
router.post('/logout',logout)
router.post('/verifyOtp',verifyOtp);
module.exports = router;