const express = require("express");
const router = express.Router();

const verifyToken = require("../middlewares/auth");

const {
  getProfile,
  getUserById,
  getAllUsers,
  updateProfile,
  updateOnlineStatus,
  updateScore
} = require("../controllers/userController");

router.get("/me", verifyToken, getProfile);

router.get("/", getAllUsers);

router.get("/:id", getUserById);

router.put("/profile", verifyToken, updateProfile);

router.put("/online-status", verifyToken, updateOnlineStatus);

router.put("/score", verifyToken, updateScore);

module.exports = router;