import { uid } from "../utils.js";
import { mkSession, duplicateSession } from "./session.js";

export function mkProject(projection) {
  const session = mkSession({ label: "T0", name: "Initial" });
  return {
    id: uid(),
    name: "New Case",
    projection,
    created: Date.now(),
    modified: Date.now(),
    meta: {
      patientId: "", name: "", dob: "", age: "", gender: "",
      ethnicity: "", clinician: "", facility: "", referral: "",
      notes: "", anonymized: false,
    },
    sessions: [session],
    activeSessionId: session.id,
    reproStudies: [],
    researchStudies: [],
  };
}

export function getSession(project, sessionId) {
  return project.sessions.find(s => s.id === sessionId);
}

export function updateSessionInProject(project, sessionId, patch) {
  return {
    ...project,
    modified: Date.now(),
    sessions: project.sessions.map(s =>
      s.id === sessionId ? { ...s, ...patch } : s
    ),
  };
}

export function addSession(project, session) {
  return {
    ...project,
    modified: Date.now(),
    sessions: [...project.sessions, session],
    activeSessionId: session.id,
  };
}

export function removeSession(project, sessionId) {
  if (project.sessions.length <= 1) return project;
  const filtered = project.sessions.filter(s => s.id !== sessionId);
  return {
    ...project,
    modified: Date.now(),
    sessions: filtered,
    activeSessionId:
      project.activeSessionId === sessionId
        ? filtered[0]?.id
        : project.activeSessionId,
  };
}

export function duplicateSessionInProject(project, sessionId) {
  const src = project.sessions.find(s => s.id === sessionId);
  if (!src) return project;
  const dup = duplicateSession(src);
  return {
    ...project,
    modified: Date.now(),
    sessions: [...project.sessions, dup],
  };
}
