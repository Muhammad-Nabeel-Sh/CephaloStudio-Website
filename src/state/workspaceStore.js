import { useCallback } from "react";
import { useToolStore } from "./toolStore.js";
import { useUIStore } from "./uiStore.js";
import { useSessionStore } from "./sessionStore.js";

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

// ─── Placing-queue ↔ placement-state sync after undo/redo ────────
// Each placing click pushes one undo entry; undo()/redo() restore markups but leave
// placingIdx untouched, which previously desynced the queue (reverted points skipped).
// Recompute placingIdx from the actually-placed queue items so the queue stays coherent.
export function syncPlacingQueue() {
  const ts = useToolStore.getState();
  if (!ts.placingMode && ts.placingQueue.length === 0) return;
  const ms = useSessionStore.getState().markups;
  const queue = ts.placingQueue;
  let placed = 0;
  while (placed < queue.length) {
    const m = ms.find(x => x.id === queue[placed]);
    if (!m || !m.placed) break;
    placed++;
  }
  const nextMissing = placed < queue.length && !ms.some(x => x.id === queue[placed]);
  if (nextMissing || placed >= queue.length) {
    useToolStore.setState({ placingMode: false, placingQueue: [], placingIdx: 0 });
  } else {
    useToolStore.setState({ placingMode: true, placingIdx: placed });
  }
}

// ─── Combined hook for backward compat ───────────────────────────
export function useWorkspaceStore() {
  const tool = useToolStore();
  const ui = useUIStore();
  const dispatch = useStoreDispatch();
  return { ui: { ...tool, ...ui }, dispatch };
}
