import { useUIStore } from "../state/uiStore.js";
import { PANEL_ICONS } from "../panels/panelIcons.jsx";

const MORE_ICON = <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z"/></svg>;

const CANVAS_ICON = <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Z"/></svg>;

const TABS = [
  { key: "canvas", icon: CANVAS_ICON, label: "Canvas", panel: null },
  { key: "markups", icon: PANEL_ICONS.markups, label: "Markups", panel: "markups" },
  { key: "measurements", icon: PANEL_ICONS.measurements, label: "Data", panel: "measurements" },
  { key: "more", icon: MORE_ICON, label: "More", panel: null },
];

export default function MobileTabBar({ t }) {
  const mobileTab = useUIStore(s => s.mobileTab);
  return (
    <div className="mobile-chrome" style={{
      display: "flex", height: 52, background: t.surf, borderTop: `1px solid ${t.bdr}`,
      flexShrink: 0, position: "relative", zIndex: 20,
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      {TABS.map(tab => {
        const active = mobileTab === tab.key;
        return (
          <button key={tab.key} onClick={() => {
            useUIStore.setState({
              mobileTab: tab.key,
              rightPanel: tab.panel || useUIStore.getState().rightPanel,
            });
          }}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 2, background: "none", border: "none",
              borderTop: active ? `2px solid ${t.acc}` : `2px solid transparent`,
              color: active ? t.acc : t.tx3, cursor: "pointer", padding: "4px 0 0",
              fontSize: 18, lineHeight: 1, transition: "color 0.15s",
            }}
          >
            <span style={{height:20,display:"flex",alignItems:"center"}}>{tab.icon}</span>
            <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, fontFamily: "'DM Sans',sans-serif" }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
