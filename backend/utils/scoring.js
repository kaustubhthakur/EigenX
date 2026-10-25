const XP_PER_CORRECT = 5;


exports.calculateXp = (correctCount, level) => {
  const lvl = Number(level) > 0 ? Number(level) : 1;
  return Math.round(correctCount * XP_PER_CORRECT * (1 / lvl));
};