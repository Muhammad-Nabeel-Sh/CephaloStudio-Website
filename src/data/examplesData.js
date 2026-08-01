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
