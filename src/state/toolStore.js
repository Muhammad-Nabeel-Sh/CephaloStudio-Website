import { create } from "zustand";

export const useToolStore = create(() => ({
  activeSessionId: null,
  zoom: 1,
  pan: { x: 40, y: 40 },
  selectedId: null,
  selectedIds: [],
  replacingId: null,
  currentDraw: null,
  activeTool: "select",
  snapEnabled: { points: true, lines: false },
  placingMode: false,
  placingQueue: [],
  placingIdx: 0,
  loadingImages: false,
  spotlightMode: false,
}));
