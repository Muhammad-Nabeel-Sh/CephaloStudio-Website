import { uid } from "../lib/utils.js";
import { getMeasValue } from "./template.js";

export function refreshAutoMeasurements(markups) {
  const placed = {};
  const markupMap = {};
  for (const m of markups) {
    if (m.placed && m.label) placed[m.label] = m;
    if (m.label) markupMap[m.label] = m;
  }
  return markups.map(m => {
    if (!m.refLabels || m.refLabels.length === 0) return m;
    if (m.type === "ratio" || m.type === "sum" || m.type === "difference" || m.type === "percentage") {
      const allRefsExist = m.refLabels.every(rl => markupMap[rl]);
      if (!allRefsExist) return m;
      let nv = 0;
      if (m.type === "ratio") {
        const v0 = getMeasValue(markupMap[m.refLabels[0]]);
        const v1 = getMeasValue(markupMap[m.refLabels[1]]);
        nv = v1 !== 0 ? v0 / v1 : 0;
      } else if (m.type === "difference") {
        nv = getMeasValue(markupMap[m.refLabels[0]]) - getMeasValue(markupMap[m.refLabels[1]]);
      } else if (m.type === "percentage") {
        const v0 = getMeasValue(markupMap[m.refLabels[0]]);
        const v1 = getMeasValue(markupMap[m.refLabels[1]]);
        nv = v1 !== 0 ? (v0 / v1) * 100 : 0;
      } else {
        nv = m.refLabels.reduce((s, rl) => s + getMeasValue(markupMap[rl]), 0);
      }
      if (m.computedValue !== nv) return { ...m, computedValue: nv };
      return m;
    }
    const allPlaced = m.refLabels.every(rl => placed[rl]);
    if (!allPlaced) return m;
    const np = m.refLabels.map(rl => placed[rl].points[0]);
    if (np.some((p, i) => p.x !== m.points[i]?.x || p.y !== m.points[i]?.y)) return { ...m, points: np };
    return m;
  });
}

export function markupDefaults(partial, markups, t) {
  const typeCount = (type) => markups.filter(m => m.type === type).length;
  const m = { id: uid(), color: t.acc, width: 1.5, style: "solid", size: 6, label: "", definition: "", showLength: true, strokeColor: t.acc, fillColor: t.acc + "22", strokeWidth: 1.5, visible: true, placed: true, ...partial };
  if (partial.type === "point") m.label = `P${typeCount("point") + 1}`;
  if (partial.type === "line" || partial.type === "parallel") m.label = partial.label || `Line ${typeCount("line") + typeCount("parallel") + 1}`;
  if (partial.type === "curve") m.label = partial.label || `Trace ${typeCount("curve") + 1}`;
  if (partial.type === "polyline") m.label = partial.label || `Polyline ${typeCount("polyline") + 1}`;
  if (partial.type === "angle3") m.label = partial.label || `Angle ${typeCount("angle3") + 1}`;
  if (partial.type === "angle4") m.label = partial.label || `Inc_Angle ${typeCount("angle4") + 1}`;
  if (partial.type === "ellipse") m.label = partial.label || `Ellipse ${typeCount("ellipse") + 1}`;
  if (partial.type === "arc") m.label = partial.label || `Arc ${typeCount("arc") + 1}`;
  if (partial.type === "circle") m.label = partial.label || `Circle ${typeCount("circle") + 1}`;
  if (partial.type === "bezier") m.label = partial.label || `Bezier ${typeCount("bezier") + 1}`;
  if (partial.type === "tangent") m.label = partial.label || `Tangent ${typeCount("tangent") + 1}`;
  if (partial.type === "concentric") m.label = partial.label || `Concentric ${typeCount("concentric") + 1}`;
  if (!m.refLabels && m.type !== "point" && m.points && m.points.length >= 1 && m.points.every(p => p.x > -9000)) {
    const refs = m.points.map(p => {
      for (const src of markups)
        if (src.type === "point" && src.label && src.points?.length && src.visible !== false && Math.abs(src.points[0].x - p.x) < 3 && Math.abs(src.points[0].y - p.y) < 3)
          return src.label;
      return null;
    });
    if (refs.every(l => l)) m.refLabels = refs;
  }
  return m;
}
