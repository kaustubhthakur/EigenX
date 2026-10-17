

const ALLOWED_OPERATIONS = ["+", "-", "*", "/"];

const OPERATION_NAMES = {
  "+": "addition",
  "-": "subtraction",
  "*": "multiplication",
  "/": "division"
};

const LIMITS = {
  timer: [10, 600],
  digits: [1, 6],
  decimalPlaces: [0, 3]
};

const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pow10 = (n) => 10 ** n;


const lowWhole = (digits) => (digits === 1 ? 2 : pow10(digits - 1));
const highWhole = (digits) => pow10(digits) - 1;

const toInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
};

const inRange = (n, [min, max]) =>
  Number.isInteger(n) && n >= min && n <= max;


const fromScaled = (scaled, decimals) =>
  decimals > 0 ? (scaled / pow10(decimals)).toFixed(decimals) : String(scaled);

const answerFromScaled = (scaled, decimals) =>
  Number((scaled / pow10(decimals)).toFixed(decimals));


const secondScale = (operator, S) =>
  operator === "+" || operator === "-" ? S : 1;


function firstNumberOptions(settings, yScaled, S) {
  const options = [];

  for (let d = settings.leftMinDigits; d <= settings.leftMaxDigits; d++) {
    const low = Math.max(lowWhole(d) * S, yScaled + 1);
    const high = pow10(d) * S - 1;
    if (low <= high) options.push([low, high]);
  }

  return options;
}


function divisionOptions(settings, y, S) {
  const options = [];

  for (let d = settings.leftMinDigits; d <= settings.leftMaxDigits; d++) {
    const low = Math.max(Math.ceil((lowWhole(d) * S) / y), S + 1);
    const high = Math.floor((pow10(d) * S - 1) / y);
    if (low <= high) options.push([low, high]);
  }

  return options;
}


function canBuild(settings, operator) {
  const S = pow10(settings.decimalPlaces);
  const yScale = secondScale(operator, S);
  const unit = S / yScale;

  for (let d = settings.rightMinDigits; d <= settings.rightMaxDigits; d++) {
    const y = lowWhole(d) * yScale;

    const options =
      operator === "/"
        ? divisionOptions(settings, y, S)
        : firstNumberOptions(settings, y * unit, S);

    if (options.length > 0) return true;
  }

  return false;
}


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

  const value = {
    timer,
    operations,
    leftMinDigits,
    leftMaxDigits,
    rightMinDigits,
    rightMaxDigits,
    decimalPlaces
  };

  const impossible = operations.find((op) => !canBuild(value, op));

  if (impossible) {
    return {
      ok: false,
      message: `These digit settings can't make a ${OPERATION_NAMES[impossible]} question where the first number is larger than the second. Allow more digits for the first number or fewer for the second.`
    };
  }

  return { ok: true, value };
}


function standardQuestion() {
  const y = randInt(2, 19);
  const x = randInt(y + 1, 20);
  const operator = ["+", "-", "*"][randInt(0, 2)];

  let answer;
  if (operator === "+") answer = x + y;
  else if (operator === "-") answer = x - y;
  else answer = x * y;

  return { question: `${x} ${operator} ${y}`, answer };
}

// Returns { question, answer }.
function buildQuestion(settings) {
  if (!settings) return standardQuestion();

  const dp = settings.decimalPlaces;
  const S = pow10(dp);
  const operator =
    settings.operations[randInt(0, settings.operations.length - 1)];

  const yScale = secondScale(operator, S);
  const unit = S / yScale; // converts y's own units into 1/S units
  const maxXScaled = pow10(settings.leftMaxDigits) * S - 1;

  for (let attempt = 0; attempt < 500; attempt++) {

    const dY = randInt(settings.rightMinDigits, settings.rightMaxDigits);
    const yLow = lowWhole(dY) * yScale;
    const yHigh = Math.min(
      pow10(dY) * yScale - 1,
      Math.floor((maxXScaled - 1) / unit)
    );

    if (yLow > yHigh) continue;

    const y = randInt(yLow, yHigh);

    
    if (operator === "/") {
      
      const options = divisionOptions(settings, y, S);
      if (options.length === 0) continue;

      const [low, high] = options[randInt(0, options.length - 1)];
      const qScaled = randInt(low, high);

      return {
        question: `${fromScaled(qScaled * y, dp)} / ${y}`,
        answer: answerFromScaled(qScaled, dp)
      };
    }

    const options = firstNumberOptions(settings, y * unit, S);
    if (options.length === 0) continue;

    const [low, high] = options[randInt(0, options.length - 1)];
    const xScaled = randInt(low, high);

    const yText = fromScaled(y, yScale === S ? dp : 0);

    let answerScaled;
    if (operator === "+") answerScaled = xScaled + y;
    else if (operator === "-") answerScaled = xScaled - y;
    else answerScaled = xScaled * y;

    return {
      question: `${fromScaled(xScaled, dp)} ${operator} ${yText}`,
      answer: answerFromScaled(answerScaled, dp)
    };
  }

 
  return standardQuestion();
}

module.exports = {
  ALLOWED_OPERATIONS,
  normalizeCustomSettings,
  buildQuestion
};