const calculationModel = require("../models/Calculation");

exports.getAllCalculations = async (req, res) => {
  try {
    const calculations =
      await calculationModel.getAllCalculations();

    res.json(calculations);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
};

exports.getCalculationsByLevel = async (req, res) => {
  try {
    const { level } = req.params;

    const calculations =
      await calculationModel.getCalculationsByLevel(
        Number(level)
      );

    res.json(calculations);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
};