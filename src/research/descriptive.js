import { computeMeasurements } from "../utils.js";

// ─── Statistical helpers ──────────────────────────────────────────────────
function stdNormalCdf(x) {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const a = 0.3193815, b = -0.3565638, c = 1.7814779, d = -1.8212559, e = 1.3302744;
  const phi = 0.39894228 * Math.exp(-x * x / 2);
  let t = 1 / (1 + 0.2316419 * Math.abs(x));
  t = phi * t * (a + t * (b + t * (c + t * (d + t * e))));
  return x > 0 ? 1 - t : t;
}

function tCritical(p, df) {
  if (df <= 0) return 1.96;
  if (df > 1000) return p >= 0.995 ? 2.576 : p >= 0.975 ? 1.96 : p >= 0.95 ? 1.645 : 0;
  const z = p >= 0.995 ? 2.576 : p >= 0.975 ? 1.96 : p >= 0.95 ? 1.645 : 0;
  const a = (z ** 3 + z) / (4 * df);
  const b = (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * df * df);
  return z + a + b;
}

// ─── Descriptive statistics for a single group of values ─────────────────
function descriptiveStats(values) {
  const n = values.length;
  if (n === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  const sem = sd / Math.sqrt(n);

  const percentile = (p) => {
    const idx = (p / 100) * (n - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };

  const skewness = sd > 0
    ? values.reduce((a, v) => a + ((v - mean) / sd) ** 3, 0) * n / ((n - 1) * (n - 2))
    : 0;

  const excessKurtosis = n >= 4 && sd > 0
    ? (values.reduce((a, v) => a + ((v - mean) / sd) ** 4, 0) * n * (n + 1) / ((n - 1) * (n - 2) * (n - 3)))
      - 3 * (n - 1) ** 2 / ((n - 2) * (n - 3))
    : 0;

  const tCrit = tCritical(0.975, n - 1);
  const ciMean = [mean - tCrit * sem, mean + tCrit * sem];

  // Simple normality test using skewness and kurtosis (D'Agostino-Pearson)
  const sk = skewness;
  const ku = excessKurtosis;
  const zSk = n >= 8 ? Math.abs(sk) / Math.sqrt(6 / n) : 0;
  const zKu = n >= 8 ? Math.abs(ku) / Math.sqrt(24 / n) : 0;
  const isNormal = zSk < 2.58 && zKu < 2.58; // 99% confidence

  return {
    n, mean, sd, sem, variance,
    min: sorted[0], max: sorted[n - 1],
    median: percentile(50),
    q1: percentile(25), q3: percentile(75),
    iqr: percentile(75) - percentile(25),
    p5: percentile(5), p95: percentile(95),
    p2_5: percentile(2.5), p97_5: percentile(97.5),
    skewness: sk, kurtosis: ku,
    ciMean,
    isNormal,
  };
}

// ─── Reference interval ──────────────────────────────────────────────────
function referenceInterval(values, coverage = 0.95) {
  const stats = descriptiveStats(values);
  if (!stats || stats.n < 3) return null;

  const z = 1.96; // for 95% coverage
  const n = stats.n;

  // Parametric
  const lower = stats.mean - z * stats.sd;
  const upper = stats.mean + z * stats.sd;

  // CI for limits (Reed method approximation)
  const seLimit = stats.sd * Math.sqrt(1 / n + z * z / (2 * n));
  const tC = tCritical(0.95, n - 1);
  const lowerCi = [lower - tC * seLimit, lower + tC * seLimit];
  const upperCi = [upper - tC * seLimit, upper + tC * seLimit];

  // Non-parametric (order statistics)
  const sorted = [...values].sort((a, b) => a - b);
  const alpha = 1 - coverage;
  const rankLo = Math.max(0, Math.round(n * alpha / 2) - 1);
  const rankHi = Math.min(n - 1, Math.round(n * (1 - alpha / 2)) - 1);

  return {
    coverage,
    method: stats.isNormal ? "parametric" : "non-parametric",
    parametric: { lower, upper, lowerCi, upperCi },
    nonParametric: { lower: sorted[rankLo], upper: sorted[rankHi] },
    recommendedLower: stats.isNormal ? lower : sorted[rankLo],
    recommendedUpper: stats.isNormal ? upper : sorted[rankHi],
  };
}

// ─── Z-score computation ─────────────────────────────────────────────────
function computeZScore(value, norm) {
  if (!norm || norm.sd === 0 || value == null) return null;
  const z = (value - norm.mean) / norm.sd;
  const percentileRank = stdNormalCdf(z) * 100;

  const abs = Math.abs(z);
  let level, clinical;
  if (abs < 1) { level = "Within 1 SD"; clinical = "Normal"; }
  else if (abs < 2) { level = "1–2 SD"; clinical = "Mild"; }
  else if (abs < 3) { level = "2–3 SD"; clinical = "Moderate"; }
  else { level = ">3 SD"; clinical = "Severe"; }

  return { z, percentileRank, level, clinical, direction: z > 0 ? "above" : "below" };
}

// ─── Built-in reference norms ────────────────────────────────────────────
export const PREDEFINED_NORMS = [
  {
    id: "steiner",
    label: "Steiner (Caucasian)",
    values: {
      SNA: { mean: 82, sd: 3 }, SNB: { mean: 80, sd: 3 }, ANB: { mean: 2, sd: 2 },
      "SN-MP": { mean: 32, sd: 4 }, "FMA": { mean: 25, sd: 4 }, "IMPA": { mean: 90, sd: 5 },
    },
  },
  {
    id: "downs",
    label: "Downs (Caucasian)",
    values: {
      "Facial Angle": { mean: 87, sd: 3 },
      "Angle of Convexity": { mean: 0, sd: 5 },
      "AB Plane": { mean: -5, sd: 2 },
      "Mandibular Plane": { mean: 22, sd: 4 },
      "Y-Axis": { mean: 59, sd: 3 },
    },
  },
  {
    id: "mcnamara",
    label: "McNamara",
    values: {
      "Maxillary Depth": { mean: 90, sd: 3 },
      "Facial Depth": { mean: 88, sd: 3 },
      "ANB": { mean: 2, sd: 2 },
    },
  },
];

// ─── Collect measurement values per label from sessions ──────────────────
function collectMeasurements(sessions, labelIds, calibration) {
  const byLabel = {};
  for (const s of sessions) {
    if (!s) continue;
    const cal = s.calibration?.done ? s.calibration : calibration || { done: false, pxPerMm: 1 };
    const markups = s.markups || [];
    for (const m of markups) {
      if (!m.label) continue;
      if (labelIds.length > 0 && !labelIds.includes(m.label)) continue;
      if (m.type === "ruler" || m.type === "silhouette") continue;
      if (!m.visible || !m.placed) continue;
        try {
          const vals = computeMeasurements(m, cal);
          for (const [key, raw] of Object.entries(vals)) {
            if (typeof raw !== "number" || !isFinite(raw)) continue;
            if (!byLabel[m.label]) byLabel[m.label] = [];
            byLabel[m.label].push({ value: raw, key, sessionId: s.id });
          }
          // If no specific measureKey, also push the first numeric value
          if (!Object.keys(vals).some(k => typeof vals[k] === "number")) {
            const first = Object.values(vals).find(v => typeof v === "number" && isFinite(v));
            if (first != null) {
              if (!byLabel[m.label]) byLabel[m.label] = [];
              byLabel[m.label].push({ value: first, key: "value", sessionId: s.id });
            }
          }
        } catch { /* skip */ }
    }
  }
  return byLabel;
}

// ─── Group sessions by demographic variable ──────────────────────────────
function groupSessions(sessions, groupBy) {
  if (groupBy === "none") return { All: sessions };

  const groups = {};
  for (const s of sessions) {
    if (!s) continue;
    let key = "Unknown";
    if (groupBy === "group") key = s.meta?.group || "Ungrouped";
    else if (groupBy === "operator") key = s.meta?.operatorId || "Unknown";
    else if (groupBy === "patient") key = s.meta?.patientId || "Unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  return groups;
}

// ─── Main entry point ────────────────────────────────────────────────────
export function runDescriptiveAll(sessions, config, calibration) {
  const { labelIds, groupBy, referenceNorms } = config;

  const groups = groupSessions(sessions, groupBy || "none");
  const groupNames = Object.keys(groups);

  const results = {
    groups: {},
    groupOrder: groupNames,
    combined: {},
    referenceNorms: referenceNorms || [],
    predefinedNorms: PREDEFINED_NORMS,
  };

  for (const gName of groupNames) {
    const gSessions = groups[gName];
    const byLabel = collectMeasurements(gSessions, labelIds || [], calibration);
    const groupResult = { sessions: gSessions.length, labels: {} };

    for (const [label, samples] of Object.entries(byLabel)) {
      const values = samples.map(s => s.value);
      const stats = descriptiveStats(values);
      const refInterval = referenceInterval(values);
      groupResult.labels[label] = { values: samples, stats, referenceInterval: refInterval };
    }

    results.groups[gName] = groupResult;
  }

  // Combined (all sessions)
  const allByLabel = collectMeasurements(sessions, labelIds || [], calibration);
  for (const [label, samples] of Object.entries(allByLabel)) {
    const values = samples.map(s => s.value);
    const stats = descriptiveStats(values);
    const refInterval = referenceInterval(values);
    results.combined[label] = { values: samples, stats, referenceInterval: refInterval };
  }

  // Compute z-scores against reference norms
  if (referenceNorms && referenceNorms.length > 0) {
    results.zScores = {};
    for (const norm of referenceNorms) {
      results.zScores[norm.id] = {};
      for (const [label, data] of Object.entries(results.combined)) {
        const normVal = norm.values?.[label];
        if (normVal) {
          results.zScores[norm.id][label] = {
            norm: normVal,
            zScore: computeZScore(data.stats?.mean, normVal),
          };
        }
      }
    }
  }

  return results;
}
