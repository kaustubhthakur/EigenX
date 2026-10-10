
const express = require("express");
const router = express.Router();

const verifyToken = require("../middlewares/auth");

const {
  getProfile,
  getUserById,
  getAllUsers,
  updateScore,
  uploadAvatar,
} = require("../controllers/users");

router.get("/Profile", verifyToken, getProfile);
router.get("/", getAllUsers);


router.put("/score", verifyToken, updateScore);
router.post("/avatar", verifyToken, uploadAvatar);

router.get("/:id", getUserById);

module.exports = router;
