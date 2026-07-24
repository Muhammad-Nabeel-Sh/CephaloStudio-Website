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
      { id: "select", icon: "⊹", label: "Select" }, { id: "pan", icon: "⊕", label: "Pan" }, { id: "point", icon: "◉", label: "Landmark" },
      { id: "line", icon: "⟋", label: "Line" }, { id: "angle3", icon: "∠", label: "Angle 3" }, { id: "ruler", icon: "⟺", label: "Ruler" }, { id: "arrow", icon: "→", label: "Arrow" }
    ];
    const secondaryTools = [
      [{ id: "midpoint", icon: "◈", label: "Midpoint" }, { id: "angle4", icon: "∡", label: "Angle 4" }],
      [{ id: "parallel", icon: "⫿", label: "Parallel" }, { id: "perppoint", icon: "⊦", label: "Perp Pt" }],
      [{ id: "perp", icon: "⊥", label: "Perp Dist" }, { id: "text", icon: "T", label: "Text" }],
      [{ id: "curve", icon: "∿", label: "Curve" }, { id: "polygon", icon: "⬡", label: "Polygon" }],
      [{ id: "ellipse", icon: "◯", label: "Ellipse" }, { id: "arc", icon: "◠", label: "Arc" }],
      [{ id: "circle", icon: "⊙", label: "Circle" }, { id: "bezier", icon: "≂", label: "Bezier" }],
      [{ id: "tangent", icon: "⊸", label: "Tangent" }, { id: "concentric", icon: "◎", label: "Concentric" }],
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
        {currentDraw && ["polygon", "curve"].includes(activeTool) && (<>
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
    <div style={{ width: 88, background: t.surf, display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 4px", gap: 1, flexShrink: 0, overflowY: "auto", scrollbarWidth: "thin" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, width: "100%" }}>
        {/* Row 1: Select | Pan */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "select", icon: "⊹", label: "Select/Move" }} active={activeTool === "select"} onClick={() => { dispatch({ type: "SET", payload: { activeTool: "select" } }); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "pan", icon: "⊕", label: "Pan" }} active={activeTool === "pan"} onClick={() => { dispatch({ type: "SET", payload: { activeTool: "pan" } }); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 2: Landmark | Midpoint */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "point", icon: "◉", label: "Landmark" }} active={activeTool === "point"} onClick={() => { dispatch({ type: "SET", payload: { activeTool: "point" } }); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "midpoint", icon: "◈", label: "Midpoint" }} active={activeTool === "midpoint"} onClick={() => { setActiveTool("midpoint"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 3: Line | Parallel */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "line", icon: "⟋", label: "Line" }} active={activeTool === "line"} onClick={() => { dispatch({ type: "SET", payload: { activeTool: "line" } }); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "parallel", icon: "⫿", label: "Parallel" }} active={activeTool === "parallel"} onClick={() => { dispatch({ type: "SET", payload: { activeTool: "parallel" } }); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 4: Perp Point | Perp Dist */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "perppoint", icon: "⊦", label: "Perp Point" }} active={activeTool === "perppoint"} onClick={() => { setActiveTool("perppoint"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "perp", icon: "⊥", label: "Perp Dist" }} active={activeTool === "perp"} onClick={() => { dispatch({ type: "SET", payload: { activeTool: "perp" } }); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 5: Angle3pt | Angle4pt */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "angle3", icon: "∠", label: "Angle 3-pt" }} active={activeTool === "angle3"} onClick={() => { setActiveTool("angle3"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "angle4", icon: "∡", label: "Angle 4-pt" }} active={activeTool === "angle4"} onClick={() => { setActiveTool("angle4"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 6: Polygon | Curve */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "polygon", icon: "⬡", label: "Polygon" }} active={activeTool === "polygon"} onClick={() => { setActiveTool("polygon"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "curve", icon: "∿", label: "Curve" }} active={activeTool === "curve"} onClick={() => { setActiveTool("curve"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 7: Arrow | Text */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "arrow", icon: "→", label: "Arrow" }} active={activeTool === "arrow"} onClick={() => { setActiveTool("arrow"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "text", icon: "T", label: "Text" }} active={activeTool === "text"} onClick={() => { setActiveTool("text"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 7b: Ellipse | Arc */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "ellipse", icon: "◯", label: "Ellipse" }} active={activeTool === "ellipse"} onClick={() => { setActiveTool("ellipse"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "arc", icon: "◠", label: "Arc" }} active={activeTool === "arc"} onClick={() => { setActiveTool("arc"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 7c: Circle | Bezier */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "circle", icon: "⊙", label: "Circle" }} active={activeTool === "circle"} onClick={() => { setActiveTool("circle"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "bezier", icon: "≂", label: "Bezier" }} active={activeTool === "bezier"} onClick={() => { setActiveTool("bezier"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 7d: Tangent | Concentric */}
        <div style={{ display: "flex", gap: 1 }}>
          <ToolBtn tool={{ id: "tangent", icon: "⊸", label: "Tangent" }} active={activeTool === "tangent"} onClick={() => { setActiveTool("tangent"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
          <ToolBtn tool={{ id: "concentric", icon: "◎", label: "Concentric" }} active={activeTool === "concentric"} onClick={() => { setActiveTool("concentric"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} style={{ flex: 1 }} />
        </div>
        {/* Row 8: Ruler (centered) */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ToolBtn tool={{ id: "ruler", icon: "⟺", label: "Ruler" }} active={activeTool === "ruler"} onClick={() => { setActiveTool("ruler"); dispatch({ type: "SET", payload: { currentDraw: null } }); }} theme={theme} t={t} />
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
            <button onClick={undo} disabled={!canUndo} aria-label="Undo (Ctrl+Z)" style={{ flex: 1, height: 32, borderRadius: 6, border: "none", background: "transparent", color: canUndo ? t.tx2 : t.bdr, cursor: canUndo ? "pointer" : "not-allowed", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Undo (Ctrl+Z)">↶</button>
            <button onClick={redo} disabled={!canRedo} aria-label="Redo (Ctrl+Y)" style={{ flex: 1, height: 32, borderRadius: 6, border: "none", background: "transparent", color: canRedo ? t.tx2 : t.bdr, cursor: canRedo ? "pointer" : "not-allowed", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Redo (Ctrl+Y)">↷</button>
          </div>); })()}
        {/* Row 10: Zoom in | Zoom out */}
        <div style={{ display: "flex", gap: 1 }}>
          <button onClick={() => dispatch({ type: "SET", payload: { zoom: z => clamp(z * 1.3, 0.05, 15) } })} aria-label="Zoom In" style={{ flex: 1, height: 32, borderRadius: 6, border: "none", background: "transparent", color: t.tx2, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Zoom In">＋</button>
          <button onClick={() => dispatch({ type: "SET", payload: { zoom: z => clamp(z / 1.3, 0.05, 15) } })} aria-label="Zoom Out" style={{ flex: 1, height: 32, borderRadius: 6, border: "none", background: "transparent", color: t.tx2, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Zoom Out">－</button>
        </div>
        {/* Row 11: Fit to Window */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button onClick={() => { dispatch({ type: "SET", payload: { zoom: 1 } }); panRef.current = { x: 40, y: 40 }; dispatch({ type: "SET", payload: { pan: { x: 40, y: 40 } } }); }} aria-label="Fit to Window" style={{ width: 38, height: 32, borderRadius: 6, border: "none", background: "transparent", color: t.tx2, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Fit to Window (⊙)">⊙</button>
        </div>
        {/* Separator */}
        <div style={{ width: "100%", height: 1, background: t.bdr, margin: "4px 0" }} />
        {/* Cal indicator */}
        {calibration.done && <div style={{ display: "flex", justifyContent: "center" }}><div style={{ fontSize: 8, color: t.ok, fontFamily: "'DM Mono',monospace", fontWeight: 700, textAlign: "center", padding: "2px 0" }}>⟺{calibration.pxPerMm.toFixed(1)}</div></div>}
        {/* Zoom % */}
        <div style={{ display: "flex", justifyContent: "center" }}><div style={{ fontSize: 9, color: t.tx3, fontFamily: "'DM Mono',monospace", textAlign: "center", padding: "2px 0" }}>{(zoom * 100).toFixed(0)}%</div></div>
      </div>
    </div>
  );
}
