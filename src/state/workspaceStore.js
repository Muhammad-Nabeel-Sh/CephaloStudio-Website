import { useReducer, useCallback } from "react";

// ─── Initial State ─────────────────────────────────────────────
export const INITIAL_UI = {
  activeSessionId: null,
  zoom: 1,
  pan: { x: 40, y: 40 },
  mousePos: null,
  snapPos: null,
  selectedId: null,
  replacingId: null,
  currentDraw: null,
  activeTool: "select",
  snapEnabled: true,
  showScaleBar: false,
  showDefTooltips: true,
  showLUT: false,
  showHistogram: false,
  showAnnotations: true,
  annotationSize: 1,
  rightPanel: "markups",
  showCalib: false,
  pendingRuler: null,
  showExport: false,
  showAnon: false,
  showNormogram: false,
  showAlign: false,
  showTransform: false,
  pendingTextPos: null,
  showFormulaEditor: false,
  editFormulaId: null,
  placingMode: false,
  placingQueue: [],
  placingIdx: 0,
  loadingImages: false,
  isMobile: window.innerWidth < 768,
  showMobilePanel: false,
  toolbarPos: { x: 70, y: 100 },
  toolbarDragging: false,
  rightPanelWidth: 440,
  rightPanelResizing: false,
  spotlightMode: false,
  showDisplacement: false,
  compareSessionId: null,
  displacementOverlay: false,
  refLandmark1: "",
  refLandmark2: "",
  overlayBlend: 0.5,
  showDatabaseImport: false,
};

// ─── Action Types ──────────────────────────────────────────────
export const Actions = {
  SET_ZOOM: "SET_ZOOM",
  SET_PAN: "SET_PAN",
  SET_ACTIVE_SESSION: "SET_ACTIVE_SESSION",
  SET_SELECTED: "SET_SELECTED",
  SET_TOOL: "SET_TOOL",
  SET_RIGHT_PANEL: "SET_RIGHT_PANEL",
  SET_DRAW: "SET_DRAW",
  SET_PLACING: "SET_PLACING",
  SET_CALIB: "SET_CALIB",
  UI_SET: "UI_SET", // generic catch-all for simple boolean/string toggles
};

// ─── Reducer ───────────────────────────────────────────────────
export function uiReducer(state, action) {
  switch (action.type) {
    case Actions.SET_ZOOM:
      return { ...state, zoom: action.payload };
    case Actions.SET_PAN:
      return { ...state, pan: action.payload };
    case Actions.SET_ACTIVE_SESSION:
      return { ...state, activeSessionId: action.payload };
    case Actions.SET_SELECTED:
      return { ...state, selectedId: action.payload };
    case Actions.SET_TOOL:
      return { ...state, activeTool: action.payload, currentDraw: null };
    case Actions.SET_RIGHT_PANEL:
      return { ...state, rightPanel: action.payload };
    case Actions.SET_DRAW:
      return { ...state, currentDraw: action.payload };
    case Actions.SET_PLACING:
      return {
        ...state,
        placingMode: action.payload.mode ?? state.placingMode,
        placingQueue: action.payload.queue ?? state.placingQueue,
        placingIdx: action.payload.idx ?? state.placingIdx,
      };
    case Actions.SET_CALIB:
      return { ...state, showCalib: action.payload };
    case Actions.UI_SET:
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// ─── Hook ──────────────────────────────────────────────────────
export function useWorkspaceStore() {
  const [ui, dispatch] = useReducer(uiReducer, INITIAL_UI);

  const setZoom = useCallback(
    (v) => dispatch({ type: Actions.SET_ZOOM, payload: typeof v === "function" ? v(ui.zoom) : v }),
    [ui.zoom]
  );
  const setPan = useCallback(
    (v) => dispatch({ type: Actions.SET_PAN, payload: typeof v === "function" ? v(ui.pan) : v }),
    [ui.pan]
  );
  const setActiveSession = useCallback(
    (id) => dispatch({ type: Actions.SET_ACTIVE_SESSION, payload: id }),
    []
  );
  const setSelectedId = useCallback(
    (v) => dispatch({ type: Actions.SET_SELECTED, payload: typeof v === "function" ? v(ui.selectedId) : v }),
    [ui.selectedId]
  );
  const setActiveTool = useCallback(
    (tool) => dispatch({ type: Actions.SET_TOOL, payload: tool }),
    []
  );
  const setRightPanel = useCallback(
    (panel) => dispatch({ type: Actions.SET_RIGHT_PANEL, payload: panel }),
    []
  );
  const setCurrentDraw = useCallback(
    (draw) => dispatch({ type: Actions.SET_DRAW, payload: draw }),
    []
  );
  const setPlacing = useCallback(
    (opts) => dispatch({ type: Actions.SET_PLACING, payload: opts }),
    []
  );
  const setShowCalib = useCallback(
    (v) => dispatch({ type: Actions.SET_CALIB, payload: typeof v === "function" ? v(ui.showCalib) : v }),
    [ui.showCalib]
  );
  const uiSet = useCallback(
    (payload) => dispatch({ type: Actions.UI_SET, payload }),
    []
  );

  return {
    ui,
    dispatch,
    setZoom,
    setPan,
    setActiveSession,
    setSelectedId,
    setActiveTool,
    setRightPanel,
    setCurrentDraw,
    setPlacing,
    setShowCalib,
    uiSet,
  };
}
