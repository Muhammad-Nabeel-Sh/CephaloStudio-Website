// Async, cancellable, off-main-thread wrapper around runStudy.
//
// Why this exists (S20): the engine previously ran synchronously on the main
// thread, freezing the UI for large reliability/longitudinal/diagnostic-CV
// datasets, with no progress and no way to cancel. This module spawns a Web
// Worker (engine.worker.js), streams coarse progress, and resolves to the
// completed study. Cancellation is via an AbortSignal — on abort the worker is
// terminated (the in-progress synchronous computation cannot be interrupted any
// other way). When `Worker` is unavailable (tests, very old browsers, SSR) it
// falls back to the synchronous runStudy so behaviour is preserved.
import { runStudy } from "./engine.js";

function workerAvailable() {
  try { return typeof Worker !== "undefined"; } catch { return false; }
}

export function runStudyAsync(study, sessions, calibration, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const prog = typeof onProgress === "function" ? onProgress : () => {};

    // Fallback: no Worker available (jsdom/SSR/legacy) → run synchronously.
    if (!workerAvailable()) {
      try {
        const r = runStudy(study, sessions, calibration, prog);
        resolve(r);
      } catch (e) { reject(e); }
      return;
    }

    const requestId = Math.random().toString(36).slice(2, 10);
    // Literal `new Worker(new URL(...), { type: "module" })` form so Vite's
    // static analysis detects and emits the worker chunk.
    let worker;
    try {
      worker = new Worker(new URL("./engine.worker.js", import.meta.url), { type: "module" });
    } catch {
      // Worker construction failed (e.g. CSP) — fall back to sync.
      try { resolve(runStudy(study, sessions, calibration, prog)); } catch (e2) { reject(e2); }
      return;
    }

    let settled = false;
    const finish = (fn, val) => { if (settled) return; settled = true; cleanup(); worker.terminate(); fn(val); };
    const onMsg = (ev) => {
      const d = ev.data;
      if (!d || d.requestId !== requestId) return;
      if (d.type === "progress") prog(d.progress, d.label);
      else if (d.type === "result") finish(resolve, d.study);
      else if (d.type === "error") finish(reject, new Error(d.error || "Study worker error"));
    };
    const onErr = (ev) => finish(reject, new Error(ev?.message || "Worker construction/load error"));
    const cleanup = () => { worker.removeEventListener("message", onMsg); worker.removeEventListener("error", onErr); if (signal) signal.removeEventListener("abort", onAbort); };
    const onAbort = () => finish(reject, new DOMException("Study run cancelled", "AbortError"));

    worker.addEventListener("message", onMsg);
    worker.addEventListener("error", onErr);
    if (signal) {
      if (signal.aborted) { onAbort(); return; }
      signal.addEventListener("abort", onAbort);
    }
    try {
      worker.postMessage({ study, sessions, calibration, requestId });
    } catch (e) {
      finish(reject, e);
    }
  });
}

// Re-export the synchronous entry for callers/tests that want it directly.
export { runStudy };

