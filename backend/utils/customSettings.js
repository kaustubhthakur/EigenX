const ALLOWED_OPERATIONS = ["+", "-", "*", "/"];
const MAX_DIGITS = 8;
const MAX_TIMER = 600;
const MAX_DECIMALS = 4;

// JavaScript integers are exact only up to about 9e15. A product of an
// N-digit and an M-digit number has at most N + M digits, so keeping
// N + M at 15 or less keeps the stored answer exact.
const MAX_PRODUCT_DIGITS = 15;

exports.validateCustomSettings = (input = {}) => {
  const {
    timer,
    operations,
    leftMinDigits,
    leftMaxDigits,
    rightMinDigits,
    rightMaxDigits,
    decimalPlaces = 0,
  } = input;

  const isInt = Number.isInteger;

  if (!isInt(timer) || timer <= 15 || timer > MAX_TIMER) {
    return { error: `Timer must be an integer greater than 15 (max ${MAX_TIMER}).` };
  }

  if (
    !Array.isArray(operations) ||
    operations.length === 0 ||
    !operations.every((op) => ALLOWED_OPERATIONS.includes(op))
  ) {
    return { error: "Choose at least one valid operation (+, -, *, /)." };
  }

  const digitFields = { leftMinDigits, leftMaxDigits, rightMinDigits, rightMaxDigits };
  for (const [name, value] of Object.entries(digitFields)) {
    if (!isInt(value) || value < 2 || value > MAX_DIGITS) {
      return { error: `${name} must be an integer between 2 and ${MAX_DIGITS}.` };
    }
  }

  if (leftMaxDigits < leftMinDigits || rightMaxDigits < rightMinDigits) {
    return { error: "Max digits cannot be less than min digits." };
  }

  if (!isInt(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > MAX_DECIMALS) {
    return { error: `Decimal places must be between 0 and ${MAX_DECIMALS}.` };
  }

  const uniqueOps = [...new Set(operations)];

  // Prevent answers that are too large to store exactly
  if (uniqueOps.includes("*") && leftMaxDigits + rightMaxDigits > MAX_PRODUCT_DIGITS) {
    return {
      error: "Multiplication with this many digits is too large. Use fewer digits.",
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
};