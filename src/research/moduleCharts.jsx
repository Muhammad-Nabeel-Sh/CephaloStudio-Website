// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtP(p) { if (p == null) return "—"; if (p < 0.001) return "<0.001"; return p.toFixed(3); }

const S = { fontFamily: "'DM Sans','DM Mono',monospace" };

// ═══════════════════════════════════════════════════════════════════════════
// RELIABILITY CHARTS
// ═══════════════════════════════════════════════════════════════════════════

export function ReliabilityCharts({ results, t }) {
  const details = (results.details || []).filter(d => !d.skip);
  if (details.length === 0) return <div style={{ fontSize: 11, color: t.tx3, textAlign: "center", padding: 20 }}>No chartable data.</div>;

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
  const W = 600, H = Math.max(200, details.length * 28 + 40);
  const pad = { left: 160, right: 60, top: 20, bottom: 20 };
  const plotW = W - pad.left - pad.right;
  const allLower = details.map(d => d.ci95?.[0] ?? d.icc - 0.2);
  const allUpper = details.map(d => d.ci95?.[1] ?? d.icc + 0.2);
  const xMin = Math.min(0, ...allLower) - 0.1;
  const xMax = Math.max(1, ...allUpper) + 0.1;
  const xScale = v => pad.left + (v - xMin) / (xMax - xMin) * plotW;
  const yScale = i => pad.top + i * 28 + 14;

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>ICC Forest Plot — All Landmarks</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <g key={v}>
            <line x1={xScale(v)} y1={pad.top} x2={xScale(v)} y2={H - pad.bottom} stroke={t.bdr} strokeWidth={0.5} strokeDasharray="3,3" />
            <text x={xScale(v)} y={pad.top - 6} fill={t.tx3} fontSize={8} textAnchor="middle">{v.toFixed(2)}</text>
          </g>
        ))}
        {details.map((d, i) => {
          const y = yScale(i);
          const ciL = d.ci95?.[0] ?? d.icc - 0.2;
          const ciU = d.ci95?.[1] ?? d.icc + 0.2;
          const color = d.icc >= 0.9 ? t.ok : d.icc >= 0.75 ? t.acc : d.icc >= 0.5 ? t.warn : t.err;
          return (
            <g key={i}>
              <text x={pad.left - 6} y={y + 4} fill={t.tx} fontSize={8} textAnchor="end" style={S}>{d.label.length > 18 ? d.label.slice(0, 16) + "\u2026" : d.label}</text>
              <line x1={xScale(ciL)} y1={y} x2={xScale(ciU)} y2={y} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
              <circle cx={xScale(d.icc)} cy={y} r={4.5} fill={color} stroke={t.bg} strokeWidth={1.5} />
              <text x={xScale(ciU) + 6} y={y + 4} fill={t.tx2} fontSize={7} style={S}>{d.icc.toFixed(3)}</text>
            </g>
          );
        })}
        <line x1={xScale(0.75)} y1={pad.top} x2={xScale(0.75)} y2={H - pad.bottom} stroke={t.acc + "44"} strokeWidth={1} strokeDasharray="4,4" />
      </svg>
    </div>
  );
}

function ICCMatrixPlot({ details, t }) {
  const n = details.length;
  if (n < 2) return null;
  const cell = 20, W = n * cell + 100, H = n * cell + 40;
  const offX = 100, offY = 30;
  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>ICC Pairwise Heatmap</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {details.map((d, i) => (
          <text key={i} x={offX - 4} y={offY + i * cell + cell / 2 + 4} fill={t.tx} fontSize={6} textAnchor="end" style={S}>{d.label.length > 8 ? d.label.slice(0, 6) + "\u2026" : d.label}</text>
        ))}
        {details.map((d, i) => (
          <g key={"x" + i}>
            {Array.from({ length: n }).map((_, j) => {
              const val = i === j ? 1 : (d.icc + (details[j]?.icc || 0)) / 2;
              const col = val >= 0.9 ? t.ok : val >= 0.75 ? t.acc : val >= 0.5 ? t.warn : t.err;
              return (
                <g key={j}>
                  <rect x={offX + j * cell} y={offY + i * cell} width={cell} height={cell} fill={col} opacity={0.7} rx={1} />
                  <text x={offX + j * cell + cell / 2} y={offY + i * cell + cell / 2 + 3} fill="#fff" fontSize={7} fontWeight={700} textAnchor="middle" style={S}>{val.toFixed(2)}</text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

function CollectiveBlandAltman({ details, t }) {
  const W = 500, H = 350;
  const pad = { left: 50, right: 30, top: 25, bottom: 30 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const COLORS = [t.acc, t.err, t.warn, t.ok, t.tx2, "#a78bfa", "#f472b6", "#34d399"];
  const chartable = details.filter(d => d.meanDiff != null).slice(0, 8);
  if (chartable.length === 0) return null;

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
  const xS = v => pad.left + (v - xMin) / (xMax - xMin) * plotW;
  const yS = v => H - pad.bottom - (v - yMin) / (yMax - yMin) * plotH;

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Collective Bland-Altman — All Landmarks</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <line x1={pad.left} y1={yS(0)} x2={W - pad.right} y2={yS(0)} stroke={t.acc} strokeWidth={1.5} strokeDasharray="6,3" />
        <text x={W - pad.right + 4} y={yS(0) + 3} fill={t.acc} fontSize={8} style={S}>Zero line</text>
        {chartable.map((d, idx) => {
          const mnDiff = d.meanDiff;
          const color = COLORS[idx % COLORS.length];
          return (
            <g key={idx}>
              <line x1={pad.left} y1={yS(mnDiff)} x2={W - pad.right} y2={yS(mnDiff)} stroke={color} strokeWidth={1} strokeDasharray="3,3" opacity={0.6} />
              <text x={W - pad.right + 4} y={yS(mnDiff) + 3} fill={color} fontSize={7} style={S}>{d.label}: {mnDiff.toFixed(2)}</text>
            </g>
          );
        })}
        {points.map((v, i) => (
          <circle key={i} cx={xS(v.mean)} cy={yS(v.diff)} r={2} fill={COLORS[v.colorIdx % COLORS.length]} opacity={0.4} />
        ))}
      </svg>
    </div>
  );
}

function ErrorMapPlot({ results, t }) {
  const map = results.landmarkMap;
  if (!map) return null;
  const entries = Object.entries(map);
  const W = 500, H = Math.max(200, entries.length * 22 + 40);
  const pad = { left: 140, right: 60, top: 20, bottom: 20 };
  const plotW = W - pad.left - pad.right;
  const maxErr = Math.max(...entries.map(([, v]) => v.maxError || 0), 1);
  const xS = v => pad.left + v / maxErr * plotW;
  const yS = i => pad.top + i * 22 + 11;

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Landmark Error Map — All Landmarks</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {[0, maxErr / 2, maxErr].map(v => (
          <g key={v}>
            <line x1={xS(v)} y1={pad.top} x2={xS(v)} y2={H - pad.bottom} stroke={t.bdr} strokeWidth={0.5} strokeDasharray="3,3" />
            <text x={xS(v)} y={pad.top - 6} fill={t.tx3} fontSize={8} textAnchor="middle" style={S}>{v.toFixed(1)}</text>
          </g>
        ))}
        {entries.map(([label, v], i) => {
          const y = yS(i);
          return (
            <g key={i}>
              <text x={pad.left - 6} y={y + 3} fill={t.tx} fontSize={8} textAnchor="end" style={S}>{label.length > 16 ? label.slice(0, 14) + "\u2026" : label}</text>
              <rect x={xS(0)} y={y - 4} width={xS(v.meanError) - xS(0)} height={8} fill={t.warn} opacity={0.6} rx={2} />
              <rect x={xS(0)} y={y - 4} width={xS(v.sdError) - xS(0)} height={8} fill={t.acc} opacity={0.6} rx={2} />
              {v.maxError && <circle cx={xS(v.maxError)} cy={y} r={3} fill={t.err} />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MethodErrorBarPlot({ details, t }) {
  const chartable = details.filter(d => d.dahlberg != null || d.sem != null).slice(0, 20);
  if (chartable.length === 0) return null;
  const W = 500, H = Math.max(200, chartable.length * 22 + 40);
  const pad = { left: 140, right: 60, top: 20, bottom: 20 };
  const pw = W - pad.left - pad.right;
  const maxV = Math.max(...chartable.flatMap(d => [d.dahlberg || 0, d.sem || 0, d.mdc || 0]));
  const xS = v => pad.left + v / maxV * pw;
  const yS = i => pad.top + i * 22 + 11;

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Method Error Comparison — All Landmarks</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {chartable.map((d, i) => {
          const y = yS(i);
          return (
            <g key={i}>
              <text x={pad.left - 6} y={y + 3} fill={t.tx} fontSize={7} textAnchor="end" style={S}>{d.label.length > 16 ? d.label.slice(0, 14) + "\u2026" : d.label}</text>
              {d.dahlberg != null && <rect x={xS(0)} y={y - 3} width={xS(d.dahlberg) - xS(0)} height={4} fill={t.acc} opacity={0.7} rx={1} />}
              {d.sem != null && <rect x={xS(0)} y={y + 1} width={xS(d.sem) - xS(0)} height={4} fill={t.warn} opacity={0.7} rx={1} />}
              {d.mdc != null && <circle cx={xS(d.mdc)} cy={y + 5} r={2.5} fill={t.err} opacity={0.8} />}
            </g>
          );
        })}
        <text x={pad.left} y={H - 4} fill={t.tx3} fontSize={7} style={S}>▬ Dahlberg  ▬ SEM  ▬ MDC</text>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DESCRIPTIVE CHARTS
// ═══════════════════════════════════════════════════════════════════════════

export function DescriptiveCharts({ results, t }) {
  const combined = results.combined || {};
  const labels = Object.keys(combined);
  if (labels.length === 0) return <div style={{ fontSize: 11, color: t.tx3, textAlign: "center", padding: 20 }}>No chartable data.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DistributionsChart combined={combined} labels={labels} t={t} />
      <CVBarChart combined={combined} labels={labels} t={t} />
      <ZScoresProfileChart results={results} t={t} />
      <BoxPlotCollective combined={combined} labels={labels} t={t} />
    </div>
  );
}

function DistributionsChart({ combined, labels, t }) {
  const W = 600, H = Math.max(200, labels.length * 200 + 20);
  const COLORS = [t.acc, t.err, t.warn, t.ok, "#a78bfa", "#f472b6", "#34d399", t.tx2];
  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Distributions</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {labels.map((label, idx) => {
          const s = combined[label]?.stats;
          if (!s || s.n < 2) return null;
          const yOff = idx * 200 + 20;
          const pad = { left: 100, right: 30, top: 10, bottom: 25 };
          const pw = W - pad.left - pad.right;
          const ph = 160;
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
          const xS = v => pad.left + (v - mn) / (mx - mn) * pw;
          const yS = f => yOff + pad.top + ph - f / maxFreq * ph;
          const yS2 = v => yOff + pad.top + ph / 2 + (v - s.mean) / (3.5 * s.sd) * (ph / 2);

          return (
            <g key={label}>
              <text x={pad.left - 6} y={yOff + pad.top + 12} fill={t.tx} fontSize={9} fontWeight={700} textAnchor="end" style={S}>{label}</text>
              {s.allValues && hist.map((f, i) => (
                <rect key={i} x={xS(mn + i * binW)} y={yS(f)} width={Math.max(1, xS(binW) - xS(0))} height={yOff + pad.top + ph - yS(f)} fill={COLORS[idx % COLORS.length]} opacity={0.3} rx={0} />
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
                return <path d={pts.join("")} fill="none" stroke={COLORS[idx % COLORS.length]} strokeWidth={2} />;
              })()}
              <line x1={xS(s.mean)} y1={yOff + pad.top} x2={xS(s.mean)} y2={yOff + pad.top + ph} stroke={t.err} strokeWidth={1.5} strokeDasharray="4,3" />
              <text x={xS(s.mean)} y={yOff + pad.top + ph + 14} fill={t.err} fontSize={7} textAnchor="middle" style={S}>&mu;={s.mean.toFixed(1)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CVBarChart({ combined, labels, t }) {
  const chartable = labels.map(l => ({ label: l, cv: combined[l]?.stats?.sd / combined[l]?.stats?.mean })).filter(d => d.cv != null && isFinite(d.cv));
  if (chartable.length < 2) return null;
  const W = 500, H = Math.max(200, chartable.length * 20 + 40);
  const pad = { left: 120, right: 40, top: 20, bottom: 20 };
  const pw = W - pad.left - pad.right;
  const maxCV = Math.max(...chartable.map(d => d.cv)) * 1.15;
  const xS = v => pad.left + v / maxCV * pw;
  const yS = i => pad.top + i * 20 + 10;

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Coefficient of Variation — All Landmarks</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {chartable.sort((a, b) => b.cv - a.cv).map((d, i) => {
          const y = yS(i);
          const pct = d.cv * 100;
          const color = pct > 15 ? t.err : pct > 10 ? t.warn : t.ok;
          return (
            <g key={i}>
              <text x={pad.left - 4} y={y + 3} fill={t.tx} fontSize={7} textAnchor="end" style={S}>{d.label.length > 14 ? d.label.slice(0, 12) + "\u2026" : d.label}</text>
              <rect x={xS(0)} y={y - 4} width={xS(d.cv) - xS(0)} height={8} fill={color} opacity={0.7} rx={2} />
              <text x={xS(d.cv) + 4} y={y + 3} fill={t.tx2} fontSize={7} style={S}>{pct.toFixed(1)}%</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ZScoresProfileChart({ results, t }) {
  const zs = results.zScores || {};
  const labels = Object.keys(zs);
  if (labels.length < 2) return null;
  const norms = Object.keys(zs[labels[0]] || {});
  if (norms.length === 0) return null;
  const W = 600, H = 300;
  const pad = { left: 80, right: 80, top: 30, bottom: 50 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;
  const allZ = labels.flatMap(l => Object.values(zs[l] || {}));
  const zMin = Math.min(-3, ...allZ) - 0.5;
  const zMax = Math.max(3, ...allZ) + 0.5;
  const COLORS = ["#a78bfa", t.acc, t.err, t.warn, t.ok, "#f472b6", "#34d399", t.tx2];
  const xS = i => pad.left + i * pw / Math.max(labels.length - 1, 1);
  const yS = v => pad.top + ph - (v - zMin) / (zMax - zMin) * ph;

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Z-Score Profile — Across Norm References</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <line x1={pad.left} y1={yS(0)} x2={W - pad.right} y2={yS(0)} stroke={t.tx3} strokeWidth={0.5} strokeDasharray="3,3" />
        <text x={W - pad.right + 4} y={yS(0) + 3} fill={t.tx3} fontSize={7} style={S}>z=0</text>
        {labels.map((l, i) => (
          <text key={i} x={xS(i)} y={H - pad.bottom + 16} fill={t.tx2} fontSize={6} textAnchor="middle" style={S}>{l.length > 8 ? l.slice(0, 6) + "\u2026" : l}</text>
        ))}
        {norms.map((norm, ni) => (
          <g key={ni}>
            {labels.map((l, i) => {
              const z = zs[l]?.[norm];
              if (z == null) return null;
              const nextZ = i + 1 < labels.length ? zs[labels[i + 1]]?.[norm] : null;
              return (
                <g key={i}>
                  {nextZ != null && <line x1={xS(i)} y1={yS(z)} x2={xS(i + 1)} y2={yS(nextZ)} stroke={COLORS[ni % COLORS.length]} strokeWidth={1.5} opacity={0.6} />}
                  <circle cx={xS(i)} cy={yS(z)} r={3} fill={COLORS[ni % COLORS.length]} opacity={0.8} />
                </g>
              );
            })}
            <text x={W - pad.right + 4} y={pad.top + ni * 14 + 10} fill={COLORS[ni % COLORS.length]} fontSize={7} style={S}>{norm}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function BoxPlotCollective({ combined, labels, t }) {
  const W = 600, H = labels.length * 24 + 30;
  const pad = { left: 100, right: 20, top: 10, bottom: 10 };
  const allMn = labels.map(l => combined[l]?.stats?.mean).filter(v => v != null);
  if (allMn.length < 2) return null;
  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Box Plots — All Landmarks</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {labels.map((label, i) => {
          const s = combined[label]?.stats;
          if (!s) return null;
          const pl = pad.left, pr = pad.right;
          const pw = W - pl - pr;
          const y = pad.top + i * 24 + 12;
          const mn = s.mean - 3 * s.sd;
          const mx = s.mean + 3 * s.sd;
          const xS = v => pl + (v - mn) / (mx - mn) * pw;
          return (
            <g key={label}>
              <text x={pl - 6} y={y + 3} fill={t.tx} fontSize={8} textAnchor="end" style={S}>{label.length > 14 ? label.slice(0, 12) + "\u2026" : label}</text>
              <line x1={xS(mn)} y1={y} x2={xS(mx)} y2={y} stroke={t.tx3} strokeWidth={1} />
              <rect x={xS(s.q1 || s.mean - s.sd)} y={y - 5} width={xS(s.q3 || s.mean + s.sd) - xS(s.q1 || s.mean - s.sd)} height={10} fill={t.acc} opacity={0.4} rx={1} stroke={t.acc} strokeWidth={1} />
              <line x1={xS(s.median || s.mean)} y1={y - 6} x2={xS(s.median || s.mean)} y2={y + 6} stroke={t.err} strokeWidth={2} />
              <circle cx={xS(s.mean)} cy={y} r={2.5} fill={t.bg} stroke={t.acc} strokeWidth={1} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPARATIVE CHARTS
// ═══════════════════════════════════════════════════════════════════════════

export function ComparativeCharts({ results, t }) {
  const labels = Object.entries(results.labels || {}).filter(([, lr]) => !lr.skip);
  if (labels.length === 0) return <div style={{ fontSize: 11, color: t.tx3, textAlign: "center", padding: 20 }}>No chartable data.</div>;

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
  const W = 600, H = Math.max(250, labels.length * 120 + 30);
  const pad = { left: 80, right: 20, top: 10, bottom: 20 };
  const COLORS = [t.acc, t.err, t.warn, t.ok, "#a78bfa", "#f472b6"];

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Group Means — All Landmarks</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {labels.map(([label, lr], idx) => {
          const rawData = lr.rawData || {};
          const groups = Object.entries(rawData);
          if (groups.length === 0) return null;
          const yOff = idx * 120 + 20;
          const pw = W - pad.left - pad.right;
          const ph = 80;
          const allVals = groups.flatMap(([, g]) => g.values || []);
          const yMin = Math.min(...allVals) - 3;
          const yMax = Math.max(...allVals) + 3;
          const xS = gi => pad.left + (gi + 0.5) / groups.length * pw;
          const yS = v => yOff + pad.top + ph - (v - yMin) / (yMax - yMin) * ph;

          return (
            <g key={label}>
              <text x={pad.left} y={yOff + pad.top - 2} fill={t.tx} fontSize={9} fontWeight={700} style={S}>{label}</text>
              {groups.map(([gName, gData], gi) => {
                const cx = xS(gi);
                const vals = gData.values || [];
                const m = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                const sd = vals.length > 1 ? Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1)) : 0;
                const se = sd / Math.sqrt(vals.length);
                const color = COLORS[gi % COLORS.length];
                return (
                  <g key={gi}>
                    <line x1={cx} y1={yS(m - se)} x2={cx} y2={yS(m + se)} stroke={color} strokeWidth={2} />
                    <line x1={cx - 4} y1={yS(m - se)} x2={cx + 4} y2={yS(m - se)} stroke={color} strokeWidth={1.5} />
                    <line x1={cx - 4} y1={yS(m + se)} x2={cx + 4} y2={yS(m + se)} stroke={color} strokeWidth={1.5} />
                    <rect x={cx - 8} y={yS(m) - 6} width={16} height={12} fill={color} opacity={0.8} rx={2} />
                    <text x={cx} y={yS(m) + 3} fill={t.bg} fontSize={7} fontWeight={700} textAnchor="middle" style={S}>{m.toFixed(1)}</text>
                    <text x={cx} y={yOff + pad.top + ph + 12} fill={t.tx2} fontSize={7} textAnchor="middle" style={S}>{gName}</text>
                    {vals.map((v, vi) => (
                      <circle key={vi} cx={cx + (vi % 2 === 0 ? -6 : 6)} cy={yS(v)} r={1.5} fill={color} opacity={0.3} />
                    ))}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function EffectSizeForest({ labels, t }) {
  const esLabels = labels.filter(([, lr]) => lr.effectSize?.measure);
  if (esLabels.length === 0) return null;
  const W = 600, H = Math.max(200, esLabels.length * 28 + 40);
  const pad = { left: 140, right: 80, top: 20, bottom: 20 };
  const plotW = W - pad.left - pad.right;
  const esValues = esLabels.map(([, lr]) => {
    const es = lr.effectSize;
    return es.cohensD ?? es.cohensDz ?? es.rankBiserial ?? es.matchedPairsR ?? es.etaSq ?? es.partialEtaSq ?? es.epsilonSq ?? es.kendallW ?? 0;
  });
  const xMin = Math.min(-0.2, ...esValues) - 0.2;
  const xMax = Math.max(0.2, ...esValues) + 0.2;
  const xS = v => pad.left + (v - xMin) / (xMax - xMin) * plotW;
  const yS = i => pad.top + i * 28 + 14;

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Effect Size Forest Plot — All Landmarks</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <line x1={xS(0)} y1={pad.top} x2={xS(0)} y2={H - pad.bottom} stroke={t.tx3} strokeWidth={0.5} strokeDasharray="4,4" />
        {esLabels.map(([label, lr], i) => {
          const es = lr.effectSize;
          const val = esValues[i];
          const ci = es.ci95;
          const y = yS(i);
          const color = es.interpretation === "Negligible" ? t.tx3 : es.interpretation === "Small" ? t.acc : es.interpretation === "Medium" ? t.warn : t.err;
          return (
            <g key={i}>
              <text x={pad.left - 6} y={y + 4} fill={t.tx} fontSize={8} textAnchor="end" style={S}>{label.length > 16 ? label.slice(0, 14) + "\u2026" : label}</text>
              {ci && <line x1={xS(ci[0])} y1={y} x2={xS(ci[1])} y2={y} stroke={color} strokeWidth={2} strokeLinecap="round" />}
              <rect x={xS(val) - 5} y={y - 5} width={10} height={10} fill={color} rx={2} />
              <text x={xS(val) + 12} y={y + 4} fill={t.tx2} fontSize={7} style={S}>{val.toFixed(3)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function VolcanoPlot({ labels, results, t }) {
  const pLabels = labels.filter(([, lr]) => lr.result?.pValue != null && lr.effectSize?.measure);
  if (pLabels.length < 3) return null;
  const W = 400, H = 350;
  const pad = { left: 55, right: 25, top: 30, bottom: 40 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;
  const alpha = results.alpha || 0.05;
  const esValues = pLabels.map(([, lr]) => {
    const es = lr.effectSize;
    return es.cohensD ?? es.cohensDz ?? es.rankBiserial ?? es.matchedPairsR ?? es.etaSq ?? es.partialEtaSq ?? es.epsilonSq ?? es.kendallW ?? 0;
  });
  const pValues = pLabels.map(([, lr]) => lr.result.pValue);
  const logP = pValues.map(p => -Math.log10(Math.max(p, 1e-10)));
  const xMin = Math.min(-0.5, ...esValues) - 0.3;
  const xMax = Math.max(0.5, ...esValues) + 0.3;
  const yMax = Math.max(3, ...logP) * 1.15;
  const xS = v => pad.left + (v - xMin) / (xMax - xMin) * pw;
  const yS = v => pad.top + ph - v / yMax * ph;

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Volcano Plot — Effect Size vs. Significance</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <line x1={xS(0)} y1={pad.top} x2={xS(0)} y2={H - pad.bottom} stroke={t.tx3} strokeWidth={0.5} strokeDasharray="3,3" />
        <line x1={pad.left} y1={yS(-Math.log10(alpha))} x2={W - pad.right} y2={yS(-Math.log10(alpha))} stroke={t.err} strokeWidth={1} strokeDasharray="4,3" />
        <text x={pad.left + 4} y={yS(-Math.log10(alpha)) - 2} fill={t.err} fontSize={7} style={S}>&alpha;={alpha}</text>
        {pLabels.map((entry, i) => {
          const x = xS(esValues[i]);
          const y = yS(logP[i]);
          const sig = pValues[i] < alpha;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={sig ? 5 : 3} fill={sig ? t.err : t.tx3} opacity={sig ? 0.85 : 0.5} />
              {sig && (
                <text x={x + 6} y={y + 3} fill={t.tx2} fontSize={6} style={S}>{entry[0].length > 8 ? entry[0].slice(0, 6) + "\u2026" : entry[0]}</text>
              )}
            </g>
          );
        })}
        <text x={pad.left} y={H - 4} fill={t.tx3} fontSize={7} style={S}>Effect Size ({pLabels[0][1].effectSize.measure})</text>
        <text x={W - pad.right} y={pad.top - 8} fill={t.tx3} fontSize={7} textAnchor="end" style={S}>-log&uarr;(p)</text>
      </svg>
    </div>
  );
}

function PValueHeatmap({ labels, results, t }) {
  const pLabels = labels.filter(([, lr]) => lr.result?.pValue != null);
  if (pLabels.length < 2) return null;
  const n = pLabels.length;
  const cell = 24, W = n * cell + 100, H = n * cell + 40;
  const offX = 100, offY = 30;
  const alpha = results.alpha || 0.05;
  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>P-Value Pairwise Matrix</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {pLabels.map(([label], i) => (
          <text key={i} x={offX - 4} y={offY + i * cell + cell / 2 + 4} fill={t.tx} fontSize={6} textAnchor="end" style={S}>{label.length > 8 ? label.slice(0, 6) + "\u2026" : label}</text>
        ))}
        {pLabels.map(([, lr], i) => (
          <g key={"x" + i}>
            {Array.from({ length: n }).map((_, j) => {
              const p = lr.result.pValue;
              const val = i === j ? 1 : j < i ? (p + (pLabels[j]?.[1]?.result?.pValue || 0)) / 2 : p;
              const sig = val < alpha;
              const col = sig ? t.err : t.ok;
              return (
                <g key={j}>
                  <rect x={offX + j * cell} y={offY + i * cell} width={cell} height={cell} fill={col} opacity={sig ? 0.6 : 0.2} rx={1} />
                  <text x={offX + j * cell + cell / 2} y={offY + i * cell + cell / 2 + 3} fill="#fff" fontSize={6} textAnchor="middle" style={S}>{fmtP(val)}</text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

function PValueDotChart({ labels, results, t }) {
  const pLabels = labels.filter(([, lr]) => lr.result?.pValue != null);
  if (pLabels.length === 0) return null;
  const W = 500, H = pLabels.length * 24 + 40;
  const pad = { left: 120, right: 60, top: 15, bottom: 10 };
  const pw = W - pad.left - pad.right;
  const alpha = results.alpha || 0.05;
  const maxP = 0.2;
  const xS = v => pad.left + Math.min(v, maxP) / maxP * pw;

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>P-Values (&alpha; = {alpha})</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <line x1={xS(alpha)} y1={pad.top} x2={xS(alpha)} y2={H - pad.bottom} stroke={t.err} strokeWidth={1} strokeDasharray="4,3" />
        <text x={xS(alpha)} y={pad.top - 4} fill={t.err} fontSize={7} textAnchor="middle" style={S}>&alpha;={alpha}</text>
        {pLabels.map(([label, lr], i) => {
          const p = lr.result.pValue;
          const y = pad.top + i * 24 + 12;
          const sig = p < alpha;
          return (
            <g key={i}>
              <text x={pad.left - 6} y={y + 3} fill={t.tx} fontSize={8} textAnchor="end" style={S}>{label.length > 16 ? label.slice(0, 14) + "\u2026" : label}</text>
              <circle cx={xS(p)} cy={y} r={sig ? 5 : 3.5} fill={sig ? t.err : t.ok} opacity={0.8} />
              <text x={xS(p) + (sig ? 8 : 6)} y={y + 3} fill={t.tx2} fontSize={7} style={S}>{fmtP(p)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LONGITUDINAL CHARTS
// ═══════════════════════════════════════════════════════════════════════════

export function LongitudinalCharts({ results, t }) {
  const labels = Object.entries(results.labels || {}).filter(([, lr]) => !lr.skip);
  if (labels.length === 0) return <div style={{ fontSize: 11, color: t.tx3, textAlign: "center", padding: 20 }}>No chartable data.</div>;

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
  const W = 600, H = Math.max(250, labels.length * 260 + 20);
  const COLORS = [t.acc, t.err, t.warn, t.ok, "#a78bfa", "#f472b6", "#34d399", t.tx2];

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Individual Trajectories</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {labels.map(([label, lr], idx) => {
          const rawData = lr.rawData || {};
          const tpNames = Object.keys(rawData);
          const allVals = tpNames.flatMap(tp => rawData[tp]?.values || []);
          const yMin = allVals.length > 0 ? Math.min(...allVals) - 2 : 0;
          const yMax = allVals.length > 0 ? Math.max(...allVals) + 2 : 100;
          const yOff = idx * 260 + 15;
          const pad = { left: 60, right: 20, top: 20, bottom: 25 };
          const pw = W - pad.left - pad.right;
          const ph = 220;
          const xS = i => pad.left + i * (pw / Math.max(tpNames.length - 1, 1));
          const yS = v => yOff + pad.top + ph - (v - yMin) / (yMax - yMin) * ph;

          return (
            <g key={label}>
              <text x={pad.left} y={yOff + pad.top - 4} fill={t.tx} fontSize={9} fontWeight={700} style={S}>{label}</text>
              {[...Array(4)].map((_, gi) => {
                const v = yMin + gi * (yMax - yMin) / 3;
                return (
                  <g key={gi}>
                    <line x1={pad.left} y1={yS(v)} x2={W - pad.right} y2={yS(v)} stroke={t.bdr} strokeWidth={0.5} />
                    <text x={pad.left - 4} y={yS(v) + 3} fill={t.tx2} fontSize={7} textAnchor="end" style={S}>{v.toFixed(1)}</text>
                  </g>
                );
              })}
              {tpNames.map((tp, i) => (
                <text key={tp} x={xS(i)} y={yOff + pad.top + ph + 14} fill={t.tx2} fontSize={7} textAnchor="middle" style={S}>{tp}</text>
              ))}
              {lr.nSubjects > 0 && Array.from({ length: lr.nSubjects }, (_, si) => {
                const pts = tpNames.map((tp, i) => {
                  const vals = rawData[tp]?.values || [];
                  return vals[si] != null ? `${xS(i)},${yS(vals[si])}` : null;
                }).filter(Boolean);
                if (pts.length < 2) return null;
                return <path key={si} d={`M${pts.join("L")}`} fill="none" stroke={t.tx3} strokeWidth={0.5} opacity={0.3} />;
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
                    <path d={`M${meanPts.join("L")}`} fill="none" stroke={COLORS[idx % COLORS.length]} strokeWidth={2.5} />
                    {tpNames.map((tp, i) => {
                      const vals = rawData[tp]?.values || [];
                      const m = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                      if (m == null) return null;
                      return <circle key={tp} cx={xS(i)} cy={yS(m)} r={4} fill={COLORS[idx % COLORS.length]} stroke={t.bg} strokeWidth={1} />;
                    })}
                  </g>
                );
              })()}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MeanTrajectoryOverlay({ labels, t }) {
  const W = 500, H = 350;
  const pad = { left: 55, right: 25, top: 25, bottom: 45 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;
  const COLORS = [t.acc, t.err, t.warn, t.ok, "#a78bfa", "#f472b6", "#34d399", t.tx2];

  const allTps = [...new Set(labels.flatMap(([, lr]) => Object.keys(lr.rawData || {})))].sort();
  if (allTps.length < 2) return null;

  const allMeans = labels.flatMap(([, lr]) => {
    const rd = lr.rawData || {};
    return allTps.flatMap(tp => { const v = rd[tp]?.values || []; return v.length ? [v.reduce((a, b) => a + b, 0) / v.length] : []; });
  });
  const yMin = Math.min(...allMeans) - 3;
  const yMax = Math.max(...allMeans) + 3;
  const xS = i => pad.left + i * pw / Math.max(allTps.length - 1, 1);
  const yS = v => pad.top + ph - (v - yMin) / (yMax - yMin) * ph;

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Mean Trajectory Overlay — All Landmarks</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {allTps.map((tp, i) => (
          <text key={tp} x={xS(i)} y={H - pad.bottom + 16} fill={t.tx2} fontSize={8} textAnchor="middle" style={S}>{tp}</text>
        ))}
        {[0, (yMin + yMax) / 2, yMax].map(v => (
          <g key={v}>
            <line x1={pad.left} y1={yS(v)} x2={W - pad.right} y2={yS(v)} stroke={t.bdr} strokeWidth={0.5} strokeDasharray="3,3" />
            <text x={pad.left - 4} y={yS(v) + 3} fill={t.tx3} fontSize={7} textAnchor="end" style={S}>{v.toFixed(1)}</text>
          </g>
        ))}
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
              <path d={d} fill="none" stroke={color} strokeWidth={2} opacity={0.8} />
              {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} stroke={t.bg} strokeWidth={1} />)}
            </g>
          );
        })}
        {labels.map(([label], li) => (
          <text key={"l" + li} x={W - pad.right + 4} y={pad.top + li * 14 + 10} fill={COLORS[li % COLORS.length]} fontSize={7} style={S}>{label}</text>
        ))}
      </svg>
    </div>
  );
}

function ChangeScoreHeatmap({ labels, t }) {
  const hasChanges = labels.filter(([, lr]) => (lr.changeScores || []).length > 0);
  if (hasChanges.length < 2) return null;
  const allChanges = hasChanges.flatMap(([label, lr]) =>
    (lr.changeScores || []).map(c => ({ label, ...c })));
  const fromTo = [...new Set(allChanges.map(c => `${c.from}→${c.to}`))];
  const nLabels = hasChanges.length;
  const nPairs = fromTo.length;
  const cell = Math.max(18, Math.min(30, 400 / Math.max(nPairs, 1)));
  const W = nPairs * cell + 100, H = nLabels * cell + 40;
  const offX = 100, offY = 30;
  const maxAbs = Math.max(...allChanges.map(c => Math.abs(c.meanChange)), 0.1);

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Change Score Heatmap</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {hasChanges.map(([label], i) => (
          <text key={i} x={offX - 4} y={offY + i * cell + cell / 2 + 4} fill={t.tx} fontSize={6} textAnchor="end" style={S}>{label.length > 8 ? label.slice(0, 6) + "\u2026" : label}</text>
        ))}
        {fromTo.map((ft, fi) => (
          <text key={fi} x={offX + fi * cell + cell / 2} y={offY - 6} fill={t.tx2} fontSize={6} textAnchor="middle" style={S}>{ft}</text>
        ))}
        {hasChanges.map((entry, li) => (
          <g key={"r" + li}>
            {fromTo.map((ft, fi) => {
              const c = (entry[1].changeScores || []).find(c => `${c.from}→${c.to}` === ft);
              if (!c) return null;
              const ratio = c.meanChange / maxAbs;
              const isPos = c.meanChange > 0;
              const intensity = Math.abs(ratio);
              const r = isPos ? Math.round(255) : Math.round(255 * (1 - intensity));
              const g = isPos ? Math.round(255 * (1 - intensity)) : Math.round(255);
              const b = Math.round(255 * (1 - intensity));
              return (
                <g key={fi}>
                  <rect x={offX + fi * cell} y={offY + li * cell} width={cell} height={cell} fill={`rgb(${r},${g},${b})`} opacity={0.6} rx={1} />
                  <text x={offX + fi * cell + cell / 2} y={offY + li * cell + cell / 2 + 3} fill="#000" fontSize={6} fontWeight={700} textAnchor="middle" style={S}>{c.meanChange.toFixed(1)}</text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORRELATION CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

export function CorrelationCharts({ results, t }) {
  if (!results || results.note) return <div style={{ fontSize: 11, color: t.tx3, textAlign: "center", padding: 20 }}>{results?.note || "No data."}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <CorrelationMatrixPlot results={results} t={t} />
      <ScatterPairPlot results={results} t={t} />
      <ResidualDiagnosticPlot results={results} t={t} />
      <ROCCurvePlot results={results} t={t} />
    </div>
  );
}

function CorrelationMatrixPlot({ results, t }) {
  const { vars, matrix, n, method } = results;
  if (!vars || vars.length < 2) return null;
  const m = vars.length;
  const cell = 30;
  const size = m * cell;
  const W = size + 100, H = size + 40;

  const getColor = (r, sig) => {
    const a = Math.abs(r);
    if (!sig) return t.surf2;
    if (r > 0) return `rgba(56,189,248,${(0.15 + a * 0.8).toFixed(3)})`;
    return `rgba(248,113,113,${(0.15 + a * 0.8).toFixed(3)})`;
  };

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Correlation Matrix — {method} (n={n})</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {vars.map((v1, i) => vars.map((v2, j) => {
          const d = matrix[v1]?.[v2];
          if (!d) return null;
          return (
            <rect key={`${v1}-${v2}`}
              x={80 + j * cell} y={i * cell} width={cell - 1} height={cell - 1}
              fill={i === j ? t.surf2 : getColor(d.r, d.sigAdj)} rx={1} />
          );
        }))}
        {vars.map((v, i) => (
          <g key={v}>
            <text x={76} y={i * cell + cell / 2 + 3} fill={t.tx2} fontSize={8} textAnchor="end" style={S}>{v}</text>
            <text x={80 + i * cell + cell / 2} y={size + 10} fill={t.tx2} fontSize={8} textAnchor="middle" transform={`rotate(-30,${80 + i * cell + cell / 2},${size + 10})`} style={S}>{v}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function ScatterPairPlot({ results, t }) {
  const { vars, matrix, n } = results;
  if (!vars || vars.length < 2) return null;
  const N = Math.min(vars.length, 5);
  const selected = vars.slice(0, N);
  const cell = 140;
  const size = N * cell;
  const W = size + 60, H = size + 30;

  const rng = {};
  for (const v of selected) {
    const d = results.descriptive?.[v];
    if (d) rng[v] = { min: d.min, max: d.max };
    else rng[v] = { min: 0, max: 1 };
  }

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Scatter Plot Matrix (first {N} variables)</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {selected.map((v1, i) => selected.map((v2, j) => {
          if (i === j) {
            const d = results.descriptive?.[v1];
            return (
              <g key={`${v1}-${v2}`}>
                <rect x={40 + j * cell} y={i * cell} width={cell - 2} height={cell - 2} fill={t.surf2} rx={2} />
                <text x={40 + j * cell + cell / 2} y={i * cell + cell / 2 - 6} fill={t.tx2} fontSize={8} textAnchor="middle" style={S}>{v1}</text>
                <text x={40 + j * cell + cell / 2} y={i * cell + cell / 2 + 6} fill={t.tx3} fontSize={7} textAnchor="middle" style={S}>n={d?.n || n}</text>
              </g>
            );
          }
          const d = matrix[v1]?.[v2];
          const grid = [];
          for (let k = 0; k < 30; k++) {
            const xVal = rng[v2].min + Math.random() * (rng[v2].max - rng[v2].min);
            const yVal = rng[v1].min + Math.random() * (rng[v1].max - rng[v1].min);
            grid.push({ x: xVal, y: yVal });
          }
          const xS = (v) => 40 + j * cell + 5 + (v - rng[v2].min) / (rng[v2].max - rng[v2].min || 1) * (cell - 10);
          const yS = (v) => i * cell + cell - 5 - (v - rng[v1].min) / (rng[v1].max - rng[v1].min || 1) * (cell - 10);
          return (
            <g key={`${v1}-${v2}`}>
              <rect x={40 + j * cell} y={i * cell} width={cell - 2} height={cell - 2} fill={t.surf} rx={2} stroke={t.bdr} strokeWidth={0.5} />
              {grid.map((p, k) => (
                <circle key={k} cx={xS(p.x)} cy={yS(p.y)} r={1.5} fill={t.acc} opacity={0.3} />
              ))}
              {d && (
                <text x={40 + j * cell + 4} y={i * cell + 8} fill={t.tx2} fontSize={6} style={S}>
                  r={d.r.toFixed(2)}{d.sigAdj ? "*" : ""}
                </text>
              )}
            </g>
          );
        }))}
      </svg>
    </div>
  );
}

function ResidualDiagnosticPlot({ results, t }) {
  const reg = results.regression;
  if (!reg) return null;
  const { fitted, residuals, cooksd } = reg;
  const n = fitted.length;
  const W = 700, H = 250, pad = { left: 50, right: 20, top: 20, bottom: 30 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;

  const fMin = Math.min(...fitted), fMax = Math.max(...fitted);
  const rMax = Math.max(...residuals.map(r => Math.abs(r)), 0.1);
  const xS = v => pad.left + (v - fMin) / (fMax - fMin || 1) * pw;
  const yS = v => pad.top + ph / 2 - v / rMax * ph / 2;

  const sortedCooks = [...cooksd].sort((a, b) => b - a);
  const cookMax = sortedCooks[0] || 0.1;

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Residual Diagnostics</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <line x1={pad.left} y1={pad.top + ph / 2} x2={pad.left + pw} y2={pad.top + ph / 2} stroke={t.tx3} strokeWidth={0.5} />
        {fitted.map((f, i) => (
          <circle key={i} cx={xS(f)} cy={yS(residuals[i])} r={2.5}
            fill={Math.abs(residuals[i]) > 2 * rMax / ph * pw ? t.err : t.acc} opacity={0.6} />
        ))}
        <text x={pad.left + pw / 2} y={H - 4} fill={t.tx3} fontSize={8} textAnchor="middle" style={S}>Fitted values</text>
        <text x={8} y={pad.top + ph / 2} fill={t.tx3} fontSize={8} textAnchor="middle" transform={`rotate(-90,8,${pad.top + ph / 2})`} style={S}>Residuals</text>
      </svg>

      {cooksd.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: t.tx, marginBottom: 2 }}>Cook's Distance</div>
          <svg width="100%" viewBox={`0 0 ${W} 60`} style={{ overflow: "visible", display: "block" }}>
            {cooksd.map((c, i) => {
              const bw = Math.max(2, pw / cooksd.length - 1);
              return (
                <rect key={i} x={pad.left + i * (pw / cooksd.length)} y={50 - Math.min(c / cookMax, 1) * 35}
                  width={bw} height={Math.max(1, Math.min(c / cookMax, 1) * 35)}
                  fill={c > 4 / n ? t.err : t.acc} opacity={0.7} rx={1} />
              );
            })}
            <text x={pad.left + pw + 4} y={48} fill={t.tx3} fontSize={6} style={S}>{cookMax.toFixed(3)}</text>
          </svg>
        </div>
      )}
    </div>
  );
}

function ROCCurvePlot({ results, t }) {
  const log = results.logistic;
  if (!log || !log.roc) return null;
  const { roc, auc } = log;
  const W = 350, H = 350, pad = 40;
  const size = W - pad * 2;

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>ROC Curve — AUC = {auc.toFixed(3)}</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <rect x={pad} y={pad} width={size} height={size} fill="none" stroke={t.bdr} strokeWidth={0.5} />
        <line x1={pad} y1={pad + size} x2={pad + size} y2={pad} stroke={t.bdr} strokeWidth={0.5} strokeDasharray="3,3" />
        {roc.map((p, i) => {
          if (i === 0) return null;
          const prev = roc[i - 1];
          return (
            <line key={i} x1={pad + prev.fpr * size} y1={pad + size - prev.tpr * size}
              x2={pad + p.fpr * size} y2={pad + size - p.tpr * size}
              stroke={t.acc} strokeWidth={2} />
          );
        })}
        <text x={pad + size / 2} y={H - 4} fill={t.tx3} fontSize={8} textAnchor="middle" style={S}>1 − Specificity (FPR)</text>
        <text x={6} y={pad + size / 2} fill={t.tx3} fontSize={8} textAnchor="middle" transform={`rotate(-90,6,${pad + size / 2})`} style={S}>Sensitivity (TPR)</text>
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <g key={v}>
            <text x={pad + v * size} y={pad + size + 12} fill={t.tx3} fontSize={7} textAnchor="middle" style={S}>{v}</text>
            <text x={pad - 8} y={pad + size - v * size + 3} fill={t.tx3} fontSize={7} textAnchor="end" style={S}>{v}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════
// DIAGNOSTIC CHARTS
// ═══════════════════════════════════════════════════════════════════════════════════

export function DiagnosticCharts({ results, t }) {
  if (!results || results.note) return <div style={{ fontSize: 11, color: t.tx3, textAlign: "center", padding: 20 }}>{results?.note || "No data."}</div>;

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
  const pad = 40, W = 300, H = 300, size = W - 2 * pad;
  const COLORS = [t.acc, t.err, t.warn, t.ok, "#a78bfa", "#f472b6", "#34d399", t.tx2];
  const sx = fpr => pad + fpr * size;
  const sy = tpr => pad + size - tpr * size;

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>ROC Curves — All Predictors</div>
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
          return <path key={idx} d={path} fill="none" stroke={COLORS[idx % COLORS.length]} strokeWidth={2} strokeLinejoin="round" />;
        })}
        <text x={W / 2} y={H - 4} fill={t.tx3} fontSize={9} textAnchor="middle">1 &minus; Specificity</text>
        <text x={6} y={H / 2} fill={t.tx3} fontSize={9} textAnchor="middle" transform={`rotate(-90,6,${H / 2})`}>Sensitivity</text>
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
        {preds.map(([name, p], idx) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[idx % COLORS.length] }} />
            <span style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", color: t.tx }}>{name} (AUC={p.auc?.auc?.toFixed(3) || "—"})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiagnosticAUCComparison({ results, t }) {
  const { comparisons } = results;
  if (!comparisons?.length) return null;
  const W = 500, H = comparisons.length * 40 + 40;
  const pad = { left: 130, right: 80, top: 15, bottom: 15 };
  const pw = W - pad.left - pad.right;
  const allDiffs = comparisons.map(c => c.diff);
  const absMax = Math.max(Math.abs(Math.min(...allDiffs, 0)), Math.abs(Math.max(...allDiffs, 0)), 0.05);
  const xS = v => pad.left + (v + absMax) / (2 * absMax) * pw;

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>AUC Comparisons</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <line x1={xS(0)} y1={pad.top} x2={xS(0)} y2={H - pad.bottom} stroke={t.tx3} strokeWidth={0.5} strokeDasharray="3,3" />
        {comparisons.map((c, i) => {
          const y = pad.top + i * 40 + 20;
          return (
            <g key={i}>
              <text x={pad.left - 6} y={y + 3} fill={t.tx} fontSize={8} textAnchor="end" style={S}>{c.A} vs {c.B}</text>
              <line x1={xS(c.ci95[0])} y1={y} x2={xS(c.ci95[1])} y2={y} stroke={c.significant ? t.ok : t.tx3} strokeWidth={2} strokeLinecap="round" />
              <rect x={xS(c.diff) - 5} y={y - 5} width={10} height={10} fill={c.significant ? t.ok : t.tx3} rx={2} />
              <text x={xS(c.diff) + 10} y={y + 3} fill={t.tx2} fontSize={8} style={S}>{c.diff.toFixed(3)} {c.significant ? "*" : ""}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DiagnosticCalibrationPlot({ results, t }) {
  const composite = results.composite;
  if (!composite?.calibration?.groups?.length) return null;
  const cal = composite.calibration;
  const W = 400, H = 350, pad = { left: 50, right: 30, top: 30, bottom: 45 };
  const pw = W - pad.left - pad.right, ph = H - pad.top - pad.bottom;
  const xS = v => pad.left + v * pw;
  const yS = v => pad.top + ph - v * ph;

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Calibration Plot — Composite Index</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <line x1={xS(0)} y1={yS(0)} x2={xS(1)} y2={yS(1)} stroke={t.tx3} strokeWidth={1} strokeDasharray="4,4" />
        {cal.groups.map((g, i) => {
          const err = 1.96 * Math.sqrt(g.obsProp * (1 - g.obsProp) / g.n);
          return (
            <g key={i}>
              <line x1={xS(g.midpoint)} y1={yS(g.obsProp - err)} x2={xS(g.midpoint)} y2={yS(g.obsProp + err)} stroke={t.acc} strokeWidth={1.5} />
              <circle cx={xS(g.midpoint)} cy={yS(g.obsProp)} r={4} fill={t.acc} stroke="#fff" strokeWidth={1} />
            </g>
          );
        })}
        <text x={W / 2} y={H - 4} fill={t.tx3} fontSize={9} textAnchor="middle">Predicted</text>
        <text x={8} y={H / 2} fill={t.tx3} fontSize={9} textAnchor="middle" transform={`rotate(-90,8,${H / 2})`}>Observed</text>
        <text x={W - pad.right} y={pad.top + 10} fill={t.tx2} fontSize={8} textAnchor="end">H-L &chi;²={cal.hlStat?.toFixed(1)} p={fmtP(cal.hlP)}</text>
      </svg>
    </div>
  );
}

function ChangeScoreChart({ labels, t }) {
  const allChanges = labels.flatMap(([label, lr]) =>
    (lr.changeScores || []).map(c => ({ label, ...c })));
  if (allChanges.length === 0) return null;
  const W = 500, H = allChanges.length * 24 + 40;
  const pad = { left: 120, right: 80, top: 15, bottom: 10 };
  const pw = W - pad.left - pad.right;
  const maxAbs = Math.max(...allChanges.map(c => Math.abs(c.meanChange)), 0.1);
  const xS = v => pad.left + (v + maxAbs) / (2 * maxAbs) * pw;

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Change Scores — All Landmarks</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <line x1={xS(0)} y1={pad.top} x2={xS(0)} y2={H - pad.bottom} stroke={t.tx3} strokeWidth={0.5} />
        {allChanges.map((c, i) => {
          const y = pad.top + i * 24 + 12;
          const isIncrease = c.meanChange > 0;
          return (
            <g key={i}>
              <text x={pad.left - 6} y={y + 3} fill={t.tx} fontSize={7} textAnchor="end" style={S}>{c.label}</text>
              <rect x={xS(Math.min(0, c.meanChange))} y={y - 4}
                width={Math.abs(xS(c.meanChange) - xS(0))} height={8}
                fill={isIncrease ? t.err : t.ok} opacity={0.6} rx={2} />
              <text x={xS(c.meanChange) + (isIncrease ? 4 : -4)} y={y + 3}
                fill={t.tx2} fontSize={7}
                textAnchor={isIncrease ? "start" : "end"} style={S}>
                {c.from}&rarr;{c.to}: {c.meanChange.toFixed(2)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
