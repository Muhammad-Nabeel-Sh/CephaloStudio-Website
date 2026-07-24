import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { EXAMPLE_LIST, getExampleData } from "../data/examplesData.js";
import { drawMarkup } from "../canvas/drawMarkups.js";

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
        <div style={{ fontSize:28,marginBottom:6,opacity:0.8 }}>&#x1F6A7;</div>
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
            <div style={{ width: 36, height: 36, borderRadius: 6, background: t.surf3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>&#x1F4CB;</div>
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
          <span style={{ fontSize: 16 }}>&#x1F4CB;</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>Example: {data?.name || "Template Preview"}</div>
            <div style={{ fontSize: 10, color: t.tx2 }}>{data?.markups?.length || 0} markups · {data?.projection || ""} projection</div>
          </div>
          <span style={{ fontSize: 9, color: t.tx3, fontFamily: "'DM Mono',monospace" }}>{data?.markups?.filter(m => m.type === "point").length || 0} pts</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
            <button onClick={zoomOut} title="Zoom out" style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, color: t.tx2, cursor: "pointer", fontSize: 14, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>&#x2212;</button>
            <span style={{ fontSize: 10, color: t.tx3, fontFamily: "'DM Mono',monospace", minWidth: 32, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button onClick={zoomIn} title="Zoom in" style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, color: t.tx2, cursor: "pointer", fontSize: 14, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            <button onClick={handleDblClick} title="Reset view" style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, color: t.tx2, cursor: "pointer", fontSize: 12, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>&#x2299;</button>
          </div>
          <button onClick={onClose} title="Close" style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 4px" }}>&times;</button>
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
