import { describe, it, expect } from "vitest";
import { validateExample } from "../storage/cephxFormat.js";
import { EXAMPLE_LIST, getExampleData } from "../data/examplesData.js";
import { PREDEFINED } from "../data/constants.js";

// ═════════════════════════════════════════════════════════════════
// Examples panel — foundation: envelope validator + bundled examples.
//
// Examples are interactive teaching illustrations (point-placement
// guides + analysis understanding). The envelope metadata
// (description, author, projection, analysisName) powers the browse
// experience. `analysisName`, when present, should still resolve to a
// PREDEFINED analysis whose labels the example points match — a
// quality gate for any community example that declares one.
// ═════════════════════════════════════════════════════════════════

// ─── validateExample (envelope validator) ────────────────────────────────
function mkExample(overrides = {}) {
  return {
    format: "cepht",
    version: "2.0",
    name: "X",
    markups: [{ type: "point", label: "N" }],
    ...overrides,
  };
}

describe("validateExample", () => {
  it("accepts a valid example with the full envelope", () => {
    const ex = mkExample({
      description: "desc",
      author: "author",
      projection: "lateral",
      analysisName: "Steiner Analysis",
    });
    expect(validateExample(ex)).toBeNull();
  });

  it("accepts an example with no envelope fields (they are optional)", () => {
    expect(validateExample(mkExample())).toBeNull();
  });

  it("still enforces the base cepht structure", () => {
    expect(validateExample({ format: "cepht" })).toMatch(/markups/);
    expect(validateExample(mkExample({ version: "0.1" }))).toMatch(/Unsupported/);
    expect(validateExample({ format: "wrong" })).toMatch(/cepht/);
  });

  it("rejects non-string description / author / analysisName", () => {
    expect(validateExample(mkExample({ description: 42 }))).toMatch(/description/);
    expect(validateExample(mkExample({ author: [] }))).toMatch(/author/);
    expect(validateExample(mkExample({ analysisName: {} }))).toMatch(/analysisName/);
  });

  it("rejects non-string or unknown projection", () => {
    expect(validateExample(mkExample({ projection: 7 }))).toMatch(/projection/);
    expect(validateExample(mkExample({ projection: "bogus" }))).toMatch(/projection/);
  });

  it("accepts all supported projections", () => {
    for (const p of ["lateral", "ap", "smv", "opg", "handwrist", "photolateral", "photofrontal"]) {
      expect(validateExample(mkExample({ projection: p }))).toBeNull();
    }
  });
});

// ─── Bundled examples pass the validator + expose metadata ───────────────
function findAnalysis(analysisName) {
  for (const list of Object.values(PREDEFINED)) {
    if (!Array.isArray(list)) continue;
    const a = list.find(x => x.name === analysisName);
    if (a) return a;
  }
  return null;
}

describe("bundled examples", () => {
  it("exposes at least one example", () => {
    expect(EXAMPLE_LIST.length).toBeGreaterThan(0);
  });

  it("every bundled example parses and passes validateExample", () => {
    for (const ex of EXAMPLE_LIST) {
      const data = getExampleData(ex.id);
      expect(data, `example "${ex.id}" should parse`).not.toBeNull();
      expect(validateExample(data), `example "${ex.id}" should validate`).toBeNull();
    }
  });

  it("every example with an analysisName resolves to a PREDEFINED analysis", () => {
    for (const ex of EXAMPLE_LIST) {
      const data = getExampleData(ex.id);
      if (!data?.analysisName) continue;
      expect(findAnalysis(data.analysisName), `analysis "${data.analysisName}"`).toBeTruthy();
    }
  });

  it("every point label exists in the example's declared PREDEFINED analysis", () => {
    for (const ex of EXAMPLE_LIST) {
      const data = getExampleData(ex.id);
      if (!data?.analysisName) continue;
      const analysis = findAnalysis(data.analysisName);
      expect(analysis, `analysis "${data.analysisName}"`).toBeTruthy();
      const defLabels = new Set((analysis.pts || []).map(p => p.l));
      for (const m of data.markups || []) {
        if (m.type !== "point" || !m.label) continue;
        expect(defLabels.has(m.label), `label "${m.label}" in "${ex.id}"`).toBe(true);
      }
    }
  });

  it("example list entries expose the envelope metadata", () => {
    for (const ex of EXAMPLE_LIST) {
      expect(typeof ex.id).toBe("string");
      expect(typeof ex.label).toBe("string");
      expect(typeof ex.subtitle).toBe("string");
      expect(typeof ex.badge).toBe("string");
      expect(typeof ex.description).toBe("string");
      expect(typeof ex.author).toBe("string");
      expect(typeof ex.projection).toBe("string");
      expect(typeof ex.analysisName).toBe("string");
      expect(typeof ex.ptCount).toBe("number");
    }
  });

  it("Landmarks is the bundled illustration example", () => {
    const data = getExampleData("Landmarks");
    expect(data).not.toBeNull();
    expect(data.projection).toBe("lateral");
    const pts = (data.markups || []).filter(m => m.type === "point");
    const sil = (data.markups || []).filter(m => m.type === "silhouette");
    expect(pts.length).toBeGreaterThan(0);
    expect(sil.length).toBeGreaterThan(0);
  });
});

// ─── Group teaching data (hover/group teaching + legend) ──────────────────
const GROUP_COLORS = new Set(["#f59e0b", "#60a5fa", "#a78bfa", "#f472b6", "#fbbf24"]);
const EXPECTED_GROUP_COUNTS = { "cranial base": 5, maxillary: 7, mandibular: 10, dentition: 4, "soft tissue": 9 };

describe("group teaching data", () => {
  it("every Landmarks point carries a group and a palette color", () => {
    const data = getExampleData("Landmarks");
    const pts = (data.markups || []).filter(m => m.type === "point");
    expect(pts.length).toBe(35);
    for (const p of pts) {
      expect(typeof p.group, `group on "${p.label}"`).toBe("string");
      expect(p.group.length).toBeGreaterThan(0);
      expect(GROUP_COLORS.has(p.color), `palette color on "${p.label}"`).toBe(true);
    }
  });

  it("all points in the same group share one color (legend can derive from data)", () => {
    const data = getExampleData("Landmarks");
    const byGroup = {};
    for (const p of (data.markups || []).filter(m => m.type === "point")) {
      (byGroup[p.group] = byGroup[p.group] || []).push(p.color);
    }
    for (const [g, colors] of Object.entries(byGroup)) {
      expect(new Set(colors).size, `uniform color in "${g}"`).toBe(1);
    }
  });

  it("Landmarks groups and counts match the teaching legend", () => {
    const data = getExampleData("Landmarks");
    const counts = {};
    for (const p of (data.markups || []).filter(m => m.type === "point")) {
      counts[p.group] = (counts[p.group] || 0) + 1;
    }
    expect(counts).toEqual(EXPECTED_GROUP_COUNTS);
  });

  it("group is optional: a point without a group still validates", () => {
    expect(validateExample(mkExample())).toBeNull();
  });
});
