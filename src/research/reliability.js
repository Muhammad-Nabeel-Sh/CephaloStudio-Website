import { computeMeasurements, tDistributeCDF } from "../utils.js";
import { checkReliabilityTimeSeparation } from "./validation.js";
import { logError } from "../logger.js";

// ─── Statistical helpers ──────────────────────────────────────────────────
function fCritical(p, df1, df2) {
  if (df1 <= 0 || df2 <= 0) return 1;
  const z = p >= 0.995 ? 2.807 : p >= 0.975 ? 1.96 : p >= 0.95 ? 1.645 : 0;
  const a = 2 / (9 * df1);
  const b = 2 / (9 * df2);
  const num = 1 - b + z * Math.sqrt(b);
  const denom = 1 - a - z * Math.sqrt(a);
  if (denom <= 0) return 10;
  return Math.pow(num / denom, 3);
}

function stdNormalCdf(x) {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const a = 0.3193815, b = -0.3565638, c = 1.7814779, d = -1.8212559, e = 1.3302744;
  const phi = 0.39894228 * Math.exp(-x * x / 2);
  let t = 1 / (1 + 0.2316419 * Math.abs(x));
  t = phi * t * (a + t * (b + t * (c + t * (d + t * e))));
  return x > 0 ? 1 - t : t;
}

function fPval(F, df1, df2) {
  if (F <= 0 || df1 <= 0 || df2 <= 0) return 1;
  const z = ((1 - 2 / (9 * df2)) * Math.pow(F, 1 / 3) - (1 - 2 / (9 * df1))) /
    Math.sqrt(2 / (9 * df1) * Math.pow(F, 2 / 3) + 2 / (9 * df2));
  return 2 * (1 - stdNormalCdf(Math.abs(z)));
}

function simpleRegression(x, y) {
  const n = x.length;
  if (n < 3) return { slope: 0, intercept: 0, r: 0, pValue: 1 };
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  const slope = sxx !== 0 ? sxy / sxx : 0;
  const intercept = my - slope * mx;
  const r = Math.sqrt(sxx * syy) !== 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  // Use the t-distribution (n-2 df) for the slope p-value, not a normal CDF with an
  // ad-hoc correction factor. The previous `2*(1 - stdNormalCdf(|t|*(1 - 0.5/(n-2))))`
  // was neither a valid t-test nor a valid z-test.
  const sse = syy - slope * sxy;
  const seSlope = sxx > 0 ? Math.sqrt(sse / (n - 2) / sxx) : 0;
  const t = seSlope > 0 ? slope / seSlope : 0;
  const pValue = n > 2 ? 2 * (1 - tDistributeCDF(Math.abs(t), n - 2)) : 1;
  return { slope, intercept, r, pValue, t, seSlope };
}

// ─── ICC (Shrout & Fleiss / McGraw & Wong) ──────────────────────────────
function iccShroutFleiss(data, k, type) {
  const subjects = [...new Set(data.map(d => d.subject))];
  const raters = [...new Set(data.map(d => d.rater))];
  const n = subjects.length;
  if (n < 2) return null;

  const matrix = subjects.map(s =>
    raters.map(r => {
      const entry = data.find(d => d.subject === s && d.rater === r);
      return entry ? entry.value : null;
    })
  );

  const allVals = matrix.flat().filter(v => v != null);
  const grandMean = allVals.reduce((a, b) => a + b, 0) / allVals.length;

  const rowMeans = matrix.map(row => {
    const v = row.filter(x => x != null);
    return v.reduce((a, b) => a + b, 0) / v.length;
  });
  const colMeans = raters.map((_, j) => {
    const col = matrix.map(row => row[j]).filter(v => v != null);
    return col.reduce((a, b) => a + b, 0) / col.length;
  });

  const kActual = type.endsWith("k") ? k : 1;

  let SSR = 0, SSC = 0, SSE = 0;
  for (let i = 0; i < n; i++) {
    SSR += k * (rowMeans[i] - grandMean) ** 2;
    for (let j = 0; j < k; j++) {
      const v = matrix[i][j];
      if (v == null) continue;
      const e = v - rowMeans[i] - colMeans[j] + grandMean;
      SSE += e * e;
    }
  }
  for (let j = 0; j < k; j++) {
    SSC += n * (colMeans[j] - grandMean) ** 2;
  }

  const dfS = n - 1, dfR = k - 1, dfE = (n - 1) * (k - 1);
  const MSR = SSR / dfS;
  const MSC = SSC / dfR;
  const MSE = dfE > 0 ? SSE / dfE : 0;

  let icc;
  if (type.startsWith("icc1")) {
    const MSW = (SSE + SSC) / (n * (k - 1));
    icc = MSW !== 0 ? (MSR - MSW) / (MSR + (kActual - 1) * MSW) : 0;
  } else if (type.startsWith("icc2")) {
    icc = MSE > 0
      ? (MSR - MSE) / (MSR + (kActual - 1) * MSE + kActual * Math.max(0, MSC - MSE) / n)
      : 0;
  } else {
    icc = MSR !== 0 ? (MSR - MSE) / (MSR + (kActual - 1) * MSE) : 0;
  }
  icc = Math.max(-1, Math.min(1, icc));

  const F = MSE > 0 ? MSR / MSE : 0;
  const fcU = fCritical(0.975, dfS, dfE);
  const fcL = fCritical(0.975, dfE, dfS);
  const Fl = F > 0 ? F / fcU : 0;
  const Fu = F * fcL;
  const ciLow = Math.max(-1, (Fl - 1) / (Fl + kActual - 1));
  const ciHigh = Math.min(1, (Fu - 1) / (Fu + kActual - 1));

  const pValue = fPval(F, dfS, dfE);

  return { icc, ci95: [ciLow, ciHigh], F, df1: dfS, df2: dfE, pValue, n, k, model: type };
}

// ─── Bland-Altman ─────────────────────────────────────────────────────────
// For 3+ occasions, the previous version silently dropped all but the first two
// readings per case (the `if (paired[key].length < 2) paired[key].push(s.value)` guard
// capped at 2). We now pair ALL combinations of readings per case, preserving all data.
function runBlandAltman(samples) {
  // Group all readings per case (was capped at 2 — dropped 3rd+ occasions silently)
  const byCase = {};
  for (const s of samples) {
    if (!byCase[s.caseId]) byCase[s.caseId] = [];
    byCase[s.caseId].push(s.value);
  }
  // Generate ALL pairs from each case's readings
  const pairs = [];
  for (const vals of Object.values(byCase)) {
    for (let i = 0; i < vals.length; i++) {
      for (let j = i + 1; j < vals.length; j++) {
        pairs.push([vals[i], vals[j]]);
      }
    }
  }
  if (pairs.length < 2) return {};

  const means = pairs.map(p => (p[0] + p[1]) / 2);
  const diffs = pairs.map(p => p[0] - p[1]);
  const n = diffs.length;

  const meanDiff = diffs.reduce((a, b) => a + b, 0) / n;
  const sdDiff = Math.sqrt(diffs.reduce((s, d) => s + (d - meanDiff) ** 2, 0) / (n - 1));
  // Use the t-distribution for the LoA CI (was z=1.96, which underestimates the CI for
  // small n). The SE of the LoA limits is sqrt(3·sd²/n).
  const seLoA = Math.sqrt(3 * sdDiff * sdDiff / n);
  const df = n - 1;
  let tCrit = 1.96;
  if (df > 0) {
    const target = 0.975;
    let lo = 1.5, hi = 5.0;
    for (let it = 0; it < 50; it++) {
      const mid = (lo + hi) / 2;
      const p = tDistributeCDF(mid, df);
      if (p < target) lo = mid; else hi = mid;
    }
    tCrit = (lo + hi) / 2;
  }

  const reg = simpleRegression(means, diffs);

  return {
    meanDiff, sdDiff, n,
    loaUpper: meanDiff + 1.96 * sdDiff,
    loaLower: meanDiff - 1.96 * sdDiff,
    loaUpperCi: [meanDiff + 1.96 * sdDiff - tCrit * seLoA, meanDiff + 1.96 * sdDiff + tCrit * seLoA],
    loaLowerCi: [meanDiff - 1.96 * sdDiff - tCrit * seLoA, meanDiff - 1.96 * sdDiff + tCrit * seLoA],
    meanDiffCi: [meanDiff - tCrit * sdDiff / Math.sqrt(n), meanDiff + tCrit * sdDiff / Math.sqrt(n)],
    proportionalBias: { detected: reg.pValue < 0.05, slope: reg.slope, r: reg.r, pValue: reg.pValue, t: reg.t },
    points: means.map((m, i) => ({ mean: m, diff: diffs[i], outlier: Math.abs(diffs[i] - meanDiff) > 2 * sdDiff })),
    nPairs: n,
    nCases: Object.keys(byCase).length,
  };
}

// ─── Dahlberg / SEM / MDC ─────────────────────────────────────────────────
// Use ALL pairs from 3+ occasions (was capped at 2 readings per case).
function runDahlbergSEM(samples) {
  const byCase = {};
  for (const s of samples) {
    if (!byCase[s.caseId]) byCase[s.caseId] = [];
    byCase[s.caseId].push(s.value);
  }
  let sumSqDiff = 0, count = 0;
  const allVals = [];
  for (const vals of Object.values(byCase)) {
    for (let i = 0; i < vals.length; i++) {
      for (let j = i + 1; j < vals.length; j++) {
        const d = vals[i] - vals[j];
        sumSqDiff += d * d;
        count++;
        allVals.push(vals[i], vals[j]);
      }
    }
  }
  if (count < 2) return {};

  const dahlberg = Math.sqrt(sumSqDiff / (2 * count));
  const grandMean = allVals.reduce((a, b) => a + b, 0) / allVals.length;
  const cv = grandMean !== 0 ? (dahlberg / grandMean) * 100 : 0;
  const sem = dahlberg;
  const mdc = 1.96 * Math.sqrt(2) * sem;

  return { dahlberg, sem, cv, mdc, n: count, nCases: Object.keys(byCase).length };
}

// ─── Landmark coordinate error mapping ────────────────────────────────────
// Coordinates are collected in PIXELS. The error map must convert to mm using the
// session's calibration (pxPerMm) so that errors are comparable across sessions
// captured at different resolutions. The previous version reported errors in raw
// pixels without labeling them as such, leading clinicians to misread the numbers
// as millimeters.
function collectLandmarkCoords(sessions, labelIds, calibration) {
  const rows = [];
  for (const s of sessions) {
    if (!s) continue;
    const cal = s.calibration?.done ? s.calibration : calibration || { done: false, pxPerMm: 1 };
    const ppm = cal?.pxPerMm || 1;
    const markups = s.markups || [];
    for (const m of markups) {
      if (!m.label) continue;
      if (labelIds.length > 0 && !labelIds.includes(m.label)) continue;
      if (m.type === "ruler" || m.type === "silhouette" || m.type === "line" || m.type === "angle3") continue;
      if (!m.visible || !m.placed) continue;
      for (const p of (m.points || [])) {
        // Convert pixel coordinates to mm
        rows.push({ sessionId: s.id, label: m.label, x: p.x / ppm, y: p.y / ppm, unit: "mm" });
      }
    }
  }
  return rows;
}

function runLandmarkErrorMap(coords) {
  const byLabel = {};
  for (const c of coords) {
    if (!byLabel[c.label]) byLabel[c.label] = [];
    byLabel[c.label].push(c);
  }

  const result = {};
  for (const [label, pts] of Object.entries(byLabel)) {
    if (pts.length < 2) continue;
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const radialErrors = pts.map(p => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2));
    const meanError = radialErrors.reduce((a, b) => a + b, 0) / radialErrors.length;
    const maxError = Math.max(...radialErrors);
    const sdError = Math.sqrt(radialErrors.reduce((s, r) => s + (r - meanError) ** 2, 0) / (radialErrors.length - 1));

    // 2x2 covariance matrix
    const m = pts.length;
    const cxx = pts.reduce((s, p) => s + (p.x - cx) ** 2, 0) / (m - 1);
    const cyy = pts.reduce((s, p) => s + (p.y - cy) ** 2, 0) / (m - 1);
    const cxy = pts.reduce((s, p) => s + (p.x - cx) * (p.y - cy), 0) / (m - 1);

    const trace = cxx + cyy;
    const det = cxx * cyy - cxy * cxy;
    const disc = Math.max(0, trace * trace - 4 * det);
    const eig1 = (trace + Math.sqrt(disc)) / 2;
    const eig2 = (trace - Math.sqrt(disc)) / 2;
    const angle = cxx !== cyy ? 0.5 * Math.atan2(2 * cxy, cxx - cyy) : Math.PI / 4;

    result[label] = {
      centroid: { x: cx, y: cy },
      n: m,
      meanError,
      maxError,
      sdError,
      unit: "mm",
      ellipse: {
        major: Math.sqrt(5.991) * Math.sqrt(Math.max(eig1, 0)),
        minor: Math.sqrt(5.991) * Math.sqrt(Math.max(eig2, 0)),
        angle,
        unit: "mm",
      },
    };
  }

  return result;
}

// ─── Main entry point ─────────────────────────────────────────────────────
export function runReliabilityAll(sessions, config, calibration) {
  const { labelIds, cases, operators, protocol } = config;
  if (!cases || cases.length === 0) {
    return { measurements: 0, sessions: 0, labels: 0, details: [], note: "No cases defined. Add cases and map sessions first." };
  }

  // Build session → { caseId, caseName, operatorId, occasion } lookup
  // Each sessionId maps to ONE entry (last write wins if duplicates exist)
  const sessionMap = {};
  for (const c of cases) {
    for (const cs of (c.sessions || [])) {
      sessionMap[cs.sessionId] = { caseId: c.id, caseName: c.name, operatorId: cs.operatorId, occasion: cs.occasion };
    }
  }

  // Collect measurements with case/operator/occasion metadata
  const mRows = [];
  for (const s of sessions) {
    if (!s) continue;
    const mapping = sessionMap[s.id];
    if (!mapping) continue;
    const markups = s.markups || [];
    const cal = s.calibration?.done ? s.calibration : calibration || { done: false, pxPerMm: 1 };
    for (const m of markups) {
      if (!m.label) continue;
      if (labelIds.length > 0 && !labelIds.includes(m.label)) continue;
      if (m.type === "ruler" || m.type === "silhouette") continue;
      if (!m.visible || !m.placed) continue;
      try {
        const vals = computeMeasurements(m, cal);
        for (const [key, raw] of Object.entries(vals)) {
          if (typeof raw !== "number" || !isFinite(raw)) continue;
          mRows.push({
            caseId: mapping.caseId,
            caseName: mapping.caseName,
            operatorId: mapping.operatorId,
            occasion: mapping.occasion,
            sessionId: s.id,
            label: m.label,
            measureKey: key,
            value: raw,
            unit: key.includes("angle") || key.includes("deg") ? "°" : "mm",
          });
        }
      } catch (e) { logError("reliability/markup", e); }
    }
  }

  if (mRows.length === 0) {
    return { measurements: 0, sessions: sessions.length, labels: 0, details: [], note: "No measurements collected from mapped sessions." };
  }

  // Group by label
  const byLabel = {};
  for (const r of mRows) {
    if (!byLabel[r.label]) byLabel[r.label] = [];
    byLabel[r.label].push(r);
  }

  const details = [];
  const labelList = Object.keys(byLabel).sort();

  for (const label of labelList) {
    const samples = byLabel[label];

    // ICC data — intra-operator uses occasion as rater
    const iccData = samples.map(s => ({
      subject: s.caseId,
      rater: config.design === "intra" ? `occ${s.occasion}` : s.operatorId,
      value: s.value,
    }));
    const uniqueSubjects = [...new Set(iccData.map(d => d.subject))];
    const uniqueRaters = [...new Set(iccData.map(d => d.rater))];
    const k = uniqueRaters.length;

    if (uniqueSubjects.length < 2 || k < 2) {
      details.push({ label, n: samples.length, skip: true, reason: `Need ≥2 cases and ≥2 raters/occasions (have ${uniqueSubjects.length} cases, ${k} raters)` });
      continue;
    }

    const iccType = config.iccModel || "icc2";
    const iccResult = iccShroutFleiss(iccData, k, iccType);
    const baResult = runBlandAltman(samples);
    const dsResult = runDahlbergSEM(samples);

    details.push({
      label,
      n: samples.length,
      icc: iccResult?.icc ?? null,
      ci95: iccResult?.ci95 || [null, null],
      F: iccResult?.F || null,
      df1: iccResult?.df1 || null,
      df2: iccResult?.df2 || null,
      pValue: iccResult?.pValue || null,
      nSubjects: uniqueSubjects.length,
      nRaters: k,
      ...baResult,
      ...dsResult,
    });
  }

  // Landmark error map (now calibrated to mm)
  const coords = collectLandmarkCoords(sessions, labelIds, calibration);
  const landmarkMap = runLandmarkErrorMap(coords);

  // Minimum-sample-size warnings
  const warnings = [];
  const nCases = cases?.length || 0;
  const nRaters = [...new Set(mRows.map(r => config.design === "intra" ? `occ${r.occasion}` : r.operatorId))].length;
  if (nCases < 10) warnings.push(`Only ${nCases} cases — ICC estimates with < 10 subjects have wide confidence intervals and should be interpreted as preliminary.`);
  if (nRaters < 2) warnings.push("Need ≥ 2 raters/occasions for reliability analysis.");
  if (nCases >= 2 && nCases < 30) warnings.push(`ICC CI with ${nCases} subjects is wide — consider ≥ 30 subjects for a precise ICC estimate (Walter et al. 1998).`);

  // Enforce minimum time separation between occasions (was configured but never checked).
  const timeSep = checkReliabilityTimeSeparation(sessions, cases, config.minTimeSeparation);
  if (timeSep.checked) {
    for (const v of timeSep.violations) {
      warnings.push(`Time-separation violation: case "${v.caseName}" occasions ${v.from}→${v.to} are ${v.gapDays} days apart (minimum required: ${v.minDays}). Reliability estimates may be inflated by memory effect — increase the interval or exclude this case.`);
    }
  }

  return {
    measurements: mRows.length,
    sessions: sessions.length,
    labels: labelList.length,
    details,
    summary: {
      design: config.design || "intra",
      operators: operators?.length || 0,
      cases: cases?.length || 0,
      occasions: protocol?.occasions || 2,
    },
    landmarkMap,
    warnings,
    timeSeparation: timeSep,
  };
}
