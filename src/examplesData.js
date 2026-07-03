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

export const EXAMPLE_LIST = [];
Object.keys(parsed).forEach(name => {
  const data = parsed[name];
  const ptCount = data?.markups?.filter(m => m.type === "point").length || 0;
  const total = data?.markups?.length || 0;
  EXAMPLE_LIST.push({
    id: name,
    label: name === "Landmarks" ? "Example 1" : name,
    subtitle: total > 1 ? `${data?.markups?.[0]?.label || "Template"} + ${ptCount} landmarks` : `${ptCount} landmarks`,
    badge: `${total} items`,
  });
});
