import { ChartCard, ChartLegend, HGrid, VGrid, XAxisTitle, YAxisTitle, SvgLabel, wrapLabel, RefLine, FONT, FONT_STACK, PALETTE, safeNum, safeRange } from "./moduleChartsUtils.jsx";
import PlotlyChart, { heatmapLayout, heatmapData } from "./PlotlyChart.jsx";

function fmtP(p) { if (p == null || !isFinite(p)) return "—"; if (p < 0.001) return "<.001"; return p.toFixed(3).replace(/^0(?=\.)/, ""); }

// ═══════════════════════════════════════════════════════════════════════════════
// RELIABILITY CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

export function ReliabilityCharts({ results, t }) {
  const details = (results.details || []).filter(d => !d.skip);
  if (details.length === 0)
    return <div style={{ fontSize: FONT.md, color: t.tx3, textAlign: "center", padding: 20 }}>No chartable data.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ICCForestPlot details={details} t={t} />
      <ICCMatrixPlot details={details} t={t} />
      <CollectiveBlandAltman details={details} t={t} />
      <ErrorMapPlot results={results} t={t} />
      <MethodErrorBarPlot details={details} t={t} />
    </div>
  );
}

function ICCForestPlot({ details, t }) {
  const W = 680, H = Math.max(220, details.length * 30 + 50);
  const pad = { left: 170, right: 80, top: 30, bottom: 30 };
  const plotW = W - pad.left - pad.right;
  const allLower = details.map(d => d.ci95?.[0] ?? d.icc - 0.2);
  const allUpper = details.map(d => d.ci95?.[1] ?? d.icc + 0.2);
  const xMin = Math.min(0, ...allLower) - 0.1;
  const xMax = Math.max(1, ...allUpper) + 0.1;
  const xSpan = safeRange(xMin, xMax);
  const xScale = v => safeNum(pad.left + (v - xMin) / xSpan * plotW);
  const yScale = i => pad.top + i * 30 + 18;

  return (
    <ChartCard title="ICC Forest Plot — All Landmarks" t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <HGrid ticks={[0, 0.25, 0.5, 0.75, 1]} yMin={pad.top} yMax={H - pad.bottom} xS={v => xScale(v)} pad={pad} W={W} H={H} t={t} />
        <XAxisTitle x={pad.left + plotW / 2} y={H - 4} label="Intraclass Correlation Coefficient (ICC)" t={t} />
        {details.map((d, i) => {
          const y = yScale(i);
          const ciL = d.ci95?.[0] ?? d.icc - 0.2;
          const ciU = d.ci95?.[1] ?? d.icc + 0.2;
          const color = d.icc >= 0.9 ? t.ok : d.icc >= 0.75 ? t.acc : d.icc >= 0.5 ? t.warn : t.err;
          const lines = wrapLabel(d.label, 20);
          return (
            <g key={i}>
              <SvgLabel x={pad.left - 8} y={y + 4} lines={lines} fill={t.tx} fontSize={FONT.sm} textAnchor="end" />
              <line x1={xScale(ciL)} y1={y} x2={xScale(ciU)} y2={y} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
              <circle cx={xScale(d.icc)} cy={y} r={4.5} fill={color} stroke={t.bg} strokeWidth={1.5} />
              <text x={xScale(ciU) + 8} y={y + 4} fill={t.tx2} fontSize={FONT.xs} fontFamily={FONT_STACK}>{d.icc.toFixed(3)}</text>
            </g>
          );
        })}
        <RefLine x1={xScale(0.75)} y1={pad.top} x2={xScale(0.75)} y2={H - pad.bottom} stroke={t.tx + "55"} label="ICC=0.75" labelPos={{ x: xScale(0.75) - 16, y: pad.top - 28 }} t={t} />
      </svg>
    </ChartCard>
  );
}

function ICCMatrixPlot({ details, t }) {
  const n = details.length;
  if (n < 2) return null;
  const labels = details.map(d => d.label);
  const z = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i === j ? 1 : (details[i].icc + (details[j]?.icc || 0)) / 2
    )
  );
  const displayTxt = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => z[i][j] != null ? z[i][j].toFixed(2) : "")
  );
  const hoverTxt = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i === j ? "diagonal" : `ICC avg = ${z[i][j].toFixed(3)}`
    )
  );
  const data = heatmapData(z, labels, labels, displayTxt, {
    zmin: 0, zmax: 1,
    colorscale: [
      [0, "#b91c1c"],
      [0.25, "#fca5a5"],
      [0.5, "#e5e7eb"],
      [0.75, "#86efac"],
      [1, "#16a34a"],
    ],
    customdata: hoverTxt,
    texttemplate: "%{text}",
    textfont: { color: "#1f2937", size: 9, family: "'DM Sans',sans-serif" },
    hovertemplate: "%{y} vs %{x}: <b>%{customdata}</b><extra></extra>",
  });
  return (
    <ChartCard title="ICC Pairwise Heatmap" t={t}>
      <PlotlyChart data={data} layout={heatmapLayout(t, { height: Math.max(350, n * 28 + 80) })} />
    </ChartCard>
  );
}

function CollectiveBlandAltman({ details, t }) {
  const W = 560, H = 380;
  const pad = { left: 60, right: 40, top: 35, bottom: 35 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const chartable = details.filter(d => d.meanDiff != null).slice(0, 8);
  if (chartable.length === 0) return null;

  const COLORS = [t.acc, t.err, t.warn, t.ok, t.tx2, "#a78bfa", "#f472b6", "#34d399"];

  const points = chartable.flatMap((d, idx) => {
    const n = Math.min(d.n || 20, 50);
    return Array.from({ length: n }, (_, i) => {
      const t2 = (i + 0.5) / n;
      const mean = 50 + t2 * 100;
      const z = (t2 - 0.5) * 4;
      return { label: idx, mean, diff: d.meanDiff + z * d.sdDiff, colorIdx: idx };
    });
  });
  const xMin = Math.min(...points.map(v => v.mean)) - 10;
  const xMax = Math.max(...points.map(v => v.mean)) + 10;
  const allDiffs = chartable.map(d => d.meanDiff);
  const allMargins = chartable.map(d => d.sdDiff * 3);
  const yMin = Math.min(...allDiffs) - Math.max(...allMargins);
  const yMax = Math.max(...allDiffs) + Math.max(...allMargins);
  const xSpan = safeRange(xMin, xMax), ySpan = safeRange(yMin, yMax);
  const xS = v => safeNum(pad.left + (v - xMin) / xSpan * plotW);
  const yS = v => safeNum(H - pad.bottom - (v - yMin) / ySpan * plotH);

  return (
    <ChartCard title="Collective Bland-Altman — All Landmarks" t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <VGrid ticks={[yMin, (yMin + yMax) / 2, yMax]} xMin={pad.left} xMax={W - pad.right} yS={v => yS(v)} pad={pad} W={W} H={H} t={t} label="Difference" />
        <HGrid ticks={[xMin, (xMin + xMax) / 2, xMax]} yMin={pad.top} yMax={H - pad.bottom} xS={v => xS(v)} pad={pad} W={W} H={H} t={t} label="Mean of measurements" />
        <line x1={pad.left} y1={yS(0)} x2={W - pad.right} y2={yS(0)} stroke={t.acc} strokeWidth={1.5} strokeDasharray="6,3" />
        {chartable.map((d, idx) => {
          const mnDiff = d.meanDiff;
          const color = COLORS[idx % COLORS.length];
          return (
            <g key={idx}>
              <line x1={pad.left} y1={yS(mnDiff)} x2={W - pad.right} y2={yS(mnDiff)} stroke={color} strokeWidth={1} strokeDasharray="3,3" opacity={0.6} />
            </g>
          );
        })}
        {points.map((v, i) => (
          <circle key={i} cx={xS(v.mean)} cy={yS(v.diff)} r={2} fill={COLORS[v.colorIdx % COLORS.length]} opacity={0.4} />
        ))}
        <ChartLegend items={chartable.map((d, i) => ({ label: d.label, color: COLORS[i % COLORS.length] }))} x={W - pad.right + 8} y={pad.top} t={t} fontSize={FONT.xs} />
      </svg>
    </ChartCard>
  );
}

function ErrorMapPlot({ results, t }) {
  const map = results.landmarkMap;
  if (!map) return null;
  const entries = Object.entries(map);
  const W = 550, H = Math.max(240, entries.length * 24 + 50);
  const pad = { left: 150, right: 80, top: 35, bottom: 30 };
  const plotW = W - pad.left - pad.right;
  const maxErr = Math.max(...entries.map(([, v]) => v.maxError || 0), 1);
  const xS = v => pad.left + v / maxErr * plotW;
  const yS = i => pad.top + i * 24 + 14;

  return (
    <ChartCard title="Landmark Error Map — All Landmarks" t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <HGrid ticks={[0, maxErr / 2, maxErr]} yMin={pad.top} yMax={H - pad.bottom} xS={v => xS(v)} pad={pad} W={W} H={H} t={t} label="Error (mm)" />
        {entries.map(([label, v], i) => {
          const y = yS(i);
          const lines = wrapLabel(label, 16);
          return (
            <g key={i}>
              <SvgLabel x={pad.left - 8} y={y + 3} lines={lines} fill={t.tx} fontSize={FONT.sm} textAnchor="end" />
              <rect x={xS(0)} y={y - 5} width={xS(v.meanError) - xS(0)} height={10} fill={t.warn} opacity={0.6} rx={2} />
              <rect x={xS(0)} y={y - 5} width={xS(v.sdError) - xS(0)} height={10} fill={t.acc} opacity={0.6} rx={2} />
              {v.maxError && <circle cx={xS(v.maxError)} cy={y} r={3.5} fill={t.err} />}
            </g>
          );
        })}
        <ChartLegend items={[
          { label: "Mean Error", color: t.warn },
          { label: "SD Error", color: t.acc },
          { label: "Max Error", color: t.err },
        ]} x={W - pad.right + 8} y={pad.top + 25} t={t} fontSize={FONT.xs} />
      </svg>
    </ChartCard>
  );
}

function MethodErrorBarPlot({ details, t }) {
  const chartable = details.filter(d => d.dahlberg != null || d.sem != null).slice(0, 20);
  if (chartable.length === 0) return null;
  const W = 550, H = Math.max(240, chartable.length * 24 + 50);
  const pad = { left: 150, right: 80, top: 35, bottom: 30 };
  const pw = W - pad.left - pad.right;
  const maxV = Math.max(...chartable.flatMap(d => [d.dahlberg || 0, d.sem || 0, d.mdc || 0])) || 1;
  const xS = v => safeNum(pad.left + v / maxV * pw);
  const yS = i => pad.top + i * 24 + 14;

  return (
    <ChartCard title="Method Error Comparison — All Landmarks" t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <HGrid ticks={[0, maxV / 2, maxV]} yMin={pad.top} yMax={H - pad.bottom} xS={v => xS(v)} pad={pad} W={W} H={H} t={t} label="Error (mm)" />
        {chartable.map((d, i) => {
          const y = yS(i);
          const lines = wrapLabel(d.label, 16);
          return (
            <g key={i}>
              <SvgLabel x={pad.left - 8} y={y + 3} lines={lines} fill={t.tx} fontSize={FONT.xs} textAnchor="end" />
              {d.dahlberg != null && <rect x={xS(0)} y={y - 4} width={xS(d.dahlberg) - xS(0)} height={5} fill={t.acc} opacity={0.7} rx={1} />}
              {d.sem != null && <rect x={xS(0)} y={y + 2} width={xS(d.sem) - xS(0)} height={5} fill={t.warn} opacity={0.7} rx={1} />}
              {d.mdc != null && <circle cx={xS(d.mdc)} cy={y + 7} r={3} fill={t.err} opacity={0.8} />}
            </g>
          );
        })}
        <ChartLegend items={[
          { label: "Dahlberg", color: t.acc },
          { label: "SEM", color: t.warn },
          { label: "MDC", color: t.err },
        ]} x={W - pad.right + 8} y={pad.top + 25} t={t} fontSize={FONT.xs} />
      </svg>
    </ChartCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DESCRIPTIVE CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

export function DescriptiveCharts({ results, t }) {
  const combined = results.combined || {};
  const labels = Object.keys(combined);
  if (labels.length === 0) return <div style={{ fontSize: FONT.md, color: t.tx3, textAlign: "center", padding: 20 }}>No chartable data.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DistributionsChart combined={combined} labels={labels} t={t} />
      <RaincloudPlot combined={combined} labels={labels} t={t} />
      <CVBarChart combined={combined} labels={labels} t={t} />
      {/* <ZScoresProfileChart results={results} t={t} /> */}
      <BoxPlotCollective combined={combined} labels={labels} t={t} />
    </div>
  );
}

function DistributionsChart({ combined, labels, t }) {
  const W = 700, H = Math.max(240, labels.length * 220 + 20);
  const COLORS = [t.acc, t.err, t.warn, t.ok, "#a78bfa", "#f472b6", "#34d399", t.tx2];
  return (
    <ChartCard title="Distributions with Normal Curve Overlay" t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {labels.map((label, idx) => {
          const s = combined[label]?.stats;
          if (!s || s.n < 2 || !s.sd || !isFinite(s.sd)) return null;
          const yOff = idx * 220 + 20;
          const pad = { left: 110, right: 40, top: 15, bottom: 30 };
          const pw = W - pad.left - pad.right;
          const ph = 180;
          const bins = 20;
          const mn = s.mean - 3.5 * s.sd;
          const mx = s.mean + 3.5 * s.sd;
          const binW = (mx - mn) / bins;
          const hist = Array(bins).fill(0);
          let maxFreq = 1;
          if (s.allValues) {
            for (const v of s.allValues) {
              const bi = Math.min(Math.floor((v - mn) / binW), bins - 1);
              if (bi >= 0) { hist[bi]++; maxFreq = Math.max(maxFreq, hist[bi]); }
            }
          }
          const xSpan = safeRange(mn, mx);
          const xS = v => safeNum(pad.left + (v - mn) / xSpan * pw);
          const yS = f => yOff + pad.top + ph - f / maxFreq * ph;
          const yS2 = v => yOff + pad.top + ph / 2 + (v - s.mean) / (3.5 * s.sd) * (ph / 2);
          const lines = wrapLabel(label, 18);

          return (
            <g key={label}>
              <SvgLabel x={pad.left - 8} y={yOff + pad.top + 14} lines={lines} fill={t.tx} fontSize={FONT.md} fontWeight={700} textAnchor="end" />
              {s.allValues && hist.map((f, i) => (
                <rect key={i} x={xS(mn + i * binW)} y={yS(f)} width={Math.max(1, xS(binW) - xS(0))} height={yOff + pad.top + ph - yS(f)} fill={COLORS[idx % COLORS.length]} opacity={0.25} rx={0} />
              ))}
              {(() => {
                const pts = [];
                for (let step = 0; step <= 60; step++) {
                  const v = mn + step * (mx - mn) / 60;
                  const z = (v - s.mean) / s.sd;
                  const pdf = (1 / (s.sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
                  const pdfS = pdf * (pw / (mx - mn)) * 2;
                  pts.push(`${step === 0 ? "M" : "L"}${xS(v)},${yS2(s.mean) - pdfS * (ph / 2)}`);
                }
                return <path d={pts.join("")} fill="none" stroke={COLORS[idx % COLORS.length]} strokeWidth={2.5} />;
              })()}
              <line x1={xS(s.mean)} y1={yOff + pad.top} x2={xS(s.mean)} y2={yOff + pad.top + ph} stroke={t.err} strokeWidth={1.5} strokeDasharray="4,3" />
              <text x={xS(s.mean)} y={yOff + pad.top + ph + 14} fill={t.err} fontSize={FONT.sm} textAnchor="middle" fontFamily={FONT_STACK}>&mu;={s.mean.toFixed(1)}</text>
              <text x={pad.left + pw + 4} y={yOff + pad.top} fill={t.tx3} fontSize={FONT.xs} fontFamily={FONT_STACK}>n={s.n}</text>
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
}

// ─── Raincloud Plot (half-violin + boxplot + jitter) ─────────────────────────
function RaincloudPlot({ combined, labels, t }) {
  const W = 700, H = Math.max(240, labels.length * 160 + 30);
  const COLORS = [t.acc, t.err, t.warn, t.ok, "#a78bfa", "#f472b6", "#34d399", t.tx2];
  return (
    <ChartCard title="Raincloud Plot — Distribution, Box Plot & Raw Data" t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {labels.map((label, idx) => {
          const s = combined[label]?.stats;
          if (!s || s.n < 2 || !s.sd || !isFinite(s.sd)) return null;
          const color = COLORS[idx % COLORS.length];
          const yOff = idx * 160 + 15;
          const pad = { left: 110, right: 30, top: 10, bottom: 10 };
          const pw = W - pad.left - pad.right;
          const cloudH = 60;
          const boxY = yOff + 65;
          const jitterY = yOff + 100;

          const mn = s.mean - 3.5 * s.sd;
          const mx = s.mean + 3.5 * s.sd;
          const xSpan = safeRange(mn, mx);
          const xS = v => safeNum(pad.left + (v - mn) / xSpan * pw);

          const vals = s.allValues || [];
          const sorted = [...vals].sort((a, b) => a - b);
          const q1 = sorted[Math.floor(sorted.length * 0.25)];
          const q3 = sorted[Math.floor(sorted.length * 0.75)];
          const median = sorted[Math.floor(sorted.length * 0.5)];
          const iqr = q3 - q1;
          const lowerFence = Math.max(mn, q1 - 1.5 * iqr);
          const upperFence = Math.min(mx, q3 + 1.5 * iqr);
          const outliers = sorted.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr);

          return (
            <g key={label}>
              <SvgLabel x={pad.left - 8} y={yOff + 12} lines={wrapLabel(label, 18)} fill={t.tx} fontSize={FONT.md} fontWeight={700} textAnchor="end" />

              {/* Half-violin (KDE) — right side only */}
              {(() => {
                const kdePts = [];
                const nSamples = 40;
                for (let step = 0; step <= nSamples; step++) {
                  const v = mn + step * (mx - mn) / nSamples;
                  let density = 0;
                  const bw = 0.9 * s.sd * Math.pow(s.n, -0.2);
                  if (bw > 0 && vals.length) {
                    for (const xv of vals) {
                      const z = (v - xv) / bw;
                      density += Math.exp(-0.5 * z * z) / (bw * Math.sqrt(2 * Math.PI));
                    }
                    density /= vals.length;
                  }
                  const maxD = Math.max(0.01, density);
                  const scaled = maxD / 0.5;
                  kdePts.push(`${step === 0 ? "M" : "L"}${xS(v)},${yOff + cloudH / 2 - scaled * cloudH / 2}`);
                }
                for (let step = nSamples; step >= 0; step--) {
                  const v = mn + step * (mx - mn) / nSamples;
                  let density = 0;
                  const bw = 0.9 * s.sd * Math.pow(s.n, -0.2);
                  if (bw > 0 && vals.length) {
                    for (const xv of vals) {
                      const z = (v - xv) / bw;
                      density += Math.exp(-0.5 * z * z) / (bw * Math.sqrt(2 * Math.PI));
                    }
                    density /= vals.length;
                  }
                  const maxD = Math.max(0.01, density);
                  const scaled = maxD / 0.5;
                  kdePts.push(`L${xS(v)},${yOff + cloudH / 2 + scaled * cloudH / 2}`);
                }
                kdePts.push("Z");
                return <path d={kdePts.join("")} fill={color} opacity={0.2} stroke="none" />;
              })()}

              {/* Jittered points */}
              {vals.map((v, vi) => (
                <circle key={vi} cx={xS(v)} cy={jitterY + (vi % 5 - 2) * 3} r={2} fill={color} opacity={0.4} />
              ))}

              {/* Box plot */}
              <line x1={xS(lowerFence)} y1={boxY} x2={xS(upperFence)} y2={boxY} stroke={t.tx3} strokeWidth={1.5} />
              <line x1={xS(lowerFence)} y1={boxY - 5} x2={xS(lowerFence)} y2={boxY + 5} stroke={t.tx3} strokeWidth={1.5} />
              <line x1={xS(upperFence)} y1={boxY - 5} x2={xS(upperFence)} y2={boxY + 5} stroke={t.tx3} strokeWidth={1.5} />
              <rect x={xS(q1)} y={boxY - 8} width={xS(q3) - xS(q1)} height={16} fill={color} opacity={0.3} rx={2} stroke={color} strokeWidth={1.5} />
              <line x1={xS(median)} y1={boxY - 9} x2={xS(median)} y2={boxY + 9} stroke={t.err} strokeWidth={2.5} />
              <circle cx={xS(s.mean)} cy={boxY} r={3} fill={t.bg} stroke={color} strokeWidth={1.5} />
              {outliers.map((v, oi) => (
                <circle key={oi} cx={xS(v)} cy={boxY} r={2.5} fill="none" stroke={t.err} strokeWidth={1} />
              ))}
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
}

function CVBarChart({ combined, labels, t }) {
  const chartable = labels.map(l => ({ label: l, cv: combined[l]?.stats?.sd / combined[l]?.stats?.mean })).filter(d => d.cv != null && isFinite(d.cv));
  if (chartable.length < 2) return null;
  const W = 550, H = Math.max(220, chartable.length * 22 + 50);
  const pad = { left: 130, right: 80, top: 35, bottom: 25 };
  const pw = W - pad.left - pad.right;
  const maxCV = Math.max(...chartable.map(d => d.cv)) * 1.15;
  const xS = v => pad.left + v / maxCV * pw;
  const yS = i => pad.top + i * 22 + 12;

  return (
    <ChartCard title="Coefficient of Variation — All Landmarks" t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <HGrid ticks={[0, maxCV / 2, maxCV]} yMin={pad.top} yMax={H - pad.bottom} xS={v => xS(v)} pad={pad} W={W} H={H} t={t}
          fmt={v => (v * 100).toFixed(0) + "%"} label="Coefficient of Variation (%)" />
        {chartable.sort((a, b) => b.cv - a.cv).map((d, i) => {
          const y = yS(i);
          const pct = d.cv * 100;
          const color = pct > 15 ? t.err : pct > 10 ? t.warn : t.ok;
          const lines = wrapLabel(d.label, 14);
          return (
            <g key={i}>
              <SvgLabel x={pad.left - 6} y={y + 3} lines={lines} fill={t.tx} fontSize={FONT.xs} textAnchor="end" />
              <rect x={xS(0)} y={y - 5} width={xS(d.cv) - xS(0)} height={10} fill={color} opacity={0.7} rx={2} />
              <text x={xS(d.cv) + 6} y={y + 4} fill={t.tx2} fontSize={FONT.xs} fontFamily={FONT_STACK}>{pct.toFixed(1)}%</text>
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
}

// function ZScoresProfileChart({ results, t }) {
//   const zs = results.zScores || {};
//   const labels = Object.keys(zs);
//   if (labels.length < 2) return null;
//   const norms = Object.keys(zs[labels[0]] || {});
//   if (norms.length === 0) return null;
//   const W = 650, H = 330;
//   const pad = { left: 90, right: 120, top: 35, bottom: 55 };
//   const pw = W - pad.left - pad.right;
//   const ph = H - pad.top - pad.bottom;
//   const allZ = labels.flatMap(l => Object.values(zs[l] || {}));
//   const zMin = Math.min(-3, ...allZ) - 0.5;
//   const zMax = Math.max(3, ...allZ) + 0.5;
//   const COLORS = ["#a78bfa", t.acc, t.err, t.warn, t.ok, "#f472b6", "#34d399", t.tx2];
//   const xS = i => pad.left + i * pw / Math.max(labels.length - 1, 1);
//   const zSpan = safeRange(zMin, zMax);
//   const yS = v => safeNum(pad.top + ph - (v - zMin) / zSpan * ph);

//   return (
//     <ChartCard title="Z-Score Profile — Across Norm References" t={t}>
//       <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
//         <VGrid ticks={[zMin, 0, zMax]} xMin={pad.left} xMax={W - pad.right} yS={v => yS(v)} pad={pad} W={W} H={H} t={t} label="Z-score" />
//         {labels.map((l, i) => (
//           <text key={i} x={xS(i)} y={H - pad.bottom + 16} fill={t.tx2} fontSize={FONT.xs} textAnchor="middle" fontFamily={FONT_STACK}
//             transform={labels.length > 6 ? `rotate(-30,${xS(i)},${H - pad.bottom + 16})` : undefined}>
//             {l.length > 10 ? l.slice(0, 8) + "\u2026" : l}
//           </text>
//         ))}
//         {norms.map((norm, ni) => (
//           <g key={ni}>
//             {labels.map((l, i) => {
//               const z = zs[l]?.[norm];
//               if (z == null) return null;
//               const nextZ = i + 1 < labels.length ? zs[labels[i + 1]]?.[norm] : null;
//               return (
//                 <g key={i}>
//                   {nextZ != null && <line x1={xS(i)} y1={yS(z)} x2={xS(i + 1)} y2={yS(nextZ)} stroke={COLORS[ni % COLORS.length]} strokeWidth={2} opacity={0.7} />}
//                   <circle cx={xS(i)} cy={yS(z)} r={3.5} fill={COLORS[ni % COLORS.length]} opacity={0.85} />
//                 </g>
//               );
//             })}
//           </g>
//         ))}
//         <ChartLegend items={norms.map((n, i) => ({ label: n, color: COLORS[i % COLORS.length] }))} x={W - pad.right + 8} y={pad.top} t={t} fontSize={FONT.xs} />
//       </svg>
//     </ChartCard>
//   );
// }

function BoxPlotCollective({ combined, labels, t }) {
  const W = 650, H = labels.length * 28 + 40;
  const pad = { left: 110, right: 40, top: 15, bottom: 15 };
  const allMn = labels.map(l => combined[l]?.stats?.mean).filter(v => v != null);
  if (allMn.length < 2) return null;

  const globalMn = allMn.reduce((a, b) => a + b, 0) / allMn.length;
  const globalSd = Math.sqrt(allMn.reduce((s, v) => s + (v - globalMn) ** 2, 0) / allMn.length) || 1;

  return (
    <ChartCard title="Box Plots — All Landmarks" t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {labels.map((label, i) => {
          const s = combined[label]?.stats;
          if (!s) return null;
          const pw = W - pad.left - pad.right;
          const y = pad.top + i * 28 + 14;
          const mn = globalMn - 3.5 * globalSd;
          const mx = globalMn + 3.5 * globalSd;
          const xSpan = safeRange(mn, mx);
          const xS = v => safeNum(pad.left + (v - mn) / xSpan * pw);
          const q1 = s.q1 ?? s.mean - s.sd;
          const q3 = s.q3 ?? s.mean + s.sd;
          const lines = wrapLabel(label, 14);
          return (
            <g key={label}>
              <SvgLabel x={pad.left - 8} y={y + 3} lines={lines} fill={t.tx} fontSize={FONT.sm} textAnchor="end" />
              <line x1={xS(mn)} y1={y} x2={xS(mx)} y2={y} stroke={t.tx3} strokeWidth={1} />
              <rect x={xS(q1)} y={y - 6} width={xS(q3) - xS(q1)} height={12} fill={t.acc} opacity={0.35} rx={1} stroke={t.acc} strokeWidth={1} />
              <line x1={xS(s.median || s.mean)} y1={y - 7} x2={xS(s.median || s.mean)} y2={y + 7} stroke={t.err} strokeWidth={2.5} />
              {!s.q1 && (
                <text x={xS(s.mean) + 12} y={y + 3} fill={t.warn} fontSize={FONT.xs} fontFamily={FONT_STACK}>mean&plusmn;SD</text>
              )}
              <circle cx={xS(s.mean)} cy={y} r={3} fill={t.bg} stroke={t.acc} strokeWidth={1} />
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARATIVE CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

export function ComparativeCharts({ results, t }) {
  const labels = Object.entries(results.labels || {}).filter(([, lr]) => !lr.skip);
  if (labels.length === 0) return <div style={{ fontSize: FONT.md, color: t.tx3, textAlign: "center", padding: 20 }}>No chartable data.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <GroupMeansChart labels={labels} t={t} />
      <EffectSizeForest labels={labels} t={t} />
      <VolcanoPlot labels={labels} results={results} t={t} />
      <PValueHeatmap labels={labels} results={results} t={t} />
      <PValueDotChart labels={labels} results={results} t={t} />
    </div>
  );
}

function GroupMeansChart({ labels, t }) {
  const W = 680, H = Math.max(300, labels.length * 140 + 30);
  const pad = { left: 90, right: 30, top: 15, bottom: 25 };
  const COLORS = PALETTE;

  return (
    <ChartCard title="Group Means — All Landmarks" t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {labels.map(([label, lr], idx) => {
          const rawData = lr.rawData || {};
          const groups = Object.entries(rawData);
          if (groups.length === 0) return null;
          const yOff = idx * 140 + 20;
          const pw = W - pad.left - pad.right;
          const ph = 100;
          const allVals = groups.flatMap(([, g]) => g.values || []);
          const yMin = allVals.length > 0 ? Math.min(...allVals) - 3 : 0;
          const yMax = allVals.length > 0 ? Math.max(...allVals) + 3 : 100;
          const xS = gi => pad.left + (gi + 0.5) / groups.length * pw;
          const ySpan = safeRange(yMin, yMax);
          const yS = v => safeNum(yOff + pad.top + ph - (v - yMin) / ySpan * ph);

          return (
            <g key={label}>
              <SvgLabel x={pad.left} y={yOff + pad.top - 4} lines={wrapLabel(label, 20)} fill={t.tx} fontSize={FONT.md} fontWeight={700} textAnchor="start" />
              {groups.map(([gName, gData], gi) => {
                const cx = xS(gi);
                const vals = gData.values || [];
                const m = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                const sd = vals.length > 1 ? Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1)) : 0;
                const se = sd / Math.sqrt(vals.length);
                const color = COLORS[gi % COLORS.length];
                return (
                  <g key={gi}>
                    <line x1={cx} y1={yS(m - se)} x2={cx} y2={yS(m + se)} stroke={color} strokeWidth={2.5} />
                    <line x1={cx - 5} y1={yS(m - se)} x2={cx + 5} y2={yS(m - se)} stroke={color} strokeWidth={1.5} />
                    <line x1={cx - 5} y1={yS(m + se)} x2={cx + 5} y2={yS(m + se)} stroke={color} strokeWidth={1.5} />
                    <rect x={cx - 10} y={yS(m) - 7} width={20} height={14} fill={color} opacity={0.8} rx={3} />
                    <text x={cx} y={yS(m) + 4} fill={t.bg} fontSize={FONT.sm} fontWeight={700} textAnchor="middle" fontFamily={FONT_STACK}>{m.toFixed(1)}</text>
                    <text x={cx} y={yOff + pad.top + ph + 14} fill={t.tx2} fontSize={FONT.xs} textAnchor="middle" fontFamily={FONT_STACK}>{gName}</text>
                    {vals.map((v, vi) => (
                      <circle key={vi} cx={cx + (vi % 2 === 0 ? -7 : 7)} cy={yS(v)} r={2} fill={color} opacity={0.3} />
                    ))}
                  </g>
                );
              })}
            </g>
          );
        })}
        <ChartLegend items={labels[0]?.[1]?.rawData ? Object.keys(labels[0][1].rawData).map((g, i) => ({ label: g, color: COLORS[i % COLORS.length] })) : []}
          x={W - 140} y={pad.top} t={t} fontSize={FONT.xs} />
      </svg>
    </ChartCard>
  );
}

function EffectSizeForest({ labels, t }) {
  const esLabels = labels.filter(([, lr]) => lr.effectSize?.measure);
  if (esLabels.length === 0) return null;
  const W = 680, H = Math.max(240, esLabels.length * 30 + 50);
  const pad = { left: 150, right: 100, top: 35, bottom: 25 };
  const plotW = W - pad.left - pad.right;
  const esValues = esLabels.map(([, lr]) => {
    const es = lr.effectSize;
    return es.cohensD || es.cohensDz || es.rankBiserial || es.matchedPairsR || es.etaSq || es.partialEtaSq || es.epsilonSq || es.kendallW || 0;
  });
  const xMin = Math.min(-0.2, ...esValues) - 0.2;
  const xMax = Math.max(0.2, ...esValues) + 0.2;
  const esSpan = safeRange(xMin, xMax);
  const xS = v => safeNum(pad.left + (v - xMin) / esSpan * plotW);
  const yS = i => pad.top + i * 30 + 18;

  const esMeasure = esLabels[0]?.[1]?.effectSize?.measure || "Effect Size";
  return (
    <ChartCard title={`Effect Size Forest Plot — All Landmarks (${esMeasure})`} t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <HGrid ticks={[xMin, 0, xMax]} yMin={pad.top} yMax={H - pad.bottom} xS={v => xS(v)} pad={pad} W={W} H={H} t={t} label={esMeasure} />
        {esLabels.map(([label, lr], i) => {
          const es = lr.effectSize;
          const val = esValues[i];
          const ci = es.ci95;
          const y = yS(i);
          const color = es.interpretation === "Negligible" ? t.tx3 : es.interpretation === "Small" ? t.acc : es.interpretation === "Medium" ? t.warn : t.err;
          const lines = wrapLabel(label, 18);
          return (
            <g key={i}>
              <SvgLabel x={pad.left - 8} y={y + 4} lines={lines} fill={t.tx} fontSize={FONT.sm} textAnchor="end" />
              {ci && <line x1={xS(ci[0])} y1={y} x2={xS(ci[1])} y2={y} stroke={color} strokeWidth={2.5} strokeLinecap="round" />}
              <rect x={xS(val) - 6} y={y - 6} width={12} height={12} fill={color} rx={2} />
              <text x={xS(val) + 14} y={y + 4} fill={t.tx2} fontSize={FONT.xs} fontFamily={FONT_STACK}>{val.toFixed(3)}</text>
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
}

function VolcanoPlot({ labels, results, t }) {
  const pLabels = labels.filter(([, lr]) => lr.result?.pValue != null && lr.effectSize?.measure);
  if (pLabels.length < 3) return null;
  const W = 450, H = 380;
  const pad = { left: 65, right: 30, top: 40, bottom: 45 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;
  const alpha = results.alpha || 0.05;
  const esValues = pLabels.map(([, lr]) => {
    const es = lr.effectSize;
    return es.cohensD || es.cohensDz || es.rankBiserial || es.matchedPairsR || es.etaSq || es.partialEtaSq || es.epsilonSq || es.kendallW || 0;
  });
  const pValues = pLabels.map(([, lr]) => lr.result.pValue);
  const logP = pValues.map(p => -Math.log10(Math.max(+p || 0, 1e-10)));
  const xMin = Math.min(-0.5, ...esValues) - 0.3;
  const xMax = Math.max(0.5, ...esValues) + 0.3;
  const yMax = Math.max(3, ...logP) * 1.15;
  const vSpan = safeRange(xMin, xMax);
  const xS = v => safeNum(pad.left + (v - xMin) / vSpan * pw);
  const yS = v => safeNum(pad.top + ph - v / (yMax || 1) * ph);

  return (
    <ChartCard title="Volcano Plot — Effect Size vs. Significance" t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <VGrid ticks={[0, yMax / 2, yMax]} xMin={pad.left} xMax={W - pad.right} yS={v => yS(v)} pad={pad} W={W} H={H} t={t} fmt={v => v.toFixed(1)} label={"\u2212log\u2081\u2080(p)"} />
        <HGrid ticks={[xMin, 0, xMax]} yMin={pad.top} yMax={H - pad.bottom} xS={v => xS(v)} pad={pad} W={W} H={H} t={t} label={esValues.length > 0 ? "Effect Size" : ""} />
        <RefLine x1={pad.left} y1={yS(-Math.log10(alpha))} x2={W - pad.right} y2={yS(-Math.log10(alpha))} stroke={t.err} label={"\u03b1=" + alpha} labelPos={{ x: pad.left + 4, y: yS(-Math.log10(alpha)) - 4 }} t={t} />
        {pLabels.map((entry, i) => {
          const x = xS(esValues[i]);
          const y = yS(logP[i]);
          const sig = pValues[i] < alpha;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={sig ? 5.5 : 3.5} fill={sig ? t.err : t.tx3} opacity={sig ? 0.85 : 0.5} />
              {sig && (
                <text x={x + 7} y={y + 3} fill={t.tx2} fontSize={FONT.xs} fontFamily={FONT_STACK}>
                  {entry[0].length > 10 ? entry[0].slice(0, 8) + "\u2026" : entry[0]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
}

function PValueHeatmap({ labels, results, t }) {
  const pLabels = labels.filter(([, lr]) => lr.result?.pValue != null);
  if (pLabels.length < 2) return null;
  const n = pLabels.length;
  const alpha = results.alpha || 0.05;
  const z = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 1;
      const p = pLabels[i][1].result.pValue;
      return j < i ? (p + (pLabels[j]?.[1]?.result?.pValue || 0)) / 2 : p;
    })
  );
  const allP = z.flat().filter(v => v != null && v !== 1);
  const maxP = allP.length > 0 ? Math.max(alpha * 2, ...allP) : 1;
  const mid = alpha / maxP;
  const displayTxt = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j || z[i][j] == null) return "";
      const p = z[i][j];
      return p < 0.001 ? "<.001" : p.toFixed(3).replace(/^0(?=\.)/, "");
    })
  );
  const hoverTxt = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i === j ? "diagonal" : `p = ${fmtP(z[i][j])}`
    )
  );
  const data = heatmapData(z, pLabels.map(([l]) => l), pLabels.map(([l]) => l), displayTxt, {
    zmin: 0, zmax: maxP,
    colorscale: [
      [0, "#dc2626"],
      [mid, "#fca5a5"],
      [mid + 0.01, "#e5e7eb"],
      [1, "#86efac"],
    ],
    customdata: hoverTxt,
    texttemplate: "%{text}",
    textfont: { color: "#1f2937", size: 9, family: "'DM Sans',sans-serif" },
    hovertemplate: "%{y} vs %{x}: <b>%{customdata}</b><extra></extra>",
  });
  return (
    <ChartCard title={`P-Value Pairwise Matrix (\u03b1 = ${alpha})`} t={t}>
      <PlotlyChart data={data} layout={heatmapLayout(t, { height: Math.max(350, n * 28 + 80) })} />
    </ChartCard>
  );
}

function PValueDotChart({ labels, results, t }) {
  const pLabels = labels.filter(([, lr]) => lr.result?.pValue != null);
  if (pLabels.length === 0) return null;
  const W = 550, H = pLabels.length * 28 + 50;
  const pad = { left: 130, right: 90, top: 30, bottom: 15 };
  const pw = W - pad.left - pad.right;
  const alpha = results.alpha || 0.05;
  const maxP = 0.2;
  const xS = v => pad.left + Math.min(v, maxP) / maxP * pw;

  return (
    <ChartCard title={`P-Values (\u03b1 = ${alpha})`} t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <HGrid ticks={[0, alpha, maxP]} yMin={pad.top} yMax={H - pad.bottom} xS={v => xS(v)} pad={pad} W={W} H={H} t={t} label="p-value" />
        {pLabels.map(([label, lr], i) => {
          const p = lr.result.pValue;
          const y = pad.top + i * 28 + 18;
          const sig = p < alpha;
          const lines = wrapLabel(label, 16);
          return (
            <g key={i}>
              <SvgLabel x={pad.left - 8} y={y + 3} lines={lines} fill={t.tx} fontSize={FONT.sm} textAnchor="end" />
              <circle cx={xS(p)} cy={y} r={sig ? 5.5 : 4} fill={sig ? t.err : t.ok} opacity={0.8} />
              <text x={xS(p) + (sig ? 10 : 8)} y={y + 3} fill={t.tx2} fontSize={FONT.xs} fontFamily={FONT_STACK}>{fmtP(p)}</text>
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LONGITUDINAL CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

export function LongitudinalCharts({ results, t }) {
  const labels = Object.entries(results.labels || {}).filter(([, lr]) => !lr.skip);
  if (labels.length === 0) return <div style={{ fontSize: FONT.md, color: t.tx3, textAlign: "center", padding: 20 }}>No chartable data.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <LongitudinalTrajectories labels={labels} t={t} />
      <MeanTrajectoryOverlay labels={labels} t={t} />
      <ChangeScoreHeatmap labels={labels} t={t} />
      <ChangeScoreChart labels={labels} t={t} />
    </div>
  );
}

function LongitudinalTrajectories({ labels, t }) {
  const W = 680, H = Math.max(300, labels.length * 280 + 20);
  const COLORS = [t.acc, t.err, t.warn, t.ok, "#a78bfa", "#f472b6", "#34d399", t.tx2];

  return (
    <ChartCard title="Individual Trajectories" t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {labels.map(([label, lr], idx) => {
          const rawData = lr.rawData || {};
          const tpNames = Object.keys(rawData);
          const allVals = tpNames.flatMap(tp => rawData[tp]?.values || []);
          const yMin = allVals.length > 0 ? Math.min(...allVals) - 2 : 0;
          const yMax = allVals.length > 0 ? Math.max(...allVals) + 2 : 100;
          const yOff = idx * 280 + 15;
          const pad = { left: 65, right: 25, top: 25, bottom: 30 };
          const pw = W - pad.left - pad.right;
          const ph = 240;
          const xS = i => pad.left + i * (pw / Math.max(tpNames.length - 1, 1));
          const tSpan = safeRange(yMin, yMax);
          const yS = v => safeNum(yOff + pad.top + ph - (v - yMin) / tSpan * ph);

          return (
            <g key={label}>
              <SvgLabel x={pad.left} y={yOff + pad.top - 4} lines={wrapLabel(label, 24)} fill={t.tx} fontSize={FONT.md} fontWeight={700} textAnchor="start" />
              <VGrid ticks={[yMin, (yMin + yMax) / 2, yMax]} xMin={pad.left} xMax={W - pad.right} yS={v => yS(v)} pad={pad} W={W} H={yOff + pad.top + ph + pad.bottom} t={t} label="" />
              {tpNames.map((tp, i) => (
                <text key={tp} x={xS(i)} y={yOff + pad.top + ph + 16} fill={t.tx2} fontSize={FONT.xs} textAnchor="middle" fontFamily={FONT_STACK}>{tp}</text>
              ))}
              {lr.nSubjects > 0 && Array.from({ length: lr.nSubjects }, (_, si) => {
                const pts = tpNames.map((tp, i) => {
                  const vals = rawData[tp]?.values || [];
                  return vals[si] != null ? `${xS(i)},${yS(vals[si])}` : null;
                }).filter(Boolean);
                if (pts.length < 2) return null;
                return <path key={si} d={`M${pts.join("L")}`} fill="none" stroke={t.tx3} strokeWidth={0.7} opacity={0.25} />;
              })}
              {(() => {
                const meanPts = tpNames.map((tp, i) => {
                  const vals = rawData[tp]?.values || [];
                  const m = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                  return m != null ? `${xS(i)},${yS(m)}` : null;
                }).filter(Boolean);
                if (meanPts.length < 2) return null;
                return (
                  <g>
                    <path d={`M${meanPts.join("L")}`} fill="none" stroke={COLORS[idx % COLORS.length]} strokeWidth={3} />
                    {tpNames.map((tp, i) => {
                      const vals = rawData[tp]?.values || [];
                      const m = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                      if (m == null) return null;
                      return <circle key={tp} cx={xS(i)} cy={yS(m)} r={4.5} fill={COLORS[idx % COLORS.length]} stroke={t.bg} strokeWidth={1.5} />;
                    })}
                  </g>
                );
              })()}
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
}

function MeanTrajectoryOverlay({ labels, t }) {
  const W = 560, H = 380;
  const pad = { left: 65, right: 30, top: 35, bottom: 50 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;
  const COLORS = PALETTE;

  const allTps = [...new Set(labels.flatMap(([, lr]) => Object.keys(lr.rawData || {})))].sort();
  if (allTps.length < 2) return null;

  const allMeans = labels.flatMap(([, lr]) => {
    const rd = lr.rawData || {};
    return allTps.flatMap(tp => { const v = rd[tp]?.values || []; return v.length ? [v.reduce((a, b) => a + b, 0) / v.length] : []; });
  });
  const yMin = Math.min(...allMeans) - 3;
  const yMax = Math.max(...allMeans) + 3;
  const xS = i => pad.left + i * pw / Math.max(allTps.length - 1, 1);
  const mSpan = safeRange(yMin, yMax);
  const yS = v => safeNum(pad.top + ph - (v - yMin) / mSpan * ph);

  return (
    <ChartCard title="Mean Trajectory Overlay — All Landmarks" t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <VGrid ticks={[yMin, (yMin + yMax) / 2, yMax]} xMin={pad.left} xMax={W - pad.right} yS={v => yS(v)} pad={pad} W={W} H={H} t={t} label="Mean value" />
        {allTps.map((tp, i) => (
          <text key={tp} x={xS(i)} y={H - pad.bottom + 16} fill={t.tx2} fontSize={FONT.sm} textAnchor="middle" fontFamily={FONT_STACK}>{tp}</text>
        ))}
        <XAxisTitle x={pad.left + pw / 2} y={H - 4} label="Timepoint" t={t} />
        {labels.map((entry, li) => {
          const rd = entry[1].rawData || {};
          const pts = allTps.map((tp, i) => {
            const vals = rd[tp]?.values || [];
            const m = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
            return m != null ? { x: xS(i), y: yS(m) } : null;
          }).filter(Boolean);
          if (pts.length < 2) return null;
          const color = COLORS[li % COLORS.length];
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join("");
          return (
            <g key={li}>
              <path d={d} fill="none" stroke={color} strokeWidth={2.5} opacity={0.8} />
              {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={4} fill={color} stroke={t.bg} strokeWidth={1.5} />)}
            </g>
          );
        })}
        <ChartLegend items={labels.map(([label], li) => ({ label, color: COLORS[li % COLORS.length] }))} x={W - pad.right -50} y={pad.top + 180} t={t} fontSize={FONT.xs} />
      </svg>
    </ChartCard>
  );
}

function ChangeScoreHeatmap({ labels, t }) {
  const hasChanges = labels.filter(([, lr]) => (lr.changeScores || []).length > 0);
  if (hasChanges.length < 2) return null;
  const allChanges = hasChanges.flatMap(([label, lr]) =>
    (lr.changeScores || []).map(c => ({ label, ...c })));
  const fromTo = [...new Set(allChanges.map(c => `${c.from}\u2192${c.to}`))];
  const nLabels = hasChanges.length;
  const nPairs = fromTo.length;
  const maxAbs = Math.max(...allChanges.map(c => Math.abs(c.meanChange)), 0.1);
  const z = Array.from({ length: nLabels }, (_, li) =>
    Array.from({ length: nPairs }, (_, fi) => {
      const entry = hasChanges[li];
      const c = (entry[1].changeScores || []).find(c => `${c.from}\u2192${c.to}` === fromTo[fi]);
      return c ? c.meanChange : null;
    })
  );
  const displayTxt = Array.from({ length: nLabels }, (_, li) =>
    Array.from({ length: nPairs }, (_, fi) => z[li][fi] != null ? z[li][fi].toFixed(1) : "")
  );
  const hoverTxt = Array.from({ length: nLabels }, (_, li) =>
    Array.from({ length: nPairs }, (_, fi) =>
      z[li][fi] != null ? `change = ${z[li][fi].toFixed(2)}` : "no data"
    )
  );
  const data = heatmapData(z, fromTo, hasChanges.map(([l]) => l), displayTxt, {
    zmin: -maxAbs, zmax: maxAbs,
    colorscale: [
      [0, "#b91c1c"],
      [0.25, "#fca5a5"],
      [0.5, "#e5e7eb"],
      [0.75, "#86efac"],
      [1, "#16a34a"],
    ],
    customdata: hoverTxt,
    texttemplate: "%{text}",
    textfont: { color: "#1f2937", size: 9, family: "'DM Sans',sans-serif" },
    hovertemplate: "%{y} \u2192 %{x}: <b>%{customdata}</b><extra></extra>",
  });
  return (
    <ChartCard title="Change Score Heatmap" t={t}>
      <PlotlyChart data={data} layout={heatmapLayout(t, { height: Math.max(350, nLabels * 28 + 80) })} />
    </ChartCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORRELATION CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

export function CorrelationCharts({ results, t }) {
  if (!results || results.note) return <div style={{ fontSize: FONT.md, color: t.tx3, textAlign: "center", padding: 20 }}>{results?.note || "No data."}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <CorrelationMatrixPlot results={results} t={t} />
      <ScatterPairPlot results={results} t={t} />
      <ResidualDiagnosticPlot results={results} t={t} />
      <ROCCurvePlot results={results} t={t} />
    </div>
  );
}

const CORR_SCALE = [
  [0, "#b91c1c"],
  [0.25, "#ef4444"],
  [0.4, "#fca5a5"],
  [0.5, "#e5e7eb"],
  [0.6, "#93c5fd"],
  [0.75, "#3b82f6"],
  [1, "#1d4ed8"],
];
const CORR_TFONT = { color: "#1f2937", size: 9, family: "'DM Sans',sans-serif" };

function CorrelationMatrixPlot({ results, t }) {
  const { vars, matrix, n, method } = results;
  if (!vars || vars.length < 2) return null;
  const m = vars.length;
  const z = Array.from({ length: m }, () => Array(m).fill(null));
  const displayTxt = Array.from({ length: m }, () => Array(m).fill(""));
  const hoverTxt = Array.from({ length: m }, () => Array(m).fill(""));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      if (i === j) { z[i][j] = 1; displayTxt[i][j] = "1"; hoverTxt[i][j] = "diagonal"; continue; }
      const d = matrix[vars[i]]?.[vars[j]];
      if (!d) continue;
      z[i][j] = d.r;
      displayTxt[i][j] = d.r.toFixed(2);
      hoverTxt[i][j] = `r=${d.r.toFixed(3)}${d.sigAdj ? "*" : " (ns)"}`;
    }
  }
  const data = heatmapData(z, vars, vars, displayTxt, {
    zmin: -1, zmax: 1,
    colorscale: CORR_SCALE,
    customdata: hoverTxt,
    texttemplate: "%{text}",
    textfont: CORR_TFONT,
    hovertemplate: "%{x} \u00d7 %{y}: <b>%{customdata}</b><extra></extra>",
  });
  const H = Math.max(400, m * 28 + 100);
  return (
    <ChartCard title={`Correlation Matrix \u2014 ${method} (n=${n})`} t={t}>
      <PlotlyChart data={data} layout={heatmapLayout(t, { height: H })} style={{ height: H }} />
    </ChartCard>
  );
}

function ScatterPairPlot({ results, t }) {
  const { vars, matrix, n, rawPairs, descriptive } = results;
  if (!vars || vars.length < 2 || !rawPairs) return null;
  const N = Math.min(vars.length, 7);
  const selected = vars.slice(0, N);

  const maxLen = Math.max(...selected.map(v => (rawPairs[v] || []).length));
  const validIdx = [];
  for (let idx = 0; idx < maxLen; idx++) {
    if (selected.every(v => rawPairs[v]?.[idx] != null && isFinite(rawPairs[v][idx]))) {
      validIdx.push(idx);
    }
  }
  if (validIdx.length < 2) return null;

  const dimensions = selected.map(v => ({
    label: v,
    values: validIdx.map(idx => rawPairs[v][idx]),
  }));

  const hoverTexts = validIdx.map(idx =>
    selected.map(v => `${v}=${rawPairs[v][idx].toFixed(2)}`).join(", ")
  );

  const annotations = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) {
        const d = descriptive?.[selected[i]];
        annotations.push({
          x: 0.5, y: 0.5,
          xref: `x${i + 1} domain`,
          yref: `y${i + 1} domain`,
          text: `<b>${selected[i]}</b><br>n=${d?.n || n}`,
          showarrow: false,
          font: { size: 10, color: t.tx2 },
          align: "center",
        });
      } else {
        const r = matrix[selected[i]]?.[selected[j]];
        if (!r) continue;
        annotations.push({
          x: 0.5, y: 0.5,
          xref: `x${j + 1} domain`,
          yref: `y${i + 1} domain`,
          text: `r=${r.r.toFixed(2)}${r.sigAdj ? "*" : ""}`,
          showarrow: false,
          font: { size: 9, color: t.bg },
          bgcolor: t.tx,
          opacity: 0.8,
        });
      }
    }
  }

  const axisCfg = {
    showgrid: true, gridcolor: t.surf3, zeroline: false,
    tickfont: { size: 8, color: t.tx3 },
    showline: false, ticks: "",
  };
  const layout = {
    paper_bgcolor: t.surf,
    plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    annotations,
    margin: { l: 40, r: 20, t: 50, b: 30 },
    hovermode: "closest",
  };
  for (let i = 0; i < N; i++) {
    layout[`xaxis${i + 1}`] = { ...axisCfg };
    layout[`yaxis${i + 1}`] = { ...axisCfg };
  }

  const CELL = 130;
  const pxH = N * CELL + 20;
  const data = [{
    type: "splom",
    dimensions,
    text: hoverTexts,
    hovertemplate: "<b>%{text}</b><extra></extra>",
    marker: { size: 3, color: t.acc, opacity: 0.5, line: { width: 0.5, color: t.bg } },
    diagonal: { visible: false },
  }];

  return (
      <ChartCard title={`Scatter Plot Matrix (${selected.length} vars)`} t={t}>
      <PlotlyChart data={data} layout={layout} style={{ height: pxH, minHeight: pxH }} />
    </ChartCard>
  );
}

function ResidualDiagnosticPlot({ results, t }) {
  const reg = results.regression;
  if (!reg) return null;
  const fitted = reg.fitted;
  const residuals = reg.residuals;
  const cooksd = reg.cooksd;
  if (!fitted || !residuals || fitted.length === 0) return null;
  const n = fitted.length;
  const W = 750, H = 280, pad = { left: 60, right: 30, top: 30, bottom: 40 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;

  const fMin = Math.min(...fitted), fMax = Math.max(...fitted);
  const rMax = Math.max(...residuals.map(r => Math.abs(r)), 0.1);
  const xS = v => pad.left + (v - fMin) / (fMax - fMin || 1) * pw;
  const yS = v => pad.top + ph / 2 - v / rMax * ph / 2;

  const cookArr = cooksd && cooksd.length ? cooksd : [];
  const sortedCooks = cookArr.length ? [...cookArr].sort((a, b) => b - a) : [];
  const cookMax = sortedCooks[0] || 0.1;

  return (
    <ChartCard title="Residual Diagnostics" t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <VGrid ticks={[-rMax, 0, rMax]} xMin={pad.left} xMax={pad.left + pw} yS={v => yS(v)} pad={pad} W={W} H={H} t={t} label="Residuals" />
        <HGrid ticks={[fMin, (fMin + fMax) / 2, fMax]} yMin={pad.top} yMax={pad.top + ph} xS={v => xS(v)} pad={pad} W={W} H={H} t={t} label="Fitted values" />
        <line x1={pad.left} y1={pad.top + ph / 2} x2={pad.left + pw} y2={pad.top + ph / 2} stroke={t.tx3} strokeWidth={0.5} />
        {fitted.map((f, i) => {
          if (residuals[i] == null) return null;
          return (
            <circle key={i} cx={xS(f)} cy={yS(residuals[i])} r={3}
              fill={Math.abs(residuals[i]) > 2 * rMax / ph * pw ? t.err : t.acc} opacity={0.6} />
          );
        })}
      </svg>

      {cookArr.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: FONT.md, fontWeight: 600, color: t.tx, marginBottom: 4 }}>Cook's Distance</div>
          <svg width="100%" viewBox={`0 0 ${W} 70`} style={{ overflow: "visible", display: "block" }}>
            {cookArr.map((c, i) => {
              const bw = Math.max(2, pw / cookArr.length - 1);
              return (
                <rect key={i} x={pad.left + i * (pw / cookArr.length)} y={58 - Math.min(c / cookMax, 1) * 42}
                  width={bw} height={Math.max(1, Math.min(c / cookMax, 1) * 42)}
                  fill={c > 4 / n ? t.err : t.acc} opacity={0.7} rx={1} />
              );
            })}
            <text x={pad.left + pw + 4} y={56} fill={t.tx3} fontSize={FONT.xs} fontFamily={FONT_STACK}>{cookMax.toFixed(3)}</text>
            <XAxisTitle x={pad.left + pw / 2} y={68} label="Observation index" t={t} />
          </svg>
        </div>
      )}
    </ChartCard>
  );
}

function ROCCurvePlot({ results, t }) {
  const log = results.logistic;
  if (!log || !log.roc) return null;
  const { roc, auc } = log;
  const W = 380, H = 390, pad = 45;
  const size = W - pad * 2;

  return (
    <ChartCard title={`ROC Curve — AUC = ${auc.toFixed(3)}`} t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <rect x={pad} y={pad} width={size} height={size} fill="none" stroke={t.bdr} strokeWidth={0.5} />
        <line x1={pad} y1={pad + size} x2={pad + size} y2={pad} stroke={t.bdr} strokeWidth={0.5} strokeDasharray="3,3" />
        {roc.map((p, i) => {
          if (i === 0) return null;
          const prev = roc[i - 1];
          return (
            <line key={i} x1={pad + prev.fpr * size} y1={pad + size - prev.tpr * size}
              x2={pad + p.fpr * size} y2={pad + size - p.tpr * size}
              stroke={t.acc} strokeWidth={2.5} />
          );
        })}
        <XAxisTitle x={pad + size / 2} y={H - 4} label="1 \u2212 Specificity (FPR)" t={t} />
        <YAxisTitle x={8} y={pad + size / 2} label="Sensitivity (TPR)" t={t} />
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <g key={v}>
            <text x={pad + v * size} y={pad + size + 14} fill={t.tx3} fontSize={FONT.xs} textAnchor="middle" fontFamily={FONT_STACK}>{v}</text>
            <text x={pad - 10} y={pad + size - v * size + 4} fill={t.tx3} fontSize={FONT.xs} textAnchor="end" fontFamily={FONT_STACK}>{v}</text>
          </g>
        ))}
      </svg>
    </ChartCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIAGNOSTIC CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

export function DiagnosticCharts({ results, t }) {
  if (!results || results.note) return <div style={{ fontSize: FONT.md, color: t.tx3, textAlign: "center", padding: 20 }}>{results?.note || "No data."}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DiagnosticROCCurves results={results} t={t} />
      <DiagnosticAUCComparison results={results} t={t} />
      <DiagnosticCalibrationPlot results={results} t={t} />
    </div>
  );
}

function DiagnosticROCCurves({ results, t }) {
  const { predictors } = results;
  const preds = Object.entries(predictors || {});
  if (preds.length === 0) return null;
  const pad = 45, W = 350, H = 350, size = W - 2 * pad;
  const COLORS = PALETTE;
  const sx = fpr => pad + fpr * size;
  const sy = tpr => pad + size - tpr * size;

  return (
    <ChartCard title="ROC Curves — All Predictors" t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <line x1={pad} y1={pad + size} x2={pad + size} y2={pad} stroke={t.tx3} strokeWidth={0.5} strokeDasharray="4,4" />
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <g key={v}>
            <line x1={sx(v)} y1={pad} x2={sx(v)} y2={pad + size} stroke={t.bdr} strokeWidth={0.5} strokeDasharray="3,3" />
            <line x1={pad} y1={sy(v)} x2={pad + size} y2={sy(v)} stroke={t.bdr} strokeWidth={0.5} strokeDasharray="3,3" />
          </g>
        ))}
        {preds.map(([, p], idx) => {
          if (!p.roc) return null;
          const path = p.roc.points.map((pt, i) => `${i === 0 ? "M" : "L"}${sx(pt.fpr)},${sy(pt.tpr)}`).join(" ");
          return <path key={idx} d={path} fill="none" stroke={COLORS[idx % COLORS.length]} strokeWidth={2.5} strokeLinejoin="round" />;
        })}
        <XAxisTitle x={W / 2} y={H - 4} label="1 \u2212 Specificity" t={t} />
        <YAxisTitle x={8} y={H / 2} label="Sensitivity" t={t} />
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
        {preds.map(([name, p], idx) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: COLORS[idx % COLORS.length] }} />
            <span style={{ fontSize: FONT.sm, fontFamily: FONT_STACK, color: t.tx }}>{name} (AUC={p.auc?.auc?.toFixed(3) || "—"})</span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

function DiagnosticAUCComparison({ results, t }) {
  const { comparisons } = results;
  if (!comparisons?.length) return null;
  const W = 550, H = comparisons.length * 44 + 50;
  const pad = { left: 140, right: 100, top: 30, bottom: 15 };
  const pw = W - pad.left - pad.right;
  const allDiffs = comparisons.map(c => c.diff);
  const absMax = Math.max(Math.abs(Math.min(...allDiffs, 0)), Math.abs(Math.max(...allDiffs, 0)), 0.05);
  const xS = v => safeNum(pad.left + (v + absMax) / (2 * absMax) * pw);

  return (
    <ChartCard title="AUC Comparisons" t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <HGrid ticks={[-absMax, 0, absMax]} yMin={pad.top} yMax={H - pad.bottom} xS={v => xS(v)} pad={pad} W={W} H={H} t={t} label="AUC difference" />
        {comparisons.map((c, i) => {
          const y = pad.top + i * 44 + 22;
          const lines = wrapLabel(`${c.A} vs ${c.B}`, 18);
          return (
            <g key={i}>
              <SvgLabel x={pad.left - 8} y={y + 3} lines={lines} fill={t.tx} fontSize={FONT.sm} textAnchor="end" />
              <line x1={xS(c.ci95[0])} y1={y} x2={xS(c.ci95[1])} y2={y} stroke={c.significant ? t.ok : t.tx3} strokeWidth={2.5} strokeLinecap="round" />
              <rect x={xS(c.diff) - 6} y={y - 6} width={12} height={12} fill={c.significant ? t.ok : t.tx3} rx={2} />
              <text x={xS(c.diff) + 12} y={y + 4} fill={t.tx2} fontSize={FONT.xs} fontFamily={FONT_STACK}>{c.diff.toFixed(3)} {c.significant ? "*" : ""}</text>
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
}

function DiagnosticCalibrationPlot({ results, t }) {
  const composite = results.composite;
  if (!composite?.calibration?.groups?.length) return null;
  const cal = composite.calibration;
  const W = 450, H = 390, pad = { left: 60, right: 40, top: 40, bottom: 50 };
  const pw = W - pad.left - pad.right, ph = H - pad.top - pad.bottom;
  const xS = v => pad.left + v * pw;
  const yS = v => pad.top + ph - v * ph;

  return (
    <ChartCard title="Calibration Plot — Composite Index" t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <HGrid ticks={[0, 0.25, 0.5, 0.75, 1]} yMin={pad.top} yMax={pad.top + ph} xS={v => xS(v)} pad={pad} W={W} H={H} t={t} label="Predicted probability" />
        <VGrid ticks={[0, 0.25, 0.5, 0.75, 1]} xMin={pad.left} xMax={pad.left + pw} yS={v => yS(v)} pad={pad} W={W} H={H} t={t} label="Observed proportion" />
        <line x1={xS(0)} y1={yS(0)} x2={xS(1)} y2={yS(1)} stroke={t.tx3} strokeWidth={1} strokeDasharray="4,4" />
        {cal.groups.map((g, i) => {
          const err = 1.96 * Math.sqrt(g.obsProp * (1 - g.obsProp) / g.n);
          return (
            <g key={i}>
              <line x1={xS(g.midpoint)} y1={yS(g.obsProp - err)} x2={xS(g.midpoint)} y2={yS(g.obsProp + err)} stroke={t.acc} strokeWidth={2} />
              <circle cx={xS(g.midpoint)} cy={yS(g.obsProp)} r={5} fill={t.acc} stroke={t.bg} strokeWidth={1.5} />
            </g>
          );
        })}
        <text x={W - pad.right} y={pad.top + 12} fill={t.tx2} fontSize={FONT.sm} textAnchor="end" fontFamily={FONT_STACK}>
          H-L &chi;²={cal.hlStat?.toFixed(1)} p={fmtP(cal.hlP)}
        </text>
      </svg>
    </ChartCard>
  );
}

function ChangeScoreChart({ labels, t }) {
  const allChanges = labels.flatMap(([label, lr]) =>
    (lr.changeScores || []).map(c => ({ label, ...c })));
  if (allChanges.length === 0) return null;
  const W = 550, H = allChanges.length * 28 + 50;
  const pad = { left: 130, right: 110, top: 30, bottom: 15 };
  const pw = W - pad.left - pad.right;
  const maxAbs = Math.max(...allChanges.map(c => Math.abs(c.meanChange)), 0.1);
  const xS = v => pad.left + (v + maxAbs) / (2 * maxAbs) * pw;

  return (
    <ChartCard title="Change Scores — All Landmarks" t={t}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <HGrid ticks={[-maxAbs, 0, maxAbs]} yMin={pad.top} yMax={H - pad.bottom} xS={v => xS(v)} pad={pad} W={W} H={H} t={t} label="Change score" />
        {allChanges.map((c, i) => {
          const y = pad.top + i * 28 + 18;
          const isIncrease = c.meanChange > 0;
          const lines = wrapLabel(c.label, 14);
          return (
            <g key={i}>
              <SvgLabel x={pad.left - 85} y={y + 3} lines={lines} fill={t.tx} fontSize={FONT.sm} textAnchor="end" />
              <rect x={xS(Math.min(0, c.meanChange))} y={y - 5}
                width={Math.abs(xS(c.meanChange) - xS(0))} height={10}
                fill={isIncrease ? t.err : t.ok} opacity={0.6} rx={2} />
              <text x={xS(c.meanChange) + (isIncrease ? 6 : -6)} y={y + 4}
                fill={t.tx2} fontSize={FONT.xs}
                textAnchor={isIncrease ? "start" : "end"} fontFamily={FONT_STACK}>
                {c.from}→{c.to}: {c.meanChange.toFixed(2)}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
}
