import { runReliabilityAll } from "./reliability.js";
import { runDescriptiveAll } from "./descriptive.js";

export function runStudy(study, sessions, calibration) {
  if (study.status === "running") return study;
  const config = study.config;

  let results = {};

  try {
    switch (study.type) {
      case "reliability":
        results = runReliabilityAll(sessions, config, calibration);
        break;
      case "descriptive":
        results = runDescriptiveAll(sessions, config, calibration);
        break;
      case "comparative":
      case "longitudinal":
      case "correlation":
      case "diagnostic":
      case "morphometrics":
        results = { note: "Module not yet implemented" };
        break;
      default:
        results = { note: "Unknown study type" };
    }
  } catch (e) {
    return { ...study, status: "error", results: { error: e.message } };
  }

  return {
    ...study,
    status: "completed",
    updatedAt: Date.now(),
    results,
  };
}
