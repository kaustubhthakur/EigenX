const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        error: "Username, email and password are required",
      });
    }

    const existingEmail =
      await User.findUserByEmail(email);

    if (existingEmail) {
      return res.status(400).json({
        error: "Email already exists",
      });
    }

    const existingUsername =
      await User.findUserByUsername(username);

    if (existingUsername) {
      return res.status(400).json({
        error: "Username already taken",
      });
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const user = await User.createUser({
      username,
      email,
      password: hashedPassword,
    });

    return res.status(201).json({
      message: "User created successfully",
      user,
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message,
    });
  }
};
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user =
      await User.findUserByEmail(email);

    if (!user) {
      return res.status(400).json({
        error: "Invalid email or password",
      });
    }

    const valid = await bcrypt.compare(
      password,
      user.password
    );

    if (!valid) {
      return res.status(400).json({
        error: "Invalid email or password",
      });
    }

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const hashedOtp =
      await bcrypt.hash(otp, 10);

    const expiresAt =
      new Date(Date.now() + 5 * 60 * 1000);

    await User.deleteOtp(user.id);

    await User.saveLoginOtp(
      user.id,
      hashedOtp,
      expiresAt
    );

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Login OTP",
      html: `
        <h2>Your Login OTP</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>This OTP expires in 5 minutes.</p>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "OTP sent to your email",
      userId: user.id,
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message,
    });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({
        error: "userId and otp are required",
      });
    }

    const record =
      await User.getLatestOtp(userId);

    if (!record) {
      return res.status(400).json({
        error: "OTP not found",
      });
    }

    if (
      new Date() >
      new Date(record.expires_at)
    ) {
      await User.deleteOtp(userId);

      return res.status(400).json({
        error: "OTP expired",
      });
    }

    const validOtp =
      await bcrypt.compare(
        otp,
        record.otp
      );

    if (!validOtp) {
      return res.status(400).json({
        error: "Invalid OTP",
      });
    }

    const user =
      await User.findUserById(userId);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    await User.deleteOtp(userId);

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        isAdmin: user.isadmin || false,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    const { password, ...userData } = user;

    return res
      .cookie("access_token", token, {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "strict",
        maxAge:
          7 * 24 * 60 * 60 * 1000,
      })
      .status(200)
      .json({
        success: true,
        message:
          "Logged in successfully",
        token,
        user: userData,
      });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message,
    });
  }
};

const logout = (req, res) => {
  return res
    .clearCookie("access_token", {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "strict",
    })
    .status(200)
    .json({
      message: "Logged out successfully",
    });
};

module.exports = {
  register,
  login,
  verifyOtp,
  logout,
};