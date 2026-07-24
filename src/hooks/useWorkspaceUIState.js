// ═══════════════════════════════════════════════════════════════════════════════
// Workspace UI state bundle — consolidates ~10 useState calls from App.jsx
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";

export function useWorkspaceUIState() {
  // ── Session comparison ──
  const [compareSession, setCompareSession] = useState(null);

  // ── Context menu ──
  const [contextMenu, setContextMenu] = useState(null);

  // ── Toggles ──
  const [showGrid, setShowGrid] = useState(false);
  const [showAirwayOverlay, setShowAirwayOverlay] = useState(false);
  const [showReportOptions, setShowReportOptions] = useState(false);
  const [filmstripOpen, setFilmstripOpen] = useState(true);

  // ── Guide / Report ──
  const [guideKey, setGuideKey] = useState(null);
  const defaultSections = { cover: true, images: true, measurements: true, normograms: true, research: true, formulas: true, interpretation: true };
  const [reportSections, setReportSections] = useState({ ...defaultSections });

  // ── Pinned formulas ──
  const [pinnedFormulas, setPinnedFormulas] = useState(new Set());

  return {
    compareSession, setCompareSession,
    contextMenu, setContextMenu,
    showGrid, setShowGrid,
    showAirwayOverlay, setShowAirwayOverlay,
    showReportOptions, setShowReportOptions,
    filmstripOpen, setFilmstripOpen,
    guideKey, setGuideKey,
    defaultSections,
    reportSections, setReportSections,
    pinnedFormulas, setPinnedFormulas,
  };
}
