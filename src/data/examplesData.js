const rawFiles = import.meta.glob("/Examples/*.cepht", { query: "?raw", import: "default", eager: true });
const parsed = {};

function parseAll() {
  Object.entries(rawFiles).forEach(([path, raw]) => {
    const name = path.split("/").pop().replace(".cepht", "");
    try {
      parsed[name] = JSON.parse(raw);
    } catch { /* empty */ }
  });
}
parseAll();

export function getExampleData(name) {
  return parsed[name] || null;
}

// Guide-mode step ordering: placed points walked group by group (groups in
// first-appearance order, points within a group in file order).
export function buildGuideSteps(markups) {
  const ms = markups || [];
  const pts = ms.filter(m => m.type === "point" && m.points?.[0] && m.points[0].x > -9000);
  const order = {};
  let gi = 0;
  for (const m of ms) {
    if (m.type === "point" && m.group && !(m.group in order)) order[m.group] = gi++;
  }
  return pts.slice().sort((a, b) => {
    const ga = a.group ? (order[a.group] ?? 99) : 99;
    const gb = b.group ? (order[b.group] ?? 99) : 99;
    if (ga !== gb) return ga - gb;
    return ms.indexOf(a) - ms.indexOf(b);
  });
}

// Build-mode stage ordering (step-by-step tracing overlay).
// A "stage" is an optional per-markup value (number or string). If any markup
// carries one, stages are derived explicitly (option 2): distinct values in
// first-appearance order (pure-numeric values sorted ascending), while markups
// without a `stage` become always-visible context. Otherwise it falls back to
// point-by-point (option 1): placed points are revealed one at a time in guide
// order (group by group, ungrouped last), and non-point markups (the tracing)
// become always-visible context.
// Returns { stages: [{ label, markups }], context, hasExplicit }.
export function buildStages(markups) {
  const ms = markups || [];
  const hasExplicit = ms.some(m => m.stage != null && m.stage !== "");
  if (!hasExplicit) {
    const context = ms.filter(m => m.type !== "point");
    const stages = buildGuideSteps(ms).map(p => ({ label: p.label, markups: [p] }));
    return { stages, context, hasExplicit: false };
  }
  const keys = [];
  for (const m of ms) {
    const k = m.stage;
    if (k == null || k === "") continue;
    if (!keys.includes(k)) keys.push(k);
  }
  if (keys.every(k => typeof k === "number")) keys.sort((a, b) => a - b);
  const stageIndex = new Map(keys.map((k, i) => [k, i]));
  const stages = keys.map(k => ({ label: String(k), markups: [] }));
  const context = [];
  for (const m of ms) {
    const k = m.stage;
    if (k == null || k === "") { context.push(m); continue; }
    stages[stageIndex.get(k)].markups.push(m);
  }
  return { stages: stages.filter(s => s.markups.length > 0), context, hasExplicit: true };
}

export const EXAMPLE_LIST = [];
Object.keys(parsed).forEach(name => {
  const data = parsed[name];
  const ptCount = data?.markups?.filter(m => m.type === "point").length || 0;
  const total = data?.markups?.length || 0;
  EXAMPLE_LIST.push({
    id: name,
    label: data?.name || (name === "Landmarks" ? "Example 1" : name),
    description: data?.description || "",
    author: data?.author || "",
    projection: data?.projection || "",
    analysisName: data?.analysisName || "",
    subtitle: total > 1 ? `${data?.markups?.[0]?.label || "Template"} + ${ptCount} landmarks` : `${ptCount} landmarks`,
    badge: `${total} items`,
    ptCount,
  });
});
