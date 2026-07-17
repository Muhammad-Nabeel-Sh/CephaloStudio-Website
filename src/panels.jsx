import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { uid, computeMeasurements, normDeviation, deviationColor, evalFormula, onEnter } from "./utils.js";
import { logWarn } from "./logger.js";
import { LUT_PRESETS, PREDEFINED, PREDEFINED_NORMS } from "./constants.js";
import { SILHOUETTES, getSilhouettesByCategory } from "./silhouettes.js";
import { drawMarkup } from "./markups.jsx";
import { EXAMPLE_LIST, getExampleData } from "./examplesData.js";
import { KatexSpan, LatexFloatingPanel } from "./hooks.jsx";
import { Btn, Tag, Sld, PropRow, Inp, Divider, PanelHeader } from "./ui.jsx";
import PanelGuideModal from "./panels/PanelGuideModal.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// MARKUPS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function MarkupsPanel({ markups, t, theme, selectedId, onSelect, onDelete, onToggleVisible, onToggleLock, onToggleLabel, onReplace, replacingId, calibration, placingMode, placingQueue, placingIdx, onStopPlacing, onPausePlacing, onResumePlacing, onClear, onAddPoint, norms, formatAngle, angleMode, setAngleMode }) {
  const [collapsed, setCollapsed] = useState({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [guideKey, setGuideKey] = useState(null);
  const [sign, unit] = angleMode?.split("-") || ["signed", "deg"];
  const sections = [
    { id: "point", label: "Landmarks", types: ["point"], icon: "◉", color: t.acc },
    { id: "line", label: "Lines & Planes", types: ["line", "parallel", "ruler"], icon: "⟋", color: "#38bdf8" },
    { id: "angle", label: "Angles", types: ["angle3", "angle4"], icon: "∠", color: "#f472b6" },
    { id: "curve", label: "Open Curves", types: ["curve", "bezier", "tangent"], icon: "∿", color: "#fb923c" },
    { id: "polygon", label: "Polygons", types: ["polygon"], icon: "⬡", color: "#4ade80" },
    { id: "ellipse", label: "Ellipses & Circles", types: ["ellipse", "circle", "arc", "concentric"], icon: "◯", color: "#60a5fa" },
    { id: "other", label: "Measurements", types: ["perp","ratio","sum","difference","percentage","projDist"], icon: "⊥", color: "#a78bfa" },
    { id: "annotation", label: "Annotations", types: ["arrow", "text"], icon: "📝", color: "#fbbf24" },
    { id: "silhouette", label: "Silhouettes", types: ["silhouette"], icon: "🧑", color: "#f59e0b" },
  ];
  const toggle = id => setCollapsed(c => ({ ...c, [id]: !c[id] }));

  const handleClear = () => {
    if (markups.length === 0) {
      setShowClearConfirm(false);
      return;
    }
    setShowClearConfirm(true);
  };

  const confirmClear = () => {
    onClear();
    setShowClearConfirm(false);
  };

  return (
    <div>
      {showClearConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: t.surf, border: `1px solid ${t.bdr}`, borderRadius: 12, padding: 24, maxWidth: 320 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.tx, marginBottom: 8 }}>Clear All Markups?</div>
            <div style={{ fontSize: 12, color: t.tx2, marginBottom: 20 }}>This will remove all {markups.length} markups from the workspace. This action cannot be undone.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn t={t} small onClick={() => setShowClearConfirm(false)}>Cancel</Btn>
              <Btn t={t} small danger onClick={confirmClear}>Clear All</Btn>
            </div>
          </div>
        </div>
      )}
      <div style={{ padding: "8px 10px", display: "flex", gap: 4, borderBottom: `1px solid ${t.bdr}`, flexShrink: 0, flexWrap: "nowrap", overflowX: "auto" }}>
        <Btn t={t} small onClick={onAddPoint} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>+ Point</Btn>
        {!placingMode && placingQueue.length === 0 && <Btn t={t} small onClick={onResumePlacing} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>▶ Start</Btn>}
        {!placingMode && placingQueue.length > 0 && <Btn t={t} small onClick={onResumePlacing} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>▶ Resume</Btn>}
        {placingMode && <Btn t={t} small onClick={onPausePlacing} style={{ whiteSpace: "nowrap", flexShrink: 0, background: t.warn + "22", color: t.warn, border: `1px solid ${t.warn}` }}>⏸</Btn>}
        {(placingMode || placingQueue.length > 0) && <Btn t={t} small danger onClick={onStopPlacing} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>⏹ End</Btn>}
        <Btn t={t} small danger onClick={handleClear} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>Clear</Btn>
        <button onClick={() => setGuideKey("markups")}
          style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0, marginLeft: "auto", flexShrink: 0 }} title="Guide">?</button>
      </div>
      <div style={{ padding: "8px 10px", display: "flex", gap: 4, borderBottom: `1px solid ${t.bdr}`, flexShrink: 0, flexWrap: "nowrap", overflowX: "auto", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: t.tx2, flexShrink: 0 }}>∠</span>
        <button onClick={() => setAngleMode(`${sign}-${unit === "deg" ? "rad" : "deg"}`)} style={{ padding: "2px 6px", fontSize: 10, border: `1px solid ${t.bdr}`, borderRadius: 4, background: unit === "deg" ? t.acc : "transparent", color: unit === "deg" ? (theme === "light" ? "#fff" : t.bg) : t.tx, cursor: "pointer", fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>{unit === "deg" ? "°" : "rad"}</button>
        <select value={sign} onChange={e => setAngleMode(`${e.target.value}-${unit}`)} style={{ background: t.surf2, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "2px 4px", color: t.tx, fontSize: 10, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
          <option value="signed">signed</option>
          <option value="abs">abs</option>
          <option value="simple">simple</option>
          <option value="reflex">reflex</option>
        </select>
      </div>
      {sections.map(sec => {
        const items = markups.filter(m => sec.types.includes(m.type));
        if (items.length === 0) return null;
        const isCollapsed = collapsed[sec.id];
        return (
          <div key={sec.id}>
            <div role="button" tabIndex={0} onClick={() => toggle(sec.id)} onKeyDown={onEnter(() => toggle(sec.id))} style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", background: t.surf2, borderBottom: `1px solid ${t.bdr}`, borderTop: `1px solid ${t.bdr}`, userSelect: "none" }}>
              <span style={{ color: sec.color, fontSize: 12 }}>{sec.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.tx, flex: 1, textTransform: "uppercase", letterSpacing: 0.5 }}>{sec.label}</span>
              <span style={{ fontSize: 10, color: t.tx3, fontFamily: "'DM Mono',monospace" }}>{items.length}</span>
              <span style={{ color: t.tx3, fontSize: 10, transition: "transform 0.15s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▾</span>
            </div>
            {!isCollapsed && items.map(m => {
              const meas = computeMeasurements(m, calibration);
              const filteredMeas = Object.entries(meas).filter(([k]) => !k.startsWith("_") && (m.type === "point" || (k !== "x" && k !== "y"))); const u = meas._unit === "mm" ? "mm" : "px"; const ms = filteredMeas.map(([k, v]) => k === "angle" ? formatAngle(v) : v.toFixed(1) + (k === "area" ? ` ${u}²` : ` ${u}`)).join("  ");
              const isHidden = m.visible === false, isPlacing = placingMode && placingQueue[placingIdx] === m.id, isLocked = m.locked;
              const unplaced = m.type === "point" && !m.placed;
              const relNorms = (norms || []).filter(n => n.markupLabel === m.label);
              return (
                <div key={m.id} style={{ borderBottom: `1px solid ${t.bdr + "66"}`, background: isPlacing ? t.acc + "11" : selectedId === m.id ? t.accMuted : "transparent" }}>
                  <div style={{ padding: "5px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => onToggleVisible(m.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }} title={isHidden ? "Show" : "Hide"}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: isHidden ? "transparent" : m.color || m.strokeColor || t.acc, border: `2px solid ${m.color || m.strokeColor || t.acc}`, opacity: isHidden ? 0.35 : 1, transition: "all 0.15s" }} />
                    </button>
                    <button onClick={() => onToggleLock(m.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }} title={isLocked ? "Unlock" : "Lock"}>
                      <span style={{ fontSize: 11, color: isLocked ? t.warn : t.tx3 }}>{isLocked ? "🔒" : "🔓"}</span>
                    </button>
                    <button onClick={() => onToggleLabel(m.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }} title={m.noLabel ? "Show label" : "Hide label"}>
                      <span style={{ fontSize: 12, color: m.noLabel ? t.tx3 : t.acc }}>{m.noLabel ? "Aa" : "Aa"}</span>
                    </button>
                    {m.type !== "text" && <button onClick={() => onReplace && onReplace(m.type, m.id)} style={{ background: replacingId === m.id ? t.accMuted : "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }} title="Replace mode">
                      <span style={{ fontSize: 16, color: replacingId === m.id ? t.acc : t.tx2 }}>⚙</span>
                    </button>}
                    <div role="button" tabIndex={0} onClick={() => onSelect(m.id === selectedId ? null : m.id)} onKeyDown={onEnter(() => onSelect(m.id === selectedId ? null : m.id))} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: isHidden ? t.tx3 : t.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {isPlacing && <span style={{ color: t.warn, marginRight: 4 }}>📍</span>}
                        {unplaced && !isPlacing && <span style={{ color: t.tx3, marginRight: 4 }}>○</span>}
                        {m.label || m.type}
                        {m.type === "curve" && m.curveStyle === "bspline" && <span style={{ fontSize: 9, color: t.tx3, marginLeft: 4 }}>[spline]</span>}
                        {m.type === "polygon" && m.curveStyle === "bspline" && <span style={{ fontSize: 9, color: t.tx3, marginLeft: 4 }}>[spline]</span>}
                        {m.type === "text" && m.text && <span style={{ fontSize: 9, color: t.tx3, marginLeft: 4 }}>"{m.text.slice(0, 15)}{m.text.length > 15 ? "…" : ""}"</span>}
                        {m.type === "arrow" && <span style={{ fontSize: 9, color: t.tx3, marginLeft: 4 }}>→</span>}
                        {isLocked && <span style={{ fontSize: 9, color: t.warn, marginLeft: 4 }}>[locked]</span>}
                      </div>
                      {ms && !isHidden && <div style={{ fontSize: 12, color: t.acc, fontFamily: "'DM Mono',monospace" }}>{ms}</div>}
                      {relNorms.length > 0 && !isHidden && ms && <NormBadges norms={relNorms} meas={meas} calibration={calibration} t={t} />}
                    </div>
                    <button onClick={() => onDelete(m.id)} title="Delete markup" style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 14, flexShrink: 0 }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {markups.length === 0 && <div style={{ padding: 24, textAlign: "center", color: t.tx3, fontSize: 12 }}>No markups yet.<br />Select a tool and click on the image.</div>}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}

function NormBadges({ norms, meas, t, calibration }) {
  const calDone = calibration?.done === true;
  const calTypes = ["length","distance","area","perimeter","radius","circumference","majorAxis","minorAxis","arcLength","projectedDistance"];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 2 }}>
      {norms.map(n => {
        const val = meas[n.measureType];
        if (val === undefined) return null;
        if (!calDone && calTypes.includes(n.measureType)) return null;
        const dev = normDeviation(val, n);
        const col = deviationColor(dev.sdUnits, t);
        return (<span key={n.id} style={{ background: col + "22", color: col, border: `1px solid ${col}44`, borderRadius: 3, padding: "0px 4px", fontSize: 9, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
          {dev.sdUnits > 0 ? "+" : ""}{dev.sdUnits.toFixed(1)}SD
        </span>);
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEASUREMENTS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function MeasurementsPanel({ allMeas, formulaMeas, t, calibration, norms, onUpdateNorms, onExportCSV, onOpenCalib, formatAngle }) {
  const [editingNorm, setEditingNorm] = useState(null);
  const [showGallery, setShowGallery] = useState(false);
  const [guideKey, setGuideKey] = useState(null);
  const hasMeas = allMeas.length > 0 || (formulaMeas && formulaMeas.length > 0);
  return (
    <div style={{ padding: 12 }}>
      {!calibration.done && <div style={{ background: t.warn + "22", border: `1px solid ${t.warn}44`, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12, color: t.warn }}>⚠ Calibrate for mm values.<button onClick={onOpenCalib} style={{ display: "block", marginTop: 6, background: t.warn, color: "#000", border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Open Calibration</button></div>}
      {calibration.done && <div style={{ background: t.ok + "11", border: `1px solid ${t.ok}33`, borderRadius: 6, padding: 8, marginBottom: 10, fontSize: 11, color: t.ok, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>⟺ {calibration.pxPerMm.toFixed(3)} px/mm</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button onClick={() => setGuideKey("measurements")}
            style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0, flexShrink: 0 }} title="Guide">?</button>
          <button onClick={onOpenCalib} style={{ background: "none", border: `1px solid ${t.ok}55`, color: t.ok, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 10 }}>Edit</button>
        </div>
      </div>}

      <div style={{ marginBottom: 12, display: "flex", gap: 6 }}>
        <Btn t={t} small onClick={() => setShowGallery(true)} style={{ flex: 1 }}>Norms Reference</Btn>
        <Btn t={t} small onClick={() => {
          const existing = norms ? [...norms] : [];
          Object.values(PREDEFINED_NORMS).forEach(preset => {
            preset.norms.forEach(n => {
              if (!existing.some(e => e.markupLabel === n.label && e.measureType === n.type))
                existing.push({ id: uid(), markupLabel: n.label, measureType: n.type, mean: n.mean, sd: n.sd, source: preset.source });
            });
          });
          onUpdateNorms(existing);
        }} style={{ flexShrink: 0 }}>+ All Presets</Btn>
      </div>
      {showGallery && <NormsReferenceModal t={t} onAdd={(label, mean, sd, type, source) => {
        const existing = norms ? [...norms] : [];
        if (existing.some(e => e.markupLabel === label && e.measureType === type)) return;
        onUpdateNorms([...existing, { id: uid(), markupLabel: label, measureType: type, mean, sd, source }]);
      }} onClose={() => setShowGallery(false)} />}

      {!hasMeas ? <div style={{ color: t.tx3, fontSize: 12, textAlign: "center", paddingTop: 20 }}>Place lines, angles, or polygons.</div>
        : <>
          {[...allMeas].sort((a, b) => (a.m.type === "point" ? 1 : 0) - (b.m.type === "point" ? 1 : 0)).map(({ m, meas }) => {
            const relNorms = (norms || []).filter(n => n.markupLabel === m.label);
            return (
              <div key={m.id} style={{ marginBottom: 10, padding: 10, background: t.surf2, borderRadius: 8, border: `1px solid ${t.bdr}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: m.color || t.acc, marginBottom: 6, display: "flex", justifyContent: "space-between" }}><span>{m.label || m.type}</span><Tag color={m.color || t.acc}>{m.type}</Tag></div>
                  {Object.entries(meas).filter(([k]) => !k.startsWith("_") && (m.type === "point" || (k !== "x" && k !== "y"))).map(([k, v]) => {
                  const calTypes = ["length","distance","area","perimeter","radius","circumference","majorAxis","minorAxis","arcLength","projectedDistance"];
                  const norm = !calibration.done && calTypes.includes(k) ? null : relNorms.find(n => n.measureType === k);
                  const dev = norm ? normDeviation(v, norm) : null;
                  return (
                    <div key={k} style={{ marginBottom: dev ? 10 : 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: t.tx2, alignItems: "center" }}>
                        <span>{k}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "'DM Mono',monospace", color: t.tx, fontWeight: 600 }}>{k === "angle" ? formatAngle(v) : v.toFixed(2) + (k === "area" ? (calibration.done ? " mm²" : " px²") : (calibration.done ? " mm" : " px"))}</span>
                          <button onClick={() => setEditingNorm({ markupLabel: m.label, measureType: k, existing: norm })}
                            style={{ background: "none", border: `1px solid ${norm ? t.ok + "55" : t.bdr}`, color: norm ? t.ok : t.tx3, borderRadius: 3, padding: "0 4px", cursor: "pointer", fontSize: 9, fontWeight: 700, lineHeight: "16px" }}>
                            {norm ? "N" : "±N"}
                          </button>
                        </div>
                      </div>
                      {dev && <div style={{ marginTop: 4, padding: "5px 8px", borderRadius: 5, background: deviationColor(dev.sdUnits, t) + "18", border: `1px solid ${deviationColor(dev.sdUnits, t)}44` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                          <span style={{ color: t.tx2 }}>Norm: {norm.mean} ± {norm.sd}</span>
                          <span style={{ fontWeight: 700, color: deviationColor(dev.sdUnits, t) }}>{dev.delta > 0 ? "+" : ""}{dev.delta.toFixed(2)} ({dev.sdUnits > 0 ? "+" : ""}{dev.sdUnits.toFixed(1)} SD)</span>
                        </div>
                        {norm.source && <div style={{ fontSize: 9, color: t.tx3, marginTop: 2 }}>{norm.source}</div>}
                      </div>}
                    </div>
                  );
                })}
              {editingNorm?.markupLabel === m.label && <InlineNormEditor t={t} {...editingNorm} onSave={(n) => { const filtered = (norms || []).filter(x => !(x.markupLabel === editingNorm.markupLabel && x.measureType === editingNorm.measureType)); onUpdateNorms([...filtered, { id: editingNorm.existing?.id || uid(), ...n }]); setEditingNorm(null); }} onDelete={() => { onUpdateNorms((norms || []).filter(x => !(x.markupLabel === editingNorm.markupLabel && x.measureType === editingNorm.measureType))); setEditingNorm(null); }} onClose={() => setEditingNorm(null)} />}
            </div>
          );
        })}
          {formulaMeas && formulaMeas.map(({ m, meas }) => {
            const relNorms = (norms || []).filter(n => n.markupLabel === m.label);
            return (
              <div key={m.id} style={{ marginBottom: 10, padding: 10, background: t.surf2, borderRadius: 8, border: `1px solid ${t.bdr}`, borderLeft: `3px solid ${t.acc2}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: m.color || t.acc, marginBottom: 6, display: "flex", justifyContent: "space-between" }}><span>{m.label || m.type}</span><Tag color={m.color || t.acc}>{m.type}</Tag></div>
                {Object.entries(meas).filter(([k]) => !k.startsWith("_")).map(([k, v]) => {
                  const norm = relNorms.find(n => n.measureType === k);
                  const dev = norm ? normDeviation(v, norm) : null;
                  const unitLabel = k === "value" ? (m.unit || "") : "";
                  return (
                    <div key={k} style={{ marginBottom: dev ? 10 : 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: t.tx2, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: t.tx3 }}>{k}{unitLabel ? " (" + unitLabel + ")" : ""}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "'DM Mono',monospace", color: t.tx, fontWeight: 600 }}>{v.toFixed(2)}</span>
                          <button onClick={() => setEditingNorm({ markupLabel: m.label, measureType: k, existing: norm })}
                            style={{ background: "none", border: `1px solid ${norm ? t.ok + "55" : t.bdr}`, color: norm ? t.ok : t.tx3, borderRadius: 3, padding: "0 4px", cursor: "pointer", fontSize: 9, fontWeight: 700, lineHeight: "16px" }}>
                            {norm ? "N" : "±N"}
                          </button>
                        </div>
                      </div>
                      {dev && <div style={{ marginTop: 4, padding: "5px 8px", borderRadius: 5, background: deviationColor(dev.sdUnits, t) + "18", border: `1px solid ${deviationColor(dev.sdUnits, t)}44` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                          <span style={{ color: t.tx2 }}>Norm: {norm.mean} ± {norm.sd}</span>
                          <span style={{ fontWeight: 700, color: deviationColor(dev.sdUnits, t) }}>{dev.delta > 0 ? "+" : ""}{dev.delta.toFixed(2)} ({dev.sdUnits > 0 ? "+" : ""}{dev.sdUnits.toFixed(1)} SD)</span>
                        </div>
                        {norm.source && <div style={{ fontSize: 9, color: t.tx3, marginTop: 2 }}>{norm.source}</div>}
                      </div>}
                    </div>
                  );
                })}
              {editingNorm?.markupLabel === m.label && <InlineNormEditor t={t} {...editingNorm} onSave={(n) => { const filtered = (norms || []).filter(x => !(x.markupLabel === editingNorm.markupLabel && x.measureType === editingNorm.measureType)); onUpdateNorms([...filtered, { id: editingNorm.existing?.id || uid(), ...n }]); setEditingNorm(null); }} onDelete={() => { onUpdateNorms((norms || []).filter(x => !(x.markupLabel === editingNorm.markupLabel && x.measureType === editingNorm.measureType))); setEditingNorm(null); }} onClose={() => setEditingNorm(null)} />}
            </div>
          );
        })}
        </>}

      {hasMeas && <Btn t={t} small onClick={onExportCSV} style={{ width: "100%", marginTop: 8 }}>⬇ Export CSV</Btn>}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}

function InlineNormEditor({ t, markupLabel, measureType, existing, onSave, onDelete, onClose }) {
  const [mean, setMean] = useState(String(existing?.mean || ""));
  const [sd, setSd] = useState(String(existing?.sd || ""));
  const [source, setSource] = useState(existing?.source || "");
  return (
    <div style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 8, padding: 12, marginBottom: 12, overflow: "hidden" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: t.acc, marginBottom: 8 }}>Norm for {markupLabel} · {measureType}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
        <div><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>Mean</div><Inp value={mean} onChange={setMean} t={t} type="number" placeholder="e.g. 82" style={{ width: "100%" }} /></div>
        <div><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>SD</div><Inp value={sd} onChange={setSd} t={t} type="number" placeholder="e.g. 3" style={{ width: "100%" }} /></div>
      </div>
      <div style={{ marginBottom: 8 }}><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>Source</div><Inp value={source} onChange={setSource} t={t} placeholder="e.g. Steiner 1953, Caucasian adults" style={{ width: "100%" }} /></div>
      <div style={{ display: "flex", gap: 6 }}>
        <Btn t={t} small onClick={() => onSave({ markupLabel, measureType, mean: parseFloat(mean), sd: parseFloat(sd), source })} disabled={!mean || !sd} style={{ flex: 1 }}>Save</Btn>
        {existing && <Btn t={t} small danger onClick={onDelete}>Del</Btn>}
        <Btn t={t} small onClick={onClose}>✕</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMULAS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function FormulasPanel({ formulas, t, scope, onAdd, onEdit, onDelete, pinnedFormulas, onPinFormula }) {
  const [bigLatex, setBigLatex] = useState(null);
  const [guideKey, setGuideKey] = useState(null);
  return (
    <div style={{ padding: 12 }}>
      <PanelHeader t={t}>
        Custom Formulas
        <button onClick={() => setGuideKey("formulas")}
          style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0, marginLeft: 6, verticalAlign: "middle" }} title="Guide">?</button>
      </PanelHeader>
      <div style={{ fontSize: 11, color: t.tx2, marginBottom: 12, lineHeight: 1.5 }}>Define derived measurements. Variables use landmark label names.</div>
      {formulas.map(f => {
        const val = evalFormula(f.expression, scope);
        const pinned = pinnedFormulas?.has(f.id);
        const isValid = val !== null && isFinite(val);
        return (
          <div key={f.id} style={{ marginBottom: 10, padding: 10, background: t.surf2, borderRadius: 8, border: `1px solid ${t.bdr}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div><div style={{ fontSize: 12, fontWeight: 700, color: t.acc }}>{f.name}</div>{f.unit && <div style={{ fontSize: 10, color: t.tx3 }}>{f.unit}</div>}</div>
              <div style={{ display: "flex", gap: 4 }}><button onClick={() => onEdit(f.id)} style={{ background: "none", border: `1px solid ${t.bdr}`, color: t.tx2, borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontSize: 10 }}>Edit</button><button onClick={() => onDelete(f.id)} title="Delete formula" style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 14 }}>×</button></div>
            </div>
            {f.latex && <div role="button" tabIndex={0} onClick={() => setBigLatex(f.latex)} onKeyDown={onEnter(() => setBigLatex(f.latex))} style={{ background: t.surf3, borderRadius: 4, padding: "6px 10px", marginBottom: 8, cursor: "pointer", border: `1px solid ${t.bdr}`, minHeight: 28, display: "flex", alignItems: "center" }}>
              <KatexSpan latex={f.latex} block={false} fontSize={10} />
              <span style={{ fontSize: 9, color: t.tx3, marginLeft: "auto", paddingLeft: 8 }}>click to enlarge</span>
            </div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: t.tx2 }}>Result</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: isValid ? t.acc : t.err }}>{isValid ? `${val.toFixed(2)} ${f.unit || ""}` : "N/A"}</span>
            </div>
            {isValid && <div style={{ marginTop: 6 }}>
              <button onClick={() => onPinFormula(f.id)}
                style={{ width: "100%", padding: "4px 0", fontSize: 10, fontWeight: 700, borderRadius: 4, border: `1px solid ${pinned ? t.ok : t.bdr}`, background: pinned ? t.ok + "18" : "transparent", color: pinned ? t.ok : t.tx2, cursor: "pointer", transition: "all 0.15s" }}>
                {pinned ? "✓ In Measurements" : "+ Add to Measurements"}
              </button>
            </div>}
          </div>
        );
      })}
      <Btn t={t} small onClick={onAdd} style={{ width: "100%", padding: "14px 8px", borderRadius: 10, border: `1.5px solid ${t.acc}`, background: t.acc + "15", cursor: "pointer", outline: "none", transition: "all 0.15s", fontSize: 12, fontWeight: 600, color: t.tx, textAlign: "center", lineHeight: 1.3 }}>New Formula</Btn>
      {bigLatex && <LatexFloatingPanel latex={bigLatex} onClose={() => setBigLatex(null)} />}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGE PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function ImagePanel({ t, processing, setProcessing, lutMode, setLutMode, lutInvert, setLutInvert, showLUT, setShowLUT, showScaleBar, setShowScaleBar, calibration, onOpenCalib, onReset, onShowHist, showHistogram }) {
  const [guideKey, setGuideKey] = useState(null);
  return (
    <div style={{ padding: 12 }}>
      <PanelHeader t={t}>
        Window & Level
        <button onClick={() => setGuideKey("image")}
          style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0, marginLeft: 6, verticalAlign: "middle" }} title="Guide">?</button>
      </PanelHeader>
      <Sld label="W Center" value={processing.windowCenter} min={0} max={255} onChange={v => { const p = { ...processing, windowCenter: v }; setProcessing(p); }} t={t} />
      <Sld label="W Width" value={processing.windowWidth} min={0} max={255} onChange={v => { const p = { ...processing, windowWidth: v }; setProcessing(p); }} t={t} />
      <Divider t={t} />
      <PanelHeader t={t}>Brightness & Contrast</PanelHeader>
      <Sld label="Brightness" value={processing.brightness} min={-128} max={128} onChange={v => { const p = { ...processing, brightness: v }; setProcessing(p); }} t={t} />
      <Sld label="Contrast" value={processing.contrast} min={-100} max={200} onChange={v => { const p = { ...processing, contrast: v }; setProcessing(p); }} t={t} unit="%" />
      <Sld label="Edge Enhance" value={processing.edgeEnhance} min={0} max={100} onChange={v => { const p = { ...processing, edgeEnhance: v }; setProcessing(p); }} t={t} unit="%" />
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}><Btn t={t} small onClick={onReset} style={{ flex: 1 }}>↺ Reset</Btn><Btn t={t} small active={showHistogram} onClick={onShowHist} style={{ flex: 1 }}>▦ Histogram</Btn></div>
      <Divider t={t} />
      <PanelHeader t={t}>
        LUT Colorization
        <button onClick={() => setGuideKey("lut")}
          style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0, marginLeft: 6, verticalAlign: "middle" }} title="LUT Guide">?</button>
      </PanelHeader>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <Btn t={t} small active={showLUT} onClick={() => setShowLUT(v => !v)}>Legend</Btn>
        <Btn t={t} small active={lutInvert} onClick={() => setLutInvert(!lutInvert)}>⇅ Invert</Btn>
        <Btn t={t} small onClick={() => { setLutMode("gray"); setLutInvert(false); }}>Revert</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 4 }}>
        {LUT_PRESETS.map(lut => (
          <button key={lut.id} onClick={() => setLutMode(lut.id)}
            style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${lutMode === lut.id ? t.acc : t.bdr}`, background: lutMode === lut.id ? t.accMuted : t.surf2, cursor: "pointer", fontSize: 11, color: lutMode === lut.id ? t.acc : t.tx, fontWeight: lutMode === lut.id ? 700 : 400 }}>
            <div style={{ height: 8, borderRadius: 2, marginBottom: 4, background: `linear-gradient(90deg,${(lutInvert ? [...lut.stops].reverse() : lut.stops).join(",")})` }} />
            {lut.name}
          </button>
        ))}
      </div>
      <Divider t={t} />
      <PanelHeader t={t}>Scale & Calibration</PanelHeader>
      {calibration.done ? <div style={{ fontSize: 12, color: t.ok, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>⟺ {calibration.pxPerMm.toFixed(3)} px/mm</span><button onClick={onOpenCalib} style={{ background: "none", border: `1px solid ${t.ok}55`, color: t.ok, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 10 }}>Edit</button></div> : <div style={{ fontSize: 12, color: t.tx2, marginBottom: 8 }}>Not calibrated. Use ruler tool (R).</div>}
      <Btn t={t} small active={showScaleBar} onClick={() => setShowScaleBar(v => !v)}>On-Screen Scale Bar</Btn>
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// LAYERS PANEL
// ═══════════════════════════════════════════════════════════════════════════════════════
export function LayersPanel({ t, images, onUpdateImages, onAddImage, onShowAlign, onShowTransform }) {
  const [guideKey, setGuideKey] = useState(null);
  const updImg = (id, patch) => onUpdateImages(images.map(i => i.id === id ? { ...i, ...patch } : i));
  const move = (idx, dir) => { const imgs = [...images]; [imgs[idx], imgs[idx + dir]] = [imgs[idx + dir], imgs[idx]]; onUpdateImages(imgs); };
  const SCOLS = ["none", "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7"];
  return (
    <div style={{ padding: 12 }}>
      <PanelHeader t={t}>
        Image Stack ({images.length})
        <button onClick={() => setGuideKey("layers")}
          style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0, marginLeft: 6, verticalAlign: "middle" }} title="Guide">?</button>
      </PanelHeader>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <Btn t={t} small onClick={onShowAlign}>⊕ Align</Btn>
        <Btn t={t} small onClick={onShowTransform}>⟲ Transform</Btn>
      </div>
      {images.length === 0 && <div style={{ color: t.tx3, fontSize: 12 }}>No images loaded.</div>}
      {images.map((img, idx) => (
        <div key={img.id} style={{ marginBottom: 10, border: `1px solid ${t.bdr}`, borderRadius: 8, padding: 10, background: t.surf2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <button onClick={() => updImg(img.id, { visible: !img.visible })} title="Toggle visibility" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: img.visible ? t.acc : t.tx3 }}>{img.visible ? "◎" : "○"}</button>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: t.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.name || `Img ${idx + 1}`}</span>
            <div style={{ display: "flex", gap: 2 }}>
              {idx > 0 && <button onClick={() => move(idx, -1)} title="Move up" style={{ background: "none", border: `1px solid ${t.bdr}`, color: t.tx2, borderRadius: 3, padding: "1px 4px", cursor: "pointer", fontSize: 10 }}>↑</button>}
              {idx < images.length - 1 && <button onClick={() => move(idx, 1)} title="Move down" style={{ background: "none", border: `1px solid ${t.bdr}`, color: t.tx2, borderRadius: 3, padding: "1px 4px", cursor: "pointer", fontSize: 10 }}>↓</button>}
            </div>
            <button onClick={() => onUpdateImages(images.filter(i => i.id !== img.id))} title="Remove image" style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 14 }}>×</button>
          </div>
          <Sld label="Opacity" value={Math.round((img.opacity || 1) * 100)} min={0} max={100} onChange={v => updImg(img.id, { opacity: v / 100 })} t={t} unit="%" />
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 10, color: t.tx2, marginBottom: 3 }}>Blend mode</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>{["normal", "multiply", "screen", "overlay", "difference", "luminosity"].map(bm => (<button key={bm} onClick={() => updImg(img.id, { blendMode: bm })} style={{ padding: "2px 4px", fontSize: 9, border: `1px solid ${t.bdr}`, borderRadius: 4, background: img.blendMode === bm ? t.acc : t.surf3, color: img.blendMode === bm ? (t.id === "light" ? "#fff" : t.bg) : t.tx2, cursor: "pointer", fontWeight: 600 }}>{bm}</button>))}</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 10, color: t.tx2, marginBottom: 3 }}>Serial color</div>
            <div style={{ display: "flex", gap: 4 }}>{SCOLS.map(c => (<button key={c} onClick={() => updImg(img.id, { color: c })} style={{ width: 20, height: 20, borderRadius: 4, background: c === "none" ? "transparent" : c, border: `2px solid ${img.color === c ? t.acc : t.bdr}`, cursor: "pointer", fontSize: 8, color: t.tx3, display: "flex", alignItems: "center", justifyContent: "center" }}>{c === "none" ? "✕" : ""}</button>))}</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["X", "Y"].map((ax, ai) => (<div key={ax} style={{ flex: 1 }}><div style={{ fontSize: 9, color: t.tx3, marginBottom: 2 }}>{ax} offset</div><input type="number" value={ai === 0 ? img.dx || 0 : img.dy || 0} onChange={e => updImg(img.id, { [ai === 0 ? "dx" : "dy"]: +e.target.value })} style={{ width: "100%", background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "3px 5px", color: t.tx, fontSize: 11, fontFamily: "'DM Mono',monospace", boxSizing: "border-box" }} /></div>))}
            <button onClick={() => updImg(img.id, { dx: 0, dy: 0 })} title="Reset offset" style={{ alignSelf: "flex-end", background: "none", border: `1px solid ${t.bdr}`, color: t.tx2, borderRadius: 4, padding: "3px 5px", cursor: "pointer", fontSize: 10, height: 24 }}>⊙</button>
          </div>
        </div>
      ))}
      <label style={{ cursor: "pointer", display: "block" }} onChange={onAddImage}><input type="file" accept="image/*" style={{ display: "none" }} /><div style={{ border: `2px dashed ${t.bdr}`, borderRadius: 8, padding: 12, textAlign: "center", color: t.tx2, fontSize: 12, cursor: "pointer" }}>+ Add to stack</div></label>
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKUP PROPERTIES
// ═══════════════════════════════════════════════════════════════════════════════
export function MarkupProps({ m, t, theme, onUpdate, onDelete, calibration, onParallel, formatAngle, norms, onUpdateNorms }) {
  const meas = computeMeasurements(m, calibration);
  const relNorms = (norms || []).filter(n => n.markupLabel === m.label);
  const [editingNorm, setEditingNorm] = useState(null);
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 12, color: t.tx, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>Properties</span><Btn t={t} small danger onClick={onDelete}>Delete</Btn></div>
      <PropRow label="Label" t={t}><Inp value={m.label || ""} onChange={v => onUpdate({ label: v })} t={t} /></PropRow>
      {m.type === "point" && <><PropRow label="Definition" t={t}><Inp value={m.definition || ""} onChange={v => onUpdate({ definition: v })} t={t} /></PropRow><PropRow label="Size" t={t}><input type="range" min="3" max="14" value={m.size || 6} onChange={e => onUpdate({ size: +e.target.value })} style={{ width: "100%", accentColor: t.acc }} /></PropRow></>}
      {m.type === "text" && <><PropRow label="Text" t={t}><Inp value={m.text || ""} onChange={v => onUpdate({ text: v })} t={t} /></PropRow><PropRow label="Size" t={t}><input type="range" min="8" max="48" value={m.fontSize || 14} onChange={e => onUpdate({ fontSize: +e.target.value })} style={{ width: "100%", accentColor: t.acc }} /></PropRow><PropRow label="Bold" t={t}><input type="checkbox" checked={!!m.bold} onChange={e => onUpdate({ bold: e.target.checked })} style={{ accentColor: t.acc }} /></PropRow></>}
      {(m.type === "curve" || m.type === "polygon") && <PropRow label="Dash" t={t}><select value={m.style || "solid"} onChange={e => onUpdate({ style: e.target.value })} style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "3px 6px", color: t.tx, fontSize: 12, width: "100%", fontFamily: "inherit" }}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></PropRow>}
      {(m.type === "curve" || m.type === "polygon") && <PropRow label="Style" t={t}><div style={{ display: "flex", gap: 4 }}>{["linear", "bspline"].map(s => <button key={s} onClick={() => onUpdate({ curveStyle: s })} style={{ padding: "2px 8px", fontSize: 10, border: `1px solid ${t.bdr}`, borderRadius: 4, background: m.curveStyle === s ? t.acc : "transparent", color: m.curveStyle === s ? (theme === "light" ? "#fff" : t.bg) : t.tx, cursor: "pointer", fontWeight: 600 }}>{s === "linear" ? "Linear" : "B-Spline"}</button>)}</div></PropRow>}
      {(m.type === "curve" || m.type === "polygon") && <PropRow label="Points" t={t}><div style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ fontSize: 11, color: t.tx2 }}>{m.points?.length || 0} pts</span><span style={{ fontSize: 9, color: t.tx3 }}>Ctrl+click add • Shift+click remove</span></div></PropRow>}
      <PropRow label="Color" t={t}><input type="color" value={m.color || m.strokeColor || "#38bdf8"} onChange={e => onUpdate(m.type === "polygon" ? { strokeColor: e.target.value } : { color: e.target.value })} style={{ width: 40, height: 24, padding: 0, border: "none", cursor: "pointer", borderRadius: 4 }} /></PropRow>
      {m.type === "polygon" && <PropRow label="Fill" t={t}><input type="color" value={(m.fillColor || "#38bdf8aa").slice(0, 7)} onChange={e => onUpdate({ fillColor: e.target.value + "33" })} style={{ width: 40, height: 24, padding: 0, border: "none", cursor: "pointer", borderRadius: 4 }} /></PropRow>}
      {["line", "angle3", "angle4", "curve", "perp", "parallel", "projDist", "ratio", "sum", "difference", "percentage", "ellipse", "arc", "circle", "bezier", "tangent", "concentric"].includes(m.type) && <PropRow label="Width" t={t}><input type="range" min="0.5" max="6" step="0.5" value={m.width || 1.5} onChange={e => onUpdate({ width: +e.target.value })} style={{ width: "100%", accentColor: t.acc }} /></PropRow>}
      {m.type === "silhouette" && <><PropRow label="Width" t={t}><input type="range" min="0.5" max="6" step="0.5" value={m.width || 1.5} onChange={e => onUpdate({ width: +e.target.value })} style={{ width: "100%", accentColor: t.acc }} /></PropRow><PropRow label="Dash" t={t}><select value={m.style || "solid"} onChange={e => onUpdate({ style: e.target.value })} style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "3px 6px", color: t.tx, fontSize: 12, width: "100%", fontFamily: "inherit" }}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></PropRow><PropRow label="Scale" t={t}><input type="range" min="0.1" max="5" step="0.05" value={m.scale || 1} onChange={e => onUpdate({ scale: +e.target.value })} style={{ width: "100%", accentColor: t.acc }} /></PropRow><PropRow label="Rotation" t={t}><input type="range" min="0" max="360" step="1" value={(m.rotation || 0) * (180 / Math.PI)} onChange={e => onUpdate({ rotation: +e.target.value * (Math.PI / 180) })} style={{ width: "100%", accentColor: t.acc }} /></PropRow><PropRow label="Show Frame" t={t}><input type="checkbox" checked={m.showFrame !== false} onChange={e => onUpdate({ showFrame: e.target.checked })} style={{ accentColor: t.acc }} /></PropRow><PropRow label="Points" t={t}><div style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ fontSize: 11, color: t.tx2 }}>{(m.paths || []).reduce((s, p) => s + p.points.length, 0)} pts</span><span style={{ fontSize: 9, color: t.tx3 }}>Ctrl+click add • Shift+click remove</span></div></PropRow>{(m.paths?.length || 0) > 1 && (() => { const g = {}; m.paths.forEach((p, i) => { const k = p.name || `Path ${i + 1}`; if (!g[k]) g[k] = { name: k, indices: [] }; g[k].indices.push(i); }); return <><Divider t={t} /><div style={{ fontSize: 11, fontWeight: 700, color: t.tx2, marginBottom: 6 }}>Path Colors</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>{Object.values(g).map(gr => { const has = gr.indices.some(i => m.pathColors?.[i]); const cur = gr.indices.reduce((a, i) => a || m.pathColors?.[i], undefined) || m.paths[gr.indices[0]].color || m.color || "#60a5fa"; return (<div key={gr.name} style={{ display: "flex", gap: 4, padding: "2px 0", fontSize: 10, alignItems: "center" }}><input type="color" value={cur} onChange={e => { const c = { ...(m.pathColors || {}) }; gr.indices.forEach(i => { c[i] = e.target.value; }); onUpdate({ pathColors: c }); }} style={{ width: 24, height: 18, padding: 0, border: "none", cursor: "pointer", borderRadius: 3, flexShrink: 0 }} /><span style={{ color: t.tx2, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{gr.name}</span>{has && <button onClick={() => { const c = { ...(m.pathColors || {}) }; gr.indices.forEach(i => { delete c[i]; }); onUpdate({ pathColors: Object.keys(c).length ? c : undefined }); }} style={{ background: "none", border: "none", color: t.err, cursor: "pointer", fontSize: 9, padding: 0, flexShrink: 0 }}>↺</button>}</div>);})}</div></>})()}</>}
      {(m.type === "line" || m.type === "parallel") && <><PropRow label="Dash" t={t}><select value={m.style || "solid"} onChange={e => onUpdate({ style: e.target.value })} style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "3px 6px", color: t.tx, fontSize: 12, width: "100%", fontFamily: "inherit" }}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></PropRow><PropRow label="Type" t={t}><div style={{ display: "flex", gap: 4 }}>{["segment", "infinite"].map(s => <button key={s} onClick={() => onUpdate({ mode: s })} style={{ padding: "2px 8px", fontSize: 10, border: `1px solid ${t.bdr}`, borderRadius: 4, background: m.mode === s ? t.acc : "transparent", color: m.mode === s ? (theme === "light" ? "#fff" : t.bg) : t.tx, cursor: "pointer", fontWeight: 600 }}>{s === "segment" ? "2-Point" : "Infinite"}</button>)}</div></PropRow><PropRow label="∥ Clone" t={t}><Btn t={t} small onClick={onParallel} style={{ fontSize: 10 }}>Create Parallel</Btn></PropRow></>}
      {["arc", "ellipse", "circle", "concentric", "bezier", "tangent"].includes(m.type) && <PropRow label="Dash" t={t}><select value={m.style || "solid"} onChange={e => onUpdate({ style: e.target.value })} style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "3px 6px", color: t.tx, fontSize: 12, width: "100%", fontFamily: "inherit" }}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></PropRow>}
      {m.type === "bezier" && <PropRow label="Anchors" t={t}><div style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ fontSize: 11, color: t.tx2 }}>{m.points?.length || 0} pts · {Math.max(0, (m.points?.length || 1) - 1)} seg</span><span style={{ fontSize: 9, color: t.tx3 }}>Ctrl+click add • Shift+click remove</span></div></PropRow>}
      {m.type === "concentric" && <><PropRow label="Arcs" t={t}><input type="range" min="2" max="10" step="1" value={m.count || 4} onChange={e => { const count = +e.target.value; const spacing = m.spacing || 0.3; onUpdate({ count, offsets: Array.from({ length: count }, (_, i) => i * spacing) }); }} style={{ width: "100%", accentColor: t.acc }} /><span style={{ fontSize: 10, color: t.tx2, marginLeft: 6 }}>{m.count || 4}</span></PropRow><PropRow label="Spacing" t={t}><input type="range" min="0.05" max="1" step="0.05" value={m.spacing || 0.3} onChange={e => { const spacing = +e.target.value; const count = m.count || 4; onUpdate({ spacing, offsets: Array.from({ length: count }, (_, i) => i * spacing) }); }} style={{ width: "100%", accentColor: t.acc }} /><span style={{ fontSize: 10, color: t.tx2, marginLeft: 6 }}>{((m.spacing || 0.3) * 100).toFixed(0)}%</span></PropRow></>}
      {(()=>{const fm=Object.entries(meas).filter(([k])=>!k.startsWith("_")&&(m.type==="point"||(k!=="x"&&k!=="y")));return fm.length>0&&<div style={{marginTop:10,padding:8,background:t.surf3,borderRadius:6}}>{fm.map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:t.tx2}}><span style={{textTransform:"capitalize"}}>{k}</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc}}>{k==="angle"?formatAngle(v):v.toFixed(2)+(k==="area"?(calibration?.done?" mm²":" px²"):(calibration?.done?" mm":" px"))}</span></div>)}</div>;})()}
      {(()=>{const calTypes=["length","distance","area","perimeter","radius","circumference","majorAxis","minorAxis","arcLength","projectedDistance"];return relNorms.length>0&&<div style={{marginTop:8,padding:8,background:t.surf3,borderRadius:6}}><div style={{fontSize:10,color:t.tx2,marginBottom:6,fontWeight:600}}>Clinical Norms</div>{relNorms.map(n=>{const val=meas[n.measureType];const dev=val!==undefined&&(calibration?.done||!calTypes.includes(n.measureType))?normDeviation(val,n):null;return(<div key={n.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,marginBottom:4}}><span style={{color:t.tx2}}>{n.measureType}: {n.mean}±{n.sd}</span><div style={{display:"flex",gap:4,alignItems:"center"}}>{dev&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:deviationColor(dev.sdUnits,t),fontWeight:700}}>{dev.delta>0?"+":""}{dev.delta.toFixed(1)}({dev.sdUnits>0?"+":""}{dev.sdUnits.toFixed(1)}SD)</span>}<button onClick={()=>setEditingNorm({id:n.id,markupLabel:n.markupLabel,measureType:n.measureType,mean:n.mean,sd:n.sd,source:n.source})} style={{background:"none",border:`1px solid ${t.bdr}`,color:t.tx2,borderRadius:3,padding:"0 4px",cursor:"pointer",fontSize:9,lineHeight:"16px"}}>Edit</button></div></div>)})}</div>})()}
      {editingNorm && <InlineNormEditor t={t} {...editingNorm} onSave={(n) => { const filtered = (norms || []).filter(x => !(x.markupLabel === editingNorm.markupLabel && x.measureType === editingNorm.measureType)); onUpdateNorms([...filtered, { id: editingNorm.id || uid(), ...n }]); setEditingNorm(null); }} onDelete={() => { onUpdateNorms((norms || []).filter(x => !(x.markupLabel === editingNorm.markupLabel && x.measureType === editingNorm.measureType))); setEditingNorm(null); }} onClose={() => setEditingNorm(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATES PANEL
// ═══════════════════════════════════════════════════════════════════════════════
const STORAGE_KEY = "ceph_imported_templates";
function loadImportedTemplates() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function saveImportedTemplates(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch(e) { logWarn("Failed to save templates:", e); }
}

function measTypeLabel(type) {
  const map = { line: "Line", angle3: "Angle", angle4: "Angle", perp: "Perp", polygon: "Polygon", ratio: "Ratio", sum: "Sum", difference: "Diff", percentage: "Pct", projDist: "Dist", ellipse: "Ellipse", arc: "Arc", circle: "Circle", bezier: "Length", tangent: "Length", concentric: "Concentric" };
  return map[type] || type;
}

export function TemplatesPanel({ t, projection, onLoadTemplate, onImportCepht }) {
  let allTemplates = PREDEFINED[projection] || [];
  const [guideKey, setGuideKey] = useState(null);
  if (projection === "other") {
    const subKeys = ["smv", "opg", "handwrist", "photolateral", "photofrontal"];
    subKeys.forEach(key => {
      if (PREDEFINED[key]) allTemplates = allTemplates.concat(PREDEFINED[key]);
    });
  }
  const uniqueTemplates = allTemplates.filter((tmpl, idx, self) => idx === self.findIndex(t => t.name === tmpl.name));
  const [importedTemplates, setImportedTemplates] = useState(loadImportedTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState(null);
  const cephtInputRef = useRef(null);

  const handleImport = (data) => {
    onImportCepht(data);
    const exists = importedTemplates.some(t => t.name === data.name);
    if (data.name && !exists) {
      const updated = [...importedTemplates, { name: data.name, projection: data.projection || projection, markups: data.markups, formulas: data.formulas, norms: data.norms }];
      setImportedTemplates(updated);
      saveImportedTemplates(updated);
    }
  };

  const deleteImported = (name) => {
    const updated = importedTemplates.filter(t => t.name !== name);
    setImportedTemplates(updated);
    saveImportedTemplates(updated);
    if (selectedTemplate?.name === name) setSelectedTemplate(null);
  };

  const handleLoad = (tmpl, e) => {
    e?.stopPropagation();
    if (editMode && selectedLabels) {
      const filtered = { ...tmpl, pts: tmpl.pts?.filter(pt => selectedLabels.has(pt.l)) || [] };
      onLoadTemplate(filtered);
      setEditMode(false);
      setSelectedLabels(null);
    } else {
      onLoadTemplate(tmpl);
    }
  };

  const toggleLabel = (label) => {
    setSelectedLabels(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  const sections = [];
  if (selectedTemplate) {
    if (selectedTemplate.pts?.length > 0) sections.push({ type: "Landmarks", icon: "◉", items: selectedTemplate.pts.map(pt => ({ label: pt.l, def: pt.def, color: pt.color, type: "point" })) });
    if (selectedTemplate.lines?.length > 0) sections.push({ type: "Lines", icon: "⟋", items: selectedTemplate.lines.map(ln => ({ label: ln.l, def: ln.def, color: ln.color, type: "line" })) });
    if (selectedTemplate.angles?.length > 0) sections.push({ type: "Angles", icon: "∠", items: selectedTemplate.angles.map(ang => ({ label: ang.l, def: ang.def, color: ang.color, type: "angle" })) });
    if (selectedTemplate.distances?.length > 0) sections.push({ type: "Distances", icon: "↔", items: selectedTemplate.distances.map(dist => ({ label: dist.l, def: dist.def, color: dist.color, type: "distance" })) });
    if (selectedTemplate.planes?.length > 0) sections.push({ type: "Planes", icon: "▭", items: selectedTemplate.planes.map(pl => ({ label: pl.l, def: pl.def, color: pl.color, type: "plane" })) });
    if (selectedTemplate.projections?.length > 0) sections.push({ type: "Projections", icon: "▦", items: selectedTemplate.projections.map(p => ({ label: p.name, def: p.def, color: p.color, type: "projection" })) });
    if (selectedTemplate.markups?.length > 0) sections.push({ type: "Imported Items", icon: "📋", items: selectedTemplate.markups.map(m => ({ label: m.label || m.type, def: m.definition || "", color: m.color || t.tx3, type: m.type })) });
    if (selectedTemplate.measurements?.length > 0) sections.push({
      type: "Measurements", icon: "📐",
      items: selectedTemplate.measurements.map(m => ({
        label: m.l,
        def: m.def || measTypeLabel(m.type),
        color: m.color || t.acc,
        type: m.type,
        refs: m.pts?.join(", "),
        norm: m.norm ? `${m.norm.mean}±${m.norm.sd}` : null,
      }))
    });
  }

  if (selectedTemplate) {
    const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
    const displayName = selectedTemplate.name || selectedTemplate.group;

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${t.bdr}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button onClick={() => { setSelectedTemplate(null); setEditMode(false); setSelectedLabels(null); }} title="Back to templates" style={{ background: "none", border: "none", color: t.tx2, cursor: "pointer", fontSize: 18, padding: 4, display: "flex", alignItems: "center" }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
            <div style={{ fontSize: 10, color: t.tx2 }}>{totalItems} item{totalItems !== 1 ? "s" : ""}</div>
          </div>
          {selectedTemplate.pts && <>{
            editMode ? (
              <button onClick={() => { setEditMode(false); setSelectedLabels(null); }} style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx2, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); setEditMode(true); setSelectedLabels(new Set(selectedTemplate.pts.map(pt => pt.l))); }} style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx2, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Edit</button>
            )
          }</>}
          {selectedTemplate.pts && <button onClick={(e) => handleLoad(selectedTemplate, e)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: t.acc, color: t.bg, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            {editMode ? `Load ${selectedLabels?.size || 0} pts` : "Load"}
          </button>}
          {importedTemplates.some(t => t.name === selectedTemplate.name) && (
            <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete "${selectedTemplate.name}" from library?`)) deleteImported(selectedTemplate.name); }} style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: "transparent", color: t.err, fontSize: 14, cursor: "pointer", lineHeight: 1 }}>🗑</button>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {totalItems === 0 && <div style={{ fontSize: 12, color: t.tx2, textAlign: "center", padding: "20px 0" }}>No details available for this template.</div>}
          {sections.map(sec => (
            <div key={sec.type} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 14, color: t.acc }}>{sec.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.tx, textTransform: "uppercase", letterSpacing: 0.5 }}>{sec.type}</span>
                <span style={{ fontSize: 9, color: t.tx3, background: t.surf2, padding: "1px 6px", borderRadius: 4 }}>{sec.items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sec.items.map((item, i) => {
                  const canToggle = editMode && selectedLabels && selectedTemplate.pts?.some(pt => pt.l === item.label);
                  const isSelected = canToggle ? selectedLabels.has(item.label) : true;
                  return (
                    <div key={i} onClick={() => { if (canToggle) toggleLabel(item.label); }}
                      style={{ padding: 12, borderRadius: 8, background: t.surf2, border: `1px solid ${canToggle && !isSelected ? t.bdr : item.color || t.bdr}44`, cursor: canToggle ? "pointer" : "default", opacity: isSelected ? 1 : 0.45, transition: "all 0.15s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        {canToggle && <span style={{ fontSize: 12, color: isSelected ? t.acc : t.tx3, flexShrink: 0, lineHeight: 1 }}>{isSelected ? "☑" : "☐"}</span>}
                        <div style={{ width: 10, height: 10, borderRadius: item.type === "angle" || item.type === "angle3" || item.type === "angle4" ? "2px" : "50%", background: item.color || t.acc, flexShrink: 0 }} />
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, fontFamily: "'DM Mono',monospace" }}>{item.label}</div>
                        {item.refs && <span style={{ fontSize: 9, color: t.tx3, fontFamily: "'DM Mono',monospace" }}>({item.refs})</span>}
                        {item.norm && <span style={{ fontSize: 9, color: t.ok, background: t.ok + "18", padding: "1px 5px", borderRadius: 3, marginLeft: "auto" }}>norm {item.norm}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: t.tx2, lineHeight: 1.5 }}>{item.def || "—"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      <input type="file" ref={cephtInputRef} accept=".cepht" style={{ display: "none" }} onChange={e => { const file = e.target.files?.[0]; if (file && onImportCepht) { const reader = new FileReader(); reader.onload = ev => { try { const data = JSON.parse(ev.target.result); if (data.format === "cepht") { handleImport(data); } else alert("Invalid .cepht file"); } catch { alert("Cannot parse file"); } }; reader.readAsText(file); } e.target.value = ""; }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: t.tx2, lineHeight: 1.45, flex: 1 }}>
          Browse cephalometric analysis templates. Click a template to view landmarks with definitions. Click <strong>Load</strong> to add points to your workspace.
        </div>
        <button onClick={() => setGuideKey("templates")}
          style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0, marginRight: 6, flexShrink: 0 }} title="Guide">?</button>
        <button onClick={() => cephtInputRef.current?.click()} style={{ marginLeft: 8, padding: "4px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 10, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Import .cepht</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {uniqueTemplates.map(tmpl => {
          const displayName = tmpl.name || tmpl.group;
          const totalPts = tmpl.pts?.length || tmpl.projections?.length || 0;
          const measCount = tmpl.measurements?.length || 0;
          return (
            <div key={displayName} role="button" tabIndex={0} onClick={() => setSelectedTemplate(tmpl)} onKeyDown={onEnter(() => setSelectedTemplate(tmpl))} style={{ padding: "12px", borderRadius: 8, background: t.surf2, border: `1px solid ${t.bdr}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "border-color 0.15s" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.tx, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
                <div style={{ fontSize: 10, color: t.tx2 }}>{totalPts} pts{measCount ? ` · ${measCount} meas` : ""}</div>
              </div>
              {tmpl.pts && <button onClick={(e) => handleLoad(tmpl, e)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: t.acc, color: t.bg, fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Load</button>}
            </div>
          );
        })}
      </div>
      {importedTemplates.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.5, padding: "16px 0 8px" }}>Imported Templates</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {importedTemplates.map(tmpl => (
              <div key={tmpl.name} role="button" tabIndex={0} onClick={() => setSelectedTemplate(tmpl)} onKeyDown={onEnter(() => setSelectedTemplate(tmpl))} style={{ padding: "10px 12px", borderRadius: 8, background: t.surf3, border: `1px solid ${t.bdr}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "border-color 0.15s" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.tx, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tmpl.name}</div>
                  <div style={{ fontSize: 9, color: t.tx3 }}>{tmpl.markups?.length || 0} items{tmpl.projection ? ` · ${tmpl.projection}` : ""}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteImported(tmpl.name); }} style={{ padding: "2px 6px", borderRadius: 4, border: "none", background: "transparent", color: t.tx3, cursor: "pointer", fontSize: 12, lineHeight: 1 }}>✕</button>
              </div>
            ))}
          </div>
        </>
      )}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SILHOUETTES PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function SilhouettesPanel({ t, onInsert }) {
  const grouped = useMemo(() => getSilhouettesByCategory(), []);
  const categories = Object.keys(grouped);
  const [search, setSearch] = useState("");
  const [guideKey, setGuideKey] = useState(null);

  const allSilhouettes = useMemo(() => {
    const q = search.toLowerCase();
    return Object.entries(SILHOUETTES).filter(([key, s]) =>
      !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || key.toLowerCase().includes(q)
    );
  }, [search]);

  const renderThumbnail = (key, s, size = 80) => {
    const sc = 1;
    const cx = size / 2, cy = size / 2;
    const fill = s.color + "33";
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
        <rect width={size} height={size} fill={t.surf3} rx={4} />
        {s.paths.map((p, i) => {
          const d = p.points.map((pt, idx) => {
            const px = cx + pt.x * sc * 40;
            const py = cy + pt.y * sc * 40;
            return `${idx === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`;
          }).join(" ") + (p.closed ? "Z" : "");
          return <path key={i} d={d} fill={p.closed ? fill : "none"} stroke={s.color} strokeWidth={1.5} strokeLinejoin="round" />;
        })}
      </svg>
    );
  };

  const hasFullTracing = allSilhouettes.some(([k]) => k === "fullTracing");
  const hasFullTracingWithDentition = allSilhouettes.some(([k]) => k === "fullTracingWithDentition");

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <div style={{ flex: 1, fontSize: 11, color: t.tx2, lineHeight: 1.5 }}>
          Click a silhouette to place it on the canvas. Use handles to resize and rotate.
        </div>
        <button onClick={() => setGuideKey("silhouettes")}
          style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0, flexShrink: 0 }} title="Guide">?</button>
      </div>
      {(hasFullTracing || hasFullTracingWithDentition) && !search && (
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          {hasFullTracing && (
            <button key="fullTracing" onClick={() => onInsert("fullTracing")}
              style={{ flex: 1, padding: "14px 8px", borderRadius: 10, border: `1.5px solid ${t.acc}`, background: t.acc + "15", cursor: "pointer", outline: "none", transition: "all 0.15s", fontSize: 12, fontWeight: 600, color: t.tx, textAlign: "center", lineHeight: 1.3 }}>
              Full Tracing
            </button>
          )}
          {hasFullTracingWithDentition && (
            <button key="fullTracingWithDentition" onClick={() => onInsert("fullTracingWithDentition")}
              style={{ flex: 1, padding: "14px 8px", borderRadius: 10, border: `1.5px solid ${t.acc}`, background: t.acc + "15", cursor: "pointer", outline: "none", transition: "all 0.15s", fontSize: 12, fontWeight: 600, color: t.tx, textAlign: "center", lineHeight: 1.3 }}>
              With Dentition
            </button>
          )}
        </div>
      )}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search silhouettes..." style={{ width: "100%", padding: "7px 10px", border: `1px solid ${t.bdr}`, borderRadius: 6, background: t.surf3, color: t.tx, fontSize: 12, outline: "none", marginBottom: 12, fontFamily: "inherit", boxSizing: "border-box" }} />
      {allSilhouettes.length === 0 ? (
        <div style={{ textAlign: "center", padding: 24, color: t.tx3, fontSize: 12 }}>No silhouettes match your search.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {categories.map(cat => {
            const items = allSilhouettes.filter(([k]) => grouped[cat]?.some(g => g.key === k));
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.acc, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{cat}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
                  {items.map(([key, s]) => (
                    <button key={key} onClick={() => onInsert(key)}
                      style={{ padding: 8, borderRadius: 8, border: `1px solid ${t.bdr}`, background: t.surf2, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "all 0.15s", outline: "none" }}>
                      {renderThumbnail(key, s, 70)}
                      <span style={{ fontSize: 9, color: t.tx2, textAlign: "center", lineHeight: 1.3, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NORMS REFERENCE GALLERY MODAL
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLES PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function ExamplesPanel({ t }) {
  const [data, setData] = useState(null);

  const openExample = useCallback((id) => {
    const d = getExampleData(id);
    if (!d) { alert("Could not load example. Make sure the Examples/ folder contains .cepht files."); return; }
    setData(d);
  }, []);

  return (
    <div style={{ padding: 12, position: "relative" }}>
      {/* Coming Soon Overlay */}
      <div style={{ position:"absolute",inset:0,zIndex:10,background:`${t.surf}CC`,backdropFilter:"blur(1px)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderRadius:8 }}>
        <div style={{ fontSize:28,marginBottom:6,opacity:0.8 }}>🚧</div>
        <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:t.tx,marginBottom:4 }}>Coming Soon</div>
        <div style={{ fontSize:11,color:t.tx2,textAlign:"center",maxWidth:180,lineHeight:1.4 }}>Example templates are being finalized for the next release.</div>
      </div>

      {data && (
        <ExampleViewerModal
          t={t}
          data={data}
          onClose={() => setData(null)}
        />
      )}
      <div style={{ fontSize: 11, color: t.tx2, marginBottom: 12, lineHeight: 1.5, pointerEvents:"none" }}>
        Browse example templates. Click <strong>View</strong> to see a preview on canvas.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, pointerEvents:"none", opacity:0.5 }}>
        {EXAMPLE_LIST.map(ex => (
          <div key={ex.id} onClick={() => openExample(ex.id)}
            style={{ padding: "12px", borderRadius: 8, background: t.surf2, border: `1px solid ${t.bdr}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "border-color 0.15s" }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, background: t.surf3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📋</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.tx, marginBottom: 2 }}>{ex.label}</div>
              <div style={{ fontSize: 10, color: t.tx2 }}>{ex.subtitle}</div>
            </div>
            <span style={{ fontSize: 9, color: t.tx3, background: t.surf3, padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>{ex.badge}</span>
            <button onClick={e => { e.stopPropagation(); openExample(ex.id); }}
              style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: t.acc, color: t.bg, fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              View
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE VIEWER MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function ExampleViewerModal({ t, data, onClose }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const isPanning = useRef(false);
  const [panning, setPanning] = useState(false);
  const panStart = useRef(null);
  const [hoveredPt, setHoveredPt] = useState(null);

  // Compute bounding box derived from data
  const boundingBox = useMemo(() => {
    if (!data?.markups) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const expand = (x, y) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
    data.markups.forEach(m => {
      if (m.type === "silhouette") {
        const pos = m.position || { x: 0, y: 0 };
        const sc = m.scale || 1;
        const baseSize = 100;
        (m.paths || []).forEach(path => path.points.forEach(p => {
          expand(pos.x + p.x * sc * baseSize, pos.y + p.y * sc * baseSize);
        }));
      } else if (m.points) {
        m.points.forEach(p => expand(p.x, p.y));
      }
    });
    if (isFinite(minX) && minX !== Infinity) return { minX, maxX, minY, maxY };
    return { minX: 0, maxX: 800, minY: 0, maxY: 600 };
  }, [data]);

  // Reset zoom/pan when bounding box changes (new data)
  useEffect(() => {
    if (!boundingBox || !containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    const pad = 40;
    const cw = boundingBox.maxX - boundingBox.minX || 1;
    const ch = boundingBox.maxY - boundingBox.minY || 1;
    const nz = Math.min((width - pad * 2) / cw, (height - pad * 2) / ch, 1.5);
    setZoom(nz);
    setPan({ x: -boundingBox.minX * nz + pad, y: -boundingBox.minY * nz + pad });
  }, [boundingBox]);

  // Point definition tooltip on hover
  const renderTooltip = useCallback((ctx, W) => {
    if (!hoveredPt || !data?.markups) return;
    const hp = data.markups.find(m => m.id === hoveredPt.mid);
    if (!hp) return;
    const pts = hp.points || [];
    if (!pts.length) return;
    const sp = { x: pts[0].x * zoom + pan.x, y: pts[0].y * zoom + pan.y };
    const hasDef = !!hp.definition;
    const tipW = Math.max(120, Math.min(340, W - sp.x - 20));
    if (tipW < 60) return;
    const lines = []; let line = "";
    if (hasDef) {
      ctx.font = '11px "DM Sans",sans-serif';
      for (const word of hp.definition.split(" ")) {
        const test = line ? line + " " + word : word;
        if (ctx.measureText(test).width > tipW - 24 && line) { lines.push(line); line = word; } else line = test;
      }
      if (line) lines.push(line);
    }
    const tipH = hasDef ? Math.max(54, 38 + lines.length * 18) : 40;
    let tx = sp.x + 14, ty = sp.y - 10;
    if (tx + tipW > W - 8) tx = sp.x - tipW - 14;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2;
    ctx.fillStyle = t.surf2; ctx.beginPath(); ctx.roundRect(tx, ty, tipW, tipH, 8); ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = t.acc; ctx.beginPath(); ctx.roundRect(tx, ty, tipW, 3, { upperLeft: 8, upperRight: 8 }); ctx.fill();
    ctx.fillStyle = t.tx; ctx.font = 'bold 12px "DM Sans",sans-serif';
    ctx.fillText(hp.label, tx + 12, ty + (hasDef ? 20 : 26));
    if (hasDef) {
      ctx.fillStyle = t.tx2; ctx.font = '11px "DM Sans",sans-serif';
      lines.forEach((l, i) => ctx.fillText(l, tx + 12, ty + 38 + i * 16));
    }
    ctx.restore();
  }, [hoveredPt, data, t, zoom, pan]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr, H = canvas.height / dpr;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, W, H);

    if (data?.markups) {
      const cal = { done: false, pxPerMm: 1, knownMm: "" };
      const cs = { w: W, h: H };
      data.markups.forEach(m => {
        drawMarkup(ctx, m, zoom, pan, cal, null, t, false, cs, "signed-deg", true, 1, null);
      });
    }
    renderTooltip(ctx, W);
    ctx.restore();
  }, [data, t, zoom, pan, renderTooltip]);

  useEffect(() => {
    if (!rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        redraw();
      });
  });

  // ResizeObserver for canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      // Re-fit on resize if boundingBox exists
      if (boundingBox) {
        const pad = 40;
        const cw = boundingBox.maxX - boundingBox.minX || 1;
        const ch = boundingBox.maxY - boundingBox.minY || 1;
        const nz = Math.min((width - pad * 2) / cw, (height - pad * 2) / ch, 1.5);
        setZoom(nz);
        setPan({ x: -boundingBox.minX * nz + pad, y: -boundingBox.minY * nz + pad });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [boundingBox]);

  // Wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = e => {
      if (Math.abs(e.deltaY) > 0.1 || Math.abs(e.deltaX) > 0.1) {
        e.preventDefault();
        e.stopPropagation();
        const r = canvas.getBoundingClientRect();
        const sp = { x: e.clientX - r.left, y: e.clientY - r.top };
        const f = e.deltaY > 0 ? 0.9 : 1.1;
        const nz = Math.min(Math.max(zoom * f, 0.05), 15);
        setPan(prev => ({
          x: sp.x - (sp.x - prev.x) * (nz / zoom),
          y: sp.y - (sp.y - prev.y) * (nz / zoom)
        }));
        setZoom(nz);
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoom]);

  // Pan mouse handlers
  const handleMouseDown = useCallback(e => {
    isPanning.current = true;
    setPanning(true);
    panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback(e => {
    if (isPanning.current && panStart.current) {
      setPan({
        x: panStart.current.px + (e.clientX - panStart.current.mx),
        y: panStart.current.py + (e.clientY - panStart.current.my)
      });
      return;
    }
    // Hit-test for point hover
    if (!data?.markups) return;
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return;
    const sp = { x: e.clientX - r.left, y: e.clientY - r.top };
    const ip = { x: (sp.x - pan.x) / zoom, y: (sp.y - pan.y) / zoom };
    let best = null, bd = Infinity;
    const thr = 8 / zoom;
    for (const m of data.markups) {
      if (m.type !== "point") continue;
      const pts = m.points || [];
      if (!pts.length) continue;
      const d = Math.hypot(ip.x - pts[0].x, ip.y - pts[0].y);
      if (d < bd && d < thr) { bd = d; best = { mid: m.id, type: "point" }; }
    }
    setHoveredPt(prev => {
      if (prev?.mid === best?.mid && prev?.type === best?.type) return prev;
      return best;
    });
  }, [data, zoom, pan]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    setPanning(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    isPanning.current = false;
    setPanning(false);
    setHoveredPt(null);
  }, []);

  // Double-click to reset view
  const handleDblClick = useCallback(() => {
    if (!boundingBox || !containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const pad = 40;
    const cw = boundingBox.maxX - boundingBox.minX || 1;
    const ch = boundingBox.maxY - boundingBox.minY || 1;
    const nz = Math.min((width - pad * 2) / cw, (height - pad * 2) / ch, 1.5);
    setZoom(nz);
    setPan({ x: -boundingBox.minX * nz + pad, y: -boundingBox.minY * nz + pad });
  }, [boundingBox]);

  const zoomIn = useCallback(() => {
    const nz = Math.min(zoom * 1.3, 15);
    setPan(prev => {
      const r = canvasRef.current?.getBoundingClientRect();
      const cx = (r?.width || 400) / 2;
      const cy = (r?.height || 300) / 2;
      return { x: cx - (cx - prev.x) * (nz / zoom), y: cy - (cy - prev.y) * (nz / zoom) };
    });
    setZoom(nz);
  }, [zoom]);

  const zoomOut = useCallback(() => {
    const nz = Math.max(zoom / 1.3, 0.05);
    setPan(prev => {
      const r = canvasRef.current?.getBoundingClientRect();
      const cx = (r?.width || 400) / 2;
      const cy = (r?.height || 300) / 2;
      return { x: cx - (cx - prev.x) * (nz / zoom), y: cy - (cy - prev.y) * (nz / zoom) };
    });
    setZoom(nz);
  }, [zoom]);

  const cursorStyle = panning ? "grabbing" : "grab";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div style={{ background: t.surf, border: `1px solid ${t.bdr}`, borderRadius: 12, width: "min(90vw, 780px)", height: "min(90vh, 600px)", display: "flex", flexDirection: "column", boxShadow: `0 24px 64px ${t.shadow}50`, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${t.bdr}`, flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>Example: {data?.name || "Template Preview"}</div>
            <div style={{ fontSize: 10, color: t.tx2 }}>{data?.markups?.length || 0} markups · {data?.projection || ""} projection</div>
          </div>
          <span style={{ fontSize: 9, color: t.tx3, fontFamily: "'DM Mono',monospace" }}>{data?.markups?.filter(m => m.type === "point").length || 0} pts</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
            <button onClick={zoomOut} title="Zoom out" style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, color: t.tx2, cursor: "pointer", fontSize: 14, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
            <span style={{ fontSize: 10, color: t.tx3, fontFamily: "'DM Mono',monospace", minWidth: 32, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button onClick={zoomIn} title="Zoom in" style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, color: t.tx2, cursor: "pointer", fontSize: 14, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            <button onClick={handleDblClick} title="Reset view" style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, color: t.tx2, cursor: "pointer", fontSize: 12, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>⊙</button>
          </div>
          <button onClick={onClose} title="Close" style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>
        <div ref={containerRef} style={{ flex: 1, position: "relative", minHeight: 0 }}>
          <canvas ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={handleDblClick}
            style={{ display: "block", width: "100%", height: "100%", cursor: cursorStyle, touchAction: "none" }} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NORMS REFERENCE GALLERY MODAL
// ═══════════════════════════════════════════════════════════════════════════════
export function NormsReferenceModal({ t, onAdd, onClose }) {
  const [search, setSearch] = useState("");
  const [guideKey, setGuideKey] = useState(null);
  const query = search.toLowerCase();
  const entries = useMemo(() => {
    const result = [];
    Object.entries(PREDEFINED_NORMS).forEach(([key, preset]) => {
      preset.norms.forEach(n => {
        if (!query || n.label.toLowerCase().includes(query) || preset.source.toLowerCase().includes(query) || key.toLowerCase().includes(query))
          result.push({ ...n, presetKey: key, source: preset.source });
      });
    });
    return result;
  }, [query]);
  const grouped = useMemo(() => {
    const g = {};
    entries.forEach(e => { if (!g[e.presetKey]) g[e.presetKey] = { source: e.source, norms: [] }; g[e.presetKey].norms.push(e); });
    return g;
  }, [entries]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div style={{ background: t.bg, border: `1px solid ${t.bdr}`, borderRadius: 12, width: "min(90vw, 640px)", maxHeight: "min(90vh, 700px)", display: "flex", flexDirection: "column", boxShadow: `0 24px 64px ${t.shadow}50` }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${t.bdr}`, flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>📖</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.tx, flex: 1 }}>Norms Reference Gallery
            <button onClick={() => setGuideKey("norms")}
              style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0, marginLeft: 6, verticalAlign: "middle" }} title="Guide">?</button>
          </span>
          <span style={{ fontSize: 10, color: t.tx3, fontFamily: "'DM Mono',monospace" }}>{Object.values(PREDEFINED_NORMS).reduce((s, p) => s + p.norms.length, 0)} norms</span>
          <button onClick={onClose} title="Close" style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>
        <div style={{ padding: "8px 16px", borderBottom: `1px solid ${t.bdr}44`, flexShrink: 0 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search norms by name, preset, or source..." style={{ width: "80%", padding: "8px 10px", border: `1px solid ${t.bdr}`, borderRadius: 8, background: t.surf3, color: t.tx, fontSize: 12, outline: "none" }} />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {Object.keys(grouped).length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: t.tx3, fontSize: 12 }}>No norms match your search.</div>
          ) : Object.entries(grouped).map(([key, group]) => (
            <div key={key} style={{ marginBottom: 14, border: `1px solid ${t.bdr}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", background: t.surf2, borderBottom: `1px solid ${t.bdr}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><span style={{ fontSize: 11, fontWeight: 700, color: t.acc }}>{key}</span><span style={{ fontSize: 10, color: t.tx3, marginLeft: 8 }}>{group.source}</span></div>
                <button onClick={() => { group.norms.forEach(n => onAdd(n.label, n.mean, n.sd, n.type, group.source)); }} style={{ padding: "3px 8px", borderRadius: 4, border: "none", background: t.acc + "22", color: t.acc, cursor: "pointer", fontSize: 9, fontWeight: 700 }}>Add All ({group.norms.length})</button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${t.bdr}44`, background: t.surf3 }}>
                      <th style={{ textAlign: "left", padding: "5px 10px", color: t.tx2, fontWeight: 600 }}>Label</th>
                      <th style={{ textAlign: "right", padding: "5px 10px", color: t.tx2, fontWeight: 600 }}>Mean</th>
                      <th style={{ textAlign: "right", padding: "5px 10px", color: t.tx2, fontWeight: 600 }}>SD</th>
                      <th style={{ textAlign: "center", padding: "5px 10px", color: t.tx2, fontWeight: 600 }}>Type</th>
                      <th style={{ textAlign: "right", padding: "5px 10px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.norms.map((n, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${t.bdr}33` }}>
                        <td style={{ padding: "5px 10px", color: t.tx, fontWeight: 600, whiteSpace: "nowrap" }}>{n.label}</td>
                        <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx }}>{n.mean.toFixed(1)}</td>
                        <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx3 }}>± {n.sd.toFixed(1)}</td>
                        <td style={{ padding: "5px 10px", textAlign: "center" }}><span style={{ background: (n.type === "angle" ? t.warn : t.ok) + "22", color: n.type === "angle" ? t.warn : t.ok, borderRadius: 3, padding: "1px 5px", fontSize: 8, fontWeight: 700 }}>{n.type}</span></td>
                        <td style={{ padding: "5px 10px", textAlign: "right" }}>
                          <button onClick={() => onAdd(n.label, n.mean, n.sd, n.type, group.source)} style={{ padding: "2px 7px", borderRadius: 4, border: `1px solid ${t.acc}55`, background: "transparent", color: t.acc, cursor: "pointer", fontSize: 9, fontWeight: 600, whiteSpace: "nowrap" }}>+ Add</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
      </div>
    </div>
  );
}

