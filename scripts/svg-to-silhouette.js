/**
 * SVG Path → Silhouette Converter
 * Parses an SVG <path> d-attribute and outputs normalized [{x,y}] arrays
 * suitable for pasting into src/silhouettes.js
 *
 * Usage: node scripts/svg-to-silhouette.js < input.svg
 *   or:  node scripts/svg-to-silhouette.js path-data.txt
 */

import * as fs from "fs";
import * as path from "path";

// ── SVG path command tokeniser ──────────────────────────────────────────────
function tokenise(d) {
  const tokens = [];
  const re = /([mlcqasztMLCQASZT])\s*|([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*/g;
  let m;
  let lastCmd = null;
  while ((m = re.exec(d)) !== null) {
    if (m[1]) {
      lastCmd = m[1];
      tokens.push({ type: "cmd", value: m[1] });
    } else if (m[2]) {
      tokens.push({ type: "num", value: parseFloat(m[2]) });
    }
  }
  return tokens;
}

// ── Coordinate reader helper ───────────────────────────────────────────────
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

// ── Cubic bezier sampling ─────────────────────────────────────────────────
function sampleCubic(p0, p1, p2, p3, numSamples = 10) {
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

// ── Convert relative → absolute & extract endpoints ────────────────────────
function parsePath(d) {
  const tokens = tokenise(d);
  const subPaths = []; // array of sub-paths, each sub-path is [{x,y},...]
  let currentPoints = null;
  let cx = 0, cy = 0;          // current position (absolute)
  let subStartX = 0, subStartY = 0;
  let prevCtrl2 = null;         // last control point 2 (for smooth curve reflection)
  let i = 0;

  while (i < tokens.length) {
    if (tokens[i]?.type === "cmd") {
      const cmd = tokens[i].value;
      const lower = cmd.toLowerCase();
      i++;

      if (cmd === "z" || cmd === "Z") {
        if (currentPoints) {
          // Close path: add point back to sub-path start
          currentPoints.push({ x: subStartX, y: subStartY });
          cx = subStartX; cy = subStartY;
        }
        continue;
      }

      if (lower === "m") {
        // Move – start new sub-path
        if (currentPoints) subPaths.push(currentPoints);
        const xy = readCoord(tokens, i);
        if (!xy) break;
        if (cmd === "M") { cx = xy.x; cy = xy.y; }
        else { cx += xy.x; cy += xy.y; }
        subStartX = cx; subStartY = cy;
        currentPoints = [{ x: cx, y: cy }];
        prevCtrl2 = null;
        i = xy.next;

        // Implicit lineto after moveto
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
        // Line to
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
        // Cubic bezier – sample curve for smoothness
        while (true) {
          const result = readCoords(tokens, i, 3);
          if (!result) break;
          const [r1, r2, r3] = result.pts;
          const c1 = cmd === "C" ? r1 : { x: cx + r1.x, y: cy + r1.y };
          const c2 = cmd === "C" ? r2 : { x: cx + r2.x, y: cy + r2.y };
          const end = cmd === "C" ? r3 : { x: cx + r3.x, y: cy + r3.y };
          const p0 = { x: cx, y: cy };
          const samples = sampleCubic(p0, c1, c2, end, 10);
          for (let s = 1; s < samples.length; s++) {
            currentPoints.push(samples[s]);
          }
          cx = end.x; cy = end.y;
          prevCtrl2 = c2;
          i = result.next;
        }
        continue;
      }

      if (lower === "s") {
        // Smooth cubic bezier – sample curve for smoothness
        while (true) {
          const result = readCoords(tokens, i, 2);
          if (!result) break;
          const [r1, r2] = result.pts;
          const c2 = cmd === "S" ? r1 : { x: cx + r1.x, y: cy + r1.y };
          const end = cmd === "S" ? r2 : { x: cx + r2.x, y: cy + r2.y };
          // Reflect previous control point 2 around current position
          const c1 = prevCtrl2
            ? { x: 2 * cx - prevCtrl2.x, y: 2 * cy - prevCtrl2.y }
            : { x: cx, y: cy };
          const p0 = { x: cx, y: cy };
          const samples = sampleCubic(p0, c1, c2, end, 10);
          for (let s = 1; s < samples.length; s++) {
            currentPoints.push(samples[s]);
          }
          cx = end.x; cy = end.y;
          prevCtrl2 = c2;
          i = result.next;
        }
        continue;
      }

      if (lower === "q") {
        // Quadratic bezier – use endpoint
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
        // Smooth quadratic – use endpoint
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
        // Arc – use endpoint
        while (true) {
          // rx ry x-axis-rotation large-arc sweep x y
          const rx = tokens[i]?.value; i++;
          const ry = tokens[i]?.value; i++;
          const rot = tokens[i]?.value; i++;
          const laf = tokens[i]?.value; i++;
          const sf = tokens[i]?.value; i++;
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

      // Skip unknown commands
      continue;
    } else {
      i++; // Skip stray numbers
    }
  }

  if (currentPoints) subPaths.push(currentPoints);
  return subPaths;
}

// ── Normalise to [-0.5, 0.5] ──────────────────────────────────────────────
function normalise(subPaths, tx = 0, ty = 0) {
  // Apply transform offset then find bounding box
  let allPoints = [];
  for (const sp of subPaths) {
    for (const p of sp) {
      const px = p.x + tx;
      const py = p.y + ty;
      allPoints.push({ x: px, y: py });
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
      const px = p.x + tx;
      const py = p.y + ty;
      pts.push({
        x: (px - cx) / range,
        y: (py - cy) / range,
      });
    }
    result.push(pts);
  }
  return result;
}

// ── Remove consecutive duplicate points ────────────────────────────────────
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

// ── Format as JavaScript ───────────────────────────────────────────────────
function formatJS(normalised) {
  let out = "paths: [\n";
  for (const pts of normalised) {
    out += "      { closed: true, points: [\n";
    for (const p of pts) {
      out += `        { x: ${p.x.toFixed(5)}, y: ${p.y.toFixed(5)} },\n`;
    }
    out += "      ]},\n";
  }
  out += "    ],\n";
  return out;
}

// ── Main ──────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  let input = "";

  if (args.length > 0) {
    input = fs.readFileSync(args[0], "utf-8");
  } else {
    console.error("Usage: node svg-to-silhouette.js <path.svg>");
    process.exit(1);
  }

  // Extract d attribute from SVG <path> element, or use raw path data
  let d;
  const pathD = input.match(/<path[^>]*\sd="([^"]+)"/);
  if (pathD) {
    d = pathD[1];
  } else {
    // Fallback: try any d="..." attribute
    const anyD = input.match(/\sd="([^"]+)"/);
    if (anyD) d = anyD[1];
    else d = input.trim();
  }

  if (!d) {
    console.error("No path data found.");
    process.exit(1);
  }

  // Extract transform
  let tx = 0, ty = 0;
  const tMatch = input.match(/transform="translate\(([^,]+),([^)]+)\)"/);
  if (tMatch) {
    tx = parseFloat(tMatch[1]) || 0;
    ty = parseFloat(tMatch[2]) || 0;
  }

  console.error(`Points in d attribute: ${d.split(/[mlcqasztMLCQASZT]/).length} approx`);
  console.error(`Transform: translate(${tx}, ${ty})`);

  const raw = parsePath(d);
  console.error(`Sub-paths found: ${raw.length}`);

  const allPts = raw.reduce((sum, sp) => sum + sp.length, 0);
  console.error(`Total raw points: ${allPts}`);

  // Normalise
  const norm = normalise(raw, -tx, -ty);
  console.error(`Normalised.`);

  // Dedupe & simplify each sub-path
  const filtered = [];
  for (let i = 0; i < norm.length; i++) {
    norm[i] = dedupe(norm[i]);
    const before = norm[i].length;
    // Filter out sub-paths with fewer than 4 meaningful points
    if (norm[i].length >= 4) {
      filtered.push(norm[i]);
    }
    console.error(`Sub-path ${i}: ${before} → ${norm[i].length} points after dedupe`);
  }

  console.error(`Filtered from ${norm.length} to ${filtered.length} sub-paths (removed <4 pt paths)`);
  console.log(formatJS(filtered));
}

main();
