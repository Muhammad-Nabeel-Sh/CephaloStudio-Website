// ═══════════════════════════════════════════════════════════════════════════════
// Right panel vertical tab sidebar — VSCode-style tab buttons + collapse toggle
// ═══════════════════════════════════════════════════════════════════════════════

import { PANEL_ICONS } from "./panelIcons.jsx";

export function RightPanelSidebar({ t, rightPanel, setRightPanel, panelTabs, toggleBtnRef, toggleCollapsed, isMobile, showMobilePanel }) {
  if (isMobile && !showMobilePanel) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8, flexShrink: 0, background: t.surf2 }}>
      {panelTabs.map(([id, label]) => (
        <button key={id} onClick={() => setRightPanel(id)} aria-label={label} title={label}
          onMouseEnter={e => { if (rightPanel !== id) { e.currentTarget.style.background = t.accMuted; e.currentTarget.style.color = t.acc; } }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = rightPanel === id ? t.acc : t.tx; }}
          style={{
            width: 52, minHeight: 52, padding: "6px 4px", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 2, border: "none",
            background: "transparent", color: rightPanel === id ? t.acc : t.tx,
            cursor: "pointer", borderRadius: 8, marginBottom: 4, transition: "all 0.15s",
            boxShadow: rightPanel === id ? `inset 2px 0 0 ${t.acc}` : "none",
          }}>
          <span style={{ fontSize: 24 }}>{PANEL_ICONS[id] || "O"}</span>
        </button>
      ))}
      {/* Collapse/expand toggle */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: 8 }}>
        <button ref={toggleBtnRef} onClick={toggleCollapsed} aria-label="Toggle panel" title="Toggle panel"
          style={{
            width: 44, height: 36, margin: "0 auto", display: "flex", alignItems: "center",
            justifyContent: "center", border: `1px solid ${t.bdr}`, borderRadius: 6,
            background: t.surf3, color: t.tx2, cursor: "pointer", fontSize: 16, transition: "all 0.15s",
          }}>
          ▶
        </button>
      </div>
    </div>
  );
}
