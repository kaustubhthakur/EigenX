const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/auth");

const {
  getProfile,
  getUserById,
  getAllUsers,
  updateProfile,
  updateScore
} 
= require("../controllers/users");

router.get("/Profile", verifyToken, getProfile);
router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.put("/:profile", verifyToken, updateProfile);
router.put("/score", verifyToken, updateScore);
module.exports = router;