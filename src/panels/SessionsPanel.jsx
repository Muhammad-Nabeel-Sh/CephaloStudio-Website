import { useState } from "react";
import { mkSession } from "../model/session.js";
import { mkSubject, addSession, removeSession, duplicateSessionInProject, addSubject, removeSubject, updateSubject } from "../model/project.js";
import { Btn, Tag, InfoBox } from "../ui.jsx";
import BatchImportModal from "./BatchImportModal.jsx";

export default function SessionsPanel({
  project, t, onUpdateProject,
}) {
  const [newName, setNewName] = useState("");
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [tab, setTab] = useState("sessions");
  const [newSubjectLabel, setNewSubjectLabel] = useState("");
  const [newSubInput, setNewSubInput] = useState("");
  const sessionList = project?.sessions || [];
  const subjects = project?.subjects || [];
  const activeId = project?.activeSessionId;

  const handleAdd = () => {
    const session = mkSession({ name: newName || `Session ${sessionList.length + 1}` });
    onUpdateProject(addSession(project, session));
    setNewName("");
  };

  const handleDuplicate = (id) => {
    onUpdateProject(duplicateSessionInProject(project, id));
  };

  const handleRemove = (id) => {
    if (sessionList.length <= 1) return;
    if (!window.confirm("Remove this session?")) return;
    onUpdateProject(removeSession(project, id));
  };

  const handleSetActive = (id) => {
    onUpdateProject({ ...project, activeSessionId: id });
  };

  const patchSession = (id, patch) => {
    onUpdateProject({
      ...project,
      sessions: sessionList.map(s => s.id === id ? { ...s, ...patch, meta: { ...s.meta, ...(patch.meta || {}) } } : s),
    });
  };

  const handleAddSubject = () => {
    if (!newSubjectLabel.trim()) return;
    onUpdateProject(addSubject(project, mkSubject({ label: newSubjectLabel.trim() })));
    setNewSubjectLabel("");
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 2, marginBottom: 12, borderBottom: `1px solid ${t.bdr}44` }}>
        {["sessions", "subjects"].map(tabId => (
          <button key={tabId} onClick={() => setTab(tabId)}
            style={{
              padding: "5px 10px", fontSize: 9, fontWeight: 600, cursor: "pointer",
              border: "none", borderBottom: tab === tabId ? `2px solid ${t.acc}` : "2px solid transparent",
              background: "transparent", color: tab === tabId ? t.acc : t.tx3, textTransform: "uppercase",
            }}>
            {tabId === "sessions" ? `Sessions (${sessionList.length})` : `Subjects (${subjects.length})`}
          </button>
        ))}
      </div>

      {tab === "sessions" && (
        <>
          <InfoBox t={t}>
            Each <b>session</b> is one patient visit / imaging event. Assign a <b>subject</b> (patient),
            an optional <b>group</b> (e.g. control, treatment) and <b>timepoint</b> (e.g. T0, T1, follow-up)
            to organise sessions for research analysis.
          </InfoBox>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New session name..."
              style={{ flex: 1, background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12, fontFamily: "inherit" }}
              onKeyDown={e => { if (e.key === "Enter") handleAdd(); }} />
            <Btn t={t} small onClick={handleAdd}>+ Add</Btn>
            <Btn t={t} small ghost onClick={() => setShowBatchImport(true)} title="Batch import images with CSV metadata">📦 Import</Btn>
          </div>
          {showBatchImport && (
            <BatchImportModal t={t} project={project} onUpdateProject={onUpdateProject} onClose={() => setShowBatchImport(false)} />
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {sessionList.map((s, i) => (
              <div key={s.id} onClick={() => handleSetActive(s.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 6,
                  background: s.id === activeId ? t.acc + "18" : t.surf2,
                  border: s.id === activeId ? `1px solid ${t.acc}` : `1px solid ${t.bdr}`,
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                    <SessionNameEditor name={s.name || `Session ${i + 1}`} onRename={n => patchSession(s.id, { name: n })} t={t} />
                    {s.meta?.group && <Tag color={t.acc} style={{ fontSize: 8 }}>{s.meta.group}</Tag>}
                    {s.meta?.timepoint && <Tag color={t.warn} style={{ fontSize: 8 }}>{s.meta.timepoint}</Tag>}
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 2, flexWrap: "wrap" }}>
                    {/* Subject picker with inline creation */}
                    {newSubInput && s.id === newSubInput.split(":")[0] ? (
                      <form onSubmit={e => { e.preventDefault(); e.stopPropagation(); const v = newSubInput.split(":")[1]; if (v.trim()) { const sub = mkSubject({ label: v.trim() }); onUpdateProject({ ...addSubject(project, sub), sessions: sessionList.map(s2 => s2.id === s.id ? { ...s2, subjectId: sub.id, meta: { ...s2.meta } } : s2) }); } setNewSubInput(""); }}
                        style={{ display: "flex", gap: 2 }} onClick={e => e.stopPropagation()}>
                        <input autoFocus value={newSubInput.split(":")[1] || ""} onChange={e => setNewSubInput(`${s.id}:${e.target.value}`)}
                          placeholder="Subject name..." style={{ width: 80, fontSize: 9, padding: "1px 4px", borderRadius: 3, border: `1px solid ${t.acc}`, background: t.surf, color: t.tx }} />
                        <button type="submit" style={{ padding: "1px 6px", borderRadius: 3, border: "none", background: t.acc, color: t.bg, fontSize: 9, cursor: "pointer" }}>OK</button>
                        <button type="button" onClick={() => setNewSubInput("")} style={{ padding: "1px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx3, fontSize: 9, cursor: "pointer" }}>✕</button>
                      </form>
                    ) : (
                      <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                        <select value={s.subjectId || ""} onChange={e => { e.stopPropagation(); patchSession(s.id, { subjectId: e.target.value }); }}
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, maxWidth: 100 }}>
                          <option value="">No subject</option>
                          {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.label}</option>)}
                        </select>
                        <button onClick={e => { e.stopPropagation(); setNewSubInput(`${s.id}:`); }} title="New subject"
                          style={{ background: "none", border: "none", color: t.acc, cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}>+</button>
                      </div>
                    )}
                    {/* Group */}
                    <input value={s.meta?.group || ""} placeholder="Group" onChange={e => { e.stopPropagation(); patchSession(s.id, { meta: { ...s.meta, group: e.target.value } }); }}
                      onClick={e => e.stopPropagation()} style={{ width: 60, fontSize: 9, padding: "1px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx }} />
                    {/* Timepoint */}
                    <input value={s.meta?.timepoint || ""} placeholder="Timepoint" onChange={e => { e.stopPropagation(); patchSession(s.id, { meta: { ...s.meta, timepoint: e.target.value } }); }}
                      onClick={e => e.stopPropagation()} style={{ width: 60, fontSize: 9, padding: "1px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx }} />
                  </div>
                  <div style={{ fontSize: 10, color: t.tx3, marginTop: 2 }}>
                    {s.image ? (s.image.name || "Image loaded") : "No image"}
                    {s.calibration?.done ? ` · ${s.calibration.pxPerMm.toFixed(1)}px/mm` : ""}
                    {s.markups?.length ? ` · ${s.markups.length} marks` : ""}
                  </div>
                </div>
                {s.id === activeId && <Tag color={t.ok} style={{ fontSize: 9 }}>Active</Tag>}
                <button onClick={e => { e.stopPropagation(); handleDuplicate(s.id); }} title="Duplicate session"
                  style={{ background: "none", border: "none", cursor: "pointer", color: t.tx2, padding: 2, fontSize: 14 }}>⧉</button>
                <button onClick={e => { e.stopPropagation(); handleRemove(s.id); }} disabled={sessionList.length <= 1} title="Remove session"
                  style={{ background: "none", border: "none", cursor: sessionList.length <= 1 ? "not-allowed" : "pointer", color: sessionList.length <= 1 ? t.tx3 : t.err, padding: 2, fontSize: 14 }}>✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "subjects" && (
        <div>
          <InfoBox t={t}>
            <b>Subjects</b> are the patients or specimens being studied. Create them here, then
            assign sessions to each subject in the <b>Sessions</b> tab. Research modules
            use subjects to auto-populate cases, groups and timepoints.
          </InfoBox>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input value={newSubjectLabel} onChange={e => setNewSubjectLabel(e.target.value)} placeholder="Subject name..."
              style={{ flex: 1, background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12, fontFamily: "inherit" }}
              onKeyDown={e => { if (e.key === "Enter") handleAddSubject(); }} />
            <Btn t={t} small onClick={handleAddSubject}>+ Add</Btn>
          </div>
          {subjects.length === 0 && (
            <div style={{ fontSize: 11, color: t.tx3, textAlign: "center", padding: 20 }}>No subjects defined.</div>
          )}
          {subjects.map(sub => {
            const subSessions = sessionList.filter(s => s.subjectId === sub.id);
            return (
              <div key={sub.id} style={{ marginBottom: 8, padding: 8, borderRadius: 6, background: t.surf3, border: `1px solid ${t.bdr}44` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                  <input value={sub.label} onChange={e => onUpdateProject(updateSubject(project, sub.id, { label: e.target.value }))}
                    style={{ flex: 1, padding: "3px 6px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 10, fontWeight: 600 }} />
                  <button onClick={() => { if (window.confirm("Remove subject and unlink its sessions?")) onUpdateProject(removeSubject(project, sub.id)); }}
                    style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 10, padding: 2 }}>✕</button>
                </div>
                <div style={{ display: "flex", gap: 4, fontSize: 9, color: t.tx3 }}>
                  <span>{subSessions.length} session(s)</span>
                  {sub.age && <span>· Age: {sub.age}</span>}
                  {sub.sex && <span>· Sex: {sub.sex}</span>}
                </div>
                {subSessions.length > 0 && (
                  <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {subSessions.map(ss => (
                      <span key={ss.id} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: t.surf2, color: t.tx2, border: `1px solid ${t.bdr}` }}>
                        {ss.name || ss.id.slice(0, 6)}{ss.meta?.timepoint ? ` (${ss.meta.timepoint})` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SessionNameEditor({ name, onRename, t }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  if (editing) {
    return (
      <input autoFocus value={val} onChange={e => setVal(e.target.value)}
        onBlur={() => { onRename(val || name); setEditing(false); }}
        onKeyDown={e => { if (e.key === "Enter") { onRename(val || name); setEditing(false); } }}
        style={{ background: t.surf3, border: `1px solid ${t.acc}`, borderRadius: 4, padding: "2px 4px", color: t.tx, fontSize: 13, width: "100%", fontFamily: "inherit", boxSizing: "border-box" }} />
    );
  }
  return (
    <span style={{ fontSize: 13, fontWeight: 700, color: t.tx, cursor: "pointer" }} onClick={() => { setVal(name); setEditing(true); }} title="Click to rename">
      {name}
    </span>
  );
}
