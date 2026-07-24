// ═══════════════════════════════════════════════════════════════════════════════
// Template loading + auto-measurement creation
// ═══════════════════════════════════════════════════════════════════════════════

import { uid, computeMeasurements } from "../utils.js";
import { PREDEFINED } from "../constants.js";

export function getMeasValue(m, calibration) {
  const ms = computeMeasurements(m, calibration);
  const vals = Object.values(ms).filter(v => typeof v === "number" && isFinite(v));
  return vals.length > 0 ? vals[0] : 0;
}

export function autoCreateMeasurements(markups, templateName, calibration) {
  const analysis = PREDEFINED.lateral.find(a => a.name === templateName)
    || PREDEFINED.ap.find(a => a.name === templateName)
    || PREDEFINED.smv.find(a => a.name === templateName)
    || PREDEFINED.opg.find(a => a.name === templateName)
    || PREDEFINED.handwrist.find(a => a.name === templateName)
    || PREDEFINED.photolateral.find(a => a.name === templateName)
    || PREDEFINED.photofrontal.find(a => a.name === templateName);
  if (!analysis || !analysis.measurements || analysis.measurements.length === 0) return [];

  const placed = {};
  for (const m of markups) {
    if (m.placed && m.label) placed[m.label] = m;
  }
  const existingLabels = new Set(markups.map(m => m.label));
  const result = [];

  for (const meas of analysis.measurements) {
    if (meas.type === "ratio" || meas.type === "sum" || meas.type === "difference" || meas.type === "percentage") continue;
    if (!meas.pts || meas.pts.length < 2) continue;
    if (existingLabels.has(meas.l)) continue;
    const allPlaced = meas.pts.every(rl => placed[rl]);
    if (!allPlaced) continue;
    const points = meas.pts.map(rl => placed[rl].points[0]);
    const extraProps = {};
    if (meas.type === "line" && !meas.norm) { extraProps.mode = "infinite"; extraProps.style = "dashed"; }
    if (meas.type === "polygon") { extraProps.fillColor = "rgba(56,189,248,0.08)"; extraProps.curveStyle = "linear"; }
    result.push({
      id: uid(), type: meas.type, points,
      label: meas.l, definition: meas.def || "",
      color: meas.color || "#888",
      visible: true, locked: true, autoCreated: true, placed: true,
      refLabels: meas.pts, norm: meas.norm, measure: meas.l, ...extraProps,
    });
  }

  const updatedLabels = new Set([...existingLabels, ...result.map(m => m.label)]);
  const markupMap = {};
  for (const m of [...markups, ...result]) {
    if (m.label) markupMap[m.label] = m;
  }
  for (const meas of analysis.measurements) {
    if (meas.type !== "ratio" && meas.type !== "sum" && meas.type !== "difference" && meas.type !== "percentage") continue;
    if (!meas.pts || meas.pts.length < 2) continue;
    if (updatedLabels.has(meas.l)) continue;
    const allRefsExist = meas.pts.every(rl => markupMap[rl]);
    if (!allRefsExist) continue;
    let computedValue = 0;
    if (meas.type === "ratio") {
      const v0 = getMeasValue(markupMap[meas.pts[0]], calibration);
      const v1 = getMeasValue(markupMap[meas.pts[1]], calibration);
      computedValue = v1 !== 0 ? v0 / v1 : 0;
    } else if (meas.type === "difference") {
      computedValue = getMeasValue(markupMap[meas.pts[0]], calibration) - getMeasValue(markupMap[meas.pts[1]], calibration);
    } else if (meas.type === "percentage") {
      const v0 = getMeasValue(markupMap[meas.pts[0]], calibration);
      const v1 = getMeasValue(markupMap[meas.pts[1]], calibration);
      computedValue = v1 !== 0 ? (v0 / v1) * 100 : 0;
    } else {
      computedValue = meas.pts.reduce((s, rl) => s + getMeasValue(markupMap[rl], calibration), 0);
    }
    result.push({
      id: uid(), type: meas.type, points: [],
      label: meas.l, definition: meas.def || "",
      color: meas.color || "#888",
      visible: true, locked: true, autoCreated: true,
      refLabels: meas.pts, computedValue, norm: meas.norm,
    });
  }
  return result;
}
