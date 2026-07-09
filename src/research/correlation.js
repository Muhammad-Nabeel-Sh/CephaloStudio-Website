import { collectMeasurements, pivotMeasurements } from "./collect.js";
import { shapiroWilk as swFromUtils, tDistributeCDF, fCDF, chi2CDF } from "../utils.js";
import { delongAUC_CI } from "./diagnostic.js";

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function pearsonR(x, y) {
  const n = x.length;
  if (n < 3) return null;
  const mx = mean(x), my = mean(y);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx, b = y[i] - my;
    num += a * b; dx2 += a * a; dy2 += b * b;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? 0 : num / den;
}

function spearmanRho(x, y) {
  const n = x.length;
  if (n < 3) return null;
  const rank = (arr) => {
    const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const ranks = Array(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j < n - 1 && sorted[j + 1].v === sorted[i].v) j++;
      const avgRank = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) ranks[sorted[k].i] = avgRank;
      i = j + 1;
    }
    return ranks;
  };
  return pearsonR(rank(x), rank(y));
}

function normalCdf(x) {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x / 2);
  return 0.5 * (1 + sign * y);
}

function benjaminiHochberg(pValues) {
  const n = pValues.length;
  if (n === 0) return [];
  const sorted = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  let prev = 0;
  for (let k = 0; k < n; k++) {
    const adjusted = Math.min(sorted[k].p * n / (k + 1), 1);
    sorted[k].adjusted = Math.max(adjusted, prev);
    prev = sorted[k].adjusted;
  }
  const result = Array(n);
  for (const s of sorted) {
    result[s.i] = { original: s.p, adjusted: s.adjusted, significant: s.adjusted < 0.05 };
  }
  return result;
}

// Koenker's studentized Breusch-Pagan: regress g = e²/σ² on X (with intercept), then
// LM = n·R²_aux ~ χ²(k-1). The previous version did not fit a proper auxiliary OLS
// (it used β = X'g/n with no X'X inverse), so the heteroscedasticity diagnostic was
// invalid.
function breuschPagan(residuals, X) {
  const n = residuals.length, k = X[0].length;
  const sigma2 = residuals.reduce((s, r) => s + r * r, 0) / n;
  const g = residuals.map(r => r * r / sigma2);
  const gMean = mean(g);
  const sstG = g.reduce((s, gi) => s + (gi - gMean) ** 2, 0);
  if (sstG === 0) return { statistic: 0, df: k - 1, p: 1 };
  const Xt = transposeMatrix(X);
  const XtX = matMul(Xt, X);
  const XtXi = matInverse(XtX);
  if (!XtXi) return { statistic: 0, df: k - 1, p: 1 };
  const Xtg = matVecMul(Xt, g);
  const beta = matVecMul(XtXi, Xtg);
  const fitted = X.map(row => dot(row, beta));
  const sseG = g.reduce((s, gi, i) => s + (gi - fitted[i]) ** 2, 0);
  const r2 = Math.max(0, Math.min(1, 1 - sseG / sstG));
  const lm = n * r2;
  const p = 1 - chi2CDF(lm, k - 1);
  return { statistic: lm, df: k - 1, p };
}

function addIntercept(X) {
  return X.map(row => [1, ...row]);
}

function transposeMatrix(m) {
  return m[0].map((_, i) => m.map(r => r[i]));
}

function matMul(A, B) {
  const rowsA = A.length, colsA = A[0].length, colsB = B[0].length;
  const result = Array.from({ length: rowsA }, () => Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++)
    for (let j = 0; j < colsB; j++)
      for (let k = 0; k < colsA; k++)
        result[i][j] += A[i][k] * B[k][j];
  return result;
}

function matVecMul(M, v) {
  return M.map(row => row.reduce((s, val, i) => s + val * v[i], 0));
}

function dot(a, b) {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

function matInverse(M) {
  const n = M.length;
  const aug = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-12) {
      // Previously returned the identity matrix on singularity, which silently produced
      // nonsense betas/zero SEs for collinear predictors. Return null so callers can flag
      // the failure (separation / perfect prediction) instead of emitting garbage.
      return null;
    }
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }
  return aug.map(row => row.slice(n));
}

function logit(x) {
  return 1 / (1 + Math.exp(-x));
}

// Newton-Raphson for logistic regression with separation detection and step-halving.
// Without these guards, perfectly-separated clinical predictors (common in small samples)
// drive the Hessian singular and the old `matInverse -> identity` fallback silently
// diverged. We now (1) detect quasi-separation via a huge initial gradient, (2) fall
// back to step-halving when a full Newton step overshoots, and (3) bail out cleanly
// (returning {beta:null}) if the Hessian is singular.
function logisticRegressionNewton(X, y, maxIter = 100, tol = 1e-8) {
  const p = X[0].length;
  let beta = Array(p).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    const pi = X.map(row => logit(dot(row, beta)));
    const W = pi.map(pi_i => pi_i * (1 - pi_i));
    const Xt = transposeMatrix(X);
    const XtW = Xt.map(row => row.map((v, i) => v * W[i]));
    const H = matMul(XtW, X);
    const grad = Xt.map(row => row.reduce((s, v, i) => s + v * (y[i] - pi[i]), 0));
    const gradNorm = Math.sqrt(grad.reduce((s, g) => s + g * g, 0));
    if (gradNorm > 1e6) return { beta: null, converged: false, separated: true };
    const Hinv = matInverse(H);
    if (!Hinv) return { beta: null, converged: false, singular: true };
    const delta = matVecMul(Hinv, grad);
    // Step-halving: if the full Newton step increases deviance, shrink it until it
    // stabilises (prevents divergence under separation).
    let step = 1;
    const devOld = y.reduce((s, yi, i) => s - (yi * Math.log(Math.max(pi[i], 1e-15)) + (1 - yi) * Math.log(Math.max(1 - pi[i], 1e-15))), 0);
    while (step > 1e-6) {
      const trialBeta = beta.map((b, j) => b + step * delta[j]);
      const trialPi = X.map(row => logit(dot(row, trialBeta)));
      const devNew = y.reduce((s, yi, i) => s - (yi * Math.log(Math.max(trialPi[i], 1e-15)) + (1 - yi) * Math.log(Math.max(1 - trialPi[i], 1e-15))), 0);
      if (devNew <= devOld + 1e-8) break;
      step *= 0.5;
    }
    beta = beta.map((b, j) => b + step * delta[j]);
    if (Math.sqrt(delta.reduce((s, d) => s + d * d, 0)) * step < tol) return { beta, converged: true };
  }
  return { beta, converged: false };
}

export function runCorrelationAll(sessions, config, calibration) {
  const { labelIds, covariates, method } = config;
  const rows = collectMeasurements(sessions, labelIds || [], calibration);
  const pivoted = pivotMeasurements(rows);

  if (pivoted.length < 2) {
    return { note: "Need at least 2 sessions with measurements for correlation analysis." };
  }

  // Build session-by-variable matrix (align data by session)
  const bySession = {};
  for (const p of pivoted) {
    if (!bySession[p.sessionId]) bySession[p.sessionId] = {};
    const val = Object.values(p.values).find(v => typeof v === "number" && isFinite(v));
    bySession[p.sessionId][p.label] = val;
  }
  const sessionIds = Object.keys(bySession);
  const n = sessionIds.length;

  const labels = [...new Set(pivoted.map(p => p.label))].sort();
  const extractVar = (label) => sessionIds.map(sid => bySession[sid][label]);
  const vars = labels.filter(l => extractVar(l).every(v => v != null && isFinite(v)));

  if (vars.length < 2) {
    return { note: "Need at least 2 numeric measurement variables across all sessions." };
  }

  const subType = method || "pearson";
  const corrMethod = subType === "spearman" ? spearmanRho : pearsonR;

  const matrix = {};
  const pairs = [];
  const pValues = [];

  for (const v1 of vars) {
    matrix[v1] = {};
    for (const v2 of vars) {
      if (v1 === v2) {
        matrix[v1][v2] = { r: 1, p: 0, ci95: [1, 1], n };
        continue;
      }
      const x = extractVar(v1);
      const y = extractVar(v2);
      const r = corrMethod(x, y);
      if (r == null) { matrix[v1][v2] = { r: 0, p: 1, ci95: [0, 0], n }; continue; }

      const z = 0.5 * Math.log((1 + r) / (1 - r));
      const se = 1 / Math.sqrt(n - 3);
      const zCI = [z - 1.96 * se, z + 1.96 * se];
      const ci95 = zCI.map(zz => {
        const v = (Math.exp(2 * zz) - 1) / (Math.exp(2 * zz) + 1);
        return Math.max(-1, Math.min(1, v));
      });

      const t = r * Math.sqrt((n - 2) / (1 - r * r));
      const df = n - 2;
      const p = 2 * (1 - tDistributeCDF(Math.abs(t), df));

      matrix[v1][v2] = { r, p, ci95, t, df, n };

      if (v1 < v2) {
        pairs.push([v1, v2]);
        pValues.push(p);
      }
    }
  }

  const adjusted = benjaminiHochberg(pValues);
  pairs.forEach(([v1, v2], i) => {
    matrix[v1][v2].pAdj = adjusted[i].adjusted;
    matrix[v1][v2].sigAdj = adjusted[i].significant;
    matrix[v2][v1].pAdj = adjusted[i].adjusted;
    matrix[v2][v1].sigAdj = adjusted[i].significant;
  });

  const descriptive = {};
  for (const v of vars) {
    const vals = extractVar(v).filter(x => isFinite(x));
    const m = mean(vals);
    const s = Math.sqrt(vals.reduce((a, vv) => a + (vv - m) ** 2, 0) / (vals.length - 1));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    descriptive[v] = { n: vals.length, mean: m, sd: s, min, max };
  }

  const result = { matrix, vars, n, method: subType, descriptive };

  if ((covariates || []).length > 0) {
    result.partial = {};
    const covVars = covariates.filter(c => vars.includes(c));
    for (const v1 of vars) {
      result.partial[v1] = {};
      for (const v2 of vars) {
        if (v1 === v2) { result.partial[v1][v2] = { r: 1, p: 0 }; continue; }
        const x = extractVar(v1);
        const y = extractVar(v2);
        const cv = covVars.map(c => extractVar(c)).filter(arr => arr.length === n);
        const xRes = residualize(x, cv);
        const yRes = residualize(y, cv);
        const r = pearsonR(xRes, yRes) || 0;
        const df = n - 2 - covVars.length;
        const t = r * Math.sqrt(df / (1 - r * r));
        const p = df > 0 ? 2 * (1 - tDistributeCDF(Math.abs(t), df)) : 1;
        result.partial[v1][v2] = { r, t, df, p };
      }
    }
    result.partial.covariates = covVars;
  }

  return result;
}

function residualize(y, predictors) {
  if (predictors.length === 0 || predictors[0].length !== y.length) return y;
  const X = predictors[0].map((_, i) => [1, ...predictors.map(p => p[i])]);
  const Xt = transposeMatrix(X);
  const XtX = matMul(Xt, X);
  const XtXi = matInverse(XtX);
  if (!XtXi) return y; // collinear covariates — can't residualize, return raw y
  const Xty = matVecMul(Xt, y);
  const beta = matVecMul(XtXi, Xty);
  const fitted = X.map(row => dot(row, beta));
  return y.map((yi, i) => yi - fitted[i]);
}

export function runRegression(sessions, config, calibration) {
  const { labelIds, dependentVar, predictorVars } = config;
  const rows = collectMeasurements(sessions, labelIds || [], calibration);
  const pivoted = pivotMeasurements(rows);
  if (pivoted.length < 3) return { note: "Need at least 3 cases for regression." };

  const varNames = [dependentVar, ...(predictorVars || [])].filter(Boolean);
  if (varNames.length < 2) return { note: "Need at least 1 predictor and 1 dependent variable." };

  // Build session-by-variable matrix (align data by session)
  const bySession = {};
  for (const p of pivoted) {
    if (!bySession[p.sessionId]) bySession[p.sessionId] = {};
    const val = Object.values(p.values).find(v => typeof v === "number" && isFinite(v));
    bySession[p.sessionId][p.label] = val;
  }
  const sessionIds = Object.keys(bySession);

  // Extract aligned values for each variable
  const rawX = predictorVars.map(v => sessionIds.map(sid => bySession[sid][v]));
  const rawY = sessionIds.map(sid => bySession[sid][dependentVar]);

  // Filter to complete cases only (all predictors + dependent must be finite)
  const validIdx = [];
  for (let i = 0; i < sessionIds.length; i++) {
    if (isFinite(rawY[i]) && rawX.every(col => isFinite(col[i]))) validIdx.push(i);
  }

  if (validIdx.length < 3) return { note: "Insufficient complete cases for regression." };

  const yClean = validIdx.map(i => rawY[i]);
  const XClean = rawX.map(col => validIdx.map(i => col[i]));
  const Xt = transposeMatrix(XClean);

  const Xm = addIntercept(Xt);
  const p = Xm[0].length;
  const n2 = yClean.length;

  const XtM = transposeMatrix(Xm);
  const XtX = matMul(XtM, Xm);
  const XtXi = matInverse(XtX);
  if (!XtXi) return { note: "Predictor matrix is singular (perfect multicollinearity). Remove a collinear predictor and retry." };
  const Xty = matVecMul(XtM, yClean);
  const beta = matVecMul(XtXi, Xty);

  const fitted = Xm.map(row => dot(row, beta));
  const residuals = yClean.map((yi, i) => yi - fitted[i]);

  const sse = residuals.reduce((a, r) => a + r * r, 0);
  const sigma2 = sse / (n2 - p);
  const varBeta = XtXi.map(row => row.map(v => v * sigma2));
  const se = varBeta.map((row, i) => Math.sqrt(Math.abs(row[i])));

  const tStats = beta.map((b, i) => b / se[i]);
  const pVals = tStats.map(ti => 2 * (1 - tDistributeCDF(Math.abs(ti), n2 - p)));

  const yMean = mean(yClean);
  const sst = yClean.reduce((a, yi) => a + (yi - yMean) ** 2, 0);
  const r2 = sst > 0 ? 1 - sse / sst : 0;
  const r2adj = 1 - (1 - r2) * (n2 - 1) / (n2 - p);

  const msReg = (sst - sse) / (p - 1);
  const mse = sse / (n2 - p);
  const F = mse > 0 ? msReg / mse : 0;
  const pF = 1 - fCDF(F, p - 1, n2 - p);

  const logLik = sigma2 > 0 ? -n2 / 2 * Math.log(2 * Math.PI * sigma2) - sse / (2 * sigma2) : 0;
  const aic = -2 * logLik + 2 * p;
  const bic = -2 * logLik + p * Math.log(n2);

  const z95 = 1.96, df = n2 - p;
  const tCrit = df > 100 ? z95 : z95 + (z95 ** 3 + z95) / (4 * df);
  const ci95 = beta.map((b, i) => [b - tCrit * se[i], b + tCrit * se[i]]);

  const vif = [];
  for (let j = 0; j < XClean.length; j++) {
    const otherX = Xt.filter((_, k) => k !== j);
    const thisY = Xt.map(row => row[j]);
    if (otherX.length === 0 || otherX[0].length < 2) { vif.push(1); continue; }
    const otherXm = addIntercept(otherX);
    const oXt = transposeMatrix(otherXm);
    const oXtX = matMul(oXt, otherXm);
    const oXtXi = matInverse(oXtX);
    if (!oXtXi) { vif.push(Infinity); continue; } // collinear with other predictors
    const oXty = matVecMul(oXt, thisY);
    const oBeta = matVecMul(oXtXi, oXty);
    const oFitted = otherXm.map(row => dot(row, oBeta));
    const oResid = thisY.map((yi, i) => yi - oFitted[i]);
    const r2j = 1 - oResid.reduce((a, r) => a + r * r, 0) /
      thisY.reduce((a, yi) => a + (yi - mean(thisY)) ** 2, 0);
    vif.push(r2j >= 1 ? Infinity : 1 / (1 - r2j));
  }

  const leverage = Xm.map(row => dot(row, matVecMul(XtXi, row)));
  const stdResid = residuals.map((r, i) => r / (Math.sqrt(sigma2 * (1 - leverage[i]))));
  const cooksd = residuals.map((r, i) => (r * r / (p * sigma2)) * (leverage[i] / (1 - leverage[i]) ** 2));
  const influential = cooksd.map((c, i) => ({
    index: i, cooksd: c, leverage: leverage[i], stdResid: stdResid[i],
    influential: c > 4 / n2 || Math.abs(stdResid[i]) > 2,
  })).filter(d => d.influential);

  const swResult = swFromUtils(residuals);
  const swResid = swResult ? { W: swResult.W, p: swResult.pValue } : { W: 1, p: 1 };
  const bp = breuschPagan(residuals, Xm);

  const equation = `${dependentVar} = ${beta.map((b, i) =>
    i === 0 ? b.toFixed(3) : `${b >= 0 ? "+" : ""}${b.toFixed(3)}×${predictorVars[i - 1]}`
  ).join(" ")}`;

  return {
    coefficients: beta,
    se, t: tStats, pValues: pVals, ci95,
    terms: ["Intercept", ...predictorVars],
    r2, r2adj, F, df1: p - 1, df2: n2 - p, pF,
    sse, sst, sigma2, aic, bic, logLik,
    vif, fitted, residuals, stdResid, leverage, cooksd,
    influential,
    equation,
    diagnostics: { normalityResiduals: swResid, heteroscedasticity: bp },
    n: n2, p,
    dependentVar,
    predictorVars,
  };
}

export function runLogisticRegression(sessions, config, calibration) {
  const { labelIds, dependentVar, predictorVars, threshold } = config;
  const rows = collectMeasurements(sessions, labelIds || [], calibration);
  const pivoted = pivotMeasurements(rows);
  if (pivoted.length < 10) return { note: "Need at least 10 cases for logistic regression." };

  const varNames = [dependentVar, ...(predictorVars || [])].filter(Boolean);
  if (varNames.length < 2) return { note: "Need at least 1 predictor and 1 dependent variable." };

  // Build session-by-variable matrix (align data by session)
  const bySession = {};
  for (const p of pivoted) {
    if (!bySession[p.sessionId]) bySession[p.sessionId] = {};
    const val = Object.values(p.values).find(v => typeof v === "number" && isFinite(v));
    bySession[p.sessionId][p.label] = val;
  }
  const sessionIds = Object.keys(bySession);

  const rawX = predictorVars.map(v => sessionIds.map(sid => bySession[sid][v]));
  const rawY = sessionIds.map(sid => bySession[sid][dependentVar]);

  const validIdx = [];
  for (let i = 0; i < sessionIds.length; i++) {
    if (isFinite(rawY[i]) && rawX.every(col => isFinite(col[i]))) validIdx.push(i);
  }

  const y = validIdx.map(i => {
    const v = rawY[i];
    if (threshold != null) return v >= threshold ? 1 : 0;
    return v > 0.5 ? 1 : 0;
  });
  const X = rawX.map(col => validIdx.map(i => col[i]));
  const Xt = addIntercept(transposeMatrix(X));

  const solver = logisticRegressionNewton(Xt, y, 100);
  const terms = ["Intercept", ...predictorVars];
  if (!solver.beta) {
    return {
      note: solver.separated
        ? "Logistic model did not converge: the outcome is perfectly (or quasi-) separated by a predictor — collect more data or drop the separating predictor."
        : "Logistic model did not converge (singular information matrix — likely perfect multicollinearity).",
      separated: !!solver.separated,
      singular: !!solver.singular,
      n: y.length, nPos: y.reduce((s, yi) => s + yi, 0), nNeg: y.length - y.reduce((s, yi) => s + yi, 0),
    };
  }
  const beta = solver.beta;
  const converged = solver.converged;

  const pi = Xt.map(row => logit(dot(row, beta)));
  const logLik = y.reduce((s, yi, i) => s + yi * Math.log(Math.max(pi[i], 1e-15)) + (1 - yi) * Math.log(Math.max(1 - pi[i], 1e-15)), 0);
  const nullPi = y.reduce((s, yi) => s + yi, 0) / y.length;
  const logLikNull = y.reduce((s, yi) => s + yi * Math.log(Math.max(nullPi, 1e-15)) + (1 - yi) * Math.log(Math.max(1 - nullPi, 1e-15)), 0);
  const pseudoR2 = 1 - logLik / logLikNull;
  const aic = -2 * logLik + 2 * beta.length;
  const bic = -2 * logLik + beta.length * Math.log(y.length);

  // Covariance of beta = (X'WX)^-1 with W = diag(pi(1-pi)).
  const W = pi.map(p => p * (1 - p));
  const XtW = transposeMatrix(Xt).map(row => row.map((v, i) => v * W[i]));
  const info = matMul(XtW, Xt);
  const infoInv = matInverse(info);
  const XtXinv = infoInv || matMul(transposeMatrix(Xt), Xt).map(r => r.map(() => NaN));
  const oddsRatios = beta.map(b => Math.exp(b));
  const se = XtXinv.map((row, i) => Math.sqrt(Math.abs(row[i])));
  const zStats = beta.map((b, i) => b / se[i]);
  const pVals = zStats.map(z => 2 * (1 - normalCdf(Math.abs(z))));
  const ci95 = beta.map((b, i) => {
    const lo = b - 1.96 * se[i], hi = b + 1.96 * se[i];
    return [Math.exp(lo), Math.exp(hi)];
  });

  // Use the Youden-optimal threshold (max Sensitivity + Specificity − 1) instead of a
  // hardcoded 0.5 — a 0.5 cutoff is not clinically calibrated and misreports sensitivity/
  // specificity for skewed or shifted logistic models.
  const nP = y.reduce((s, yi) => s + yi, 0);
  const nN = y.length - nP;
  const cutoffCandidates = [...pi].sort((a, b) => a - b);
  let bestJ = -Infinity, bestCut = 0.5;
  for (const c of cutoffCandidates) {
    let tp2 = 0, fp2 = 0, fn2 = 0, tn2 = 0;
    for (let i = 0; i < y.length; i++) {
      if (pi[i] >= c) { if (y[i] === 1) tp2++; else fp2++; }
      else { if (y[i] === 1) fn2++; else tn2++; }
    }
    const sens = tp2 / Math.max(tp2 + fn2, 1);
    const spec = tn2 / Math.max(tn2 + fp2, 1);
    const J = sens + spec - 1;
    if (J > bestJ) { bestJ = J; bestCut = c; }
  }
  const cutoff = bestCut;

  const predicted = pi.map(p => p >= cutoff ? 1 : 0);
  const accuracy = y.reduce((s, yi, i) => s + (yi === predicted[i] ? 1 : 0), 0) / y.length;
  const tp = y.reduce((s, yi, i) => s + (yi === 1 && predicted[i] === 1 ? 1 : 0), 0);
  const fp = y.reduce((s, yi, i) => s + (yi === 0 && predicted[i] === 1 ? 1 : 0), 0);
  const tn = y.reduce((s, yi, i) => s + (yi === 0 && predicted[i] === 0 ? 1 : 0), 0);
  const fn = y.reduce((s, yi, i) => s + (yi === 1 && predicted[i] === 0 ? 1 : 0), 0);
  const sensitivity = tp / Math.max(tp + fn, 1);
  const specificity = tn / Math.max(tn + fp, 1);

  // ROC + AUC with a DeLong 95% CI (previously no CI, so the AUC was reported
  // without any measure of uncertainty — misleading in small clinical samples).
  const aucResult = delongAUC_CI(pi, y, 0.05);
  const roc = [];
  let auc = 0;
  if (nP > 0 && nN > 0) {
    const sorted = pi.map((p, i) => ({ p, y: y[i] })).sort((a, b) => b.p - a.p);
    let rocTp = 0, rocFp = 0;
    let prevP = Infinity;
    roc.push({ fpr: 0, tpr: 0, threshold: Infinity });
    for (const s of sorted) {
      if (s.p !== prevP) {
        roc.push({ fpr: rocFp / nN, tpr: rocTp / nP, threshold: s.p, tp: rocTp, fp: rocFp, tn: nN - rocFp, fn: nP - rocTp });
        prevP = s.p;
      }
      if (s.y === 1) rocTp++; else rocFp++;
    }
    roc.push({ fpr: 1, tpr: 1, threshold: -Infinity });
    for (let i = 1; i < roc.length; i++) {
      auc += (roc[i].fpr - roc[i - 1].fpr) * (roc[i].tpr + roc[i - 1].tpr) / 2;
    }
  }

  return {
    coefficients: beta,
    oddsRatios,
    se, z: zStats, pValues: pVals, ci95,
    terms,
    logLik, logLikNull, pseudoR2, aic, bic,
    accuracy, sensitivity, specificity,
    cutoff,
    confusionMatrix: { tp, fp, tn, fn },
    predicted, pi,
    roc, auc,
    aucCI: aucResult ? { ci95: aucResult.ci95, seAUC: aucResult.seAUC, p: aucResult.p } : null,
    converged,
    n: y.length, nPos: nP, nNeg: nN,
    dependentVar, predictorVars, threshold,
  };
}
