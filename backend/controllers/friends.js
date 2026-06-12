const Friend = require("../models/Friend");

exports.sendFriendRequest = async (req, res) => {
  try {
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "Receiver ID is required"
      });
    }

    const request =
      await Friend.sendFriendRequest(
        req.user.id,
        receiverId
      );

    return res.status(201).json({
      success: true,
      message: "Friend request sent",
      request
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to send friend request"
    });
  }
};

exports.acceptFriendRequest = async (
  req,
  res
) => {
  try {
    const { requestId } = req.params;

    await Friend.acceptFriendRequest(
      requestId
    );

    return res.status(200).json({
      success: true,
      message: "Friend request accepted"
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to accept friend request"
    });
  }
};

exports.getFriends = async (req, res) => {
  try {
    const friends =
      await Friend.getFriends(
        req.user.id
      );

    return res.status(200).json({
      success: true,
      count: friends.length,
      friends
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch friends"
    });
  }
};

exports.getPendingRequests = async (
  req,
  res
) => {
  try {
    const requests =
      await Friend.getPendingRequests(
        req.user.id
      );

    return res.status(200).json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch requests"
    });
  }
};

exports.removeFriend = async (
  req,
  res
) => {
  try {
    const { friendId } = req.params;

    await Friend.removeFriend(
      req.user.id,
      friendId
    );

    return res.status(200).json({
      success: true,
      message: "Friend removed"
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to remove friend"
    });
  }
};