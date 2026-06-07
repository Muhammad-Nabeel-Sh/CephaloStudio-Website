export const STUDY_TYPES = [
  { id: "reliability",  name: "Reliability",     icon: "🎯", desc: "Intra/Inter-observer ICC, Bland-Altman, SEM", color: "#60a5fa", needsGroups: true  },
  { id: "descriptive",  name: "Descriptive",     icon: "📊", desc: "Means, SDs, percentiles, normative ranges",      color: "#34d399", needsGroups: false },
  { id: "comparative",  name: "Comparative",     icon: "⚖",  desc: "t-tests, ANOVA, effect sizes",                   color: "#f472b6", needsGroups: true  },
  { id: "longitudinal", name: "Longitudinal",    icon: "📈", desc: "Growth tracking, change scores",                 color: "#fb923c", needsGroups: false },
  { id: "correlation",  name: "Correlation",     icon: "🔗", desc: "Pearson/Spearman, regression",                   color: "#a78bfa", needsGroups: false },
  { id: "diagnostic",   name: "Diagnostic",      icon: "🏥", desc: "Sensitivity, specificity, ROC",                  color: "#f59e0b", needsGroups: true  },
  { id: "morphometrics",name: "Morphometrics",   icon: "🧬", desc: "Procrustes, PCA, shape analysis",                color: "#22d3ee", needsGroups: false },
];

export function mkStudy(type, opts = {}) {
  const meta = STUDY_TYPES.find(s => s.id === type);
  return {
    id: opts.id || Math.random().toString(36).slice(2, 10),
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
}
