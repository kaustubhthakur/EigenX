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
} = require("../controllers/users");

router.get("/Profike", verifyToken, getProfile);
router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.put("/:profile", verifyToken, updateProfile);
router.put("/online-status", verifyToken, updateOnlineStatus);
router.put("/score", verifyToken, updateScore);
module.exports = router;