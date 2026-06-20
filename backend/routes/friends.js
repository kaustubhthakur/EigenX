const express = require("express");

const router = express.Router();

const verifyToken =
  require("../middlewares/auth");

const friendController =
  require("../controllers/friends");

router.post(
  "/request",
  verifyToken,
  friendController.sendFriendRequest
);

router.put(
  "/accept/:requestId",
  verifyToken,
  friendController.acceptFriendRequest
);
router.get(
  "/",
  verifyToken,
  friendController.getFriends
);

router.get(
  "/requests",
  verifyToken,
  friendController.getPendingRequests
);

router.delete(
  "/:friendId",
  verifyToken,
  friendController.removeFriend
);

module.exports = router;