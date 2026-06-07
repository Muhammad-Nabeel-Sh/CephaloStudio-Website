import { collectMeasurements } from "./collect.js";
import { runReliabilityAll } from "./reliability.js";

export function runStudy(study, sessions, calibration, angleMode) {
  if (study.status === "running") return study;
  const config = study.config;
  const included = (config.sessionIds.length > 0
    ? sessions.filter(s => config.sessionIds.includes(s.id))
    : sessions).filter(Boolean);
  if (included.length === 0) return { ...study, status: "error", results: { error: "No sessions selected" } };

  const measurements = collectMeasurements(included, config.labelIds, calibration, angleMode);

  let results = { measurements: measurements.length, sessions: included.length, labels: [...new Set(measurements.map(r => r.label))].length };

  try {
    switch (study.type) {
      case "reliability":
        results = { ...results, details: runReliabilityAll(measurements, included, config) };
        break;
      case "descriptive":
      case "comparative":
      case "longitudinal":
      case "correlation":
      case "diagnostic":
      case "morphometrics":
        results = { ...results, note: "Module not yet implemented" };
        break;
      default:
        results = { ...results, note: "Unknown study type" };
    }
  } catch (e) {
    return { ...study, status: "error", results: { ...results, error: e.message } };
  }

  return {
    ...study,
    status: "completed",
    updatedAt: Date.now(),
    results,
  };
}
