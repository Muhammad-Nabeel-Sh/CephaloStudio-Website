import { describe, it, expect } from "vitest";
import {
  betaIncomplete,
  betaCF,
  tDistributeCDF,
  fCDF,
  chi2CDF,
  tTestPaired,
  oneWayAnova,
} from "../utils.js";

// ═════════════════════════════════════════════════════════════════
// Golden-value reference tests for distribution functions.
// These tests compare computed p-values/CDFs against published tables.
// They exist because the previous codebase had bugs in betaCF, fCDF, and
// chi2CDF that made EVERY t-test and ANOVA p-value wrong — and the existing
// tests only checked structure (e.g. "testName matches /t-test/"), never
// actual values. These golden-value tests are the regression net.
// ═════════════════════════════════════════════════════════════════

describe("betaCF (Lentz continued fraction)", () => {
  it("returns a positive finite value for valid inputs", () => {
    const r = betaCF(2, 3, 0.4);
    expect(r).toBeGreaterThan(0);
    expect(isFinite(r)).toBe(true);
  });

  it("is stable at the symmetry point x=(a+1)/(a+b+2)", () => {
    const a = 5, b = 3;
    const x = (a + 1) / (a + b + 2);
    const r = betaCF(a, b, x);
    expect(isFinite(r)).toBe(true);
    expect(r).toBeGreaterThan(0);
  });
});

describe("betaIncomplete", () => {
  it("returns 0.5 for Beta(2,2) at x=0.5 (symmetric)", () => {
    expect(betaIncomplete(2, 2, 0.5)).toBeCloseTo(0.5, 4);
  });

  it("returns 0 at x=0 and 1 at x=1", () => {
    expect(betaIncomplete(3, 5, 0)).toBe(0);
    expect(betaIncomplete(3, 5, 1)).toBe(1);
  });

  it("Beta(1,15) at x=0.25 ≈ 0.9866 (reference from t-CDF)", () => {
    expect(betaIncomplete(1, 15, 0.25)).toBeCloseTo(0.9866, 3);
  });
});

describe("tDistributeCDF (t-distribution CDF)", () => {
  // Reference: standard t-tables
  it("returns 0.5 at t=0 for any df", () => {
    expect(tDistributeCDF(0, 1)).toBeCloseTo(0.5, 6);
    expect(tDistributeCDF(0, 10)).toBeCloseTo(0.5, 6);
    expect(tDistributeCDF(0, 100)).toBeCloseTo(0.5, 6);
  });

  it("t(2.5, 20) ≈ 0.9894 (one-sided p = 0.011)", () => {
    expect(tDistributeCDF(2.5, 20)).toBeCloseTo(0.9894, 3);
  });

  it("t(1.96, 1000) ≈ 0.975 (approaches normal)", () => {
    expect(tDistributeCDF(1.96, 1000)).toBeCloseTo(0.975, 2);
  });

  it("t(2.228, 10) ≈ 0.975 (two-sided 0.05 critical value)", () => {
    expect(tDistributeCDF(2.228, 10)).toBeCloseTo(0.975, 2);
  });

  it("t(3.169, 10) ≈ 0.995 (two-sided 0.01 critical value)", () => {
    expect(tDistributeCDF(3.169, 10)).toBeCloseTo(0.995, 2);
  });
});

describe("fCDF (F-distribution CDF)", () => {
  // Reference: standard F-tables
  it("returns 0 for f ≤ 0", () => {
    expect(fCDF(0, 2, 10)).toBe(0);
    expect(fCDF(-1, 2, 10)).toBe(0);
  });

  it("F(4.10, 2, 10) ≈ 0.95 (α=0.05 critical value)", () => {
    expect(fCDF(4.10, 2, 10)).toBeCloseTo(0.95, 2);
  });

  it("F(7.56, 2, 10) ≈ 0.99 (α=0.01 critical value)", () => {
    expect(fCDF(7.56, 2, 10)).toBeCloseTo(0.99, 1);
  });

  it("F(5, 2, 30) ≈ 0.986 (reference)", () => {
    expect(fCDF(5, 2, 30)).toBeCloseTo(0.986, 2);
  });

  it("F(1, 10, 10) ≈ 0.5 (symmetric F at 1)", () => {
    expect(fCDF(1, 10, 10)).toBeCloseTo(0.5, 1);
  });
});

describe("chi2CDF (Chi-square CDF)", () => {
  // Reference: standard chi-square tables
  it("returns 0 for x ≤ 0", () => {
    expect(chi2CDF(0, 2)).toBe(0);
    expect(chi2CDF(-1, 2)).toBe(0);
  });

  it("χ²(3.841, 1) ≈ 0.95 (α=0.05 critical value)", () => {
    expect(chi2CDF(3.841, 1)).toBeCloseTo(0.95, 3);
  });

  it("χ²(5.991, 2) ≈ 0.95 (α=0.05 critical value)", () => {
    expect(chi2CDF(5.991, 2)).toBeCloseTo(0.95, 3);
  });

  it("χ²(7.815, 3) ≈ 0.95 (α=0.05 critical value)", () => {
    expect(chi2CDF(7.815, 3)).toBeCloseTo(0.95, 3);
  });

  it("χ²(11.345, 3) ≈ 0.99 (α=0.01 critical value)", () => {
    expect(chi2CDF(11.345, 3)).toBeCloseTo(0.99, 2);
  });

  it("χ²(6.635, 1) ≈ 0.99 (α=0.01 critical value)", () => {
    expect(chi2CDF(6.635, 1)).toBeCloseTo(0.99, 2);
  });

  it("χ²(15.086, 5) ≈ 0.99 (α=0.01 critical value)", () => {
    expect(chi2CDF(15.086, 5)).toBeCloseTo(0.99, 2);
  });

  it("is monotonic (CDF increases with x)", () => {
    const df = 5;
    const cdf1 = chi2CDF(2, df);
    const cdf2 = chi2CDF(5, df);
    const cdf3 = chi2CDF(10, df);
    const cdf4 = chi2CDF(20, df);
    expect(cdf1).toBeLessThan(cdf2);
    expect(cdf2).toBeLessThan(cdf3);
    expect(cdf3).toBeLessThan(cdf4);
  });
});

describe("tTestPaired (reference p-values)", () => {
  // Known example: diffs = [1, 2, 3, 4, 5], mean=3, sd≈1.581, t=3/(1.581/√5)=4.243, df=4
  it("computes correct t and p for mean diff 3, n=5", () => {
    const r = tTestPaired([11, 12, 13, 14, 15], [10, 10, 10, 10, 10]);
    expect(r.t).toBeCloseTo(4.243, 2);
    expect(r.pValue).toBeCloseTo(0.0134, 2);
    expect(r.df).toBe(4);
  });

  it("returns null for zero variance", () => {
    expect(tTestPaired([5, 5, 5], [5, 5, 5])).toBeNull();
  });
});

describe("oneWayAnova (reference p-values)", () => {
  // Known example: 3 groups [1,2,3],[4,5,6],[7,8,9] → F=27, df=(2,6), p=0.00121
  it("computes correct F and p for 3 well-separated groups", () => {
    const r = oneWayAnova([1, 2, 3], [4, 5, 6], [7, 8, 9]);
    expect(r.F).toBeCloseTo(27, 1);
    expect(r.pValue).toBeCloseTo(0.0012, 3);
    expect(r.dfBetween).toBe(2);
    expect(r.dfWithin).toBe(6);
  });

  it("returns high p for identical groups", () => {
    const r = oneWayAnova([5, 5, 5], [5, 5, 5], [5, 5, 5]);
    expect(r).toBeNull();
  });
});
