import { useRef, useMemo, useCallback } from "react";
import { normDeviation } from "../utils.js";

const ROW_H = 28;
const LABEL_W = 120;
const CHART_L = 40;
const CHART_R = 40;
const TOP = 44;
const BOTTOM = 30;
const SD_RANGE = 2.5;

function chartX(sdUnits, cw) {
  const half = cw / 2;
  const pxPerSd = half / SD_RANGE;
  return half + sdUnits * pxPerSd;
}

export default function NormogramPanel({ allMeas, norms, t, formatAngle }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

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

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      <div style={{ width: "100%", maxWidth: 780, overflowX: "auto" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 700 ${totalH}`}
          style={{ width: "100%", minWidth: 700, height: totalH, fontFamily: "'DM Sans','DM Mono',sans-serif", userSelect: "none" }}
        >
          {/* Background */}
          <rect x="0" y="0" width="700" height={totalH} fill={t.bg} />

          {/* Chart area background */}
          <rect x={LABEL_W} y={TOP} width={700 - LABEL_W - CHART_R} height={rows.length * ROW_H} fill={t.surf} rx="4" />

          {/* SD zone background — green */}
          <rect x={chartX(-1, 700 - LABEL_W - CHART_R - CHART_L) + LABEL_W + CHART_L} y={TOP}
            width={chartX(1, 700 - LABEL_W - CHART_R - CHART_L) - chartX(-1, 700 - LABEL_W - CHART_R - CHART_L)}
            height={rows.length * ROW_H} fill={t.ok + "15"} />
          {/* Yellow zones ±1-2σ */}
          <rect x={chartX(-2, 700 - LABEL_W - CHART_R - CHART_L) + LABEL_W + CHART_L} y={TOP}
            width={chartX(-1, 700 - LABEL_W - CHART_R - CHART_L) - chartX(-2, 700 - LABEL_W - CHART_R - CHART_L)}
            height={rows.length * ROW_H} fill={t.warn + "12"} />
          <rect x={chartX(1, 700 - LABEL_W - CHART_R - CHART_L) + LABEL_W + CHART_L} y={TOP}
            width={chartX(2, 700 - LABEL_W - CHART_R - CHART_L) - chartX(1, 700 - LABEL_W - CHART_R - CHART_L)}
            height={rows.length * ROW_H} fill={t.warn + "12"} />
          {/* Red zones >±2σ */}
          <rect x={chartX(-SD_RANGE, 700 - LABEL_W - CHART_R - CHART_L) + LABEL_W + CHART_L} y={TOP}
            width={chartX(-2, 700 - LABEL_W - CHART_R - CHART_L) - chartX(-SD_RANGE, 700 - LABEL_W - CHART_R - CHART_L)}
            height={rows.length * ROW_H} fill={t.err + "10"} />
          <rect x={chartX(2, 700 - LABEL_W - CHART_R - CHART_L) + LABEL_W + CHART_L} y={TOP}
            width={chartX(SD_RANGE, 700 - LABEL_W - CHART_R - CHART_L) - chartX(2, 700 - LABEL_W - CHART_R - CHART_L)}
            height={rows.length * ROW_H} fill={t.err + "10"} />

          {/* Center axis line (norm mean) */}
          <line x1={chartX(0, 700 - LABEL_W - CHART_R - CHART_L) + LABEL_W + CHART_L} y1={TOP - 4}
            x2={chartX(0, 700 - LABEL_W - CHART_R - CHART_L) + LABEL_W + CHART_L} y2={TOP + rows.length * ROW_H + 4}
            stroke={t.tx3} strokeWidth="0.5" strokeDasharray="3,3" />

          {/* X-axis tick lines */}
          {[-2, -1, 0, 1, 2].map(sd => (
            <line key={`tick-${sd}`}
              x1={chartX(sd, 700 - LABEL_W - CHART_R - CHART_L) + LABEL_W + CHART_L} y1={TOP - 4}
              x2={chartX(sd, 700 - LABEL_W - CHART_R - CHART_L) + LABEL_W + CHART_L} y2={TOP + rows.length * ROW_H + 4}
              stroke={t.bdr} strokeWidth="0.5" />
          ))}

          {/* X-axis labels */}
          {[-2, -1, 0, 1, 2].map(sd => (
            <text key={`xlab-${sd}`}
              x={chartX(sd, 700 - LABEL_W - CHART_R - CHART_L) + LABEL_W + CHART_L} y={TOP - 12}
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

          {/* Row labels + dots + polyline */}
          {rows.map((row, i) => {
            const cx = chartX(row.dev.sdUnits, 700 - LABEL_W - CHART_R - CHART_L) + LABEL_W + CHART_L;
            const cy = TOP + i * ROW_H + ROW_H / 2;
            return (
              <g key={row.label}>
                <text x={LABEL_W - 8} y={cy + 1} textAnchor="end" dominantBaseline="middle"
                  fill={row.color || t.tx} fontSize="11" fontWeight="600" fontFamily="'DM Mono',monospace">
                  {row.label}
                </text>
                <circle cx={cx} cy={cy} r="5" fill={getSeverityColor(row.dev.sdUnits)} stroke="#fff" strokeWidth="1.5" />
                <text x={cx + 10} y={cy + 1} dominantBaseline="middle" fill={getSeverityColor(row.dev.sdUnits)}
                  fontSize="10" fontWeight="700" fontFamily="'DM Mono',monospace">
                  {formatValue(row)}
                </text>
              </g>
            );
          })}

          {/* Polyline (wiggle) — connecting dots */}
          <polyline
            points={rows.map((row, i) => {
              const cx = chartX(row.dev.sdUnits, 700 - LABEL_W - CHART_R - CHART_L) + LABEL_W + CHART_L;
              const cy = TOP + i * ROW_H + ROW_H / 2;
              return `${cx},${cy}`;
            }).join(" ")}
            fill="none" stroke={t.acc} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.7"
          />

          {/* Norm source footer */}
          {normSources.length > 0 && (
            <text x="350" y={totalH - 8} textAnchor="middle" fill={t.tx3} fontSize="9" fontFamily="'DM Sans',sans-serif">
              Norm source: {normSources.join("; ")}
            </text>
          )}
        </svg>
      </div>

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
