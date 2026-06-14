// ─── CSV Export for All Study Types ───────────────────────────────────────────

function esc(v) {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function download(filename, text) {
  const blob = new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export function exportResultsCSV(study) {
  const type = study.type;
  const res = study.results;
  if (!res) return;

  const name = study.name.replace(/\s+/g, "_");

  switch (type) {
    case "reliability":
      return exportReliabilityCSV(name, res);
    case "descriptive":
      return exportDescriptiveCSV(name, res);
    case "comparative":
      return exportComparativeCSV(name, res);
    case "longitudinal":
      return exportLongitudinalCSV(name, res);
    case "correlation":
      return exportCorrelationCSV(name, res);
    case "diagnostic":
      return exportDiagnosticCSV(name, res);
    default:
      return;
  }
}

function exportReliabilityCSV(name, res) {
  const details = (res.details || []).filter(d => !d.skip);
  const rows = [["Label", "ICC", "CI_Lower", "CI_Upper", "Mean_Diff", "SD_Diff", "Dahlberg", "SEM", "MDC", "n"]];
  for (const d of details) {
    rows.push([
      d.label, d.icc, d.ci95?.[0], d.ci95?.[1],
      d.meanDiff, d.sdDiff, d.dahlberg, d.sem, d.mdc, d.n,
    ].map(esc).join(","));
  }
  download(name + "_reliability.csv", rows.join("\n"));
}

function exportDescriptiveCSV(name, res) {
  const combined = res.combined || {};
  const labels = Object.keys(combined);
  const rows = [["Label", "n", "Mean", "SD", "SEM", "Min", "Max", "Q1", "Median", "Q3", "Skewness", "Kurtosis", "Shapiro_Wilk", "SW_p"]];
  for (const label of labels) {
    const s = combined[label]?.stats;
    if (!s) continue;
    rows.push([
      label, s.n, s.mean, s.sd, s.sem, s.min, s.max,
      s.q1, s.median, s.q3, s.skewness, s.kurtosis,
      s.shapiroWilk?.W, s.shapiroWilk?.p,
    ].map(esc).join(","));
  }
  download(name + "_descriptive.csv", rows.join("\n"));
}

function exportComparativeCSV(name, res) {
  const labels = Object.entries(res.labels || {}).filter(([, lr]) => !lr.skip);
  const rows = [["Label", "Test", "Statistic", "p_Value", "Significant", "Effect_Size", "ES_Type", "ES_Interpretation"]];
  for (const [label, lr] of labels) {
    const r = lr.result;
    const es = lr.effectSize;
    const esVal = es ? (es.cohensD ?? es.cohensDz ?? es.rankBiserial ?? es.etaSq ?? es.partialEtaSq ?? "") : "";
    rows.push([
      label, r?.testType, r?.statistic, r?.pValue,
      r?.pValue != null && r?.pValue < (res.alpha || 0.05) ? "Yes" : "No",
      esVal, es?.measure, es?.interpretation,
    ].map(esc).join(","));
  }
  download(name + "_comparative.csv", rows.join("\n"));
}

function exportLongitudinalCSV(name, res) {
  const labels = Object.entries(res.labels || {}).filter(([, lr]) => !lr.skip);
  const rows = [["Label", "From", "To", "Mean_Change", "SD_Change", "p_Value", "dz"]];
  for (const [label, lr] of labels) {
    const ch = lr.changeScores || [];
    for (const c of ch) {
      rows.push([label, c.from, c.to, c.meanChange, c.sdChange, c.pValue, c.dz].map(esc).join(","));
    }
  }
  download(name + "_longitudinal.csv", rows.join("\n"));
}

function exportCorrelationCSV(name, res) {
  const { vars, matrix } = res;
  if (!vars || !matrix) return;
  const rows = [["Var1", "Var2", "r", "p_Value", "Significant"]];
  for (let i = 0; i < vars.length; i++) {
    for (let j = 0; j < vars.length; j++) {
      const d = matrix[vars[i]]?.[vars[j]];
      if (!d) continue;
      rows.push([vars[i], vars[j], d.r, d.p, d.sigAdj ? "Yes" : "No"].map(esc).join(","));
    }
  }
  download(name + "_correlation.csv", rows.join("\n"));
}

function exportDiagnosticCSV(name, res) {
  const preds = Object.entries(res.predictors || {});
  const rows = [["Predictor", "AUC", "AUC_SE", "AUC_CI_Lower", "AUC_CI_Upper", "Optimal_Threshold", "Sensitivity", "Specificity", "Accuracy", "PPV", "NPV", "LR+", "LR-"]];

  for (const [predName, pred] of preds) {
    const auc = pred.auc;
    const ct = pred.confusionMatrix;
    rows.push([
      predName,
      auc?.auc, auc?.se, auc?.ci95?.[0], auc?.ci95?.[1],
      ct?.threshold, ct?.sensitivity, ct?.specificity,
      ct?.accuracy, ct?.ppv, ct?.npv, ct?.lrPlus, ct?.lrMinus,
    ].map(esc).join(","));
  }
  download(name + "_diagnostic.csv", rows.join("\n"));
}
