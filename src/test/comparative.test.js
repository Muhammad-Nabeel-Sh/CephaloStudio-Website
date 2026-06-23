import { describe, it, expect } from "vitest";
import { runComparativeAll } from "../research/comparative.js";

function makeSession(id, markups, opts = {}) {
  return { id, markups, calibration: { done: true, pxPerMm: 1 }, meta: { group: "", timepoint: "" }, ...opts };
}

function makePoint(label, x) {
  return { type: "point", label, points: [{ x, y: 999 }], visible: true, placed: true, id: `${label}_${Date.now()}_${Math.random()}_${x}` };
}

describe("runComparativeAll", () => {
  it("returns error when fewer than 2 groups", () => {
    const result = runComparativeAll([], { design: "independent", groups: [], labelIds: [] });
    expect(result.error).toBeDefined();
  });

  it("routes to Independent t-test for 2 groups with varying data", () => {
    const aSessions = Array.from({ length: 20 }, (_, i) => makeSession(`a${i}`, [makePoint("M", 10 + (i % 3) * 0.5)]));
    const bSessions = Array.from({ length: 20 }, (_, i) => makeSession(`b${i}`, [makePoint("M", 12 + (i % 3) * 0.5)]));
    const sessions = [...aSessions, ...bSessions];
    const aIds = aSessions.map(s => s.id);
    const bIds = bSessions.map(s => s.id);

    const config = {
      design: "independent",
      groups: [
        { label: "Group A", caseIds: aIds },
        { label: "Group B", caseIds: bIds },
      ],
      labelIds: ["M"],
      alpha: 0.05,
      mcCorrection: "none",
    };
    const result = runComparativeAll(sessions, config);

    expect(result.labels).toBeDefined();
    expect(result.labels.M).toBeDefined();
    expect(result.labels.M.skip).toBeFalsy();
    expect(result.labels.M.result).not.toBeNull();
    // With n=20, near-normal data should route to a t-test variant
    expect(result.labels.M.testName).toMatch(/t-test/i);
    expect(Math.abs(result.labels.M.result.t)).toBeGreaterThan(0);
  });

  it("returns result structure for 3 groups", () => {
    const aS = Array.from({ length: 6 }, (_, i) => makeSession(`a${i}`, [makePoint("M", 10 + i)]));
    const bS = Array.from({ length: 6 }, (_, i) => makeSession(`b${i}`, [makePoint("M", 15 + i)]));
    const cS = Array.from({ length: 6 }, (_, i) => makeSession(`c${i}`, [makePoint("M", 20 + i)]));
    const sessions = [...aS, ...bS, ...cS];
    const config = {
      design: "independent",
      groups: [
        { label: "Group A", caseIds: aS.map(s => s.id) },
        { label: "Group B", caseIds: bS.map(s => s.id) },
        { label: "Group C", caseIds: cS.map(s => s.id) },
      ],
      labelIds: ["M"],
      alpha: 0.05,
      mcCorrection: "none",
    };
    const result = runComparativeAll(sessions, config);

    expect(result.labels.M).toBeDefined();
    expect(result.groups).toHaveLength(3);
  });
});
