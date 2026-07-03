/* eslint-disable react-refresh/only-export-components */

// ─── Safe Number Guard ─────────────────────────────────────────────────────────
export function safeNum(v, fallback = 0) {
  return (v != null && isFinite(v)) ? v : fallback;
}

// ─── Safe Range (prevents zero-divide in scale functions) ─────────────────────
export function safeRange(min, max) {
  const span = max - min;
  return (span !== 0 && isFinite(span)) ? span : 1;
}



// ─── Type Scale ──────────────────────────────────────────────────────────────
export const FONT = {
  xs: 9,
  sm: 10,
  md: 11,
  lg: 12,
  xl: 14,
  title: 13,
  tick: 9,
  annotation: 10,
};

export const FONT_STACK = "'DM Sans','DM Mono',monospace";

// ─── Color Palette (Okabe-Ito inspired, colorblind-friendly) ─────────────────
export const PALETTE = [
  "#0072B2", "#D55E00", "#009E73", "#CC79A7",
  "#F0E442", "#56B4E9", "#E69F00", "#000000",
];

// ─── Chart Card Wrapper ──────────────────────────────────────────────────────
export function ChartCard({ title, children, t, pad = "8px" }) {
  return (
    <div style={{ padding: typeof pad === "string" ? pad : `${pad}px`, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: FONT.title, fontWeight: 700, color: t.tx, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

// ─── Label Wrapper (multi-line ellipsis-free) ────────────────────────────────
export function wrapLabel(label, maxLen = 16) {
  if (!label || label.length <= maxLen) return [label || ""];
  const words = label.split(/\s+/);
  if (words.length > 1) {
    const lines = [];
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length <= maxLen) {
        cur = (cur + " " + w).trim();
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.length > 1 ? lines : [label.slice(0, maxLen - 1) + "\u2026"];
  }
  const lines = [];
  for (let i = 0; i < label.length; i += maxLen) {
    lines.push(label.slice(i, i + maxLen));
  }
  return lines;
}

// ─── SVG Label (multi-line text) ─────────────────────────────────────────────
export function SvgLabel({ x, y, lines, fill, fontSize = FONT.sm, textAnchor = "end", fontWeight, style = {} }) {
  if (!Array.isArray(lines)) lines = [lines];
  return (
    <text x={x} y={y} fill={fill} fontSize={fontSize} textAnchor={textAnchor} fontWeight={fontWeight}
      style={{ fontFamily: FONT_STACK, ...style }}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : fontSize + 1}>{line}</tspan>
      ))}
    </text>
  );
}

// ─── Axis Grid + Tick Labels (horizontal) ────────────────────────────────────
export function HGrid({ ticks, yMin, yMax, xS, pad, W, H, t, fmt, label = "" }) {
  return (
    <g>
      {ticks.map(v => {
        const x = safeNum(xS(v));
        if (!isFinite(x) || x < pad.left || x > W - pad.right) return null;
        return (
          <g key={v}>
            <line x1={x} y1={yMin} x2={x} y2={yMax} stroke={t.bdr} strokeWidth={0.5} strokeDasharray="3,3" />
            <text x={x} y={yMin - 5} fill={t.tx3} fontSize={FONT.tick} textAnchor="middle" fontFamily={FONT_STACK}>
              {fmt ? fmt(v) : v.toFixed(2)}
            </text>
          </g>
        );
      })}
      {label && (
        <text x={(yMin + yMax) / 2} y={H - pad.bottom + 4} fill={t.tx3} fontSize={FONT.sm} textAnchor="middle" fontFamily={FONT_STACK}>
          {label}
        </text>
      )}
    </g>
  );
}

// ─── Axis Grid + Tick Labels (vertical) ──────────────────────────────────────
export function VGrid({ ticks, xMin, xMax, yS, pad, H, t, fmt, label = "" }) {
  return (
    <g>
      {ticks.map(v => {
        const y = safeNum(yS(v));
        if (!isFinite(y) || y < pad.top || y > H - pad.bottom) return null;
        return (
          <g key={v}>
            <line x1={xMin} y1={y} x2={xMax} y2={y} stroke={t.bdr} strokeWidth={0.5} strokeDasharray="3,3" />
            <text x={xMin - 5} y={y + 3} fill={t.tx3} fontSize={FONT.tick} textAnchor="end" fontFamily={FONT_STACK}>
              {fmt ? fmt(v) : v.toFixed(2)}
            </text>
          </g>
        );
      })}
      {label && (
        <text x={4} y={(xMin + xMax) / 2} fill={t.tx3} fontSize={FONT.sm} textAnchor="middle"
          transform={`rotate(-90,4,${(xMin + xMax) / 2})`} fontFamily={FONT_STACK}>
          {label}
        </text>
      )}
    </g>
  );
}

// ─── X Axis Title ────────────────────────────────────────────────────────────
export function XAxisTitle({ x, y, label, t }) {
  return (
    <text x={x} y={y} fill={t.tx3} fontSize={FONT.sm} textAnchor="middle" fontFamily={FONT_STACK}>
      {label}
    </text>
  );
}

// ─── Y Axis Title (rotated) ──────────────────────────────────────────────────
export function YAxisTitle({ x, y, label, t }) {
  return (
    <text x={x} y={y} fill={t.tx3} fontSize={FONT.sm} textAnchor="middle"
      transform={`rotate(-90,${x},${y})`} fontFamily={FONT_STACK}>
      {label}
    </text>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
export function ChartLegend({ items, x, y, t, direction = "vertical", fontSize = FONT.xs }) {
  const gap = fontSize + 8;
  return (
    <g>
      {items.map((item, i) => {
        const dx = direction === "horizontal" ? i * 120 : 0;
        const dy = direction === "vertical" ? i * gap : 0;
        return (
          <g key={i} transform={`translate(${dx},${dy})`}>
            <rect x={x} y={y + i * gap - 5} width={10} height={10} fill={item.color} rx={2} opacity={0.85} />
            <text x={x + 14} y={y + i * gap + 2} fill={t.tx2} fontSize={fontSize} fontFamily={FONT_STACK}>
              {item.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ─── Reference Line ───────────────────────────────────────────────────────────
export function RefLine({ x1, y1, x2, y2, stroke, dash = "4,3", label, labelPos }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={1} strokeDasharray={dash} />
      {label && labelPos && (
        <text x={labelPos.x} y={labelPos.y} fill={stroke} fontSize={FONT.xs} fontFamily={FONT_STACK}>
          {label}
        </text>
      )}
    </g>
  );
}
