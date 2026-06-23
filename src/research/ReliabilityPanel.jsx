// ═══════════════════════════════════════════════════════════════════════════════
// RELIABILITY PANEL — Config & Results UI for Reproducibility Studies
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { InfoBox } from "../ui.jsx";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Label Selector (reused from ResearchPanel) ─────────────────────────
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

// ─── Config Panel ────────────────────────────────────────────────────────
export function ReliabilityConfig({ study, sessions, onUpdateStudy, t, project }) {
  const config = study.config;
  const operators = config.operators || [];
  const cases = config.cases || [];
  const labelIds = config.labelIds || [];
  const unusedSessions = sessions.filter(s => !cases.some(c => (c.sessions || []).some(cs => cs.sessionId === s.id)));

  const update = (patch) => {
    onUpdateStudy({
      ...study,
      config: { ...config, ...patch },
    });
  };

  const isMethod = config.design === "method_comparison";
  const agentLabel = isMethod ? "Method" : "Operator";
  const agentLabelPl = isMethod ? "Methods" : "Operators";

  const addOperator = () => {
    const defaultRole = isMethod ? "test" : "primary";
    update({ operators: [...operators, { id: uid(), name: `${agentLabel} ${operators.length + 1}`, role: defaultRole }] });
  };

  const removeOperator = (id) => {
    update({ operators: operators.filter(o => o.id !== id) });
  };

  const renameOperator = (id, name) => {
    update({ operators: operators.map(o => o.id === id ? { ...o, name } : o) });
  };

  const addCase = () => {
    update({ cases: [...cases, { id: uid(), name: `Case ${cases.length + 1}`, sessions: [] }] });
  };

  const removeCase = (id) => {
    update({ cases: cases.filter(c => c.id !== id) });
  };

  const addSessionToCase = (caseId, sessionId, operatorId, occasion) => {
    update({
      cases: cases.map(c => {
        if (c.id !== caseId) return c;
        const next = [...(c.sessions || []), { sessionId, operatorId, occasion: occasion || 1 }];
        return { ...c, sessions: next };
      }),
    });
  };

  const removeSessionFromCase = (caseId, sessionId) => {
    update({
      cases: cases.map(c => {
        if (c.id !== caseId) return c;
        return { ...c, sessions: (c.sessions || []).filter(s => s.sessionId !== sessionId) };
      }),
    });
  };

  const toggleLabel = (labelId) => {
    const next = labelIds.includes(labelId) ? labelIds.filter(id => id !== labelId) : [...labelIds, labelId];
    update({ labelIds: next });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 11 }}>

      <InfoBox t={t}>
        Each <b>case</b> represents one subject at one timepoint. Assign sessions to cases,
        then match each session to an <b>operator</b> and <b>occasion</b>.
        Use <b>"From Subjects"</b> to auto-populate from your project subjects.
      </InfoBox>

      {/* Design selector */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Study Design</div>
        <div style={{ display: "flex", gap: 4 }}>
          {["intra", "inter", "method_comparison"].map(d => (
            <button key={d} onClick={() => update({ design: d })}
              style={{
                flex: 1, padding: "5px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${config.design === d ? t.acc : t.bdr}`,
                background: config.design === d ? t.acc + "22" : "transparent",
                color: config.design === d ? t.acc : t.tx2,
              }}>
              {d === "intra" ? "Intra-operator" : d === "inter" ? "Inter-operator" : "Method Comparison"}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 9, color: t.tx3, marginTop: 2 }}>
          {config.design === "intra" ? "Same operator, repeated measurements on each case" :
           config.design === "inter" ? "Different operators measuring the same cases" :
           "Comparing two measurement methods on the same cases"}
        </div>
      </div>

      {/* Operators / Methods */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3 }}>{agentLabelPl}</span>
          <button onClick={addOperator}
            style={{ fontSize: 9, padding: "2px 8px", borderRadius: 3, border: `1px solid ${t.acc}`, background: "transparent", color: t.acc, cursor: "pointer" }}>
            + Add
          </button>
        </div>
        {operators.length === 0 && <div style={{ fontSize: 10, color: t.tx3 }}>No {agentLabel.toLowerCase()}s defined.</div>}
        {operators.map(o => (
          <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
            <input value={o.name} onChange={e => renameOperator(o.id, e.target.value)}
              style={{
                flex: 1, padding: "4px 6px", borderRadius: 3, border: `1px solid ${t.bdr}`,
                background: t.surf, color: t.tx, fontSize: 10,
              }} />
            <select value={o.role} onChange={e => update({ operators: operators.map(op => op.id === o.id ? { ...op, role: e.target.value } : op) })}
              style={{ padding: "3px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }}>
              {isMethod ? (
                <>
                  <option value="reference">Reference</option>
                  <option value="test">Test</option>
                </>
              ) : (
                <>
                  <option value="primary">Primary</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="trainee">Trainee</option>
                </>
              )}
            </select>
            <button onClick={() => removeOperator(o.id)}
              style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 11, padding: 2 }}>✕</button>
          </div>
        ))}
      </div>

      {/* Protocol */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Protocol</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: t.tx2 }}>Occasions:</span>
          <select value={config.protocol?.occasions || 2}
            onChange={e => update({ protocol: { ...config.protocol, occasions: Number(e.target.value) } })}
            style={{ padding: "3px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }}>
            {[2, 3].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <label style={{ fontSize: 10, color: t.tx2, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={config.protocol?.blindingEnforced || false}
              onChange={e => update({ protocol: { ...config.protocol, blindingEnforced: e.target.checked } })} />
            Blinding
          </label>
        </div>
        {config.design === "intra" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: t.tx2 }}>Min separation (days):</span>
            <input type="number" min={1} value={config.minTimeSeparation || 14}
              onChange={e => update({ minTimeSeparation: Math.max(1, Number(e.target.value)) })}
              style={{ width: 50, padding: "3px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }} />
          </div>
        )}
      </div>

      {/* Cases / Session mapping */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3 }}>Cases</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => {
              const subjects = project?.subjects || [];
              if (subjects.length === 0) return;
              const managedOps = project?.operators || [];
              const newOps = managedOps.length > 0
                ? managedOps.map((name, i) => ({ id: uid(), name, role: i === 0 ? (isMethod ? "test" : "primary") : "secondary" }))
                : [{ id: uid(), name: operators[0]?.name || "Operator 1", role: isMethod ? "test" : "primary" }];
              const op = newOps[0];
              const newCases = subjects.map(sub => {
                const subSessions = sessions.filter(s => s.subjectId === sub.id);
                return {
                  id: uid(),
                  name: sub.label,
                  sessions: subSessions.map((s, i) => ({ sessionId: s.id, operatorId: op.id, occasion: i + 1 })),
                };
              });
              update({ operators: newOps, cases: newCases });
            }}
              style={{ fontSize: 9, padding: "2px 8px", borderRadius: 3, border: `1px solid ${t.acc}`, background: "transparent", color: t.acc, cursor: "pointer" }}>
              From Subjects
            </button>
            <button onClick={addCase}
              style={{ fontSize: 9, padding: "2px 8px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx2, cursor: "pointer" }}>
              + Add Case
            </button>
          </div>
        </div>
        {cases.length === 0 && (
          <div style={{ fontSize: 10, color: t.tx3, padding: "6px 0" }}>No cases defined. Add a case and assign sessions to it.</div>
        )}
        {cases.map(c => (
          <div key={c.id} style={{ marginBottom: 8, padding: 8, borderRadius: 4, background: t.surf3, border: `1px solid ${t.bdr}44` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
              <input value={c.name} onChange={e => update({ cases: cases.map(c2 => c2.id === c.id ? { ...c2, name: e.target.value } : c2) })}
                style={{ flex: 1, padding: "3px 6px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 10, fontWeight: 600 }} />
              <button onClick={() => removeCase(c.id)}
                style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 10, padding: 2 }}>✕</button>
            </div>

            {/* Sessions in this case */}
            {(c.sessions || []).map(cs => {
              const ses = sessions.find(s => s.id === cs.sessionId);
              const op = operators.find(o => o.id === cs.operatorId);
              return (
                <div key={cs.sessionId} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3, padding: "3px 4px", background: t.surf2, borderRadius: 3 }}>
                  <span style={{ flex: 1, fontSize: 9, color: t.tx, fontFamily: "'DM Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ses?.name || ses?.label || cs.sessionId.slice(0, 8)}
                  </span>
                  <span style={{ fontSize: 8, color: t.tx3 }}>→</span>
                  <span style={{ fontSize: 9, color: t.acc, fontWeight: 600 }}>{op?.name || cs.operatorId}</span>
                  <span style={{ fontSize: 8, color: t.tx3 }}>Occ:</span>
                  <span style={{ fontSize: 9, color: t.tx2 }}>{cs.occasion || 1}</span>
                  <button onClick={() => removeSessionFromCase(c.id, cs.sessionId)}
                    style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 9, padding: 1 }}>✕</button>
                </div>
              );
            })}

            {/* Add session to this case */}
            {unusedSessions.length > 0 && (
              <SessionPicker
                sessions={unusedSessions}
                operators={operators}
                occasions={config.protocol?.occasions || 2}
                onPick={(sessionId, operatorId, occasion) => addSessionToCase(c.id, sessionId, operatorId, occasion)}
                t={t}
              />
            )}
          </div>
        ))}
      </div>

      {/* Measurement labels */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Measurements</div>
        <LabelSelector sessions={sessions} selected={labelIds} onToggle={toggleLabel} t={t} />
      </div>

      {/* Ready indicator */}
      <div style={{ fontSize: 10, color: t.tx2, textAlign: "center", padding: 6, background: t.surf3, borderRadius: 4 }}>
        {cases.length === 0 ? "⚠ Add at least one case with mapped sessions" :
         operators.length < (config.design === "intra" ? 1 : 2) ? `⚠ Define enough ${agentLabel.toLowerCase()}s for this design` :
         `✓ ${cases.length} case(s), ${operators.length} ${agentLabel.toLowerCase()}s, ${labelIds.length || "all"} measurement(s)`}
      </div>
    </div>
  );
}

// ─── Session Picker (inline dropdown for adding to a case) ──────────────
function SessionPicker({ sessions, operators, occasions, onPick, t }) {
  const [sessionId, setSessionId] = useState("");
  const [operatorId, setOperatorId] = useState(operators[0]?.id || "");
  const [occasion, setOccasion] = useState(1);

  const handleAdd = () => {
    if (!sessionId || !operatorId) return;
    onPick(sessionId, operatorId, occasion);
    setSessionId("");
  };

  return (
    <div style={{ display: "flex", gap: 3, marginTop: 4, alignItems: "center" }}>
      <select value={sessionId} onChange={e => setSessionId(e.target.value)}
        style={{ flex: 1, padding: "3px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }}>
        <option value="">Select session...</option>
        {sessions.map(s => (
          <option key={s.id} value={s.id}>{s.name || s.label || s.id.slice(0, 8)}</option>
        ))}
      </select>
      <select value={operatorId} onChange={e => setOperatorId(e.target.value)}
        style={{ padding: "3px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }}>
        {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <select value={occasion} onChange={e => setOccasion(Number(e.target.value))}
        style={{ padding: "3px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }}>
        {Array.from({ length: occasions }, (_, i) => (
          <option key={i} value={i + 1}>Occ. {i + 1}</option>
        ))}
      </select>
      <button onClick={handleAdd} disabled={!sessionId || !operatorId}
        style={{
          padding: "3px 8px", borderRadius: 3, border: "none", cursor: "pointer",
          background: t.acc, color: t.bg, fontSize: 9, fontWeight: 700,
          opacity: sessionId && operatorId ? 1 : 0.4,
        }}>
        + Add
      </button>
    </div>
  );
}

// ─── Results Panel ──────────────────────────────────────────────────────
export function ReliabilityResults({ results, t }) {
  const [tab, setTab] = useState("icc");
  const details = results.details || [];

  const tabs = [
    { id: "icc", label: "ICC" },
    { id: "ba", label: "Bland-Altman" },
    { id: "error", label: "Method Error" },
    { id: "map", label: "Error Map" },
    { id: "summary", label: "Summary" },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 8, borderBottom: `1px solid ${t.bdr}44` }}>
        {tabs.map(tabItem => (
          <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
            style={{
              padding: "5px 10px", fontSize: 9, fontWeight: 600, cursor: "pointer",
              border: "none", borderBottom: tab === tabItem.id ? `2px solid ${t.acc}` : "2px solid transparent",
              background: "transparent", color: tab === tabItem.id ? t.acc : t.tx3,
            }}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {results.note && !results.details?.length && (
        <div style={{ fontSize: 11, color: t.tx2, padding: 12, textAlign: "center" }}>{results.note}</div>
      )}

      {tab === "icc" && <ICCView details={details} t={t} />}
      {tab === "ba" && <BlandAltmanView details={details} t={t} />}
      {tab === "error" && <MethodErrorView details={details} t={t} />}
      {tab === "map" && <ErrorMapView results={results} t={t} />}
      {tab === "summary" && <SummaryView results={results} t={t} />}
    </div>
  );
}

// ─── ICC Table ──────────────────────────────────────────────────────────
function ICCView({ details, t }) {
  const valid = details.filter(d => !d.skip && d.icc != null).filter(d => d.icc !== undefined);
  if (valid.length === 0) return <EmptyDetail message="No ICC results available." t={t} />;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
        <thead>
          <tr style={{ background: t.surf2 }}>
            {["Label", "ICC", "95% CI", "Interp.", "F", "df1", "df2", "p"].map(h => (
              <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: t.tx3, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {valid.map(r => {
            const intLabel = iccInterpretation(r.icc);
            const intColor = iccColor(r.icc);
            return (
              <tr key={r.label} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                <td style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}>{r.label}</td>
                <td style={{ padding: "5px 6px", color: intColor, fontWeight: 700 }}>{r.icc.toFixed(4)}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>
                  {r.ci95?.[0] != null ? `[${r.ci95[0].toFixed(3)}, ${r.ci95[1].toFixed(3)}]` : "—"}
                </td>
                <td style={{ padding: "5px 6px" }}>
                  <span style={{
                    padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700,
                    background: intColor + "22", border: `1px solid ${intColor}44`, color: intColor,
                  }}>{intLabel}</span>
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.F?.toFixed(2) || "—"}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.df1 ?? "—"}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.df2 ?? "—"}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.pValue != null ? fmtP(r.pValue) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Bland-Altman View ──────────────────────────────────────────────────
function BlandAltmanView({ details, t }) {
  const valid = details.filter(d => !d.skip && d.meanDiff != null);
  if (valid.length === 0) return <EmptyDetail message="No Bland-Altman results available." t={t} />;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
        <thead>
          <tr style={{ background: t.surf2 }}>
            {["Label", "Mean Diff", "SD Diff", "LoA Lower", "LoA Upper", "Prop. Bias", "p"].map(h => (
              <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: t.tx3, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {valid.map(r => (
            <tr key={r.label} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
              <td style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}>{r.label}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.meanDiff.toFixed(4)}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.sdDiff.toFixed(4)}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.loaLower?.toFixed(4) || "—"}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.loaUpper?.toFixed(4) || "—"}</td>
              <td style={{ padding: "5px 6px", color: r.proportionalBias?.detected ? t.err : t.ok }}>
                {r.proportionalBias?.detected ? "Yes" : "No"}
              </td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.proportionalBias?.pValue != null ? fmtP(r.proportionalBias.pValue) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Method Error View (Dahlberg / SEM / MDC) ───────────────────────────
function MethodErrorView({ details, t }) {
  const valid = details.filter(d => !d.skip && d.dahlberg != null);
  if (valid.length === 0) return <EmptyDetail message="No method error results available." t={t} />;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
        <thead>
          <tr style={{ background: t.surf2 }}>
            {["Label", "Dahlberg", "SEM", "MDC (95%)", "CV (%)", "N"].map(h => (
              <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: t.tx3, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {valid.map(r => (
            <tr key={r.label} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
              <td style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}>{r.label}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.dahlberg.toFixed(4)}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.sem?.toFixed(4) || "—"}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.mdc?.toFixed(4) || "—"}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.cv?.toFixed(2) || "—"}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.n || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Landmark Error Map ─────────────────────────────────────────────────
function ErrorMapView({ results, t }) {
  const map = results.landmarkMap;
  if (!map || Object.keys(map).length === 0) return <EmptyDetail message="No landmark error data available. Ensure point-type markups are placed." t={t} />;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
        <thead>
          <tr style={{ background: t.surf2 }}>
            {["Landmark", "N", "Mean Error", "SD Error", "Max Error", "Ellipse Major", "Ellipse Minor"].map(h => (
              <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: t.tx3, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(map).sort().map(([label, lm]) => (
            <tr key={label} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
              <td style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}>{label}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{lm.n}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{lm.meanError.toFixed(2)} px</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{lm.sdError.toFixed(2)} px</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{lm.maxError.toFixed(2)} px</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{lm.ellipse?.major?.toFixed(2) || "—"} px</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{lm.ellipse?.minor?.toFixed(2) || "—"} px</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Summary View ────────────────────────────────────────────────────────
function SummaryView({ results, t }) {
  const s = results.summary || {};
  const details = results.details || [];
  const valid = details.filter(d => !d.skip);
  const skipped = details.filter(d => d.skip);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ padding: 10, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Study Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 12px", fontSize: 10, color: t.tx2 }}>
          <span>Design:</span><span style={{ color: t.tx, fontWeight: 600 }}>{s.design || "—"}</span>
          <span>Operators:</span><span style={{ color: t.tx }}>{s.operators || "—"}</span>
          <span>Cases:</span><span style={{ color: t.tx }}>{s.cases || "—"}</span>
          <span>Occasions:</span><span style={{ color: t.tx }}>{s.occasions || "—"}</span>
          <span>Measurements:</span><span style={{ color: t.tx }}>{results.measurements || 0}</span>
          <span>Labels analyzed:</span><span style={{ color: t.tx }}>{valid.length}</span>
        </div>
      </div>

      {valid.length > 0 && (
        <div style={{ padding: 10, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.tx, marginBottom: 6 }}>ICC Summary</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 12px", fontSize: 10, color: t.tx2 }}>
            <span>Excellent (≥0.90):</span><span style={{ color: t.ok, fontWeight: 600 }}>{valid.filter(d => d.icc >= 0.9).length}</span>
            <span>Good (0.75–0.90):</span><span style={{ color: "#60a5fa", fontWeight: 600 }}>{valid.filter(d => d.icc >= 0.75 && d.icc < 0.9).length}</span>
            <span>Moderate (0.50–0.75):</span><span style={{ color: t.warn, fontWeight: 600 }}>{valid.filter(d => d.icc >= 0.5 && d.icc < 0.75).length}</span>
            <span>Poor ({`<`}0.50):</span><span style={{ color: t.err, fontWeight: 600 }}>{valid.filter(d => d.icc < 0.5).length}</span>
          </div>
        </div>
      )}

      {skipped.length > 0 && (
        <div style={{ padding: 10, background: t.err + "0a", borderRadius: 6, border: `1px solid ${t.err}33` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.err, marginBottom: 4 }}>Skipped ({skipped.length})</div>
          {skipped.map(d => (
            <div key={d.label} style={{ fontSize: 9, color: t.tx2, marginBottom: 2 }}>
              <span style={{ color: t.tx, fontWeight: 600 }}>{d.label}</span>: {d.reason}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────
function EmptyDetail({ message, t }) {
  return <div style={{ fontSize: 11, color: t.tx3, textAlign: "center", padding: 16 }}>{message}</div>;
}

function iccInterpretation(val) {
  if (val >= 0.9) return "Excellent";
  if (val >= 0.75) return "Good";
  if (val >= 0.5) return "Moderate";
  return "Poor";
}

function iccColor(val) {
  if (val >= 0.9) return "#34d399";
  if (val >= 0.75) return "#60a5fa";
  if (val >= 0.5) return "#fb923c";
  return "#f87171";
}

function fmtP(p) {
  if (p == null || !isFinite(p)) return "—";
  if (p < 0.001) return "<0.001";
  return p.toFixed(3);
}
