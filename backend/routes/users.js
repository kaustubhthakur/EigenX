const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/auth");
const upload = require("../middlewares/upload");
const {
  getProfile,
  getUserById,
  getAllUsers,
  updateProfile,
  updateScore,
  uploadAvatar
} 
= require("../controllers/users");

router.get("/Profile", verifyToken, getProfile);
router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.put("/:profile", verifyToken, updateProfile);
router.put("/score", verifyToken, updateScore);
router.post(
  "/avatar",
  verifyToken,
  (req, res, next) => {
    upload.single("avatar")(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message });
      next();
    });
  },
  uploadAvatar
);
module.exports = router;