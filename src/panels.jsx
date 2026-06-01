import { useState, useRef } from "react";
import { uid, computeMeasurements, normDeviation, deviationColor, evalFormula } from "./utils.js";
import { LUT_PRESETS, PREDEFINED } from "./constants.js";
import { KatexSpan, LatexFloatingPanel } from "./hooks.jsx";
import { Btn, Tag, Sld, PropRow, Inp, Divider, PanelHeader } from "./ui.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// MARKUPS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function MarkupsPanel({ markups, t, theme, selectedId, onSelect, onDelete, onToggleVisible, onToggleLock, onToggleLabel, onReplace, replacingId, calibration, placingMode, placingQueue, placingIdx, onStopPlacing, onPausePlacing, onResumePlacing, onClear, onAddPoint, norms, formatAngle, angleMode, setAngleMode }) {
  const [collapsed, setCollapsed] = useState({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sign, unit] = angleMode?.split("-") || ["signed", "deg"];
  const sections = [
    { id: "point", label: "Landmarks", types: ["point"], icon: "◉", color: t.acc },
    { id: "line", label: "Lines & Planes", types: ["line", "parallel", "ruler"], icon: "⟋", color: "#38bdf8" },
    { id: "angle", label: "Angles", types: ["angle3", "angle4"], icon: "∠", color: "#f472b6" },
    { id: "curve", label: "Open Curves", types: ["curve"], icon: "∿", color: "#fb923c" },
    { id: "polygon", label: "Polygons", types: ["polygon"], icon: "⬡", color: "#4ade80" },
    { id: "other", label: "Measurements", types: ["perp"], icon: "⊥", color: "#a78bfa" },
    { id: "annotation", label: "Annotations", types: ["arrow", "text"], icon: "📝", color: "#fbbf24" },
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
            <div onClick={() => toggle(sec.id)} style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", background: t.surf2, borderBottom: `1px solid ${t.bdr}`, borderTop: `1px solid ${t.bdr}`, userSelect: "none" }}>
              <span style={{ color: sec.color, fontSize: 12 }}>{sec.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.tx, flex: 1, textTransform: "uppercase", letterSpacing: 0.5 }}>{sec.label}</span>
              <span style={{ fontSize: 10, color: t.tx3, fontFamily: "'DM Mono',monospace" }}>{items.length}</span>
              <span style={{ color: t.tx3, fontSize: 10, transition: "transform 0.15s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▾</span>
            </div>
            {!isCollapsed && items.map(m => {
              const meas = computeMeasurements(m, calibration);
              const ms = Object.entries(meas).map(([k, v]) => k === "angle" ? formatAngle(v) : v.toFixed(1) + (k === "area" ? " mm²" : " mm")).join("  ");
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
                      <span style={{ fontSize: 10, color: m.noLabel ? t.tx3 : t.acc }}>{m.noLabel ? "Aa" : "Aa"}</span>
                    </button>
                    {m.type !== "text" && <button onClick={() => onReplace && onReplace(m.type, m.id)} style={{ background: replacingId === m.id ? t.accMuted : "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }} title="Replace mode">
                      <span style={{ fontSize: 11, color: replacingId === m.id ? t.acc : t.tx2 }}>⚙</span>
                    </button>}
                    <div onClick={() => onSelect(m.id === selectedId ? null : m.id)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isHidden ? t.tx3 : t.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {isPlacing && <span style={{ color: t.warn, marginRight: 4 }}>📍</span>}
                        {unplaced && !isPlacing && <span style={{ color: t.tx3, marginRight: 4 }}>○</span>}
                        {m.label || m.type}
                        {m.type === "curve" && m.curveStyle === "bspline" && <span style={{ fontSize: 9, color: t.tx3, marginLeft: 4 }}>[spline]</span>}
                        {m.type === "polygon" && m.curveStyle === "bspline" && <span style={{ fontSize: 9, color: t.tx3, marginLeft: 4 }}>[spline]</span>}
                        {m.type === "text" && m.text && <span style={{ fontSize: 9, color: t.tx3, marginLeft: 4 }}>"{m.text.slice(0, 15)}{m.text.length > 15 ? "…" : ""}"</span>}
                        {m.type === "arrow" && <span style={{ fontSize: 9, color: t.tx3, marginLeft: 4 }}>→</span>}
                        {isLocked && <span style={{ fontSize: 9, color: t.warn, marginLeft: 4 }}>[locked]</span>}
                      </div>
                      {ms && !isHidden && <div style={{ fontSize: 10, color: t.acc, fontFamily: "'DM Mono',monospace" }}>{ms}</div>}
                      {relNorms.length > 0 && !isHidden && ms && <NormBadges norms={relNorms} meas={meas} t={t} />}
                    </div>
                    <button onClick={() => onDelete(m.id)} style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 14, flexShrink: 0 }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {markups.length === 0 && <div style={{ padding: 24, textAlign: "center", color: t.tx3, fontSize: 12 }}>No markups yet.<br />Select a tool and click on the image.</div>}
    </div>
  );
}

function NormBadges({ norms, meas, t }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 2 }}>
      {norms.map(n => {
        const val = meas[n.measureType];
        if (val === undefined) return null;
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
export function MeasurementsPanel({ allMeas, t, calibration, norms, onUpdateNorms, onExportCSV, onOpenCalib, formatAngle }) {
  const [editingNorm, setEditingNorm] = useState(null);
  return (
    <div style={{ padding: 12 }}>
      {!calibration.done && <div style={{ background: t.warn + "22", border: `1px solid ${t.warn}44`, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12, color: t.warn }}>⚠ Calibrate for mm values.<button onClick={onOpenCalib} style={{ display: "block", marginTop: 6, background: t.warn, color: "#000", border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Open Calibration</button></div>}
      {calibration.done && <div style={{ background: t.ok + "11", border: `1px solid ${t.ok}33`, borderRadius: 6, padding: 8, marginBottom: 10, fontSize: 11, color: t.ok, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>⟺ {calibration.pxPerMm.toFixed(3)} px/mm</span><button onClick={onOpenCalib} style={{ background: "none", border: `1px solid ${t.ok}55`, color: t.ok, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 10 }}>Edit</button>
      </div>}

      {allMeas.length === 0 ? <div style={{ color: t.tx3, fontSize: 12, textAlign: "center", paddingTop: 20 }}>Place lines, angles, or polygons.</div>
        : allMeas.map(({ m, meas }) => {
          const relNorms = (norms || []).filter(n => n.markupLabel === m.label);
          return (
            <div key={m.id} style={{ marginBottom: 10, padding: 10, background: t.surf2, borderRadius: 8, border: `1px solid ${t.bdr}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: m.color || t.acc, marginBottom: 6, display: "flex", justifyContent: "space-between" }}><span>{m.label || m.type}</span><Tag color={m.color || t.acc}>{m.type}</Tag></div>
              {Object.entries(meas).map(([k, v]) => {
                const norm = relNorms.find(n => n.measureType === k);
                const dev = norm ? normDeviation(v, norm) : null;
                return (
                  <div key={k} style={{ marginBottom: dev ? 10 : 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: t.tx2, alignItems: "center" }}>
                      <span>{k}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: "'DM Mono',monospace", color: t.tx, fontWeight: 600 }}>{k === "angle" ? formatAngle(v) : v.toFixed(2) + (k === "area" ? " mm²" : " mm")}</span>
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
            </div>
          );
        })}

      {editingNorm && <InlineNormEditor t={t} {...editingNorm} onSave={(n) => { const filtered = (norms || []).filter(x => !(x.markupLabel === editingNorm.markupLabel && x.measureType === editingNorm.measureType)); onUpdateNorms([...filtered, { id: editingNorm.existing?.id || uid(), ...n }]); setEditingNorm(null); }} onDelete={() => { onUpdateNorms((norms || []).filter(x => !(x.markupLabel === editingNorm.markupLabel && x.measureType === editingNorm.measureType))); setEditingNorm(null); }} onClose={() => setEditingNorm(null)} />}

      {allMeas.length > 0 && <Btn t={t} small onClick={onExportCSV} style={{ width: "100%", marginTop: 8 }}>⬇ Export CSV</Btn>}
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
export function FormulasPanel({ formulas, t, scope, onAdd, onEdit, onDelete }) {
  const [bigLatex, setBigLatex] = useState(null);
  return (
    <div style={{ padding: 12 }}>
      <PanelHeader t={t}>Custom Formulas</PanelHeader>
      <div style={{ fontSize: 11, color: t.tx2, marginBottom: 12, lineHeight: 1.5 }}>Define derived measurements. Variables use landmark label names.</div>
      {formulas.map(f => {
        const val = evalFormula(f.expression, scope);
        return (
          <div key={f.id} style={{ marginBottom: 10, padding: 10, background: t.surf2, borderRadius: 8, border: `1px solid ${t.bdr}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div><div style={{ fontSize: 12, fontWeight: 700, color: t.acc }}>{f.name}</div>{f.unit && <div style={{ fontSize: 10, color: t.tx3 }}>{f.unit}</div>}</div>
              <div style={{ display: "flex", gap: 4 }}><button onClick={() => onEdit(f.id)} style={{ background: "none", border: `1px solid ${t.bdr}`, color: t.tx2, borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontSize: 10 }}>Edit</button><button onClick={() => onDelete(f.id)} style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 14 }}>×</button></div>
            </div>
            {f.latex && <div onClick={() => setBigLatex(f.latex)} style={{ background: t.surf3, borderRadius: 4, padding: "6px 10px", marginBottom: 8, cursor: "pointer", border: `1px solid ${t.bdr}`, minHeight: 28, display: "flex", alignItems: "center" }}>
              <KatexSpan latex={f.latex} block={false} fontSize={10} />
              <span style={{ fontSize: 9, color: t.tx3, marginLeft: "auto", paddingLeft: 8 }}>click to enlarge</span>
            </div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: t.tx2 }}>Result</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: val !== null ? t.acc : t.err }}>{val !== null ? `${val.toFixed(2)} ${f.unit || ""}` : "N/A"}</span>
            </div>
          </div>
        );
      })}
      <Btn t={t} small onClick={onAdd} style={{ width: "100%", marginTop: 4 }}>+ New Formula</Btn>
      {bigLatex && <LatexFloatingPanel latex={bigLatex} onClose={() => setBigLatex(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGE PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function ImagePanel({ t, processing, setProcessing, lutMode, setLutMode, lutInvert, setLutInvert, showLUT, setShowLUT, showScaleBar, setShowScaleBar, calibration, onOpenCalib, onReset, onShowHist, showHistogram }) {
  return (
    <div style={{ padding: 12 }}>
      <PanelHeader t={t}>Window & Level</PanelHeader>
      <Sld label="W Center" value={processing.windowCenter} min={0} max={255} onChange={v => { const p = { ...processing, windowCenter: v }; setProcessing(p); }} t={t} />
      <Sld label="W Width" value={processing.windowWidth} min={0} max={255} onChange={v => { const p = { ...processing, windowWidth: v }; setProcessing(p); }} t={t} />
      <Divider t={t} />
      <PanelHeader t={t}>Brightness & Contrast</PanelHeader>
      <Sld label="Brightness" value={processing.brightness} min={-128} max={128} onChange={v => { const p = { ...processing, brightness: v }; setProcessing(p); }} t={t} />
      <Sld label="Contrast" value={processing.contrast} min={-100} max={200} onChange={v => { const p = { ...processing, contrast: v }; setProcessing(p); }} t={t} unit="%" />
      <Sld label="Edge Enhance" value={processing.edgeEnhance} min={0} max={100} onChange={v => { const p = { ...processing, edgeEnhance: v }; setProcessing(p); }} t={t} unit="%" />
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}><Btn t={t} small onClick={onReset} style={{ flex: 1 }}>↺ Reset</Btn><Btn t={t} small active={showHistogram} onClick={onShowHist} style={{ flex: 1 }}>▦ Histogram</Btn></div>
      <Divider t={t} />
      <PanelHeader t={t}>LUT Colorization</PanelHeader>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <Btn t={t} small active={showLUT} onClick={() => setShowLUT(v => !v)}>Legend</Btn>
        <Btn t={t} small active={lutInvert} onClick={() => setLutInvert(v => !v)}>⇅ Invert</Btn>
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// LAYERS PANEL
// ═══════════════════════════════════════════════════════════════════════════════════════
export function LayersPanel({ t, images, onUpdateImages, onAddImage, showDisplacement, setShowDisplacement, compareVersionId, setCompareVersionId, versions, onShowAlign, onShowTransform }) {
  const updImg = (id, patch) => onUpdateImages(images.map(i => i.id === id ? { ...i, ...patch } : i));
  const move = (idx, dir) => { const imgs = [...images]; [imgs[idx], imgs[idx + dir]] = [imgs[idx + dir], imgs[idx]]; onUpdateImages(imgs); };
  const SCOLS = ["none", "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7"];
  return (
    <div style={{ padding: 12 }}>
      <PanelHeader t={t}>Image Stack ({images.length})</PanelHeader>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <Btn t={t} small active={showDisplacement} onClick={() => setShowDisplacement(v => !v)}>⇝ Displacement</Btn>
        <Btn t={t} small onClick={onShowAlign}>⊕ Align</Btn>
        <Btn t={t} small onClick={onShowTransform}>⟲ Transform</Btn>
      </div>
      {versions.length > 1 && <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: t.tx2, marginBottom: 4 }}>Compare landmarks with:</div>
        <select value={compareVersionId || ""} onChange={e => setCompareVersionId(e.target.value || null)} style={{ width: "100%", background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12, fontFamily: "inherit" }}>
          <option value="">— None —</option>
          {versions.map(v => <option key={v.id} value={v.id}>{v.label}: {v.name}</option>)}
        </select>
      </div>}
      {images.length === 0 && <div style={{ color: t.tx3, fontSize: 12 }}>No images loaded.</div>}
      {images.map((img, idx) => (
        <div key={img.id} style={{ marginBottom: 10, border: `1px solid ${t.bdr}`, borderRadius: 8, padding: 10, background: t.surf2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <button onClick={() => updImg(img.id, { visible: !img.visible })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: img.visible ? t.acc : t.tx3 }}>{img.visible ? "◎" : "○"}</button>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: t.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.name || `Img ${idx + 1}`}</span>
            <div style={{ display: "flex", gap: 2 }}>
              {idx > 0 && <button onClick={() => move(idx, -1)} style={{ background: "none", border: `1px solid ${t.bdr}`, color: t.tx2, borderRadius: 3, padding: "1px 4px", cursor: "pointer", fontSize: 10 }}>↑</button>}
              {idx < images.length - 1 && <button onClick={() => move(idx, 1)} style={{ background: "none", border: `1px solid ${t.bdr}`, color: t.tx2, borderRadius: 3, padding: "1px 4px", cursor: "pointer", fontSize: 10 }}>↓</button>}
            </div>
            <button onClick={() => onUpdateImages(images.filter(i => i.id !== img.id))} style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 14 }}>×</button>
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
            <button onClick={() => updImg(img.id, { dx: 0, dy: 0 })} style={{ alignSelf: "flex-end", background: "none", border: `1px solid ${t.bdr}`, color: t.tx2, borderRadius: 4, padding: "3px 5px", cursor: "pointer", fontSize: 10, height: 24 }}>⊙</button>
          </div>
        </div>
      ))}
      <label style={{ cursor: "pointer", display: "block" }} onChange={onAddImage}><input type="file" accept="image/*" style={{ display: "none" }} /><div style={{ border: `2px dashed ${t.bdr}`, borderRadius: 8, padding: 12, textAlign: "center", color: t.tx2, fontSize: 12, cursor: "pointer" }}>+ Add to stack</div></label>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKUP PROPERTIES
// ═══════════════════════════════════════════════════════════════════════════════
export function MarkupProps({ m, t, theme, onUpdate, onDelete, calibration, onParallel, formatAngle }) {
  const meas = computeMeasurements(m, calibration);
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
      {["line", "angle3", "angle4", "curve", "perp", "parallel"].includes(m.type) && <PropRow label="Width" t={t}><input type="range" min="0.5" max="6" step="0.5" value={m.width || 1.5} onChange={e => onUpdate({ width: +e.target.value })} style={{ width: "100%", accentColor: t.acc }} /></PropRow>}
      {(m.type === "line" || m.type === "parallel") && <><PropRow label="Dash" t={t}><select value={m.style || "solid"} onChange={e => onUpdate({ style: e.target.value })} style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "3px 6px", color: t.tx, fontSize: 12, width: "100%", fontFamily: "inherit" }}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></PropRow><PropRow label="Type" t={t}><div style={{ display: "flex", gap: 4 }}>{["segment", "infinite"].map(s => <button key={s} onClick={() => onUpdate({ mode: s })} style={{ padding: "2px 8px", fontSize: 10, border: `1px solid ${t.bdr}`, borderRadius: 4, background: m.mode === s ? t.acc : "transparent", color: m.mode === s ? (theme === "light" ? "#fff" : t.bg) : t.tx, cursor: "pointer", fontWeight: 600 }}>{s === "segment" ? "2-Point" : "Infinite"}</button>)}</div></PropRow><PropRow label="∥ Clone" t={t}><Btn t={t} small onClick={onParallel} style={{ fontSize: 10 }}>Create Parallel</Btn></PropRow></>}
      {Object.keys(meas).length > 0 && <div style={{ marginTop: 10, padding: 8, background: t.surf3, borderRadius: 6 }}>{Object.entries(meas).map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: t.tx2 }}><span style={{ textTransform: "capitalize" }}>{k}</span><span style={{ fontFamily: "'DM Mono',monospace", color: t.acc }}>{k === "angle" ? formatAngle(v) : v.toFixed(2) + (k === "area" ? " mm²" : " mm")}</span></div>)}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATES PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function TemplatesPanel({ t, projection, onLoadTemplate, onImportCepht }) {
  let allTemplates = PREDEFINED[projection] || [];
  if (projection === "other") {
    const subKeys = ["smv", "opg"];
    subKeys.forEach(key => {
      if (PREDEFINED[key]) allTemplates = allTemplates.concat(PREDEFINED[key]);
    });
  }
  const uniqueTemplates = allTemplates.filter((tmpl, idx, self) => idx === self.findIndex(t => t.name === tmpl.name));
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const cephtInputRef = useRef(null);

  const handleLoad = (tmpl, e) => {
    e?.stopPropagation();
    onLoadTemplate(tmpl);
  };

  if (selectedTemplate) {
    const sections = [];
    if (selectedTemplate.pts?.length > 0) sections.push({ type: "Landmarks", icon: "◉", items: selectedTemplate.pts.map(pt => ({ label: pt.l, def: pt.def, color: pt.color, type: "point" })) });
    if (selectedTemplate.lines?.length > 0) sections.push({ type: "Lines", icon: "⟋", items: selectedTemplate.lines.map(ln => ({ label: ln.l, def: ln.def, color: ln.color, type: "line" })) });
    if (selectedTemplate.angles?.length > 0) sections.push({ type: "Angles", icon: "∠", items: selectedTemplate.angles.map(ang => ({ label: ang.l, def: ang.def, color: ang.color, type: "angle" })) });
    if (selectedTemplate.distances?.length > 0) sections.push({ type: "Distances", icon: "↔", items: selectedTemplate.distances.map(dist => ({ label: dist.l, def: dist.def, color: dist.color, type: "distance" })) });
    if (selectedTemplate.planes?.length > 0) sections.push({ type: "Planes", icon: "▭", items: selectedTemplate.planes.map(pl => ({ label: pl.l, def: pl.def, color: pl.color, type: "plane" })) });
    if (selectedTemplate.projections?.length > 0) sections.push({ type: "Projections", icon: "▦", items: selectedTemplate.projections.map(p => ({ label: p.name, def: p.def, color: p.color, type: "projection" })) });

    const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
    const displayName = selectedTemplate.name || selectedTemplate.group;

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${t.bdr}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button onClick={() => setSelectedTemplate(null)} style={{ background: "none", border: "none", color: t.tx2, cursor: "pointer", fontSize: 18, padding: 4, display: "flex", alignItems: "center" }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
            <div style={{ fontSize: 10, color: t.tx2 }}>{totalItems} items</div>
          </div>
          {selectedTemplate.pts && <button onClick={(e) => handleLoad(selectedTemplate, e)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: t.acc, color: t.bg, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Load</button>}
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
                {sec.items.map((item, i) => (
                  <div key={i} style={{ padding: 12, borderRadius: 8, background: t.surf2, border: `1px solid ${item.color || t.bdr}44` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: item.type === "angle" ? "2px" : "50%", background: item.color || t.acc, flexShrink: 0 }} />
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, fontFamily: "'DM Mono',monospace" }}>{item.label}</div>
                    </div>
                    <div style={{ fontSize: 11, color: t.tx2, lineHeight: 1.5 }}>{item.def || "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      <input type="file" ref={cephtInputRef} accept=".cepht" style={{ display: "none" }} onChange={e => { const file = e.target.files?.[0]; if (file && onImportCepht) { const reader = new FileReader(); reader.onload = ev => { try { const data = JSON.parse(ev.target.result); if (data.format === "cepht") onImportCepht(data); else alert("Invalid .cepht file"); } catch { alert("Cannot parse file"); } }; reader.readAsText(file); } e.target.value = ""; }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: t.tx2, lineHeight: 1.45, flex: 1 }}>
          Browse cephalometric analysis templates. Click a template to view landmarks with definitions. Click <strong>Load</strong> to add points to your workspace.
        </div>
        <button onClick={() => cephtInputRef.current?.click()} style={{ marginLeft: 8, padding: "4px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 10, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Import .cepht</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {uniqueTemplates.map(tmpl => {
          const displayName = tmpl.name || tmpl.group;
          const totalPts = tmpl.pts?.length || tmpl.projections?.length || 0;
          return (
            <div key={displayName} onClick={() => setSelectedTemplate(tmpl)} style={{ padding: "12px", borderRadius: 8, background: t.surf2, border: `1px solid ${t.bdr}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "border-color 0.15s" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.tx, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
                <div style={{ fontSize: 10, color: t.tx2 }}>{totalPts} items</div>
              </div>
              {tmpl.pts && <button onClick={(e) => handleLoad(tmpl, e)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: t.acc, color: t.bg, fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Load</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

