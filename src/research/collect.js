import { computeMeasurements } from "../utils.js";
import { logError } from "../logger.js";

const _collectCache = new WeakMap();

export function collectMeasurements(sessions, labelIds, calibration, angleMode) {
  const labelKey = [...(labelIds || [])].sort().join(",");
  const calKey = calibration ? `${calibration.done}:${calibration.pxPerMm}:${calibration.knownMm}` : "";
  const cacheKey = `${labelKey}|${calKey}|${angleMode || ""}`;
  const cached = _collectCache.get(sessions);
  if (cached && cached.key === cacheKey) return cached.result;

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
      } catch (e) { logError("collect/markup", e); }
    }
  }
  _collectCache.set(sessions, { key: cacheKey, result: rows });
  return rows;
}

export function pivotMeasurements(rows) {
  const pivoted = {};
  const labels = [];
  const seen = {};
  const units = {};
  for (const r of rows) {
    const key = `${r.sessionId}::${r.label}`;
    if (!pivoted[key]) {
      pivoted[key] = { sessionId: r.sessionId, sessionName: r.sessionName, label: r.label, values: {} };
      labels.push(pivoted[key]);
    }
    const subKey = `${key}::${r.measureKey}`;
    if (seen[subKey] != null && seen[subKey] !== r.value) {
      pivoted[key]._duplicates = pivoted[key]._duplicates || [];
      pivoted[key]._duplicates.push({ measureKey: r.measureKey, existing: seen[subKey], incoming: r.value });
    }
    if (seen[subKey] == null) {
      pivoted[key].values[r.measureKey] = r.value;
      seen[subKey] = r.value;
    }
    units[r.label] = r.unit;
  }
  labels.units = units;
  return labels;
}
