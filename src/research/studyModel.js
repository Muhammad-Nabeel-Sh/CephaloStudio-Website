export const STUDY_TYPES = [
  { id: "reliability",  name: "Reliability",     icon: "🎯", desc: "Intra/Inter-observer ICC, Bland-Altman, SEM", color: "#60a5fa", needsGroups: true  },
  { id: "descriptive",  name: "Descriptive",     icon: "📊", desc: "Means, SDs, percentiles, normative ranges",      color: "#34d399", needsGroups: false },
  { id: "comparative",  name: "Comparative",     icon: "⚖",  desc: "t-tests, ANOVA, effect sizes",                   color: "#f472b6", needsGroups: true  },
  { id: "longitudinal", name: "Longitudinal",    icon: "📈", desc: "Growth tracking, change scores",                 color: "#fb923c", needsGroups: false },
  { id: "correlation",  name: "Correlation",     icon: "🔗", desc: "Pearson/Spearman, regression",                   color: "#a78bfa", needsGroups: false },
  { id: "diagnostic",   name: "Diagnostic",      icon: "🏥", desc: "Sensitivity, specificity, ROC",                  color: "#f59e0b", needsGroups: true  },
  { id: "morphometrics",name: "Morphometrics",   icon: "🧬", desc: "Procrustes, PCA, shape analysis",                color: "#22d3ee", needsGroups: false },
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

  return base;
}
