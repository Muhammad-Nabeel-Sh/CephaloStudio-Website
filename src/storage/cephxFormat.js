// ─── .cephx / .cepht format: versioning, migration & validation (D4 / D5) ──
//
// Previously `importCephx` did a single `JSON.parse` + `d.format==="cephx"` check
// and handed the raw project straight into app state. Legacy `session.image`
// (singular) was only normalized on *export*, not import, so an imported legacy
// file silently kept the singular shape and the in-Workspace legacy shim had to
// patch it at runtime (D4). Version strings were also inconsistent: code wrote
// `.cephx` v2.1 while docs said v2.0, and the `.cepht` 1.0/2.0 split was
// undocumented with only a minimal `validateCepht` (D5).
//
// This module is the single source of truth for the on-disk format:
//   • `importCephxPayload` validates shape, checks/normalizes the version,
//     migrates known versions, and normalizes every session's images to the
//     current `session.images[]` shape before the project enters app state.
//   • `validateCepht` is version-aware (1.0 = definitions only, 2.0 = with
//     point coords) and checks the markups array structure.
//   • `normalizeSessionImages` is shared by import AND export so the two paths
//     can't drift again.
//
// Non-fatal oddities (unknown future version, missing optional fields) are
// returned as `warnings` rather than rejected — the goal is to never lose a
// user's data over a strict schema check. Only structurally broken payloads
// (no project, no sessions array) are rejected.

import { uid } from "../utils.js";

export const CEPHX_FORMAT = "cephx";
// v2.0 → v2.1: `session.image` (singular) deprecated in favour of
// `session.images[]` (normalized on import now, not only export).
export const CEPHX_VERSION = "2.1";
// Known historical versions, oldest first. Used for migration routing + to
// decide whether an unknown/newer version is "warn but accept" vs "reject".
export const CEPHX_KNOWN_VERSIONS = ["2.0", "2.1"];

export const CEPHT_FORMAT = "cepht";
// 1.0 = definitions only (no point coordinates).
// 2.0 = definitions + placed point coordinates (full template).
export const CEPHT_VERSIONS = ["1.0", "2.0"];

// ─── Image-entry shape ───────────────────────────────────────────────────
// The canonical image entry. Legacy files may store a bare dataUrl string or a
// partial object in `session.image`; both are coerced here.
export function normalizeImageEntry(oldImg) {
  if (!oldImg) return null;
  // Bare dataUrl string (very old shape).
  if (typeof oldImg === "string") {
    return {
      id: uid(), name: "Imported", dataUrl: oldImg, dx: 0, dy: 0,
      opacity: 1, blendMode: "normal", visible: true, color: "none",
      transform: { tx: 0, ty: 0, rot: 0, scale: 1 },
    };
  }
  if (typeof oldImg !== "object") return null;
  const num = (v, d) => (typeof v === "number" && isFinite(v)) ? v : d;
  return {
    id: oldImg.id || uid(),
    name: typeof oldImg.name === "string" ? oldImg.name : "Imported",
    dataUrl: typeof oldImg.dataUrl === "string" ? oldImg.dataUrl : (oldImg.dataUrl || null),
    dx: num(oldImg.dx, 0),
    dy: num(oldImg.dy, 0),
    opacity: num(oldImg.opacity, 1),
    blendMode: typeof oldImg.blendMode === "string" ? oldImg.blendMode : "normal",
    visible: oldImg.visible !== false,
    color: typeof oldImg.color === "string" ? oldImg.color : "none",
    transform: {
      tx: num(oldImg.transform?.tx, 0),
      ty: num(oldImg.transform?.ty, 0),
      rot: num(oldImg.transform?.rot, 0),
      scale: num(oldImg.transform?.scale, 1),
    },
  };
}

// Normalize a session's images into the canonical `session.images[]` array,
// dropping the legacy singular `session.image` field. Returns a new session
// object (non-mutating). Shared by import + export (D4/R4-adjacent).
export function normalizeSessionImages(session) {
  if (!session || typeof session !== "object") return session;
  const images = Array.isArray(session.images) ? session.images.slice() : [];
  if (images.length === 0 && session.image != null) {
    const entry = normalizeImageEntry(session.image);
    if (entry) images.push(entry);
  }
  const out = { ...session, images };
  // Remove the deprecated singular field once normalized.
  if ("image" in out) out.image = undefined;
  return out;
}

// Coerce a session into a safe shape, ensuring required arrays/objects exist.
function sanitizeSession(session, warnings) {
  if (!session || typeof session !== "object") return null;
  const s = normalizeSessionImages(session);
  s.markups = Array.isArray(s.markups) ? s.markups : [];
  s.formulas = Array.isArray(s.formulas) ? s.formulas : [];
  s.norms = Array.isArray(s.norms) ? s.norms : [];
  s.calibration = s.calibration && typeof s.calibration === "object"
    ? s.calibration
    : { done: false, pxPerMm: 1, knownMm: "" };
  s.meta = (s.meta && typeof s.meta === "object") ? s.meta : {};
  if (!s.id) { s.id = uid(); warnings.push("A session was missing its id; a new one was generated."); }
  return s;
}

// ─── Migration table ──────────────────────────────────────────────────────
// Each entry migrates FROM that version. v2.0 → v2.1 normalizes the singular
// image field (handled by normalizeSessionImages, so this is a marker). Add
// entries for future bumps; migrations run in version order.
const CEPHX_MIGRATIONS = {
  "2.0"(project, warnings) {
    // session.image → session.images[] is normalized in sanitizeSession; this
    // marker just records that we ran the 2.0→2.1 pass.
    warnings.push("Migrated .cephx from v2.0 to v2.1 (session.image → session.images[]).");
    return project;
  },
};

function versionIndex(v, known) {
  return known.indexOf(v);
}

// ─── .cephx import ────────────────────────────────────────────────────────
// `payload` is the parsed JSON of a .cephx file. Returns:
//   { ok:true, project, version, warnings[] }  on success
//   { ok:false, error }                         on hard rejection
// Non-fatal issues are reported in `warnings` (caller can surface them). We
// only reject when there is no usable project to load — losing a user's data
// to a strict schema check is worse than a deformed import.
export function importCephxPayload(payload) {
  const warnings = [];
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid file: not a JSON object." };
  }
  if (payload.format !== CEPHX_FORMAT) {
    // Reject any *explicit* wrong format string — only allow the (common)
    // case where the field is absent entirely and a `project` object exists.
    if (typeof payload.format === "string" && payload.format !== "") {
      return { ok: false, error: `Not a valid .cephx file (format is "${payload.format}").` };
    }
    // Missing / empty format tag — accept if there is usable project data.
    if (payload.project && typeof payload.project === "object") {
      warnings.push("File is missing the 'cephx' format tag; importing as a legacy project.");
    } else {
      return { ok: false, error: "Not a valid .cephx file (missing 'cephx' format tag)." };
    }
  }
  let project = payload.project;
  if (!project || typeof project !== "object") {
    return { ok: false, error: "File has no project data." };
  }

  // Version check + migration routing.
  const version = payload.version || "2.0";
  const knownIdx = versionIndex(version, CEPHX_KNOWN_VERSIONS);
  if (knownIdx === -1) {
    // Unknown / newer version. Accept (best-effort) but warn loudly — refusing
    // a newer file would lock the user out of their own data on downgrade.
    warnings.push(`Unknown .cephx version "${version}" — importing as v${CEPHX_VERSION} (best-effort).`);
  } else {
    // Run migrations from the file's version up to (but not including) the
    // current version, in order.
    const targetIdx = versionIndex(CEPHX_VERSION, CEPHX_KNOWN_VERSIONS);
    for (let i = knownIdx; i < targetIdx; i++) {
      const from = CEPHX_KNOWN_VERSIONS[i];
      const m = CEPHX_MIGRATIONS[from];
      if (m) project = m(project, warnings) || project;
    }
  }

  // ─── Field validation + normalization ───────────────────────────────────
  project = { ...project };
  if (!project.id) { project.id = uid(); warnings.push("Project was missing an id; generated a new one."); }
  if (typeof project.name !== "string") project.name = "Imported Case";
  project.meta = (project.meta && typeof project.meta === "object") ? project.meta : {};
  // Drop the deprecated top-level `project.images` (very old shape); those
  // images are migrated into the first session below if present.
  const topImages = Array.isArray(project.images) ? project.images : null;
  if (topImages) {
    project.images = undefined;
    warnings.push("Removed deprecated top-level project.images field.");
  }

  if (!Array.isArray(project.sessions)) {
    return { ok: false, error: "Project has no sessions array." };
  }
  project.sessions = project.sessions
    .map(s => sanitizeSession(s, warnings))
    .filter(Boolean);

  if (project.sessions.length === 0) {
    return { ok: false, error: "Project has no valid sessions." };
  }

  // Migrate a top-level images array into the first session (very old shape).
  if (topImages && topImages.length) {
    const first = project.sessions[0];
    const existing = Array.isArray(first.images) ? first.images : [];
    const migrated = topImages.map(normalizeImageEntry).filter(Boolean);
    first.images = [...existing, ...migrated];
  }

  // Research arrays: keep as-is if arrays, else default to empty.
  for (const k of ["researchStudies", "subjects", "groups", "timepoints", "operators"]) {
    project[k] = Array.isArray(project[k]) ? project[k] : [];
  }
  // Legacy reproStudies was removed from the model; drop it silently if present.
  if ("reproStudies" in project) project.reproStudies = undefined;

  // Ensure activeSessionId points at a real session.
  if (!project.sessions.some(s => s.id === project.activeSessionId)) {
    project.activeSessionId = project.sessions[0].id;
  }

  return { ok: true, project, version: CEPHX_VERSION, warnings };
}

// ─── .cepht validation (enhanced for D5) ──────────────────────────────────
// Returns null if valid, or a human-readable error string. Distinguishes the
// 1.0 (definitions only) and 2.0 (with coords) variants and validates the
// markups array shape rather than just checking it exists.
export function validateCepht(data) {
  if (!data || typeof data !== "object") return "Invalid file format.";
  if (data.format !== CEPHT_FORMAT) return "Not a valid .cepht template file.";
  if (!data.markups || !Array.isArray(data.markups)) return "Template must contain a markups array.";
  if (typeof data.name !== "string" && data.name != null) return "Template name must be a string.";
  // Version check.
  const v = data.version || "1.0";
  if (!CEPHT_VERSIONS.includes(v)) {
    return `Unsupported .cepht version "${v}". Supported: ${CEPHT_VERSIONS.join(", ")}.`;
  }
  // Per-markup shape check (non-throwing).
  for (let i = 0; i < data.markups.length; i++) {
    const m = data.markups[i];
    if (!m || typeof m !== "object") return `Markup #${i + 1} is not an object.`;
    if (typeof m.label !== "string" && m.label != null) return `Markup #${i + 1} has a non-string label.`;
  }
  // 2.0 templates may carry point coords; warn (not reject) if coords are
  // malformed — the importer re-derives `placed` from their presence.
  if (v === "2.0") {
    for (let i = 0; i < data.markups.length; i++) {
      const m = data.markups[i];
      if (m.points != null && !Array.isArray(m.points)) {
        return `Markup #${i + 1} has non-array points (expected [{x,y},...] or absent).`;
      }
    }
  }
  return null;
}
