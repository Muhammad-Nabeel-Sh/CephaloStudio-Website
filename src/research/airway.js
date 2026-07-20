// ═══════════════════════════════════════════════════════════════════════════════
// AIRWAY — Cephalometric airway measurement computation engine
// ═══════════════════════════════════════════════════════════════════════════════

import { vpts, dist } from "../utils.js";

// ─── Airway measurement definitions ──────────────────────────────────────────

export const AIRWAY_MEASUREMENTS = [
  {
    id: "N-PH",
    label: "N-PH (Nasion to Pharyngeal Wall)",
    type: "length",
    points: ["N", "PH"],
    normMean: 22,
    normSD: 3,
    normSource: "Riley et al., 1983",
    clinicalNote: "Distance from nasion to posterior pharyngeal wall; reduced in adenoid hypertrophy",
  },
  {
    id: "R-PAS",
    label: "R-PAS (Retropalatal Airway Space)",
    type: "length",
    points: ["PNS", "P"],
    normMean: 11,
    normSD: 2,
    normSource: "Riley et al., 1983",
    clinicalNote: "Narrowest sagittal dimension at retropalatal level; <5mm suggests severe narrowing",
  },
  {
    id: "R-RG",
    label: "R-RG (Retroglossal Airway Space)",
    type: "length",
    points: ["TT", "Eb"],
    normMean: 12,
    normSD: 3,
    normSource: "Riley et al., 1983",
    clinicalNote: "Narrowest sagittal dimension at retroglossal level; <5mm associated with OSA",
  },
  {
    id: "PNS-AD1",
    label: "PNS-AD1 (PNS to Adenoid Point 1)",
    type: "length",
    points: ["PNS", "AD1"],
    normMean: 27,
    normSD: 4,
    normSource: "Linder-Aronson, 1970",
    clinicalNote: "Distance from posterior nasal spine to adenoid on PNS-Ba line; decreased in adenoid hypertrophy",
  },
  {
    id: "PNS-AD2",
    label: "PNS-AD2 (PNS to Adenoid Point 2)",
    type: "length",
    points: ["PNS", "AD2"],
    normMean: 11,
    normSD: 2,
    normSource: "Linder-Aronson, 1970",
    clinicalNote: "Distance from PNS to adenoid perpendicular to PNS-Ba line",
  },
  {
    id: "SPAS",
    label: "SPAS (Superior Posterior Airway Space)",
    type: "length",
    points: ["SPAS-ant", "SPAS-post"],
    normMean: 12,
    normSD: 2,
    normSource: "Battagel & L'Estrange, 1996",
    clinicalNote: "Superior pharyngeal width at maxillary occlusal plane level",
  },
  {
    id: "MAS",
    label: "MAS (Middle Airway Space)",
    type: "length",
    points: ["MAS-ant", "MAS-post"],
    normMean: 11,
    normSD: 2,
    normSource: "Battagel & L'Estrange, 1996",
    clinicalNote: "Middle pharyngeal width at mandibular occlusal plane level",
  },
  {
    id: "IAS",
    label: "IAS (Inferior Airway Space)",
    type: "length",
    points: ["IAS-ant", "IAS-post"],
    normMean: 12,
    normSD: 3,
    normSource: "Battagel & L'Estrange, 1996",
    clinicalNote: "Inferior pharyngeal width at hyoid level",
  },
  {
    id: "MP-H",
    label: "MP-H (Hyoid to Mandibular Plane)",
    type: "length",
    points: ["H", "Go", "Me"],
    normMean: 17,
    normSD: 4,
    normSource: "Riley et al., 1983",
    clinicalNote: "Perpendicular distance from hyoid to mandibular plane (Go-Me); increased in OSA",
  },
  {
    id: "Tongue-Length",
    label: "Tongue Length (TT to Eb)",
    type: "length",
    points: ["TT", "Eb"],
    normMean: 80,
    normSD: 5,
    normSource: "Guilleminault et al., 1995",
    clinicalNote: "Distance from tongue tip to vallecula/epiglottis base",
  },
  {
    id: "SP-Length",
    label: "Soft Palate Length (PNS to P)",
    type: "length",
    points: ["PNS", "P"],
    normMean: 38,
    normSD: 3,
    normSource: "Pepin et al., 2002",
    clinicalNote: "Distance from posterior nasal spine to tip of soft palate; elongated in OSA",
  },
  {
    id: "SP-Thickness",
    label: "Soft Palate Thickness",
    type: "length",
    points: ["SPT-ant", "SPT-post"],
    normMean: 10,
    normSD: 2,
    normSource: "Pepin et al., 2002",
    clinicalNote: "Maximum thickness of soft palate; thickened in OSA patients",
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

function getInterpretation(z) {
  if (Math.abs(z) <= 1) return "Normal";
  if (Math.abs(z) <= 2) return "Borderline";
  if (z < -2) return "Narrow/Constrained";
  return "Wide/Enlarged";
}

// ─── Airway measurement computation ──────────────────────────────────────────

export function computeAirwayMeasurements(markups, calibration) {
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
          results.push({
            id: def.id,
            label: def.label,
            value: null,
            unit: calDone ? "mm" : "px",
            normMean: def.normMean,
            normSD: def.normSD,
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

        const zScore =
          value !== null && def.normSD > 0
            ? (value - def.normMean) / def.normSD
            : null;
        const interpretation =
          value !== null
            ? getInterpretation(zScore)
            : "Missing landmarks";

        results.push({
          id: def.id,
          label: def.label,
          value,
          unit,
          normMean: def.normMean,
          normSD: def.normSD,
          zScore,
          interpretation,
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
          zScore: null,
          interpretation: "Computation error",
          points: [],
        });
      }
    }

    return results;
  } catch { return []; }
}
