import { useCallback } from "react";
import { useToolStore } from "./toolStore.js";
import { useUIStore } from "./uiStore.js";

export { useToolStore } from "./toolStore.js";
export { useUIStore } from "./uiStore.js";
export { useSessionStore } from "./sessionStore.js";

export const INITIAL_UI = {};
export const Actions = { SET: "SET" };

const TOOL_KEYS = [
  "activeSessionId", "zoom", "pan", "selectedId", "selectedIds",
  "replacingId", "currentDraw", "activeTool", "snapEnabled",
  "placingMode", "placingQueue", "placingIdx", "loadingImages",
  "spotlightMode",
];

// ─── Stable dispatch (uses getState, never subscribes) ───────────
export function useStoreDispatch() {
  return useCallback((action) => {
    if (action.type !== "SET") return;
    const tp = {};
    const up = {};
    for (const [k, v] of Object.entries(action.payload)) {
      const resolved = typeof v === "function"
        ? v((TOOL_KEYS.includes(k) ? useToolStore.getState() : useUIStore.getState())[k])
        : v;
      if (TOOL_KEYS.includes(k)) tp[k] = resolved;
      else up[k] = resolved;
    }
    if (Object.keys(tp).length) useToolStore.setState(tp);
    if (Object.keys(up).length) useUIStore.setState(up);
  }, []);
}

// ─── Combined hook for backward compat ───────────────────────────
export function useWorkspaceStore() {
  const tool = useToolStore();
  const ui = useUIStore();
  const dispatch = useStoreDispatch();
  return { ui: { ...tool, ...ui }, dispatch };
}
