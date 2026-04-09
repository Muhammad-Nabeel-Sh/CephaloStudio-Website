// ═══════════════════════════════════════════════════════════════════════════════
// UTILS - Geometry, Measurements, Snap, Alignment, Statistics
// ═══════════════════════════════════════════════════════════════════════════════

import * as math from "mathjs";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const dist = (a, b) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

export const angle3pt = (p1, vtx, p2) => {
  const u = { x: p1.x - vtx.x, y: p1.y - vtx.y }, w = { x: p2.x - vtx.x, y: p2.y - vtx.y };
  const cross = u.x * w.y - u.y * w.x;
  return Math.atan2(cross, u.x * w.x + u.y * w.y) * 180 / Math.PI;
};

export const angle4pt = (p1, p2, p3, p4) => {
  const d1 = { x: p2.x - p1.x, y: p2.y - p1.y }, d2 = { x: p4.x - p3.x, y: p4.y - p3.y };
  const cross = d1.x * d2.y - d1.y * d2.x;
  return Math.atan2(cross, d1.x * d2.x + d1.y * d2.y) * 180 / Math.PI;
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
  if ((m.type === "line" || m.type === "parallel") && vp.length >= 2 && m.mode !== "infinite") meas.length = dist(vp[0], vp[1]) / ppm;
  if (m.type === "angle3" && vp.length >= 3) meas.angle = angle3pt(vp[0], vp[1], vp[2]);
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
    for (const p of m.points) { if (p.x < -9000) continue; const d = dist(p, ip); if (d < bestD) { bestD = d; best = p; } }
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

export function evalFormula(expr, scope) {
  try { const r = math.evaluate(expr, { ...scope }); return typeof r === "number" ? r : null; } catch { return null; }
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

export const variance = (arr, m) => arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;

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
  const SSB = k * mean(rowMeans.map((rm) => (rm - grandMean) ** 2));
  const SSC = n * mean(colMeans.map((cm) => (cm - grandMean) ** 2));
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