import { useEffect } from "react";
import { uid, computeMeasurements, autoControlPoints } from "../lib/utils.js";

export default function ContextMenu({
  contextMenu,
  theme: t,
  markups,
  selectedIds,
  copiedMarkup,
  onCopyMarkup,
  refLandmark1,
  refLandmark2,
  showGrid,
  calibration,
  onClose,
  onAddMarkup,
  onUpdMarkup,
  onUpdMarkups,
  onSelectAndFocus,
  onDelMarkup,
  onSetRefLandmark1,
  onSetRefLandmark2,
  onSetShowGrid,
  onFitToView,
  dispatch,
}) {
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => onClose();
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const els = document.querySelectorAll('[data-cmenu] [role="menuitem"]');
        const current = e.target.closest('[role="menuitem"]');
        const idx = Array.from(els).indexOf(current);
        const next = e.key === "ArrowDown" ? Math.min(idx + 1, els.length - 1) : Math.max(idx - 1, 0);
        if (els[next]) els[next].focus();
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const els = document.querySelectorAll('[data-cmenu] [role="menuitem"]');
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey) { if (document.activeElement === first) last.focus(); }
        else { if (document.activeElement === last) first.focus(); }
      }
    };
    const onClickOutside = (e) => { if (!e.target.closest("[data-cmenu]")) close(); };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    setTimeout(() => {
      const first = document.querySelector('[data-cmenu] [role="menuitem"]');
      if (first) first.focus();
    }, 0);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [contextMenu, onClose]);

  if (!contextMenu) return null;

  const mId = contextMenu.markupId;
  const m = mId ? markups.find(x => x.id === mId) : null;
  const close = () => onClose();
  const sel = selectedIds.length > 1 ? selectedIds : [];

  const dup = () => {
    if (!m) return;
    const pts = m.points?.map(p => ({ x: p.x + 15, y: p.y + 15 }));
    const dupe = { ...m, id: uid(), label: `${m.label || m.type} (copy)`, points: pts };
    if (m.type === "bezier") {
      const cp = m.cp ? m.cp.map(p => ({ x: p.x + 15, y: p.y + 15 })) : autoControlPoints(pts);
      dupe.cp = cp;
    }
    onAddMarkup(dupe);
    close();
  };

  const copyMeas = () => {
    if (!m) return;
    const meas = computeMeasurements(m, calibration);
    const txt = Object.entries(meas)
      .filter(([k]) => !k.startsWith("_") && k !== "x" && k !== "y")
      .map(([k, v]) => `${m.label || m.type} ${k}: ${k === "angle" ? v.toFixed(1) + "°" : v.toFixed(2) + (k === "area" ? (calibration.done ? " mm²" : " px²") : (calibration.done ? " mm" : " px"))}`)
      .join("\n");
    if (txt) navigator.clipboard.writeText(txt);
    close();
  };

  const copyMarkup = () => {
    if (!m) return;
    onCopyMarkup(JSON.stringify(m));
    close();
  };

  const pasteMarkup = (setPos) => {
    const raw = copiedMarkup;
    if (!raw) return;
    try {
      const src = JSON.parse(raw);
      const imgPt = setPos || { x: contextMenu.imageX || 0, y: contextMenu.imageY || 0 };
      const pts = src.points?.map(p => ({ x: p.x + imgPt.x - (src.points?.[0]?.x || 0), y: p.y + imgPt.y - (src.points?.[0]?.y || 0) }));
      const dupe = { ...src, id: uid(), label: `${src.label || src.type} (pasted)`, points: pts };
      if (src.type === "bezier" && src.cp) dupe.cp = src.cp.map(p => ({ x: p.x + imgPt.x - (src.points?.[0]?.x || 0), y: p.y + imgPt.y - (src.points?.[0]?.y || 0) }));
      onAddMarkup(dupe);
      close();
    } catch { /* silent */ }
  };

  const toFront = () => {
    if (!m) return;
    onUpdMarkups(ms => {
      const idx = ms.findIndex(x => x.id === mId);
      if (idx < 0 || idx === ms.length - 1) return ms;
      const cp = [...ms];
      cp.splice(idx, 1);
      cp.push(m);
      return cp;
    });
    close();
  };

  const toBack = () => {
    if (!m) return;
    onUpdMarkups(ms => {
      const idx = ms.findIndex(x => x.id === mId);
      if (idx < 0 || idx === 0) return ms;
      const cp = [...ms];
      cp.splice(idx, 1);
      cp.unshift(m);
      return cp;
    });
    close();
  };

  const groupSel = () => {
    if (sel.length < 2) return;
    const gid = uid();
    onUpdMarkups(ms => ms.map(x => sel.includes(x.id) ? { ...x, groupId: gid } : x));
    close();
  };

  const ungroupSel = () => {
    const ids = m && m.groupId ? [...sel, mId] : sel;
    if (!ids.length) return;
    onUpdMarkups(ms => ms.map(x => ids.includes(x.id) ? { ...x, groupId: void 0 } : x));
    close();
  };

  const pivotY = Math.min(contextMenu.y, window.innerHeight - 320);

  const item = (label, onClick, danger) => (
    <div key={label} role="menuitem" tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      onMouseEnter={e => e.currentTarget.style.background = t.surf2}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      style={{ padding: "6px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: danger ? t.err : t.tx, fontSize: 12, transition: "background 0.1s", whiteSpace: "nowrap" }}>
      {label}
    </div>
  );

  const sep = <div style={{ borderTop: `1px solid ${t.bdr}`, margin: "4px 0" }} />;

  return (
    <div data-cmenu="1" role="menu"
      style={{
        position: "fixed",
        left: Math.min(contextMenu.x, window.innerWidth - 200),
        top: pivotY,
        zIndex: 1000,
        background: t.surf,
        border: `1px solid ${t.bdr}`,
        borderRadius: 8,
        boxShadow: `0 4px 20px ${t.shadow}88`,
        padding: "4px 0",
        minWidth: 170,
        fontSize: 12,
        color: t.tx,
      }}>
      {m ? <>
        <div style={{ padding: "6px 14px", fontSize: 10, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${t.bdr}`, fontWeight: 600 }}>{m.label || m.type}</div>
        {item("Focus", () => { onSelectAndFocus(mId); close(); })}
        {item("Rename", () => { const n = window.prompt("Rename markup:", m.label); if (n && n.trim()) onUpdMarkup(mId, { label: n.trim() }); close(); })}
        {item("Change Color", () => {
          const ci = document.createElement("input");
          ci.type = "color"; ci.value = m.color || t.acc;
          ci.style.position = "fixed"; ci.style.opacity = "0"; ci.style.pointerEvents = "none";
          document.body.appendChild(ci);
          ci.addEventListener("input", () => onUpdMarkup(mId, { color: ci.value }));
          ci.addEventListener("change", () => document.body.removeChild(ci));
          close(); ci.click();
        })}
        {sep}
        {item("Duplicate", dup)}
        {item("Copy", copyMarkup)}
        {copiedMarkup ? item("Paste", pasteMarkup) : null}
        {sep}
        {item(m.visible === false ? "Show" : "Hide", () => { onUpdMarkup(mId, { visible: m.visible === false }); close(); })}
        {item(m.locked ? "Unlock" : "Lock", () => { onUpdMarkup(mId, { locked: !m.locked }); close(); })}
        {sep}
        {item(refLandmark1 === m.label ? "✓ Ref Landmark 1" : "Ref Landmark 1", () => { onSetRefLandmark1(m.label === refLandmark1 ? null : m.label); close(); })}
        {item(refLandmark2 === m.label ? "✓ Ref Landmark 2" : "Ref Landmark 2", () => { onSetRefLandmark2(m.label === refLandmark2 ? null : m.label); close(); })}
        {item("Copy Measurement", copyMeas)}
        {sep}
        {item("Move to Front", toFront)}
        {item("Send to Back", toBack)}
        {sep}
        {m.groupId ? item("Ungroup", ungroupSel) : null}
        {sel.length > 1 ? item("Group", groupSel) : null}
        {item("Delete", () => { onDelMarkup(mId); close(); }, true)}
      </> : <>
        <div style={{ padding: "6px 14px", fontSize: 10, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Canvas</div>
        {copiedMarkup ? item("Paste", () => pasteMarkup({ x: contextMenu.imageX || 0, y: contextMenu.imageY || 0 })) : null}
        {item("Select All", () => {
          const all = markups.map(x => x.id);
          dispatch({ type: "SET", payload: { selectedIds: all, selectedId: all.length === 1 ? all[0] : null } });
          close();
        })}
        {item("Calibrate ⟺", () => { dispatch({ type: "SET", payload: { showCalib: true } }); close(); })}
        {item("Fit to View ⊙", () => { onFitToView?.(); close(); })}
        {sep}
        {item(showGrid ? "Grid: On ✓" : "Grid: Off", () => { onSetShowGrid(v => !v); close(); })}
      </>}
    </div>
  );
}
