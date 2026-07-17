// ═══════════════════════════════════════════════════════════════════════════════
// statsCore.js — shared statistical helpers used across research modules
// Centralizes functions that were previously copy-pasted across files.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Normal CDF (standard normal distribution function) ────────────────────
export function normalCdf(x) {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const s = Math.sign(x), ax = Math.abs(x);
  const t = 1 / (1 + p * ax);
  const erf = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + s * erf);
}

export function matMul(A, B) {
  const m = A.length, n = A[0].length, p = B[0].length;
  const C = Array.from({ length: m }, () => Array(p).fill(0));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < p; j++)
      for (let k = 0; k < n; k++)
        C[i][j] += A[i][k] * B[k][j];
  return C;
}

export function matVecMul(M, v) {
  return M.map(row => row.reduce((s, val, i) => s + val * v[i], 0));
}

export function transposeMatrix(m) {
  if (m.length === 0) return [];
  return m[0].map((_, i) => m.map(r => r[i]));
}

export function matInverse(M) {
  const n = M.length;
  const aug = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-12) return null;
    const piv = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= piv;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= f * aug[col][j];
    }
  }
  return aug.map(row => row.slice(n));
}

export function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function addIntercept(X) {
  return X.map(row => [1, ...row]);
}

// ─── Benjamini-Hochberg adjustment ────────────────────────────────────────
// Enforces monotonicity as cumulative min from the largest p downward
// (the correct BH procedure — see S2).
export function benjaminiHochberg(pValues, alpha = 0.05) {
  const m = pValues.length;
  if (m === 0) return [];
  const indexed = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  for (let rank = 0; rank < m; rank++) {
    indexed[rank].rawAdj = Math.min(indexed[rank].p * m / (rank + 1), 1);
  }
  let prev = 1;
  for (let rank = m - 1; rank >= 0; rank--) {
    prev = Math.min(prev, indexed[rank].rawAdj);
    indexed[rank].adjusted = prev;
  }
  let lastSig = -1;
  for (let rank = 0; rank < m; rank++) {
    if (indexed[rank].p <= ((rank + 1) / m) * alpha) lastSig = rank;
  }
  return indexed.map((item, rank) => ({
    original: item.p, adjusted: item.adjusted, significant: rank <= lastSig, i: item.i,
  })).sort((a, b) => a.i - b.i);
}
