const { canBuild } = require("./questionGenerator");

const OPERATION_NAMES = {
  "+": "addition",
  "-": "subtraction",
  "*": "multiplication",
  "/": "division",
};

// ...keep everything above the final return unchanged...

  const uniqueOps = [...new Set(operations)];

  // canBuild expects camelCase settings
  const probe = {
    leftMinDigits,
    leftMaxDigits,
    rightMinDigits,
    rightMaxDigits,
    decimalPlaces,
  };

  if (
    uniqueOps.includes("*") &&
    leftMaxDigits + rightMaxDigits + decimalPlaces > 15
  ) {
    return {
      error:
        "Multiplication with this many digits is too large. Use fewer digits or decimal places.",
    };
  }

  const impossible = uniqueOps.find((op) => !canBuild(probe, op));
  if (impossible) {
    return {
      error: `These digit settings can't make a ${OPERATION_NAMES[impossible]} question where the first number is larger than the second. Allow more digits for the first number or fewer for the second.`,
    };
  }

  return {
    settings: {
      timer,
      operations: uniqueOps,
      left_min_digits: leftMinDigits,
      left_max_digits: leftMaxDigits,
      right_min_digits: rightMinDigits,
      right_max_digits: rightMaxDigits,
      decimal_places: decimalPlaces,
    },
  };