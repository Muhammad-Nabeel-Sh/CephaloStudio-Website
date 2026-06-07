import { useState } from "react";
import { mkReproStudy, collectMeasurements } from "../model/reproStudy.js";
import { Btn, Tag } from "../ui.jsx";

export default function ReproStudiesPanel({
  t, project, onUpdateProject,
}) {
  const studies = project?.reproStudies || [];
  const sessions = project?.sessions || [];
  const [selectedId, setSelectedId] = useState(null);
  const selected = studies.find(s => s.id === selectedId);

  const handleCreate = (type) => {
    if (sessions.length < 2) {
      alert("Need at least 2 sessions for a reproducibility study.");
      return;
    }
    const study = mkReproStudy({
      name: `Repro ${studies.length + 1}`,
      type,
      sessionIds: sessions.map(s => s.id),
    });
    onUpdateProject({
      ...project,
      reproStudies: [...studies, study],
    });
    setSelectedId(study.id);
  };

  const handleCollect = (studyId) => {
    const study = studies.find(s => s.id === studyId);
    if (!study) return;
    const stats = collectMeasurements(study, project);
    onUpdateProject({
      ...project,
      reproStudies: studies.map(s =>
        s.id === studyId
          ? { ...s, collectedStats: stats, status: "completed" }
          : s
      ),
    });
  };

  const handleRemove = (studyId) => {
    if (!window.confirm("Remove this study?")) return;
    onUpdateProject({
      ...project,
      reproStudies: studies.filter(s => s.id !== studyId),
    });
    if (selectedId === studyId) setSelectedId(null);
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <Btn t={t} small onClick={() => handleCreate("intra")}>+ Intra-study</Btn>
        <Btn t={t} small onClick={() => handleCreate("inter")}>+ Inter-study</Btn>
      </div>

      {studies.length === 0 && (
        <div style={{ fontSize: 12, color: t.tx3, textAlign: "center", padding: 20 }}>
          No reproducibility studies yet.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {studies.map(s => (
          <div
            key={s.id}
            onClick={() => setSelectedId(s.id)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 8px", borderRadius: 6,
              background: s.id === selectedId ? t.acc + "18" : t.surf2,
              border: s.id === selectedId ? `1px solid ${t.acc}` : `1px solid ${t.bdr}`,
              cursor: "pointer",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.tx }}>
                {s.name}
              </div>
              <div style={{ fontSize: 10, color: t.tx3, marginTop: 2 }}>
                <Tag color={s.type === "intra" ? t.acc : t.warn} style={{ fontSize: 9 }}>
                  {s.type === "intra" ? "Intra-operator" : "Inter-operator"}
                </Tag>
                {" "}{s.status}
                {s.sessionIds?.length ? ` · ${s.sessionIds.length} sessions` : ""}
              </div>
            </div>
            {s.status !== "completed" && (
              <button
                onClick={e => { e.stopPropagation(); handleCollect(s.id); }}
                title="Collect measurements"
                style={{ background: "none", border: "none", cursor: "pointer", color: t.acc, padding: 2, fontSize: 14 }}
              >↻</button>
            )}
            <button
              onClick={e => { e.stopPropagation(); handleRemove(s.id); }}
              title="Remove study"
              style={{ background: "none", border: "none", cursor: "pointer", color: t.err, padding: 2, fontSize: 14 }}
            >✕</button>
          </div>
        ))}
      </div>

      {selected && selected.collectedStats && (
        <div style={{ marginTop: 12, padding: 10, background: t.surf2, borderRadius: 6, fontSize: 11 }}>
          <div style={{ fontWeight: 700, color: t.tx, marginBottom: 6, fontSize: 12 }}>
            Statistics
          </div>
          {selected.type === "intra" && (
            <div style={{ color: t.tx2, lineHeight: 1.6 }}>
              <div>Mean diff: {selected.collectedStats.meanDiff?.toFixed(4) ?? "—"}</div>
              <div>SD diff: {selected.collectedStats.sdDiff?.toFixed(4) ?? "—"}</div>
              <div>Dahlberg: {selected.collectedStats.dahlberg?.toFixed(4) ?? "—"}</div>
              <div>ICC: {selected.collectedStats.icc?.toFixed(4) ?? "—"}</div>
            </div>
          )}
          {selected.type === "inter" && (
            <div style={{ color: t.tx2, lineHeight: 1.6 }}>
              <div>Operators: {selected.sessionIds?.length ?? "—"}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
