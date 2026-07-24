import { useState } from "react";
import { Sld, PanelHeader, Btn } from "../ui/ui.jsx";
import PanelGuideModal from "./PanelGuideModal.jsx";

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
