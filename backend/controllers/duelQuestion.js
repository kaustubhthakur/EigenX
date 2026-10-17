
const ALLOWED_OPERATIONS = ["+", "-", "*", "/"];

const LIMITS = {
  timer: [10, 600],
  digits: [1, 6],
  decimalPlaces: [0, 3]
};

const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const round = (n, decimals) => Number(n.toFixed(decimals));

const format = (n, decimals) =>
  decimals > 0 ? n.toFixed(decimals) : String(n);

const toInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
};

const inRange = (n, [min, max]) =>
  Number.isInteger(n) && n >= min && n <= max;


function normalizeCustomSettings(input) {
  if (input === undefined || input === null) {
    return { ok: true, value: null };
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "customSettings must be an object" };
  }

  const timer = toInt(input.timer);
  const leftMinDigits = toInt(input.leftMinDigits);
  const leftMaxDigits = toInt(input.leftMaxDigits);
  const rightMinDigits = toInt(input.rightMinDigits);
  const rightMaxDigits = toInt(input.rightMaxDigits);
  const decimalPlaces = toInt(input.decimalPlaces ?? 0);

  if (!inRange(timer, LIMITS.timer)) {
    return {
      ok: false,
      message: `Time limit must be between ${LIMITS.timer[0]} and ${LIMITS.timer[1]} seconds`
    };
  }

  const digitValues = [
    leftMinDigits,
    leftMaxDigits,
    rightMinDigits,
    rightMaxDigits
  ];

  if (!digitValues.every((d) => inRange(d, LIMITS.digits))) {
    return {
      ok: false,
      message: `Digits must be between ${LIMITS.digits[0]} and ${LIMITS.digits[1]}`
    };
  }

  if (leftMinDigits > leftMaxDigits || rightMinDigits > rightMaxDigits) {
    return {
      ok: false,
      message: "Minimum digits cannot be greater than maximum digits"
    };
  }

  if (!inRange(decimalPlaces, LIMITS.decimalPlaces)) {
    return {
      ok: false,
      message: `Decimal places must be between ${LIMITS.decimalPlaces[0]} and ${LIMITS.decimalPlaces[1]}`
    };
  }

  if (
    !Array.isArray(input.operations) ||
    input.operations.length === 0 ||
    !input.operations.every((op) => ALLOWED_OPERATIONS.includes(op))
  ) {
    return {
      ok: false,
      message: "Choose at least one operation (+, -, *, /)"
    };
  }

  const operations = ALLOWED_OPERATIONS.filter((op) =>
    input.operations.includes(op)
  );

  return {
    ok: true,
    value: {
      timer,
      operations,
      leftMinDigits,
      leftMaxDigits,
      rightMinDigits,
      rightMaxDigits,
      decimalPlaces
    }
  };
}

const randomOperand = (minDigits, maxDigits, decimals) => {
  const digits = randInt(minDigits, maxDigits);
  const low = digits === 1 ? 1 : 10 ** (digits - 1);
  const high = 10 ** digits - 1;
  const whole = randInt(low, high);

  if (!decimals) return whole;

  const fraction = randInt(0, 10 ** decimals - 1) / 10 ** decimals;
  return round(whole + fraction, decimals);
};


function buildQuestion(settings) {
  if (!settings) {
    const a = randInt(1, 20);
    const b = randInt(1, 20);
    const operator = ["+", "-", "*"][randInt(0, 2)];

    let answer;
    if (operator === "+") answer = a + b;
    else if (operator === "-") answer = a - b;
    else answer = a * b;

    return { question: `${a} ${operator} ${b}`, answer };
  }

  const {
    operations,
    leftMinDigits,
    leftMaxDigits,
    rightMinDigits,
    rightMaxDigits,
    decimalPlaces
  } = settings;

  const operator = operations[randInt(0, operations.length - 1)];
  const dp = decimalPlaces;

  let a;
  let b;
  let answer;
  let bDecimals = 0;

  if (operator === "+" || operator === "-") {
  
    a = randomOperand(leftMinDigits, leftMaxDigits, dp);
    b = randomOperand(rightMinDigits, rightMaxDigits, dp);
    bDecimals = dp;
    answer = round(operator === "+" ? a + b : a - b, dp);
  } else if (operator === "*") {
 
    a = randomOperand(leftMinDigits, leftMaxDigits, dp);
    b = randomOperand(rightMinDigits, rightMaxDigits, 0);
    answer = round(a * b, dp);
  } else {

    b = randomOperand(rightMinDigits, rightMaxDigits, 0);
    answer = randomOperand(leftMinDigits, leftMaxDigits, dp);
    a = round(answer * b, dp);
  }

  return {
    question: `${format(a, dp)} ${operator} ${format(b, bDecimals)}`,
    answer
  };
}

module.exports = {
  ALLOWED_OPERATIONS,
  normalizeCustomSettings,
  buildQuestion
};