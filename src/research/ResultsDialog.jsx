import { useState } from "react";
import { Modal } from "../panels/Modal.jsx";
import { ReliabilityResults } from "./ReliabilityPanel.jsx";
import { DescriptiveResults } from "./DescriptivePanel.jsx";
import { ComparativeResults } from "./ComparativePanel.jsx";
import { LongitudinalResults } from "./LongitudinalPanel.jsx";
import { ReliabilityCharts, DescriptiveCharts, ComparativeCharts, LongitudinalCharts } from "./moduleCharts.jsx";

export default function ResultsDialog({ study, t, onClose }) {
  const [v, setV] = useState("tables");

  const meta = {
    reliability: { name: "Reliability", tabLabel: "Tables", results: ReliabilityResults, charts: ReliabilityCharts },
    descriptive: { name: "Descriptive and Normative Studies", tabLabel: "Tables", results: DescriptiveResults, charts: DescriptiveCharts },
    comparative: { name: "Comparative", tabLabel: "Tables", results: ComparativeResults, charts: ComparativeCharts },
    longitudinal: { name: "Longitudinal", tabLabel: "Tables", results: LongitudinalResults, charts: LongitudinalCharts },
  };
  const m = meta[study.type];
  if (!m) return null;

  const ResultsComp = m.results;
  const ChartsComp = m.charts;

  return (
    <Modal t={t} title={study.name} onClose={onClose} wide>
      <div style={{ display: "flex", gap: 2, marginBottom: 12, borderBottom: `1px solid ${t.bdr}44` }}>
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
      </div>

      {v === "tables" && <ResultsComp results={study.results} t={t} />}
      {v === "charts" && study.results && <ChartsComp results={study.results} t={t} />}
    </Modal>
  );
}
