// ═══════════════════════════════════════════════════════════════════════════════
// SUPERIMPOSITION PANEL — Config & Results UI for Superimposition/Growth Studies
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { InfoBox } from "../ui.jsx";
import { REFERENCE_PLANES } from "./superimposition.js";

// ─── Shared label selector ───────────────────────────────────────────────────

function LabelSelector({ sessions, selected, onToggle, t }) {
  const labels = [...new Set((sessions || []).flatMap(s =>
    (s.markups || []).filter(m => m.label && m.type !== "ruler" && m.type !== "silhouette").map(m => m.label)
  ))].sort();
  if (labels.length === 0) return <div style={{ fontSize: 10, color: t.tx3 }}>No labeled markups found.</div>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {selected.length === 0 && <span style={{ fontSize: 10, color: t.tx3, padding: "2px 0" }}>All ({labels.length})</span>}
      {selected.length > 0 && (
        <button onClick={() => labels.forEach(l => { if (selected.includes(l)) onToggle(l); })}
          style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx3, cursor: "pointer" }}>
          Clear
        </button>
      )}
      {labels.map(l => (
        <button key={l} onClick={() => onToggle(l)}
          style={{
            fontSize: 9, padding: "2px 6px", borderRadius: 3, cursor: "pointer",
            border: `1px solid ${selected.includes(l) ? t.acc : t.bdr}`,
            background: selected.includes(l) ? t.acc + "22" : "transparent",
            color: selected.includes(l) ? t.acc : t.tx2,
            fontWeight: selected.includes(l) ? 700 : 400,
            fontFamily: "'DM Mono',monospace",
          }}>
          {l}
        </button>
      ))}
    </div>
  );
}

// ─── Config Panel ────────────────────────────────────────────────────────────

export function SuperimpositionConfig({ study, sessions, onUpdateStudy, t }) {
  const config = study.config;
  const baseId = config.baseSessionId || "";
  const compareId = config.compareSessionId || "";
  const method = config.method || "procrustes";
  const refPlane = config.referencePlane || "SN";
  const labelIds = config.labelIds || [];

  const update = (patch) => onUpdateStudy({ ...study, config: { ...config, ...patch } });

  const sessionList = (sessions || []).filter(s => s && (s.markups || []).length > 0);
  const baseSession = sessionList.find(s => s.id === baseId);
  const compareSession = sessionList.find(s => s.id === compareId);

  const toggleLabel = (label) => {
    const next = labelIds.includes(label) ? labelIds.filter(l => l !== label) : [...labelIds, label];
    update({ labelIds: next });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <InfoBox t={t}>
        Superimpose two tracings to visualize skeletal/dental change. Choose Procrustes (best-fit) or structural alignment (register on a craniofacial reference plane).
      </InfoBox>

      {/* Base session */}
      <div>
        <div style={{ fontSize: 10, color: t.tx2, marginBottom: 3, fontWeight: 600 }}>Base (T1 / Pre) Session *</div>
        <select value={baseId} onChange={e => update({ baseSessionId: e.target.value })}
          style={{ width: "100%", padding: "5px 8px", border: `1px solid ${t.bdr}`, borderRadius: 4, background: t.surf3, color: t.tx, fontSize: 11 }}>
          <option value="">Select base session...</option>
          {sessionList.map(s => (
            <option key={s.id} value={s.id}>{s.name || s.label || s.id.slice(0, 6)}{s.meta?.timepoint ? ` (${s.meta.timepoint})` : ""}</option>
          ))}
        </select>
      </div>

      {/* Compare session */}
      <div>
        <div style={{ fontSize: 10, color: t.tx2, marginBottom: 3, fontWeight: 600 }}>Compare (T2 / Post) Session *</div>
        <select value={compareId} onChange={e => update({ compareSessionId: e.target.value })}
          style={{ width: "100%", padding: "5px 8px", border: `1px solid ${t.bdr}`, borderRadius: 4, background: t.surf3, color: t.tx, fontSize: 11 }}>
          <option value="">Select compare session...</option>
          {sessionList.filter(s => s.id !== baseId).map(s => (
            <option key={s.id} value={s.id}>{s.name || s.label || s.id.slice(0, 6)}{s.meta?.timepoint ? ` (${s.meta.timepoint})` : ""}</option>
          ))}
        </select>
      </div>

      {/* Method */}
      <div>
        <div style={{ fontSize: 10, color: t.tx2, marginBottom: 3, fontWeight: 600 }}>Alignment Method</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[{ id: "procrustes", label: "Procrustes (Best-Fit)" }, { id: "structural", label: "Structural (Reference Plane)" }].map(opt => (
            <button key={opt.id} onClick={() => update({ method: opt.id })}
              style={{
                flex: 1, padding: "6px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${method === opt.id ? t.acc : t.bdr}`,
                background: method === opt.id ? t.acc + "22" : "transparent",
                color: method === opt.id ? t.acc : t.tx2,
              }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reference plane (structural only) */}
      {method === "structural" && (
        <div>
          <div style={{ fontSize: 10, color: t.tx2, marginBottom: 3, fontWeight: 600 }}>Reference Plane</div>
          <select value={refPlane} onChange={e => update({ referencePlane: e.target.value })}
            style={{ width: "100%", padding: "5px 8px", border: `1px solid ${t.bdr}`, borderRadius: 4, background: t.surf3, color: t.tx, fontSize: 11 }}>
            {REFERENCE_PLANES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <div style={{ fontSize: 9, color: t.tx3, marginTop: 3 }}>
            Requires "{REFERENCE_PLANES.find(p => p.id === refPlane)?.pt1}" and "{REFERENCE_PLANES.find(p => p.id === refPlane)?.pt2}" landmarks in both sessions.
          </div>
        </div>
      )}

      {/* Landmark filter */}
      <div>
        <div style={{ fontSize: 10, color: t.tx2, marginBottom: 3, fontWeight: 600 }}>
          Landmarks {labelIds.length > 0 ? `(${labelIds.length} selected)` : "(all)"}
        </div>
        <LabelSelector sessions={sessionList} selected={labelIds} onToggle={toggleLabel} t={t} />
      </div>

      {/* Session info */}
      {baseSession && compareSession && (
        <div style={{ fontSize: 9, color: t.tx3, padding: "6px 8px", background: t.surf2, borderRadius: 4 }}>
          Base: {baseSession.markups?.filter(m => m.type === "point" && m.label).length || 0} points
          {" | "}
          Compare: {compareSession.markups?.filter(m => m.type === "point" && m.label).length || 0} points
        </div>
      )}

      {!baseId && !compareId && (
        <div style={{ fontSize: 10, color: t.tx3, padding: "8px 0" }}>
          Select both sessions above, then click "Run Analysis" to compute superimposition.
        </div>
      )}
    </div>
  );
}

// ─── Results Panel ───────────────────────────────────────────────────────────

export function SuperimpositionResults({ results, t }) {
  const [tab, setTab] = useState("displacement");

  if (!results) return <div style={{ fontSize: 11, color: t.tx3, padding: 16 }}>No results. Run the analysis first.</div>;
  if (results.error) return <div style={{ fontSize: 11, color: t.err, padding: 16 }}>Error: {results.error}</div>;

  const { alignmentLabel, matchedCount, totalSrc, totalDst, displacements, angularChanges, linearChanges, centroidSize, stats, baseSession, compareSession, method } = results;

  const sorted = [...(displacements || [])].sort((a, b) => b.lenMm - a.lenMm);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Header */}
      <div style={{ padding: "8px 12px", background: t.surf2, borderRadius: 6, fontSize: 10, color: t.tx2 }}>
        <div style={{ fontWeight: 700, color: t.tx, marginBottom: 2 }}>
          {baseSession?.name || "T1"} → {compareSession?.name || "T2"}
        </div>
        <div>
          Method: <span style={{ color: t.acc }}>{method === "procrustes" ? "Procrustes" : "Structural"}</span>
          {" | "}Aligned on: {alignmentLabel}
        </div>
        <div>
          Matched: <span style={{ color: t.ok }}>{matchedCount}</span> / {totalSrc} base / {totalDst} compare landmarks
        </div>
        {results.calibrationUsed && <div style={{ color: t.ok }}>Calibrated (mm)</div>}
        {!results.calibrationUsed && <div style={{ color: t.warn }}>Not calibrated (px)</div>}
      </div>

      {/* Stats summary */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
          {[
            { label: "Mean", value: stats.mean?.toFixed(2), color: t.acc },
            { label: "Max", value: stats.max?.toFixed(2), color: t.err },
            { label: "Min", value: stats.min?.toFixed(2), color: t.ok },
            { label: "SD", value: stats.sd?.toFixed(2), color: t.tx2 },
          ].map(s => (
            <div key={s.label} style={{ padding: "6px 8px", background: t.surf2, borderRadius: 4, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: t.tx3 }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: s.color, fontFamily: "'DM Mono',monospace" }}>{s.value}</div>
              <div style={{ fontSize: 8, color: t.tx3 }}>{displacements?.[0]?.unit || "mm"}</div>
            </div>
          ))}
        </div>
      )}

      {/* Centroid size */}
      {centroidSize && (
        <div style={{ padding: "6px 10px", background: t.surf2, borderRadius: 4, fontSize: 10, display: "flex", gap: 16 }}>
          <span>Centroid size: <b>{centroidSize.base?.toFixed(1)}</b> → <b>{centroidSize.compare?.toFixed(1)}</b></span>
          <span style={{ color: centroidSize.pctChange > 0 ? t.ok : centroidSize.pctChange < 0 ? t.err : t.tx2 }}>
            {centroidSize.pctChange > 0 ? "+" : ""}{centroidSize.pctChange?.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${t.bdr}`, paddingBottom: 0 }}>
        {[
          { id: "displacement", label: "Displacements" },
          { id: "angular", label: "Angular" },
          { id: "linear", label: "Linear" },
        ].map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            style={{
              padding: "5px 10px", fontSize: 10, fontWeight: tab === tb.id ? 700 : 500, cursor: "pointer",
              background: "transparent", border: "none", borderBottom: tab === tb.id ? `2px solid ${t.acc}` : "2px solid transparent",
              color: tab === tb.id ? t.acc : t.tx3, transition: "all 0.15s",
            }}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* Displacement table */}
      {tab === "displacement" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Landmark</th>
                <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Displacement</th>
                <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Direction</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, i) => (
                <tr key={d.label} style={{ background: i % 2 === 0 ? "transparent" : t.surf2 + "44" }}>
                  <td style={{ padding: "3px 6px", fontFamily: "'DM Mono',monospace", color: t.tx }}>{d.label}</td>
                  <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace" }}>
                    <span style={{ color: d.lenMm < 2 ? t.ok : d.lenMm < 5 ? t.warn : t.err, fontWeight: 600 }}>
                      {d.lenMm.toFixed(2)} {d.unit}
                    </span>
                  </td>
                  <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>
                    {d.angle?.toFixed(0)}°
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Angular changes table */}
      {tab === "angular" && (
        <div style={{ overflowX: "auto" }}>
          {(!angularChanges || angularChanges.length === 0) ? (
            <div style={{ fontSize: 10, color: t.tx3, padding: 12 }}>No matching angular measurements found.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Angle</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>T1</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>T2</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {angularChanges.map((c, i) => (
                  <tr key={c.label} style={{ background: i % 2 === 0 ? "transparent" : t.surf2 + "44" }}>
                    <td style={{ padding: "3px 6px", fontFamily: "'DM Mono',monospace", color: t.tx }}>{c.label}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>{c.angle1?.toFixed(1)}°</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>{c.angle2?.toFixed(1)}°</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace" }}>
                      <span style={{ color: Math.abs(c.delta) < 1 ? t.ok : Math.abs(c.delta) < 3 ? t.warn : t.err, fontWeight: 600 }}>
                        {c.delta > 0 ? "+" : ""}{c.delta?.toFixed(1)}°
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Linear changes table */}
      {tab === "linear" && (
        <div style={{ overflowX: "auto" }}>
          {(!linearChanges || linearChanges.length === 0) ? (
            <div style={{ fontSize: 10, color: t.tx3, padding: 12 }}>No matching linear measurements found.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Measurement</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>T1</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>T2</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {linearChanges.map((c, i) => (
                  <tr key={`${c.label}::${c.measureKey}`} style={{ background: i % 2 === 0 ? "transparent" : t.surf2 + "44" }}>
                    <td style={{ padding: "3px 6px", fontFamily: "'DM Mono',monospace", color: t.tx }}>{c.label} ({c.measureKey})</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>{c.value1?.toFixed(2)} {c.unit}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>{c.value2?.toFixed(2)} {c.unit}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace" }}>
                      <span style={{ color: Math.abs(c.delta) < 1 ? t.ok : Math.abs(c.delta) < 3 ? t.warn : t.err, fontWeight: 600 }}>
                        {c.delta > 0 ? "+" : ""}{c.delta?.toFixed(2)} {c.unit}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
