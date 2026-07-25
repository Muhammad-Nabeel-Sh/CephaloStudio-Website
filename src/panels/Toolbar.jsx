import { clamp } from "../lib/utils.js";
import ToolBtn from "../ui/ToolBtn.jsx";

export default function Toolbar({
  activeTool, theme, t, dispatch, setActiveTool,
  sessionImage, calibration, zoom, spotlightMode, updSession,
  isMobile, showMobilePanel,
  panRef,
  undo, redo, undoVersion, undoStackRef, redoStackRef,
  handleDblClick, currentDraw,
  mobileToolsExpanded,
}) {
  if (isMobile && !showMobilePanel) {
    const selTool = (id) => {
      dispatch({ type: "SET", payload: { activeTool: id } });
      dispatch({ type: "SET", payload: { currentDraw: null } });
      dispatch({ type: "SET", payload: { mobileToolsExpanded: false } });
    };
    // eslint-disable-next-line react-hooks/refs
    const canUndo = undoVersion >= 0 && undoStackRef.current.length > 0;
    // eslint-disable-next-line react-hooks/refs
    const canRedo = undoVersion >= 0 && redoStackRef.current.length > 0;
    const primaryTools = [
      { id: "select", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mouse-pointer2-icon lucide-mouse-pointer-2"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/></svg>, label: "Select" }, 
      { id: "pan", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pointer-icon lucide-pointer"><path d="M22 14a8 8 0 0 1-8 8"/><path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1"/><path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>, label: "Pan" }, 
      { id: "point", icon: "◉", label: "Landmark" },
      { id: "line", icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-line"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M4 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M16 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M7.5 16.5l9 -9" /></svg>, label: "Line" }, 
      { id: "angle3", icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-angle"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M21 19h-18l9 -15" /><path d="M20.615 15.171h.015" /><path d="M19.515 11.771h.015" /><path d="M17.715 8.671h.015" /><path d="M15.415 5.971h.015" /></svg>, label: "Angle 3" }, 
      { id: "ruler", icon: <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}><path d="M160-240q-33 0-56.5-23.5T80-320v-320q0-33 23.5-56.5T160-720h640q33 0 56.5 23.5T880-640v320q0 33-23.5 56.5T800-240H160Zm0-80h640v-320H680v160h-80v-160h-80v160h-80v-160h-80v160h-80v-160H160v320Zm120-160h80-80Zm160 0h80-80Zm160 0h80-80Zm-120 0Z" /></svg>, label: "Ruler" }, 
      { id: "arrow", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-move-up-right-icon lucide-move-up-right"><path d="M13 5H19V11"/><path d="M19 5L5 19"/></svg>, label: "Arrow" }
    ];
    const secondaryTools = [
      [{ id: "midpoint", icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-circuit-bulb"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M2 12h5" /><path d="M17 12h5" /><path d="M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" /><path d="M8.5 8.5l7 7" /><path d="M15.5 8.5l-7 7" /></svg>, label: "Midpoint" }, 
        { id: "angle4", icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-arrows-cross"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M16 4h4v4" /><path d="M15 9l5 -5" /><path d="M4 20l5 -5" /><path d="M16 20h4v-4" /><path d="M4 4l16 16" /></svg>, label: "Angle 4" }],
      [{ id: "parallel", icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-arrows-right"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M21 17l-18 0" /><path d="M18 4l3 3l-3 3" /><path d="M18 20l3 -3l-3 -3" /><path d="M21 7l-18 0" /></svg>, label: "Parallel" }, 
        { id: "perppoint", icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-letter-l"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M7 4v16h10" /></svg>, label: "Perp Pt" }],
      [{ id: "perp", icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-external-link-off"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /><path d="M10 14l2 -2m2.007 -2.007l6 -6" /><path d="M15 4h5v5" /><path d="M3 3l18 18" /></svg>, label: "Perp Dist" }, 
        { id: "text", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-type-outline-icon lucide-type-outline"><path d="M14 16.5a.5.5 0 0 0 .5.5h.5a2 2 0 0 1 0 4H9a2 2 0 0 1 0-4h.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5V8a2 2 0 0 1-4 0V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-4 0v-.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5Z"/></svg>, label: "Text" }],
      [{ id: "curve", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-spline-icon lucide-spline"><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><path d="M5 17A12 12 0 0 1 17 5"/></svg>, label: "Curve" },
        { id: "polyline", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4,18 8,8 14,14 20,4"/></svg>, label: "Polyline" }],
      [{ id: "polygon", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-hexagon-icon lucide-hexagon"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>, label: "Polygon" },
        { id: "bezier", icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-vector-bezier-2"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M3 4a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2" /><path d="M17 18a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2" /><path d="M7 5l7 0" /><path d="M10 19l7 0" /><path d="M8 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M14 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M7 5.5a5 6.5 0 0 1 5 6.5a5 6.5 0 0 0 5 6.5" /></svg>, label: "Bezier" }],
      [{ id: "tangent", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-tangent-icon lucide-tangent"><circle cx="17" cy="4" r="2"/><path d="M15.59 5.41 5.41 15.59"/><circle cx="4" cy="17" r="2"/><path d="M12 22s-4-9-1.5-11.5S22 12 22 12"/></svg>, label: "Tangent" }, 
        { id: "concentric", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-rainbow-icon lucide-rainbow"><path d="M22 17a10 10 0 0 0-20 0"/><path d="M6 17a6 6 0 0 1 12 0"/><path d="M10 17a2 2 0 0 1 4 0"/></svg>, label: "Concentric" }],
      [{ id: "mirror", icon: "⌈⌉", label: "Mirror" }],
    ];
    return (<>
      {/* Collapsed bar — horizontal scroll row */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 52, display: "flex", alignItems: "center", borderTop: `1px solid ${t.bdr}`, zIndex: 20, background: t.surf, padding: "0 4px", gap: 2, overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {primaryTools.map(tool => (
          <ToolBtn key={tool.id} tool={tool} active={activeTool === tool.id} onClick={() => selTool(tool.id)} theme={theme} t={t} style={{ flexShrink: 0 }} />
        ))}
        <div style={{ width: 1, height: 28, background: t.bdr, flexShrink: 0 }} />
        <button onClick={undo} disabled={!canUndo} aria-label="Undo" style={{ width: 42, height: 42, borderRadius: 8, border: "none", background: "transparent", color: canUndo ? t.tx2 : t.bdr, cursor: canUndo ? "pointer" : "not-allowed", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Undo">↶</button>
        <button onClick={redo} disabled={!canRedo} aria-label="Redo" style={{ width: 42, height: 42, borderRadius: 8, border: "none", background: "transparent", color: canRedo ? t.tx2 : t.bdr, cursor: canRedo ? "pointer" : "not-allowed", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Redo">↷</button>
        <div style={{ width: 1, height: 28, background: t.bdr, flexShrink: 0 }} />
        <button onClick={() => dispatch({ type: "SET", payload: { zoom: z => clamp(z * 1.3, 0.05, 15) } })} aria-label="Zoom In" style={{ width: 42, height: 42, borderRadius: 8, border: "none", background: "transparent", color: t.tx2, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>＋</button>
        <button onClick={() => dispatch({ type: "SET", payload: { zoom: z => clamp(z / 1.3, 0.05, 15) } })} aria-label="Zoom Out" style={{ width: 42, height: 42, borderRadius: 8, border: "none", background: "transparent", color: t.tx2, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>－</button>
        <button onClick={() => { dispatch({ type: "SET", payload: { zoom: 1 } }); panRef.current = { x: 40, y: 40 }; dispatch({ type: "SET", payload: { pan: { x: 40, y: 40 } } }); }} aria-label="Fit" style={{ width: 42, height: 42, borderRadius: 8, border: "none", background: "transparent", color: t.tx2, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>⊙</button>
        <div style={{ width: 1, height: 28, background: t.bdr, flexShrink: 0 }} />
        <button onClick={() => dispatch({ type: "SET", payload: { mobileToolsExpanded: v => !v } })} aria-label="More tools" style={{ width: 42, height: 42, borderRadius: 8, border: "none", background: mobileToolsExpanded ? t.acc : t.surf2, color: mobileToolsExpanded ? (theme === "light" ? "#fff" : t.bg) : t.tx, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: mobileToolsExpanded ? `0 0 0 2px ${t.acc}` : "none" }} title="More tools">⋯</button>
        {currentDraw && ["polygon", "curve", "polyline"].includes(activeTool) && (<> 
          <div style={{ width: 1, height: 28, background: t.bdr, flexShrink: 0 }} />
          <button onClick={handleDblClick} aria-label="Finish shape" style={{ width: 42, height: 42, borderRadius: 8, border: "none", background: t.ok, color: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Finish">✓</button>
        </>)}
      </div>
      {/* Expanded bottom sheet — full tool grid */}
      {mobileToolsExpanded && (<>
        <div onClick={() => dispatch({ type: "SET", payload: { mobileToolsExpanded: false } })} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 19 }} />
        <div style={{ position: "fixed", bottom: 52, left: 0, right: 0, maxHeight: "55vh", background: t.surf, borderTop: `1px solid ${t.bdr}`, borderRadius: "12px 12px 0 0", zIndex: 20, overflowY: "auto", padding: "12px 8px 16px", boxShadow: `0 -4px 20px ${t.shadow}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "0 8px" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.tx2, fontFamily: "'DM Sans',sans-serif" }}>All Tools</span>
            <span style={{ fontSize: 9, color: t.tx3, fontFamily: "'DM Mono',monospace" }}>{(zoom * 100).toFixed(0)}%{calibration.done ? ` · ⟺${calibration.pxPerMm.toFixed(1)}` : ""}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {secondaryTools.map((row) => row.map(tool => (
              <ToolBtn key={tool.id} tool={tool} active={activeTool === tool.id} onClick={() => selTool(tool.id)} theme={theme} t={t} style={{ flex: 1, height: 46 }} />
            )))}
          </div>
        </div>
      </>)}
    </>);
  }

  return (
    <div style={{ width: 100, background: t.surf, display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 4px", gap: 1, flexShrink: 0, overflowY: "auto", scrollbarWidth: "thin" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
        {/* Row 1: Select | Pan */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "select", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mouse-pointer2-icon lucide-mouse-pointer-2"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/></svg>, label: "Select/Move" }} active={activeTool === "select"} onClick={() => { dispatch({ type: "SET", payload: { activeTool: "select" } }); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "pan", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pointer-icon lucide-pointer"><path d="M22 14a8 8 0 0 1-8 8"/><path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1"/><path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>, label: "Pan" }} active={activeTool === "pan"} onClick={() => { dispatch({ type: "SET", payload: { activeTool: "pan" } }); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 2: Landmark | Midpoint */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "point", icon: "◉", label: "Landmark" }} active={activeTool === "point"} onClick={() => { dispatch({ type: "SET", payload: { activeTool: "point" } }); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "midpoint", icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-circuit-bulb"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M2 12h5" /><path d="M17 12h5" /><path d="M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" /><path d="M8.5 8.5l7 7" /><path d="M15.5 8.5l-7 7" /></svg>, label: "Midpoint" }} active={activeTool === "midpoint"} onClick={() => { setActiveTool("midpoint"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 3: Line | Parallel */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "line", icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-line"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M4 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M16 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M7.5 16.5l9 -9" /></svg>, label: "Line" }} active={activeTool === "line"} onClick={() => { dispatch({ type: "SET", payload: { activeTool: "line" } }); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "parallel", icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-arrows-right"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M21 17l-18 0" /><path d="M18 4l3 3l-3 3" /><path d="M18 20l3 -3l-3 -3" /><path d="M21 7l-18 0" /></svg>, label: "Parallel" }} active={activeTool === "parallel"} onClick={() => { dispatch({ type: "SET", payload: { activeTool: "parallel" } }); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 4: Perp Point | Perp Dist */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "perppoint", icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-letter-l"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M7 4v16h10" /></svg>, label: "Perp Point" }} active={activeTool === "perppoint"} onClick={() => { setActiveTool("perppoint"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "perp", icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-external-link-off"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /><path d="M10 14l2 -2m2.007 -2.007l6 -6" /><path d="M15 4h5v5" /><path d="M3 3l18 18" /></svg>, label: "Perp Dist" }} active={activeTool === "perp"} onClick={() => { dispatch({ type: "SET", payload: { activeTool: "perp" } }); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 5: Angle3pt | Angle4pt */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "angle3", icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-angle"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M21 19h-18l9 -15" /><path d="M20.615 15.171h.015" /><path d="M19.515 11.771h.015" /><path d="M17.715 8.671h.015" /><path d="M15.415 5.971h.015" /></svg>, label: "Angle 3-pt" }} active={activeTool === "angle3"} onClick={() => { setActiveTool("angle3"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "angle4", icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-arrows-cross"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M16 4h4v4" /><path d="M15 9l5 -5" /><path d="M4 20l5 -5" /><path d="M16 20h4v-4" /><path d="M4 4l16 16" /></svg>, label: "Angle 4-pt" }} active={activeTool === "angle4"} onClick={() => { setActiveTool("angle4"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
         {/* Row 6a: Polyline | Polygon */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "polyline", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-waypoints-icon lucide-waypoints"><path d="m10.586 5.414-5.172 5.172"/><path d="m18.586 13.414-5.172 5.172"/><path d="M6 12h12"/><circle cx="12" cy="20" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="20" cy="12" r="2"/><circle cx="4" cy="12" r="2"/></svg>, label: "Polyline" }} active={activeTool === "polyline"} onClick={() => { setActiveTool("polyline"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "polygon", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-hexagon-icon lucide-hexagon"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>, label: "Polygon" }} active={activeTool === "polygon"} onClick={() => { setActiveTool("polygon"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 6b: Curve | Bezier */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "curve", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-spline-icon lucide-spline"><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><path d="M5 17A12 12 0 0 1 17 5"/></svg>, label: "Curve" }} active={activeTool === "curve"} onClick={() => { setActiveTool("curve"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "bezier", icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-vector-bezier-2"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M3 4a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2" /><path d="M17 18a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2" /><path d="M7 5l7 0" /><path d="M10 19l7 0" /><path d="M8 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M14 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M7 5.5a5 6.5 0 0 1 5 6.5a5 6.5 0 0 0 5 6.5" /></svg>, label: "Bezier" }} active={activeTool === "bezier"} onClick={() => { setActiveTool("bezier"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 7: Arrow | Text */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "arrow", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-move-up-right-icon lucide-move-up-right"><path d="M13 5H19V11"/><path d="M19 5L5 19"/></svg>, label: "Arrow" }} active={activeTool === "arrow"} onClick={() => { setActiveTool("arrow"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "text", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-type-outline-icon lucide-type-outline"><path d="M14 16.5a.5.5 0 0 0 .5.5h.5a2 2 0 0 1 0 4H9a2 2 0 0 1 0-4h.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5V8a2 2 0 0 1-4 0V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-4 0v-.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5Z"/></svg>, label: "Text" }} active={activeTool === "text"} onClick={() => { setActiveTool("text"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 7b: Circle | Polygon */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "circle", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-radius-icon lucide-radius"><path d="M20.34 17.52a10 10 0 1 0-2.82 2.82"/><circle cx="19" cy="19" r="2"/><path d="m13.41 13.41 4.18 4.18"/><circle cx="12" cy="12" r="2"/></svg> , label: "Circle" }} active={activeTool === "circle"} onClick={() => { setActiveTool("circle"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
           <ToolBtn tool={{ id: "ellipse", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-ellipse-icon lucide-ellipse"><ellipse cx="12" cy="12" rx="10" ry="6"/></svg> , label: "Ellipse" }} active={activeTool === "ellipse"} onClick={() => { setActiveTool("ellipse"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 7c: Tangent | Arc */}
        <div style={{ display: "flex", gap: 1 }}>
         <ToolBtn tool={{ id: "tangent", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-tangent-icon lucide-tangent"><circle cx="17" cy="4" r="2"/><path d="M15.59 5.41 5.41 15.59"/><circle cx="4" cy="17" r="2"/><path d="M12 22s-4-9-1.5-11.5S22 12 22 12"/></svg>, label: "Tangent" }} active={activeTool === "tangent"} onClick={() => { setActiveTool("tangent"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "arc", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-drafting-compass-icon lucide-drafting-compass"><path d="m12.99 6.74 1.93 3.44"/><path d="M19.136 12a10 10 0 0 1-14.271 0"/><path d="m21 21-2.16-3.84"/><path d="m3 21 8.02-14.26"/><circle cx="12" cy="5" r="2"/></svg>, label: "Arc" }} active={activeTool === "arc"} onClick={() => { setActiveTool("arc"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 7d: Concentric  | Mirror*/}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "concentric", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-rainbow-icon lucide-rainbow"><path d="M22 17a10 10 0 0 0-20 0"/><path d="M6 17a6 6 0 0 1 12 0"/><path d="M10 17a2 2 0 0 1 4 0"/></svg>, label: "Concentric" }} active={activeTool === "concentric"} onClick={() => { setActiveTool("concentric"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "mirror", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-flip-horizontal2-icon lucide-flip-horizontal-2"><path d="m3 7 5 5-5 5V7"/><path d="m21 7-5 5 5 5V7"/><path d="M12 20v2"/><path d="M12 14v2"/><path d="M12 8v2"/><path d="M12 2v2"/></svg>, label: "Mirror" }} active={activeTool === "mirror"} onClick={() => { setActiveTool("mirror"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 8: Ruler (centered) */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ToolBtn tool={{ id: "ruler", icon: <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}><path d="M160-240q-33 0-56.5-23.5T80-320v-320q0-33 23.5-56.5T160-720h640q33 0 56.5 23.5T880-640v320q0 33-23.5 56.5T800-240H160Zm0-80h640v-320H680v160h-80v-160h-80v160h-80v-160h-80v160h-80v-160H160v320Zm120-160h80-80Zm160 0h80-80Zm160 0h80-80Zm-120 0Z" /></svg>, label: "Ruler" }} active={activeTool === "ruler"} onClick={() => { setActiveTool("ruler"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} />
        </div>
        {/* Row 8b: Spotlight mode */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button onClick={() => { const next = !spotlightMode; dispatch({ type: "SET", payload: { spotlightMode: next } }); if (sessionImage.length > 0) { const img = sessionImage[0]; const upd = next ? { ...img, opacityBeforeSpotlight: img.opacity || 1, opacity: 0.5 } : { ...img, opacity: img.opacityBeforeSpotlight || 1 }; updSession({ images: sessionImage.map((x, i) => i === 0 ? upd : x) }); } }} title="Spotlight (reduce image opacity)" aria-label="Spotlight" style={{ width: 42, height: 42, borderRadius: 8, border: "none", background: spotlightMode ? t.acc : t.surf2, color: spotlightMode ? (theme === "light" ? "#fff" : t.bg) : t.tx, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: spotlightMode ? `0 0 0 2px ${t.acc}` : "none" }}>💡</button>
        </div>
        {/* Separator */}
        <div style={{ width: "100%", height: 1, background: t.bdr, margin: "4px 0" }} />
        {/* Row 9: Undo | Redo */}
        {(() => {
          // eslint-disable-next-line react-hooks/refs
          const canUndo = undoVersion >= 0 && undoStackRef.current.length > 0;
          // eslint-disable-next-line react-hooks/refs
          const canRedo = undoVersion >= 0 && redoStackRef.current.length > 0; return (
          <div style={{ display: "flex", gap: 1 }}>
            <button onClick={undo} disabled={!canUndo} aria-label="Undo (Ctrl+Z)" style={{ flex: 1, height: 32, borderRadius: 6, border: "none", background: "transparent", color: canUndo ? t.tx2 : t.bdr, cursor: canUndo ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Undo (Ctrl+Z)"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-undo-icon lucide-undo"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg></button>
            <button onClick={redo} disabled={!canRedo} aria-label="Redo (Ctrl+Y)" style={{ flex: 1, height: 32, borderRadius: 6, border: "none", background: "transparent", color: canRedo ? t.tx2 : t.bdr, cursor: canRedo ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Redo (Ctrl+Y)"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-redo-icon lucide-redo"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg></button>
          </div>); })()}
        {/* Row 10: Zoom in | Zoom out */}
        <div style={{ display: "flex", gap: 1 }}>
          <button onClick={() => dispatch({ type: "SET", payload: { zoom: z => clamp(z * 1.3, 0.05, 15) } })} aria-label="Zoom In" style={{ flex: 1, height: 32, borderRadius: 6, border: "none", background: "transparent", color: t.tx2, cursor: "pointer", fontSize: 18,fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Zoom In">＋</button>
          <button onClick={() => dispatch({ type: "SET", payload: { zoom: z => clamp(z / 1.3, 0.05, 15) } })} aria-label="Zoom Out" style={{ flex: 1, height: 32, borderRadius: 6, border: "none", background: "transparent", color: t.tx2, cursor: "pointer", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Zoom Out">－</button>
        </div>
        {/* Row 11: Fit to Window */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button onClick={() => { dispatch({ type: "SET", payload: { zoom: 1 } }); panRef.current = { x: 40, y: 40 }; dispatch({ type: "SET", payload: { pan: { x: 40, y: 40 } } }); }} aria-label="Fit to Window" style={{ width: 38, height: 32, borderRadius: 6, border: "none", background: "transparent", color: t.tx2, cursor: "pointer", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Fit to Window (⊙)">⊙</button>
        </div>
        {/* Separator */}
        <div style={{ width: "100%", height: 1, background: t.bdr, margin: "4px 0" }} />
        {/* Cal indicator */}
        {/* {calibration.done && <div style={{ display: "flex", justifyContent: "center" }}><div style={{ fontSize: 8, color: t.ok, fontFamily: "'DM Mono',monospace", fontWeight: 700, textAlign: "center", padding: "2px 0" }}>⟺{calibration.pxPerMm.toFixed(1)}</div></div>} */}
        {/* Zoom % */}
        <div style={{ display: "flex", justifyContent: "center" }}><div style={{ fontSize: 14, color: t.tx3, fontFamily: "'DM Mono',monospace", textAlign: "center", padding: "2px 0" }}>{(zoom * 100).toFixed(0)}%</div></div>
      </div>
    </div>
  );
}
