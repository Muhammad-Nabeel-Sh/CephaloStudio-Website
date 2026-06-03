// ═══════════════════════════════════════════════════════════════════════════════
// CSV Parser - Converts landmark CSV files to PREDEFINED analysis format
// ═══════════════════════════════════════════════════════════════════════════════

const COLOR_PALETTE = [
  "#f59e0b", "#60a5fa", "#34d399", "#a78bfa",
  "#fb923c", "#f472b6", "#c084fc", "#22d3ee",
  "#f97316", "#06b6d4", "#84cc16", "#e879f9",
];

const MEASUREMENT_COLORS = [
  "#f59e0b", "#60a5fa", "#34d399", "#a78bfa",
  "#fb923c", "#f472b6", "#c084fc", "#22d3ee",
];

const TYPE_MAP = {
  "Point": "point",
  "Line": "line",
  "Plane": "line",
  "Distance": "line",
  "Angle": "angle3",
  "Angle 4-pt": "angle4",
  "Perp": "perp",
  "Polygon": "polygon",
  "Ratio": "ratio",
  "Sum": "sum",
};

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

function parseRefs(refsStr) {
  if (!refsStr) return [];
  return refsStr.split(",").map(s => s.trim()).filter(Boolean);
}

function extractShortLabel(label) {
  const dashSpace = label.indexOf(" - ");
  if (dashSpace !== -1) return label.slice(0, dashSpace).trim();
  const dash = label.indexOf("-");
  if (dash !== -1) return label.slice(0, dash).trim();
  const paren = label.match(/\(([^)]+)\)\s*$/);
  if (paren) return paren[1].trim();
  return label;
}

function parseNum(val) {
  if (!val) return undefined;
  const n = parseFloat(val);
  return isFinite(n) ? n : undefined;
}

export function parseAnalysisCsv(csvText) {
  const lines = csvText.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvRow(lines[0]);
  const analysisIdx = headers.indexOf("Analysis");
  const typeIdx = headers.indexOf("Markup type");
  const landmarkIdx = headers.indexOf("Landmark");
  const definitionIdx = headers.indexOf("Definition");
  const refsIdx = headers.indexOf("Refs");
  const normMeanIdx = headers.indexOf("Norm mean");
  const normSdIdx = headers.indexOf("Norm SD");

  if (analysisIdx === -1 || typeIdx === -1 || landmarkIdx === -1) return [];

  const analyses = {};
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvRow(lines[i]);
    const analysisName = row[analysisIdx]?.trim();
    const type = row[typeIdx]?.trim();
    const label = row[landmarkIdx]?.trim();
    const def = row[definitionIdx]?.trim();
    const refsStr = refsIdx >= 0 ? (row[refsIdx]?.trim() || "") : "";
    const normMean = normMeanIdx >= 0 ? parseNum(row[normMeanIdx]) : undefined;
    const normSd = normSdIdx >= 0 ? parseNum(row[normSdIdx]) : undefined;

    if (!analysisName || !label) continue;

    if (!analyses[analysisName]) {
      analyses[analysisName] = { name: analysisName, pts: [], measurements: [] };
    }

    if (type === "Point") {
      const shortLabel = extractShortLabel(label);
      analyses[analysisName].pts.push({
        l: shortLabel,
        def: def || "",
        color: COLOR_PALETTE[analyses[analysisName].pts.length % COLOR_PALETTE.length],
      });
    } else {
      const mappedType = TYPE_MAP[type];
      if (!mappedType) continue;
      const refs = parseRefs(refsStr);
      analyses[analysisName].measurements.push({
        type: mappedType,
        l: label,
        def: def || "",
        pts: refs,
        color: MEASUREMENT_COLORS[analyses[analysisName].measurements.length % MEASUREMENT_COLORS.length],
        norm: (normMean !== undefined && normSd !== undefined)
          ? { mean: normMean, sd: normSd }
          : undefined,
      });
    }
  }

  return Object.values(analyses);
}
