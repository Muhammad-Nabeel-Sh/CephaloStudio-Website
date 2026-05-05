/* eslint-disable react-refresh/only-export-components */
// ═══════════════════════════════════════════════════════════════════════════════
// IMAGE UTILS - LUT, Image Processing, Histogram
// ═══════════════════════════════════════════════════════════════════════════════

import { clamp } from "./utils.js";

export function getLUTColor(v, mode, invert = false) {
  v = clamp(Math.round(v), 0, 255);
  if (invert) v = 255 - v;
  switch (mode) {
    case "hot": if (v < 85) return [v * 3, 0, 0]; if (v < 170) return [255, (v - 85) * 3, 0]; return [255, 255, (v - 170) * 3];
    case "cool": return [v, 255 - v, 255];
    case "jet": {
      const n = v / 255;
      let r = 0, g = 0, b = 0;
      if (n < 0.125) b = 0.5 + 4 * n;
      else if (n < 0.375) { g = 4 * (n - 0.125); b = 1; }
      else if (n < 0.625) { r = 4 * (n - 0.375); g = 1; b = 1 - 4 * (n - 0.375); }
      else if (n < 0.875) { r = 1; g = 1 - 4 * (n - 0.625); }
      else { r = 1 - 4 * (n - 0.875); }
      return [r * 255, g * 255, b * 255];
    }
    case "viridis": {
      const stops = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
      const n = v / 255 * 4, i = Math.min(3, Math.floor(n)), f = n - i, c0 = stops[i], c1 = stops[i + 1];
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
    case "bone": {
      const n = v / 255;
      return [clamp(n * 210, 0, 255), clamp(n * 210, 0, 255), clamp(v * 1.08, 0, 255)];
    }
    case "rainbow": {
      const h = v / 255 * 300;
      let r = 0, g = 0, b = 0;
      if (h < 60) { r = 0.5; g = h / 60 * 0.5; }
      else if (h < 120) { r = 0.5 - (h - 60) / 60 * 0.5; g = 0.5; }
      else if (h < 180) { g = 0.5; b = (h - 120) / 60 * 0.5; }
      else if (h < 240) { g = 0.5 - (h - 180) / 60 * 0.5; b = 0.5; }
      else if (h < 300) { r = (h - 240) / 60 * 0.5; b = 0.5; }
      else { r = 0.5; b = 0.5 - (h - 300) / 60 * 0.5; }
      return [(r + 0.2) * 255, (g + 0.2) * 255, (b + 0.2) * 255];
    }
    default: return [v, v, v];
  }
}

export function applyEdgeKernel(idata, strength) {
  const { data, width, height } = idata, out = new Uint8ClampedArray(data), k = clamp(strength / 100 * 2.5, 0, 3);
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const ci = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v = data[ci + c] * (1 + 4 * k) - data[((y - 1) * width + x) * 4 + c] * k - data[((y + 1) * width + x) * 4 + c] * k - data[(y * width + x - 1) * 4 + c] * k - data[(y * width + x + 1) * 4 + c] * k;
        out[ci + c] = clamp(v, 0, 255);
      }
    }
  return new ImageData(out, width, height);
}

export function processImageToCanvas(img, proc, lutMode, lutInvert) {
  if (!img) return null;
  const nw = img.naturalWidth || img.width || 600, nh = img.naturalHeight || img.height || 500;
  const oc = document.createElement("canvas");
  oc.width = nw;
  oc.height = nh;
  const ctx = oc.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { brightness = 0, contrast = 0, windowWidth = 0, windowCenter = 128, edgeEnhance = 0 } = proc;
  if (!brightness && !contrast && !windowWidth && !edgeEnhance && lutMode === "gray" && !lutInvert) return oc;
  let idata = ctx.getImageData(0, 0, nw, nh);
  if (edgeEnhance > 0) idata = applyEdgeKernel(idata, edgeEnhance);
  const d = idata.data, cf = (contrast + 100) / 100;
  for (let i = 0; i < d.length; i += 4) {
    let v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (windowWidth > 0) { const lo = windowCenter - windowWidth / 2, hi = windowCenter + windowWidth / 2; v = clamp((v - lo) / Math.max(hi - lo, 1) * 255, 0, 255); }
    v = clamp(v + brightness, 0, 255);
    v = clamp((v - 128) * cf + 128, 0, 255);
    const [lr, lg, lb] = getLUTColor(v, lutMode, lutInvert);
    d[i] = lr;
    d[i + 1] = lg;
    d[i + 2] = lb;
  }
  ctx.putImageData(idata, 0, 0);
  return oc;
}

export function computeHistogram(img) {
  const hist = new Array(256).fill(0);
  if (!img) return hist;
  const oc = document.createElement("canvas"), sc = Math.min(1, 500 / Math.max(img.naturalWidth || 1, 1));
  oc.width = Math.round((img.naturalWidth || 600) * sc);
  oc.height = Math.round((img.naturalHeight || 500) * sc);
  const ctx = oc.getContext("2d");
  ctx.drawImage(img, 0, 0, oc.width, oc.height);
  const d = ctx.getImageData(0, 0, oc.width, oc.height).data;
  for (let i = 0; i < d.length; i += 4) hist[clamp(Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]), 0, 255)]++;
  return hist;
}

import { useState, useEffect, useRef } from "react";

function Sld({ label, value, min, max, step = 1, onChange, t, unit = "" }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: t.tx2, marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontFamily: "'DM Mono', monospace", color: t.acc }}>
          {typeof value === "number" ? value.toFixed(step < 1 ? 1 : 0) : value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", accentColor: t.acc }}
      />
    </div>
  );
}

export function FloatingHistogram({ hist, t, lutMode, lutInvert, processing, onProcessingChange, onClose }) {
  const [pos, setPos] = useState({ x: 60, y: 60 });
  const [size, setSize] = useState({ w: 380, h: 280 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragRef = useRef(null);
  const histCanvas = useRef(null);

  useEffect(() => {
    const c = histCanvas.current;
    if (!c) return;
    const ctx = c.getContext("2d"), W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = t.surf3;
    ctx.fillRect(0, 0, W, H);
    const max = Math.max(...hist, 1);
    for (let i = 0; i < 256; i++) {
      const h = hist[i] / max * H, x = i / 256 * W, bw = Math.max(1, W / 256);
      const [r, g, b] = getLUTColor(i, lutMode, lutInvert);
      ctx.fillStyle = `rgba(${r},${g},${b},0.8)`;
      ctx.fillRect(x, H - h, bw + 0.5, h);
    }
    if (processing.windowWidth > 0) {
      const lo = processing.windowCenter - processing.windowWidth / 2, hi = processing.windowCenter + processing.windowWidth / 2;
      const x0 = lo / 255 * W, x1 = hi / 255 * W;
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(x0, 0, x1 - x0, H);
      ctx.strokeStyle = "#ffffff66";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0, H);
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, H);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = t.bdr;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, W, H);
  }, [hist, lutMode, lutInvert, processing, t, size]);

  const onHeaderMD = e => { setDragging(true); dragRef.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }; };
  useEffect(() => {
    if (!dragging && !resizing) return;
    const mm = e => {
      if (dragging && dragRef.current) setPos({ x: dragRef.current.px + (e.clientX - dragRef.current.mx), y: dragRef.current.py + (e.clientY - dragRef.current.my) });
      if (resizing && dragRef.current) setSize({ w: Math.max(260, dragRef.current.pw + (e.clientX - dragRef.current.mx)), h: Math.max(200, dragRef.current.ph + (e.clientY - dragRef.current.my)) });
    };
    const mu = () => { setDragging(false); setResizing(false); };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    return () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); };
  }, [dragging, resizing]);

  const hh = Math.max(80, size.h - 140);
  return (
    <div style={{ position: "fixed", left: pos.x, top: pos.y, width: size.w, background: t.surf, border: `1px solid ${t.bdr}`, borderRadius: 10, boxShadow: `0 8px 32px ${t.shadow}`, zIndex: 200, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div onMouseDown={onHeaderMD} style={{ padding: "8px 12px", background: t.surf2, borderBottom: `1px solid ${t.bdr}`, cursor: "move", display: "flex", justifyContent: "space-between", alignItems: "center", userSelect: "none" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>Histogram</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: t.tx2, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ padding: "10px 12px", flex: 1, overflowY: "auto" }}>
        <canvas ref={histCanvas} width={size.w - 24} height={hh} style={{ width: "100%", borderRadius: 4, display: "block", marginBottom: 10 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <Sld label="Win Center" value={processing.windowCenter} min={0} max={255} onChange={v => onProcessingChange({ ...processing, windowCenter: v })} t={t} />
          <Sld label="Win Width" value={processing.windowWidth} min={0} max={255} onChange={v => onProcessingChange({ ...processing, windowWidth: v })} t={t} />
          <Sld label="Brightness" value={processing.brightness} min={-128} max={128} onChange={v => onProcessingChange({ ...processing, brightness: v })} t={t} />
          <Sld label="Contrast" value={processing.contrast} min={-100} max={200} onChange={v => onProcessingChange({ ...processing, contrast: v })} t={t} />
        </div>
      </div>
      <div onMouseDown={e => { setResizing(true); dragRef.current = { mx: e.clientX, my: e.clientY, pw: size.w, ph: size.h }; }}
        style={{ position: "absolute", right: 0, bottom: 0, width: 16, height: 16, cursor: "se-resize", background: `linear-gradient(135deg,transparent 50%,${t.bdr} 50%)`, borderBottomRightRadius: 10 }} />
    </div>
  );
}