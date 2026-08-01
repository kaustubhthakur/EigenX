const Configuration = require("../models/Configuration");
const Game = require("../models/Game");

exports.startGame = async (req, res) => {
  try {
    const { level, timer } = req.body;

    if (!level || !timer) {
      return res.status(400).json({
        success: false,
        message: "Level and timer are required"
      });
    }

    const configuration = await Configuration.getConfiguration(level, timer);

    if (!configuration) {
      return res.status(404).json({
        success: false,
        message: "Invalid configuration"
      });
    }

    const session = await Game.createGameSession(
      req.user.id,
      configuration.id
    );

    return res.status(200).json({
      success: true,
      message: "Game session created",
      sessionId: session.id
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.getConfigurations = async (req, res) => {
  try {
    const configs = await Configuration.getAllConfigurations();
    return res.status(200).json({ success: true, configurations: configs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};