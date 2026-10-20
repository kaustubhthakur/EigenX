export function solveQuestion(q: string): number | null {
  const m = q.match(/^\s*(\d+(?:\.\d+)?)\s*([+\-*/])\s*(\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[3]);
  switch (m[2]) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return b === 0 ? null : a / b;
    default: return null;
  }
}