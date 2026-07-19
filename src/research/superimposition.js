// ═══════════════════════════════════════════════════════════════════════════════
// SUPERIMPOSITION — Procrustes & structural alignment, displacement computation
// for cephalometric T1-on-T2 overlay and growth analysis.
// ═══════════════════════════════════════════════════════════════════════════════

import { vpts, dist, angle3pt, computeMeasurements } from "../utils.js";

// ─── Structural reference planes ─────────────────────────────────────────────
// Each plane is defined by two landmark labels. The source session is aligned
// so that its plane matches the destination session's plane.

export const REFERENCE_PLANES = [
  { id: "SN",       label: "S-N (Anterior Cranial Base)",    pt1: "Sella",    pt2: "Nasion" },
  { id: "BaN",      label: "Ba-N (Cranial Base)",            pt1: "Basion",   pt2: "Nasion" },
  { id: "palatal",  label: "Palatal Plane",                   pt1: "ANS",      pt2: "PNS" },
  { id: "mandible", label: "Mandibular Plane",                pt1: "Go",       pt2: "Me" },
  { id: "FH",       label: "Frankfort Horizontal",            pt1: "Porion",   pt2: "Orbitale" },
  { id: "OP",       label: "Occlusal Plane",                  pt1: "U1 tip",   pt2: "Me" },
];

// ─── Geometry helpers ────────────────────────────────────────────────────────

function centroid(pts) {
  const n = pts.length;
  if (n === 0) return { x: 0, y: 0 };
  let sx = 0, sy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; }
  return { x: sx / n, y: sy / n };
}

function centroidSize(pts) {
  const c = centroid(pts);
  let s = 0;
  for (const p of pts) { const dx = p.x - c.x, dy = p.y - c.y; s += dx * dx + dy * dy; }
  return Math.sqrt(s);
}

// ─── Procrustes alignment ────────────────────────────────────────────────────

export function procrustesAlign(sourcePts, destPts) {
  if (sourcePts.length < 2 || destPts.length < 2 || sourcePts.length !== destPts.length) {
    return { tx: 0, ty: 0, rot: 0, scale: 1, error: "Need ≥2 matched landmarks" };
  }

  const srcCentroid = centroid(sourcePts);
  const dstCentroid = centroid(destPts);

  // Center both
  const srcC = sourcePts.map(p => ({ x: p.x - srcCentroid.x, y: p.y - srcCentroid.y }));
  const dstC = destPts.map(p => ({ x: p.x - dstCentroid.x, y: p.y - dstCentroid.y }));

  // Scale to unit centroid size
  const srcCS = centroidSize(srcC);
  const dstCS = centroidSize(dstC);
  const scale = srcCS > 1e-12 ? dstCS / srcCS : 1;
  const srcS = srcC.map(p => ({ x: p.x * scale, y: p.y * scale }));

  // Compute optimal rotation via cross-covariance (Kabsch algorithm)
  let Hxx = 0, Hxy = 0, Hyx = 0, Hyy = 0;
  for (let i = 0; i < srcS.length; i++) {
    Hxx += srcS[i].x * dstC[i].x;
    Hxy += srcS[i].x * dstC[i].y;
    Hyx += srcS[i].y * dstC[i].x;
    Hyy += srcS[i].y * dstC[i].y;
  }

  // For 2D: optimal rotation angle
  const angle = Math.atan2(Hxy - Hyx, Hxx + Hyy);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Combine into single transform: first scale+rotate source, then translate to dest centroid
  const tx = dstCentroid.x - (cos * srcCentroid.x * scale - sin * srcCentroid.y * scale);
  const ty = dstCentroid.y - (sin * srcCentroid.x * scale + cos * srcCentroid.y * scale);

  return { tx, ty, rot: angle, scale };
}

// ─── Structural alignment (2-point plane registration) ───────────────────────

export function structuralAlign(sourcePts, destPts) {
  if (sourcePts.length < 2 || destPts.length < 2) {
    return { tx: 0, ty: 0, rot: 0, scale: 1, error: "Need 2 reference points" };
  }
  const [s1, s2] = sourcePts;
  const [d1, d2] = destPts;

  const srcAngle = Math.atan2(s2.y - s1.y, s2.x - s1.x);
  const dstAngle = Math.atan2(d2.y - d1.y, d2.x - d1.x);
  const rot = dstAngle - srcAngle;
  const srcLen = dist(s1, s2);
  const dstLen = dist(d1, d2);
  const scale = srcLen > 1e-9 ? dstLen / srcLen : 1;

  const cosR = Math.cos(rot) * scale;
  const sinR = Math.sin(rot) * scale;
  const tx = d1.x - (cosR * s1.x - sinR * s1.y);
  const ty = d1.y - (sinR * s1.x + cosR * s1.y);

  return { tx, ty, rot, scale };
}

// ─── Apply transform ─────────────────────────────────────────────────────────

export function applyTransform(pt, tf) {
  const cos = Math.cos(tf.rot) * tf.scale;
  const sin = Math.sin(tf.rot) * tf.scale;
  return {
    x: cos * pt.x - sin * pt.y + tf.tx,
    y: sin * pt.x + cos * pt.y + tf.ty,
  };
}

// ─── Landmark matching ───────────────────────────────────────────────────────

function extractPoints(markups) {
  const points = [];
  const labels = new Set();
  for (const m of markups) {
    if (m.type === "point" && m.label && !labels.has(m.label)) {
      const vp = vpts(m);
      if (vp.length > 0) {
        points.push({ label: m.label, x: vp[0].x, y: vp[0].y, markup: m });
        labels.add(m.label);
      }
    }
  }
  return points;
}

function matchLandmarks(srcMarkups, dstMarkups) {
  const srcPts = extractPoints(srcMarkups);
  const dstPts = extractPoints(dstMarkups);
  const matched = [];
  const dstMap = new Map(dstPts.map(p => [p.label, p]));
  for (const sp of srcPts) {
    const dp = dstMap.get(sp.label);
    if (dp) matched.push({ label: sp.label, src: sp, dst: dp });
  }
  return { srcPts, dstPts, matched };
}

// ─── Displacement computation ────────────────────────────────────────────────

export function computeDisplacements(matched, transform, pxPerMm) {
  const mm = pxPerMm > 0;
  return matched.map(({ label, src, dst }) => {
    const aligned = applyTransform({ x: src.x, y: src.y }, transform);
    const dx = dst.x - aligned.x;
    const dy = dst.y - aligned.y;
    const lenPx = Math.sqrt(dx * dx + dy * dy);
    const lenMm = mm ? lenPx / pxPerMm : lenPx;
    const angle = Math.atan2(-dy, dx) * (180 / Math.PI); // angle from right, y-inverted
    return { label, dx, dy, lenPx, lenMm, angle, unit: mm ? "mm" : "px" };
  });
}

// ─── Angular change computation ──────────────────────────────────────────────

export function computeAngularChanges(srcMarkups, dstMarkups) {
  const changes = [];
  const angleTypes = ["angle3", "angle4"];
  for (const m1 of srcMarkups) {
    if (!angleTypes.includes(m1.type)) continue;
    const m2 = dstMarkups.find(m => m.type === m1.type && m.label === m1.label);
    if (!m2) continue;
    const pts1 = vpts(m1), pts2 = vpts(m2);
    if (pts1.length < 3 || pts2.length < 3) continue;
    const a1 = m1.type === "angle3" ? angle3pt(pts1[0], pts1[1], pts1[2]) : angle3pt(pts1[0], pts1[1], pts1[2]);
    const a2 = m2.type === "angle3" ? angle3pt(pts2[0], pts2[1], pts2[2]) : angle3pt(pts2[0], pts2[1], pts2[2]);
    changes.push({ label: m1.label, type: m1.type, angle1: a1, angle2: a2, delta: a2 - a1 });
  }
  return changes;
}

// ─── Linear measurement changes ──────────────────────────────────────────────

export function computeLinearChanges(srcMarkups, dstMarkups, calibration) {
  const changes = [];
  const seen = new Set();
  for (const m1 of srcMarkups) {
    if (!m1.label || m1.type === "ruler" || m1.type === "silhouette") continue;
    const m2 = dstMarkups.find(m => m.type === m1.type && m.label === m1.label);
    if (!m2) continue;
    try {
      const v1 = computeMeasurements(m1, calibration);
      const v2 = computeMeasurements(m2, calibration);
      const keys = Object.keys(v1).filter(k => !k.startsWith("_") && typeof v1[k] === "number" && isFinite(v1[k]));
      for (const k of keys) {
        if (v2[k] == null || !isFinite(v2[k])) continue;
        const key = `${m1.label}::${k}`;
        if (seen.has(key)) continue;
        seen.add(key);
        changes.push({ label: m1.label, measureKey: k, value1: v1[k], value2: v2[k], delta: v2[k] - v1[k], unit: v1._unit || "px" });
      }
    } catch { /* skip */ }
  }
  return changes;
}

// ─── Full superimposition analysis ───────────────────────────────────────────

export function runSuperimposition(baseMarkups, compareMarkups, config, calibration) {
  const { method, referencePlane, labelFilter } = config || {};
  const pxPerMm = calibration?.done ? calibration.pxPerMm : 0;

  // Filter markups by label if specified
  const filterSet = labelFilter?.length > 0 ? new Set(labelFilter) : null;
  const baseF = filterSet ? baseMarkups.filter(m => filterSet.has(m.label)) : baseMarkups;
  const compF = filterSet ? compareMarkups.filter(m => filterSet.has(m.label)) : compareMarkups;

  // Match landmarks
  const { srcPts, dstPts, matched } = matchLandmarks(compF, baseF);

  if (matched.length < 2) {
    return { error: "Need ≥2 matching landmarks between sessions", displacements: [], transform: null, matchedCount: 0 };
  }

  // Compute alignment
  let transform;
  let alignmentLabel;

  if (method === "structural" && referencePlane) {
    const plane = REFERENCE_PLANES.find(p => p.id === referencePlane);
    if (!plane) return { error: "Unknown reference plane" };

    const srcPlane = [matched.find(m => m.label === plane.pt1)?.src, matched.find(m => m.label === plane.pt2)?.src].filter(Boolean);
    const dstPlane = [matched.find(m => m.label === plane.pt1)?.dst, matched.find(m => m.label === plane.pt2)?.dst].filter(Boolean);

    if (srcPlane.length < 2 || dstPlane.length < 2) {
      return { error: `Reference plane "${plane.label}" requires landmarks "${plane.pt1}" and "${plane.pt2}" to be present in both sessions` };
    }

    transform = structuralAlign(srcPlane, dstPlane);
    alignmentLabel = plane.label;
  } else {
    // Procrustes: use all matched points
    transform = procrustesAlign(
      matched.map(m => ({ x: m.src.x, y: m.src.y })),
      matched.map(m => ({ x: m.dst.x, y: m.dst.y }))
    );
    alignmentLabel = `Procrustes (${matched.length} landmarks)`;
  }

  if (transform.error) return { error: transform.error };

  // Compute displacements
  const displacements = computeDisplacements(matched, transform, pxPerMm);

  // Angular changes
  const angularChanges = computeAngularChanges(compF, baseF);

  // Linear changes
  const linearChanges = computeLinearChanges(compF, baseF, calibration);

  // Centroid sizes
  const srcCS = centroidSize(srcPts.map(p => ({ x: p.x, y: p.y })));
  const dstCS = centroidSize(dstPts.map(p => ({ x: p.x, y: p.y })));
  const csDiffPx = dstCS - srcCS;
  const csDiffMm = pxPerMm > 0 ? csDiffPx / pxPerMm : csDiffPx;
  const csPct = srcCS > 1e-9 ? ((dstCS / srcCS) - 1) * 100 : 0;

  // Stats
  const mmVals = displacements.filter(d => d.unit === "mm").map(d => d.lenMm);
  const stats = mmVals.length > 0 ? {
    mean: mmVals.reduce((a, b) => a + b, 0) / mmVals.length,
    max: Math.max(...mmVals),
    min: Math.min(...mmVals),
    sd: Math.sqrt(mmVals.reduce((s, v) => s + (v - mmVals.reduce((a, b) => a + b, 0) / mmVals.length) ** 2, 0) / Math.max(1, mmVals.length - 1)),
    count: mmVals.length,
  } : null;

  return {
    transform,
    alignmentLabel,
    matchedCount: matched.length,
    totalSrc: srcPts.length,
    totalDst: dstPts.length,
    displacements,
    angularChanges,
    linearChanges,
    centroidSize: { base: dstCS, compare: srcCS, diffPx: csDiffPx, diffMm: csDiffMm, pctChange: csPct },
    stats,
    matchedLabels: matched.map(m => m.label),
  };
}

// ─── Study-level runner (called by engine.js) ────────────────────────────────

export function runSuperimpositionAll(sessions, config, calibration) {
  const { baseSessionId, compareSessionId, method, referencePlane, labelIds } = config;

  const baseSession = sessions.find(s => s.id === baseSessionId);
  const compareSession = sessions.find(s => s.id === compareSessionId);

  if (!baseSession || !compareSession) {
    return { error: "Both base and compare sessions must be selected" };
  }

  const baseMarkups = (baseSession.markups || []).filter(m => m.visible !== false && m.placed !== false);
  const compareMarkups = (compareSession.markups || []).filter(m => m.visible !== false && m.placed !== false);

  const result = runSuperimposition(baseMarkups, compareMarkups, {
    method: method || "procrustes",
    referencePlane: referencePlane || "SN",
    labelFilter: labelIds,
  }, baseSession.calibration?.done ? baseSession.calibration : calibration);

  return {
    ...result,
    baseSession: { id: baseSession.id, name: baseSession.name || baseSession.label, timepoint: baseSession.meta?.timepoint },
    compareSession: { id: compareSession.id, name: compareSession.name || compareSession.label, timepoint: compareSession.meta?.timepoint },
    method: method || "procrustes",
    calibrationUsed: baseSession.calibration?.done || false,
  };
}
