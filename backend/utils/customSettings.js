const ALLOWED_OPERATIONS = ["+", "-", "*", "/"];
const MAX_DIGITS = 8;
const MAX_TIMER = 600;
const MAX_DECIMALS = 4;

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

  return {
    settings: {
      timer,
      operations: [...new Set(operations)],
      left_min_digits: leftMinDigits,
      left_max_digits: leftMaxDigits,
      right_min_digits: rightMinDigits,
      right_max_digits: rightMaxDigits,
      decimal_places: decimalPlaces,
    },
  };
};