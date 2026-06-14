const calculationModel = require("../models/Calculation");
const userModel = require("../models/User");

const activeGames = new Map();

function randomDigits(minDigits, maxDigits) {
  const digits =
    Math.floor(
      Math.random() *
        (maxDigits - minDigits + 1)
    ) + minDigits;

  const min =
    digits === 1
      ? 0
      : Math.pow(10, digits - 1);

  const max =
    Math.pow(10, digits) - 1;

  return (
    Math.floor(
      Math.random() * (max - min + 1)
    ) + min
  );
}

async function generateQuestion(level) {
  const calculations =
    await calculationModel.getCalculationsByLevel(
      level
    );

  const config =
    calculations[
      Math.floor(
        Math.random() * calculations.length
      )
    ];

  let left = randomDigits(
    config.left_min_digits,
    config.left_max_digits
  );

  let right = randomDigits(
    config.right_min_digits,
    config.right_max_digits
  );

  if (
    config.operation === "/" &&
    right === 0
  ) {
    right = 1;
  }

  let answer;

  switch (config.operation) {
    case "+":
      answer = left + right;
      break;

    case "-":
      answer = left - right;
      break;

    case "*":
      answer = left * right;
      break;

    case "/":
      answer = Number(
        (
          left / right
        ).toFixed(
          config.decimal_places || 0
        )
      );
      break;
  }

  return {
    question: `${left} ${config.operation} ${right}`,
    answer
  };
}