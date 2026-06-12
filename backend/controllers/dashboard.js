const Dashboard = require("../models/Dashboard");

exports.getLeaderboard = async (req, res) => {
  try {
    const leaderboard =
      await Dashboard.getLeaderboard();

    return res.status(200).json({
      success: true,
      count: leaderboard.length,
      leaderboard
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch leaderboard"
    });
  }
};