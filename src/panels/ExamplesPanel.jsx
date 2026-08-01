import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { EXAMPLE_LIST, getExampleData, buildGuideSteps } from "../data/examplesData.js";
import { drawMarkup } from "../canvas/drawMarkups.js";

function titleCase(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function withAlpha(hex, alpha) {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, "0");
}

function dimCopy(m, alpha = 0.12) {
  const c = withAlpha(m.color || "#888888", alpha);
  return { ...m, color: c, strokeColor: c, fillColor: c };
}

function drawGuidePulse(ctx, m, zoom, pan, idx, anim) {
  const p = m.points?.[0];
  if (!p) return;
  const sp = { x: p.x * zoom + pan.x, y: p.y * zoom + pan.y };
  const pr = 3 * zoom;
  const t = ((anim || 0) % 1400) / 1400;
  const r = pr + 8 + t * 18;
  const op = 0.85 * (1 - t);
  ctx.save();
  ctx.strokeStyle = `rgba(255,200,60,${op})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = `rgba(255,200,60,${op * 0.4})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(sp.x, sp.y, r + 10, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#ffc83c";
  ctx.beginPath(); ctx.arc(sp.x, sp.y, pr + 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `bold ${Math.max(8, 1.5 * zoom)}px "DM Mono",monospace`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(String(idx + 1), sp.x, sp.y + 0.5);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.restore();
}

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
    <div style={{ padding: 12 }}>
      {data && (
        <ExampleViewerModal
          t={t}
          data={data}
          onClose={() => setData(null)}
        />
      )}
      <div style={{ fontSize: 11, color: t.tx2, marginBottom: 12, lineHeight: 1.5 }}>
        Browse worked examples and interactive illustrations. Click <strong>View</strong> to explore the tracing on canvas — hover any point to read its definition.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {EXAMPLE_LIST.map(ex => (
          <div key={ex.id} onClick={() => openExample(ex.id)}
            style={{ padding: 12, borderRadius: 8, background: t.surf2, border: `1px solid ${t.bdr}`, cursor: "pointer", display: "flex", flexDirection: "column", gap: 6, transition: "border-color 0.15s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 6, background: t.surf3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>&#x1F4CB;</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex.label}</div>
                <div style={{ fontSize: 10, color: t.tx2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex.subtitle}</div>
              </div>
              <button onClick={e => { e.stopPropagation(); openExample(ex.id); }}
                style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf3, color: t.tx, fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                View
              </button>
            </div>
            {ex.analysisName && (
              <span style={{ alignSelf: "flex-start", fontSize: 9, color: t.acc, background: `${t.acc}22`, padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                {ex.analysisName}
              </span>
            )}
            {ex.description && (
              <div style={{ fontSize: 10, color: t.tx2, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {ex.description}
              </div>
            )}
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
  const [activeGroup, setActiveGroup] = useState(null);
  const [mode, setMode] = useState("browse");
  const [guideIdx, setGuideIdx] = useState(0);
  const guideAnimRef = useRef(0);

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

  // Teaching groups present in the example (from optional `group` on point markups)
  const groups = useMemo(() => {
    if (!data?.markups) return [];
    const map = new Map();
    for (const m of data.markups) {
      if (m.type !== "point" || !m.group) continue;
      const g = map.get(m.group) || { id: m.group, color: m.color || t.acc, count: 0 };
      g.count++;
      map.set(m.group, g);
    }
    return [...map.values()];
  }, [data, t]);

  const groupColor = useCallback(gid => {
    const g = groups.find(g => g.id === gid);
    return g ? g.color : t.acc;
  }, [groups, t]);

  // Guide-mode steps: placed points walked group by group
  const guideSteps = useMemo(() => buildGuideSteps(data?.markups), [data]);
  const currentStep = mode === "guide" ? (guideSteps[guideIdx] || null) : null;

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

  // Guide mode: focus the current step's point on step change
  const focusOnPoint = useCallback(pt => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r || !pt?.points?.[0]) return;
    const p = pt.points[0];
    const gz = Math.min(Math.max(zoom, 1.7), 6);
    setZoom(gz);
    setPan({ x: r.width / 2 - p.x * gz, y: r.height / 2 - p.y * gz });
  }, [zoom]);

  useEffect(() => {
    if (mode !== "guide") return;
    const pt = guideSteps[guideIdx];
    if (!pt) return;
    const raf = requestAnimationFrame(() => focusOnPoint(pt));
    return () => cancelAnimationFrame(raf);
  }, [mode, guideIdx, guideSteps, focusOnPoint]);

  // Guide mode: arrow-key navigation
  useEffect(() => {
    if (mode !== "guide") return;
    const onKey = e => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); setGuideIdx(i => Math.min(i + 1, guideSteps.length - 1)); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setGuideIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === "Escape") setMode("browse");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, guideSteps.length]);

  // Point definition tooltip on hover
  const renderTooltip = useCallback((ctx, W) => {
    if (!hoveredPt || !data?.markups) return;
    const hp = data.markups.find(m => m.id === hoveredPt.mid);
    if (!hp) return;
    const pts = hp.points || [];
    if (!pts.length) return;
    const sp = { x: pts[0].x * zoom + pan.x, y: pts[0].y * zoom + pan.y };
    const hasGroup = !!hp.group;
    const gColor = hp.color || t.acc;
    const tipW = Math.max(120, Math.min(340, W - sp.x - 20));
    if (tipW < 60) return;
    const wrap = text => {
      const out = []; let line = "";
      ctx.font = '11px "DM Sans",sans-serif';
      for (const word of text.split(" ")) {
        const test = line ? line + " " + word : word;
        if (ctx.measureText(test).width > tipW - 24 && line) { out.push(line); line = word; } else line = test;
      }
      if (line) out.push(line);
      return out;
    };
    const defLines = hp.definition ? wrap(hp.definition) : [];
    const hintLines = hp.hint ? wrap(hp.hint) : [];
    const hintH = hintLines.length ? 8 + 13 + hintLines.length * 15 : 0;
    const tipH = Math.max(54, 30 + (hasGroup ? 17 : 0) + (defLines.length ? 6 : 0) + defLines.length * 15 + hintH);
    let tx = sp.x + 14, ty = sp.y - 10;
    if (tx + tipW > W - 8) tx = sp.x - tipW - 14;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2;
    ctx.fillStyle = t.surf2; ctx.beginPath(); ctx.roundRect(tx, ty, tipW, tipH, 8); ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = gColor; ctx.beginPath(); ctx.roundRect(tx, ty, tipW, 3, { upperLeft: 8, upperRight: 8 }); ctx.fill();
    const yy = ty + 20;
    if (hasGroup) {
      ctx.fillStyle = gColor; ctx.font = 'bold 9px "DM Sans",sans-serif';
      ctx.fillText(titleCase(hp.group), tx + 12, ty + 16);
    }
    ctx.fillStyle = t.tx; ctx.font = 'bold 12px "DM Sans",sans-serif';
    ctx.fillText(hp.label, tx + 12, yy + (hasGroup ? 2 : 6));
    let dy = yy + (hasGroup ? 20 : 24);
    if (defLines.length) {
      ctx.fillStyle = t.tx2; ctx.font = '11px "DM Sans",sans-serif';
      defLines.forEach((l, i) => ctx.fillText(l, tx + 12, dy + i * 15));
      dy += defLines.length * 15;
    }
    if (hintLines.length) {
      dy += 8;
      ctx.fillStyle = gColor; ctx.font = 'bold 10px "DM Sans",sans-serif';
      ctx.fillText("TIP", tx + 12, dy);
      dy += 13;
      ctx.fillStyle = t.tx3; ctx.font = '11px "DM Sans",sans-serif';
      hintLines.forEach((l, i) => ctx.fillText(l, tx + 12, dy + i * 15));
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
      const hoveredGroup = hoveredPt ? (data.markups.find(m => m.id === hoveredPt.mid)?.group || null) : null;
      const focusGroup = activeGroup || hoveredGroup;
      const guidePt = mode === "guide" ? (guideSteps[guideIdx] || null) : null;
      data.markups.forEach(m => {
        let mk = m;
        if (guidePt) {
          if (m.id !== guidePt.id) mk = dimCopy(m, m.type === "silhouette" ? 0.3 : 0.18);
        } else if (focusGroup && m.group !== focusGroup) {
          mk = dimCopy(m);
        }
        drawMarkup(ctx, mk, zoom, pan, cal, null, t, false, cs, "signed-deg", true, 1, null);
      });
      if (guidePt) drawGuidePulse(ctx, guidePt, zoom, pan, guideIdx, guideAnimRef.current);
    }
    renderTooltip(ctx, W);
    ctx.restore();
  }, [data, t, zoom, pan, renderTooltip, activeGroup, hoveredPt, mode, guideSteps, guideIdx]);

  // Guide mode: continuous pulse animation (runs after redraw is defined)
  useEffect(() => {
    if (mode !== "guide") return;
    let stop = false;
    const loop = () => {
      if (stop) return;
      guideAnimRef.current = performance.now();
      redraw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { stop = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
  }, [mode, redraw]);

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
            <div style={{ fontSize: 10, color: t.tx2 }}>{data?.markups?.length || 0} markups · {data?.projection || ""} projection{data?.author ? ` · by ${data.author}` : ""}</div>
          </div>
          <span style={{ fontSize: 9, color: t.tx3, fontFamily: "'DM Mono',monospace" }}>{data?.markups?.filter(m => m.type === "point").length || 0} pts</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
            <button onClick={() => { if (mode === "browse") { setGuideIdx(0); setMode("guide"); } else setMode("browse"); }}
              title={guideSteps.length ? (mode === "guide" ? "Exit guided placement" : "Step-by-step placement guide") : "No placed points to guide"}
              disabled={guideSteps.length === 0}
              style={{ background: mode === "guide" ? t.acc : t.surf3, color: mode === "guide" ? "#fff" : t.tx2, border: `1px solid ${t.bdr}`, borderRadius: 4, cursor: guideSteps.length ? "pointer" : "not-allowed", fontSize: 10, fontWeight: 700, height: 26, padding: "0 10px", opacity: guideSteps.length ? 1 : 0.5, whiteSpace: "nowrap" }}>
              {mode === "guide" ? "Browse" : "Guide"}
            </button>
            <button onClick={zoomOut} title="Zoom out" style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, color: t.tx2, cursor: "pointer", fontSize: 14, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>&#x2212;</button>
            <span style={{ fontSize: 10, color: t.tx3, fontFamily: "'DM Mono',monospace", minWidth: 32, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button onClick={zoomIn} title="Zoom in" style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, color: t.tx2, cursor: "pointer", fontSize: 14, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            <button onClick={handleDblClick} title="Reset view" style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, color: t.tx2, cursor: "pointer", fontSize: 12, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>&#x2299;</button>
          </div>
          <button onClick={onClose} title="Close" style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 4px" }}>&times;</button>
        </div>
        {data?.description && (
          <div style={{ padding: "8px 16px", fontSize: 11, color: t.tx2, lineHeight: 1.5, borderBottom: `1px solid ${t.bdr}`, flexShrink: 0 }}>
            {data.description}
          </div>
        )}
        {mode === "guide" && currentStep && (
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${t.bdr}`, background: `${t.surf2}80`, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setGuideIdx(i => Math.max(i - 1, 0))} disabled={guideIdx === 0} title="Previous landmark (←)"
                style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, color: t.tx2, cursor: guideIdx === 0 ? "not-allowed" : "pointer", fontSize: 13, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", opacity: guideIdx === 0 ? 0.4 : 1 }}>&#x2190;</button>
              <button onClick={() => setGuideIdx(i => Math.min(i + 1, guideSteps.length - 1))} disabled={guideIdx === guideSteps.length - 1} title="Next landmark (→)"
                style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, color: t.tx2, cursor: guideIdx === guideSteps.length - 1 ? "not-allowed" : "pointer", fontSize: 13, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", opacity: guideIdx === guideSteps.length - 1 ? 0.4 : 1 }}>&#x2192;</button>
              <span style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: t.tx3, minWidth: 74 }}>Step {guideIdx + 1} / {guideSteps.length}</span>
              <div style={{ flex: 1, position: "relative", height: 6, background: t.surf3, borderRadius: 3, overflow: "hidden", minWidth: 40 }}>
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${((guideIdx + 1) / guideSteps.length) * 100}%`, background: groupColor(currentStep.group), borderRadius: 3, transition: "width 0.2s" }} />
              </div>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: groupColor(currentStep.group), flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: t.tx2, fontWeight: 700, whiteSpace: "nowrap" }}>{titleCase(currentStep.group)}</span>
            </div>
            <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: groupColor(currentStep.group) }}>{currentStep.label}</span>
              {currentStep.definition && <span style={{ fontSize: 11, color: t.tx, lineHeight: 1.4 }}>{currentStep.definition}</span>}
            </div>
            {currentStep.hint && (
              <div style={{ marginTop: 6, fontSize: 11, color: t.tx3, lineHeight: 1.45, background: `${groupColor(currentStep.group)}14`, padding: "6px 9px", borderRadius: 6 }}>
                <span style={{ fontWeight: 700, color: groupColor(currentStep.group) }}>TIP: </span>{currentStep.hint}
              </div>
            )}
          </div>
        )}
        <div ref={containerRef} style={{ flex: 1, position: "relative", minHeight: 0 }}>
          <canvas ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={handleDblClick}
            style={{ display: "block", width: "100%", height: "100%", cursor: cursorStyle, touchAction: "none" }} />
          {mode !== "guide" && groups.length > 0 && (
            <div style={{ position: "absolute", top: 10, left: 10, zIndex: 3, background: `${t.surf2}e6`, border: `1px solid ${t.bdr}`, borderRadius: 8, padding: "7px 8px", display: "flex", flexDirection: "column", gap: 3, maxWidth: 170, boxShadow: `0 6px 16px ${t.shadow}40`, userSelect: "none" }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: t.tx2, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 2, marginLeft: 2 }}>Groups</div>
              {groups.map(g => {
                const on = activeGroup === g.id;
                const off = activeGroup && !on;
                return (
                  <div key={g.id} onClick={() => setActiveGroup(on ? null : g.id)} title={`Highlight ${g.id} landmarks`}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: t.tx, cursor: "pointer", padding: "3px 5px", borderRadius: 5, background: on ? `${g.color}22` : "transparent", border: on ? `1px solid ${g.color}66` : "1px solid transparent", opacity: off ? 0.4 : 1, transition: "opacity 0.15s" }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: g.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titleCase(g.id)}</span>
                    <span style={{ color: t.tx3, fontSize: 9 }}>{g.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderTop: `1px solid ${t.bdr}`, flexShrink: 0 }}>
          <div style={{ flex: 1, fontSize: 10, color: t.tx3, lineHeight: 1.4 }}>
            {mode === "guide"
              ? "Follow the steps to place landmarks in clinical order. Use the arrow buttons or ← / → keys to move; Esc returns to browse view."
              : "Drag to pan · scroll to zoom · double-click to fit. Hover any point to read its definition and highlight its group; click a group to isolate it."}
          </div>
          <button onClick={onClose} style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf3, color: t.tx, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
