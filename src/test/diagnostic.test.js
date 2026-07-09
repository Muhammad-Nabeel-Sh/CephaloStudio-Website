import { describe, it, expect } from "vitest";
import { calibrationAnalysis } from "../research/diagnostic.js";
import { chi2CDF } from "../utils.js";

// ═════════════════════════════════════════════════════════════════
// Hosmer-Lemeshow calibration regression tests.
//
// These exist because diagnostic.js previously defined its OWN local
// chi2CDF built on a divergent asymptotic series (wrong a*ln(x) prefactor
// instead of the Lentz continued fraction). For moderate χ² it returned
// garbage (e.g. chi2CDF(11.345,3) ≈ -1.88e76), so the H-L goodness-of-fit
// p-value at diagnostic.js:280 was silently wrong. These tests pin the
// H-L path to the corrected utils.js chi2CDF and guard against divergence.
// ═════════════════════════════════════════════════════════════════

// Helper: build n points in 10 equal groups, each point with a fixed
// predicted probability and a label. deterministic (no RNG) so reference
// values are stable.
function buildDataset(perGroupProb, perGroupObserved, nGroups = 10, groupSize = 10) {
  const probs = [];
  const labels = [];
  for (let g = 0; g < nGroups; g++) {
    for (let i = 0; i < groupSize; i++) {
      probs.push(perGroupProb(g));
      labels.push(i < perGroupObserved(g) ? 1 : 0);
    }
  }
  return { probs, labels };
}

describe("calibrationAnalysis (Hosmer-Lemeshow) — chi2CDF correctness", () => {
  it("hlP is finite and within [0,1] for a moderate miscalibration (regression: was -1.88e76)", () => {
    // 100 points, 10 groups. Prob rises with group; observed lags → moderate H-L.
    const { probs, labels } = buildDataset(
      g => 0.1 + g * 0.08,
      g => Math.max(0, Math.floor((0.1 + g * 0.08) * 10) - 2)
    );
    const r = calibrationAnalysis(probs, labels, 10);
    expect(isFinite(r.hlP)).toBe(true);
    expect(r.hlP).toBeGreaterThanOrEqual(0);
    expect(r.hlP).toBeLessThanOrEqual(1);
    expect(isFinite(r.hlStat)).toBe(true);
  });

  it("hlP matches 1 - chi2CDF(hlStat, hlDF) from utils.js (proves diagnostic uses the corrected CDF)", () => {
    const { probs, labels } = buildDataset(
      g => 0.15 + g * 0.07,
      g => Math.max(0, Math.floor((0.15 + g * 0.07) * 10) - 1)
    );
    const r = calibrationAnalysis(probs, labels, 10);
    const expected = 1 - chi2CDF(r.hlStat, r.hlDF);
    expect(r.hlP).toBeCloseTo(expected, 6);
  });

  it("perfectly calibrated model → hlStat ≈ 0, hlP ≈ 1, wellCalibrated true", () => {
    // Every group of 10: predicted prob 0.3, exactly 3 observed positives.
    const { probs, labels } = buildDataset(() => 0.3, () => 3);
    const r = calibrationAnalysis(probs, labels, 10);
    expect(r.hlStat).toBeCloseTo(0, 6);
    expect(r.hlP).toBeCloseTo(1, 6);
    expect(r.wellCalibrated).toBe(true);
  });

  it("grossly miscalibrated model → hlP ≈ 0, wellCalibrated false", () => {
    // Predicted 0.1 everywhere but 9/10 observed positives in every group.
    const { probs, labels } = buildDataset(() => 0.1, () => 9);
    const r = calibrationAnalysis(probs, labels, 10);
    expect(r.hlStat).toBeGreaterThan(100);
    expect(r.hlP).toBeLessThan(1e-6);
    expect(r.wellCalibrated).toBe(false);
  });

  it("does not diverge for large H-L statistics (regression: asymptotic series blew up)", () => {
    // Extreme miscalibration: expected near 0 but all observed positive.
    const probs = [];
    const labels = [];
    for (let g = 0; g < 10; g++) {
      for (let i = 0; i < 10; i++) {
        probs.push(0.001 + g * 0.0005);
        labels.push(1);
      }
    }
    const r = calibrationAnalysis(probs, labels, 10);
    expect(isFinite(r.hlP)).toBe(true);
    expect(r.hlP).toBeGreaterThanOrEqual(0);
    expect(r.hlP).toBeLessThanOrEqual(1);
  });
});
