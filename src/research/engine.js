import { runReliabilityAll } from "./reliability.js";
import { runDescriptiveAll } from "./descriptive.js";
import { runComparativeAll } from "./comparative.js";
import { runLongitudinalAll } from "./longitudinal.js";
import { runCorrelationAll, runRegression, runLogisticRegression } from "./correlation.js";
import { runDiagnosticAll } from "./diagnostic.js";

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
        results = runComparativeAll(sessions, config, calibration);
        break;
      case "longitudinal":
        results = runLongitudinalAll(sessions, config, calibration);
        break;
      case "correlation":
        results = runCorrelationAll(sessions, config, calibration);
        if (config.dependentVar && config.predictorVars?.length > 0) {
          results.regression = runRegression(sessions, config, calibration);
        }
        if (config.dependentVar && config.predictorVars?.length > 0 && config.threshold !== undefined && config.threshold !== "") {
          results.logistic = runLogisticRegression(sessions, config, calibration);
        }
        break;
      case "diagnostic":
        results = runDiagnosticAll(sessions, config, calibration);
        break;

      default:
        results = { note: "Unknown study type" };
    }
  } catch (e) {
    if (import.meta.env.DEV) console.error("Study run error:", e);
    return { ...study, status: "error", results: { error: e.message } };
  }

  return {
    ...study,
    status: "completed",
    updatedAt: Date.now(),
    results,
  };
}
