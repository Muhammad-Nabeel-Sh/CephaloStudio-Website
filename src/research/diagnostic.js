import { collectMeasurements, pivotMeasurements } from "./collect.js";
// ─── Math helpers ────────────────────────────────────────────────────────────
function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const s = Math.sign(x), ax = Math.abs(x);
  const t = 1 / (1 + p * ax);
  const erf = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + s * erf);
}

function zCritical(alpha) {
  const lookup = [];
  for (let i = 0; i <= 30; i++) lookup.push({ z: i / 10, c: normalCDF(i / 10) });
  const p = 1 - alpha / 2;
  for (let i = 1; i < lookup.length; i++) {
    if (lookup[i].c >= p) {
      const frac = (p - lookup[i - 1].c) / (lookup[i].c - lookup[i - 1].c);
      return lookup[i - 1].z + frac * 0.1;
    }
  }
  return 3.09;
}

function logGamma(x) {
  if (x < 12) return logGamma(x + 1) - Math.log(x);
  const c = [76.18009173, -86.50532033, 24.01409822, -1.231739516, 0.00120858003, -0.00000536382];
  let s = 1.00000000019;
  for (let i = 0; i < 6; i++) s += c[i] / (x + 1 + i);
  return (x - 0.5) * Math.log(x + 4.5) - (x + 4.5) + Math.log(s * Math.SQRT2 * Math.PI);
}

function gammaP(a, x) {
  if (x < a + 1) {
    let sum = 1 / a, term = 1 / a;
    for (let n = 1; n < 100; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-12) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  let sum = 1, term = 1;
  for (let n = 1; n < 100; n++) {
    term *= (a - n) / x;
    sum += term;
    if (Math.abs(term) < 1e-12) break;
  }
  return 1 - sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

function chi2CDF(x, df) {
  if (x <= 0 || df <= 0) return 0;
  return gammaP(df / 2, x / 2);
}

function bonferroniAdjust(pValues) {
  const m = pValues.length;
  return pValues.map(p => ({ original: p, adjusted: Math.min(p * m, 1), significant: Math.min(p * m, 1) < 0.05 }));
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function transposeMatrix(m) {
  if (m.length === 0) return [];
  return m[0].map((_, i) => m.map(r => r[i]));
}

function matMul(A, B) {
  const Bt = transposeMatrix(B);
  return A.map(rowA => Bt.map(colB => dot(rowA, colB)));
}

function matVecMul(M, v) {
  return M.map(row => dot(row, v));
}

function addIntercept(X) {
  return X.map(row => [1, ...row]);
}

function matInverse(M) {
  const n = M.length;
  const aug = M.map((row, i) => [...row, ...Array(n).fill(0).map((_, j) => i === j ? 1 : 0)]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    while (pivot < n && Math.abs(aug[pivot][col]) < 1e-12) pivot++;
    if (pivot >= n) return M.map((_, i) => M[0].map((_, j) => i === j ? 1 : 0));
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]];
    const pv = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = aug[r][col];
      for (let j = 0; j < 2 * n; j++) aug[r][j] -= f * aug[col][j];
    }
  }
  return aug.map(row => row.slice(n));
}

function sigmoid(z) {
  return 1 / (1 + Math.exp(-Math.max(Math.min(z, 700), -700)));
}

// ─── Core ROC ────────────────────────────────────────────────────────────────
export function computeROC(scores, labels, higherIsPositive = true) {
  const n = scores.length;
  const nP = labels.filter(l => l === 1).length;
  const nN = labels.filter(l => l === 0).length;
  if (nP === 0 || nN === 0) return null;

  const pairs = scores.map((s, i) => ({ score: s, label: labels[i] }))
    .sort((a, b) => higherIsPositive ? b.score - a.score : a.score - b.score);

  let tp = 0, fp = 0;
  const points = [{ fpr: 0, tpr: 0, threshold: Infinity }];

  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].label === 1) tp++;
    else fp++;
    const isLast = i === pairs.length - 1;
    const nextDiff = !isLast && pairs[i].score !== pairs[i + 1].score;
    if (isLast || nextDiff) {
      points.push({ fpr: fp / nN, tpr: tp / nP, threshold: pairs[i].score, tp, fp, tn: nN - fp, fn: nP - tp });
    }
  }

  points.push({ fpr: 1, tpr: 1, threshold: -Infinity });

  let auc = 0;
  for (let i = 1; i < points.length; i++) {
    auc += (points[i].fpr - points[i - 1].fpr) * (points[i].tpr + points[i - 1].tpr) / 2;
  }

  const thresholdMetrics = points.slice(1, -1).map(pt => ({
    ...pt,
    sensitivity: pt.tpr,
    specificity: 1 - pt.fpr,
    ppv: pt.tp / Math.max(pt.tp + pt.fp, 1),
    npv: pt.tn / Math.max(pt.tn + pt.fn, 1),
    accuracy: (pt.tp + pt.tn) / n,
    f1: 2 * pt.tp / Math.max(2 * pt.tp + pt.fp + pt.fn, 1),
    lrPos: pt.tpr / Math.max(pt.fpr, 1e-10),
    lrNeg: (1 - pt.tpr) / Math.max(1 - pt.fpr, 1e-10),
    youdenJ: pt.tpr + (1 - pt.fpr) - 1,
    dor: (pt.tp * pt.tn) / Math.max(pt.fp * pt.fn, 1),
  }));

  return { points, auc, nP, nN, n, thresholdMetrics };
}

// ─── DeLong AUC CI ──────────────────────────────────────────────────────────
export function delongAUC_CI(scores, labels, alpha = 0.05) {
  const positives = scores.filter((_, i) => labels[i] === 1);
  const negatives = scores.filter((_, i) => labels[i] === 0);
  const nP = positives.length, nN = negatives.length;
  if (nP === 0 || nN === 0) return null;

  const psi = (x, y) => x > y ? 1 : x === y ? 0.5 : 0;
  const V10 = positives.map(x => negatives.reduce((acc, y) => acc + psi(x, y), 0) / nN);
  const V01 = negatives.map(y => positives.reduce((acc, x) => acc + psi(x, y), 0) / nP);
  const auc = V10.reduce((a, b) => a + b, 0) / nP;
  const s10 = V10.reduce((acc, v) => acc + (v - auc) ** 2, 0) / (nP - 1);
  const s01 = V01.reduce((acc, v) => acc + (v - auc) ** 2, 0) / (nN - 1);
  const varAUC = s10 / nP + s01 / nN;
  const seAUC = Math.sqrt(varAUC);
  const logitAUC = Math.log(auc / (1 - auc));
  const seLogit = seAUC / (auc * (1 - auc));
  const zCrit = zCritical(alpha);
  const logitCI = [logitAUC - zCrit * seLogit, logitAUC + zCrit * seLogit];
  const ci95 = logitCI.map(l => Math.exp(l) / (1 + Math.exp(l)));
  const z = (auc - 0.5) / seAUC;
  const p = 2 * (1 - normalCDF(Math.abs(z)));
  return { auc, seAUC, ci95, z, p, varAUC, nP, nN };
}

// ─── Compare ROC Curves ─────────────────────────────────────────────────────
export function delongCovariance(scoresA, scoresB, labels) {
  const positives = labels.map((l, i) => i).filter(i => labels[i] === 1);
  const negatives = labels.map((l, i) => i).filter(i => labels[i] === 0);
  const nP = positives.length, nN = negatives.length;
  if (nP === 0 || nN === 0) return 0;
  const psi = (x, y) => x > y ? 1 : x === y ? 0.5 : 0;
  const aucA = delongAUC_CI(scoresA, labels).auc;
  const aucB = delongAUC_CI(scoresB, labels).auc;
  const V10_A = positives.map(i => negatives.reduce((acc, j) => acc + psi(scoresA[i], scoresA[j]), 0) / nN);
  const V10_B = positives.map(i => negatives.reduce((acc, j) => acc + psi(scoresB[i], scoresB[j]), 0) / nN);
  const V01_A = negatives.map(j => positives.reduce((acc, i) => acc + psi(scoresA[i], scoresA[j]), 0) / nP);
  const V01_B = negatives.map(j => positives.reduce((acc, i) => acc + psi(scoresB[i], scoresB[j]), 0) / nP);
  const s10AB = V10_A.reduce((acc, _, i) => acc + (V10_A[i] - aucA) * (V10_B[i] - aucB), 0) / (nP - 1);
  const s01AB = V01_A.reduce((acc, _, j) => acc + (V01_A[j] - aucA) * (V01_B[j] - aucB), 0) / (nN - 1);
  return s10AB / nP + s01AB / nN;
}

export function compareROCCurves(rocResults) {
  const k = rocResults.length;
  const comparisons = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const A = rocResults[i], B = rocResults[j];
      const cov = delongCovariance(A.scores, B.scores, A.labels);
      const dAUC = A.aucResult.auc - B.aucResult.auc;
      const varDiff = A.aucResult.varAUC + B.aucResult.varAUC - 2 * cov;
      const se = Math.sqrt(Math.max(varDiff, 1e-12));
      const z = dAUC / se;
      const p = 2 * (1 - normalCDF(Math.abs(z)));
      comparisons.push({
        A: A.name, B: B.name,
        aucA: A.aucResult.auc, aucB: B.aucResult.auc,
        diff: dAUC, se, z, p,
        significant: p < 0.05,
        ci95: [dAUC - 1.96 * se, dAUC + 1.96 * se],
      });
    }
  }
  const adjusted = bonferroniAdjust(comparisons.map(c => c.p));
  comparisons.forEach((c, i) => {
    c.pAdj = adjusted[i].adjusted;
    c.sigAdj = adjusted[i].significant;
  });
  return comparisons;
}

// ─── Optimal Thresholds ──────────────────────────────────────────────────────
export function wilsonCI(count, total, z = 1.96) {
  if (total === 0) return [0, 0];
  const p_hat = count / total;
  const den = 1 + z * z / total;
  const center = (p_hat + z * z / (2 * total)) / den;
  const margin = z * Math.sqrt(p_hat * (1 - p_hat) / total + z * z / (4 * total * total)) / den;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

export function optimalThresholds(thresholdMetrics) {
  const byYouden = thresholdMetrics.reduce((best, pt) => pt.youdenJ > best.youdenJ ? pt : best);
  const byF1 = thresholdMetrics.reduce((best, pt) => pt.f1 > best.f1 ? pt : best);
  const byDistance = thresholdMetrics.reduce((best, pt) => {
    const d = Math.sqrt(pt.fpr ** 2 + (1 - pt.tpr) ** 2);
    return d < best.dist ? { ...pt, dist: d } : best;
  }, { dist: Infinity });
  const byAccuracy = thresholdMetrics.reduce((best, pt) => pt.accuracy > best.accuracy ? pt : best);
  const clinicalThreshold = (fpCost = 1, fnCost = 1) =>
    thresholdMetrics.reduce((best, pt) => {
      const cost = fpCost * pt.fp + fnCost * pt.fn;
      return cost < best.cost ? { ...pt, cost } : best;
    }, { cost: Infinity });
  const enrichOptimal = (pt, nP, nN) => ({
    ...pt,
    sensitivityCI: wilsonCI(pt.tp, nP),
    specificityCI: wilsonCI(pt.tn, nN),
    ppvCI: wilsonCI(pt.tp, pt.tp + pt.fp),
    npvCI: wilsonCI(pt.tn, pt.tn + pt.fn),
    accuracy95CI: wilsonCI(pt.tp + pt.tn, pt.tp + pt.tn + pt.fp + pt.fn),
  });
  return { byYouden, byF1, byDistance, byAccuracy, clinicalThreshold, enrichOptimal };
}

// ─── Screening Indices ──────────────────────────────────────────────────────
export function screeningIndices(tp, fp, tn, fn) {
  const sens = tp / Math.max(tp + fn, 1);
  const spec = tn / Math.max(tn + fp, 1);
  const ppv = tp / Math.max(tp + fp, 1);
  const npv = tn / Math.max(tn + fn, 1);
  const acc = (tp + tn) / Math.max(tp + fp + tn + fn, 1);
  return {
    sensitivity: sens, specificity: spec, ppv, npv, accuracy: acc,
    f1: 2 * tp / Math.max(2 * tp + fp + fn, 1),
    lrPos: sens / Math.max(1 - spec, 1e-10),
    lrNeg: (1 - sens) / Math.max(spec, 1e-10),
    youdenJ: sens + spec - 1,
    dor: (tp * tn) / Math.max(fp * fn, 1),
    sensitivityCI: wilsonCI(tp, tp + fn),
    specificityCI: wilsonCI(tn, tn + fp),
    ppvCI: wilsonCI(tp, tp + fp),
    npvCI: wilsonCI(tn, tn + fn),
    accuracyCI: wilsonCI(tp + tn, tp + fp + tn + fn),
  };
}

// ─── Calibration Analysis ────────────────────────────────────────────────────
export function calibrationAnalysis(predictedProbs, observedLabels, nGroups = 10) {
  const n = predictedProbs.length;
  const pairs = predictedProbs.map((p, i) => ({ prob: p, obs: observedLabels[i] }))
    .sort((a, b) => a.prob - b.prob);
  const groups = [];
  const groupSize = Math.max(1, Math.floor(n / nGroups));
  for (let g = 0; g < Math.min(nGroups, n); g++) {
    const start = g * groupSize;
    const end = g === nGroups - 1 ? n : start + groupSize;
    if (start >= n) break;
    const grp = pairs.slice(start, end);
    const observed = grp.filter(p => p.obs === 1).length;
    const expected = grp.reduce((acc, p) => acc + p.prob, 0);
    const midpoint = (grp[0].prob + grp[grp.length - 1].prob) / 2;
    groups.push({ g: g + 1, n: grp.length, observed, expected, midpoint, obsProp: observed / grp.length, expProp: expected / grp.length });
  }
  const hlStat = groups.reduce((acc, g) => {
    const den1 = g.expected;
    const den2 = g.n - g.expected;
    const o1 = g.observed;
    const e1 = g.expected;
    const o2 = g.n - g.observed;
    const e2 = g.n - g.expected;
    return acc + (o1 - e1) ** 2 / Math.max(den1, 1e-10) + (o2 - e2) ** 2 / Math.max(den2, 1e-10);
  }, 0);
  const hlDF = Math.max(groups.length - 2, 1);
  const hlP = 1 - chi2CDF(hlStat, hlDF);
  const ici = groups.reduce((acc, g) => acc + Math.abs(g.obsProp - g.expProp) * g.n, 0) / n;
  const brier = predictedProbs.reduce((acc, p, i) => acc + (p - observedLabels[i]) ** 2, 0) / n;
  const prevalence = observedLabels.filter(l => l === 1).length / n;
  const brierRef = prevalence * (1 - prevalence);
  const brierSkill = brierRef > 0 ? 1 - brier / brierRef : 0;
  return { groups, hlStat, hlDF, hlP, wellCalibrated: hlP > 0.05, ici, brier, brierSkill, n };
}

// ─── Composite Index (Logistic Regression) ──────────────────────────────────
export function buildCompositeIndex(predictors, labels) {
  const n = labels.length;
  if (n < 5) return null;
  const X = addIntercept(predictors);
  const k = X[0].length;
  let beta = Array(k).fill(0);
  for (let iter = 0; iter < 200; iter++) {
    const p = X.map(xi => sigmoid(dot(xi, beta)));
    const W = p.map(pi => pi * (1 - pi));
    const resid = labels.map((yi, i) => yi - p[i]);
    const score = transposeMatrix(X).map(col => dot(col, resid));
    const Xt = transposeMatrix(X);
    const XtW = Xt.map(row => row.map((v, i) => v * W[i]));
    const Hess = matMul(XtW, X).map(row => row.map(v => -v));
    const delta = matVecMul(matInverse(Hess), score);
    beta = beta.map((b, i) => b - delta[i]);
    if (delta.every(d => Math.abs(d) < 1e-8)) break;
  }
  const pFinal = X.map(xi => sigmoid(dot(xi, beta)));
  const WFinal = pFinal.map(pi => pi * (1 - pi));
  const XtF = transposeMatrix(X);
  const XtWF = XtF.map(row => row.map((v, i) => v * WFinal[i]));
  const info = matMul(XtWF, X);
  const varBeta = matInverse(info);
  const se = varBeta.map((row, i) => Math.sqrt(Math.abs(row[i])));
  const z = beta.map((b, i) => b / se[i]);
  const pVal = z.map(zi => 2 * (1 - normalCDF(Math.abs(zi))));
  const OR = beta.map(b => Math.exp(b));
  const OR_CI = beta.map((b, i) => [Math.exp(b - 1.96 * se[i]), Math.exp(b + 1.96 * se[i])]);
  const compositeScores = X.map(xi => sigmoid(dot(xi, beta)));
  const rocResult = computeROC(compositeScores, labels);
  const aucResult = delongAUC_CI(compositeScores, labels);
  const llFull = labels.reduce((acc, yi, i) =>
    acc + yi * Math.log(Math.max(compositeScores[i], 1e-10)) + (1 - yi) * Math.log(Math.max(1 - compositeScores[i], 1e-10)), 0);
  const p0 = labels.filter(l => l === 1).length / n;
  const llNull = labels.reduce((acc, yi) => acc + yi * Math.log(p0) + (1 - yi) * Math.log(1 - p0), 0);
  const r2Cox = 1 - Math.exp(2 * (llNull - llFull) / n);
  const r2Nag = r2Cox / (1 - Math.exp(2 * llNull / n));
  const calib = calibrationAnalysis(compositeScores, labels);
  return {
    beta, se, z, pVal, OR, OR_CI, compositeScores,
    roc: rocResult, auc: aucResult,
    r2Cox, r2Nag, calibration: calib,
    llFull, llNull, aic: -2 * llFull + 2 * k, bic: -2 * llFull + k * Math.log(n),
    n, predictors: k,
  };
}

// ─── Cross-Validation AUC ───────────────────────────────────────────────────
export function crossValidateAUC(predictors, labels, method = "loocv", k = 10) {
  const n = labels.length;
  if (n < 5) return null;
  const aucs = [];

  if (method === "loocv") {
    for (let i = 0; i < n; i++) {
      const trainX = predictors.filter((_, j) => j !== i);
      const trainY = labels.filter((_, j) => j !== i);
      const testX = [predictors[i]];
      const testY = [labels[i]];
      const model = buildCompositeIndex(trainX, trainY);
      if (!model) continue;
      const score = sigmoid(dot(addIntercept([testX[0]])[0], model.beta));
      aucs.push({ score, label: testY[0], fold: i });
    }
  } else if (method === "kfold") {
    const foldSize = Math.max(1, Math.floor(n / k));
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let f = 0; f < k; f++) {
      const testIdx = idx.slice(f * foldSize, f === k - 1 ? n : (f + 1) * foldSize);
      const trainIdx = idx.filter(i => !testIdx.includes(i));
      if (trainIdx.length < 3 || testIdx.length === 0) continue;
      const trainX = trainIdx.map(i => predictors[i]);
      const trainY = trainIdx.map(i => labels[i]);
      const testX = testIdx.map(i => predictors[i]);
      const testY = testIdx.map(i => labels[i]);
      const model = buildCompositeIndex(trainX, trainY);
      if (!model) continue;
      const scores = testX.map(x => sigmoid(dot(addIntercept([x])[0], model.beta)));
      testIdx.forEach((origIdx, j) => {
        aucs.push({ score: scores[j], label: testY[j], fold: f });
      });
    }
  }

  if (aucs.length < 5) return null;

  const cvScores = aucs.map(a => a.score);
  const cvLabels = aucs.map(a => a.label);
  const cvAUC = delongAUC_CI(cvScores, cvLabels);

  const fullModel = buildCompositeIndex(predictors, labels);
  const apparentAUC = fullModel ? delongAUC_CI(
    predictors.map(x => sigmoid(dot(addIntercept([x])[0], fullModel.beta))), labels
  ) : null;

  return {
    cvAUC,
    apparentAUC: apparentAUC?.auc || 0,
    optimism: (apparentAUC?.auc || 0) - (cvAUC?.auc || 0),
    correctedAUC: (apparentAUC?.auc || 0) - ((apparentAUC?.auc || 0) - (cvAUC?.auc || 0)),
    foldResults: aucs,
    nFolds: aucs.length,
    method, k,
  };
}

// ─── Data Collection ─────────────────────────────────────────────────────────
export function collectDiagnosticData(sessions, config, calibration) {
  const { goldStandardLabel, goldStandardPositive, predictorLabels } = config;
  if (!goldStandardLabel) return { error: "No gold standard label selected." };
  if (!predictorLabels?.length) return { error: "At least one predictor label required." };

  // Exclude gold standard from predictors to prevent trivial perfect prediction
  const cleanPredictors = predictorLabels.filter(pl => pl !== goldStandardLabel);
  if (cleanPredictors.length === 0) return { error: "Predictor labels must be different from the gold standard label." };

  const rows = collectMeasurements(sessions, [goldStandardLabel, ...cleanPredictors], calibration);
  if (rows.length === 0) return { error: `No numeric measurements found for "${goldStandardLabel}" or predictor labels. Ensure markups are visible, placed, and produce numeric values (angles, lengths, distances, ratios).` };

  const pivoted = pivotMeasurements(rows);
  if (pivoted.length === 0) return { error: "Pivoted measurements are empty." };

  const bySession = {};
  for (const p of pivoted) {
    if (!bySession[p.sessionId]) bySession[p.sessionId] = {};
    // Prefer actual measurement keys over coordinate keys (x, y)
    const keys = Object.keys(p.values);
    const prefKey = keys.find(k => !["x", "y"].includes(k));
    const val = prefKey ? p.values[prefKey] : Object.values(p.values).find(v => typeof v === "number" && isFinite(v));
    bySession[p.sessionId][p.label] = val;
  }

  const sessionIds = Object.keys(bySession);

  const cases = [];
  for (const sid of sessionIds) {
    const gsVal = bySession[sid][goldStandardLabel];
    const gsThreshold = Number(goldStandardPositive);
    const gsBinary = typeof gsVal === "number"
      ? (gsVal >= (isFinite(gsThreshold) ? gsThreshold : 0.5) ? 1 : 0)
      : (String(gsVal) === String(goldStandardPositive) ? 1 : 0);

    const predVals = {};
    let hasAll = true;
    for (const pl of cleanPredictors) {
      const v = bySession[sid][pl];
      if (v == null || !isFinite(v)) { hasAll = false; break; }
      predVals[pl] = v;
    }
    if (!hasAll) continue;

    cases.push({ sessionId: sid, goldStandard: gsBinary, goldStandardLabel: gsVal, ...predVals });
  }

  if (cases.length < 3) {
    const missingPredictors = sessionIds.filter(sid =>
      cleanPredictors.some(pl => bySession[sid]?.[pl] == null)
    );
    return { error: `Only ${cases.length} of ${sessionIds.length} sessions have complete data. ${missingPredictors.length} sessions missing predictor measurements. Need at least 3 cases.` };
  }

  const labels = cases.map(c => c.goldStandard);
  const nP = labels.filter(l => l === 1).length;
  const nN = labels.filter(l => l === 0).length;
  if (nP === 0 || nN === 0) {
    const gsThreshold = Number(goldStandardPositive);
    const allGS = cases.map(c => c.goldStandardLabel);
    const gsMin = Math.min(...allGS), gsMax = Math.max(...allGS), gsMed = allGS.sort((a, b) => a - b)[Math.floor(allGS.length / 2)];
    return { error: `All ${cases.length} cases binarize to the same class (${nP > 0 ? "positive" : "negative"}) with threshold ${isFinite(gsThreshold) ? gsThreshold : "0.5"}. Values range [${gsMin.toFixed(2)}–${gsMax.toFixed(2)}], median ${gsMed.toFixed(2)}. Enter a numeric "Positive class value" in the config above the threshold that separates classes (e.g., ${gsMed.toFixed(1)}).` };
  }

  return { cases, labels, nP, nN, n: cases.length, sessionIds, predictorLabels: cleanPredictors, goldStandardLabel, goldStandardPositive };
}

// ─── Main Entry Point ────────────────────────────────────────────────────────
export function runDiagnosticAll(sessions, config, calibration) {
  const data = collectDiagnosticData(sessions, config, calibration);
  if (!data || data.error) return { note: data?.error || "Insufficient data for diagnostic analysis." };

  const { cases, labels, nP, nN, n, predictorLabels } = data;
  const alpha = config.alpha ?? 0.05;
  const higherIsPositiveDefault = true;

  const predictorResults = {};
  const allScores = {};

  for (const pl of predictorLabels) {
    const scores = cases.map(c => c[pl]);
    const hip = config.higherIsPositive?.[pl] ?? higherIsPositiveDefault;
    const roc = computeROC(scores, labels, hip);
    if (!roc) continue;
    const auc = delongAUC_CI(scores, labels, alpha);
    if (!auc) continue;
    const opts = optimalThresholds(roc.thresholdMetrics);
    const enrichedYouden = opts.enrichOptimal(opts.byYouden, nP, nN);
    const calibData = { groups: [], hlStat: 0, hlP: 1, wellCalibrated: true, ici: 0, brier: 0, brierSkill: 0 };
    predictorResults[pl] = {
      roc, auc, optimalThresholds: opts,
      optimalYouden: enrichedYouden,
      scores, labels, higherIsPositive: hip,
      calibration: calibData,
    };
    allScores[pl] = scores;
  }

  const predNames = Object.keys(predictorResults);

  // ROC comparisons
  const comparisons = predNames.length >= 2 ? compareROCCurves(
    predNames.map(name => ({
      name, scores: predictorResults[name].scores,
      labels: predictorResults[name].labels,
      aucResult: predictorResults[name].auc,
    }))
  ) : [];

  // Composite index
  let composite = null;
  if (predNames.length >= 2) {
    const predMatrix = cases.map(c => predNames.map(pl => c[pl]));
    composite = buildCompositeIndex(predMatrix, labels);
  }

  // Cross-validation
  let crossVal = null;
  if (predNames.length >= 2 && n >= 5) {
    const predMatrix = cases.map(c => predNames.map(pl => c[pl]));
    crossVal = crossValidateAUC(predMatrix, labels, config.cvMethod || "loocv", config.cvK || 10);
  }

  return {
    predictors: predictorResults,
    predictorNames: predNames,
    comparisons,
    composite,
    crossVal,
    n, nP, nN,
    alpha,
    goldStandardLabel: data.goldStandardLabel,
    goldStandardPositive: data.goldStandardPositive,
    cases,
  };
}
