const User = require("../models/User");

exports.getProfile = async (req, res) => {
  try {
    const user = await User.getUser(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const level = Math.floor(user.xp / 100) + 1;

    return res.status(200).json({
      success: true,
      user: {
        ...user,
        level
      }
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile"
    });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const level = Math.floor(user.xp / 100) + 1;

    return res.status(200).json({
      success: true,
      user: {
        ...user,
        level
      }
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user"
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.getAllUsers();

    const formattedUsers = users.map((user) => ({
      ...user,
      level: Math.floor(user.xp / 100) + 1
    }));

    return res.status(200).json({
      success: true,
      count: formattedUsers.length,
      users: formattedUsers
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users"
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { username, avatar } = req.body;

    const updatedUser = await User.updateUser(
      req.user.id,
      {
        username,
        avatar
      }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to update profile"
    });
  }
};

exports.updateScore = async (req, res) => {
  try {
    const { score, xp } = req.body;

    const user = await User.updateScoreAndXp(
      req.user.id,
      score,
      xp
    );

    const level = Math.floor(user.xp / 100) + 1;

    return res.status(200).json({
      success: true,
      message: "Score updated successfully",
      user: {
        ...user,
        level
      }
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to update score"
    });
  }
};