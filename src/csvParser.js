// ═══════════════════════════════════════════════════════════════════════════════
// CSV Parser - Converts landmark CSV files to PREDEFINED analysis format
// ═══════════════════════════════════════════════════════════════════════════════

const COLOR_PALETTE = [
  "#f59e0b", "#60a5fa", "#34d399", "#a78bfa",
  "#fb923c", "#f472b6", "#c084fc", "#22d3ee",
  "#f97316", "#06b6d4", "#84cc16", "#e879f9",
];

function trimRow(row) {
  return row.map(v => v.trim());
}

function parseCsvRow(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return trimRow(result);
}

export function parseAnalysisCsv(csvText) {
  const lines = csvText.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvRow(lines[0]);
  const analysisIdx = headers.indexOf("Analysis");
  const typeIdx = headers.indexOf("Markup type");
  const landmarkIdx = headers.indexOf("Landmark");
  const definitionIdx = headers.indexOf("Definition");

  if (analysisIdx === -1 || typeIdx === -1 || landmarkIdx === -1) return [];

  const analyses = {};
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvRow(lines[i]);
    const analysisName = row[analysisIdx]?.trim();
    const type = row[typeIdx]?.trim();
    const label = row[landmarkIdx]?.trim();
    const def = row[definitionIdx]?.trim();

    if (!analysisName || !label) continue;

    if (!analyses[analysisName]) {
      analyses[analysisName] = { name: analysisName, pts: [] };
    }

    if (type === "Point") {
      const shortLabel = label.split(" - ")[0].trim();
      analyses[analysisName].pts.push({
        l: shortLabel,
        def: def || "",
        color: COLOR_PALETTE[analyses[analysisName].pts.length % COLOR_PALETTE.length],
      });
    }
  }

  return Object.values(analyses);
}
