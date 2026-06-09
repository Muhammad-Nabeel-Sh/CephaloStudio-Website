// ═══════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS - Shared UI elements
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";

export function Btn({ onClick, children, style, active, small, danger, t, disabled, title, ghost }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: active ? t.acc : hov ? "rgba(255,255,255,0.07)" : "transparent",
        color: active ? (t.id === "light" ? "#fff" : t.bg) : danger ? t.err : hov ? t.tx : t.tx2,
        border: ghost ? "none" : `1px solid ${active ? t.acc : hov ? t.bdr + "cc" : t.bdr}`,
        borderRadius: 6,
        padding: small ? "6px 10px" : "8px 16px",
        fontSize: small ? 13 : 15,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        fontWeight: 500,
        transition: "all 0.15s",
        opacity: disabled ? 0.5 : 1,
        boxShadow: hov && !disabled ? `0 2px 8px ${t.shadow}` : "none",
        ...style
      }}
    >
      {children}
    </button>
  );
}

export function Tag({ color, children }) {
  return (
    <span
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}44`,
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'DM Mono', monospace"
      }}
    >
      {children}
    </span>
  );
}

export function Sld({ label, value, min, max, step = 1, onChange, t, unit = "" }) {
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

export function PropRow({ label, children, t }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
      <div style={{ width: 64, fontSize: 11, color: t.tx2, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

export function Inp({ value, onChange, t, type = "text", placeholder = "" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background: t.surf3,
        border: `1px solid ${t.bdr}`,
        borderRadius: 4,
        padding: "4px 8px",
        color: t.tx,
        fontSize: 12,
        width: "100%",
        fontFamily: "inherit",
        boxSizing: "border-box"
      }}
    />
  );
}

export function Divider({ t }) {
  return <div style={{ height: 1, background: t.bdr, margin: "12px 0" }} />;
}

export function PanelHeader({ t, children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: t.tx2, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, paddingTop: 4 }}>
      {children}
    </div>
  );
}

export function InfoBox({ t, children }) {
  return (
    <div style={{ fontSize: 10, color: t.tx2, lineHeight: 1.5, padding: "8px 10px", background: t.surf3, borderRadius: 4, border: `1px solid ${t.acc}22`, marginBottom: 10 }}>
      <style>{`[data-ib] b{color:${t.acc}}`}</style>
      <div data-ib>{children}</div>
    </div>
  );
}