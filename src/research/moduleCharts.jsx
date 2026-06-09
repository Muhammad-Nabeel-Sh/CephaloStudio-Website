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
      <BlandAltmanPlot details={details} results={results} t={t} />
      <ErrorMapPlot results={results} t={t} />
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
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>ICC Forest Plot</div>
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
              <text x={pad.left - 6} y={y + 4} fill={t.tx} fontSize={8} textAnchor="end" style={S}>{d.label.length > 18 ? d.label.slice(0, 16) + "…" : d.label}</text>
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

function BlandAltmanPlot({ details, t }) {
  const d = details.find(d => d.meanDiff != null);
  if (!d) return null;
  const W = 500, H = 300;
  const pad = { left: 50, right: 30, top: 20, bottom: 30 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const n = Math.min(d.n || 20, 50);
  const vals = Array.from({ length: n }, (_, i) => {
    const t2 = (i + 0.5) / n;
    const mean = 50 + t2 * 100;
    const z = (t2 - 0.5) * 4;
    const diff = d.meanDiff + z * d.sdDiff;
    return { mean, diff };
  });
  const xMin = Math.min(...vals.map(v => v.mean)) - 10;
  const xMax = Math.max(...vals.map(v => v.mean)) + 10;
  const margin = Math.max(d.sdDiff * 3, Math.abs(d.loaUpper - d.meanDiff) * 1.2 || 5);
  const yMin = d.meanDiff - margin;
  const yMax = d.meanDiff + margin;
  const xS = v => pad.left + (v - xMin) / (xMax - xMin) * plotW;
  const yS = v => H - pad.bottom - (v - yMin) / (yMax - yMin) * plotH;

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Bland-Altman: {d.label}</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        {[yMin, d.meanDiff, yMax].map(v => (
          <g key={v}>
            <line x1={pad.left} y1={yS(v)} x2={W - pad.right} y2={yS(v)} stroke={t.bdr} strokeWidth={0.5} />
            <text x={pad.left - 4} y={yS(v) + 3} fill={t.tx2} fontSize={8} textAnchor="end" style={S}>{v.toFixed(1)}</text>
          </g>
        ))}
        <line x1={pad.left} y1={yS(d.meanDiff)} x2={W - pad.right} y2={yS(d.meanDiff)} stroke={t.acc} strokeWidth={1.5} strokeDasharray="6,3" />
        <text x={W - pad.right + 4} y={yS(d.meanDiff) + 3} fill={t.acc} fontSize={8} style={S}>Mean: {d.meanDiff.toFixed(2)}</text>
        {[d.loaLower, d.loaUpper].filter(v => v != null).map((v, i) => (
          <g key={i}>
            <line x1={pad.left} y1={yS(v)} x2={W - pad.right} y2={yS(v)} stroke={t.err} strokeWidth={1} strokeDasharray="4,4" />
            <text x={W - pad.right + 4} y={yS(v) + 3} fill={t.err} fontSize={8} style={S}>{i === 0 ? "LOA−" : "LOA+"}: {v.toFixed(2)}</text>
          </g>
        ))}
        <path d={vals.map(v => `${v.diff >= d.meanDiff ? "M" : "M"}${xS(v.mean)},${yS(v.diff)}`).join("")} fill="none" stroke={t.tx3} strokeWidth={1} opacity={0.4} />
        {vals.map((v, i) => (
          <circle key={i} cx={xS(v.mean)} cy={yS(v.diff)} r={2.5} fill={t.tx3} opacity={0.5} />
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
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Landmark Error Map</div>
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
              <text x={pad.left - 6} y={y + 3} fill={t.tx} fontSize={8} textAnchor="end" style={S}>{label.length > 16 ? label.slice(0, 14) + "…" : label}</text>
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
      <BoxPlotChart combined={combined} labels={labels} t={t} />
    </div>
  );
}

function DistributionsChart({ combined, labels, t }) {
  const W = 600, H = Math.max(200, labels.length * 200 + 20);
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
                <rect key={i} x={xS(mn + i * binW)} y={yS(f)} width={Math.max(1, xS(binW) - xS(0))} height={yOff + pad.top + ph - yS(f)} fill={t.acc} opacity={0.3} rx={0} />
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
                return <path d={pts.join("")} fill="none" stroke={t.acc} strokeWidth={2} />;
              })()}
              <line x1={xS(s.mean)} y1={yOff + pad.top} x2={xS(s.mean)} y2={yOff + pad.top + ph} stroke={t.err} strokeWidth={1.5} strokeDasharray="4,3" />
              {[s.mean - s.sd, s.mean + s.sd].map(v => (
                <line key={v} x1={xS(v)} y1={yOff + pad.top} x2={xS(v)} y2={yOff + pad.top + ph} stroke={t.tx3} strokeWidth={0.5} strokeDasharray="2,2" />
              ))}
              <text x={xS(s.mean)} y={yOff + pad.top + ph + 14} fill={t.err} fontSize={7} textAnchor="middle" style={S}>µ={s.mean.toFixed(1)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BoxPlotChart({ combined, labels, t }) {
  const W = 300, H = labels.length * 24 + 30;
  const pad = { left: 100, right: 20, top: 10, bottom: 10 };
  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Box Plots</div>
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
              <text x={pl - 6} y={y + 3} fill={t.tx} fontSize={8} textAnchor="end" style={S}>{label.length > 14 ? label.slice(0, 12) + "…" : label}</text>
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
      <PValueDotChart labels={labels} results={results} t={t} />
    </div>
  );
}

function GroupMeansChart({ labels, t }) {
  const W = 600, H = Math.max(250, labels.length * 120 + 30);
  const pad = { left: 80, right: 20, top: 10, bottom: 20 };

  return (
    <div style={{ padding: 8, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Group Means</div>
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
                const color = t.acc;
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
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Effect Size Forest Plot</div>
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
              <text x={pad.left - 6} y={y + 4} fill={t.tx} fontSize={8} textAnchor="end" style={S}>{label.length > 16 ? label.slice(0, 14) + "…" : label}</text>
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
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>P-Values (α = {alpha})</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <line x1={xS(alpha)} y1={pad.top} x2={xS(alpha)} y2={H - pad.bottom} stroke={t.err} strokeWidth={1} strokeDasharray="4,3" />
        <text x={xS(alpha)} y={pad.top - 4} fill={t.err} fontSize={7} textAnchor="middle" style={S}>α={alpha}</text>
        {pLabels.map(([label, lr], i) => {
          const p = lr.result.pValue;
          const y = pad.top + i * 24 + 12;
          const sig = p < alpha;
          return (
            <g key={i}>
              <text x={pad.left - 6} y={y + 3} fill={t.tx} fontSize={8} textAnchor="end" style={S}>{label.length > 16 ? label.slice(0, 14) + "…" : label}</text>
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
      <ChangeScoreChart labels={labels} t={t} />
    </div>
  );
}

function LongitudinalTrajectories({ labels, t }) {
  const W = 600, H = Math.max(250, labels.length * 260 + 20);

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
                    <path d={`M${meanPts.join("L")}`} fill="none" stroke={t.acc} strokeWidth={2.5} />
                    {tpNames.map((tp, i) => {
                      const vals = rawData[tp]?.values || [];
                      const m = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                      if (m == null) return null;
                      return <circle key={tp} cx={xS(i)} cy={yS(m)} r={4} fill={t.acc} stroke={t.bg} strokeWidth={1} />;
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
      <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Change Scores</div>
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
                {c.from}→{c.to}: {c.meanChange.toFixed(2)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
