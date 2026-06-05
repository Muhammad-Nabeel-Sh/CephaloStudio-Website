import { useRef, useMemo, useCallback, useState } from "react";
import { normDeviation } from "../utils.js";

const ROW_H = 28;
const LABEL_W = 160;
const CHART_L = 40;
const CHART_R = 80;
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

// ═══════════════════════════════════════════════════════════════════════════════
// POLYGON CHART (existing)
// ═══════════════════════════════════════════════════════════════════════════════
function PolygonChart({ rows, t, formatValue, getSeverityColor, totalH, svgRef }) {
  const chartWidth = 700 - LABEL_W - CHART_R - CHART_L;
  const chartAreaX = LABEL_W + CHART_L;
  const clamp = (v) => Math.max(-SD_RANGE, Math.min(SD_RANGE, v));

  return (
    <svg ref={svgRef} viewBox={`0 0 700 ${totalH}`} style={{ maxWidth: "100%", width: 700, height: totalH, display: "block", overflow: "visible", fontFamily: "'DM Sans','DM Mono',sans-serif", userSelect: "none" }}>
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
    <svg ref={svgRef} viewBox={`0 0 700 ${totalH}`} style={{ maxWidth: "100%", width: 700, height: totalH, display: "block", overflow: "visible", fontFamily: "'DM Sans','DM Mono',sans-serif", userSelect: "none" }}>
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

export default function NormogramPanel({ allMeas, norms, t, formatAngle }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [chartMode, setChartMode] = useState("polygon");

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
        ].map(mode => (
          <button key={mode.id} onClick={() => setChartMode(mode.id)}
            style={{
              padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
              background: chartMode === mode.id ? t.acc : "transparent",
              color: chartMode === mode.id ? (t.id === "light" ? "#fff" : t.bg) : t.tx2,
              fontSize: 12, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s"
            }}>
            <span style={{ fontSize: 14 }}>{mode.icon}</span> {mode.label}
          </button>
        ))}
      </div>

      <div style={{ width: "100%", maxWidth: 780, overflowX: "auto" }}>
        {chartMode === "polygon" && <PolygonChart {...chartProps} svgRef={svgRef} />}
        {chartMode === "wiggle" && <WiggleChart {...chartProps} svgRef={svgRef} />}
      </div>

      {/* Norm source footer */}
      {normSources.length > 0 && (
        <div style={{ fontSize: 10, color: t.tx3, marginTop: 8, textAlign: "center" }}>
          Norm source: {normSources.join("; ")}
        </div>
      )}

      {/* Download buttons */}
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
    </div>
  );
}
