const POINTS_PER_CORRECT = 5;


exports.calculatePoints = (correctCount, level) => {
  const lvl = Number(level) > 0 ? Number(level) : 1;
  return Math.round(correctCount * POINTS_PER_CORRECT * (1 / lvl));

};