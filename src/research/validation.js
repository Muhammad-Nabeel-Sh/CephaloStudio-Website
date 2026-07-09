// ─── Study-design validation: minimum time separation enforcement ─────────
// `minTimeSeparation` (days) was previously defined in study config and exposed
// in the UI but NEVER validated — a reliability study could silently pair two
// occasions taken minutes apart (memory effect) or a "longitudinal" study could
// reuse the same session for two timepoints. These checks surface violations as
// structured warnings on the study results so the user is told the design is
// under-separated rather than running blind.
//
// Sessions carry a creation `timestamp` (ms since epoch); we measure the elapsed
// wall-clock gap between consecutive occasions/timepoints per case/subject.

const MS_PER_DAY = 86400000;

// Reliability: each case has sessions tagged with an `occasion` index. Check the
// gap between consecutive occasions (1→2, 2→3, …) for every case.
export function checkReliabilityTimeSeparation(sessions, cases, minDays) {
  if (!minDays || minDays <= 0 || !cases) return { checked: false, minDays: minDays || 0, violations: [] };
  const sesById = new Map((sessions || []).filter(s => s).map(s => [s.id, s]));
  const violations = [];
  for (const c of cases) {
    const occStamps = {}; // occasion -> latest session timestamp for that occasion
    for (const cs of (c.sessions || [])) {
      const ses = sesById.get(cs.sessionId);
      if (!ses || ses.timestamp == null) continue;
      const occ = Number(cs.occasion);
      if (!isFinite(occ)) continue;
      if (occStamps[occ] == null || ses.timestamp > occStamps[occ]) occStamps[occ] = ses.timestamp;
    }
    const occs = Object.keys(occStamps).map(Number).filter(isFinite).sort((a, b) => a - b);
    for (let i = 1; i < occs.length; i++) {
      const gapDays = (occStamps[occs[i]] - occStamps[occs[i - 1]]) / MS_PER_DAY;
      if (gapDays < minDays) {
        violations.push({
          caseId: c.id, caseName: c.name || c.id,
          from: occs[i - 1], to: occs[i],
          gapDays: +gapDays.toFixed(2), minDays,
        });
      }
    }
  }
  return { checked: true, minDays, violations };
}

// Longitudinal: each subject has a session per timepoint (records[tpId] = sessionId).
// Check the gap between consecutive timepoints (in config order) for every subject.
export function checkLongitudinalTimeSeparation(sessions, subjects, timepoints, minDays) {
  if (!minDays || minDays <= 0 || !subjects || !timepoints) return { checked: false, minDays: minDays || 0, violations: [] };
  const sesById = new Map((sessions || []).filter(s => s).map(s => [s.id, s]));
  const tpOrder = timepoints.map(tp => tp.id);
  const labelOf = id => (timepoints.find(tp => tp.id === id)?.label) || id;
  const violations = [];
  for (const subj of subjects) {
    const stamps = [];
    for (const tpId of tpOrder) {
      const sid = subj.records?.[tpId];
      const ses = sid ? sesById.get(sid) : null;
      if (ses && ses.timestamp != null) stamps.push({ tpId, t: ses.timestamp });
    }
    for (let i = 1; i < stamps.length; i++) {
      const gapDays = (stamps[i].t - stamps[i - 1].t) / MS_PER_DAY;
      if (gapDays < minDays) {
        violations.push({
          subjectId: subj.id, subjectLabel: subj.label || subj.id,
          from: labelOf(stamps[i - 1].tpId), to: labelOf(stamps[i].tpId),
          gapDays: +gapDays.toFixed(2), minDays,
        });
      }
    }
  }
  return { checked: true, minDays, violations };
}
