const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User")

const register = async (req, res) => {
  try {
   const { username, email, password } = req.body;
    const existingEmail = await User.findUserByEmail(email);     
    const existingUsername = await User.findUserByUsername(username);
    if (existingEmail) {
      return res.status(400).json({ error: "Email already exists" });
    }

    if (existingUsername) {
      return res.status(400).json({ error: "Username already taken" });
    }
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    const newUser = await User.createUser({ 
      username,
      email,
      password: hash,
    });

    res.status(201).json({ message: "User has been created", user: newUser });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findUserByEmail(email);

    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

  const token = jwt.sign(
  { id: user.id, username: user.username, isAdmin: user.isAdmin || false },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

    const { password: _, ...userData } = user;

    res
      .cookie("access_token", token, {
        httpOnly: true,
        secure: true,      
        sameSite: "strict", 
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .status(200)
      .json({
        message: "Logged in successfully",
        user: userData,
      });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
const logout = (req, res) => {
  res.clearCookie("access_token", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  }).status(200).json({ message: "Logged out successfully" });
};

module.exports = {register,login,logout}