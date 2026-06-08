import { useState } from "react";
import { mkSession } from "../model/session.js";
import { addSession, removeSession, duplicateSessionInProject } from "../model/project.js";
import { Btn, Tag } from "../ui.jsx";
import BatchImportModal from "./BatchImportModal.jsx";

export default function SessionsPanel({
  project, t, onUpdateProject,
}) {
  const [newName, setNewName] = useState("");
  const [showBatchImport, setShowBatchImport] = useState(false);
  const sessionList = project?.sessions || [];
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

  const handleRename = (id, name) => {
    onUpdateProject({
      ...project,
      sessions: sessionList.map(s =>
        s.id === id ? { ...s, name } : s
      ),
    });
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New session name..."
          style={{
            flex: 1, background: t.surf3, border: `1px solid ${t.bdr}`,
            borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12,
            fontFamily: "inherit",
          }}
          onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
        />
        <Btn t={t} small onClick={handleAdd}>+ Add</Btn>
        <Btn t={t} small ghost onClick={() => setShowBatchImport(true)} title="Batch import images with CSV metadata">📦 Import</Btn>
      </div>
      {showBatchImport && (
        <BatchImportModal t={t} project={project} onUpdateProject={onUpdateProject} onClose={() => setShowBatchImport(false)} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {sessionList.map((s, i) => (
          <div
            key={s.id}
            onClick={() => handleSetActive(s.id)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 8px", borderRadius: 6,
              background: s.id === activeId ? t.acc + "18" : t.surf2,
              border: s.id === activeId ? `1px solid ${t.acc}` : `1px solid ${t.bdr}`,
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <SessionNameEditor
                name={s.name || `Session ${i + 1}`}
                onRename={n => handleRename(s.id, n)}
                t={t}
              />
              <div style={{ fontSize: 10, color: t.tx3, marginTop: 2 }}>
                {s.image ? (s.image.name || "Image loaded") : "No image"}
                {s.calibration?.done ? ` · ${s.calibration.pxPerMm.toFixed(1)}px/mm` : ""}
                {s.markups?.length ? ` · ${s.markups.length} marks` : ""}
              </div>
            </div>
            {s.id === activeId && <Tag color={t.ok} style={{ fontSize: 9 }}>Active</Tag>}
            <button
              onClick={e => { e.stopPropagation(); handleDuplicate(s.id); }}
              title="Duplicate session"
              style={{ background: "none", border: "none", cursor: "pointer", color: t.tx2, padding: 2, fontSize: 14 }}
            >⧉</button>
            <button
              onClick={e => { e.stopPropagation(); handleRemove(s.id); }}
              disabled={sessionList.length <= 1}
              title="Remove session"
              style={{ background: "none", border: "none", cursor: sessionList.length <= 1 ? "not-allowed" : "pointer", color: sessionList.length <= 1 ? t.tx3 : t.err, padding: 2, fontSize: 14 }}
            >✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionNameEditor({ name, onRename, t }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  if (editing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => { onRename(val || name); setEditing(false); }}
        onKeyDown={e => { if (e.key === "Enter") { onRename(val || name); setEditing(false); } }}
        style={{
          background: t.surf3, border: `1px solid ${t.acc}`, borderRadius: 4,
          padding: "2px 4px", color: t.tx, fontSize: 13, width: "100%",
          fontFamily: "inherit", boxSizing: "border-box",
        }}
      />
    );
  }
  return (
    <span
      style={{ fontSize: 13, fontWeight: 700, color: t.tx, cursor: "pointer" }}
      onClick={() => { setVal(name); setEditing(true); }}
      title="Click to rename"
    >
      {name}
    </span>
  );
}
