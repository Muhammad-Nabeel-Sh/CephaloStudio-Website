import { describe, it, expect } from "vitest";
import { fCDF, tDistributeCDF, chi2CDF, betaIncomplete } from "../utils.js";

const CLOSE = (a, b, tol = 0.005) => Math.abs(a - b) < tol;

describe("Statistical golden-value tests (S1–S4 regression guards)", () => {
  describe("betaCF / betaIncomplete", () => {
    it("betaIncomplete(0.5, 0.5, 0.5) ≈ 0.5 (symmetric case)", () => {
      expect(CLOSE(betaIncomplete(0.5, 0.5, 0.5), 0.5, 0.001)).toBe(true);
    });
    it("betaIncomplete(1, 1, x) = x (uniform distribution)", () => {
      expect(CLOSE(betaIncomplete(1, 1, 0.3), 0.3, 0.001)).toBe(true);
      expect(CLOSE(betaIncomplete(1, 1, 0.7), 0.7, 0.001)).toBe(true);
    });
    it("betaIncomplete(2, 3, 0.5) ≈ 0.6875", () => {
      expect(CLOSE(betaIncomplete(2, 3, 0.5), 0.6875, 0.005)).toBe(true);
    });
  });

  describe("fCDF (F-distribution CDF)", () => {
    it("fCDF(4.10, 2, 10) ≈ 0.95 (CODE_REVIEW S1 reference)", () => {
      expect(CLOSE(fCDF(4.10, 2, 10), 0.95, 0.005)).toBe(true);
    });
    it("fCDF(3.10, 3, 20) ≈ 0.95", () => {
      expect(CLOSE(fCDF(3.10, 3, 20), 0.95, 0.005)).toBe(true);
    });
    it("fCDF(2.71, 5, 20) ≈ 0.95", () => {
      expect(CLOSE(fCDF(2.71, 5, 20), 0.95, 0.005)).toBe(true);
    });
    it("fCDF(0, d1, d2) = 0", () => {
      expect(fCDF(0, 2, 10)).toBe(0);
    });
    it("fCDF approaches 1 for large F", () => {
      expect(fCDF(100, 2, 10)).toBeGreaterThan(0.999);
    });
  });

  describe("tDistributeCDF (Student's t CDF)", () => {
    it("tDistributeCDF(2.5, 20) ≈ 0.989 (CODE_REVIEW S1 reference)", () => {
      expect(CLOSE(tDistributeCDF(2.5, 20), 0.989, 0.005)).toBe(true);
    });
    it("tDistributeCDF(1.96, large df) ≈ 0.975 (approaches normal)", () => {
      expect(CLOSE(tDistributeCDF(1.96, 1000), 0.975, 0.005)).toBe(true);
    });
    it("tDistributeCDF(0, df) = 0.5 (symmetric)", () => {
      expect(CLOSE(tDistributeCDF(0, 10), 0.5, 0.001)).toBe(true);
      expect(CLOSE(tDistributeCDF(0, 30), 0.5, 0.001)).toBe(true);
    });
    it("tDistributeCDF is monotonically increasing for t >= 0", () => {
      const vals = [0, 0.5, 1, 1.5, 2, 2.5, 3].map(x => tDistributeCDF(x, 20));
      for (let i = 1; i < vals.length; i++) {
        expect(vals[i]).toBeGreaterThan(vals[i - 1]);
      }
    });
  });

  describe("chi2CDF (Chi-square CDF)", () => {
    it("chi2CDF(5.991, 2) ≈ 0.95 (CODE_REVIEW S3 reference)", () => {
      expect(CLOSE(chi2CDF(5.991, 2), 0.95, 0.005)).toBe(true);
    });
    it("chi2CDF(7.815, 3) ≈ 0.95", () => {
      expect(CLOSE(chi2CDF(7.815, 3), 0.95, 0.005)).toBe(true);
    });
    it("chi2CDF(9.488, 4) ≈ 0.95", () => {
      expect(CLOSE(chi2CDF(9.488, 4), 0.95, 0.005)).toBe(true);
    });
    it("chi2CDF(0, df) = 0", () => {
      expect(chi2CDF(0, 3)).toBe(0);
    });
    it("chi2CDF is monotonically increasing", () => {
      const vals = [1, 3, 5, 7, 9, 11].map(x => chi2CDF(x, 4));
      for (let i = 1; i < vals.length; i++) {
        expect(vals[i]).toBeGreaterThan(vals[i - 1]);
      }
    });
    it("chi2CDF approaches 1 for large x", () => {
      expect(chi2CDF(100, 5)).toBeGreaterThan(0.999);
    });
  });
});
