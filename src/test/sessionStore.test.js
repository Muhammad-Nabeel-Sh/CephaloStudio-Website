import { describe, it, expect, beforeEach } from "vitest";
import { useSessionStore, setSessionChangeHandler } from "../state/sessionStore.js";
import { useToolStore } from "../state/toolStore.js";
import { syncPlacingQueue } from "../state/workspaceStore.js";

function makePoint(id, placed = false) {
  return {
    id,
    type: "point",
    label: id,
    points: placed ? [{ x: 100, y: 100 }] : [{ x: -99999, y: -99999 }],
    placed,
    visible: true,
  };
}

// Simulates the placing-click sequence from App.jsx handleMouseDown:
// pushUndo() BEFORE the placement mutation, then advance placingIdx.
function placingClick(qid) {
  const store = useSessionStore.getState();
  store.pushUndo();
  useSessionStore.setState({
    markups: useSessionStore.getState().markups.map(m => m.id === qid ? { ...m, placed: true, points: [{ x: 100, y: 100 }] } : m),
  });
  const ts = useToolStore.getState();
  useToolStore.setState({
    placingMode: ts.placingIdx < ts.placingQueue.length - 1,
    placingIdx: Math.min(ts.placingIdx + 1, ts.placingQueue.length),
  });
}

describe("sessionStore undo/redo", () => {
  beforeEach(() => {
    setSessionChangeHandler(null);
    useSessionStore.setState({
      markups: [],
      calibration: { done: false, pxPerMm: 1 },
      norms: [],
      formulas: [],
      processing: { brightness: 0, contrast: 0, windowWidth: 0, windowCenter: 128, edgeEnhance: 0 },
      undoStack: [],
      redoStack: [],
      undoVersion: 0,
    });
    useToolStore.setState({ placingMode: false, placingQueue: [], placingIdx: 0 });
  });

  it("undo reverts the last markup mutation and redo reapplies it", () => {
    const store = useSessionStore.getState();
    store.addMarkup(makePoint("a"));
    store.pushUndo();
    useSessionStore.setState({
      markups: useSessionStore.getState().markups.map(m => m.id === "a" ? { ...m, placed: true } : m),
    });
    expect(useSessionStore.getState().markups[0].placed).toBe(true);

    useSessionStore.getState().undo();
    expect(useSessionStore.getState().markups[0].placed).toBe(false);

    useSessionStore.getState().redo();
    expect(useSessionStore.getState().markups[0].placed).toBe(true);
  });

  it("syncPlacingQueue keeps placingIdx aligned after undoing a placed point", () => {
    useSessionStore.setState({
      markups: [makePoint("a"), makePoint("b"), makePoint("c")],
    });
    useToolStore.setState({ placingMode: true, placingQueue: ["a", "b", "c"], placingIdx: 0 });

    placingClick("a"); // places a, idx -> 1
    placingClick("b"); // places b, idx -> 2
    expect(useSessionStore.getState().markups.filter(m => m.placed)).toHaveLength(2);

    useSessionStore.getState().undo();
    syncPlacingQueue();
    let ts = useToolStore.getState();
    expect(useSessionStore.getState().markups.filter(m => m.placed).map(m => m.id)).toEqual(["a"]);
    expect(ts.placingMode).toBe(true);
    expect(ts.placingIdx).toBe(1);

    useSessionStore.getState().undo();
    syncPlacingQueue();
    ts = useToolStore.getState();
    expect(useSessionStore.getState().markups.filter(m => m.placed)).toHaveLength(0);
    expect(ts.placingMode).toBe(true);
    expect(ts.placingIdx).toBe(0);
  });

  it("syncPlacingQueue advances after redo mid-placement", () => {
    useSessionStore.setState({
      markups: [makePoint("a"), makePoint("b")],
    });
    useToolStore.setState({ placingMode: true, placingQueue: ["a", "b"], placingIdx: 0 });

    placingClick("a"); // idx -> 1
    useSessionStore.getState().undo();
    syncPlacingQueue();
    expect(useToolStore.getState().placingIdx).toBe(0);

    useSessionStore.getState().redo();
    syncPlacingQueue();
    const ts = useToolStore.getState();
    expect(useSessionStore.getState().markups.filter(m => m.placed).map(m => m.id)).toEqual(["a"]);
    expect(ts.placingMode).toBe(true);
    expect(ts.placingIdx).toBe(1);
  });

  it("syncPlacingQueue stops placing when the whole queue is placed", () => {
    useSessionStore.setState({
      markups: [makePoint("a"), makePoint("b")],
    });
    useToolStore.setState({ placingMode: true, placingQueue: ["a", "b"], placingIdx: 0 });

    placingClick("a");
    placingClick("b");
    useSessionStore.getState().undo();
    syncPlacingQueue();
    expect(useToolStore.getState().placingIdx).toBe(1);

    useSessionStore.getState().redo();
    syncPlacingQueue();
    const ts = useToolStore.getState();
    expect(ts.placingMode).toBe(false);
    expect(ts.placingQueue).toEqual([]);
    expect(ts.placingIdx).toBe(0);
  });

  it("syncPlacingQueue is a no-op when placing is inactive", () => {
    useSessionStore.setState({ markups: [makePoint("a", true)] });
    useToolStore.setState({ placingMode: false, placingQueue: [], placingIdx: 0 });
    const tsBefore = JSON.stringify(useToolStore.getState());
    syncPlacingQueue();
    expect(JSON.stringify(useToolStore.getState())).toBe(tsBefore);
  });
});
