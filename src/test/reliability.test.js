import { describe, it, expect } from "vitest";
import { runReliabilityAll } from "../research/reliability.js";

function makeSession(id, markups, opts = {}) {
  return { id, markups, calibration: { done: true, pxPerMm: 1 }, meta: { group: "", timepoint: "" }, ...opts };
}

function makePoint(label, x, y) {
  return { type: "point", label, points: [{ x, y }], visible: true, placed: true, id: `${label}_${Date.now()}_${Math.random()}` };
}

const cases = [
  { id: "C1", name: "Case 1", sessions: [{ sessionId: "s1", operatorId: "OP1", occasion: 1 }, { sessionId: "s2", operatorId: "OP2", occasion: 1 }] },
  { id: "C2", name: "Case 2", sessions: [{ sessionId: "s3", operatorId: "OP1", occasion: 1 }, { sessionId: "s4", operatorId: "OP2", occasion: 1 }] },
];

describe("runReliabilityAll", () => {
  it("returns empty details when no cases defined", () => {
    const result = runReliabilityAll([], { labelIds: [], cases: [], operators: [] });
    expect(result.details).toEqual([]);
    expect(result.measurements).toBe(0);
  });

  it("returns ICC for a single landmark across two operators", () => {
    const sessions = [
      makeSession("s1", [makePoint("S", 100, 999)]),
      makeSession("s2", [makePoint("S", 102, 999)]),
      makeSession("s3", [makePoint("S", 200, 999)]),
      makeSession("s4", [makePoint("S", 203, 999)]),
    ];
    const config = { labelIds: ["S"], cases, operators: ["OP1", "OP2"], protocol: { occasions: 1 }, design: "inter" };
    const result = runReliabilityAll(sessions, config, { done: true, pxPerMm: 1 });

    expect(result.measurements).toBeGreaterThan(0);
    expect(result.details.length).toBeGreaterThan(0);
    const s = result.details.find(d => d.label === "S");
    expect(s).toBeDefined();
    expect(s.icc).toBeGreaterThan(0);
    expect(s.dahlberg).toBeGreaterThan(0);
    expect(s.nSubjects).toBe(2);
  });

  it("returns landmark error map", () => {
    const sessions = [
      makeSession("s1", [makePoint("A", 100, 200)]),
      makeSession("s2", [makePoint("A", 101, 201)]),
      makeSession("s3", [makePoint("A", 99, 199)]),
      makeSession("s4", [makePoint("A", 100, 200)]),
    ];
    const config = { labelIds: ["A"], cases, operators: ["OP1", "OP2"], protocol: { occasions: 1 }, design: "inter" };
    const result = runReliabilityAll(sessions, config);

    expect(result.landmarkMap).toBeDefined();
    expect(result.landmarkMap.A).toBeDefined();
    expect(result.landmarkMap.A.n).toBe(4);
    expect(result.landmarkMap.A.meanError).toBeGreaterThan(0);
    expect(result.landmarkMap.A.centroid.x).toBeCloseTo(100, 0);
  });
});
