import { useRef, useMemo, useCallback, useState } from "react";
import { normDeviation } from "../utils.js";
import { RULES } from "../interpretation.js";
import PanelGuideModal from "./PanelGuideModal.jsx";

const ROW_H = 40;
const LABEL_W = 220;
const CHART_L = 60;
const CHART_R = 60;
const TOP = 44;
const BOTTOM = 30;
const SD_RANGE = 2.5;

function chartX(sdUnits, cw) {
  const half = cw / 2;
  const pxPerSd = half / SD_RANGE;
  return half + sdUnits * pxPerSd;
}

const CATEGORY_ORDER = ["skeletal", "dental", "soft-tissue", "airway", "other"];
const CATEGORY_LABELS = {
  skeletal: "Skeletal", dental: "Dental", "soft-tissue": "Soft Tissue",
  airway: "Airway", other: "Other",
};

function normCdf(z) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return +(0.5 * (1 + sign * y)).toFixed(1);
}

function measurementCategory(label) {
  const rule = RULES[label];
  return rule && rule.category ? rule.category : "other";
}

function interpretationText(label, value, normMean) {
  try {
    const rule = RULES[label];
    if (rule && rule.interpret) return rule.interpret(value, normMean);
  } catch { return ""; }
  return "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// POLYGON CHART (existing)
// ═══════════════════════════════════════════════════════════════════════════════
function PolygonChart({ rows, t, formatValue, getSeverityColor, totalH, svgRef }) {
  const chartWidth = 700 - LABEL_W - CHART_R - CHART_L;
  const chartAreaX = LABEL_W + CHART_L;
  const clamp = (v) => Math.max(-SD_RANGE, Math.min(SD_RANGE, v));

  return (
    <svg ref={svgRef} viewBox={`0 0 700 ${totalH}`} style={{ maxWidth: "100%", width: 1000, height: totalH, display: "block", overflow: "visible", fontFamily: "'DM Sans','DM Mono',sans-serif", userSelect: "none" }}>
      <rect x="0" y="0" width="700" height={totalH} fill={t.bg} />
      <rect x={LABEL_W} y={TOP} width={700 - LABEL_W - CHART_R} height={rows.length * ROW_H} fill={t.surf} rx="4" />

      <rect x={chartX(-1, chartWidth) + chartAreaX} y={TOP}
        width={chartX(1, chartWidth) - chartX(-1, chartWidth)} height={rows.length * ROW_H} fill={t.ok + "15"} />
      <rect x={chartX(-2, chartWidth) + chartAreaX} y={TOP}
        width={chartX(-1, chartWidth) - chartX(-2, chartWidth)} height={rows.length * ROW_H} fill={t.warn + "12"} />
      <rect x={chartX(1, chartWidth) + chartAreaX} y={TOP}
        width={chartX(2, chartWidth) - chartX(1, chartWidth)} height={rows.length * ROW_H} fill={t.warn + "12"} />
      <rect x={chartX(-SD_RANGE, chartWidth) + chartAreaX} y={TOP}
        width={chartX(-2, chartWidth) - chartX(-SD_RANGE, chartWidth)} height={rows.length * ROW_H} fill={t.err + "10"} />
      <rect x={chartX(2, chartWidth) + chartAreaX} y={TOP}
        width={chartX(SD_RANGE, chartWidth) - chartX(2, chartWidth)} height={rows.length * ROW_H} fill={t.err + "10"} />

      <line x1={chartX(0, chartWidth) + chartAreaX} y1={TOP - 4}
        x2={chartX(0, chartWidth) + chartAreaX} y2={TOP + rows.length * ROW_H + 4}
        stroke={t.tx3} strokeWidth="0.5" strokeDasharray="3,3" />

      {[-2, -1, 0, 1, 2].map(sd => (
        <line key={`tick-${sd}`}
          x1={chartX(sd, chartWidth) + chartAreaX} y1={TOP - 4}
          x2={chartX(sd, chartWidth) + chartAreaX} y2={TOP + rows.length * ROW_H + 4}
          stroke={t.bdr} strokeWidth="0.5" />
      ))}
      {[-2, -1, 0, 1, 2].map(sd => (
        <text key={`xlab-${sd}`}
          x={chartX(sd, chartWidth) + chartAreaX} y={TOP - 12}
          textAnchor="middle" fill={t.tx3} fontSize="10" fontFamily="'DM Mono',monospace">
          {sd === 0 ? "μ" : sd > 0 ? `+${sd}σ` : `${sd}σ`}
        </text>
      ))}

      {rows.map((_, i) => (
        <line key={`div-${i}`} x1={LABEL_W - 4} y1={TOP + i * ROW_H}
          x2={700 - CHART_R + 4} y2={TOP + i * ROW_H}
          stroke={t.bdr} strokeWidth="0.5" opacity="0.4" />
      ))}

      {rows.map((row, i) => {
        const sd = clamp(row.dev.sdUnits);
        const cx = chartX(sd, chartWidth) + chartAreaX;
        const cy = TOP + i * ROW_H + ROW_H / 2;
        return (
          <g key={row.label}>
            <text x={LABEL_W - 8} y={cy + 1} textAnchor="end" dominantBaseline="middle"
              fill={row.color || t.tx} fontSize="11" fontWeight="600" fontFamily="'DM Mono',monospace">
              {row.label}
            </text>
            <circle cx={cx} cy={cy} r="5" fill={getSeverityColor(sd)} stroke="#fff" strokeWidth="1.5" />
            <text x={cx + 10} y={cy + 1} dominantBaseline="middle" fill={getSeverityColor(sd)}
              fontSize="10" fontWeight="700" fontFamily="'DM Mono',monospace">
              {formatValue(row)}
            </text>
          </g>
        );
      })}

      <polyline
        points={rows.map((row, i) => {
          const sd = clamp(row.dev.sdUnits);
          const cx = chartX(sd, chartWidth) + chartAreaX;
          const cy = TOP + i * ROW_H + ROW_H / 2;
          return `${cx},${cy}`;
        }).join(" ")}
        fill="none" stroke={t.acc} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.7"
      />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIGGLE BAR CHART (new — WebCeph / BCeph style)
// ═══════════════════════════════════════════════════════════════════════════════
function WiggleChart({ rows, t, formatValue, getSeverityColor, totalH, svgRef }) {
  const barMax = SD_RANGE;
  const chartWidth = 700 - LABEL_W - CHART_R - CHART_L;
  const chartAreaX = LABEL_W + CHART_L;
  const half = chartWidth / 2;
  const pxPerSd = half / barMax;

  const barX = (sd) => chartAreaX + half + sd * pxPerSd;
  const barWidth = (sd) => Math.abs(sd * pxPerSd);

  return (
    <svg ref={svgRef} viewBox={`0 0 700 ${totalH}`} style={{ maxWidth: "100%", width: 1000, height: totalH, display: "block", overflow: "visible", fontFamily: "'DM Sans','DM Mono',sans-serif", userSelect: "none" }}>
      <rect x="0" y="0" width="700" height={totalH} fill={t.bg} />
      <rect x={LABEL_W} y={TOP} width={700 - LABEL_W - CHART_R} height={rows.length * ROW_H} fill={t.surf} rx="4" />

      {/* SD zone background */}
      <rect x={barX(-1)} y={TOP} width={barX(1) - barX(-1)} height={rows.length * ROW_H} fill={t.ok + "15"} />
      <rect x={barX(-2)} y={TOP} width={barX(-1) - barX(-2)} height={rows.length * ROW_H} fill={t.warn + "12"} />
      <rect x={barX(1)} y={TOP} width={barX(2) - barX(1)} height={rows.length * ROW_H} fill={t.warn + "12"} />
      <rect x={barX(-SD_RANGE)} y={TOP} width={barX(-2) - barX(-SD_RANGE)} height={rows.length * ROW_H} fill={t.err + "10"} />
      <rect x={barX(2)} y={TOP} width={barX(SD_RANGE) - barX(2)} height={rows.length * ROW_H} fill={t.err + "10"} />

      {/* Center line */}
      <line x1={barX(0)} y1={TOP - 4} x2={barX(0)} y2={TOP + rows.length * ROW_H + 4}
        stroke={t.tx3} strokeWidth="0.5" strokeDasharray="3,3" />

      {/* Tick lines */}
      {[-2, -1, 1, 2].map(sd => (
        <line key={`tick-${sd}`} x1={barX(sd)} y1={TOP - 4}
          x2={barX(sd)} y2={TOP + rows.length * ROW_H + 4}
          stroke={t.bdr} strokeWidth="0.5" />
      ))}
      {[-2, -1, 0, 1, 2].map(sd => (
        <text key={`xlab-${sd}`} x={barX(sd)} y={TOP - 12}
          textAnchor="middle" fill={t.tx3} fontSize="10" fontFamily="'DM Mono',monospace">
          {sd === 0 ? "μ" : sd > 0 ? `+${sd}σ` : `${sd}σ`}
        </text>
      ))}

      {/* Row dividers */}
      {rows.map((_, i) => (
        <line key={`div-${i}`} x1={LABEL_W - 4} y1={TOP + i * ROW_H}
          x2={700 - CHART_R + 4} y2={TOP + i * ROW_H}
          stroke={t.bdr} strokeWidth="0.5" opacity="0.4" />
      ))}

      {/* Bars + labels */}
      {rows.map((row, i) => {
        const sd = Math.max(-barMax, Math.min(barMax, row.dev.sdUnits));
        const cy = TOP + i * ROW_H + ROW_H / 2;
        const barH = ROW_H * 0.55;
        const left = sd < 0 ? barX(sd) : barX(0);
        const bw = barWidth(sd);
        const color = getSeverityColor(sd);
        return (
          <g key={row.label}>
            <text x={LABEL_W - 8} y={cy + 1} textAnchor="end" dominantBaseline="middle"
              fill={row.color || t.tx} fontSize="11" fontWeight="600" fontFamily="'DM Mono',monospace">
              {row.label}
            </text>
            {bw > 0 && (
              <rect x={left} y={cy - barH / 2} width={bw} height={barH}
                rx="3" fill={color} opacity="0.85" />
            )}
            {Math.abs(sd) > 0.15 && (
              <text x={barX(sd) + (sd < 0 ? -6 : 6)} y={cy + 1}
                textAnchor={sd < 0 ? "end" : "start"} dominantBaseline="middle"
                fill={color} fontSize="10" fontWeight="700" fontFamily="'DM Mono',monospace">
                {formatValue(row)}
              </text>
            )}
            {Math.abs(sd) <= 0.15 && (
              <text x={barX(0) + 8} y={cy + 1} textAnchor="start" dominantBaseline="middle"
                fill={color} fontSize="10" fontWeight="700" fontFamily="'DM Mono',monospace">
                {formatValue(row)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RADAR CHART — circular z-score pattern
// ═══════════════════════════════════════════════════════════════════════════════
function RadarChart({ rows, t, getSeverityColor }) {
  const n = rows.length;
  if (n === 0) return null;
  const CX = 350, CY = 260, R = 190, labelR = R + 28;
  const clamp = (v) => Math.max(-SD_RANGE, Math.min(SD_RANGE, v));

  const points = rows.map((row, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const sd = clamp(row.dev.sdUnits);
    const r = R * ((sd + SD_RANGE) / (2 * SD_RANGE));
    return { ...row, angle, sd, r, x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
  });

  const ringLabels = [-2, -1, 1, 2];

  return (
    <svg viewBox="0 0 700 540" style={{ maxWidth: "100%", width: 1000, height: 600, display: "block", overflow: "visible", fontFamily: "'DM Sans','DM Mono',sans-serif", userSelect: "none" }}>
      <rect x="0" y="0" width="700" height="540" fill={t.bg} rx="4" />

      <text x={CX} y={16} textAnchor="middle" fill={t.tx2} fontSize="13" fontWeight="700" fontFamily="'Syne',sans-serif">
        Radar Normogram — Z-score Pattern
      </text>

      {ringLabels.map(sd => {
        const r = R * ((sd + SD_RANGE) / (2 * SD_RANGE));
        return (
          <circle key={`ring-${sd}`} cx={CX} cy={CY} r={r}
            fill="none" stroke={sd === 0 ? t.tx3 : t.bdr} strokeWidth={sd === 0 ? 0.5 : 0.3}
            strokeDasharray={sd === 0 ? "3,3" : "2,3"} opacity="0.5" />
        );
      })}

      {ringLabels.map(sd => {
        const r = R * ((sd + SD_RANGE) / (2 * SD_RANGE));
        return (
          <text key={`rlab-${sd}`} x={CX + 4} y={CY - r - 4} fill={t.tx3} fontSize="9" fontFamily="'DM Mono',monospace" opacity="0.6">
            {sd > 0 ? `+${sd}σ` : `${sd}σ`}
          </text>
        );
      })}

      {points.map(p => (
          <line key={`spoke-${points.indexOf(p)}`} x1={CX} y1={CY} x2={p.x} y2={p.y}
            stroke={t.bdr} strokeWidth="0.5" opacity="0.15" />
      ))}

      <polygon
        points={points.map(p => `${p.x},${p.y}`).join(" ")}
        fill={t.acc + "18"} stroke={t.acc} strokeWidth="2" strokeLinejoin="round"
      />

      {points.map(p => {
        const lx = CX + labelR * Math.cos(p.angle);
        const ly = CY + labelR * Math.sin(p.angle);
        const anchor = lx > CX + 5 ? "start" : lx < CX - 5 ? "end" : "middle";
        return (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="4.5" fill={getSeverityColor(p.sd)} stroke="#fff" strokeWidth="1.5" />
            <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle"
              fill={p.color || t.tx} fontSize="8" fontWeight="600" fontFamily="'DM Mono',monospace">
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEVERITY SUMMARY — aggregated by category
// ═══════════════════════════════════════════════════════════════════════════════
function SummaryView({ rows, t, formatValue }) {
  const grouped = useMemo(() => {
    const map = {};
    for (const row of rows) {
      const cat = measurementCategory(row.label);
      if (!map[cat]) map[cat] = { rows: [], normal: 0, mild: 0, severe: 0 };
      map[cat].rows.push(row);
      const a = Math.abs(row.dev.sdUnits);
      if (a <= 1) map[cat].normal++;
      else if (a <= 2) map[cat].mild++;
      else map[cat].severe++;
    }
    return map;
  }, [rows]);

  const grandTotal = rows.length;
  const grandNormal = rows.filter(r => Math.abs(r.dev.sdUnits) <= 1).length;
  const grandMild = rows.filter(r => Math.abs(r.dev.sdUnits) > 1 && Math.abs(r.dev.sdUnits) <= 2).length;
  const grandSevere = rows.filter(r => Math.abs(r.dev.sdUnits) > 2).length;

  return (
    <div style={{ width: "100%", fontFamily: "'DM Sans',sans-serif" }}>
      {/* Grand total badge row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, justifyContent: "center" }}>
        {[
          { label: "Normal (≤1σ)", count: grandNormal, color: t.ok },
          { label: "Mild (1–2σ)", count: grandMild, color: t.warn },
          { label: "Severe (>2σ)", count: grandSevere, color: t.err },
        ].map(b => (
          <div key={b.label} style={{
            background: b.color + "18", border: `1px solid ${b.color}40`, borderRadius: 10,
            padding: "10px 18px", textAlign: "center", minWidth: 110,
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: b.color }}>{b.count}</div>
            <div style={{ fontSize: 10, color: t.tx2, marginTop: 2 }}>{b.label}</div>
            <div style={{ fontSize: 11, color: t.tx3, marginTop: 1 }}>
              {grandTotal > 0 ? Math.round(b.count / grandTotal * 100) + "%" : "—"}
            </div>
          </div>
        ))}
      </div>

      {/* Per-category sections */}
      {CATEGORY_ORDER.filter(c => grouped[c]).map(cat => {
        const g = grouped[cat];
        const total = g.rows.length;
        return (
          <div key={cat} style={{
            background: t.surf2, border: `1px solid ${t.bdr}`, borderRadius: 10,
            padding: 12, marginBottom: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, marginBottom: 8, fontFamily: "'Syne',sans-serif" }}>
              {CATEGORY_LABELS[cat] || cat}
              <span style={{ fontSize: 11, color: t.tx3, fontWeight: 400, marginLeft: 8 }}>{total} measurements</span>
            </div>

            {/* Stacked bar */}
            <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
              {g.normal > 0 && <div style={{ flex: g.normal, background: t.ok, minWidth: 1 }} />}
              {g.mild > 0 && <div style={{ flex: g.mild, background: t.warn, minWidth: 1 }} />}
              {g.severe > 0 && <div style={{ flex: g.severe, background: t.err, minWidth: 1 }} />}
            </div>

            {/* Badge row */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {g.normal > 0 && <Badge color={t.ok} label="Normal" count={g.normal} total={total} />}
              {g.mild > 0 && <Badge color={t.warn} label="Mild" count={g.mild} total={total} />}
              {g.severe > 0 && <Badge color={t.err} label="Severe" count={g.severe} total={total} />}
            </div>

            {/* Measurement list */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
              {g.rows.map(r => {
                const a = Math.abs(r.dev.sdUnits);
                const c = a <= 1 ? t.ok : a <= 2 ? t.warn : t.err;
                return (
                  <span key={r.label} style={{
                    fontSize: 10, padding: "2px 7px", borderRadius: 4,
                    background: c + "18", color: c, border: `1px solid ${c}30`,
                    fontWeight: 600,
                  }}>
                    {r.label} {formatValue(r)}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Badge({ color, label, count, total }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 12,
      background: color + "15", color, border: `1px solid ${color}30`,
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}: {count}/{total} ({Math.round(count / total * 100)}%)
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA TABLE — sortable, all columns
// ═══════════════════════════════════════════════════════════════════════════════
function DataTable({ rows, t, formatValue }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const sorted = useMemo(() => {
    if (!sortCol) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      let va, vb;
      if (sortCol === "label") { va = a.label; vb = b.label; }
      else if (sortCol === "value") { va = a.value; vb = b.value; }
      else if (sortCol === "mean") { va = a.norm.mean; vb = b.norm.mean; }
      else if (sortCol === "sd") { va = a.norm.sd; vb = b.norm.sd; }
      else if (sortCol === "zscore") { va = a.dev.sdUnits; vb = b.dev.sdUnits; }
      if (typeof va === "string") return va.localeCompare(vb) * dir;
      return (va - vb) * dir;
    });
  }, [rows, sortCol, sortDir]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SORT_ICON = (col) => sortCol === col ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const cols = [
    { key: "label", label: "Measurement", align: "left" },
    { key: "value", label: "Value", align: "right" },
    { key: "mean", label: "Norm Mean", align: "right" },
    { key: "sd", label: "Norm SD", align: "right" },
    { key: "zscore", label: "Z-score", align: "right" },
  ];

  const headerStyle = (col) => ({
    padding: "6px 10px", fontSize: 11, fontWeight: 700, color: t.tx, cursor: "pointer",
    textAlign: col.align, borderBottom: `2px solid ${t.bdr}`,
    whiteSpace: "nowrap", fontFamily: "'DM Sans',sans-serif",
    userSelect: "none", background: sortCol === col.key ? t.surf2 + "80" : "transparent",
  });

  return (
    <div style={{ width: "100%", overflowX: "auto", fontFamily: "'DM Sans','DM Mono',sans-serif" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key} onClick={() => toggleSort(c.key)} style={headerStyle(c)}>
                {c.label}{SORT_ICON(c.key)}
              </th>
            ))}
            <th style={{ ...headerStyle({ align: "left" }), cursor: "default" }}>Percentile</th>
            <th style={{ ...headerStyle({ align: "left" }), cursor: "default" }}>Severity</th>
            <th style={{ ...headerStyle({ align: "left" }), cursor: "default" }}>Interpretation</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => {
            const a = Math.abs(row.dev.sdUnits);
            const sevColor = a <= 1 ? t.ok : a <= 2 ? t.warn : t.err;
            const sevLabel = a <= 1 ? "Normal" : a <= 2 ? "Mild" : "Severe";
            const pct = normCdf(row.dev.sdUnits);
            const interp = interpretationText(row.label, row.value, row.norm.mean);
            return (
              <tr key={row.label} style={{ borderBottom: `1px solid ${t.bdr}40` }}>
                <td style={{ padding: "5px 10px", fontWeight: 600, color: row.color || t.tx }}>{row.label}</td>
                <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: sevColor, fontWeight: 700 }}>{formatValue(row)}</td>
                <td style={{ padding: "5px 10px", textAlign: "right", color: t.tx2 }}>{row.norm.mean.toFixed(1)}{row.measureType === "angle" ? "°" : " mm"}</td>
                <td style={{ padding: "5px 10px", textAlign: "right", color: t.tx2 }}>{row.norm.sd.toFixed(2)}</td>
                <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: sevColor, fontWeight: 700 }}>
                  {row.dev.sdUnits > 0 ? "+" : ""}{row.dev.sdUnits.toFixed(2)}
                </td>
                <td style={{ padding: "5px 10px", textAlign: "right", color: t.tx2 }}>
                  {pct < 1 ? "<1%" : pct > 99 ? ">99%" : pct + "%"}
                </td>
                <td style={{ padding: "5px 10px" }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 8,
                    background: sevColor + "18", color: sevColor,
                  }}>{sevLabel}</span>
                </td>
                <td style={{ padding: "5px 10px", color: t.tx2, fontSize: 10, maxWidth: 200, lineHeight: 1.3 }}>{interp}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 10, color: t.tx3, marginTop: 6, textAlign: "center" }}>
        {rows.length} measurements &middot; Click column headers to sort
      </div>
    </div>
  );
}

export default function NormogramPanel({ allMeas, norms, t, formatAngle }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [chartMode, setChartMode] = useState("polygon");
  const [guideKey, setGuideKey] = useState(null);

  const rows = useMemo(() => {
    const out = [];
    for (const { m, meas } of allMeas) {
      if (!m.label) continue;
      for (const [measureType, value] of Object.entries(meas)) {
        if (typeof value !== "number" || !isFinite(value)) continue;
        const norm = norms.find(n => n.markupLabel === m.label && n.measureType === measureType);
        if (!norm || norm.sd <= 0) continue;
        const dev = normDeviation(value, norm);
        out.push({ label: m.label, value, measureType, norm, dev, color: m.color });
      }
    }
    const seen = new Set();
    return out.filter(r => {
      const key = r.label;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allMeas, norms]);

  const totalH = TOP + rows.length * ROW_H + BOTTOM;

  const formatValue = useCallback((row) => {
    const v = row.value;
    if (row.measureType === "angle") return formatAngle ? formatAngle(v) : v.toFixed(1) + "°";
    return v.toFixed(2) + " mm";
  }, [formatAngle]);

  const getSeverityColor = useCallback((sdUnits) => {
    const a = Math.abs(sdUnits);
    if (a <= 1) return t.ok;
    if (a <= 2) return t.warn;
    return t.err;
  }, [t]);

  const downloadSVG = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(clone);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "normogram.svg";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadPNG = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(clone);
    const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const cw = svg.clientWidth || 700;
      const ch = svg.clientHeight || totalH;
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = cw * scale;
      canvas.height = ch * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.fillStyle = t.bg;
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      canvas.toBlob(blob => {
        if (!blob) return;
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = "normogram.png";
        a.click();
        URL.revokeObjectURL(dlUrl);
        URL.revokeObjectURL(url);
      }, "image/png");
    };
    img.src = url;
  }, [t.bg, totalH]);

  const downloadCSV = useCallback(() => {
    const header = ["Measurement", "Value", "Norm Mean", "Norm SD", "Z-score", "Percentile", "Severity", "Interpretation"];
    const escape = v => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(",")];
    for (const r of rows) {
      const z = r.dev ? r.dev.sdUnits : "";
      const pct = r.dev ? (normCdf(r.dev.sdUnits) * 100).toFixed(1) + "%" : "";
      const absZ = r.dev ? Math.abs(r.dev.sdUnits) : 0;
      const sevLabel = r.dev ? (absZ <= 1 ? "Normal" : absZ <= 2 ? "Mild" : "Severe") : "";
      const interp = r.dev ? interpretationText(r.label, r.value, r.norm.mean) : "";
      lines.push([r.label, r.value, r.norm.mean, r.norm.sd, z, pct, sevLabel, interp].map(escape).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "normogram.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: t.tx2, fontSize: 14 }}>
        No measurements with norms found. Add norms in the Measurements panel.
      </div>
    );
  }

  const normSources = [...new Set(rows.map(r => r.norm.source).filter(Boolean))];

  const chartProps = { rows, t, formatValue, getSeverityColor, totalH };

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      {/* Chart type toggle */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, background: t.surf2, borderRadius: 8, padding: 3, border: `1px solid ${t.bdr}` }}>
        {[
          { id: "polygon", label: "Polygon", icon: "⬡" },
          { id: "wiggle", label: "Wiggle", icon: "▬" },
          { id: "radar", label: "Radar", icon: "◎" },
          { id: "summary", label: "Summary", icon: "☰" },
          { id: "table", label: "Table", icon: "⊞" },
        ].map(mode => (
          <button key={mode.id} onClick={() => setChartMode(mode.id)}
            style={{
              padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
              background: chartMode === mode.id ? t.acc : "transparent",
              color: chartMode === mode.id ? (t.id === "light" ? "#fff" : t.bg) : t.tx2,
              fontSize: 11, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s"
            }}>
            <span style={{ fontSize: 13 }}>{mode.icon}</span> {mode.label}
          </button>
        ))}
      </div>
      <button onClick={() => setGuideKey("normogram")}
        style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0, marginLeft: 6, alignSelf: "center" }} title="Guide">?</button>

      <div style={{ width: "100%", maxWidth: 780, overflowX: "auto" }}>
        {chartMode === "polygon" && <PolygonChart {...chartProps} svgRef={svgRef} />}
        {chartMode === "wiggle" && <WiggleChart {...chartProps} svgRef={svgRef} />}
        {chartMode === "radar" && <RadarChart rows={rows} t={t} formatValue={formatValue} getSeverityColor={getSeverityColor} />}
        {chartMode === "summary" && <SummaryView rows={rows} t={t} formatValue={formatValue} getSeverityColor={getSeverityColor} />}
        {chartMode === "table" && <DataTable rows={rows} t={t} formatValue={formatValue} />}
      </div>

      {/* Norm source footer */}
      {normSources.length > 0 && (
        <div style={{ fontSize: 10, color: t.tx3, marginTop: 8, textAlign: "center" }}>
          Norm source: {normSources.join("; ")}
        </div>
      )}

      {/* Download buttons */}
      {chartMode !== "summary" && chartMode !== "table" && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center" }}>
          <button onClick={downloadSVG}
            style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
            Download SVG
          </button>
          <button onClick={downloadPNG}
            style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: t.acc, color: t.bg, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
            Download PNG
          </button>
        </div>
      )}
      {chartMode === "table" && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center" }}>
          <button onClick={downloadCSV}
            style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: t.acc, color: t.bg, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
            Download CSV
          </button>
        </div>
      )}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}
