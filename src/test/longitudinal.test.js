import { describe, it, expect } from "vitest";
import { runLongitudinalAll } from "../research/longitudinal.js";

function makeSession(id, markups, opts = {}) {
  return { id, markups, calibration: { done: true, pxPerMm: 1 }, meta: { group: "", timepoint: "" }, ...opts };
}

function makePoint(label, x) {
  return { type: "point", label, points: [{ x, y: 999 }], visible: true, placed: true, id: `${label}_${Date.now()}_${Math.random()}_${x}` };
}

describe("runLongitudinalAll", () => {
  it("returns error when fewer than 2 timepoints", () => {
    const result = runLongitudinalAll([], { timepoints: [{ id: "T1", label: "T1" }], subjects: [] });
    expect(result.error).toContain("2 timepoints");
  });

  it("returns error when fewer than 3 subjects", () => {
    const result = runLongitudinalAll([], {
      timepoints: [{ id: "T0", label: "Baseline" }, { id: "T1", label: "Follow-up" }],
      subjects: [{ id: "S1", label: "S1", records: {} }],
    });
    expect(result.error).toContain("3 subjects");
  });

  it("runs RM-ANOVA for a single landmark across timepoints", () => {
    const sessions = [];
    const subjects = [];
    for (let s = 0; s < 4; s++) {
      const sid = `subj_${s}`;
      const tps = {};
      for (let t = 0; t < 3; t++) {
        const sesId = `${sid}_tp${t}`;
        const val = 10 + t * 5 + (s * 0.5) + (t * 0.2) + Math.random() * 0.1;
        sessions.push(makeSession(sesId, [makePoint("L", val)]));
        tps[`T${t}`] = sesId;
      }
      subjects.push({ id: `S${s}`, label: `Subject ${s}`, records: tps });
    }

    const config = {
      timepoints: [
        { id: "T0", label: "Baseline" },
        { id: "T1", label: "Follow-up 1" },
        { id: "T2", label: "Follow-up 2" },
      ],
      subjects,
      labelIds: ["L"],
      sphericityCorrection: "greenhouse-geisser",
      modelType: "rm_anova",
    };
    const result = runLongitudinalAll(sessions, config, { done: true, pxPerMm: 1 });

    expect(result.labels).toBeDefined();
    expect(result.labels.L).toBeDefined();
    expect(result.labels.L.skip).toBeFalsy();
    expect(result.labels.L.rmAnova).toBeDefined();
    expect(result.labels.L.rmAnova.F).toBeGreaterThan(0);
    expect(result.labels.L.pairwise).toBeDefined();
  });
});
