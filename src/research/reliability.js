// ICC formulas based on Shrout & Fleiss (1979) and McGraw & Wong (1996)
function iccShroutFleiss(data, k, type) {
  // data: array of { subject, rater, value }
  // k: number of raters/measurements per subject
  // type: "icc1" (1-way random, single), "icc2" (2-way random, single), "icc3" (2-way fixed, single)
  //       "icc1k", "icc2k", "icc3k" (average measures)
  const subjects = [...new Set(data.map(d => d.subject))];
  const n = subjects.length;
  if (n < 2) return null;
  const kActual = type.includes("k") ? k : 1;

  // Build subject means and grand mean
  const subjectMeans = subjects.map(sub => {
    const vals = data.filter(d => d.subject === sub).map(d => d.value);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });
  const grandMean = subjectMeans.reduce((a, b) => a + b, 0) / n;

  // Sums of squares
  let ssSubjects = 0, ssWithin = 0;
  for (const sub of subjects) {
    const subMean = data.filter(d => d.subject === sub).reduce((a, d, _, arr) => a + d.value / arr.length, 0);
    ssSubjects += n * (subMean - grandMean) ** 2;
    const subVals = data.filter(d => d.subject === sub);
    for (const d of subVals) {
      ssWithin += (d.value - subMean) ** 2;
    }
  }

  // Mean squares
  const msSubjects = ssSubjects / (n - 1);
  const msWithin = ssWithin / (n * (k - 1));
  const msError = type.startsWith("icc1") ? msWithin : ssWithin / ((n - 1) * (k - 1));

  let icc;
  if (type === "icc1" || type === "icc1k") {
    icc = (msSubjects - msWithin) / (msSubjects + (kActual - 1) * msWithin);
  } else if (type === "icc2" || type === "icc2k") {
    const msRater = data.length > 0 ? 0 : 0;
    icc = (msSubjects - msError) / (msSubjects + (kActual - 1) * msError + kActual * msRater / n);
  } else {
    icc = (msSubjects - msError) / (msSubjects + (kActual - 1) * msError);
  }
  return Math.max(-1, Math.min(1, icc));
}

export function runReliability(config, rows) {
  const { method, iccType, label } = config;
  const result = { label, method, iccType, icc: null, bias: null, loa: null, sem: null, cv: null, sdd: null, meanDiff: null, sdDiff: null, dahlberg: null };

  // Collect values grouped by session (subject) and rater
  if (method === "icc" || method === "all") {
    const icc = runICC(config, rows);
    Object.assign(result, icc);
  }
  if (method === "ba" || method === "all") {
    const ba = runBlandAltman(config, rows);
    Object.assign(result, ba);
  }
  if (method === "sem" || method === "all") {
    const sem = runSEM(config, rows);
    Object.assign(result, sem);
  }
  return result;
}

export function runReliabilityAll(measurements, sessions, config) {
  const { labelIds, method, iccType } = config;
  const labels = labelIds.length > 0 ? labelIds : [...new Set(measurements.map(r => r.label))];
  const results = [];
  for (const label of labels) {
    const labelRows = measurements.filter(r => r.label === label);
    if (labelRows.length < 4) continue;
    const r = runReliability({ label, method: method || "all", iccType: iccType || "icc2" }, labelRows);
    if (r.icc !== null || r.meanDiff !== null) results.push(r);
  }
  return results;
}

function runICC(config, rows) {
  const iccType = config.iccType || "icc2";
  const trialMap = {};
  for (const r of rows) {
    const key = r.sessionId;
    if (!trialMap[key]) trialMap[key] = [];
    trialMap[key].push(r.value);
  }
  const subjectIds = Object.keys(trialMap);
  const k = Math.max(...Object.values(trialMap).map(v => v.length));
  if (subjectIds.length < 2 || k < 2) return {};

  // Reformat as { subject, rater, value }
  const data = [];
  for (const sid of subjectIds) {
    const vals = trialMap[sid];
    for (let i = 0; i < vals.length; i++) {
      data.push({ subject: sid, rater: i, value: vals[i] });
    }
  }

  const icc = iccShroutFleiss(data, k, iccType);
  return { iccType, icc, k };
}

function runBlandAltman(config, rows) {
  const trialMap = {};
  for (const r of rows) {
    if (!trialMap[r.sessionId]) trialMap[r.sessionId] = [];
    trialMap[r.sessionId].push(r.value);
  }
  const diffs = [];
  for (const sid of Object.keys(trialMap)) {
    const vals = trialMap[sid];
    if (vals.length >= 2) {
      diffs.push(vals[1] - vals[0]);
    }
  }
  if (diffs.length < 2) return {};
  const n = diffs.length;
  const meanDiff = diffs.reduce((a, b) => a + b, 0) / n;
  const sdDiff = Math.sqrt(diffs.reduce((s, d) => s + (d - meanDiff) ** 2, 0) / (n - 1));
  return {
    meanDiff,
    sdDiff,
    loaUpper: meanDiff + 1.96 * sdDiff,
    loaLower: meanDiff - 1.96 * sdDiff,
    bias: meanDiff,
    diffs,
  };
}

function runSEM(config, rows) {
  const trialMap = {};
  for (const r of rows) {
    if (!trialMap[r.sessionId]) trialMap[r.sessionId] = [];
    trialMap[r.sessionId].push(r.value);
  }

  // Dahlberg: sqrt(sum(d^2) / (2*n))
  let sumSqDiff = 0, count = 0;
  const means = [];
  for (const sid of Object.keys(trialMap)) {
    const vals = trialMap[sid];
    if (vals.length >= 2) {
      const d = vals[1] - vals[0];
      sumSqDiff += d * d;
      count++;
    }
    means.push(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  if (count < 2) return {};

  const dahlberg = Math.sqrt(sumSqDiff / (2 * count));
  const grandMean = means.reduce((a, b) => a + b, 0) / means.length;
  const cv = grandMean !== 0 ? (dahlberg / grandMean) * 100 : 0;
  const sem = dahlberg;
  const sdd = 1.96 * Math.sqrt(2) * sem;

  return { dahlberg, sem, cv, sdd };
}
