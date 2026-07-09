// Research engine Web Worker — offloads runStudy from the main thread so large
// datasets (longitudinal, MANOVA, logistic CV) don't freeze the UI. Streams
// coarse progress messages and supports cancellation via worker termination
// (engineClient.js ties an AbortSignal to terminate()).
import { runStudy } from "./engine.js";

self.onmessage = (e) => {
  const { study, sessions, calibration, requestId } = e.data || {};
  if (!study || !requestId) return;
  try {
    const result = runStudy(study, sessions || [], calibration, (progress, label) => {
      self.postMessage({ type: "progress", requestId, progress, label });
    });
    self.postMessage({ type: "result", requestId, study: result });
  } catch (err) {
    self.postMessage({ type: "error", requestId, error: err?.message || String(err), stack: err?.stack || null });
  }
};
