// ─── De-identification with audit trail (P2 + P3) ──────────────────────────
//
// Previously `anonymize` (AnonModal.jsx) was destructive, incomplete (left
// session.meta PHI intact), and left no provenance — no who/when record, and
// the original values were simply gone. This module provides a single,
// non-destructive `anonymizeProject(project, opts)` that returns a NEW
// anonymized project clone and appends a structured audit-log entry.
//
// Policy:
//   • Patient identifiers are cleared everywhere: project.meta (patientId →
//     ANON-id, patientName/dob/age/clinician/facility/referral/notes) and per
//     session (meta.patientId/age/sex + subjectId).
//   • Operator identifiers are PSEUDONYMIZED (each distinct operatorId →
//     "Rater-1", "Rater-2", …) so inter-rater reliability structure is
//     preserved while operator identity is removed.
//   • Research labels (group, trialNumber, timepoint) are KEPT — they are
//     study arms, not patient identifiers.
//   • Audit log: appends { timestamp, iso, operatorId, reason, fieldsCleared,
//     provenance } to project.meta.anonymizationLog. `provenance` stores a
//     salted SHA-256 hash of each original patient-PHI value so an auditor can
//     later verify a claimed original without the app retaining the value.
//     (Salted so low-entropy fields like a short name are not rainbow-tabled.)

import { uid } from "./utils.js";

const PROJECT_CLEAR = ["patientName", "dob", "age", "clinician", "facility", "referral", "notes"];
const SESSION_CLEAR = ["patientId", "age", "sex"];

async function sha256Hex(str) {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch { return null; }
}

// Build a stable pseudonym map for distinct operatorIds (Rater-1, Rater-2, …).
function buildOperatorPseudonyms(sessions) {
  const map = {};
  let n = 0;
  for (const s of sessions || []) {
    const op = s.meta?.operatorId;
    if (op && !map[op]) map[op] = `Rater-${++n}`;
  }
  return map;
}

// Returns a NEW anonymized project. The original is not mutated.
export async function anonymizeProject(project, opts = {}) {
  const reason = opts.reason || "manual";
  const operatorId = opts.operatorId
    || project.sessions?.find(s => s.meta?.operatorId)?.meta?.operatorId
    || project.meta?.clinician
    || "unknown";
  const retainProvenance = opts.retainProvenance !== false;
  const ts = Date.now();

  // Collect original patient-PHI values for provenance hashing.
  const salt = retainProvenance ? (uid() + uid()) : null;
  const hashes = {};
  if (retainProvenance) {
    const entries = [];
    for (const k of PROJECT_CLEAR) if (project.meta?.[k]) entries.push([`project.${k}`, String(project.meta[k])]);
    if (project.meta?.patientId) entries.push(["project.patientId", String(project.meta.patientId)]);
    for (const s of (project.sessions || [])) {
      for (const k of SESSION_CLEAR) if (s.meta?.[k] != null && s.meta?.[k] !== "") entries.push([`session.${k}`, String(s.meta[k])]);
      if (s.subjectId) entries.push(["session.subjectId", String(s.subjectId)]);
    }
    for (const [key, val] of entries) {
      const h = await sha256Hex(`${salt}|${key}|${val}`);
      if (h) hashes[key] = h;
    }
  }

  const logEntry = {
    timestamp: ts,
    iso: new Date(ts).toISOString(),
    operatorId,
    reason,
    fieldsCleared: [
      ...PROJECT_CLEAR.map(f => `project.${f}`),
      "project.patientId (→ANON-id)",
      ...SESSION_CLEAR.map(f => `session.${f}`),
      "session.subjectId",
      "session.operatorId (→pseudonym)",
    ],
    provenance: retainProvenance && Object.keys(hashes).length ? { salt, hashes } : null,
  };

  const opMap = buildOperatorPseudonyms(project.sessions);

  const anonMeta = {
    ...project.meta,
    patientId: "ANON-" + uid().toUpperCase(),
    patientName: "", dob: "", age: "", clinician: "", facility: "", referral: "",
    notes: "[Anonymized]",
    anonymized: true,
    anonymizationLog: [...(project.meta?.anonymizationLog || []), logEntry],
  };

  const sessions = (project.sessions || []).map(s => ({
    ...s,
    subjectId: "",
    meta: {
      ...s.meta,
      patientId: "",
      age: "",
      sex: "",
      operatorId: s.meta?.operatorId ? (opMap[s.meta.operatorId] || "Rater-?") : s.meta?.operatorId,
    },
  }));

  return { ...project, meta: anonMeta, sessions };
}

// True when the project has any patient-PHI still present (used to warn the
// user before a full export of an un-anonymized project).
export function hasUnanonymizedPHI(project) {
  if (!project) return false;
  const m = project.meta || {};
  if (!m.anonymized && (m.patientName || m.dob || m.age || m.patientId)) return true;
  for (const s of (project.sessions || [])) {
    if (s.subjectId) return true;
    if (s.meta?.patientId || s.meta?.age || s.meta?.sex) return true;
  }
  return false;
}
