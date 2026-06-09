import { uid } from "../utils.js";

export function mkSession(opts = {}) {
  return {
    id: uid(),
    label: opts.label || "",
    name: opts.name || "Untitled",
    timestamp: Date.now(),
    image: opts.image || null,
    markups: opts.markups || [],
    calibration: opts.calibration || { done: false, pxPerMm: 1, knownMm: "" },
    processing: opts.processing || {
      brightness: 0, contrast: 0, windowWidth: 0, windowCenter: 128, edgeEnhance: 0,
    },
    lutMode: opts.lutMode || "gray",
    lutInvert: opts.lutInvert || false,
    analysisTemplate: opts.analysisTemplate || "blank",
    formulas: opts.formulas || [],
    norms: opts.norms || [],
    subjectId: opts.subjectId || opts.meta?.subjectId || "",
    meta: {
      patientId: opts.meta?.patientId || "",
      operatorId: opts.meta?.operatorId || "",
      group: opts.meta?.group || "",
      timepoint: opts.meta?.timepoint || "",
      age: opts.meta?.age || "",
      sex: opts.meta?.sex || "",
      trialNumber: opts.meta?.trialNumber ?? null,
      tags: opts.meta?.tags || [],
    },
  };
}

export function updateSession(session, patch) {
  return { ...session, ...patch, meta: { ...session.meta, ...(patch.meta || {}) } };
}

export function duplicateSession(session) {
  return mkSession({
    ...session,
    label: session.label ? session.label + "c" : "",
    name: "Copy of " + session.name,
    image: session.image ? { ...session.image, id: uid() } : null,
    markups: (session.markups || []).map(m => ({ ...m, id: uid() })),
    formulas: (session.formulas || []).map(f => ({ ...f, id: uid() })),
    norms: (session.norms || []).map(n => ({ ...n, id: uid() })),
    subjectId: session.subjectId,
    meta: { ...session.meta },
  });
}

export function getActiveMarkups(sessions, activeId) {
  const s = sessions.find(s => s.id === activeId);
  return s?.markups || [];
}

export function getActiveCalibration(sessions, activeId) {
  const s = sessions.find(s => s.id === activeId);
  return s?.calibration || { done: false, pxPerMm: 1 };
}

export function getSessionsBySubject(sessions, subjectId) {
  return sessions.filter(s => s.subjectId === subjectId);
}

export function getUniqueSubjects(sessions) {
  return [...new Set(sessions.map(s => s.subjectId).filter(Boolean))];
}

export function getUniqueGroups(sessions) {
  return [...new Set(sessions.map(s => s.meta?.group).filter(Boolean))];
}

export function getUniqueTimepoints(sessions) {
  return [...new Set(sessions.map(s => s.meta?.timepoint).filter(Boolean))];
}

export function getSessionMatrix(sessions, subjects, timepoints) {
  const matrix = {};
  for (const subj of subjects) {
    matrix[subj.id] = {};
    for (const tp of timepoints) {
      const match = sessions.find(s => s.subjectId === subj.id && s.meta?.timepoint === tp);
      matrix[subj.id][tp] = match || null;
    }
  }
  return matrix;
}
