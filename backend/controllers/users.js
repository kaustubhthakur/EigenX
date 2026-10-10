const User = require("../models/User");
const cloudinary = require("../config/cloudinary");

const calculateLevel = (xp) => {
  return Math.floor(xp / 500) + 1;
};
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const updatedUser = await User.updateUser(req.user.id, { avatar: avatarUrl });

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Avatar uploaded successfully",
      user: { ...updatedUser, level: calculateLevel(updatedUser.xp) },
    });
  } catch (error) {
    console.error("Cloudinary avatar upload error:", error);

  return res.status(500).json({
    success: false,
    message: error.message || "Failed to upload avatar",
  });
  }
};
exports.getProfile = async (req, res) => {
  try {
    const user = await User.getUser(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        ...user,
        level: calculateLevel(user.xp)
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

    return res.status(200).json({
      success: true,
      user: {
        ...user,
        level: calculateLevel(user.xp)
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
      level: calculateLevel(user.xp)
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


exports.uploadAvatar = async (req, res) => {
  try {
    const { image } = req.body;

    if (!image || typeof image !== "string") {
      return res.status(400).json({
        success: false,
        message: "Please provide an image",
      });
    }

    // Upload directly to Cloudinary
    const result = await cloudinary.uploader.upload(image, {
      folder: "avatars",
      public_id: `avatar-${req.user.id}`,
      overwrite: true,
      resource_type: "image",
    });

    // Save Cloudinary URL to the database
    const updatedUser = await User.updateUser(req.user.id, {
      avatar: result.secure_url,
    });

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Avatar uploaded successfully",
      avatar: result.secure_url,
      user: {
        ...updatedUser,
        level: calculateLevel(updatedUser.xp),
      },
    });
  } catch (error) {
    console.error("Cloudinary avatar upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload avatar",
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

    return res.status(200).json({
      success: true,
      message: "Score updated successfully",
      user: {
        ...user,
        level: calculateLevel(user.xp)
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