import { computeMeasurements } from "../utils.js";

export function collectMeasurements(sessions, labelIds, calibration, angleMode) {
  const rows = [];
  for (const s of sessions) {
    if (!s) continue;
    const markups = s.markups || [];
    const cal = s.calibration?.done ? s.calibration : calibration || { done: false, pxPerMm: 1 };
    const mode = s.angleMode || angleMode || "signed-deg";
    for (const m of markups) {
      if (!m.label) continue;
      if (labelIds.length > 0 && !labelIds.includes(m.label)) continue;
      if (m.type === "ruler" || m.type === "silhouette") continue;
      if (!m.visible || !m.placed) continue;
      try {
        const vals = computeMeasurements(m, cal, mode);
        for (const [key, raw] of Object.entries(vals)) {
          if (typeof raw !== "number" || !isFinite(raw)) continue;
          rows.push({
            sessionId: s.id,
            sessionName: s.name || s.label || "Session",
            markupId: m.id,
            label: m.label,
            measureKey: key,
            value: raw,
            unit: key.includes("angle") || key.includes("deg") ? "°" : "mm",
            type: m.type,
          });
        }
      } catch { /* skip problematic markup */ }
    }
  }
  return rows;
}

export function pivotMeasurements(rows) {
  const pivoted = {};
  const labels = [];
  for (const r of rows) {
    const key = `${r.sessionId}::${r.label}`;
    if (!pivoted[key]) {
      pivoted[key] = { sessionId: r.sessionId, sessionName: r.sessionName, label: r.label, values: {} };
      labels.push(pivoted[key]);
    }
    pivoted[key].values[r.measureKey] = r.value;
  }
  return labels;
}
