import { computeMeasurements, mean, stdev, variance, shapiroWilk, oneWayAnova, tTestPaired, tDistributeCDF, fCDF, gammaLn } from "../utils.js";

// ─── Statistical helpers ──────────────────────────────────────────────────
function rankArray(arr) {
  const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length - 1 && sorted[j + 1].v === sorted[j].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[sorted[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

function normalCdf(x) {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const a = 0.3193815, b = -0.3565638, c = 1.7814779, d = -1.8212559, e = 1.3302744;
  const phi = 0.39894228 * Math.exp(-x * x / 2);
  let t = 1 / (1 + 0.2316419 * Math.abs(x));
  t = phi * t * (a + t * (b + t * (c + t * (d + t * e))));
  return x > 0 ? 1 - t : t;
}

function sum(arr) {
  return arr.reduce((s, v) => s + v, 0);
}

// Levene's test for homogeneity of variance
function levenesTest(...groups) {
  if (groups.length < 2) return null;
  const all = [];
  const groupMeans = groups.map(g => {
    const m = mean(g);
    const devs = g.map(v => Math.abs(v - m));
    all.push(...devs);
    return { devs, m: mean(devs), n: g.length };
  });
  const grandMean = mean(all);
  const k = groups.length;
  const N = all.length;
  const num = sum(groupMeans.map(g => g.n * (g.m - grandMean) ** 2)) / (k - 1);
  const den = sum(groupMeans.map(g => sum(g.devs.map(d => (d - g.m) ** 2)))) / (N - k);
  if (den === 0) return { W: 0, pValue: 1, equalVariance: true };
  const W = num / den;
  const df1 = k - 1;
  const df2 = N - k;
  const pValue = 1 - fCDF(W, df1, df2);
  return { W, df1, df2, pValue, equalVariance: pValue > 0.05 };
}

// Mann-Whitney U test
function mannWhitneyU(arr1, arr2) {
  const n1 = arr1.length, n2 = arr2.length;
  if (n1 < 2 || n2 < 2) return null;
  const combined = [...arr1, ...arr2];
  const ranks = rankArray(combined);
  const rank1 = ranks.slice(0, n1);
  const R1 = sum(rank1);
  const U1 = n1 * n2 + (n1 * (n1 + 1)) / 2 - R1;
  const U = U1;
  const mU = n1 * n2 / 2;
  const sU = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);
  if (sU === 0) return null;
  const z = (U - mU) / sU;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  return { U, z, pValue, significant: pValue < 0.05 };
}

// Wilcoxon signed-rank test
function wilcoxonSignedRank(arr1, arr2) {
  if (arr1.length !== arr2.length || arr1.length < 2) return null;
  const diffs = arr1.map((v, i) => v - arr2[i]);
  const nonZero = diffs.filter(d => d !== 0);
  if (nonZero.length < 2) return null;
  const absDiffs = nonZero.map(d => ({ abs: Math.abs(d), sign: d > 0 ? 1 : -1 }));
  absDiffs.sort((a, b) => a.abs - b.abs);
  const ranks = rankArray(absDiffs.map(d => d.abs));
  const Wplus = sum(absDiffs.map((d, i) => d.sign > 0 ? ranks[i] : 0));
  const Wminus = sum(absDiffs.map((d, i) => d.sign < 0 ? ranks[i] : 0));
  const W = Math.min(Wplus, Wminus);
  const nR = absDiffs.length;
  const mW = nR * (nR + 1) / 4;
  const sW = Math.sqrt(nR * (nR + 1) * (2 * nR + 1) / 24);
  if (sW === 0) return null;
  const z = (W - mW) / sW;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  return { W, Wplus, Wminus, z, n: nR, pValue, significant: pValue < 0.05 };
}

// Kruskal-Wallis H test
function kruskalWallis(groups, labels) {
  if (groups.length < 2) return null;
  const groupData = groups.map((g, i) => ({ vals: g, label: labels?.[i] || `Group ${i + 1}`, n: g.length }));
  const flat = groups.flat();
  const ranks = rankArray(flat);
  let idx = 0;
  const groupRanks = groupData.map(g => {
    const r = ranks.slice(idx, idx + g.n);
    idx += g.n;
    return { ...g, rankSum: sum(r), meanRank: mean(r) };
  });
  const N = flat.length;
  const H12 = 12 / (N * (N + 1));
  const Hsum = sum(groupRanks.map(g => g.rankSum ** 2 / g.n));
  const H = H12 * Hsum - 3 * (N + 1);
  const df = groups.length - 1;
  const pValue = 1 - fCDF(H, df, 100000);
  return { H, df, pValue, significant: pValue < 0.05, groupRanks };
}

// ─── Friedman test (non-parametric repeated measures, 3+ groups) ────────
function friedmanTest(groups, labels) {
  const n = groups[0].length;
  if (groups.some(g => g.length !== n) || n < 2) return null;
  const k = groups.length;
  // Rank within each block (subject across occasions)
  const rankMatrix = Array.from({ length: n }, (_, i) => {
    const block = groups.map(g => g[i]);
    const ranks = rankArray(block);
    return ranks;
  });
  const rankSums = Array(k).fill(0);
  for (let j = 0; j < k; j++)
    for (let i = 0; i < n; i++)
      rankSums[j] += rankMatrix[i][j];
  const meanRank = (k + 1) / 2;
  const ss = rankSums.reduce((s, rj) => s + (rj - n * meanRank) ** 2, 0);
  const Q = 12 / (n * k * (k + 1)) * ss;
  const df = k - 1;
  // Friedman's Q ≈ χ² on df
  let pValue = 1 - fCDF(Q, df, 100000);
  // Correct for small n using exact F-approximation
  if (n < 10) {
    const F_approx = ( (n - 1) * Q ) / ( n * (k - 1) - Q );
    const df1 = k - 1;
    const df2 = (n - 1) * (k - 1);
    if (F_approx > 0) pValue = 1 - fCDF(F_approx, df1, df2);
  }
  // Kendall's W (effect size for Friedman)
  const totalSS = (n * k * (k + 1) * (k - 1)) / 12;
  const kendallW = totalSS > 0 ? ss / totalSS : 0;
  return { Q, df, pValue, significant: pValue < 0.05, kendallW, rankSums, groupRanks: labels.map((l, j) => ({ label: l, meanRank: rankSums[j] / n })) };
}

// ─── Repeated measures ANOVA ─────────────────────────────────────────────
function repeatedMeasuresANOVA(groups) {
  const n = groups[0].length;
  const k = groups.length;
  if (groups.some(g => g.length !== n) || n < 3 || k < 2) return null;
  const subjectMeans = Array.from({ length: n }, (_, i) => mean(groups.map(g => g[i])));
  const grandMean = mean(subjectMeans);
  const conditionMeans = groups.map(g => mean(g));
  // SS between conditions
  const ssCond = n * conditionMeans.reduce((s, cm) => s + (cm - grandMean) ** 2, 0);
  // SS between subjects
  const ssSubj = k * subjectMeans.reduce((s, sm) => s + (sm - grandMean) ** 2, 0);
  // Total SS
  let ssTot = 0;
  for (let j = 0; j < k; j++)
    for (let i = 0; i < n; i++)
      ssTot += (groups[j][i] - grandMean) ** 2;
  const ssErr = ssTot - ssCond - ssSubj;
  const dfCond = k - 1;
  const dfErr = (k - 1) * (n - 1);
  if (dfErr <= 0) return null;
  const msCond = ssCond / dfCond;
  const msErr = ssErr / dfErr;
  const F = msErr > 0 ? msCond / msErr : 0;
  const pValue = 1 - fCDF(F, dfCond, dfErr);
  const partialEtaSq = (ssCond + ssErr) > 0 ? ssCond / (ssCond + ssErr) : 0;
  return { F, dfCond, dfErr, pValue, significant: pValue < 0.05, ssCond, ssErr, ssSubj, partialEtaSq, conditionMeans, grandMean };
}

// Post-hoc for repeated measures (Bonferroni-corrected paired t-tests)
function pairedPostHoc(groups, labels) {
  const results = [];
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const diff = mean(groups[i]) - mean(groups[j]);
      const tRes = tTestPaired(groups[i], groups[j]);
      if (!tRes) continue;
      results.push({
        groupA: labels[i], groupB: labels[j],
        meanDiff: diff,
        t: tRes.t,
        df: tRes.df,
        pValue: tRes.pValue,
        significant: tRes.significant,
      });
    }
  }
  return results;
}

// ─── Effect sizes ─────────────────────────────────────────────────────────
function cohensD_(arr1, arr2) {
  const n1 = arr1.length, n2 = arr2.length;
  const m1 = mean(arr1), m2 = mean(arr2);
  const sd1 = stdev(arr1, m1), sd2 = stdev(arr2, m2);
  const sdPooled = Math.sqrt(((n1 - 1) * sd1 ** 2 + (n2 - 1) * sd2 ** 2) / (n1 + n2 - 2));
  if (!sdPooled) return null;
  const d = (m1 - m2) / sdPooled;
  const se = Math.sqrt((n1 + n2) / (n1 * n2) + d * d / (2 * (n1 + n2)));
  const z = 1.96;
  const absD = Math.abs(d);
  const interpretation = absD < 0.2 ? "Negligible" : absD < 0.5 ? "Small" : absD < 0.8 ? "Medium" : absD < 1.2 ? "Large" : "Very large";
  return { cohensD: d, ci95: [d - z * se, d + z * se], interpretation, measure: "Cohen's d" };
}

function effectSizeForTest(testName, result, groups) {
  if (!result) return null;
  if (testName === "Independent t-test" || testName === "Welch's t-test") {
    return cohensD_(groups[0], groups[1]);
  }
  if (testName === "Paired t-test") {
    const n = groups[0].length;
    const dz = result.t / Math.sqrt(n);
    const absDz = Math.abs(dz);
    const interpretation = absDz < 0.2 ? "Negligible" : absDz < 0.5 ? "Small" : absDz < 0.8 ? "Medium" : absDz < 1.2 ? "Large" : "Very large";
    return { cohensDz: dz, interpretation, measure: "Cohen's dz" };
  }
  if (testName === "Mann-Whitney U") {
    const n1 = groups[0].length, n2 = groups[1].length;
    const rankBiserial = 1 - 2 * result.U / (n1 * n2);
    const absR = Math.abs(rankBiserial);
    const interpretation = absR < 0.1 ? "Negligible" : absR < 0.3 ? "Small" : absR < 0.5 ? "Medium" : absR < 0.7 ? "Large" : "Very large";
    return { rankBiserial, interpretation, measure: "Rank-biserial r" };
  }
  if (testName === "Wilcoxon signed-rank") {
    const n = groups[0].length;
    const r = result.z / Math.sqrt(n);
    const absR = Math.abs(r);
    const interpretation = absR < 0.1 ? "Negligible" : absR < 0.3 ? "Small" : absR < 0.5 ? "Medium" : absR < 0.7 ? "Large" : "Very large";
    return { matchedPairsR: r, interpretation, measure: "Matched-pairs rank-biserial" };
  }
  if (testName === "One-way ANOVA") {
    const etaSq = result.ssBetween / (result.ssBetween + result.ssWithin);
    const omegaSq = (result.ssBetween - result.dfBetween * result.msWithin) / (result.ssBetween + result.ssWithin + result.msWithin);
    const absEta = Math.abs(etaSq);
    const interpretation = absEta < 0.01 ? "Negligible" : absEta < 0.06 ? "Small" : absEta < 0.14 ? "Medium" : "Large";
    return { etaSq, omegaSq, interpretation, measure: "η² / ω²" };
  }
  if (testName === "Repeated measures ANOVA") {
    const interpretation = result.partialEtaSq < 0.01 ? "Negligible" : result.partialEtaSq < 0.06 ? "Small" : result.partialEtaSq < 0.14 ? "Medium" : "Large";
    return { partialEtaSq: result.partialEtaSq, interpretation, measure: "Partial η²" };
  }
  if (testName === "Kruskal-Wallis") {
    const N = groups.flat().length;
    const epsilonSq = N > 1 ? result.H / ((N ** 2 - 1) / (N + 1)) : 0;
    const absEps = Math.abs(epsilonSq);
    const interpretation = absEps < 0.01 ? "Negligible" : absEps < 0.06 ? "Small" : absEps < 0.14 ? "Medium" : "Large";
    return { epsilonSq, interpretation, measure: "Epsilon-squared" };
  }
  if (testName === "Friedman test") {
    const interpretation = result.kendallW < 0.1 ? "Negligible" : result.kendallW < 0.3 ? "Small" : result.kendallW < 0.5 ? "Medium" : "Large";
    return { kendallW: result.kendallW, interpretation, measure: "Kendall's W" };
  }
  return null;
}

function independentTTest(arr1, arr2, welch = false) {
  const n1 = arr1.length, n2 = arr2.length;
  if (n1 < 2 || n2 < 2) return null;
  const m1 = mean(arr1), m2 = mean(arr2);
  const v1 = variance(arr1, m1), v2 = variance(arr2, m2);
  if (welch) {
    const se = Math.sqrt(v1 / n1 + v2 / n2);
    if (se === 0) return null;
    const t = (m1 - m2) / se;
    const dfNum = (v1 / n1 + v2 / n2) ** 2;
    const dfDen = (v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1);
    const df = dfDen === 0 ? Math.min(n1 - 1, n2 - 1) : dfNum / dfDen;
    const pValue = 2 * (1 - tDistributeCDF(Math.abs(t), Math.round(df)));
    return { t, df: Math.round(df), pValue, significant: pValue < 0.05, method: "Welch's t-test" };
  }
  const sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
  const se = Math.sqrt(sp2 * (1 / n1 + 1 / n2));
  if (se === 0) return null;
  const t = (m1 - m2) / se;
  const df = n1 + n2 - 2;
  const pValue = 2 * (1 - tDistributeCDF(Math.abs(t), df));
  return { t, df, pValue, significant: pValue < 0.05, method: "Independent t-test" };
}

// Studentized range distribution (approximate)
function studentizedRangeCDF(q, k, df) {
  if (q <= 0 || k < 2 || df < 1) return 0;
  let p = 0;
  const steps = 80;
  const dHalf = df / 2;
  for (let i = 0; i <= steps; i++) {
    const x = 0.001 + (8 - 0.001) * i / steps;
    let inner = 1;
    for (let j = 0; j < k - 1; j++) {
      inner *= normalCdf(q * x / Math.sqrt(2));
    }
    const w = (i === 0 || i === steps) ? 1 : (i % 2 === 1 ? 4 : 2);
    // PDF of Y = sqrt(chi^2_df / df) — compute ln-scale
    const logF = dHalf * Math.log(df) - (dHalf - 1) * Math.log(2) - gammaLn(dHalf) + (df - 1) * Math.log(x) - df * x * x / 2;
    p += w * inner * Math.exp(logF) * (8 - 0.001) / (3 * steps);
  }
  return Math.min(1, Math.max(0, p));
}

function tukeysHSD(groups, labels, mse, dfError) {
  const results = [];
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const ni = groups[i].length, nj = groups[j].length;
      const mi = mean(groups[i]), mj = mean(groups[j]);
      const diff = mi - mj;
      const se = Math.sqrt(mse * (1 / ni + 1 / nj) / 2);
      if (se === 0) continue;
      const q = Math.abs(diff) / se;
      const k = groups.length;
      const dfE = dfError;
      const p = 1 - studentizedRangeCDF(q, k, dfE);
      const qCrit = 3.6 + (k - 2) * 0.5;
      results.push({
        groupA: labels[i], groupB: labels[j],
        meanDiff: diff, se, q, pValue: Math.min(1, p),
        significant: q > qCrit,
        ci95: [diff - qCrit * se, diff + qCrit * se],
      });
    }
  }
  return results;
}

function bonferroniAdjust(pValues, alpha = 0.05) {
  const m = pValues.length;
  return pValues.map((p, i) => ({
    index: i, original: p,
    adjusted: Math.min(p * m, 1),
    significant: p * m < alpha,
  }));
}

function benjaminiHochberg(pValues, alpha = 0.05) {
  const m = pValues.length;
  const indexed = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  let lastSig = -1;
  for (let rank = 0; rank < m; rank++) {
    if (indexed[rank].p <= ((rank + 1) / m) * alpha) lastSig = rank;
  }
  return indexed.map((item, rank) => ({
    ...item, adjusted: item.p * m / (rank + 1),
    significant: rank <= lastSig,
  })).sort((a, b) => a.i - b.i);
}

// Approx F from Wilks' lambda
function fFromWilks(lambda, p, k, N) {
  const df1 = p * (k - 1);
  const t = Math.sqrt((p ** 2 * (k - 1) ** 2 - 4) / (p ** 2 + (k - 1) ** 2 - 5));
  const df2 = t * (N - (p + k) / 2 + 0.5) - (p * (k - 1) - 2) / 2;
  const F = ((1 - lambda ** (1 / t)) / (lambda ** (1 / t))) * (df2 / df1);
  const pValue = 1 - fCDF(F, df1, df2);
  return { F, df1: Math.round(df1), df2: Math.round(df2), pValue };
}

function matMul(A, B) {
  const m = A.length, n = A[0].length, p = B[0].length;
  const C = Array.from({ length: m }, () => Array(p).fill(0));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < p; j++)
      for (let k = 0; k < n; k++)
        C[i][j] += A[i][k] * B[k][j];
  return C;
}

function matInverse(A) {
  const n = A.length;
  const aug = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
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

function eigenvalues2x2(A) {
  const tr = A[0][0] + A[1][1];
  const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  const d = tr * tr - 4 * det;
  if (d < 0) return [tr / 2, tr / 2];
  const sqrtD = Math.sqrt(d);
  return [(tr + sqrtD) / 2, (tr - sqrtD) / 2];
}

function runMANOVA(groups, measurements) {
  const groupKeys = Object.keys(groups);
  const k = groupKeys.length;
  const p = measurements.length;
  if (k < 2 || p < 2) return null;
  const matrices = groupKeys.map(g => groups[g].map(c => measurements.map(m => c[m])));
  const ns = matrices.map(m => m.length);
  const N = ns.reduce((a, b) => a + b, 0);
  const grandMeans = measurements.map((_, j) => mean(matrices.flat().map(row => row[j])));
  const groupMeans = matrices.map(mat => measurements.map((_, j) => mean(mat.map(row => row[j]))));

  const zeros = () => Array.from({ length: p }, () => Array(p).fill(0));
  const H = zeros();
  for (let g = 0; g < k; g++) {
    const d = groupMeans[g].map((v, i) => v - grandMeans[i]);
    for (let r = 0; r < p; r++)
      for (let c = 0; c < p; c++)
        H[r][c] += ns[g] * d[r] * d[c];
  }
  const E = zeros();
  for (let g = 0; g < k; g++) {
    for (const obs of matrices[g]) {
      const d = obs.map((v, i) => v - groupMeans[g][i]);
      for (let r = 0; r < p; r++)
        for (let c = 0; c < p; c++)
          E[r][c] += d[r] * d[c];
    }
  }
  const Einv = matInverse(E);
  if (!Einv) return null;
  const EinvH = matMul(Einv, H);
  const eigenvals = p === 2 ? eigenvalues2x2(EinvH) : [1];
  const wilksLambda = eigenvals.reduce((prod, ev) => prod * 1 / (1 + ev), 1);
  const pillaiTrace = eigenvals.reduce((sum, ev) => sum + ev / (1 + ev), 0);
  const fApprox = fFromWilks(wilksLambda, p, k, N);
  return {
    wilksLambda, pillaiTrace,
    hotellingsTrace: eigenvals.reduce((a, e) => a + e, 0),
    roysLargestRoot: Math.max(...eigenvals),
    F: fApprox.F, df1: fApprox.df1, df2: fApprox.df2,
    pValue: fApprox.pValue,
    significant: fApprox.pValue < 0.05,
    eigenvalues: eigenvals,
    nGroups: k, nDVs: p, N,
  };
}

// ─── Test selection logic ──────────────────────────────────────────────────
function selectAndRunTest(labelData, design, alpha) {
  const groups = Object.values(labelData);
  const groupLabels = Object.keys(labelData);
  const nGroups = groups.length;
  const ns = groups.map(g => g.length);
  const minN = Math.min(...ns);

  if (groups.some(g => g.length < 2)) {
    return { skip: true, reason: "Insufficient data (<2 per group)" };
  }

  const a = alpha || 0.05;
  const normalityTests = groups.map(g => shapiroWilk(g));
  const allNormal = normalityTests.every(t => t && t.pValue > a);
  const paired = design === "paired";

  // For paired designs, all groups must have equal size
  if (paired && groups.some(g => g.length !== groups[0].length)) {
    return { skip: true, reason: "Paired design requires equal group sizes" };
  }

  let testName, result, assumptions = { normalityTests, allNormal };

  // Check equal variance only for independent designs
  if (!paired) {
    const levene = allNormal ? levenesTest(...groups) : null;
    const equalVar = levene ? levene.pValue > a : false;
    assumptions.levene = levene;
    assumptions.equalVar = equalVar;
  }

  try {
    if (paired) {
      if (nGroups === 2) {
        if (allNormal && minN >= 20) {
          testName = "Paired t-test";
          result = tTestPaired(groups[0], groups[1]);
        } else {
          testName = "Wilcoxon signed-rank";
          result = wilcoxonSignedRank(groups[0], groups[1]);
        }
      } else {
        if (allNormal && minN >= 5) {
          testName = "Repeated measures ANOVA";
          result = repeatedMeasuresANOVA(groups);
        } else {
          testName = "Friedman test";
          result = friedmanTest(groups, groupLabels);
        }
      }
    } else {
      // independent design
      if (nGroups === 2) {
        if (allNormal && minN >= 20) {
          testName = assumptions.equalVar ? "Independent t-test" : "Welch's t-test";
          result = independentTTest(groups[0], groups[1], !assumptions.equalVar);
        } else {
          testName = "Mann-Whitney U";
          result = mannWhitneyU(groups[0], groups[1]);
        }
      } else {
        if (allNormal && assumptions.equalVar && minN >= 5) {
          testName = "One-way ANOVA";
          result = oneWayAnova(...groups);
        } else {
          testName = "Kruskal-Wallis";
          result = kruskalWallis(groups, groupLabels);
        }
      }
    }
  } catch (e) {
    return { skip: true, reason: e.message };
  }

  if (!result) return { skip: true, reason: "Test returned null" };

  // ── Compute effect size appropriate for the test ──
  const effectSize = effectSizeForTest(testName, result, groups);

  // ── Build raw data summary ──
  const rawData = {};
  groupLabels.forEach((l, i) => {
    rawData[l] = { values: groups[i], n: ns[i], mean: mean(groups[i]), sd: stdev(groups[i], mean(groups[i])) };
  });

  return { testName, result, assumptions, rawData, effectSize };
}

// ─── Collect measurements per group ────────────────────────────────────────
function collectGroupedMeasurements(sessions, groups, labelIds, calibration) {
  const byGroup = {};
  for (const g of groups) {
    const gSessions = (g.caseIds || []).map(id => sessions.find(s => s.id === id)).filter(Boolean);
    const byLabel = {};
    for (const s of gSessions) {
      const cal = s.calibration?.done ? s.calibration : calibration || { done: false, pxPerMm: 1 };
      const markups = s.markups || [];
      for (const m of markups) {
        if (!m.label) continue;
        if (labelIds.length > 0 && !labelIds.includes(m.label)) continue;
        if (m.type === "ruler" || m.type === "silhouette") continue;
        if (!m.visible || !m.placed) continue;
        try {
          const vals = computeMeasurements(m, cal);
          const firstNum = Object.values(vals).find(v => typeof v === "number" && isFinite(v));
          if (firstNum != null) {
            if (!byLabel[m.label]) byLabel[m.label] = [];
            byLabel[m.label].push(firstNum);
          }
        } catch { /* skip */ }
      }
    }
    byGroup[g.label] = { group: g, sessions: gSessions, byLabel };
  }
  return byGroup;
}

// ─── Main entry point ──────────────────────────────────────────────────────
export function runComparativeAll(sessions, config, calibration) {
  const { design, groups, labelIds, alpha, mcCorrection } = config;

  if (!groups || groups.length < 2) return { error: "At least 2 groups required" };
  const byGroup = collectGroupedMeasurements(sessions, groups, labelIds || [], calibration);
  const groupLabels = groups.map(g => g.label);

  // Collect all available labels across groups
  const allLabels = [...new Set(
    Object.values(byGroup).flatMap(g => Object.keys(g.byLabel))
  )].sort();

  const results = {
    design,
    groups: groups.map(g => ({ label: g.label, caseCount: (g.caseIds || []).length })),
    labels: {},
    manova: null,
    groupData: {},
    alpha: alpha || 0.05,
    mcCorrection: mcCorrection || "bonferroni",
  };

  // Per-label test results
  for (const label of allLabels) {
    const labelData = {};
    for (const gLabel of groupLabels) {
      const vals = (byGroup[gLabel]?.byLabel[label] || []);
      labelData[gLabel] = vals;
    }
    results.labels[label] = selectAndRunTest(labelData, design, alpha || 0.05);
    results.labels[label].label = label;
  }

  // Group descriptive data
  for (const gLabel of groupLabels) {
    const gd = byGroup[gLabel];
    if (!gd) continue;
    results.groupData[gLabel] = {
      nSessions: gd.sessions.length,
      labelCounts: Object.fromEntries(
        Object.entries(gd.byLabel).map(([l, vals]) => [l, vals.length])
      ),
    };
  }

  // Multi-group post-hoc (only for 3+ groups)
  if (groups.length >= 3) {
    results.postHoc = {};
    for (const [label, lr] of Object.entries(results.labels)) {
      if (lr.skip || !lr.result) continue;
      const isIndependentANOVA = lr.testName === "One-way ANOVA";
      const isRepeatedANOVA = lr.testName === "Repeated measures ANOVA";
      if (!isIndependentANOVA && !isRepeatedANOVA) continue;

      const gVals = groupLabels.map(gl => (byGroup[gl]?.byLabel[label] || []));

      if (isIndependentANOVA) {
        const mse = lr.result.msWithin;
        const dfE = lr.result.dfWithin;
        results.postHoc[label] = tukeysHSD(gVals, groupLabels, mse, dfE);
      } else if (isRepeatedANOVA) {
        // Bonferroni-corrected paired t-tests for repeated measures
        const raw = pairedPostHoc(gVals, groupLabels);
        const m = raw.length;
        if (m > 0) {
          results.postHoc[label] = raw.map(r => ({
            ...r,
            pAdjusted: Math.min(r.pValue * m, 1),
            significant: r.pValue * m < (alpha || 0.05),
          }));
        }
      }
    }
  }

  // Multiple comparison correction
  if (mcCorrection && mcCorrection !== "none") {
    const labels = Object.entries(results.labels).filter(([, lr]) => !lr.skip && lr.result && lr.result.pValue != null);
    const pValues = labels.map(([, lr]) => lr.result.pValue);
    if (pValues.length > 0) {
      let corrected;
      if (mcCorrection === "bonferroni") corrected = bonferroniAdjust(pValues, alpha || 0.05);
      else if (mcCorrection === "bh") corrected = benjaminiHochberg(pValues, alpha || 0.05);
      else corrected = pValues.map(p => ({ original: p, adjusted: p, significant: p < (alpha || 0.05) }));
      labels.forEach(([label], i) => {
        results.labels[label].mcCorrected = corrected[i];
      });
    }
  }

  // MANOVA (if multiple labels)
  const validLabels = allLabels.filter(l => {
    const lr = results.labels[l];
    return !lr.skip && lr.rawData;
  });
  if (validLabels.length >= 2) {
    const manovaGroups = {};
    for (const gLabel of groupLabels) {
      manovaGroups[gLabel] = [];
      const sessionsInGroup = byGroup[gLabel]?.sessions || [];
      for (const s of sessionsInGroup) {
        const cal = s.calibration?.done ? s.calibration : calibration || { done: false, pxPerMm: 1 };
        const entry = {};
        let valid = true;
        for (const label of validLabels) {
          const markups = (s.markups || []).filter(m => m.label === label && m.visible && m.placed);
          let val = null;
          for (const m of markups) {
            try {
              const v = Object.values(computeMeasurements(m, cal)).find(x => typeof x === "number" && isFinite(x));
              if (v != null) { val = v; break; }
            } catch { /* skip */ }
          }
          if (val == null) { valid = false; break; }
          entry[label] = val;
        }
        if (valid) manovaGroups[gLabel].push(entry);
      }
    }
    const manovaCounts = Object.values(manovaGroups).map(s => s.length);
    if (manovaCounts.every(n => n >= 2)) {
      results.manova = runMANOVA(manovaGroups, validLabels);
    }
  }

  return results;
}
