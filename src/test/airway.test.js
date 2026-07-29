import { describe, it, expect } from "vitest";
import {
  computeAirwayMeasurements,
  computeAirwayRiskScore,
  lookupAirwayNorm,
  generateAirwayBoundaries,
  sampleBoundaryAtY,
  findNarrowestPoint,
  sampleCatmullRom,
  coreLandmarksComplete,
  findPt,
  AIRWAY_MEASUREMENTS,
  AIRWAY_LANDMARKS_CORE,
  AIRWAY_LANDMARKS_ADVANCED,
  AIRWAY_NORMS_STRATIFIED,
} from "../research/airway.js";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function makeMarkup(label, x, y) {
  return {
    id: Math.random().toString(36).slice(2, 10),
    type: "point",
    label,
    points: [{ x, y }],
    visible: true,
    placed: true,
  };
}

function makeCalibration(pxPerMm) {
  return { done: true, pxPerMm };
}

const CAL = makeCalibration(10);
const NO_CAL = { done: false };

// ═══════════════════════════════════════════════════════════════════════════════
// TIER SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

describe("Airway landmark tiers", () => {
  it("core landmarks count is 10", () => {
    expect(AIRWAY_LANDMARKS_CORE).toHaveLength(10);
  });

  it("advanced landmarks count is 9", () => {
    expect(AIRWAY_LANDMARKS_ADVANCED).toHaveLength(9);
  });

  it("advanced landmarks include SP_mid, Ad2, Ad4", () => {
    expect(AIRWAY_LANDMARKS_ADVANCED).toContain("SP_mid");
    expect(AIRWAY_LANDMARKS_ADVANCED).toContain("Ad2");
    expect(AIRWAY_LANDMARKS_ADVANCED).toContain("Ad4");
  });

  it("core landmarks and advanced landmarks are disjoint", () => {
    const overlap = AIRWAY_LANDMARKS_CORE.filter(l => AIRWAY_LANDMARKS_ADVANCED.includes(l));
    expect(overlap).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MEASUREMENTS DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Airway measurement definitions", () => {
  it("has 5 core measurements", () => {
    const core = AIRWAY_MEASUREMENTS.filter(m => m.tier === "core");
    expect(core).toHaveLength(5);
  });

  it("has 11 advanced measurements", () => {
    const adv = AIRWAY_MEASUREMENTS.filter(m => m.tier === "advanced");
    expect(adv).toHaveLength(11);
  });

  it("has no SPAS or Soft-Palate-Angle measurements", () => {
    expect(AIRWAY_MEASUREMENTS.find(m => m.id === "SPAS")).toBeUndefined();
    expect(AIRWAY_MEASUREMENTS.find(m => m.id === "Soft-Palate-Angle")).toBeUndefined();
  });

  it("R-PAS is a core measurement", () => {
    const rpas = AIRWAY_MEASUREMENTS.find(m => m.id === "R-PAS");
    expect(rpas).toBeDefined();
    expect(rpas.tier).toBe("core");
  });

  it("R-RG is an advanced measurement", () => {
    const rrg = AIRWAY_MEASUREMENTS.find(m => m.id === "R-RG");
    expect(rrg).toBeDefined();
    expect(rrg.tier).toBe("advanced");
  });

  it("SP-AW is an advanced measurement", () => {
    const sp = AIRWAY_MEASUREMENTS.find(m => m.id === "SP-AW");
    expect(sp).toBeDefined();
    expect(sp.tier).toBe("advanced");
  });

  it("every measurement has required fields", () => {
    for (const m of AIRWAY_MEASUREMENTS) {
      expect(m.id).toBeTruthy();
      expect(m.label).toBeTruthy();
      expect(["length", "area"]).toContain(m.type);
      expect(Array.isArray(m.points)).toBe(true);
      expect(m.points.length).toBeGreaterThanOrEqual(2);
      expect(typeof m.normMean).toBe("number");
      expect(typeof m.normSD).toBe("number");
      expect(m.normSD).toBeGreaterThan(0);
      expect(m.tier === "core" || m.tier === "advanced").toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// coreLandmarksComplete
// ═══════════════════════════════════════════════════════════════════════════════

describe("coreLandmarksComplete", () => {
  it("returns false with empty markups", () => {
    expect(coreLandmarksComplete([])).toBe(false);
  });

  it("returns false with partial core landmarks", () => {
    const markups = AIRWAY_LANDMARKS_CORE.slice(0, 5).map(l => makeMarkup(l, 100, 200));
    expect(coreLandmarksComplete(markups)).toBe(false);
  });

  it("returns true when all core landmarks are placed", () => {
    const markups = AIRWAY_LANDMARKS_CORE.map((l, i) => makeMarkup(l, 100 + i * 10, 200 + i * 10));
    expect(coreLandmarksComplete(markups)).toBe(true);
  });

  it("returns false if a core landmark is invisible", () => {
    const markups = AIRWAY_LANDMARKS_CORE.map((l, i) => makeMarkup(l, 100 + i * 10, 200 + i * 10));
    markups[0].visible = false;
    expect(coreLandmarksComplete(markups)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// findPt
// ═══════════════════════════════════════════════════════════════════════════════

describe("findPt", () => {
  it("finds a point by label", () => {
    const markups = [makeMarkup("PNS", 100, 200)];
    const pt = findPt(markups, "PNS");
    expect(pt).toEqual({ x: 100, y: 200 });
  });

  it("is case-insensitive", () => {
    const markups = [makeMarkup("PNS", 100, 200)];
    const pt = findPt(markups, "pns");
    expect(pt).toEqual({ x: 100, y: 200 });
  });

  it("returns null for missing label", () => {
    const markups = [makeMarkup("PNS", 100, 200)];
    expect(findPt(markups, "N")).toBeNull();
  });

  it("skips invisible markups", () => {
    const m = makeMarkup("PNS", 100, 200);
    m.visible = false;
    expect(findPt([m], "PNS")).toBeNull();
  });

  it("uses ptMap when provided", () => {
    const markups = [makeMarkup("PNS", 100, 200)];
    const ptMap = new Map([["pns", markups[0]]]);
    const pt = findPt(markups, "PNS", ptMap);
    expect(pt).toEqual({ x: 100, y: 200 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// lookupAirwayNorm
// ═══════════════════════════════════════════════════════════════════════════════

describe("lookupAirwayNorm", () => {
  it("returns stratified norm when sex and age provided", () => {
    const norm = lookupAirwayNorm("R-PAS", "M", 17);
    expect(norm).not.toBeNull();
    expect(norm.mean).toBe(11.2);
    expect(norm.sd).toBe(2.4);
    expect(norm.source).toBe("McNamara 1984");
  });

  it("returns different values for different age groups", () => {
    const young = lookupAirwayNorm("R-PAS", "M", 10);
    const older = lookupAirwayNorm("R-PAS", "M", 17);
    expect(young.mean).toBeLessThan(older.mean);
  });

  it("falls back to AIRWAY_NORMS when no stratified match", () => {
    const norm = lookupAirwayNorm("MP-H", "M", 30);
    expect(norm).not.toBeNull();
    expect(norm.mean).toBe(12.3);
  });

  it("returns null for unknown measurement", () => {
    expect(lookupAirwayNorm("NONEXISTENT")).toBeNull();
  });

  it("returns fallback norm when no sex/age provided", () => {
    const norm = lookupAirwayNorm("R-PAS");
    expect(norm).not.toBeNull();
    expect(norm.mean).toBe(11.2);
  });

  it("returns fallback for unknown age/sex combo", () => {
    const norm = lookupAirwayNorm("R-PAS", "X", 999);
    expect(norm).not.toBeNull();
    expect(norm.mean).toBe(11.2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// computeAirwayMeasurements
// ═══════════════════════════════════════════════════════════════════════════════

describe("computeAirwayMeasurements", () => {
  const allCore = AIRWAY_LANDMARKS_CORE.map((l, i) => makeMarkup(l, 100 + i * 20, 200 + i * 30));

  it("returns empty for null/invalid input", () => {
    expect(computeAirwayMeasurements(null, CAL)).toEqual([]);
    expect(computeAirwayMeasurements("bad", CAL)).toEqual([]);
  });

  it("returns core measurements with values when only core landmarks placed", () => {
    const results = computeAirwayMeasurements(allCore, CAL, "M", 17);
    const withValues = results.filter(r => r.value !== null && r.id !== "_global" && r.id !== "_magnification");
    expect(withValues.length).toBeGreaterThanOrEqual(5);
    const ids = withValues.map(r => r.id);
    expect(ids).toContain("N-PH");
    expect(ids).toContain("MP-H");
    expect(ids).toContain("SP-Length");
    expect(ids).toContain("Tongue-Length");
    expect(ids).not.toContain("R-RG");
    expect(ids).not.toContain("SP-AW");
    expect(ids).not.toContain("PNS-AD1");
    expect(ids).not.toContain("PNS-AD2");
    expect(ids).not.toContain("MAS");
    expect(ids).not.toContain("IAS");
  });

  it("all core measurements show Missing landmarks when landmarks absent", () => {
    const results = computeAirwayMeasurements([], CAL);
    const meas = results.filter(r => r.id !== "_global" && r.id !== "_magnification");
    for (const r of meas) {
      expect(r.interpretation).toBe("Missing landmarks");
      expect(r.value).toBeNull();
    }
  });

  it("computes N-PH distance correctly", () => {
    const markups = [
      makeMarkup("N", 100, 100),
      makeMarkup("PH", 100, 343),
    ];
    const results = computeAirwayMeasurements(markups, CAL);
    const nph = results.find(r => r.id === "N-PH");
    expect(nph).toBeDefined();
    expect(nph.value).toBeCloseTo(24.3, 0);
    expect(nph.unit).toBe("mm");
    expect(nph.zScore).toBeCloseTo(0, 1);
    expect(nph.interpretation).toBe("Normal");
  });

  it("skips z-score when not calibrated", () => {
    const markups = [
      makeMarkup("N", 100, 100),
      makeMarkup("PH", 100, 343),
    ];
    const results = computeAirwayMeasurements(markups, NO_CAL);
    const nph = results.find(r => r.id === "N-PH");
    expect(nph.zScore).toBeNull();
    expect(nph.unit).toBe("px");
    expect(nph.interpretation).toContain("Calibration required");
  });

  it("includes magnification disclaimer when calibrated", () => {
    const results = computeAirwayMeasurements(allCore, CAL);
    const mag = results.find(r => r.id === "_magnification");
    expect(mag).toBeDefined();
    expect(mag.label).toContain("magnification");
  });

  it("no magnification disclaimer when not calibrated", () => {
    const results = computeAirwayMeasurements(allCore, NO_CAL);
    const mag = results.find(r => r.id === "_magnification");
    expect(mag).toBeUndefined();
  });

  it("MP-H computes perpendicular distance", () => {
    const markups = [
      makeMarkup("H", 200, 300),
      makeMarkup("Go", 100, 500),
      makeMarkup("Me", 400, 500),
    ];
    const results = computeAirwayMeasurements(markups, CAL);
    const mph = results.find(r => r.id === "MP-H");
    expect(mph).toBeDefined();
    expect(mph.value).toBeGreaterThan(0);
    expect(mph.unit).toBe("mm");
  });

  it("returns all results with tier property", () => {
    const results = computeAirwayMeasurements(allCore, CAL);
    for (const r of results) {
      expect(["core", "advanced", undefined]).toContain(r.tier);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// computeAirwayRiskScore — directional z-scores
// ═══════════════════════════════════════════════════════════════════════════════

describe("computeAirwayRiskScore", () => {
  it("returns null for empty measurements", () => {
    expect(computeAirwayRiskScore([])).toBeNull();
    expect(computeAirwayRiskScore(null)).toBeNull();
  });

  it("returns null when no risk measurements have z-scores", () => {
    const measurements = [
      { id: "N-PH", zScore: 0 },
      { id: "Unknown", zScore: -3 },
    ];
    expect(computeAirwayRiskScore(measurements)).toBeNull();
  });

  it("returns low risk for all-normal z-scores", () => {
    const measurements = [
      { id: "R-PAS", zScore: 0 },
      { id: "MP-H", zScore: 0 },
      { id: "SP-Length", zScore: 0 },
    ];
    const risk = computeAirwayRiskScore(measurements);
    expect(risk).not.toBeNull();
    expect(risk.risk).toBe("low");
  });

  it("returns high risk for multiple critical narrowing measurements", () => {
    const measurements = [
      { id: "R-PAS", zScore: -3 },
      { id: "R-RG", zScore: -3 },
      { id: "MP-H", zScore: 3 },
    ];
    const risk = computeAirwayRiskScore(measurements);
    expect(risk.risk).toBe("high");
    expect(risk.criticalCount).toBeGreaterThanOrEqual(2);
  });

  it("correctly direction-normalizes: high MP-H = pathological", () => {
    const measurements = [
      { id: "R-PAS", zScore: 0 },
      { id: "MP-H", zScore: 3 },
      { id: "SP-Length", zScore: 2.5 },
    ];
    const risk = computeAirwayRiskScore(measurements);
    expect(risk).not.toBeNull();
    expect(risk.score).toBeGreaterThan(0);
  });

  it("correctly direction-normalizes: low R-PAS = pathological", () => {
    const measurements = [
      { id: "R-PAS", zScore: -3 },
      { id: "R-RG", zScore: -2.5 },
    ];
    const risk = computeAirwayRiskScore(measurements);
    expect(risk).not.toBeNull();
    expect(risk.score).toBeGreaterThan(0);
  });

  it("does not cancel out opposing z-scores", () => {
    const measurements = [
      { id: "R-PAS", zScore: -3 },
      { id: "MP-H", zScore: 3 },
    ];
    const risk = computeAirwayRiskScore(measurements);
    expect(risk).not.toBeNull();
    expect(risk.score).toBeGreaterThan(0);
    expect(risk.flaggedCount).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe("sampleBoundaryAtY", () => {
  it("returns null for insufficient points", () => {
    expect(sampleBoundaryAtY([], 100)).toBeNull();
    expect(sampleBoundaryAtY([{ x: 0, y: 0 }], 100)).toBeNull();
  });

  it("interpolates correctly on a vertical line", () => {
    const pts = [{ x: 0, y: 0 }, { x: 0, y: 100 }];
    const result = sampleBoundaryAtY(pts, 50);
    expect(result).not.toBeNull();
    expect(result.x).toBe(0);
    expect(result.y).toBe(50);
  });

  it("returns null for y outside range", () => {
    const pts = [{ x: 0, y: 0 }, { x: 0, y: 100 }];
    expect(sampleBoundaryAtY(pts, -10)).toBeNull();
    expect(sampleBoundaryAtY(pts, 110)).toBeNull();
  });
});

describe("findNarrowestPoint", () => {
  it("finds narrowest width between two vertical walls", () => {
    const ant = [{ x: 0, y: 0 }, { x: 0, y: 100 }];
    const post = [{ x: 20, y: 0 }, { x: 10, y: 100 }];
    const result = findNarrowestPoint(ant, post, 0, 100, 10);
    expect(result).not.toBeNull();
    expect(result.y).toBe(100);
    expect(result.width).toBeCloseTo(10, 0);
  });

  it("returns null for insufficient points", () => {
    expect(findNarrowestPoint([], [{ x: 0, y: 0 }], 0, 100, 10)).toBeNull();
  });
});

describe("sampleCatmullRom", () => {
  it("returns empty for null/empty input", () => {
    expect(sampleCatmullRom(null)).toEqual([]);
    expect(sampleCatmullRom([])).toEqual([]);
  });

  it("returns 2 points as linear interpolation", () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    const result = sampleCatmullRom(pts, 5);
    expect(result.length).toBe(5);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[4]).toEqual({ x: 100, y: 100 });
  });

  it("smooths multi-point curves", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 0 },
    ];
    const result = sampleCatmullRom(pts, 20);
    expect(result.length).toBeGreaterThan(3);
    expect(result[0]).toEqual({ x: 0, y: 0 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateAirwayBoundaries
// ═══════════════════════════════════════════════════════════════════════════════

describe("generateAirwayBoundaries", () => {
  it("returns null for empty markups", () => {
    expect(generateAirwayBoundaries([], null)).toBeNull();
  });

  it("generates boundaries when anterior landmarks available", () => {
    const markups = [
      makeMarkup("PNS", 100, 100),
      makeMarkup("SP", 120, 200),
      makeMarkup("TT", 110, 400),
    ];
    const result = generateAirwayBoundaries(markups, null);
    expect(result).not.toBeNull();
    expect(result.anterior.length).toBeGreaterThan(0);
  });

  it("generates boundaries when posterior landmarks available", () => {
    const markups = [
      makeMarkup("Ad1", 300, 100),
      makeMarkup("Ad2", 310, 200),
      makeMarkup("Ad3", 320, 300),
    ];
    const result = generateAirwayBoundaries(markups, null);
    expect(result).not.toBeNull();
    expect(result.posterior.length).toBeGreaterThan(0);
  });

  it("returns null when fewer than 2 points per boundary type", () => {
    const markups = [makeMarkup("PNS", 100, 100)];
    expect(generateAirwayBoundaries(markups, null)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLINICAL NOTES
// ═══════════════════════════════════════════════════════════════════════════════

describe("Clinical notes and thresholds", () => {
  it("R-PAS <5mm triggers severe narrowing note", () => {
    const markups = [
      makeMarkup("SP", 100, 200),
      makeMarkup("Ad3", 100 + 40, 200),
    ];
    const results = computeAirwayMeasurements(markups, CAL);
    const rpas = results.find(r => r.id === "R-PAS");
    expect(rpas).toBeDefined();
    expect(rpas.value).toBeCloseTo(4, 0);
    expect(rpas.clinicalNote).toContain("<5mm");
  });

  it("R-PAS <8mm triggers screening note", () => {
    const markups = [
      makeMarkup("SP", 100, 200),
      makeMarkup("Ad3", 100 + 70, 200),
    ];
    const results = computeAirwayMeasurements(markups, CAL);
    const rpas = results.find(r => r.id === "R-PAS");
    expect(rpas).toBeDefined();
    expect(rpas.value).toBeCloseTo(7, 0);
    expect(rpas.clinicalNote).toContain("sleep apnea screening");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NORM DIRECTIONALITY
// ═══════════════════════════════════════════════════════════════════════════════

describe("Norm lookup keys match measurement IDs", () => {
  it("all core measurement IDs have fallback norms", () => {
    for (const m of AIRWAY_MEASUREMENTS) {
      const norm = lookupAirwayNorm(m.id);
      expect(norm).not.toBeNull();
      expect(norm.mean).toBeGreaterThan(0);
      expect(norm.sd).toBeGreaterThan(0);
    }
  });
});
