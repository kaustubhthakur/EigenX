const express = require("express");
const router = express.Router();
const calculationController = require("../controllers/calculations");
router.get(
  "/",
  calculationController.getAllCalculations
);
router.get(
  "/level/:level",
  calculationController.getCalculationsByLevel
);

module.exports = router;