import { describe, it, expect } from "vitest";
import { validateExample } from "../storage/cephxFormat.js";
import { EXAMPLE_LIST, getExampleData, buildGuideSteps, buildStages } from "../data/examplesData.js";
import { parseCommunityManifest, COMMUNITY_EXAMPLES_URL, getRepoURL, getContributionURL } from "../data/communityExamples.js";
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

// ─── Guide steps (Phase 3: step-by-step placement) ────────────────────────
describe("guide steps", () => {
  it("buildGuideSteps includes only placed points (x > -9000)", () => {
    const data = getExampleData("Landmarks");
    const steps = buildGuideSteps(data.markups);
    for (const s of steps) {
      expect(s.points[0].x).toBeGreaterThan(-9000);
      expect(s.points[0].y).toBeGreaterThan(-9000);
    }
  });

  it("covers every placed point exactly once", () => {
    const data = getExampleData("Landmarks");
    const placed = (data.markups || []).filter(m => m.type === "point" && m.points?.[0]?.x > -9000);
    const steps = buildGuideSteps(data.markups);
    expect(steps.length).toBe(placed.length);
    expect(new Set(steps.map(s => s.id)).size).toBe(placed.length);
  });

  it("walks group by group in first-appearance order (ungrouped last)", () => {
    const data = getExampleData("Landmarks");
    const steps = buildGuideSteps(data.markups);
    const seen = new Set();
    let ungroupedSeen = false;
    for (const s of steps) {
      if (!s.group) { ungroupedSeen = true; continue; }
      expect(ungroupedSeen, `grouped "${s.label}" after ungrouped`).toBe(false);
      if (!seen.has(s.group)) {
        seen.add(s.group);
        expect(s.label, "first point of each group defines group order").toBeTruthy();
      }
    }
    expect(seen.size).toBe(5);
  });

  it("points of the same group are consecutive in guide order", () => {
    const data = getExampleData("Landmarks");
    const steps = buildGuideSteps(data.markups);
    for (let i = 0; i < steps.length - 1; i++) {
      if (steps[i].group && steps[i + 1].group && steps[i].group !== steps[i + 1].group) {
        // group switch: ensure no later point returns to the earlier group
        for (let j = i + 1; j < steps.length; j++) {
          expect(steps[j].group, `"${steps[j].label}" repeats group "${steps[i].group}"`).not.toBe(steps[i].group);
        }
      }
    }
  });

  it("every guide step has teaching content (definition + hint)", () => {
    const data = getExampleData("Landmarks");
    const steps = buildGuideSteps(data.markups);
    expect(steps.length).toBe(35);
    for (const s of steps) {
      expect(typeof s.definition, `definition on "${s.label}"`).toBe("string");
      expect(s.definition.length).toBeGreaterThan(0);
      expect(typeof s.hint, `hint on "${s.label}"`).toBe("string");
      expect(s.hint.length).toBeGreaterThan(0);
    }
  });

  it("starts with the cranial base and ends with the soft tissue group", () => {
    const data = getExampleData("Landmarks");
    const steps = buildGuideSteps(data.markups);
    expect(steps[0].group).toBe("cranial base");
    expect(steps[steps.length - 1].group).toBe("soft tissue");
  });

  it("returns an empty list when no points are placed", () => {
    expect(buildGuideSteps([{ type: "point", label: "N", points: [{ x: -9001, y: -9001 }] }])).toEqual([]);
  });
});

// ─── Measurement teaching table (Phase 5: measurement explanation) ──────────
function mkMeas(overrides = {}) {
  return { name: "SNA", pts: ["S", "N", "A"], tells: "maxillary position", ...overrides };
}

describe("measurement teaching envelope", () => {
  it("accepts a valid optional measurements array", () => {
    expect(validateExample(mkExample({ measurements: [mkMeas(), mkMeas({ name: "ANB", formula: "SNA − SNB" })] }))).toBeNull();
  });

  it("rejects non-array measurements", () => {
    expect(validateExample(mkExample({ measurements: {} }))).toMatch(/measurements/);
  });

  it("rejects entries missing name / pts / tells or with wrong types", () => {
    expect(validateExample(mkExample({ measurements: [mkMeas({ name: "" })] }))).toMatch(/name/);
    expect(validateExample(mkExample({ measurements: [mkMeas({ name: 7 })] }))).toMatch(/name/);
    expect(validateExample(mkExample({ measurements: [mkMeas({ pts: [] })] }))).toMatch(/pts/);
    expect(validateExample(mkExample({ measurements: [mkMeas({ pts: ["S", 5] })] }))).toMatch(/pts/);
    expect(validateExample(mkExample({ measurements: [mkMeas({ tells: 42 })] }))).toMatch(/tells/);
    expect(validateExample(mkExample({ measurements: [mkMeas({ formula: 9 })] }))).toMatch(/formula/);
  });

  it("is optional: an example without measurements still validates", () => {
    expect(validateExample(mkExample())).toBeNull();
  });

  it("Landmarks ships a teaching measurement table", () => {
    const data = getExampleData("Landmarks");
    expect(Array.isArray(data.measurements)).toBe(true);
    expect(data.measurements.length).toBeGreaterThanOrEqual(10);
  });

  it("every Landmarks measurement references existing point labels and has a 'tells' line", () => {
    const data = getExampleData("Landmarks");
    const labels = new Set((data.markups || []).filter(m => m.type === "point").map(m => m.label));
    for (const mm of data.measurements) {
      expect(typeof mm.name, `name on "${mm.name}"`).toBe("string");
      expect(mm.name.length).toBeGreaterThan(0);
      expect(mm.pts.length).toBeGreaterThanOrEqual(2);
      for (const l of mm.pts) {
        expect(labels.has(l), `"${mm.name}" references "${l}"`).toBe(true);
      }
      expect(typeof mm.tells).toBe("string");
      expect(mm.tells.length).toBeGreaterThan(0);
    }
  });

  it("the classic trio (SNA / SNB / ANB) is present and ANB documents its formula", () => {
    const data = getExampleData("Landmarks");
    const names = data.measurements.map(m => m.name);
    expect(names).toContain("SNA");
    expect(names).toContain("SNB");
    const anb = data.measurements.find(m => m.name === "ANB");
    expect(anb).toBeTruthy();
    expect(anb.formula).toBe("SNA − SNB");
  });
});

// ─── Build stages (Phase 6: step-by-step tracing overlay) ───────────────────
function mkM(label, extra = {}) {
  return { id: label, type: "point", label, points: [{ x: 1, y: 1 }], ...extra };
}

describe("buildStages", () => {
  it("uses explicit numeric stages sorted ascending", () => {
    const { stages, context, hasExplicit } = buildStages([
      mkM("A", { stage: 3 }), mkM("B", { stage: 1 }), mkM("C", { stage: 2 }), mkM("D", { stage: 1 }),
    ]);
    expect(hasExplicit).toBe(true);
    expect(stages.map(s => s.label)).toEqual(["1", "2", "3"]);
    expect(stages[0].markups.map(m => m.label)).toEqual(["B", "D"]);
    expect(stages[2].markups.map(m => m.label)).toEqual(["A"]);
    expect(context).toEqual([]);
  });

  it("uses explicit named stages in first-appearance order", () => {
    const { stages } = buildStages([
      mkM("N", { stage: "cranial base" }), mkM("S", { stage: "cranial base" }), mkM("A", { stage: "maxillary" }),
    ]);
    expect(stages.map(s => s.label)).toEqual(["cranial base", "maxillary"]);
    expect(stages[0].markups.map(m => m.label)).toEqual(["N", "S"]);
  });

  it("treats markups without a stage as always-visible context", () => {
    const { stages, context } = buildStages([
      mkM("Sil", { type: "silhouette" }), mkM("N", { stage: 1 }), mkM("A", { stage: 2 }),
    ]);
    expect(context.map(m => m.label)).toEqual(["Sil"]);
    expect(stages.length).toBe(2);
  });

  it("falls back to point-by-point guide order when no markup has a stage", () => {
    const { stages, context, hasExplicit } = buildStages([
      mkM("Sil", { type: "silhouette" }), mkM("N", { group: "cranial base" }), mkM("A", { group: "maxillary" }), mkM("B", { group: "cranial base" }), mkM("Lone", {}),
    ]);
    expect(hasExplicit).toBe(false);
    expect(stages.map(s => s.label)).toEqual(["N", "B", "A", "Lone"]);
    expect(stages.every(s => s.markups.length === 1)).toBe(true);
    expect(context.map(m => m.label)).toEqual(["Sil"]);
  });

  it("returns no stages when there are no placed points", () => {
    const { stages, context } = buildStages([
      { id: "a", type: "silhouette", label: "T" },
      { id: "b", type: "line", label: "L", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
    ]);
    expect(stages).toEqual([]);
    expect(context.length).toBe(2);
  });

  it("skips unplaced points in the fallback stages", () => {
    const { stages, context } = buildStages([
      mkM("Unplaced", { points: [{ x: -9001, y: -9001 }] }), mkM("Placed", {}),
    ]);
    expect(stages.map(s => s.label)).toEqual(["Placed"]);
    expect(context).toEqual([]);
  });

  it("Landmarks falls back to 35 point-by-point stages over the silhouette context", () => {
    const data = getExampleData("Landmarks");
    const { stages, context, hasExplicit } = buildStages(data.markups);
    expect(hasExplicit).toBe(false);
    expect(stages.length).toBe(35);
    expect(stages[0].label).toBe("Nasion");
    expect(stages[stages.length - 1].label).toBe("Rhinion");
    expect(stages.every(s => s.markups.length === 1)).toBe(true);
    expect(context.map(m => m.type)).toEqual(["silhouette"]);
  });

  it("validateExample rejects a wrong-typed stage field", () => {
    expect(validateExample(mkExample({ markups: [{ type: "point", label: "N", stage: {} }] }))).toMatch(/stage/);
  });

  it("validateExample accepts numeric and string stages", () => {
    expect(validateExample(mkExample({ markups: [{ type: "point", label: "N", stage: 2 }, { type: "point", label: "A", stage: "cranial base" }] }))).toBeNull();
  });

  it("validateExample accepts a string hint and rejects a wrong-typed hint", () => {
    expect(validateExample(mkExample({ markups: [{ type: "point", label: "N", hint: "Find the frontonasal suture." }] }))).toBeNull();
    expect(validateExample(mkExample({ markups: [{ type: "point", label: "N", hint: 42 }] }))).toMatch(/hint/);
  });
});

// ─── Community manifest (Phase 7: fetch + authoring docs) ─────────────────
function mkManifest(overrides = {}) {
  return {
    version: "1.0",
    updated: "2026-01-01",
    examples: [{ id: "e1", url: "https://example.com/a.cepht", label: "Twin Block", author: "Dr A", projection: "lateral", ptCount: 12 }],
    ...overrides,
  };
}

describe("parseCommunityManifest", () => {
  it("returns { updated, examples } for a well-formed manifest", () => {
    const res = parseCommunityManifest(mkManifest());
    expect(res).toEqual({
      updated: "2026-01-01",
      examples: [{
        id: "e1",
        url: "https://example.com/a.cepht",
        label: "Twin Block",
        subtitle: "",
        description: "",
        author: "Dr A",
        projection: "lateral",
        analysisName: "",
        ptCount: 12,
        badge: "12 pts",
      }],
    });
  });

  it("returns null for a structurally bad manifest", () => {
    expect(parseCommunityManifest(null)).toBeNull();
    expect(parseCommunityManifest({})).toBeNull();
    expect(parseCommunityManifest({ examples: "nope" })).toBeNull();
    expect(parseCommunityManifest([])).toBeNull();
  });

  it("drops entries without a url", () => {
    const res = parseCommunityManifest(mkManifest({
      examples: [{ id: "ok", url: "https://x/a.cepht" }, { id: "no-url" }, null, "string"],
    }));
    expect(res.examples.length).toBe(1);
    expect(res.examples[0].id).toBe("ok");
  });

  it("falls back to sensible defaults for missing fields", () => {
    const res = parseCommunityManifest(mkManifest({ examples: [{ url: "https://x/a.cepht" }] }));
    const ex = res.examples[0];
    expect(ex.id).toBe("community-0");
    expect(ex.label).toBe("community-0");
    expect(ex.ptCount).toBe(0);
    expect(ex.badge).toBe("community");
    expect(typeof ex.description).toBe("string");
    expect(typeof ex.author).toBe("string");
  });

  it("keeps optional subtitle / description / analysisName when provided", () => {
    const res = parseCommunityManifest(mkManifest({
      examples: [{ id: "e", url: "https://x/a.cepht", subtitle: "fun", description: "desc", analysisName: "Steiner Analysis" }],
    }));
    expect(res.examples[0].subtitle).toBe("fun");
    expect(res.examples[0].description).toBe("desc");
    expect(res.examples[0].analysisName).toBe("Steiner Analysis");
  });

  it("exposes repo and contribution URLs", () => {
    expect(typeof COMMUNITY_EXAMPLES_URL).toBe("string");
    expect(COMMUNITY_EXAMPLES_URL.endsWith("Examples/manifest.json")).toBe(true);
    expect(getRepoURL()).toContain("github.com");
    expect(getContributionURL()).toContain("contribute.html");
  });
});

