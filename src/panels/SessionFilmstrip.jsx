import { useState } from "react";
import { mkSession } from "../model/session.js";
import { addSession, removeSession } from "../model/project.js";

export default function SessionFilmstrip({ project, t, onUpdateProject }) {
  const sessions = project?.sessions || [];
  const activeId = project?.activeSessionId;
  const [hoveredId, setHoveredId] = useState(null);

  const handleSetActive = (id) => {
    if (id !== activeId) onUpdateProject({ ...project, activeSessionId: id });
  };

  const handleAdd = () => {
    const session = mkSession({ name: `Session ${sessions.length + 1}` });
    onUpdateProject(addSession(project, session));
  };

  const handleRemove = (id) => {
    if (sessions.length <= 1) return;
    if (!window.confirm(`Delete session?`)) return;
    onUpdateProject(removeSession(project, id));
  };

  return (
    <div style={{
      display: "flex", alignItems: "stretch", gap: 0, flexShrink: 0,
      background: t.surf, borderBottom: `1px solid ${t.bdr}`,
      overflow: "hidden", height: 62,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 4, padding: "6px 10px",
        overflowX: "auto", overflowY: "hidden", flex: 1,
        scrollbarWidth: "thin",
      }}>
        {sessions.map((s) => {
          const isActive = s.id === activeId;
          return (
            <div
              key={s.id}
              onClick={() => handleSetActive(s.id)}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 2, flexShrink: 0,
                width: 52, height: 50, borderRadius: 6, cursor: "pointer",
                background: isActive ? t.accMuted : "transparent",
                border: `2px solid ${isActive ? t.acc : "transparent"}`,
                transition: "all 0.15s", position: "relative",
                padding: "2px 0",
              }}
            >
              <div style={{
                width: 40, height: 30, borderRadius: 3, overflow: "hidden",
                background: t.surf3, display: "flex", alignItems: "center",
                justifyContent: "center", flexShrink: 0,
              }}>
                {s.image?.dataUrl ? (
                  <img src={s.image.dataUrl} alt="" draggable={false}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ fontSize: 14, opacity: 0.25, lineHeight: 1 }}>⊞</span>
                )}
              </div>
              <div style={{
                fontSize: 8, color: isActive ? t.acc : t.tx2, textAlign: "center",
                maxWidth: 50, overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap", fontWeight: isActive ? 700 : 400, lineHeight: 1.2,
              }}>
                {s.label || s.name || "Session"}
              </div>
              {hoveredId === s.id && sessions.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(s.id); }}
                  title="Delete session"
                  style={{
                    position: "absolute", top: -3, right: -3,
                    width: 14, height: 14, borderRadius: "50%",
                    border: "none", background: t.err, color: "#fff",
                    fontSize: 8, lineHeight: "14px", textAlign: "center",
                    cursor: "pointer", padding: 0, display: "flex",
                    alignItems: "center", justifyContent: "center",
                  }}
                >✕</button>
              )}
            </div>
          );
        })}
        <button
          onClick={handleAdd}
          title="Add session"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: 6, flexShrink: 0,
            border: `1px dashed ${t.bdr}`, background: "transparent",
            color: t.tx3, cursor: "pointer", fontSize: 16, lineHeight: 1,
            transition: "all 0.15s", marginLeft: 2,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.acc; e.currentTarget.style.color = t.acc; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.bdr; e.currentTarget.style.color = t.tx3; }}
        >+</button>
      </div>
    </div>
  );
}
