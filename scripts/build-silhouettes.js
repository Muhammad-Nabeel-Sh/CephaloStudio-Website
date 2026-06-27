/**
 * Build silhouettes.js from SVG files in the Silhouettes/ directory.
 * Usage: node scripts/build-silhouettes.js
 */

import * as fs from "fs";
import * as path from "path";

// ── SVG path command tokeniser ──────────────────────────────────────────────
function tokenise(d) {
  const tokens = [];
  const re = /([mlcqasztMLCQASZT])\s*|([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*/g;
  let m;
  while ((m = re.exec(d)) !== null) {
    if (m[1]) tokens.push({ type: "cmd", value: m[1] });
    else if (m[2]) tokens.push({ type: "num", value: parseFloat(m[2]) });
  }
  return tokens;
}

function readCoord(tokens, i) {
  if (tokens[i]?.type !== "num" || tokens[i+1]?.type !== "num") return null;
  return { x: tokens[i].value, y: tokens[i+1].value, next: i + 2 };
}

function readCoords(tokens, i, count) {
  const pts = [];
  let idx = i;
  for (let k = 0; k < count; k++) {
    const xy = readCoord(tokens, idx);
    if (!xy) return null;
    pts.push({ x: xy.x, y: xy.y });
    idx = xy.next;
  }
  return { pts, next: idx };
}

function sampleCubic(p0, p1, p2, p3, numSamples = 1) {
  const pts = [];
  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    const t1 = 1 - t;
    const x = t1 * t1 * t1 * p0.x + 3 * t1 * t1 * t * p1.x + 3 * t1 * t * t * p2.x + t * t * t * p3.x;
    const y = t1 * t1 * t1 * p0.y + 3 * t1 * t1 * t * p1.y + 3 * t1 * t * t * p2.y + t * t * t * p3.y;
    pts.push({ x, y });
  }
  return pts;
}

function parsePath(d) {
  const tokens = tokenise(d);
  const subPaths = [];
  let currentPoints = null;
  let cx = 0, cy = 0;
  let subStartX = 0, subStartY = 0;
  let prevCtrl2 = null;
  let i = 0;

  while (i < tokens.length) {
    if (tokens[i]?.type === "cmd") {
      const cmd = tokens[i].value;
      const lower = cmd.toLowerCase();
      i++;

      if (cmd === "z" || cmd === "Z") {
        if (currentPoints) {
          currentPoints.push({ x: subStartX, y: subStartY });
          cx = subStartX; cy = subStartY;
        }
        continue;
      }

      if (lower === "m") {
        if (currentPoints) subPaths.push(currentPoints);
        const xy = readCoord(tokens, i);
        if (!xy) break;
        if (cmd === "M") { cx = xy.x; cy = xy.y; }
        else { cx += xy.x; cy += xy.y; }
        subStartX = cx; subStartY = cy;
        currentPoints = [{ x: cx, y: cy }];
        prevCtrl2 = null;
        i = xy.next;

        while (true) {
          const xy2 = readCoord(tokens, i);
          if (!xy2) break;
          if (cmd === "M") { cx = xy2.x; cy = xy2.y; }
          else { cx += xy2.x; cy += xy2.y; }
          currentPoints.push({ x: cx, y: cy });
          i = xy2.next;
        }
        continue;
      }

      if (lower === "l") {
        while (true) {
          const xy = readCoord(tokens, i);
          if (!xy) break;
          if (cmd === "L") { cx = xy.x; cy = xy.y; }
          else { cx += xy.x; cy += xy.y; }
          currentPoints.push({ x: cx, y: cy });
          i = xy.next;
        }
        continue;
      }

      if (lower === "c") {
        while (true) {
          const result = readCoords(tokens, i, 3);
          if (!result) break;
          const [r1, r2, r3] = result.pts;
          const c1 = cmd === "C" ? r1 : { x: cx + r1.x, y: cy + r1.y };
          const c2 = cmd === "C" ? r2 : { x: cx + r2.x, y: cy + r2.y };
          const end = cmd === "C" ? r3 : { x: cx + r3.x, y: cy + r3.y };
          const p0 = { x: cx, y: cy };
          const samples = sampleCubic(p0, c1, c2, end, 1);
          for (let s = 1; s < samples.length; s++) currentPoints.push(samples[s]);
          cx = end.x; cy = end.y;
          prevCtrl2 = c2;
          i = result.next;
        }
        continue;
      }

      if (lower === "s") {
        while (true) {
          const result = readCoords(tokens, i, 2);
          if (!result) break;
          const [r1, r2] = result.pts;
          const c2 = cmd === "S" ? r1 : { x: cx + r1.x, y: cy + r1.y };
          const end = cmd === "S" ? r2 : { x: cx + r2.x, y: cy + r2.y };
          const c1 = prevCtrl2
            ? { x: 2 * cx - prevCtrl2.x, y: 2 * cy - prevCtrl2.y }
            : { x: cx, y: cy };
          const p0 = { x: cx, y: cy };
          const samples = sampleCubic(p0, c1, c2, end, 1);
          for (let s = 1; s < samples.length; s++) currentPoints.push(samples[s]);
          cx = end.x; cy = end.y;
          prevCtrl2 = c2;
          i = result.next;
        }
        continue;
      }

      if (lower === "q") {
        while (true) {
          const result = readCoords(tokens, i, 2);
          if (!result) break;
          const [, end] = result.pts;
          if (cmd === "Q") { cx = end.x; cy = end.y; }
          else { cx += end.x; cy += end.y; }
          currentPoints.push({ x: cx, y: cy });
          i = result.next;
        }
        continue;
      }

      if (lower === "t") {
        while (true) {
          const xy = readCoord(tokens, i);
          if (!xy) break;
          if (cmd === "T") { cx = xy.x; cy = xy.y; }
          else { cx += xy.x; cy += xy.y; }
          currentPoints.push({ x: cx, y: cy });
          i = xy.next;
        }
        continue;
      }

      if (lower === "a") {
        while (true) {
          const rx = tokens[i]?.value; i++;
          const _ry = tokens[i]?.value; i++;
          const _rot = tokens[i]?.value; i++;
          const _laf = tokens[i]?.value; i++;
          const _sf = tokens[i]?.value; i++;
          const xy = readCoord(tokens, i);
          if (xy === null || rx === undefined) break;
          const ex = cmd === "A" ? xy.x : cx + xy.x;
          const ey = cmd === "A" ? xy.y : cy + xy.y;
          cx = ex; cy = ey;
          currentPoints.push({ x: cx, y: cy });
          i = xy.next;
        }
        continue;
      }

      continue;
    } else {
      i++;
    }
  }

  if (currentPoints) subPaths.push(currentPoints);
  return subPaths;
}

function normalise(subPaths, tx = 0, ty = 0) {
  let allPoints = [];
  for (const sp of subPaths) {
    for (const p of sp) {
      allPoints.push({ x: p.x + tx, y: p.y + ty });
    }
  }

  if (allPoints.length === 0) return [];

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const p of allPoints) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const range = Math.max(maxX - minX, maxY - minY);
  if (range === 0) return [];

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const result = [];
  for (const sp of subPaths) {
    const pts = [];
    for (const p of sp) {
      pts.push({
        x: (p.x + tx - cx) / range,
        y: (p.y + ty - cy) / range,
      });
    }
    result.push(pts);
  }
  return result;
}

function dedupe(pts) {
  if (pts.length < 2) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = out[out.length - 1];
    const curr = pts[i];
    if (Math.abs(curr.x - prev.x) > 1e-10 || Math.abs(curr.y - prev.y) > 1e-10) {
      out.push(curr);
    }
  }
  return out;
}

// ── Ramer-Douglas-Peucker line simplification ──────────────────────────────
function perpendicularDist(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / len;
}

function simplifyRDP(points, epsilon) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDist(points[i], first, last);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > epsilon) {
    const left = simplifyRDP(points.slice(0, maxIdx + 1), epsilon);
    const right = simplifyRDP(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

function processSVG(filePath) {
  const input = fs.readFileSync(filePath, "utf-8");

  let d;
  const pathD = input.match(/<path[^>]*\sd="([^"]+)"/);
  if (pathD) d = pathD[1];
  else {
    const anyD = input.match(/\sd="([^"]+)"/);
    if (anyD) d = anyD[1];
    else d = input.trim();
  }

  if (!d) return null;

  let tx = 0, ty = 0;
  const tMatch = input.match(/transform="translate\(([^,]+),([^)]+)\)"/);
  if (tMatch) {
    tx = parseFloat(tMatch[1]) || 0;
    ty = parseFloat(tMatch[2]) || 0;
  }

  const raw = parsePath(d);
  const norm = normalise(raw, -tx, -ty);

  const filtered = [];
  for (let i = 0; i < norm.length; i++) {
    const pts = dedupe(norm[i]);
    if (pts.length >= 4) filtered.push(pts);
  }

  return filtered;
}

function formatPathsJS(normalised) {
  let out = "paths: [\n";
  for (let pi = 0; pi < normalised.length; pi++) {
    const pts = normalised[pi];
    const isClosed = (pts.length > 2 &&
      Math.abs(pts[0].x - pts[pts.length - 1].x) < 1e-6 &&
      Math.abs(pts[0].y - pts[pts.length - 1].y) < 1e-6);
    const ptsOut = pts.map(p => `        { x: ${p.x.toFixed(5)}, y: ${p.y.toFixed(5)} }`).join(",\n");
    out += `      { closed: ${isClosed}, points: [\n${ptsOut},\n      ]}` +
      (pi < normalised.length - 1 ? ",\n" : "\n");
  }
  out += "    ],\n";
  return out;
}

// ── File mapping: filename → silhouette definition ──────────────────────────
const FILE_MAP = {
  "Atlas C1.svg":                 { key: "atlasC1",               name: "Atlas C1",                     category: "Spine",        color: "#60a5fa" },
  "C2.svg":                       { key: "c2",                    name: "C2 (Axis)",                    category: "Spine",        color: "#60a5fa" },
  "C3.svg":                       { key: "c3",                    name: "C3",                           category: "Spine",        color: "#60a5fa" },
  "C4.svg":                       { key: "c4",                    name: "C4",                           category: "Spine",        color: "#60a5fa" },
  "External Auditory Meatus.svg": { key: "externalAuditoryMeatus", name: "External Auditory Meatus",     category: "Craniofacial", color: "#f59e0b" },
  "Frontal and Nasal Bones.svg":  { key: "frontalAndNasalBones",  name: "Frontal and Nasal Bones",       category: "Craniofacial", color: "#f59e0b" },
  "Frontal Sinus.svg":            { key: "frontalSinus",          name: "Frontal Sinus",                 category: "Craniofacial", color: "#f59e0b" },
  "Hyoid Bone.svg":               { key: "hyoidBone",             name: "Hyoid Bone",                    category: "Soft Tissue",  color: "#fb923c" },
  "Inner Mandibular Border.svg":  { key: "innerMandibularBorder", name: "Inner Mandibular Border",       category: "Mandible",     color: "#a78bfa" },
  "Key Ridge.svg":                { key: "keyRidge",              name: "Key Ridge",                     category: "Craniofacial", color: "#f59e0b" },
  "Mandibular Central.svg":       { key: "mandibularCentral",     name: "Mandibular Central",            category: "Teeth",        color: "#f472b6" },
  "Mandibular Molar.svg":         { key: "mandibularMolar",       name: "Mandibular Molar",              category: "Teeth",        color: "#f472b6" },
  "Mandibular Border.svg":        { key: "mandibularBorder",      name: "Mandibular Border",             category: "Mandible",     color: "#a78bfa" },
  "Maxillary Bone.svg":           { key: "maxillaryBone",         name: "Maxillary Bone",                category: "Craniofacial", color: "#f59e0b" },
  "Maxillary Central.svg":        { key: "maxillaryCentral",      name: "Maxillary Central",             category: "Teeth",        color: "#4ade80" },
  "Maxillary Molar.svg":          { key: "maxillaryMolar",        name: "Maxillary Molar",               category: "Teeth",        color: "#4ade80" },
  "Occipital bone.svg":           { key: "occipitalBone",         name: "Occipital Bone",                category: "Craniofacial", color: "#f59e0b" },
  "Orbital Rim.svg":              { key: "orbitalRim",            name: "Orbital Rim",                   category: "Craniofacial", color: "#f59e0b" },
  "Pterygomaxillary Suture.svg":  { key: "pterygomaxillarySuture", name: "Pterygomaxillary Suture",      category: "Craniofacial", color: "#38bdf8" },
  "Soft Tissue Profile.svg":      { key: "softTissueProfile",     name: "Soft Tissue Profile",           category: "Craniofacial", color: "#f59e0b" },
};

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
  const silhouetteDir = path.resolve("Silhouettes");

  const entries = [];

  for (const [filename, def] of Object.entries(FILE_MAP)) {
    const filePath = path.join(silhouetteDir, filename);
    if (!fs.existsSync(filePath)) {
      console.error(`Warning: ${filename} not found, skipping`);
      continue;
    }

    const paths = processSVG(filePath);
    if (!paths || paths.length === 0) {
      console.error(`Warning: ${filename} produced no valid paths, skipping`);
      continue;
    }

    entries.push({ ...def, paths });
    console.error(`${filename}: ${paths.length} sub-paths, ${paths.reduce((s, p) => s + p.length, 0)} points`);
  }

  // ── Build the output file ───────────────────────────────────────────────
  let output = `// ═══════════════════════════════════════════════════════════════════════════════
// SILHOUETTES – Auto-generated from SVG files in Silhouettes/
// DO NOT EDIT MANUALLY – run \`node scripts/build-silhouettes.js\` to regenerate
// ═══════════════════════════════════════════════════════════════════════════════

export const SILHOUETTES = {

  // ───────────────────────────────────────────────────────────────────────────
  // SELLA & CRANIAL BASE (hand-traced reference)
  // ───────────────────────────────────────────────────────────────────────────
  sellaAndCranialBase: {
    name: "Sella & Cranial Base",
    category: "Craniofacial",
    color: "#60a5fa",
    paths: [
      { closed: false, points: [
        { x: 0.50000, y: -0.34366 },
        { x: 0.43947, y: -0.34022 },
        { x: 0.32440, y: -0.28808 },
        { x: 0.18824, y: -0.26578 },
        { x: 0.06435, y: -0.22476 },
        { x: -0.08822, y: -0.18838 },
        { x: -0.11676, y: -0.16603 },
        { x: -0.11568, y: -0.11696 },
        { x: -0.12262, y: -0.09678 },
        { x: -0.14414, y: -0.07496 },
        { x: -0.17066, y: -0.06148 },
        { x: -0.19977, y: -0.06179 },
        { x: -0.22088, y: -0.07793 },
        { x: -0.22205, y: -0.09867 },
        { x: -0.19036, y: -0.14005 },
        { x: -0.19842, y: -0.15260 },
        { x: -0.21690, y: -0.14818 },
        { x: -0.30956, y: -0.01863 },
        { x: -0.48918, y: 0.28289 },
        { x: -0.49889, y: 0.33000 },
        { x: -0.48969, y: 0.34148 },
        { x: -0.47149, y: 0.34255 },
        { x: -0.34798, y: 0.25587 },
        { x: -0.25754, y: 0.20309 },
        { x: -0.17903, y: 0.17139 },
        { x: -0.01606, y: 0.12807 },
        { x: 0.03704, y: 0.10038 },
        { x: 0.08106, y: 0.06495 },
        { x: 0.13187, y: 0.01161 },
        { x: 0.16101, y: -0.05064 },
        { x: 0.17596, y: -0.14467 },
        { x: 0.17701, y: -0.22815 },
        { x: 0.18618, y: -0.26577 },
      ]},
    ],
  },

`;

  // Add auto-generated entries
  for (let ei = 0; ei < entries.length; ei++) {
    const e = entries[ei];
    const pathsJS = formatPathsJS(e.paths);
    output += `  // ───────────────────────────────────────────────────────────────────────────\n`;
    output += `  // ${e.name}\n`;
    output += `  // ───────────────────────────────────────────────────────────────────────────\n`;
    output += `  ${e.key}: {\n`;
    output += `    name: "${e.name}",\n`;
    output += `    category: "${e.category}",\n`;
    output += `    color: "${e.color}",\n`;
    output += `    ${pathsJS}`;
    output += `  }${ei < entries.length - 1 ? "," : ""}\n\n`;
  }

  output += `};\n\n`;

  // Categories
  const cats = [...new Set(entries.map(e => e.category))];
  const catColors = {
    "Craniofacial": "#f59e0b",
    "Mandible": "#a78bfa",
    "Teeth": "#4ade80",
    "Soft Tissue": "#fb923c",
    "Spine": "#60a5fa",
  };

  output += `// ─────────────────────────────────────────────────────────────────────────────\n`;
  output += `export const SILHOUETTE_CATEGORIES = [\n`;
  for (const cat of cats) {
    output += `  { id: "${cat}", color: "${catColors[cat] || "#888888"}" },\n`;
  }
  output += `];\n\n`;

  output += `export function getSilhouettesByCategory() {\n`;
  output += `  const grouped = {};\n`;
  output += `  Object.entries(SILHOUETTES).forEach(([key, s]) => {\n`;
  output += `    const cat = s.category || "Other";\n`;
  output += `    if (!grouped[cat]) grouped[cat] = [];\n`;
  output += `    grouped[cat].push({ key, ...s });\n`;
  output += `  });\n`;
  output += `  return grouped;\n`;
  output += `}\n`;

  const outPath = path.resolve("src/silhouettes.js");
  fs.writeFileSync(outPath, output, "utf-8");
  console.error(`\nWritten to ${outPath}`);
  console.error(`Total silhouettes: ${entries.length} (auto-generated) + 1 (sellaAndCranialBase)`);
}

main();
