import { uid } from "../utils.js";

export function mkReproStudy(opts = {}) {
  const type = opts.type || "intra";
  const numOps = type === "intra" ? 1 : (opts.numOperators || 2);
  return {
    id: uid(),
    name: opts.name || "Untitled Study",
    type,
    status: "configured",
    created: Date.now(),
    completedAt: null,
    sessionIds: opts.sessionIds || [],
    operators: Array.from({ length: numOps }, (_, i) => ({
      id: uid(),
      name: opts.operatorNames?.[i] || `Operator ${i + 1}`,
      trials: [],
    })),
    expectedTrials: type === "intra" ? (opts.expectedTrials || 3) : 1,
    intraNextTrialIdx: 0,
    interNextOpIdx: 0,
  };
}

export function reproAllLabels(study, sessions) {
  if (!study || !sessions) return [];
  const labels = new Set();
  for (const sid of study.sessionIds || []) {
    const s = sessions.find(s => s.id === sid);
    if (s) {
      for (const m of s.markups || []) {
        if (m.type === "point" && m.label) labels.add(m.label);
      }
    }
  }
  return [...labels].sort();
}

export function collectMeasurements(study, sessions) {
  const result = [];
  for (const op of study.operators || []) {
    for (const trial of op.trials || []) {
      // Read actual markup positions from the session
      const session = sessions.find(s => s.id === trial.sessionId);
      if (!session) continue;
      for (const meas of trial.measurements || []) {
        const markup = (session.markups || []).find(m => m.id === meas.markupId);
        if (markup && markup.points?.[0]) {
          result.push({
            operatorId: op.id,
            operatorName: op.name,
            trialIndex: trial.trialIndex,
            label: meas.label,
            x: markup.points[0].x,
            y: markup.points[0].y,
            measurementId: meas.id,
          });
        }
      }
    }
  }
  return result;
}
