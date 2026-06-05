// ═══════════════════════════════════════════════════════════════════════════════
// UTILS - Geometry, Measurements, Snap, Alignment, Statistics
// ═══════════════════════════════════════════════════════════════════════════════

import { create, all } from "mathjs";

const math = create(all, { number: "number", precision: 14 });
math.import({
  import: () => { throw new Error("Not allowed"); },
  createUnit: () => { throw new Error("Not allowed"); },
  evaluate: () => { throw new Error("Not allowed"); },
  simplify: () => { throw new Error("Not allowed"); }
}, { override: true });

export const uid = () => Math.random().toString(36).slice(2, 10);

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const dist = (a, b) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

export const angle3pt = (p1, vtx, p2) => {
  const u = { x: p1.x - vtx.x, y: p1.y - vtx.y }, w = { x: p2.x - vtx.x, y: p2.y - vtx.y };
  const cross = u.x * w.y - u.y * w.x;
  return Math.abs(Math.atan2(cross, u.x * w.x + u.y * w.y) * 180 / Math.PI);
};

export const angle4pt = (p1, p2, p3, p4) => {
  const d1 = { x: p2.x - p1.x, y: p2.y - p1.y }, d2 = { x: p4.x - p3.x, y: p4.y - p3.y };
  const cross = d1.x * d2.y - d1.y * d2.x;
  return Math.abs(Math.atan2(cross, d1.x * d2.x + d1.y * d2.y) * 180 / Math.PI);
};

export const perpDist = (pt, a, b) => {
  const num = Math.abs((b.y - a.y) * pt.x - (b.x - a.x) * pt.y + b.x * a.y - b.y * a.x);
  const den = dist(a, b);
  return den < 1e-9 ? 0 : num / den;
};

export const polyArea = pts => {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++)
    a += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
  return Math.abs(a / 2);
};

export const polyLen = (pts, closed = true) => {
  let p = 0;
  for (let i = 1; i < pts.length; i++) p += dist(pts[i - 1], pts[i]);
  if (closed && pts.length > 2) p += dist(pts[pts.length - 1], pts[0]);
  return p;
};

export const vpts = m => (m.points || []).filter(p => p.x > -9000);

export function sampleSpline(pts, closed = false, samplesPer = 24) {
  if (pts.length < 2) return pts;
  const ext = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  const out = [];
  const N = closed ? pts.length : pts.length - 1;
  for (let i = 1; i <= N; i++) {
    const p0 = ext[i - 1], p1 = ext[i], p2 = ext[i + 1] || ext[ext.length - 1], p3 = ext[i + 2] || ext[ext.length - 1];
    for (let j = 0; j < samplesPer; j++) {
      const t = j / samplesPer, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  if (!closed) out.push(pts[pts.length - 1]);
  return out;
}

export const splineArea = (pts) => polyArea(sampleSpline(pts, true));

export const splineLen = (pts, closed = false) => polyLen(sampleSpline(pts, closed), false);

export const getInfiniteLinePoints = (p1, p2, w, h) => {
  const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-9) return [p1, p1];
  const nx = dx / len, ny = dy / len, dist = Math.max(w, h) * 4;
  return [{ x: p1.x - nx * dist, y: p1.y - ny * dist }, { x: p1.x + nx * dist, y: p1.y + ny * dist }];
};

export function computeMeasurements(m, cal) {
  const ppm = cal?.pxPerMm || 1, meas = {}, vp = vpts(m);
  if (vp.length > 0) { meas.x = vp[0].x; meas.y = vp[0].y; }
  if ((m.type === "line" || m.type === "parallel") && vp.length >= 2 && m.mode !== "infinite") meas.length = dist(vp[0], vp[1]) / ppm;
  if (m.type === "angle3" && vp.length >= 3) {
    if (m.label === "ANB") {
      const u = { x: vp[0].x - vp[1].x, y: vp[0].y - vp[1].y };
      const w = { x: vp[2].x - vp[1].x, y: vp[2].y - vp[1].y };
      meas.angle = Math.atan2(u.x * w.y - u.y * w.x, u.x * w.x + u.y * w.y) * 180 / Math.PI;
    } else {
      meas.angle = angle3pt(vp[0], vp[1], vp[2]);
    }
  }
  if (m.type === "angle4" && vp.length >= 4) meas.angle = angle4pt(vp[0], vp[1], vp[2], vp[3]);
  if (m.type === "polygon" && vp.length >= 3) {
    const useSpline = m.curveStyle === "bspline" && vp.length >= 3;
    meas.area = (useSpline ? splineArea(vp) : polyArea(vp)) / ppm ** 2;
    meas.perimeter = (useSpline ? splineLen(vp, true) : polyLen(vp, true)) / ppm;
  }
  if (m.type === "curve" && vp.length >= 2) {
    const useSpline = m.curveStyle === "bspline" && vp.length >= 3;
    meas.length = (useSpline ? splineLen(vp, false) : polyLen(vp, false)) / ppm;
  }
  if (m.type === "perp" && vp.length >= 3) { meas.distance = perpDist(vp[2], vp[0], vp[1]) / ppm; meas.lineLength = dist(vp[0], vp[1]) / ppm; }
  if (m.type === "ratio" && m.computedValue !== undefined) { meas.value = m.computedValue; }
  if (m.type === "sum" && m.computedValue !== undefined) { meas.value = m.computedValue; }
  if (m.type === "difference" && m.computedValue !== undefined) { meas.value = m.computedValue; }
  if (m.type === "percentage" && m.computedValue !== undefined) { meas.value = m.computedValue; }
  if (m.type === "projDist" && vp.length >= 4) { meas.projectedDistance = projectedDistance(vp[0], vp[1], vp[2], vp[3]) / ppm; }
  return meas;
}

export const catmullRom = (ctx, pts, closed = false) => {
  if (pts.length < 2) return;
  const ext = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  ctx.moveTo(pts[0].x, pts[0].y);
  const N = closed ? pts.length : pts.length - 1;
  for (let i = 1; i <= N; i++) {
    const p0 = ext[i - 1], p1 = ext[i], p2 = ext[i + 1] || ext[ext.length - 1], p3 = ext[i + 2] || ext[ext.length - 1];
    for (let j = 1; j <= 24; j++) {
      const t = j / 24, t2 = t * t, t3 = t2 * t;
      ctx.lineTo(0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3));
    }
  }
  if (closed) ctx.closePath();
};

export const projectedDistance = (ptA, ptB, lineP1, lineP2) => {
  const dx = lineP2.x - lineP1.x, dy = lineP2.y - lineP1.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return 0;
  const tA = ((ptA.x - lineP1.x) * dx + (ptA.y - lineP1.y) * dy) / len2;
  const tB = ((ptB.x - lineP1.x) * dx + (ptB.y - lineP1.y) * dy) / len2;
  return (tA - tB) * Math.sqrt(len2);
};

export const perpPoint = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return a;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  return { x: a.x + t * dx, y: a.y + t * dy };
};

export const snapPoint = (ip, markups, r, enabled) => {
  if (!enabled) return ip;
  let best = ip, bestD = r;
  for (const m of markups) {
    if (m.visible === false) continue;
    for (const p of (m.points || [])) {
      if (p.x < -9000) continue;
      const d = dist(p, ip);
      if (d < bestD) { bestD = d; best = p; }
    }
  }
  return { ...best };
};

export const snapToLine = (ip, markups, r) => {
  let bestPt = ip, bestD = r;
  for (const m of markups) {
    if (m.visible === false) continue;
    if (m.type === "line" || m.type === "parallel") {
      const vp = m.points.filter(p => p.x > -9000);
      if (vp.length >= 2) {
        const pr = perpPoint(ip, vp[0], vp[1]);
        const d = dist(pr, ip);
        if (d < bestD) { bestD = d; bestPt = pr; }
      }
    }
  }
  return { ...bestPt };
};

export const alignOnePoint = (src, dst) => ({ tx: dst.x - src.x, ty: dst.y - src.y, rot: 0, scale: 1 });

export const alignTwoPoints = (s1, s2, d1, d2) => {
  const srcA = Math.atan2(s2.y - s1.y, s2.x - s1.x), dstA = Math.atan2(d2.y - d1.y, d2.x - d1.x);
  const rot = dstA - srcA, srcLen = dist(s1, s2), dstLen = dist(d1, d2), scale = srcLen > 1e-9 ? dstLen / srcLen : 1;
  const cos = Math.cos(rot) * scale, sin = Math.sin(rot) * scale;
  return { tx: d1.x - (cos * s1.x - sin * s1.y), ty: d1.y - (sin * s1.x + cos * s1.y), rot, scale };
};

export function buildScope(markups, calibration) {
  const scope = {};
  markups.forEach(m => {
    const meas = computeMeasurements(m, calibration);
    const lbl = (m.label || m.type).replace(/[^a-zA-Z0-9]/g, "_");
    Object.entries(meas).forEach(([k, v]) => { scope[lbl] = v; scope[`${lbl}_${k}`] = v; });
  });
  return scope;
}

const _builtins = new Set(["sin","cos","tan","asin","acos","atan","atan2","abs","sqrt","exp","log","log2","log10","ceil","floor","round","min","max","pow","pi","e","i","true","false","Infinity","NaN"]);

export function evalFormula(expr, scope) {
  try {
    let s = expr; const keys = Object.keys(scope).sort((a,b)=>b.length-a.length);
    const used = new Set();
    for (const k of keys) {
      const v = scope[k];
      if (typeof v === "number" && isFinite(v)) {
        const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`, "g");
        if (re.test(s)) { re.lastIndex = 0; s = s.replace(re, `(${v})`); used.add(k); }
      }
    }
    const tokens = (expr.match(/\b[a-zA-Z_]\w*\b/g)||[]).filter(w=>!/^\d+$/.test(w)&&!_builtins.has(w));
    const missing = tokens.filter(w=>!used.has(w));
    if (missing.length > 0) return null;
    const c = math.compile(s), r = c.evaluate({});
    return typeof r === "number" && isFinite(r) ? r : null;
  } catch { return null; }
}

export function getMissingVars(expr, scope) {
  if (!expr) return [];
  const keys = Object.keys(scope).sort((a,b)=>b.length-a.length);
  const used = new Set();
  let s = expr;
  for (const k of keys) {
    const v = scope[k];
    if (typeof v === "number" && isFinite(v)) {
      const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`, "g");
      if (re.test(s)) { re.lastIndex = 0; s = s.replace(re, ""); used.add(k); }
    }
  }
  const tokens = (expr.match(/\b[a-zA-Z_]\w*\b/g)||[]).filter(w=>!/^\d+$/.test(w)&&!_builtins.has(w));
  return [...new Set(tokens.filter(w=>!used.has(w)))];
}

export function normDeviation(value, norm) {
  const delta = value - norm.mean, sdUnits = norm.sd > 0 ? delta / norm.sd : 0;
  return { delta, sdUnits, within1SD: Math.abs(sdUnits) <= 1, within2SD: Math.abs(sdUnits) <= 2 };
}

export const deviationColor = (sdUnits, t) => {
  const a = Math.abs(sdUnits);
  if (a <= 1) return t.ok;
  if (a <= 2) return t.warn;
  return t.err;
};

export const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

export const variance = (arr, m) => arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);

export const stdev = (arr, m) => Math.sqrt(variance(arr, m));

export const gammaLn = x => {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - gammaLn(1 - x);
  x -= 1;
  let a = c[0];
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  const t = x + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
};

export const betaIncomplete = (a, b, x) => {
  if (x < 0 || x > 1) return 0;
  if (x === 0 || x === 1) return x;
  const bt = Math.exp(gammaLn(a + b) - gammaLn(a) - gammaLn(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return bt * betaCF(a, b, x) / a;
  return 1 - bt * betaCF(b, a, 1 - x) / b;
};

export const betaCF = (a, b, x) => {
  const maxIter = 100, eps = 3e-14;
  let m, m2, aa, c, d, del, h;
  const qab = a + b, qap = a + 1, qam = a - 1;
  c = 1;
  d = 1;
  h = 1 - qab * x / (a + 1);
  for (m = 1; m <= maxIter; m++) {
    m2 = 2 * m;
    aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    c = 1 + aa / c;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    del = d * h;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
};

export const tDistributeCDF = (t, df) => {
  const x = df / (df + t * t);
  return 1 - 0.5 * betaIncomplete(df / 2, 0.5, x);
};

export function tTestPaired(arr1, arr2) {
  if (arr1.length !== arr2.length || arr1.length < 2) return null;
  const n = arr1.length;
  const diffs = arr1.map((v, i) => v - arr2[i]);
  const m = mean(diffs);
  const s = stdev(diffs, m);
  if (s === 0) return null;
  const tStat = m / (s / Math.sqrt(n));
  const df = n - 1;
  const pValue = 2 * (1 - tDistributeCDF(Math.abs(tStat), df));
  return { t: tStat, df, pValue, significant: pValue < 0.05 };
}

export function calculateICC(values) {
  const k = values.length;
  if (k < 2) return null;
  const n = values[0].length;
  if (n < 2) return null;
  const grandMean = mean(values.flat());
  const rowMeans = values.map(row => mean(row));
  const colMeans = Array(n).fill(0).map((_, j) => mean(values.map(row => row[j])));
  const SSB = n * rowMeans.reduce((sum, rm) => sum + (rm - grandMean) ** 2, 0);
  const SSC = k * colMeans.reduce((sum, cm) => sum + (cm - grandMean) ** 2, 0);
  const SST = values.flat().reduce((s, x) => s + (x - grandMean) ** 2, 0);
  const SSW = SST - SSB - SSC;
  const MSB = SSB / (k - 1);
  const MSC = SSC / (n - 1);
  const MSW = SSW / ((k - 1) * (n - 1));
  if (MSW === 0) return null;
  const rA = (MSB - MSW) / (MSB + (n - 1) * MSW);
  const rC = (MSC - MSW) / (MSC + (k - 1) * MSW);
  const rK = (MSB - MSW) / MSB;
  const rM = (MSC - MSW) / MSC;
  return { ICC_Absolute: rA, ICC_Consistency: rC, ICC_Average: rK, ICC_Consistency_Avg: rM, interpretation: getICCInterpretation(rA || rC) };
}

export const getICCInterpretation = icc => {
  if (icc < 0) return "Poor";
  if (icc < 0.5) return "Poor";
  if (icc < 0.75) return "Moderate";
  if (icc < 0.9) return "Good";
  return "Excellent";
};

export function calculateICC_CI(icc, n, k, confidence = 0.95) {
  if (icc == null || n < 2 || k < 2) return null;
  const r = Math.max(-0.999, Math.min(0.999, icc));
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(k * (n - 1) - 1);
  const zCrit = confidence === 0.99 ? 2.576 : confidence === 0.90 ? 1.645 : 1.96;
  const lo = z - zCrit * se;
  const hi = z + zCrit * se;
  const lower = (Math.exp(2 * lo) - 1) / (Math.exp(2 * lo) + 1);
  const upper = (Math.exp(2 * hi) - 1) / (Math.exp(2 * hi) + 1);
  return { lower, upper, confidence };
}

export function dahlbergError(arr1, arr2) {
  if (arr1.length !== arr2.length) return null;
  const n = arr1.length;
  if (n < 2) return null;
  const sumSq = arr1.reduce((s, v, i) => s + (v - arr2[i]) ** 2, 0);
  return { error: Math.sqrt(sumSq / (2 * n)), n };
}

export function blandAltman(arr1, arr2) {
  if (arr1.length !== arr2.length || arr1.length < 2) return null;
  const diffs = arr1.map((v, i) => v - arr2[i]);
  const means = arr1.map((v, i) => (v + arr2[i]) / 2);
  const m = mean(diffs);
  const s = stdev(diffs, m);
  const loa = m - 1.96 * s;
  const loa2 = m + 1.96 * s;
  return { meanDiff: m, stdDiff: s, lowerLOA: loa, upperLOA: loa2, means, minMean: Math.min(...means), maxMean: Math.max(...means) };
}

export const median = arr => {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const iqr = arr => {
  const sorted = [...arr].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  return { q1, q3, iqr: q3 - q1 };
};

export const skewness = arr => {
  const n = arr.length, m = mean(arr), s = stdev(arr, m);
  if (s === 0) return 0;
  return (n / ((n - 1) * (n - 2))) * arr.reduce((sum, x) => sum + ((x - m) / s) ** 3, 0);
};

export const kurtosis = arr => {
  const n = arr.length, m = mean(arr), s = stdev(arr, m);
  if (s === 0) return 0;
  const m4 = arr.reduce((sum, x) => sum + (x - m) ** 4, 0) / n;
  return (m4 / s ** 4) - 3;
};

export const coefficientOfVariation = arr => {
  const m = mean(arr);
  if (m === 0) return null;
  return (stdev(arr, m) / Math.abs(m)) * 100;
};

export const standardError = (arr, icc) => {
  const s = stdev(arr, mean(arr));
  if (icc == null || icc < 0 || icc > 1) return s / Math.sqrt(arr.length);
  return s * Math.sqrt(1 - icc);
};

export const minimalDetectableChange = (sem, confidence = 1.96) => confidence * sem * Math.sqrt(2);

export function shapiroWilk(arr) {
  const n = arr.length;
  if (n < 3 || n > 5000) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const m = mean(sorted);
  const ss = sorted.reduce((s, x) => s + (x - m) ** 2, 0);
  if (ss === 0) return { W: 1, pValue: 1, normal: true };
  const coeffs = shapiroCoefficients(n);
  if (!coeffs) return null;
  let b = 0;
  for (let i = 0; i < Math.floor(n / 2); i++) {
    b += coeffs[i] * (sorted[n - 1 - i] - sorted[i]);
  }
  const W = (b ** 2) / ss;
  const pValue = shapiroPValue(W, n);
  return { W, pValue, normal: pValue > 0.05 };
}

function shapiroCoefficients(n) {
  if (n < 3) return null;
  const m = Array.from({ length: n }, (_, i) => normalQuantile((i + 1 - 0.375) / (n + 0.25)));
  const ss = m.reduce((s, x) => s + x * x, 0);
  const a = m.map(x => x / Math.sqrt(ss));
  return a.slice(0, Math.floor(n / 2));
}

function normalQuantile(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pLow = 0.02425;
  const q = p < pLow ? p : 1 - p;
  let x;
  if (q < pLow) {
    const r = Math.sqrt(-2 * Math.log(q));
    x = (((((c[0]*r+c[1])*r+c[2])*r+c[3])*r+c[4])*r+c[5]) / ((((d[0]*r+d[1])*r+d[2])*r+d[3])*r+1);
  } else {
    const r = p - 0.5;
    const r2 = r * r;
    x = (((((a[0]*r2+a[1])*r2+a[2])*r2+a[3])*r2+a[4])*r2+a[5])*r / (((((b[0]*r2+b[1])*r2+b[2])*r2+b[3])*r2+b[4])*r2+1);
  }
  return p < 0.5 ? -x : x;
}

function shapiroPValue(W, n) {
  if (W >= 1) return 1;
  if (W <= 0) return 0;
  if (n <= 3) return W > 0.5 ? 0.5 : 0.1;
  const mu = -1.2725 + 1.0521 * Math.log(n);
  const sigma = 1.0308 - 0.26758 / Math.sqrt(n);
  const z = (Math.log(1 - W) - mu) / sigma;
  return 1 - normalCDF(z);
}

function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t) * Math.exp(-x*x);
  return 0.5 * (1 + sign * y);
}

export function oneWayAnova(...groups) {
  if (groups.length < 2) return null;
  const all = groups.flat();
  const N = all.length, k = groups.length;
  const grandMean = mean(all);
  const ssBetween = groups.reduce((ss, g) => ss + g.length * (mean(g) - grandMean) ** 2, 0);
  const ssWithin = groups.reduce((ss, g) => {
    const m = mean(g);
    return ss + g.reduce((s, x) => s + (x - m) ** 2, 0);
  }, 0);
  const dfBetween = k - 1, dfWithin = N - k;
  if (dfWithin <= 0 || ssWithin === 0) return null;
  const msBetween = ssBetween / dfBetween, msWithin = ssWithin / dfWithin;
  const F = msBetween / msWithin;
  const pValue = 1 - fCDF(F, dfBetween, dfWithin);
  return { F, dfBetween, dfWithin, msBetween, msWithin, ssBetween, ssWithin, pValue, significant: pValue < 0.05 };
}

function fCDF(f, d1, d2) {
  if (f <= 0) return 0;
  const x = d2 / (d2 + d1 * f);
  return 1 - betaIncomplete(d1 / 2, d2 / 2, x);
}

export function spearmanCorrelation(arr1, arr2) {
  if (arr1.length !== arr2.length || arr1.length < 2) return null;
  const rank1 = rankArray(arr1), rank2 = rankArray(arr2);
  return pearsonCorrelation(rank1, rank2);
}

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

export function pearsonCorrelation(arr1, arr2) {
  if (arr1.length !== arr2.length || arr1.length < 2) return null;
  const n = arr1.length, m1 = mean(arr1), m2 = mean(arr2);
  let num = 0, d1 = 0, d2 = 0;
  for (let i = 0; i < n; i++) {
    const a = arr1[i] - m1, b = arr2[i] - m2;
    num += a * b; d1 += a * a; d2 += b * b;
  }
  const den = Math.sqrt(d1 * d2);
  return den === 0 ? null : num / den;
}

export function correlationMatrix(datasets) {
  const n = datasets.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(null));
  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const r = pearsonCorrelation(datasets[i], datasets[j]);
      matrix[i][j] = r; matrix[j][i] = r;
    }
  }
  return matrix;
}

export function aggregateDahlberg(pairedArrays) {
  if (pairedArrays.length < 1) return null;
  const errors = pairedArrays.map(({ vals1, vals2 }) => {
    if (!vals1 || !vals2 || vals1.length < 2) return null;
    const d = dahlbergError(vals1, vals2);
    return d ? d.error : null;
  }).filter(e => e !== null);
  if (!errors.length) return null;
  return { mean: mean(errors), max: Math.max(...errors), min: Math.min(...errors), count: errors.length };
}

export function computePerLandmarkError(study, metric, labels) {
  if (!study || !labels?.length) return [];
  const results = [];
  if (study.type === "intra" && study.operators[0]?.trials?.length >= 2) {
    const trials = study.operators[0].trials;
    for (let i = 0; i < trials.length - 1; i++) {
      for (let j = i + 1; j < trials.length; j++) {
        labels.forEach(lab => {
          const m1 = (trials[i].measurements || []).find(x => x.label === lab);
          const m2 = (trials[j].measurements || []).find(x => x.label === lab);
          if (m1 && m2) {
            const v1 = metric === "x" ? m1.x : m1.y;
            const v2 = metric === "x" ? m2.x : m2.y;
            results.push({ lab, pair: `T${i + 1} vs T${j + 1}`, diff: v1 - v2, absDiff: Math.abs(v1 - v2) });
          }
        });
      }
    }
  } else if (study.type === "inter" && study.operators.length >= 2) {
    for (let i = 0; i < study.operators.length - 1; i++) {
      for (let j = i + 1; j < study.operators.length; j++) {
        labels.forEach(lab => {
          const m1 = (study.operators[i].trials?.[0]?.measurements || []).find(x => x.label === lab);
          const m2 = (study.operators[j].trials?.[0]?.measurements || []).find(x => x.label === lab);
          if (m1 && m2) {
            const v1 = metric === "x" ? m1.x : m1.y;
            const v2 = metric === "x" ? m2.x : m2.y;
            results.push({ lab, pair: `${study.operators[i].name || `Op${i+1}`} vs ${study.operators[j].name || `Op${j+1}`}`, diff: v1 - v2, absDiff: Math.abs(v1 - v2) });
          }
        });
      }
    }
  }
  const byLabel = {};
  results.forEach(r => {
    if (!byLabel[r.lab]) byLabel[r.lab] = { diffs: [] };
    byLabel[r.lab].diffs.push(r.diff);
  });
  return Object.entries(byLabel).map(([lab, data]) => {
    const diffs = data.diffs;
    const sumSq = diffs.reduce((s, d) => s + d ** 2, 0);
    const dahlberg = Math.sqrt(sumSq / (2 * diffs.length));
    const m = mean(diffs);
    const s = stdev(diffs, m);
    const cv = coefficientOfVariation(diffs.map(Math.abs));
    return { lab, n: diffs.length, meanDiff: m, sdDiff: s, dahlberg, cv, absMean: mean(diffs.map(Math.abs)) };
  });
}

export function detectSystematicBias(study, metric, labels) {
  if (!study || !labels?.length) return [];
  const biases = [];
  if (study.type === "intra" && study.operators[0]?.trials?.length >= 2) {
    const trials = study.operators[0].trials;
    for (let i = 0; i < trials.length - 1; i++) {
      for (let j = i + 1; j < trials.length; j++) {
        const vals1 = [], vals2 = [];
        labels.forEach(lab => {
          const m1 = (trials[i].measurements || []).find(x => x.label === lab);
          const m2 = (trials[j].measurements || []).find(x => x.label === lab);
          if (m1 && m2) { vals1.push(metric === "x" ? m1.x : m1.y); vals2.push(metric === "x" ? m2.x : m2.y); }
        });
        if (vals1.length >= 2) {
          const t = tTestPaired(vals1, vals2);
          if (t) biases.push({ pair: `Trial ${i + 1} vs ${j + 1}`, t: t.t, pValue: t.pValue, significant: t.significant, n: vals1.length });
        }
      }
    }
  } else if (study.type === "inter" && study.operators.length >= 2) {
    for (let i = 0; i < study.operators.length - 1; i++) {
      for (let j = i + 1; j < study.operators.length; j++) {
        const vals1 = [], vals2 = [];
        labels.forEach(lab => {
          const m1 = (study.operators[i].trials?.[0]?.measurements || []).find(x => x.label === lab);
          const m2 = (study.operators[j].trials?.[0]?.measurements || []).find(x => x.label === lab);
          if (m1 && m2) { vals1.push(metric === "x" ? m1.x : m1.y); vals2.push(metric === "x" ? m2.x : m2.y); }
        });
        if (vals1.length >= 2) {
          const t = tTestPaired(vals1, vals2);
          if (t) biases.push({ pair: `${study.operators[i].name || `Op${i+1}`} vs ${study.operators[j].name || `Op${j+1}`}`, t: t.t, pValue: t.pValue, significant: t.significant, n: vals1.length });
        }
      }
    }
  }
  return biases;
}

export function anovaAcrossSessions(study, metric, labels) {
  if (!study || !labels?.length) return null;
  const groups = [];
  if (study.type === "intra") {
    const trials = study.operators[0]?.trials || [];
    if (trials.length < 3) return null;
    trials.forEach(tr => {
      const vals = (tr.measurements || []).filter(m => labels.includes(m.label)).map(m => metric === "x" ? m.x : m.y);
      if (vals.length >= 2) groups.push(vals);
    });
  } else {
    if (study.operators.length < 3) return null;
    study.operators.forEach(op => {
      const vals = (op.trials?.[0]?.measurements || []).filter(m => labels.includes(m.label)).map(m => metric === "x" ? m.x : m.y);
      if (vals.length >= 2) groups.push(vals);
    });
  }
  if (groups.length < 3) return null;
  return oneWayAnova(...groups);
}

export function computeNormsComparison(descriptiveStats, norms, calibration) {
  if (!norms?.length || !descriptiveStats?.length) return [];
  const ppm = calibration?.pxPerMm || 1;
  return descriptiveStats.filter(ds => ds.mean !== null).map(ds => {
    const norm = norms.find(n => n.label === ds.lab);
    if (!norm) return { ...ds, normZ: null, normMean: null, normSD: null, withinNorm: null, deviation: null };
    const normMeanMm = norm.mean_mm || norm.mean;
    const normSDMm = norm.sd_mm || norm.sd;
    const statMm = ds.mean / ppm;
    const statSDMm = (ds.sd || 0) / ppm;
    const z = normSDMm > 0 ? (statMm - normMeanMm) / normSDMm : null;
    return { ...ds, statMm, statSDMm, normMean: normMeanMm, normSD: normSDMm, normZ: z, withinNorm: z !== null && Math.abs(z) <= 2, deviation: z !== null ? statMm - normMeanMm : null };
  });
}

export function detectOutliers(arr, method = "iqr") {
  if (arr.length < 4) return { outliers: [], values: arr };
  const indexed = arr.map((v, i) => ({ v, i }));
  if (method === "zscore") {
    const m = mean(arr), s = stdev(arr, m);
    if (s === 0) return { outliers: [], values: arr };
    const outliers = indexed.filter(x => Math.abs(x.v - m) / s > 2).map(x => ({ ...x, zScore: (x.v - m) / s }));
    return { outliers, values: arr, mean: m, sd: s };
  }
  const sorted = [...arr].sort((a, b) => a - b);
  const q1Idx = Math.floor(sorted.length * 0.25), q3Idx = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Idx], q3 = sorted[q3Idx], iqrVal = q3 - q1;
  const lo = q1 - 1.5 * iqrVal, hi = q3 + 1.5 * iqrVal;
  const outliers = indexed.filter(x => x.v < lo || x.v > hi).map(x => ({ ...x }));
  return { outliers, values: arr, q1, q3, iqr: iqrVal, bounds: [lo, hi] };
}

// Helper function to get exact t-values for small samples or Z-scores for larger ones
function getTCriticalValue(confidence, df) {
  // Standard Normal Distribution (Z-scores) for large sample sizes (df > 30)
  const zScores = { 0.90: 1.645, 0.95: 1.960, 0.99: 2.576 };
  
  if (df > 30) {
    return zScores[confidence] || 1.960;
  }

  // Lookup table for exact t-values for degrees of freedom 1 to 30
  const tTable = {
    1: { 0.90: 6.314, 0.95: 12.706, 0.99: 63.657 },
    2: { 0.90: 2.920, 0.95: 4.303, 0.99: 9.925 },
    3: { 0.90: 2.353, 0.95: 3.182, 0.99: 5.841 },
    4: { 0.90: 2.132, 0.95: 2.776, 0.99: 4.604 },
    5: { 0.90: 2.015, 0.95: 2.571, 0.99: 4.032 },
    6: { 0.90: 1.943, 0.95: 2.447, 0.99: 3.707 },
    7: { 0.90: 1.895, 0.95: 2.365, 0.99: 3.499 },
    8: { 0.90: 1.860, 0.95: 2.306, 0.99: 3.355 },
    9: { 0.90: 1.833, 0.95: 2.262, 0.99: 3.250 },
    10: { 0.90: 1.812, 0.95: 2.228, 0.99: 3.169 },
    11: { 0.90: 1.796, 0.95: 2.201, 0.99: 3.106 },
    12: { 0.90: 1.782, 0.95: 2.179, 0.99: 3.055 },
    13: { 0.90: 1.771, 0.95: 2.160, 0.99: 3.012 },
    14: { 0.90: 1.761, 0.95: 2.145, 0.99: 2.977 },
    15: { 0.90: 1.753, 0.95: 2.131, 0.99: 2.947 },
    16: { 0.90: 1.746, 0.95: 2.120, 0.99: 2.921 },
    17: { 0.90: 1.740, 0.95: 2.110, 0.99: 2.898 },
    18: { 0.90: 1.734, 0.95: 2.101, 0.99: 2.878 },
    19: { 0.90: 1.729, 0.95: 2.093, 0.99: 2.861 },
    20: { 0.90: 1.725, 0.95: 2.086, 0.99: 2.845 },
    21: { 0.90: 1.721, 0.95: 2.080, 0.99: 2.831 },
    22: { 0.90: 1.717, 0.95: 2.074, 0.99: 2.819 },
    23: { 0.90: 1.714, 0.95: 2.069, 0.99: 2.807 },
    24: { 0.90: 1.711, 0.95: 2.064, 0.99: 2.797 },
    25: { 0.90: 1.708, 0.95: 2.060, 0.99: 2.787 },
    26: { 0.90: 1.706, 0.95: 2.056, 0.99: 2.779 },
    27: { 0.90: 1.703, 0.95: 2.052, 0.99: 2.771 },
    28: { 0.90: 1.701, 0.95: 2.048, 0.99: 2.763 },
    29: { 0.90: 1.699, 0.95: 2.045, 0.99: 2.756 },
    30: { 0.90: 1.697, 0.95: 2.042, 0.99: 2.750 }
  };

  // Fallback to 0.95 if an unsupported confidence level is passed
  const safeConf = tTable[df][confidence] ? confidence : 0.95;
  return tTable[df][safeConf];
}

export function confidenceInterval(arr, confidence = 0.95) {
  const n = arr.length;
  if (n < 2) return null;
  
  const m = mean(arr);
  const s = stdev(arr, m); 
  
  if (s === 0) return { mean: m, sd: 0, lower: m, upper: m, margin: 0, n, confidence };
  
  const se = s / Math.sqrt(n);
  const df = n - 1; // Degrees of freedom
  
  // Calculate margin using exact t-distribution critical values
  const tCritical = getTCriticalValue(confidence, df);
  const margin = tCritical * se;
  
  return { mean: m, sd: s, se, lower: m - margin, upper: m + margin, margin, n, confidence };
}

export function linearRegression(xVals, yVals) {
  if (xVals.length !== yVals.length || xVals.length < 3) return null;
  const n = xVals.length;
  const mx = mean(xVals), my = mean(yVals);
  let ssxy = 0, ssxx = 0, ssyy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xVals[i] - mx, dy = yVals[i] - my;
    ssxy += dx * dy; ssxx += dx * dx; ssyy += dy * dy;
  }
  if (ssxx === 0 || ssyy === 0) return null;
  const slope = ssxy / ssxx;
  const intercept = my - slope * mx;
  const r2 = (ssxy ** 2) / (ssxx * ssyy);
  const r = Math.sqrt(r2) * (slope >= 0 ? 1 : -1);
  const sse = ssyy - (ssxy ** 2) / ssxx;
  const seSlope = Math.sqrt(sse / (n - 2) / ssxx);
  const seIntercept = seSlope * Math.sqrt((1 / n) * xVals.reduce((s, x) => s + x * x, 0));
  const tSlope = seSlope < 1e-15 ? Infinity : slope / seSlope;
  const tIntercept = seIntercept < 1e-15 ? Infinity : intercept / seIntercept;
  const df = n - 2;
  const pValue = isFinite(tSlope) ? 2 * (1 - tDistributeCDF(Math.abs(tSlope), df)) : 0;
  const seResidual = Math.sqrt(sse / (n - 2));
  return { slope, intercept, r2, r, seSlope, seIntercept, tSlope, tIntercept, pValue, significant: pValue < 0.05, seResidual, n, equation: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}` };
}
