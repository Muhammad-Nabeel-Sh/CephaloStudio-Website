const SI = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="`;

export const STUDY_TYPES = [
  { id: "reliability",  name: "Reliability",                    icon: SI + "M362-288 576-502l-56-56-158 158-84-84-56 56 140 140ZM480-80q-139-35-229.5-159.5T160-522v-238l320-120 320 120v238q0 138-90.5 262.5T480-80Zm0-82q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132Z\"/></svg>",  desc: "Intra/Inter-observer ICC, Bland-Altman, SEM", color: "#60a5fa", needsGroups: true  },
  { id: "descriptive",  name: "Descriptive and Normative Studies", icon: SI + "M120-120v-80h720v80H120Zm80-160v-280h120v280H200Zm230 0v-520h120v520H430Zm230 0v-400h120v400H660Z\"/></svg>",  desc: "Means, SDs, percentiles, normative ranges",      color: "#34d399", needsGroups: false },
  { id: "comparative",  name: "Comparative",                   icon: SI + "M440-80v-40L280-320q-50-50-77-110t-27-130q0-67 26-127.5T301-792l139-128v40h160v-40l139 128q50 50 76 110.5T840-560q0 70-27 130t-77 110L520-120v40H440Zm40-480q33 0 56.5-23.5T560-640q0-33-23.5-56.5T480-720q-33 0-56.5 23.5T400-640q0 33 23.5 56.5T480-560Z\"/></svg>",  desc: "t-tests, ANOVA, effect sizes",                   color: "#f472b6", needsGroups: true  },
  { id: "longitudinal", name: "Longitudinal",                  icon: SI + "M120-200v-80h220v80H120Zm0-160v-80h360v80H120Zm0-160v-80h480v80H120Zm0-160v-80h600v80H120Zm600 480-56-56 104-104H520v-80h248L664-504l56-56 200 200-200 200Z\"/></svg>",  desc: "Growth tracking, change scores",                 color: "#fb923c", needsGroups: false },
  { id: "correlation",  name: "Correlation",                   icon: SI + "M440-280H280q-83 0-141.5-58.5T80-480q0-83 58.5-141.5T280-680h160v80H280q-50 0-85 35t-35 85q0 50 35 85t85 35h160v80ZM320-440v-80h320v80H320Zm200 160v-80h160q50 0 85-35t35-85q0-50-35-85t-85-35H520v-80h160q83 0 141.5 58.5T880-480q0 83-58.5 141.5T680-280H520Z\"/></svg>",  desc: "Pearson/Spearman, regression",                   color: "#a78bfa", needsGroups: false },
  { id: "diagnostic",   name: "Diagnostic",                    icon: SI + "M420-120v-300H120v-120h300v-300h120v300h300v120H540v300H420Z\"/></svg>",  desc: "Sensitivity, specificity, ROC",                  color: "#f59e0b", needsGroups: true  },
  { id: "morphometrics",name: "Morphometrics",                 icon: SI + "M480-80 80-280v-400l400-200 400 200v400L480-80Zm0-112 280-150v-276L480-768 200-618v276l280 150Z\"/></svg>",  desc: "Procrustes, PCA, shape analysis",                color: "#22d3ee", needsGroups: false },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function mkStudy(type, opts = {}) {
  const meta = STUDY_TYPES.find(s => s.id === type);
  const base = {
    id: opts.id || uid(),
    type,
    name: opts.name || `New ${meta?.name || "Study"}`,
    description: opts.description || "",
    config: {
      sessionIds: opts.sessionIds || [],
      labelIds: opts.labelIds || [],
      groups: opts.groups || [],
      ...(opts.config || {}),
    },
    results: null,
    status: "configured",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (type === "reliability") {
    base.config.design = opts.config?.design || "intra";
    base.config.minTimeSeparation = opts.config?.minTimeSeparation ?? 14;
    base.config.operators = opts.config?.operators || [{ id: uid(), name: "Operator 1", role: "primary" }];
    base.config.cases = opts.config?.cases || [];
    base.config.protocol = {
      occasions: opts.config?.protocol?.occasions ?? 2,
      blindingEnforced: opts.config?.protocol?.blindingEnforced ?? false,
      revealAfter: opts.config?.protocol?.revealAfter || "all_complete",
    };
  }

  if (type === "descriptive") {
    base.config.groupBy = opts.config?.groupBy || "none";
    base.config.referenceNorms = opts.config?.referenceNorms || [];
  }

  if (type === "comparative") {
    base.config.design = opts.config?.design || "independent";
    base.config.alpha = opts.config?.alpha ?? 0.05;
    base.config.mcCorrection = opts.config?.mcCorrection || "bonferroni";
    base.config.groups = opts.config?.groups || [
      { id: uid(), label: "Group 1", caseIds: [] },
      { id: uid(), label: "Group 2", caseIds: [] },
    ];
  }

  if (type === "longitudinal") {
    base.config.timepoints = opts.config?.timepoints || [
      { id: uid(), label: "Pre", targetAge: null, window: 90 },
      { id: uid(), label: "Post", targetAge: null, window: 90 },
    ];
    base.config.subjects = opts.config?.subjects || [
      { id: uid(), label: "Subject 1", records: {} },
      { id: uid(), label: "Subject 2", records: {} },
    ];
    base.config.sphericityCorrection = opts.config?.sphericityCorrection || "greenhouse-geisser";
    base.config.modelType = opts.config?.modelType || "rm_anova";
  }

  return base;
}
