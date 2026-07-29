// ═══════════════════════════════════════════════════════════════════════════════
// Template loading + auto-measurement creation
// ═══════════════════════════════════════════════════════════════════════════════

import { uid, computeMeasurements } from "../lib/utils.js";
import { PREDEFINED } from "../data/constants.js";

export function getMeasValue(m, calibration) {
  const ms = computeMeasurements(m, calibration);
  const vals = Object.values(ms).filter(v => typeof v === "number" && isFinite(v));
  return vals.length > 0 ? vals[0] : 0;
}

function resolveLabel(rl, placedByLabel, placedByTemplateLabel) {
  return placedByTemplateLabel[rl] || placedByLabel[rl] || null;
}

function buildLookups(markups) {
  const byLabel = {}, byTemplateLabel = {};
  for (const m of markups) {
    if (m.label) byLabel[m.label] = m;
    if (m.templateLabel) byTemplateLabel[m.templateLabel] = m;
  }
  return { byLabel, byTemplateLabel };
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

  const { byLabel: placed, byTemplateLabel: placedByTL } = buildLookups(markups);
  const existingLabels = new Set(markups.map(m => m.label));
  const result = [];

  for (const meas of analysis.measurements) {
    if (meas.type === "ratio" || meas.type === "sum" || meas.type === "difference" || meas.type === "percentage") continue;
    if (!meas.pts || meas.pts.length < 2) continue;
    if (existingLabels.has(meas.l)) continue;
    const matched = meas.pts.map(rl => resolveLabel(rl, placed, placedByTL));
    if (matched.some(m => !m)) continue;
    const points = matched.map(m => m.points[0]);
    const resolvedRefLabels = matched.map(m => m.label);
    const extraProps = {};
    if (meas.type === "line" && !meas.norm) { extraProps.mode = "infinite"; extraProps.style = "dashed"; }
    if (meas.type === "polygon") { extraProps.fillColor = "rgba(56,189,248,0.08)"; extraProps.curveStyle = "linear"; }
    result.push({
      id: uid(), type: meas.type, points,
      label: meas.l, definition: meas.def || "",
      color: meas.color || "#888",
      visible: true, locked: true, autoCreated: true, placed: true,
      refLabels: resolvedRefLabels, norm: meas.norm, measure: meas.l, ...extraProps,
    });
  }

  const updatedLabels = new Set([...existingLabels, ...result.map(m => m.label)]);
  const combined = [...markups, ...result];
  const { byLabel: markupMap, byTemplateLabel: markupMapTL } = buildLookups(combined);
  for (const meas of analysis.measurements) {
    if (meas.type !== "ratio" && meas.type !== "sum" && meas.type !== "difference" && meas.type !== "percentage") continue;
    if (!meas.pts || meas.pts.length < 2) continue;
    if (updatedLabels.has(meas.l)) continue;
    const matched = meas.pts.map(rl => resolveLabel(rl, markupMap, markupMapTL));
    if (matched.some(m => !m)) continue;
    const resolvedRefLabels = matched.map(m => m.label);
    let computedValue = 0;
    if (meas.type === "ratio") {
      const v0 = getMeasValue(matched[0], calibration);
      const v1 = getMeasValue(matched[1], calibration);
      computedValue = v1 !== 0 ? v0 / v1 : 0;
    } else if (meas.type === "difference") {
      computedValue = getMeasValue(matched[0], calibration) - getMeasValue(matched[1], calibration);
    } else if (meas.type === "percentage") {
      const v0 = getMeasValue(matched[0], calibration);
      const v1 = getMeasValue(matched[1], calibration);
      computedValue = v1 !== 0 ? (v0 / v1) * 100 : 0;
    } else {
      computedValue = matched.reduce((s, m) => s + getMeasValue(m, calibration), 0);
    }
    result.push({
      id: uid(), type: meas.type, points: [],
      label: meas.l, definition: meas.def || "",
      color: meas.color || "#888",
      visible: true, locked: true, autoCreated: true,
      refLabels: resolvedRefLabels, computedValue, norm: meas.norm,
    });
  }
  return result;
}
