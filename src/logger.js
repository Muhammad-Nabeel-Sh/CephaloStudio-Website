// ─── PHI-safe logging (P5) ─────────────────────────────────────────────────
//
// `console.error("…:", err)` and `console.warn("…:", err)` were unconditional
// across the app. Several `err` objects wrap PHI-bearing payloads (the .cephx
// import JSON, the encrypted-autosave blob, batch-import session.meta, the
// PDF-generation project object, an ErrorBoundary component stack whose props
// contain patient identifiers). On a shared workstation those strings persist
// in the DevTools console history — a PHI leak.
//
// In dev (`import.meta.env.DEV`) we log the full object for debugging. In
// production we log only the label + the error name + a truncated message,
// never the raw object/stack. Error MESSAGES rarely carry PHI (a JSON.parse
// message is like "Unexpected token at position 0"); the PHI lives in the
// object we now withhold. Message length is capped as a belt-and-braces guard.

const DEV = !!(import.meta.env && import.meta.env.DEV);

function summarize(err) {
  if (err == null) return "";
  const name = err.name ? `${err.name}: ` : "";
  const msg = err.message != null ? String(err.message) : String(err);
  return (name + msg).slice(0, 160);
}

export function logError(label, err, devExtra) {
  if (DEV) { console.error(label, err, devExtra !== undefined ? devExtra : ""); return; }
  console.error(`${label} ${summarize(err)}`.trim());
}

export function logWarn(label, err, devExtra) {
  if (DEV) { console.warn(label, err, devExtra !== undefined ? devExtra : ""); return; }
  console.warn(`${label} ${summarize(err)}`.trim());
}
