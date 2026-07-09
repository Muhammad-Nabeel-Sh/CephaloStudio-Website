import { describe, it, expect } from "vitest";
import { runStudy } from "../research/engine.js";
import { runStudyAsync } from "../research/engineClient.js";

function makeReliabilityStudy() {
  return {
    id: "st1", type: "reliability", status: "configured",
    config: { design: "intra", labelIds: [], cases: [], operators: [], protocol: { occasions: 2 }, minTimeSeparation: 14 },
  };
}

describe("runStudy — onProgress", () => {
  it("invokes onProgress with an increasing fraction and ends at 1", () => {
    const calls = [];
    const r = runStudy(makeReliabilityStudy(), [], { done: false, pxPerMm: 1 }, (p, label) => calls.push({ p, label }));
    expect(r.status).toBe("completed");
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].p).toBeLessThanOrEqual(calls[calls.length - 1].p);
    expect(calls[calls.length - 1].p).toBe(1);
  });

  it("completes without an onProgress callback (backwards-compatible)", () => {
    const r = runStudy(makeReliabilityStudy(), [], { done: false, pxPerMm: 1 });
    expect(r.status).toBe("completed");
  });

  it("returns the study unchanged when already running", () => {
    const running = { ...makeReliabilityStudy(), status: "running" };
    expect(runStudy(running, [], { done: false, pxPerMm: 1 })).toBe(running);
  });
});

describe("runStudyAsync — Worker-unavailable fallback (jsdom)", () => {
  // jsdom has no Worker constructor, so runStudyAsync must fall back to the
  // synchronous path and still resolve with a completed study.
  it("resolves with a completed study when Worker is unavailable", async () => {
    const r = await runStudyAsync(makeReliabilityStudy(), [], { done: false, pxPerMm: 1 });
    expect(r.status).toBe("completed");
  });

  it("streams progress through the fallback path", async () => {
    const seen = [];
    await runStudyAsync(makeReliabilityStudy(), [], { done: false, pxPerMm: 1 }, { onProgress: p => seen.push(p) });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe(1);
  });
});
