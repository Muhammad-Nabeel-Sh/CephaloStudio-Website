import { describe, it, expect } from "vitest";
import { checkReliabilityTimeSeparation, checkLongitudinalTimeSeparation } from "../research/validation.js";

// ═════════════════════════════════════════════════════════════════
// minTimeSeparation enforcement (S19). Was configured but never validated.
// ═════════════════════════════════════════════════════════════════

describe("checkReliabilityTimeSeparation", () => {
  const DAY = 86400000;
  function ses(id, ts) { return { id, timestamp: ts }; }

  it("flags occasions closer than the minimum", () => {
    const sessions = [ses("a1", 0), ses("a2", DAY * 1)]; // 1 day apart
    const cases = [{ id: "c1", name: "Case 1", sessions: [
      { sessionId: "a1", operatorId: "op", occasion: 1 },
      { sessionId: "a2", operatorId: "op", occasion: 2 },
    ] }];
    const r = checkReliabilityTimeSeparation(sessions, cases, 14);
    expect(r.checked).toBe(true);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].gapDays).toBeCloseTo(1, 2);
    expect(r.violations[0].minDays).toBe(14);
    expect(r.violations[0].caseName).toBe("Case 1");
  });

  it("does not flag occasions meeting the minimum", () => {
    const sessions = [ses("a1", 0), ses("a2", DAY * 20)]; // 20 days apart
    const cases = [{ id: "c1", name: "Case 1", sessions: [
      { sessionId: "a1", operatorId: "op", occasion: 1 },
      { sessionId: "a2", operatorId: "op", occasion: 2 },
    ] }];
    const r = checkReliabilityTimeSeparation(sessions, cases, 14);
    expect(r.violations).toHaveLength(0);
  });

  it("checks each consecutive occasion pair independently", () => {
    const sessions = [ses("a1", 0), ses("a2", DAY * 20), ses("a3", DAY * 22)]; // 20 ok, 2 violation
    const cases = [{ id: "c1", name: "C", sessions: [
      { sessionId: "a1", operatorId: "op", occasion: 1 },
      { sessionId: "a2", operatorId: "op", occasion: 2 },
      { sessionId: "a3", operatorId: "op", occasion: 3 },
    ] }];
    const r = checkReliabilityTimeSeparation(sessions, cases, 14);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].from).toBe(2);
    expect(r.violations[0].to).toBe(3);
  });

  it("returns checked=false when minDays is 0 or unset", () => {
    const r = checkReliabilityTimeSeparation([ses("a", 0)], [{ id: "c", sessions: [] }], 0);
    expect(r.checked).toBe(false);
  });

  it("skips cases whose sessions are missing", () => {
    const cases = [{ id: "c1", name: "C", sessions: [
      { sessionId: "ghost", operatorId: "op", occasion: 1 },
    ] }];
    const r = checkReliabilityTimeSeparation([], cases, 14);
    expect(r.violations).toHaveLength(0);
  });
});

describe("checkLongitudinalTimeSeparation", () => {
  const DAY = 86400000;
  function ses(id, ts) { return { id, timestamp: ts }; }
  const tps = [{ id: "t1", label: "Pre" }, { id: "t2", label: "Post" }, { id: "t3", label: "Follow-up" }];

  it("flags a subject whose timepoints are too close", () => {
    const sessions = [ses("s1", 0), ses("s2", DAY * 10)];
    const subjects = [{ id: "sub1", label: "Subject 1", records: { t1: "s1", t2: "s2" } }];
    const r = checkLongitudinalTimeSeparation(sessions, subjects, tps, 30);
    expect(r.checked).toBe(true);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].from).toBe("Pre");
    expect(r.violations[0].to).toBe("Post");
    expect(r.violations[0].gapDays).toBeCloseTo(10, 2);
  });

  it("does not flag adequately separated timepoints", () => {
    const sessions = [ses("s1", 0), ses("s2", DAY * 90)];
    const subjects = [{ id: "sub1", label: "Subject 1", records: { t1: "s1", t2: "s2" } }];
    const r = checkLongitudinalTimeSeparation(sessions, subjects, tps, 30);
    expect(r.violations).toHaveLength(0);
  });

  it("skips subjects missing a timepoint session", () => {
    const sessions = [ses("s1", 0)];
    const subjects = [{ id: "sub1", label: "S1", records: { t1: "s1", t2: null } }];
    const r = checkLongitudinalTimeSeparation(sessions, subjects, tps, 30);
    expect(r.violations).toHaveLength(0);
  });

  it("returns checked=false when minDays is 0", () => {
    const r = checkLongitudinalTimeSeparation([], [], tps, 0);
    expect(r.checked).toBe(false);
  });
});
