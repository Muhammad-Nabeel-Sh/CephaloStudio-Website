import { ChartCard, FONT, FONT_STACK, PALETTE } from "./moduleChartsUtils.jsx";
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
  if (details.length === 0) return null;
  const labels = details.map(d => d.label);
  const iccVals = details.map(d => d.icc);
  const ciL = details.map(d => d.ci95?.[0] ?? d.icc - 0.2);
  const ciU = details.map(d => d.ci95?.[1] ?? d.icc + 0.2);
  const colors = details.map(d => d.icc >= 0.9 ? t.ok : d.icc >= 0.75 ? t.acc : d.icc >= 0.5 ? t.warn : t.err);
  const xMin = Math.min(0, ...ciL) - 0.1;
  const xMax = Math.max(1, ...ciU) + 0.1;

  const ciTrace = {
    type: "scatter", mode: "markers",
    x: iccVals, y: labels,
    marker: { color: colors, size: 10, symbol: "diamond", line: { width: 1, color: t.bg } },
    error_x: {
      type: "data", symmetric: false, thickness: 2.5, width: 0,
      array: iccVals.map((v, i) => ciU[i] - v),
      arrayminus: iccVals.map((v, i) => v - ciL[i]),
      color: colors,
    },
    hovertemplate: "%{y}: %{x:.3f} [%{customdata[0]:.3f}, %{customdata[1]:.3f}]<extra></extra>",
    customdata: iccVals.map((v, i) => [ciL[i], ciU[i]]),
    showlegend: false,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 140, r: 60, t: 15, b: 45 },
    xaxis: { title: "Intraclass Correlation Coefficient (ICC)", range: [xMin, xMax], gridcolor: t.surf3, zeroline: false, dtick: 0.25 },
    yaxis: { autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 9 } },
    height: Math.max(220, details.length * 30 + 50),
    shapes: [{
      type: "line", x0: 0.75, x1: 0.75, y0: -0.5, y1: labels.length - 0.5,
      line: { color: t.tx + "70", width: 1, dash: "dash" }, layer: "below",
    }],
    annotations: [{
      x: 0.75, y: 1, xref: "x", yref: "paper",
      text: "ICC=0.75", showarrow: false, font: { size: 9, color: t.tx3 },
      yanchor: "bottom", xanchor: "center",
    }],
  };

  return <ChartCard title="ICC Forest Plot — All Landmarks" t={t}>
    <PlotlyChart data={[ciTrace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
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
  const chartable = details.filter(d => d.meanDiff != null).slice(0, 8);
  if (chartable.length === 0) return null;
  const COLORS = [t.acc, t.err, t.warn, t.ok, t.tx2, "#a78bfa", "#f472b6", "#34d399"];

  const points = chartable.flatMap((d, idx) => {
    const n = Math.min(d.n || 20, 50);
    return Array.from({ length: n }, (_, i) => {
      const t2 = (i + 0.5) / n;
      const mn = 50 + t2 * 100;
      const z = (t2 - 0.5) * 4;
      return { label: d.label, mean: mn, diff: d.meanDiff + z * d.sdDiff, idx };
    });
  });
  const xMin = Math.min(...points.map(v => v.mean)) - 10;
  const xMax = Math.max(...points.map(v => v.mean)) + 10;
  const allDiffs = chartable.map(d => d.meanDiff);
  const allMargins = chartable.map(d => d.sdDiff * 3);
  const yMin = Math.min(...allDiffs) - Math.max(...allMargins);
  const yMax = Math.max(...allDiffs) + Math.max(...allMargins);

  const pointTrace = {
    type: "scatter", mode: "markers",
    x: points.map(p => p.mean), y: points.map(p => p.diff),
    marker: {
      color: points.map(p => COLORS[p.idx % COLORS.length]),
      size: 4, opacity: 0.4,
    },
    hovertemplate: "Mean: %{x:.1f}<br>Diff: %{y:.1f}<br>%{text}<extra></extra>",
    text: points.map(p => p.label),
    showlegend: false,
  };

  const refTraces = [
    { type: "scatter", mode: "lines", x: [xMin, xMax], y: [0, 0], line: { color: t.acc, width: 1.5, dash: "dash" }, name: "Zero bias", showlegend: true },
    ...chartable.map((d, idx) => ({
      type: "scatter", mode: "lines", x: [xMin, xMax], y: [d.meanDiff, d.meanDiff],
      line: { color: COLORS[idx % COLORS.length], width: 1, dash: "dot" },
      name: d.label, showlegend: true,
    })),
  ];

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 55, r: 20, t: 15, b: 45 },
    xaxis: { title: "Mean of measurements", gridcolor: t.surf3, zeroline: false, range: [xMin, xMax] },
    yaxis: { title: "Difference", gridcolor: t.surf3, zeroline: false, range: [yMin, yMax] },
    legend: { orientation: "h", y: 1.02, x: 0.5, xanchor: "center", font: { size: 9 } },
    height: 400,
  };
  return <ChartCard title="Collective Bland-Altman — All Landmarks" t={t}><PlotlyChart data={[...refTraces, pointTrace]} layout={layout} style={{ height: layout.height }} /></ChartCard>;
}

function ErrorMapPlot({ results, t }) {
  const map = results.landmarkMap;
  if (!map) return null;
  const entries = Object.entries(map);
  const labels = entries.map(([l]) => l);
  const meanErr = entries.map(([, v]) => v.meanError || 0);
  const sdErr = entries.map(([, v]) => v.sdError || 0);
  const maxErr = entries.map(([, v]) => v.maxError);
  const maxV = Math.max(...entries.map(([, v]) => Math.max(v.meanError || 0, v.sdError || 0, v.maxError || 0)), 1);

  const sdTrace = {
    type: "bar", orientation: "h",
    y: labels, x: sdErr,
    marker: { color: t.acc, opacity: 0.6 },
    showlegend: true, name: "SD Error",
    hovertemplate: "%{y}: SD = %{x:.2f} mm<extra></extra>",
  };
  const meanTrace = {
    type: "bar", orientation: "h",
    y: labels, x: meanErr,
    marker: { color: t.warn, opacity: 0.6 },
    showlegend: true, name: "Mean Error",
    hovertemplate: "%{y}: Mean = %{x:.2f} mm<extra></extra>",
  };
  const maxTrace = {
    type: "scatter", mode: "markers",
    y: labels, x: maxErr,
    marker: { color: t.err, size: 7, symbol: "circle" },
    showlegend: true, name: "Max Error",
    hovertemplate: "%{y}: Max = %{x:.2f} mm<extra></extra>",
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 130, r: 30, t: 15, b: 45 },
    xaxis: { title: "Error (mm)", range: [0, maxV * 1.1], gridcolor: t.surf3, zeroline: false },
    yaxis: { autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 9 } },
    height: Math.max(240, entries.length * 24 + 50),
    barmode: "overlay",
    legend: { orientation: "h", y: 1.02, x: 0.5, xanchor: "center", font: { size: 9 } },
  };

  return <ChartCard title="Landmark Error Map — All Landmarks" t={t}>
    <PlotlyChart data={[sdTrace, meanTrace, maxTrace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function MethodErrorBarPlot({ details, t }) {
  const chartable = details.filter(d => d.dahlberg != null || d.sem != null).slice(0, 20);
  if (chartable.length === 0) return null;
  const labels = chartable.map(d => d.label);
  const dahlberg = chartable.map(d => d.dahlberg);
  const sem = chartable.map(d => d.sem);
  const mdc = chartable.map(d => d.mdc);
  const maxV = Math.max(...chartable.flatMap(d => [d.dahlberg || 0, d.sem || 0, d.mdc || 0])) || 1;

  const dahlbergTrace = {
    type: "bar", orientation: "h",
    y: labels, x: dahlberg,
    marker: { color: t.acc, opacity: 0.7 },
    showlegend: true, name: "Dahlberg",
    hovertemplate: "%{y}: Dahlberg = %{x:.2f} mm<extra></extra>",
  };
  const semTrace = {
    type: "bar", orientation: "h",
    y: labels, x: sem,
    marker: { color: t.warn, opacity: 0.7 },
    showlegend: true, name: "SEM",
    hovertemplate: "%{y}: SEM = %{x:.2f} mm<extra></extra>",
  };
  const mdcTrace = {
    type: "scatter", mode: "markers",
    y: labels, x: mdc,
    marker: { color: t.err, size: 8, symbol: "diamond" },
    showlegend: true, name: "MDC",
    hovertemplate: "%{y}: MDC = %{x:.2f} mm<extra></extra>",
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 130, r: 30, t: 15, b: 45 },
    xaxis: { title: "Error (mm)", range: [0, maxV * 1.1], gridcolor: t.surf3, zeroline: false },
    yaxis: { autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 9 } },
    height: Math.max(240, chartable.length * 24 + 50),
    barmode: "overlay",
    legend: { orientation: "h", y: 1.02, x: 0.5, xanchor: "center", font: { size: 9 } },
  };

  return <ChartCard title="Method Error Comparison — All Landmarks" t={t}>
    <PlotlyChart data={[dahlbergTrace, semTrace, mdcTrace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
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
      <DescriptiveBarChart combined={combined} labels={labels} t={t} />
      <DescriptiveScatterPlot combined={combined} labels={labels} t={t} />
    </div>
  );
}

function DistributionsChart({ combined, labels, t }) {
  const COLORS = [t.acc, t.err, t.warn, t.ok, "#a78bfa", "#f472b6", "#34d399", t.tx2];
  const valid = labels.filter(l => {
    const s = combined[l]?.stats;
    return s && s.n >= 2 && s.sd && isFinite(s.sd);
  });
  if (valid.length === 0) return null;

  return (
    <ChartCard title="Distributions with Normal Curve Overlay" t={t}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {valid.map((label, idx) => {
          const s = combined[label].stats;
          const color = COLORS[idx % COLORS.length];
          const vals = combined[label].values || [];
          const hMin = s.mean - 3.5 * s.sd;
          const hMax = s.mean + 3.5 * s.sd;
          const nBins = 20;

          const binW = (hMax - hMin) / nBins || 1;
          const bins = Array.from({ length: nBins }, (_, i) => ({ x0: hMin + i * binW, x1: hMin + (i + 1) * binW, count: 0 }));
          for (const v of vals) {
            const bi = Math.min(Math.floor((v - hMin) / binW), nBins - 1);
            if (bi >= 0) bins[bi].count++;
          }
          const maxCount = Math.max(...bins.map(b => b.count), 1);

          const cX = [], cY = [];
          for (let s2 = 0; s2 <= 60; s2++) {
            const v = hMin + s2 * (hMax - hMin) / 60;
            const z = (v - s.mean) / s.sd;
            cX.push(v);
            cY.push(Math.exp(-0.5 * z * z) / (s.sd * Math.sqrt(2 * Math.PI)) * s.n * binW);
          }
          const yMax = Math.max(maxCount, ...cY) * 1.2 || 1;

          const data = [
            {
              type: "bar", x: bins.map(b => (b.x0 + b.x1) / 2), y: bins.map(b => b.count),
              width: binW * 0.85,
              marker: { color, opacity: 0.5, line: { color, width: 0.5 } },
              showlegend: false,
              hovertemplate: "[%{x:.1f}, %{customdata:.1f}): %{y}<extra></extra>",
              customdata: bins.map(b => b.x1),
            },
            {
              type: "scatter", mode: "lines",
              x: cX, y: cY,
              line: { color, width: 2 },
              showlegend: false,
              hovertemplate: "%{x:.2f}<br>Count: %{y:.1f}<extra></extra>",
            },
            {
              type: "scatter", mode: "lines",
              x: [s.mean, s.mean], y: [0, yMax * 0.8],
              line: { color: t.err, width: 1.5, dash: "dash" },
              showlegend: false,
            },
          ];

          const layout = {
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            font: { color: t.tx2, family: FONT_STACK, size: 9 },
            margin: { l: 50, r: 16, t: 22, b: 4 },
            xaxis: { showgrid: false, zeroline: false, showticklabels: false, ticks: "" },
            yaxis: { showgrid: false, zeroline: false, showticklabels: false, ticks: "", range: [0, yMax] },
            height: 130,
            annotations: [
              {
                x: 0.02, y: 0.92, xref: "paper", yref: "paper",
                text: `<b>${label}</b>  n=${s.n}  μ=${s.mean.toFixed(1)}`,
                showarrow: false, xanchor: "left", yanchor: "top",
                font: { size: 10, color },
              },
            ],
          };

          return <PlotlyChart key={label} data={data} layout={layout} style={{ height: 120 }} />;
        })}
      </div>
    </ChartCard>
  );
}

// ─── Raincloud Plot (violin + boxplot + jitter) ──────────────────────────────
function RaincloudPlot({ combined, labels, t }) {
  const COLORS = [t.acc, t.err, t.warn, t.ok, "#a78bfa", "#f472b6", "#34d399", t.tx2];
  const valid = labels.filter(l => {
    const s = combined[l]?.stats;
    return s && s.n >= 2 && s.sd && isFinite(s.sd);
  });
  if (valid.length === 0) return null;
  const traces = valid.flatMap((label, idx) => {
    const color = COLORS[idx % COLORS.length];
    const vals = combined[label].values || [];
    return [
      {
        type: "violin", orientation: "h",
        y: vals.map(() => label), x: vals,
        name: label,
        scalemode: "width",
        bandwidth: Math.max(...vals) - Math.min(...vals) > 0 ? undefined : 1,
        box: { visible: true, width: 0.25 },
        points: "all", jitter: 0.4, pointpos: 1.8,
        marker: { size: 4, opacity: 0.6, color, line: { width: 0.5, color } },
        line: { color, width: 1.5 },
        fillcolor: color + "55",
        meanline: { visible: true, color: t.err },
        spanmode: "hard",
        showlegend: false,
        hovertemplate: `<b>${label}</b><br>%{x:.2f}<br>Q1: %{q1:.2f}, Median: %{median:.2f}, Q3: %{q3:.2f}<br>Mean: %{mean:.2f}<extra></extra>`,
      },
    ];
  });
  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 100, r: 30, t: 10, b: 40 },
    xaxis: { zeroline: false, gridcolor: t.surf3, tickfont: { size: 9 } },
    yaxis: { autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 9 } },
    height: Math.max(300, valid.length * 150),
    violingap: 0.4,
    violingroupgap: 0.4,
  };
  return <ChartCard title="Raincloud Plot — Distribution, Box Plot & Raw Data" t={t}><PlotlyChart data={traces} layout={layout} style={{ height: layout.height }} /></ChartCard>;
}

function CVBarChart({ combined, labels, t }) {
  const chartable = labels.map(l => ({ label: l, cv: combined[l]?.stats?.sd / combined[l]?.stats?.mean })).filter(d => d.cv != null && isFinite(d.cv));
  if (chartable.length < 2) return null;
  const sorted = [...chartable].sort((a, b) => b.cv - a.cv);
  const sortedLabels = sorted.map(d => d.label);
  const sortedCV = sorted.map(d => d.cv);
  const maxCV = Math.max(...sortedCV) * 1.15;
  const barColors = sorted.map(d => {
    const pct = d.cv * 100;
    return pct > 15 ? t.err : pct > 10 ? t.warn : t.ok;
  });
  const pctText = sorted.map(d => (d.cv * 100).toFixed(1) + "%");

  const data = [{
    type: "bar", orientation: "h",
    y: sortedLabels, x: sortedCV,
    marker: { color: barColors, opacity: 0.7 },
    text: pctText,
    textposition: "outside",
    textfont: { size: 9, color: t.tx2, family: FONT_STACK },
    hovertemplate: "%{y}: %{text}<extra></extra>",
    showlegend: false,
  }];

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 110, r: 60, t: 15, b: 45 },
    xaxis: { title: "Coefficient of Variation (%)", range: [0, maxCV], gridcolor: t.surf3, zeroline: false,
      tickformat: ",.0%", dtick: maxCV / 2 },
    yaxis: { autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 9 } },
    height: Math.max(220, sorted.length * 22 + 50),
    bargap: 0.2,
  };

  return <ChartCard title="Coefficient of Variation — All Landmarks" t={t}>
    <PlotlyChart data={data} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function DescriptiveBarChart({ combined, labels, t }) {
  const valid = labels.filter(l => {
    const s = combined[l]?.stats;
    return s && isFinite(s.mean) && isFinite(s.sd);
  });
  if (valid.length === 0) return null;
  const means = valid.map(l => combined[l].stats.mean);
  const sds = valid.map(l => combined[l].stats.sd);
  const nns = valid.map(l => combined[l].stats.n);
  const hasNeg = means.some(m => m < 0);
  const barTrace = {
    type: "bar", orientation: "h",
    y: [...valid].reverse(), x: [...means].reverse(),
    marker: { color: t.acc, opacity: 0.7 },
    text: [...valid].reverse().map((l, i) => `${means[valid.length - 1 - i].toFixed(2)} ± ${sds[valid.length - 1 - i].toFixed(2)}`),
    textposition: "outside",
    textfont: { size: 9 },
    hovertemplate: "%{y}: %{text}<br>n = %{customdata}<extra></extra>",
    customdata: [...nns].reverse(),
    showlegend: false,
  };
  const errTrace = {
    type: "scatter", mode: "markers",
    y: [...valid].reverse(),
    x: [...means].reverse(),
    error_x: {
      type: "data", symmetric: true,
      array: [...sds].reverse(),
      color: t.tx2, thickness: 1.5, width: 6,
    },
    marker: { size: 0, opacity: 0 },
    showlegend: false,
    hoverinfo: "skip",
  };
  const xMin = Math.min(0, ...means) - Math.max(...sds) * 1.2;
  const xMax = Math.max(0, ...means) + Math.max(...sds) * 1.2;
  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 120, r: 80, t: 10, b: 40 },
    xaxis: { title: "Mean ± SD", range: [xMin, xMax], gridcolor: t.surf3, zeroline: hasNeg, zerolinecolor: t.bdr },
    yaxis: { autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 9 } },
    height: Math.max(220, valid.length * 26 + 60),
    bargap: 0.3,
  };
  return <ChartCard title="Descriptive Bar Chart — Means with Error Bars (SD)" t={t}><PlotlyChart data={[barTrace, errTrace]} layout={layout} style={{ height: layout.height }} /></ChartCard>;
}

function DescriptiveScatterPlot({ combined, labels, t }) {
  const valid = labels.filter(l => {
    const vals = combined[l]?.values;
    return vals && vals.length > 0;
  });
  if (valid.length === 0) return null;
  const COLORS = [t.acc, t.err, t.warn, t.ok, "#a78bfa", "#f472b6", "#34d399", t.tx2];
  const traces = valid.map((l, idx) => {
    const vals = combined[l].values || [];
    return {
      type: "scatter", mode: "markers",
      x: vals, y: vals.map(() => l),
      marker: { color: COLORS[idx % COLORS.length], size: 5, opacity: 0.5, line: { width: 0.5, color: COLORS[idx % COLORS.length] } },
      name: l,
      hovertemplate: `<b>${l}</b>: %{x:.2f}<extra></extra>`,
    };
  });
  const allV = valid.flatMap(l => combined[l].values || []);
  const xMin = Math.min(...allV) - (Math.max(...allV) - Math.min(...allV)) * 0.1;
  const xMax = Math.max(...allV) + (Math.max(...allV) - Math.min(...allV)) * 0.1;
  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 100, r: 20, t: 10, b: 45 },
    xaxis: { title: "Value", range: [xMin, xMax], gridcolor: t.surf3, zeroline: false },
    yaxis: { autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 9 } },
    height: Math.max(220, valid.length * 28 + 60),
    showlegend: false,
  };
  return <ChartCard title="Scatter Plot — Clustered by Variable" t={t}><PlotlyChart data={traces} layout={layout} style={{ height: layout.height }} /></ChartCard>;
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
  const valid = labels.filter(l => {
    const s = combined[l]?.stats;
    return s && s.n >= 2;
  });
  if (valid.length < 2) return null;

  const traces = [{
    type: "box", orientation: "h",
    y: valid.flatMap(l => {
      const vals = combined[l].values || [];
      return vals.map(() => l);
    }),
    x: valid.flatMap(l => combined[l].values || []),
    boxmean: "sd",
    marker: { color: t.acc, opacity: 0.35, line: { color: t.acc, width: 1 } },
    line: { color: t.acc, width: 1 },
    fillcolor: t.acc + "4D",
    whiskerwidth: 0.6,
    showlegend: false,
    hovertemplate: "%{y}: Q1=%{q1:.2f}, Median=%{median:.2f}, Q3=%{q3:.2f}<br>Mean=%{mean:.2f}, SD=%{sd:.2f}<extra></extra>",
  }];

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 90, r: 20, t: 10, b: 45 },
    xaxis: { gridcolor: t.surf3, zeroline: false, title: "Value" },
    yaxis: { zeroline: false, showgrid: false, tickfont: { size: 9 } },
    height: Math.max(220, valid.length * 40 + 60),
  };

  return <ChartCard title="Box Plots — All Landmarks" t={t}>
    <PlotlyChart data={traces} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
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
  const COLORS = PALETTE;
  const title = "Group Means — All Landmarks";

  return (
    <ChartCard title={title} t={t}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {labels.map(([label, lr]) => {
          const rawData = lr.rawData || {};
          const groups = Object.entries(rawData);
          if (groups.length === 0) return null;
          const allVals = groups.flatMap(([, g]) => g.values || []);
          if (allVals.length === 0) return null;
          const yMin = Math.min(...allVals);
          const yMax = Math.max(...allVals);
          const yPad = (yMax - yMin) * 0.15 || 1;
          const nGroups = groups.length;

          const means = [], ses = [], gNames = [], individualTraces = [];
          groups.forEach(([gName, gData], gi) => {
            const vals = gData.values || [];
            const m = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
            const sd = vals.length > 1 ? Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1)) : 0;
            const se = sd / Math.sqrt(vals.length);
            const color = COLORS[gi % COLORS.length];
            means.push(m);
            ses.push(se);
            gNames.push(gName);
            individualTraces.push({
              type: "scatter", mode: "markers",
              x: vals.map(() => gi), y: vals,
              marker: { color, size: 4, opacity: 0.3, symbol: "circle" },
              showlegend: false, hoverinfo: "skip",
            });
          });

          const meanTrace = {
            type: "scatter", mode: "markers",
            x: gNames, y: means,
            marker: { color: COLORS.slice(0, nGroups), size: 12, symbol: "square", line: { width: 1.5, color: t.bg } },
            error_y: {
              type: "data", symmetric: true,
              array: ses, color: COLORS.slice(0, nGroups),
              thickness: 2, width: 6,
            },
            text: means.map(m => m.toFixed(1)),
            textposition: "middle center",
            textfont: { size: 9, color: t.bg, family: FONT_STACK },
            hovertemplate: "%{x}: %{y:.2f} ± %{customdata:.2f}<extra></extra>",
            customdata: ses,
            showlegend: false,
          };

          const l = {
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            font: { color: t.tx2, family: FONT_STACK, size: 9 },
            margin: { l: 20, r: 12, t: 20, b: 18 },
            xaxis: { showgrid: false, zeroline: false, tickfont: { size: 8 } },
            yaxis: { range: [yMin - yPad, yMax + yPad], gridcolor: t.surf3, zeroline: false, tickfont: { size: 8 } },
            height: 130,
            annotations: [{
              x: 0, y: 1.1, xref: "paper", yref: "paper",
              text: `<b>${label}</b>`, showarrow: false,
              xanchor: "left", yanchor: "top",
              font: { size: 11, color: t.tx },
            }],
          };

          return <PlotlyChart key={label} data={[...individualTraces, meanTrace]} layout={l} style={{ height: 110 }} />;
        })}
      </div>
    </ChartCard>
  );
}

function EffectSizeForest({ labels, t }) {
  const esLabels = labels.filter(([, lr]) => lr.effectSize?.measure);
  if (esLabels.length === 0) return null;
  const esVals = esLabels.map(([, lr]) => {
    const es = lr.effectSize;
    return es.cohensD || es.cohensDz || es.rankBiserial || es.matchedPairsR || es.etaSq || es.partialEtaSq || es.epsilonSq || es.kendallW || 0;
  });
  const cis = esLabels.map(([, lr]) => lr.effectSize.ci95);
  const ciLower = esVals.map((v, i) => cis[i]?.[0] ?? v - 0.2);
  const ciUpper = esVals.map((v, i) => cis[i]?.[1] ?? v + 0.2);
  const labels_n = esLabels.map(([l]) => l);
  const xMin = Math.min(-0.2, ...ciLower) - 0.2;
  const xMax = Math.max(0.2, ...ciUpper) + 0.2;
  const esMeasure = esLabels[0]?.[1]?.effectSize?.measure || "Effect Size";
  const colors = esLabels.map(([, lr]) => {
    const interp = lr.effectSize.interpretation;
    return interp === "Negligible" ? t.tx3 : interp === "Small" ? t.acc : interp === "Medium" ? t.warn : t.err;
  });

  const trace = {
    type: "scatter", mode: "markers",
    x: esVals, y: labels_n,
    marker: { color: colors, size: 11, symbol: "square", line: { width: 1, color: t.bg } },
    error_x: {
      type: "data", symmetric: false, thickness: 2.5, width: 0,
      array: esVals.map((v, i) => ciUpper[i] - v),
      arrayminus: esVals.map((v, i) => v - ciLower[i]),
      color: colors,
    },
    hovertemplate: "%{y}: %{x:.3f} [%{customdata[0]:.3f}, %{customdata[1]:.3f}]<extra></extra>",
    customdata: esVals.map((v, i) => [ciLower[i], ciUpper[i]]),
    showlegend: false,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 140, r: 60, t: 15, b: 45 },
    xaxis: { title: esMeasure, range: [xMin, xMax], gridcolor: t.surf3, zeroline: true, zerolinecolor: t.tx3 },
    yaxis: { autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 9 } },
    height: Math.max(240, esLabels.length * 30 + 50),
  };

  return <ChartCard title={`Effect Size Forest Plot — All Landmarks (${esMeasure})`} t={t}>
    <PlotlyChart data={[trace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function VolcanoPlot({ labels, results, t }) {
  const pLabels = labels.filter(([, lr]) => lr.result?.pValue != null && lr.effectSize?.measure);
  if (pLabels.length < 3) return null;
  const alpha = results.alpha || 0.05;
  const esValues = pLabels.map(([, lr]) => {
    const es = lr.effectSize;
    return es.cohensD || es.cohensDz || es.rankBiserial || es.matchedPairsR || es.etaSq || es.partialEtaSq || es.epsilonSq || es.kendallW || 0;
  });
  const pValues = pLabels.map(([, lr]) => lr.result.pValue);
  const logP = pValues.map(p => -Math.log10(Math.max(+p || 0, 1e-10)));
  const xMin = Math.min(-0.5, ...esValues) - 0.3;
  const xMax = Math.max(0.5, ...esValues) + 0.3;
  const yMaxVal = Math.max(3, ...logP) * 1.15;
  const sigFlags = pValues.map(p => p < alpha);
  const plotLabels = pLabels.map(([l]) => l.length > 10 ? l.slice(0, 8) + "\u2026" : l);

  const sigTrace = {
    type: "scatter", mode: "markers+text",
    x: esValues.filter((_, i) => sigFlags[i]),
    y: logP.filter((_, i) => sigFlags[i]),
    text: plotLabels.filter((_, i) => sigFlags[i]),
    textposition: "right",
    textfont: { size: 9, color: t.tx2, family: FONT_STACK },
    marker: { color: t.err, size: 8, opacity: 0.85 },
    name: `Significant (p<${alpha})`,
    hovertemplate: "%{text}: ES=%{x:.3f}, -log10(p)=%{y:.2f}<extra></extra>",
  };
  const nsTrace = {
    type: "scatter", mode: "markers",
    x: esValues.filter((_, i) => !sigFlags[i]),
    y: logP.filter((_, i) => !sigFlags[i]),
    marker: { color: t.tx3, size: 5, opacity: 0.5 },
    name: "Not significant",
    showlegend: true,
    hovertemplate: "ES=%{x:.3f}, -log10(p)=%{y:.2f}<extra></extra>",
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 55, r: 30, t: 15, b: 50 },
    xaxis: { title: "Effect Size", range: [xMin, xMax], gridcolor: t.surf3, zeroline: true, zerolinecolor: t.tx3 },
    yaxis: { title: "\u2212log\u2081\u2080(p)", range: [0, yMaxVal], gridcolor: t.surf3, zeroline: false },
    height: 380,
    shapes: [{
      type: "line", y0: -Math.log10(alpha), y1: -Math.log10(alpha),
      x0: xMin, x1: xMax,
      line: { color: t.err, width: 1, dash: "dash" },
    }],
    annotations: [{
      x: xMin + 0.02 * (xMax - xMin), y: -Math.log10(alpha),
      text: "\u03b1=" + alpha, showarrow: false,
      font: { size: 9, color: t.err },
      yanchor: "bottom",
    }],
    legend: { orientation: "h", y: 1.02, x: 0.5, xanchor: "center", font: { size: 9 } },
  };

  return <ChartCard title="Volcano Plot — Effect Size vs. Significance" t={t}>
    <PlotlyChart data={[nsTrace, sigTrace]} layout={layout} style={{ height: 380 }} />
  </ChartCard>;
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
  const alpha = results.alpha || 0.05;
  const maxP = 0.2;
  const plotLabels = pLabels.map(([l]) => l);
  const pVals = pLabels.map(([, lr]) => lr.result.pValue);
  const sigFlags = pVals.map(p => p < alpha);
  const colors = sigFlags.map(s => s ? t.err : t.ok);

  const trace = {
    type: "scatter", mode: "markers+text",
    x: pVals, y: plotLabels,
    marker: {
      color: colors, size: sigFlags.map(s => s ? 10 : 7),
      opacity: 0.8, symbol: "circle",
    },
    text: pVals.map(p => fmtP(p)),
    textposition: "right",
    textfont: { size: 9, color: t.tx2, family: FONT_STACK },
    hovertemplate: "%{y}: p = %{x:.4f}<extra></extra>",
    showlegend: false,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 110, r: 70, t: 15, b: 45 },
    xaxis: { title: "p-value", range: [0, maxP * 1.15], gridcolor: t.surf3, zeroline: false, dtick: maxP / 2 },
    yaxis: { autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 9 } },
    height: Math.max(200, pLabels.length * 28 + 50),
    shapes: [{
      type: "line", x0: alpha, x1: alpha,
      y0: -0.5, y1: plotLabels.length - 0.5,
      line: { color: t.err, width: 1, dash: "dash" },
    }],
  };

  return <ChartCard title={`P-Values (\u03b1 = ${alpha})`} t={t}>
    <PlotlyChart data={[trace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
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
  const COLORS = [t.acc, t.err, t.warn, t.ok, "#a78bfa", "#f472b6", "#34d399", t.tx2];

  return (
    <ChartCard title="Individual Trajectories" t={t}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {labels.map(([label, lr], idx) => {
          const rawData = lr.rawData || {};
          const tpNames = Object.keys(rawData);
          if (tpNames.length < 2) return null;
          const allVals = tpNames.flatMap(tp => rawData[tp]?.values || []);
          if (allVals.length === 0) return null;
          const yMin = Math.min(...allVals) - 2;
          const yMax = Math.max(...allVals) + 2;
          const color = COLORS[idx % COLORS.length];
          const nSubj = lr.nSubjects || 0;

          const traces = [];
          if (nSubj > 0) {
            for (let si = 0; si < nSubj; si++) {
              const pts = tpNames.map((tp, i) => {
                const vals = rawData[tp]?.values || [];
                return vals[si] != null ? { x: i, y: vals[si] } : null;
              }).filter(Boolean);
              if (pts.length < 2) continue;
              traces.push({
                type: "scatter", mode: "lines+markers",
                x: pts.map(p => p.x), y: pts.map(p => p.y),
                line: { color: t.tx3, width: 0.7 },
                marker: { size: 2, color: t.tx3, opacity: 0.25 },
                opacity: 0.25,
                showlegend: false, hoverinfo: "skip",
              });
            }
          }

          const means = tpNames.map(tp => {
            const vals = rawData[tp]?.values || [];
            return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
          });
          const meanPts = means.map((m, i) => m != null ? { x: i, y: m } : null).filter(Boolean);
          if (meanPts.length >= 2) {
            traces.push({
              type: "scatter", mode: "lines+markers",
              x: meanPts.map(p => p.x), y: meanPts.map(p => p.y),
              line: { color, width: 3 },
              marker: { color, size: 8, symbol: "circle", line: { width: 1.5, color: t.bg } },
              name: label,
              hovertemplate: `<b>${label}</b><br>TP: %{x}<br>Mean: %{y:.2f}<extra></extra>`,
              showlegend: false,
            });
          }

          const l = {
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            font: { color: t.tx2, family: FONT_STACK, size: 9 },
            margin: { l: 40, r: 12, t: 22, b: 28 },
            xaxis: {
              tickmode: "array",
              tickvals: tpNames.map((_, i) => i),
              ticktext: tpNames,
              showgrid: false, zeroline: false,
              tickfont: { size: 8 },
            },
            yaxis: { range: [yMin, yMax], gridcolor: t.surf3, zeroline: false, tickfont: { size: 8 } },
            height: 200,
            annotations: [{
              x: 0, y: 1.05, xref: "paper", yref: "paper",
              text: `<b>${label}</b>`, showarrow: false,
              xanchor: "left", yanchor: "top",
              font: { size: 11, color: t.tx },
            }],
          };

          return <PlotlyChart key={label} data={traces} layout={l} style={{ height: 200 }} />;
        })}
      </div>
    </ChartCard>
  );
}

function MeanTrajectoryOverlay({ labels, t }) {
  const COLORS = PALETTE;
  const allTps = [...new Set(labels.flatMap(([, lr]) => Object.keys(lr.rawData || {})))].sort();
  if (allTps.length < 2) return null;

  const allMeans = labels.flatMap(([, lr]) => {
    const rd = lr.rawData || {};
    return allTps.flatMap(tp => { const v = rd[tp]?.values || []; return v.length ? [v.reduce((a, b) => a + b, 0) / v.length] : []; });
  });
  const yMin = Math.min(...allMeans) - 3;
  const yMax = Math.max(...allMeans) + 3;

  const traces = labels.map(([label, lr], li) => {
    const rd = lr.rawData || {};
    const pts = allTps.map((tp, i) => {
      const vals = rd[tp]?.values || [];
      const m = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return m != null ? { x: i, y: m } : null;
    }).filter(Boolean);
    if (pts.length < 2) return null;
    const color = COLORS[li % COLORS.length];
    return {
      type: "scatter", mode: "lines+markers",
      x: pts.map(p => p.x), y: pts.map(p => p.y),
      line: { color, width: 2.5 },
      marker: { color, size: 7, symbol: "circle", line: { width: 1.5, color: t.bg } },
      name: label,
      hovertemplate: `<b>${label}</b><br>%{x}: %{y:.2f}<extra></extra>`,
    };
  }).filter(Boolean);

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 60, r: 20, t: 15, b: 55 },
    xaxis: {
      tickmode: "array",
      tickvals: allTps.map((_, i) => i),
      ticktext: allTps,
      title: "Timepoint",
      gridcolor: t.surf3, zeroline: false,
      tickfont: { size: 9 },
    },
    yaxis: { title: "Mean value", range: [yMin, yMax], gridcolor: t.surf3, zeroline: false, tickfont: { size: 9 } },
    height: 380,
    legend: { orientation: "v", font: { size: 9 } },
  };

  return <ChartCard title="Mean Trajectory Overlay — All Landmarks" t={t}>
    <PlotlyChart data={traces} layout={layout} style={{ height: 380 }} />
  </ChartCard>;
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
  const rMax = Math.max(...residuals.map(r => Math.abs(r)), 0.1);
  const cookArr = cooksd && cooksd.length ? cooksd : [];
  const cookMax = cookArr.length ? Math.max(...cookArr) : 0.1;

  const resColors = residuals.map(r => Math.abs(r) > rMax * 0.8 ? t.err : t.acc);
  const resTrace = {
    type: "scatter", mode: "markers",
    x: fitted, y: residuals,
    marker: { color: resColors, size: 5, opacity: 0.6 },
    hovertemplate: "Fitted: %{x:.2f}<br>Residual: %{y:.2f}<extra></extra>",
    showlegend: false,
  };

  const resLayout = {
    paper_bgcolor: "transparent", plot_bgcolor: "transparent",
    font: { color: t.tx2, family: FONT_STACK, size: 9 },
    margin: { l: 55, r: 20, t: 10, b: 45 },
    xaxis: { title: "Fitted values", gridcolor: t.surf3, zeroline: false, tickfont: { size: 8 } },
    yaxis: { title: "Residuals", gridcolor: t.surf3, zeroline: true, zerolinecolor: t.tx3, tickfont: { size: 8 } },
    height: 280,
    shapes: [{
      type: "line", y0: 0, y1: 0,
      x0: Math.min(...fitted), x1: Math.max(...fitted),
      line: { color: t.tx3, width: 0.5 },
    }],
  };

  return (
    <ChartCard title="Residual Diagnostics" t={t}>
      <div style={{ fontSize: FONT.sm, color: t.tx2, marginBottom: 4 }}>n = {n}  |  Mean residual: {residuals.reduce((a, b) => a + b, 0) / n.toFixed(3)}</div>
      <PlotlyChart data={[resTrace]} layout={resLayout} style={{ height: 280 }} />
      {cookArr.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: FONT.md, fontWeight: 600, color: t.tx, marginBottom: 6 }}>Cook's Distance</div>
          <PlotlyChart data={[{
            type: "bar",
            x: cookArr.map((_, i) => i),
            y: cookArr,
            marker: { color: cookArr.map(c => c > 4 / n ? t.err : t.acc), opacity: 0.7 },
            hovertemplate: "Index: %{x}<br>Cook's D: %{y:.4f}<extra></extra>",
            showlegend: false,
          }]} layout={{
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            font: { color: t.tx2, family: FONT_STACK, size: 9 },
            margin: { l: 50, r: 30, t: 10, b: 40 },
            xaxis: { title: "Observation index", gridcolor: t.surf3, zeroline: false, tickfont: { size: 8 } },
            yaxis: { range: [0, cookMax * 1.2], gridcolor: t.surf3, zeroline: false, tickfont: { size: 8 } },
            height: 120,
            shapes: cookMax > 4 / n ? [{
              type: "line", y0: 4 / n, y1: 4 / n,
              x0: -0.5, x1: cookArr.length - 0.5,
              line: { color: t.err, width: 1, dash: "dash" },
            }] : [],
          }} style={{ height: 120 }} />
        </div>
      )}
    </ChartCard>
  );
}

function ROCCurvePlot({ results, t }) {
  const log = results.logistic;
  if (!log || !log.roc) return null;
  const { roc, auc } = log;
  const traces = [
    { type: "scatter", mode: "lines", x: [0, 1], y: [0, 1], line: { color: t.bdr, width: 1, dash: "dash" }, name: "Chance", showlegend: false, hoverinfo: "skip" },
    { type: "scatter", mode: "lines", x: roc.map(p => p.fpr), y: roc.map(p => p.tpr), line: { color: t.acc, width: 2.5 }, name: "ROC", fill: "tozeroy", fillcolor: t.acc + "18", hovertemplate: "FPR: %{x:.3f}<br>TPR: %{y:.3f}<extra></extra>" },
  ];
  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 50, r: 20, t: 10, b: 50 },
    xaxis: { title: "1 \u2212 Specificity (FPR)", range: [0, 1], gridcolor: t.surf3, zeroline: false, dtick: 0.25 },
    yaxis: { title: "Sensitivity (TPR)", range: [0, 1], gridcolor: t.surf3, zeroline: false, dtick: 0.25 },
    width: 400, height: 400,
  };
  return <ChartCard title={`ROC Curve — AUC = ${auc.toFixed(3)}`} t={t}><PlotlyChart data={traces} layout={layout} style={{ width: 400, height: 400 }} /></ChartCard>;
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
  const COLORS = PALETTE;

  const traces = [
    {
      type: "scatter", mode: "lines",
      x: [0, 1], y: [0, 1],
      line: { color: t.tx3, width: 1, dash: "dash" },
      name: "Chance",
      showlegend: true,
      hoverinfo: "skip",
    },
    ...preds.map(([name, p], idx) => {
      if (!p.roc) return null;
      return {
        type: "scatter", mode: "lines",
        x: p.roc.points.map(pt => pt.fpr),
        y: p.roc.points.map(pt => pt.tpr),
        line: { color: COLORS[idx % COLORS.length], width: 2.5 },
        name: `${name} (AUC=${p.auc?.auc?.toFixed(3) || "—"})`,
        hovertemplate: `FPR: %{x:.3f}<br>TPR: %{y:.3f}<extra>${name}</extra>`,
      };
    }).filter(Boolean),
  ];

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 50, r: 20, t: 15, b: 50 },
    xaxis: { title: "1 \u2212 Specificity (FPR)", range: [0, 1], gridcolor: t.surf3, zeroline: false, dtick: 0.25 },
    yaxis: { title: "Sensitivity (TPR)", range: [0, 1], gridcolor: t.surf3, zeroline: false, dtick: 0.25 },
    height: 350,
    legend: { orientation: "h", y: 1.02, x: 0.5, xanchor: "center", font: { size: 9 } },
  };

  return <ChartCard title="ROC Curves — All Predictors" t={t}>
    <PlotlyChart data={traces} layout={layout} style={{ height: 350 }} />
  </ChartCard>;
}

function DiagnosticAUCComparison({ results, t }) {
  const { comparisons } = results;
  if (!comparisons?.length) return null;
  const labels = comparisons.map(c => `${c.A} vs ${c.B}`);
  const diffs = comparisons.map(c => c.diff);
  const ciLower = comparisons.map(c => c.ci95?.[0] ?? c.diff - 0.05);
  const ciUpper = comparisons.map(c => c.ci95?.[1] ?? c.diff + 0.05);
  const sigColors = comparisons.map(c => c.significant ? t.ok : t.tx3);
  const absMax = Math.max(Math.abs(Math.min(...diffs, 0)), Math.abs(Math.max(...diffs, 0)), 0.05) * 1.15;

  const trace = {
    type: "scatter", mode: "markers",
    x: diffs, y: labels,
    marker: { color: sigColors, size: 11, symbol: "square", line: { width: 1, color: t.bg } },
    error_x: {
      type: "data", symmetric: false, thickness: 2.5, width: 0,
      array: diffs.map((v, i) => ciUpper[i] - v),
      arrayminus: diffs.map((v, i) => v - ciLower[i]),
      color: sigColors,
    },
    text: diffs.map((v, i) => `${v.toFixed(3)} ${comparisons[i].significant ? "*" : ""}`),
    textposition: "right",
    textfont: { size: 9, color: t.tx2, family: FONT_STACK },
    hovertemplate: "%{y}: %{x:.4f} [%{customdata[0]:.4f}, %{customdata[1]:.4f}]<extra></extra>",
    customdata: diffs.map((v, i) => [ciLower[i], ciUpper[i]]),
    showlegend: false,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 140, r: 80, t: 15, b: 45 },
    xaxis: { title: "AUC difference", range: [-absMax, absMax], gridcolor: t.surf3, zeroline: true, zerolinecolor: t.tx3 },
    yaxis: { autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 9 } },
    height: Math.max(200, comparisons.length * 44 + 50),
  };

  return <ChartCard title="AUC Comparisons" t={t}>
    <PlotlyChart data={[trace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function DiagnosticCalibrationPlot({ results, t }) {
  const composite = results.composite;
  if (!composite?.calibration?.groups?.length) return null;
  const cal = composite.calibration;

  const groups = cal.groups;
  const mids = groups.map(g => g.midpoint);
  const obs = groups.map(g => g.obsProp);
  const err = groups.map(g => 1.96 * Math.sqrt(g.obsProp * (1 - g.obsProp) / g.n));

  const traces = [
    {
      type: "scatter", mode: "lines",
      x: [0, 1], y: [0, 1],
      line: { color: t.tx3, width: 1, dash: "dash" },
      name: "Perfect calibration",
      hoverinfo: "skip",
      showlegend: false,
    },
    {
      type: "scatter", mode: "markers",
      x: mids, y: obs,
      marker: { color: t.acc, size: 9, symbol: "circle", line: { width: 1.5, color: t.bg } },
      error_y: {
        type: "data", symmetric: true,
        array: err,
        color: t.acc, thickness: 2, width: 6,
      },
      name: "Observed",
      hovertemplate: "Predicted: %{x:.3f}<br>Observed: %{y:.3f} ± %{customdata:.3f}<extra></extra>",
      customdata: err,
      showlegend: false,
    },
  ];

  const hlText = `H-L \u03c7\u00b2=${cal.hlStat?.toFixed(1)} p=${fmtP(cal.hlP)}`;

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 55, r: 30, t: 15, b: 55 },
    xaxis: { title: "Predicted probability", range: [0, 1], gridcolor: t.surf3, zeroline: false, dtick: 0.25 },
    yaxis: { title: "Observed proportion", range: [0, 1], gridcolor: t.surf3, zeroline: false, dtick: 0.25 },
    height: 390,
    annotations: [{
      x: 1, y: 1, xref: "paper", yref: "paper",
      text: hlText, showarrow: false,
      xanchor: "right", yanchor: "top",
      font: { size: 10, color: t.tx2 },
    }],
  };

  return <ChartCard title="Calibration Plot — Composite Index" t={t}>
    <PlotlyChart data={traces} layout={layout} style={{ height: 390 }} />
  </ChartCard>;
}

function ChangeScoreChart({ labels, t }) {
  const allChanges = labels.flatMap(([label, lr]) =>
    (lr.changeScores || []).map(c => ({ label, ...c })));
  if (allChanges.length === 0) return null;
  const maxAbs = Math.max(...allChanges.map(c => Math.abs(c.meanChange)), 0.1) * 1.1;
  const yLabels = allChanges.map(c => `${c.label} ${c.from}\u2192${c.to}`);
  const vals = allChanges.map(c => c.meanChange);
  const colors = vals.map(v => v > 0 ? t.err : t.ok);

  const trace = {
    type: "bar", orientation: "h",
    y: yLabels, x: vals,
    marker: { color: colors, opacity: 0.6 },
    text: vals.map((v, i) => `${allChanges[i].from}\u2192${allChanges[i].to}: ${v.toFixed(2)}`),
    textposition: "outside",
    textfont: { size: 9, color: t.tx2, family: FONT_STACK },
    hovertemplate: "%{y}: %{x:.2f}<extra></extra>",
    showlegend: false,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 150, r: 90, t: 15, b: 45 },
    xaxis: { title: "Change score", range: [-maxAbs, maxAbs], gridcolor: t.surf3, zeroline: true, zerolinecolor: t.tx3 },
    yaxis: { autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 9 } },
    height: Math.max(200, allChanges.length * 28 + 50),
  };

  return <ChartCard title="Change Scores — All Landmarks" t={t}>
    <PlotlyChart data={[trace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}
