import { describe, it, expect } from "vitest";
import { runDescriptiveAll } from "../research/descriptive.js";

function makeSession(id, markups, opts = {}) {
  return {
    id,
    markups,
    calibration: { done: true, pxPerMm: 1 },
    meta: { group: opts.group || "", timepoint: opts.timepoint || "" },
    ...opts,
  };
}

function makePoint(label, x, y) {
  return { type: "point", label, points: [{ x, y }], visible: true, placed: true, id: label };
}

describe("runDescriptiveAll", () => {
  it("returns stats for a single landmark across sessions", () => {
    const sessions = [
      makeSession("s1", [makePoint("S", 100, 100)]),
      makeSession("s2", [makePoint("S", 102, 102)]),
      makeSession("s3", [makePoint("S", 98, 98)]),
    ];
    const config = { sessionIds: ["s1", "s2", "s3"], labelIds: ["S"] };
    const result = runDescriptiveAll(sessions, config, { done: true, pxPerMm: 1 });

    expect(result).not.toBeNull();
    expect(result.combined).toBeDefined();
    expect(result.combined.S).toBeDefined();
    expect(result.combined.S.stats).toBeDefined();
    // point type emits both x and y => 6 values across 3 sessions
    expect(result.combined.S.stats.mean).toBeCloseTo(100, 1);
    expect(result.combined.S.stats.n).toBe(6);
    expect(result.combined.S.stats.min).toBe(98);
    expect(result.combined.S.stats.max).toBe(102);
  });

  it("handles empty sessions gracefully", () => {
    const result = runDescriptiveAll([], { sessionIds: [], labelIds: ["S"] }, { done: true, pxPerMm: 1 });
    expect(result.combined).toBeDefined();
    expect(Object.keys(result.combined)).toHaveLength(0);
  });

  it("handles missing landmarks gracefully", () => {
    const sessions = [
      makeSession("s1", [makePoint("A", 100, 200)]),
    ];
    const config = { sessionIds: ["s1"], labelIds: ["NONEXISTENT"] };
    const result = runDescriptiveAll(sessions, config, { done: true, pxPerMm: 1 });
    expect(result).not.toBeNull();
  });
});
