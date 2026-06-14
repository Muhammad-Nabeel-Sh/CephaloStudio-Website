import { useState } from "react";
import { Modal } from "../panels/Modal.jsx";
import { ReliabilityResults } from "./ReliabilityPanel.jsx";
import { DescriptiveResults } from "./DescriptivePanel.jsx";
import { ComparativeResults } from "./ComparativePanel.jsx";
import { LongitudinalResults } from "./LongitudinalPanel.jsx";
import { CorrelationResults } from "./CorrelationPanel.jsx";
import { DiagnosticResults } from "./DiagnosticPanel.jsx";
import { ReliabilityCharts, DescriptiveCharts, ComparativeCharts, LongitudinalCharts, CorrelationCharts, DiagnosticCharts } from "./moduleCharts.jsx";
import { exportResultsCSV } from "./resultsExport.js";

export default function ResultsDialog({ study, t, onClose }) {
  const [v, setV] = useState("tables");

  const meta = {
    reliability: { name: "Reliability", tabLabel: "Tables", results: ReliabilityResults, charts: ReliabilityCharts },
    descriptive: { name: "Descriptive and Normative Studies", tabLabel: "Tables", results: DescriptiveResults, charts: DescriptiveCharts },
    comparative: { name: "Comparative", tabLabel: "Tables", results: ComparativeResults, charts: ComparativeCharts },
    longitudinal: { name: "Longitudinal", tabLabel: "Tables", results: LongitudinalResults, charts: LongitudinalCharts },
    correlation: { name: "Correlation", tabLabel: "Tables", results: CorrelationResults, charts: CorrelationCharts },
    diagnostic: { name: "Diagnostic", tabLabel: "Tables", results: DiagnosticResults, charts: DiagnosticCharts },
  };
  const m = meta[study.type];
  if (!m) return null;

  const ResultsComp = m.results;
  const ChartsComp = m.charts;

  return (
    <Modal t={t} title={study.name} onClose={onClose} wide>
      <div style={{ display: "flex", gap: 2, marginBottom: 12, borderBottom: `1px solid ${t.bdr}44`, alignItems: "center" }}>
        {["tables", "charts"].map(tab => (
          <button key={tab} onClick={() => setV(tab)}
            style={{
              padding: "5px 10px", fontSize: 9, fontWeight: 600, cursor: "pointer",
              border: "none", borderBottom: v === tab ? `2px solid ${t.acc}` : "2px solid transparent",
              background: "transparent", color: v === tab ? t.acc : t.tx3, textTransform: "uppercase", letterSpacing: 0.3,
            }}>
            {tab === "tables" ? m.tabLabel : "Charts"}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => exportResultsCSV(study)}
          style={{
            padding: "4px 10px", fontSize: 9, fontWeight: 600, cursor: "pointer",
            border: `1px solid ${t.bdr}`, borderRadius: 4,
            background: t.surf2, color: t.tx2, letterSpacing: 0.3,
          }}>
          &#8595; CSV
        </button>
      </div>

      {v === "tables" && <ResultsComp results={study.results} t={t} />}
      {v === "charts" && study.results && <ChartsComp results={study.results} t={t} />}
    </Modal>
  );
}
