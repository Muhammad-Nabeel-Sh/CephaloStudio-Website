// ═══════════════════════════════════════════════════════════════════════════════
// AIRWAY — Cephalometric airway measurement computation engine
// ═══════════════════════════════════════════════════════════════════════════════

import { vpts, dist } from "../utils.js";
import { AIRWAY_NORMS } from "../norms.js";

// ─── Airway measurement definitions ──────────────────────────────────────────

export const AIRWAY_MEASUREMENTS = [
  {
    id: "N-PH",
    label: "N-PH (Nasion to Pharyngeal Wall)",
    type: "length",
    points: ["N", "PH"],
    normMean: 24.3,
    normSD: 3.6,
    normSource: "Solow 1985",
    clinicalNote: "Distance from nasion to posterior pharyngeal wall; reduced in adenoid hypertrophy",
  },
  {
    id: "R-PAS",
    label: "R-PAS (Retropalatal Airway Space)",
    type: "length",
    points: ["SP", "Ad3"],
    normMean: 11.2,
    normSD: 2.4,
    normSource: "McNamara 1984",
    clinicalNote: "Narrowest sagittal dimension at retropalatal level; <5mm suggests severe narrowing",
  },
  {
    id: "R-RG",
    label: "R-RG (Retroglossal Airway Space)",
    type: "length",
    points: ["Eb", "PASbot"],
    normMean: 12.5,
    normSD: 2.8,
    normSource: "McNamara 1984",
    clinicalNote: "Narrowest sagittal dimension at retroglossal level; <5mm associated with OSA",
  },
  {
    id: "PNS-AD1",
    label: "PNS-AD1 (PNS to Adenoid Point 1)",
    type: "length",
    points: ["PNS", "Ad1"],
    normMean: 15,
    normSD: 3,
    normSource: "Schulhof 1977",
    clinicalNote: "Distance from PNS to adenoid on PNS-Ba line; decreased in adenoid hypertrophy",
  },
  {
    id: "PNS-AD2",
    label: "PNS-AD2 (PNS to Adenoid Point 2)",
    type: "length",
    points: ["PNS", "Ad2"],
    normMean: 18,
    normSD: 4,
    normSource: "Schulhof 1977",
    clinicalNote: "Distance from PNS to adenoid perpendicular to PNS-Ba line",
  },
  {
    id: "SPAS",
    label: "SPAS (Superior Posterior Airway Space)",
    type: "length",
    points: ["SP", "Ad3"],
    normMean: 10.5,
    normSD: 2.7,
    normSource: "Pracharktam 1994",
    clinicalNote: "Superior pharyngeal width at PNS-Occ level",
  },
  {
    id: "MAS",
    label: "MAS (Middle Airway Space)",
    type: "length",
    points: ["Vallecula", "Ad4"],
    normMean: 9.8,
    normSD: 2.5,
    normSource: "Pracharktam 1994",
    clinicalNote: "Middle pharyngeal width at PNS-Pog' midpoint level",
  },
  {
    id: "IAS",
    label: "IAS (Inferior Airway Space)",
    type: "length",
    points: ["Epiglottis", "PASbot"],
    normMean: 11.6,
    normSD: 3.0,
    normSource: "Pracharktam 1994",
    clinicalNote: "Inferior pharyngeal width at C3-RGN level",
  },
  {
    id: "MP-H",
    label: "MP-H (Hyoid to Mandibular Plane)",
    type: "length",
    points: ["H", "Go", "Me"],
    normMean: 12.3,
    normSD: 3.5,
    normSource: "Bibby 1984",
    clinicalNote: "Perpendicular distance from hyoid to mandibular plane (Go-Me); increased in OSA",
  },
  {
    id: "Tongue-Length",
    label: "Tongue Length (TT to Eb)",
    type: "length",
    points: ["TT", "Eb"],
    normMean: 76.9,
    normSD: 5.6,
    normSource: "Lowe 1985",
    clinicalNote: "Distance from tongue tip to vallecula/epiglottis base",
  },
  {
    id: "SP-Length",
    label: "Soft Palate Length (PNS to SP)",
    type: "length",
    points: ["PNS", "SP"],
    normMean: 32.4,
    normSD: 3.2,
    normSource: "Lowe 1985",
    clinicalNote: "Distance from posterior nasal spine to tip of soft palate; elongated in OSA",
  },
  {
    id: "SP-Thickness",
    label: "Soft Palate Thickness",
    type: "length",
    points: ["UP", "Ad3"],
    normMean: 8.5,
    normSD: 1.8,
    normSource: "Lowe 1985",
    clinicalNote: "Maximum thickness of soft palate approximated by UP-Ad3 distance",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function findPt(markups, label) {
  try {
    for (const m of markups) {
      if (m.visible === false) continue;
      if (m.label === label || m.label?.toLowerCase() === label.toLowerCase()) {
        const pts = vpts(m);
        if (pts.length > 0) return { x: pts[0].x, y: pts[0].y };
      }
    }
    return null;
  } catch { return null; }
}

export function sampleBoundaryAtY(pts, y) {
  try {
    if (!pts || pts.length < 2) return null;
    const sorted = [...pts].sort((a, b) => a.y - b.y);
    if (y < sorted[0].y || y > sorted[sorted.length - 1].y) return null;
    for (let i = 1; i < sorted.length; i++) {
      const p0 = sorted[i - 1];
      const p1 = sorted[i];
      if (y >= p0.y && y <= p1.y) {
        const dy = p1.y - p0.y;
        const t = dy === 0 ? 0 : (y - p0.y) / dy;
        return { x: p0.x + t * (p1.x - p0.x), y };
      }
    }
    return null;
  } catch { return null; }
}

export function findNarrowestPoint(anteriorPts, posteriorPts, yMin, yMax, steps) {
  try {
    if (!anteriorPts || !posteriorPts || steps < 1) return null;
    let minWidth = Infinity;
    let minY = yMin;
    let found = false;
    for (let i = 0; i <= steps; i++) {
      const y = yMin + (yMax - yMin) * (i / steps);
      const ant = sampleBoundaryAtY(anteriorPts, y);
      const post = sampleBoundaryAtY(posteriorPts, y);
      if (ant && post) {
        const w = Math.abs(post.x - ant.x);
        if (w < minWidth) {
          minWidth = w;
          minY = y;
          found = true;
        }
      }
    }
    return found ? { width: minWidth, y: minY } : null;
  } catch { return null; }
}

export function traceAirwayBoundary(markups) {
  try {
    const anterior = [];
    const posterior = [];
    for (const m of markups) {
      if (m.visible === false) continue;
      const pts = vpts(m);
      if (pts.length < 2) continue;
      const label = (m.label || "").toLowerCase();
      const isAnterior =
        label.includes("anterior airway") ||
        label.includes("airway anterior") ||
        (label.includes("soft palate") && (label.includes("anterior") || label.includes("silhouette") || m.type === "silhouette")) ||
        label.includes("tongue") ||
        label.includes("epiglottis") ||
        label === "anterior boundary";
      const isPosterior =
        label.includes("posterior airway") ||
        label.includes("airway posterior") ||
        label.includes("pharyngeal") ||
        label.includes("posterior pharyngeal") ||
        label.includes("pharynx") ||
        label === "posterior boundary";
      if (isAnterior) anterior.push(...pts.map(p => ({ x: p.x, y: p.y })));
      if (isPosterior) posterior.push(...pts.map(p => ({ x: p.x, y: p.y })));
    }
    const sortY = (arr) => arr.sort((a, b) => a.y - b.y);
    return {
      anterior: sortY(anterior),
      posterior: sortY(posterior),
    };
  } catch { return { anterior: [], posterior: [] }; }
}

export function sampleCatmullRom(pts, numSamples = 50) {
  try {
    if (!pts || pts.length < 2) return [];
    if (pts.length === 2) {
      const out = [];
      for (let i = 0; i < numSamples; i++) {
        const t = i / (numSamples - 1);
        out.push({ x: pts[0].x + t * (pts[1].x - pts[0].x), y: pts[0].y + t * (pts[1].y - pts[0].y) });
      }
      return out;
    }
    const ext = [pts[0], ...pts, pts[pts.length - 1]];
    const out = [];
    const segs = pts.length - 1;
    const samplesPer = Math.max(1, Math.ceil(numSamples / segs));
    for (let i = 0; i < segs; i++) {
      const p0 = ext[i], p1 = ext[i + 1], p2 = ext[i + 2], p3 = ext[i + 3] || ext[ext.length - 1];
      for (let j = 0; j < samplesPer; j++) {
        const t = j / samplesPer, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        });
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  } catch { return pts; }
}

export function autoSnapBoundary(imageData, guidePts, windowWidth, windowCenter) {
  try {
    if (!imageData || !guidePts || guidePts.length === 0) return guidePts;
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const ww = windowWidth || 2000;
    const wc = windowCenter || 500;
    const halfWw = ww / 2;
    const lo = wc - halfWw;
    const hi = wc + halfWw;
    const range = hi - lo || 1;

    const snap = (cx, cy) => {
      const ix = Math.round(cx);
      const iy = Math.round(cy);
      if (ix < 1 || ix >= w - 1 || iy < 1 || iy >= h - 1) return { x: cx, y: cy };

      const idx = (iy * w + ix) * 4;
      const val = ((data[idx] + data[idx + 1] + data[idx + 2]) / 3 - lo) / range;

      let bestScore = -Infinity;
      let bestP = { x: cx, y: cy };
      for (let angle = 0; angle < 180; angle += 15) {
        const rad = (angle * Math.PI) / 180;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        for (const sign of [-1, 1]) {
          let prevV = val;
          for (let d = 1; d <= 15; d++) {
            const sx = Math.round(cx + sign * dx * d);
            const sy = Math.round(cy + sign * dy * d);
            if (sx < 0 || sx >= w || sy < 0 || sy >= h) break;
            const si = (sy * w + sx) * 4;
            const sv = ((data[si] + data[si + 1] + data[si + 2]) / 3 - lo) / range;
            if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
              const grad = Math.abs(sv - prevV);
              if (grad > bestScore) {
                bestScore = grad;
                bestP = { x: sx, y: sy };
              }
            }
            prevV = sv;
          }
        }
      }
      return bestP;
    };

    return guidePts.map((p) => snap(p.x, p.y));
  } catch { return guidePts; }
}

function getInterpretation(z) {
  if (Math.abs(z) <= 1) return "Normal";
  if (Math.abs(z) <= 2) return "Borderline";
  if (z < -2) return "Narrow/Constrained";
  return "Wide/Enlarged";
}

// ─── Stratified airway norms ─────────────────────────────────────────────────

export const AIRWAY_NORMS_STRATIFIED = {
  "R-PAS": {
    source: "McNamara 1984",
    groups: [
      { sex: "M", ageMin: 8, ageMax: 12, mean: 10.5, sd: 2.2 },
      { sex: "M", ageMin: 12, ageMax: 16, mean: 11.0, sd: 2.3 },
      { sex: "M", ageMin: 16, ageMax: 20, mean: 11.2, sd: 2.4 },
      { sex: "F", ageMin: 8, ageMax: 12, mean: 9.8, sd: 2.0 },
      { sex: "F", ageMin: 12, ageMax: 16, mean: 10.2, sd: 2.2 },
      { sex: "F", ageMin: 16, ageMax: 20, mean: 10.5, sd: 2.3 },
    ],
  },
  "R-RG": { source: "McNamara 1984", groups: [
    { sex: "M", ageMin: 8, ageMax: 12, mean: 10.8, sd: 2.3 },
    { sex: "M", ageMin: 12, ageMax: 16, mean: 11.5, sd: 2.5 },
    { sex: "M", ageMin: 16, ageMax: 20, mean: 12.0, sd: 2.6 },
    { sex: "F", ageMin: 8, ageMax: 12, mean: 10.0, sd: 2.1 },
    { sex: "F", ageMin: 12, ageMax: 16, mean: 10.8, sd: 2.3 },
    { sex: "F", ageMin: 16, ageMax: 20, mean: 11.5, sd: 2.5 },
  ]},
  "N-PH": { source: "Solow 1985", groups: [
    { sex: "M", ageMin: 8, ageMax: 12, mean: 22.0, sd: 3.0 },
    { sex: "M", ageMin: 12, ageMax: 16, mean: 23.5, sd: 3.2 },
    { sex: "M", ageMin: 16, ageMax: 20, mean: 24.5, sd: 3.5 },
    { sex: "F", ageMin: 8, ageMax: 12, mean: 21.0, sd: 2.8 },
    { sex: "F", ageMin: 12, ageMax: 16, mean: 22.5, sd: 3.0 },
    { sex: "F", ageMin: 16, ageMax: 20, mean: 23.5, sd: 3.3 },
  ]},
  "PNS-AD1": { source: "Linder-Aronson 1970", groups: [
    { sex: "M", ageMin: 8, ageMax: 12, mean: 14.0, sd: 2.5 },
    { sex: "M", ageMin: 12, ageMax: 16, mean: 15.0, sd: 2.8 },
    { sex: "M", ageMin: 16, ageMax: 20, mean: 15.5, sd: 3.0 },
    { sex: "F", ageMin: 8, ageMax: 12, mean: 13.5, sd: 2.3 },
    { sex: "F", ageMin: 12, ageMax: 16, mean: 14.5, sd: 2.6 },
    { sex: "F", ageMin: 16, ageMax: 20, mean: 15.0, sd: 2.8 },
  ]},
  "PNS-AD2": { source: "Linder-Aronson 1970", groups: [
    { sex: "M", ageMin: 8, ageMax: 12, mean: 17.0, sd: 3.5 },
    { sex: "M", ageMin: 12, ageMax: 16, mean: 18.0, sd: 3.8 },
    { sex: "M", ageMin: 16, ageMax: 20, mean: 18.5, sd: 4.0 },
    { sex: "F", ageMin: 8, ageMax: 12, mean: 16.5, sd: 3.3 },
    { sex: "F", ageMin: 12, ageMax: 16, mean: 17.5, sd: 3.6 },
    { sex: "F", ageMin: 16, ageMax: 20, mean: 18.0, sd: 3.8 },
  ]},
  "SPAS": { source: "Battagel 1996", groups: [
    { sex: "M", ageMin: 8, ageMax: 12, mean: 9.5, sd: 2.0 },
    { sex: "M", ageMin: 12, ageMax: 16, mean: 10.0, sd: 2.2 },
    { sex: "M", ageMin: 16, ageMax: 20, mean: 10.5, sd: 2.5 },
    { sex: "F", ageMin: 8, ageMax: 12, mean: 9.0, sd: 1.8 },
    { sex: "F", ageMin: 12, ageMax: 16, mean: 9.8, sd: 2.0 },
    { sex: "F", ageMin: 16, ageMax: 20, mean: 10.2, sd: 2.3 },
  ]},
  "MAS": { source: "Battagel 1996", groups: [
    { sex: "M", ageMin: 8, ageMax: 12, mean: 9.0, sd: 2.0 },
    { sex: "M", ageMin: 12, ageMax: 16, mean: 9.5, sd: 2.2 },
    { sex: "M", ageMin: 16, ageMax: 20, mean: 10.0, sd: 2.5 },
    { sex: "F", ageMin: 8, ageMax: 12, mean: 8.5, sd: 1.8 },
    { sex: "F", ageMin: 12, ageMax: 16, mean: 9.0, sd: 2.0 },
    { sex: "F", ageMin: 16, ageMax: 20, mean: 9.5, sd: 2.3 },
  ]},
  "IAS": { source: "Battagel 1996", groups: [
    { sex: "M", ageMin: 8, ageMax: 12, mean: 10.5, sd: 2.5 },
    { sex: "M", ageMin: 12, ageMax: 16, mean: 11.0, sd: 2.8 },
    { sex: "M", ageMin: 16, ageMax: 20, mean: 11.5, sd: 3.0 },
    { sex: "F", ageMin: 8, ageMax: 12, mean: 10.0, sd: 2.3 },
    { sex: "F", ageMin: 12, ageMax: 16, mean: 10.5, sd: 2.5 },
    { sex: "F", ageMin: 16, ageMax: 20, mean: 11.0, sd: 2.8 },
  ]},
  "MP-H": { source: "Bibby 1984", groups: [
    { sex: "M", ageMin: 8, ageMax: 12, mean: 11.0, sd: 3.0 },
    { sex: "M", ageMin: 12, ageMax: 16, mean: 12.0, sd: 3.3 },
    { sex: "M", ageMin: 16, ageMax: 20, mean: 12.5, sd: 3.5 },
    { sex: "F", ageMin: 8, ageMax: 12, mean: 10.5, sd: 2.8 },
    { sex: "F", ageMin: 12, ageMax: 16, mean: 11.5, sd: 3.0 },
    { sex: "F", ageMin: 16, ageMax: 20, mean: 12.0, sd: 3.3 },
  ]},
};

export function lookupAirwayNorm(label, sex, age) {
  try {
    if (sex && age !== undefined && age !== null) {
      const stratified = AIRWAY_NORMS_STRATIFIED[label];
      if (stratified) {
        const sexUpper = sex.toUpperCase();
        for (const g of stratified.groups) {
          if (g.sex === sexUpper && age >= g.ageMin && age < g.ageMax) {
            return { mean: g.mean, sd: g.sd, source: stratified.source };
          }
        }
      }
    }
    const fallback = AIRWAY_NORMS[label];
    if (fallback) return { mean: fallback.mean, sd: fallback.sd, source: fallback.source };
    return null;
  } catch { return null; }
}

function getClinicalNote(id, value) {
  if (id === "R-PAS" && value !== null && value < 8) return "Retropalatal narrowing — consider sleep apnea screening";
  if (id === "MP-H" && value !== null && value > 15) return "Inferiorly positioned hyoid — associated with OSA";
  if (id === "SP-Length" && value !== null && value > 35) return "Elongated soft palate — may contribute to pharyngeal collapse";
  return null;
}

function buildGlobalClinicalNote(results) {
  const lowZ = results.filter((r) => r.zScore !== null && r.zScore < -2);
  if (lowZ.length >= 2) return "Multiple airway measurements below normal — comprehensive airway evaluation recommended";
  const allNormal = results.every((r) => r.zScore === null || Math.abs(r.zScore) <= 1);
  if (allNormal && results.some((r) => r.zScore !== null)) return "Airway measurements within expected range";
  return null;
}

// ─── Airway measurement computation ──────────────────────────────────────────

export function computeAirwayMeasurements(markups, calibration, sex, age) {
  try {
    if (!markups || !Array.isArray(markups)) return [];
    const calDone = calibration?.done === true;
    const ppm = calDone ? (calibration.pxPerMm || 1) : 1;

    const results = [];

    for (const def of AIRWAY_MEASUREMENTS) {
      try {
        const pts = def.points.map((label) => findPt(markups, label));
        const validPts = pts.filter((p) => p !== null);
        const reqLen = def.type === "length" ? 2 : def.points.length;

        if (validPts.length < reqLen) {
          const norm = lookupAirwayNorm(def.label, sex, age);
          results.push({
            id: def.id,
            label: def.label,
            value: null,
            unit: calDone ? "mm" : "px",
            normMean: norm ? norm.mean : def.normMean,
            normSD: norm ? norm.sd : def.normSD,
            normSource: norm ? norm.source : def.normSource,
            zScore: null,
            interpretation: "Missing landmarks",
            points: validPts,
          });
          continue;
        }

        let value = null;
        let unit = calDone ? "mm" : "px";

        if (def.id === "MP-H") {
          const h = pts[0];
          const go = pts[1];
          const me = pts[2];
          if (h && go && me) {
            const num = Math.abs(
              (me.y - go.y) * h.x -
                (me.x - go.x) * h.y +
                me.x * go.y -
                me.y * go.x
            );
            const den = dist(go, me);
            value = den < 1e-9 ? 0 : num / den;
            if (calDone) value /= ppm;
          }
        } else if (def.type === "length" && validPts.length >= 2) {
          value = dist(validPts[0], validPts[1]);
          if (calDone) value /= ppm;
        }

        const norm = lookupAirwayNorm(def.label, sex, age);
        const nMean = norm ? norm.mean : def.normMean;
        const nSD = norm ? norm.sd : def.normSD;
        const nSource = norm ? norm.source : def.normSource;

        const zScore =
          value !== null && nSD > 0
            ? (value - nMean) / nSD
            : null;
        const interpretation =
          value !== null
            ? getInterpretation(zScore)
            : "Missing landmarks";
        const clinicalNote = getClinicalNote(def.id, value);

        results.push({
          id: def.id,
          label: def.label,
          value,
          unit,
          normMean: nMean,
          normSD: nSD,
          normSource: nSource,
          zScore,
          interpretation,
          clinicalNote,
          points: validPts,
        });
      } catch {
        results.push({
          id: def.id,
          label: def.label,
          value: null,
          unit: calDone ? "mm" : "px",
          normMean: def.normMean,
          normSD: def.normSD,
          normSource: def.normSource,
          zScore: null,
          interpretation: "Computation error",
          points: [],
        });
      }
    }

    const globalNote = buildGlobalClinicalNote(results);
    if (globalNote) {
      results.push({
        id: "_global",
        label: "Summary",
        value: null,
        unit: "",
        normMean: null,
        normSD: null,
        zScore: null,
        interpretation: globalNote,
        clinicalNote: globalNote,
        points: [],
      });
    }

    return results;
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REC 1: Generate smooth airway boundaries from placed landmarks
// ═══════════════════════════════════════════════════════════════════════════════

export function generateAirwayBoundaries(markups) {
  try {
    const find = (label) => {
      const m = markups.find(mk => mk.type === "point" && mk.label === label && mk.visible !== false && mk.placed !== false);
      if (!m) return null;
      const pts = vpts(m);
      return pts.length ? { x: pts[0].x, y: pts[0].y } : null;
    };

    // Anterior boundary: PNS → SP → Vallecula → Epiglottis → TT
    const anteriorRaw = ["PNS", "SP", "Vallecula", "Epiglottis", "TT"]
      .map(find).filter(Boolean);
    // Posterior boundary: Ad1 → Ad2 → Ad3 → Ad4 → PASbot (sorted by Y descending)
    const posteriorRaw = ["Ad1", "Ad2", "Ad3", "Ad4", "PASbot"]
      .map(find).filter(Boolean)
      .sort((a, b) => b.y - a.y);

    if (anteriorRaw.length < 2 && posteriorRaw.length < 2) return null;

    return {
      anterior: anteriorRaw.length >= 2 ? sampleCatmullRom(anteriorRaw, 50) : [],
      posterior: posteriorRaw.length >= 2 ? sampleCatmullRom(posteriorRaw, 50) : [],
    };
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REC 2: OSA risk score
// ═══════════════════════════════════════════════════════════════════════════════

export function computeAirwayRiskScore(measurements) {
  try {
    if (!measurements || measurements.length === 0) return null;

    const keys = { "R-PAS": 1, "R-RG": 1, "MP-H": 1, "SP-Length": 1, "SP-Thickness": 1 };
    const scores = [];
    for (const m of measurements) {
      if (keys[m.id] && m.zScore != null && isFinite(m.zScore)) {
        scores.push(m.zScore);
      }
    }
    if (scores.length === 0) return null;

    const meanZ = scores.reduce((a, b) => a + b, 0) / scores.length;
    const mostNeg = Math.min(...scores);
    const flagged = scores.filter(z => z < -1).length;
    const critical = scores.filter(z => z < -2).length;

    let risk = "low";
    if (critical >= 2 || meanZ < -1.5 || mostNeg < -2.5) risk = "high";
    else if (critical >= 1 || flagged >= 2 || meanZ < -0.8) risk = "moderate";

    let summary;
    if (risk === "high") summary = "Elevated airway risk — multiple measurements significantly below normal. Comprehensive airway evaluation recommended, including sleep study referral if OSA suspected.";
    else if (risk === "moderate") summary = "Borderline airway measurements — some dimensions below expected range. Consider clinical correlation with symptoms.";
    else summary = "Airway measurements within expected range — no significant narrowing detected.";

    return { score: meanZ, risk, summary, measuredCount: scores.length, flaggedCount: flagged, criticalCount: critical };
  } catch { return null; }
}
