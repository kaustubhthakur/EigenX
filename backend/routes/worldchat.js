const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/auth");
const {
  getMessages,
  postMessage,
  deleteMessage,
  getOnlineUsers,
  getProfile,
  sendDuelRequest,
  getIncoming,
  getOutgoing,
  acceptDuelRequest,
  declineDuelRequest,
  cancelDuelRequest,
} = require("../controllers/worldchat");

// Messages
router.get("/messages", verifyToken, getMessages);
router.post("/messages", verifyToken, postMessage);
router.delete("/messages/:id", verifyToken, deleteMessage);

// People
router.get("/online", verifyToken, getOnlineUsers);
router.get("/users/:id", verifyToken, getProfile);

// Duel requests
router.post("/duels", verifyToken, sendDuelRequest);
router.get("/duels/incoming", verifyToken, getIncoming);
router.get("/duels/outgoing", verifyToken, getOutgoing);
router.post("/duels/:id/accept", verifyToken, acceptDuelRequest);
router.post("/duels/:id/decline", verifyToken, declineDuelRequest);
router.delete("/duels/:id", verifyToken, cancelDuelRequest);

module.exports = router;

