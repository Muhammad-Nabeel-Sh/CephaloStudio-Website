// ═══════════════════════════════════════════════════════════════════════════════
// STUDY GUIDE MODAL — Context-sensitive help for each research study type
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { Modal } from "../panels/Modal.jsx";

const STEP_COLORS = {
  setup: { bg: "#3b82f6", label: "Setup" },
  configure: { bg: "#8b5cf6", label: "Configure" },
  run: { bg: "#10b981", label: "Run" },
  review: { bg: "#f59e0b", label: "Review" },
};

function StepBadge({ type }) {
  const c = STEP_COLORS[type];
  if (!c) return null;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 4,
      background: c.bg + "22", color: c.bg, letterSpacing: 0.3, marginLeft: 8,
    }}>
      {c.label}
    </span>
  );
}

function StepTimeline({ steps, t }) {
  return (
    <div style={{ marginLeft: 26, position: "relative" }}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const stepType = step.type || "setup";
        const c = STEP_COLORS[stepType] || STEP_COLORS.setup;
        return (
          <div key={i} style={{ display: "flex", gap: 14, position: "relative", minHeight: isLast ? 0 : 52 }}>
            {/* Connector line */}
            {!isLast && (
              <div style={{
                position: "absolute", left: 12, top: 26, width: 2,
                height: "calc(100% + 8px)", background: t.bdr + "88",
              }} />
            )}
            {/* Step number circle */}
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: c.bg, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 2,
              position: "relative", zIndex: 1,
            }}>
              {i + 1}
            </div>
            {/* Step content */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 14 }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: c.bg }}>{step.label || `Step ${i + 1}`}</span>
                {step.type && <StepBadge type={step.type} />}
              </div>
              <div style={{ fontSize: 11, color: t.tx2, lineHeight: 1.6, marginTop: 3 }}>
                {step.body}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Reliability SVG diagrams — three workflow types
// Each diagram shows session→case→rater mapping for a different design

function RelDiagram({ type, t }) {
  const color = type === "intra" ? "#3b82f6" : type === "inter" ? "#8b5cf6" : "#10b981";
  const light = color + "22";
  const labels = {
    intra: { title: "Intra-Observer", desc: "Same rater, repeat sessions", occ1: "Occasion 1", occ2: "Occasion 2 (2 weeks later)" },
    inter: { title: "Inter-Observer", desc: "Different raters, same session", rater1: "Rater 1 (Dr. Smith)", rater2: "Rater 2 (Dr. Jones)" },
    method: { title: "Method Comparison", desc: "Same case, two methods", m1: "Digital Tracing", m2: "Manual Tracing" },
  };
  const l = labels[type] || labels.intra;
  return (
    <svg viewBox="0 0 640 260" style={{ width: "100%", maxWidth: 640, height: "auto", display: "block" }}>
      <text x="320" y="22" textAnchor="middle" fill={color} fontSize="13" fontWeight="700" fontFamily="sans-serif">{l.title}</text>
      <text x="320" y="38" textAnchor="middle" fill={color + "cc"} fontSize="10" fontFamily="sans-serif">{l.desc}</text>

      {/* Case box */}
      <rect x="260" y="56" width="120" height="48" rx="8" fill={light} stroke={color} strokeWidth="1.5" />
      <text x="320" y="76" textAnchor="middle" fill={color} fontSize="12" fontWeight="600" fontFamily="sans-serif">Case (Patient 42)</text>
      <text x="320" y="95" textAnchor="middle" fill={color + "cc"} fontSize="10" fontFamily="sans-serif">Same radiograph</text>

      {type === "intra" && (
        <>
          <line x1="320" y1="104" x2="190" y2="134" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <rect x="70" y="130" width="140" height="44" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="140" y="149" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">Session A ({l.occ1})</text>
          <text x="140" y="166" textAnchor="middle" fill={color + "cc"} fontSize="10" fontFamily="sans-serif">Dr. Smith places marks</text>
          <line x1="320" y1="104" x2="450" y2="134" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <rect x="430" y="130" width="140" height="44" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="500" y="149" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">Session B ({l.occ2})</text>
          <text x="500" y="166" textAnchor="middle" fill={color + "cc"} fontSize="10" fontFamily="sans-serif">Dr. Smith re-places marks</text>
          <line x1="140" y1="174" x2="140" y2="195" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="500" y1="174" x2="500" y2="195" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="140" y1="198" x2="500" y2="198" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="320" y1="198" x2="320" y2="215" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <text x="320" y="237" textAnchor="middle" fill={color} fontSize="11" fontWeight="700" fontFamily="sans-serif">ICC, Bland-Altman, SEM</text>
        </>
      )}

      {type === "inter" && (
        <>
          <line x1="320" y1="104" x2="190" y2="134" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <rect x="60" y="130" width="160" height="44" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="140" y="149" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">{l.rater1}</text>
          <text x="140" y="166" textAnchor="middle" fill={color + "cc"} fontSize="10" fontFamily="sans-serif">Places marks independently</text>
          <line x1="320" y1="104" x2="450" y2="134" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <rect x="420" y="130" width="160" height="44" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="500" y="149" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">{l.rater2}</text>
          <text x="500" y="166" textAnchor="middle" fill={color + "cc"} fontSize="10" fontFamily="sans-serif">Places marks independently</text>
          <line x1="140" y1="174" x2="140" y2="195" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="500" y1="174" x2="500" y2="195" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="140" y1="198" x2="500" y2="198" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="320" y1="198" x2="320" y2="215" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <text x="320" y="237" textAnchor="middle" fill={color} fontSize="11" fontWeight="700" fontFamily="sans-serif">ICC, Bland-Altman, SEM</text>
        </>
      )}

      {type === "method" && (
        <>
          <line x1="320" y1="104" x2="190" y2="134" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <rect x="60" y="130" width="160" height="44" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="140" y="149" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">{l.m1}</text>
          <text x="140" y="166" textAnchor="middle" fill={color + "cc"} fontSize="10" fontFamily="sans-serif">Measure on digital image</text>
          <line x1="320" y1="104" x2="450" y2="134" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <rect x="420" y="130" width="160" height="44" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="500" y="149" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">{l.m2}</text>
          <text x="500" y="166" textAnchor="middle" fill={color + "cc"} fontSize="10" fontFamily="sans-serif">Measure on printed film</text>
          <line x1="140" y1="174" x2="140" y2="195" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="500" y1="174" x2="500" y2="195" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="140" y1="198" x2="500" y2="198" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="320" y1="198" x2="320" y2="215" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <text x="320" y="237" textAnchor="middle" fill={color} fontSize="11" fontWeight="700" fontFamily="sans-serif">Bland-Altman, Deming regression</text>
        </>
      )}

      <defs>
        <marker id="arr" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill={color + "88"} />
        </marker>
      </defs>
    </svg>
  );
}

const GUIDES = {
  reliability: {
    title: "Reliability Study Guide",
    diagramTypes: ["intra", "inter", "method"],
    diagramLabels: { intra: "Intra-Observer", inter: "Inter-Observer", method: "Method Comparison" },
    sections: [
      {
        heading: "What it measures",
        body: "Quantifies the reproducibility and consistency of landmark identification and measurements. Determines whether repeated measurements by the same rater (intra-observer) or different raters (inter-observer) produce clinically acceptable agreement.",
        icon: "🎯",
      },
      {
        heading: "When to use",
        body: "Before starting a clinical study or multi-rater project. Run a reliability study to: (1) calibrate raters against a gold standard, (2) determine if a new measurement method is reproducible enough for clinical use, or (3) establish the measurement error for sample size calculations in a planned study.",
        icon: "📋",
      },
      {
        heading: "Data requirements",
        body: "Each case must have ≥ 2 sessions marked by the same rater (intra) or by different raters (inter). Labels must match across sessions. A minimum of 10 cases is recommended for stable ICC estimates; 30+ cases for precise confidence intervals (Walter et al. 1998).",
        icon: "📊",
      },
      {
        heading: "Step-by-step workflow",
        icon: "📝",
        steps: [
          {
            label: "Create reliability sessions",
            body: "For each case, create separate sessions for each rater/occasion. Use Duplicate Session and assign operator IDs via the Session Metadata modal.",
            type: "setup",
          },
          {
            label: "Map sessions to cases",
            body: "Go to the Sessions panel → Reliability tab. Map each session to a case, operator, and occasion number. This tells the engine which measurements should be compared.",
            type: "setup",
          },
          {
            label: "Create & configure study",
            body: "Go to Research → New Study → Reliability. Choose intra-observer (same rater, repeat sessions) or inter-observer (different raters). Set the ICC model (2,1 absolute is most common) and minimum time separation between occasions.",
            type: "configure",
          },
          {
            label: "Select measurement labels",
            body: "Choose which landmark labels to include. Only labels present in ALL mapped sessions with the same name will be analyzed.",
            type: "configure",
          },
          {
            label: "Run the study",
            body: "Click Run. The engine computes ICC with 95% CI, Bland-Altman limits, Dahlberg/SEM/MDC, and landmark error maps for each selected label.",
            type: "run",
          },
          {
            label: "Review results & warnings",
            body: "Check the warnings section for sample size concerns or time-separation violations. Open the Results dialog to explore charts and export data.",
            type: "review",
          },
        ],
      },
      {
        heading: "Output explained",
        items: [
          { label: "ICC (2,1)", desc: "Absolute agreement — the primary metric. >0.90 = excellent, 0.75–0.90 = good, 0.50–0.75 = moderate, <0.50 = poor" },
          { label: "95% CI", desc: "Confidence interval for the ICC. Wide CI = imprecise estimate (need more cases)" },
          { label: "Bland-Altman", desc: "Mean difference ± 1.96 SD = limits of agreement. The bias CI tells you if the mean difference is significantly different from zero" },
          { label: "Dahlberg Error", desc: "Technical error of measurement in the original unit (mm or px). √(Σd²/2n)" },
          { label: "SEM", desc: "Standard error of measurement — same as Dahlberg for single measurements" },
          { label: "MDC (95%)", desc: "Minimal detectable change = 1.96 × √2 × SEM. Changes smaller than this cannot be distinguished from measurement error" },
        ],
        icon: "📈",
      },
      {
        heading: "Tips & limitations",
        body: "• ICC assumes that cases are a random sample from the population and raters are either fixed or random depending on the model.\n• With fewer than 10 cases, ICC confidence intervals will be wide — interpret as preliminary.\n• Bland-Altman with 3+ occasions: all pairwise differences are computed, which inflates the sample size for the bias CI — a variance-inflation factor is applied to compensate.\n• The landmark error map reports radial errors around the mean landmark position. Use it to identify landmarks with poor placement consistency.",
        icon: "💡",
      },
    ],
  },
};

export default function StudyGuideModal({ t, studyType, onClose }) {
  const guide = GUIDES[studyType];
  const [diagramTab, setDiagramTab] = useState(guide?.diagramTypes?.[0] || null);
  if (!guide) return null;

  return (
    <Modal t={t} title={guide.title} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {guide.diagramTypes && (
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8 }}>
              {guide.diagramTypes.map(dt => (
                <button key={dt} onClick={() => setDiagramTab(dt)}
                  style={{
                    padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 600,
                    background: diagramTab === dt ? t.acc : t.surf3,
                    color: diagramTab === dt ? "#fff" : t.tx2,
                    transition: "all 0.15s",
                  }}>
                  {guide.diagramLabels?.[dt] || dt}
                </button>
              ))}
            </div>
            <RelDiagram type={diagramTab} t={t} />
          </div>
        )}
        {guide.sections.map((section, i) => (
          <div key={i}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>{section.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{section.heading}</span>
            </div>

            {section.body && (
              <div style={{ fontSize: 12, color: t.tx2, lineHeight: 1.6, whiteSpace: "pre-wrap", marginLeft: 26 }}>{section.body}</div>
            )}

            {section.steps && (
              <StepTimeline steps={section.steps} t={t} />
            )}

            {section.items && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 26 }}>
                {section.items.map((item, j) => (
                  <div key={j} style={{ fontSize: 12, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 600, color: t.tx }}>{item.label}</span>
                    <span style={{ color: t.tx2 }}> — {item.desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
