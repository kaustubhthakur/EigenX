const express = require("express");
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const { Server } = require("socket.io");
const pool = require("./db");
const authrouter = require("./routes/auth");
const userrouter = require("./routes/users")
const dashboardrouter = require('./routes/dashboard')
const PORT = process.env.PORT || 8081;
const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use("/auth", authrouter);
app.use("/users",userrouter)
app.use("/dashboard",dashboardrouter)
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "ok",
      db: "connected"
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      db: "disconnected",
      message: err.message
    });
  }
});
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    credentials: true
  }
});
io.on("connection", async (socket) => {
  console.log("User connected");

  const userId = socket.handshake.auth.userId;
  if (userId) {
    await pool.query(
      `
      UPDATE users
      SET is_online = true
      WHERE id = $1
      `,
      [userId]
    );
  }

  socket.on("disconnect", async () => {
    console.log("User disconnected");

    if (userId) {
      await pool.query(
        `
        UPDATE users
        SET
          is_online = false,
          last_seen = NOW()
        WHERE id = $1
        `,
        [userId]
      );
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});