import { describe, it, expect } from "vitest";
import {
  importCephxPayload, validateCepht, normalizeImageEntry, normalizeSessionImages,
  CEPHX_FORMAT, CEPHX_VERSION, CEPHT_FORMAT, CEPHT_VERSIONS,
} from "../storage/cephxFormat.js";

// ═════════════════════════════════════════════════════════════════
// cephxFormat — .cephx import validation + migration + .cepht
// validation, covering the D4/D5 findings from the code review.
//
// D4 — legacy `session.image` (singular) was only normalized on
//      export, not import, so imported files kept the singular shape.
//      Now `importCephxPayload` and `normalizeSessionImages` coerce
//      the old shape to `session.images[]` on every import AND export.
// D5 — code wrote v2.1 but docs said v2.0; `.cepht` 1.0/2.0 split
//      was undocumented; validateCepht was minimal.
// ═════════════════════════════════════════════════════════════════

// ─── normalizeImageEntry ──────────────────────────────────────────────────
describe("normalizeImageEntry", () => {
  it("coerces a bare dataUrl string into a full image entry", () => {
    const e = normalizeImageEntry("data:image/png;base64,AAAA");
    expect(e).not.toBeNull();
    expect(e.id).toBeTruthy();
    expect(e.name).toBe("Imported");
    expect(e.dataUrl).toBe("data:image/png;base64,AAAA");
    expect(e.dx).toBe(0);
    expect(e.opacity).toBe(1);
    expect(e.visible).toBe(true);
    expect(e.transform).toEqual({ tx: 0, ty: 0, rot: 0, scale: 1 });
  });

  it("fills missing fields with defaults for a partial object", () => {
    const e = normalizeImageEntry({ id: "x" });
    expect(e.id).toBe("x");
    expect(e.name).toBe("Imported");
    expect(e.dataUrl).toBeNull();
    expect(e.blendMode).toBe("normal");
    expect(e.visible).toBe(true);
  });

  it("returns null for falsy or non-object input", () => {
    expect(normalizeImageEntry(null)).toBeNull();
    expect(normalizeImageEntry(42)).toBeNull();
  });

  it("coerces non-finite numeric fields to defaults", () => {
    const e = normalizeImageEntry({ dx: "bad", opacity: NaN, dy: 10 });
    expect(e.dx).toBe(0);
    expect(e.opacity).toBe(1);
    expect(e.dy).toBe(10);
  });
});

// ─── normalizeSessionImages ───────────────────────────────────────────────
describe("normalizeSessionImages", () => {
  it("moves a legacy session.image (object) into session.images[]", () => {
    const s = normalizeSessionImages({
      id: "s1",
      image: { dataUrl: "data:img/png;base64,AAAA", name: "old.png" },
    });
    expect(s.images).toHaveLength(1);
    expect(s.images[0].dataUrl).toBe("data:img/png;base64,AAAA");
    expect(s.image).toBeUndefined();
  });

  it("moves a legacy session.image (bare string) into session.images[]", () => {
    const s = normalizeSessionImages({ id: "s1", image: "data:img/png;base64,AAAA" });
    expect(s.images).toHaveLength(1);
    expect(s.images[0].dataUrl).toBe("data:img/png;base64,AAAA");
    expect(s.image).toBeUndefined();
  });

  it("does NOT touch session.images[] when already populated", () => {
    const existing = [{ id: "e1", name: "x" }];
    const s = normalizeSessionImages({ images: [...existing] });
    expect(s.images).toHaveLength(1);
    expect(s.images[0].id).toBe("e1");
  });

  it("keeps session.image undefined when both images[] and image exist", () => {
    const s = normalizeSessionImages({
      images: [{ id: "e1", dataUrl: "a" }],
      image: { dataUrl: "b" },
    });
    expect(s.images).toHaveLength(1);
    expect(s.images[0].id).toBe("e1");
    expect(s.image).toBeUndefined();
  });

  it("returns the input unchanged when session is null/undefined", () => {
    expect(normalizeSessionImages(null)).toBeNull();
    expect(normalizeSessionImages(undefined)).toBeUndefined();
  });
});

// ─── importCephxPayload ───────────────────────────────────────────────────
describe("importCephxPayload", () => {
  const validProject = {
    id: "p1",
    name: "Test Case",
    projection: "lateral",
    sessions: [
      { id: "s1", name: "T0", markups: [], images: [], calibration: { done: false, pxPerMm: 1 } },
    ],
    activeSessionId: "s1",
  };

  function validPayload(overrides) {
    return { format: CEPHX_FORMAT, version: CEPHX_VERSION, project: { ...validProject, ...overrides } };
  }

  it("accepts a well-formed payload", () => {
    const r = importCephxPayload(validPayload());
    expect(r.ok).toBe(true);
    expect(r.project.id).toBe("p1");
    expect(r.warnings).toEqual([]);
  });

  it("rejects null / non-object", () => {
    expect(importCephxPayload(null).ok).toBe(false);
    expect(importCephxPayload("string").ok).toBe(false);
  });

  it("rejects wrong format (not .cephx)", () => {
    const r = importCephxPayload({ format: "wrong", project: validProject });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/cephx/);
  });

  it("accepts a missing format tag if project is present (legacy file)", () => {
    const r = importCephxPayload({ project: validProject });
    expect(r.ok).toBe(true);
    expect(r.warnings.some(w => /missing.*cephx/i.test(w))).toBe(true);
  });

  it("rejects a missing format tag with no project", () => {
    expect(importCephxPayload({ format: undefined }).ok).toBe(false);
  });

  it("rejects payload with no project object", () => {
    expect(importCephxPayload({ format: "cephx" }).ok).toBe(false);
  });

  it("rejects project with no sessions array", () => {
    const r = importCephxPayload({ format: "cephx", project: { id: "p", sessions: null } });
    expect(r.ok).toBe(false);
  });

  it("filters out null / malformed sessions and reports them", () => {
    const r = importCephxPayload({
      format: "cephx", version: "2.1",
      project: {
        ...validProject,
        sessions: [null, { id: "s1", name: "T0" }],
      },
    });
    expect(r.ok).toBe(true);
    expect(r.project.sessions).toHaveLength(1);
  });

  // ── Migration / normalization ───────────────────────────────────────────
  it("migrates v2.0 → v2.1 with a warning", () => {
    const r = importCephxPayload({ format: "cephx", version: "2.0", project: validProject });
    expect(r.ok).toBe(true);
    expect(r.version).toBe(CEPHX_VERSION);
    expect(r.warnings.some(w => /migrat/i.test(w))).toBe(true);
  });

  it("normalizes legacy session.image (singular) on import (D4)", () => {
    const proj = {
      ...validProject,
      sessions: [{
        id: "s1", name: "T0",
        image: { id: "old", dataUrl: "data:img/png;base64,AAAA" },
      }],
    };
    const r = importCephxPayload({ format: "cephx", version: "2.1", project: proj });
    expect(r.ok).toBe(true);
    const s = r.project.sessions[0];
    expect(s.images).toHaveLength(1);
    expect(s.images[0].dataUrl).toBe("data:img/png;base64,AAAA");
    expect(s.image).toBeUndefined();
  });

  it("normalizes legacy session.image (bare string) on import (D4)", () => {
    const proj = {
      ...validProject,
      sessions: [{ id: "s1", name: "T0", image: "data:img/png;base64,BBBB" }],
    };
    const r = importCephxPayload({ format: "cephx", version: "2.1", project: proj });
    expect(r.ok).toBe(true);
    expect(r.project.sessions[0].images[0].dataUrl).toBe("data:img/png;base64,BBBB");
  });

  it("moves a deprecated top-level project.images into the first session", () => {
    const proj = {
      ...validProject,
      images: [{ id: "top", dataUrl: "data:img/png;base64,CCCC" }],
    };
    const r = importCephxPayload({ format: "cephx", version: "2.1", project: proj });
    expect(r.ok).toBe(true);
    expect(r.project.images).toBeUndefined();
    expect(r.project.sessions[0].images.some(i => i.id === "top")).toBe(true);
    expect(r.warnings.some(w => /project\.images/i.test(w))).toBe(true);
  });

  it("fixes activeSessionId pointing at a missing session", () => {
    const proj = { ...validProject, activeSessionId: "missing" };
    const r = importCephxPayload({ format: "cephx", version: "2.1", project: proj });
    expect(r.ok).toBe(true);
    expect(r.project.activeSessionId).toBe("s1");
  });

  it("drops legacy reproStudies field", () => {
    const proj = { ...validProject, reproStudies: [{ id: "old" }] };
    const r = importCephxPayload({ format: "cephx", version: "2.1", project: proj });
    expect(r.ok).toBe(true);
    expect(r.project.reproStudies).toBeUndefined();
  });

  it("warns but accepts unknown future versions (best-effort forward compat)", () => {
    const r = importCephxPayload({ format: "cephx", version: "9.9", project: validProject });
    expect(r.ok).toBe(true);
    expect(r.warnings.some(w => /unknown/i.test(w))).toBe(true);
  });

  it("generates a missing project.id", () => {
    const proj = { ...validProject, id: undefined };
    const r = importCephxPayload({ format: "cephx", version: "2.1", project: proj });
    expect(r.ok).toBe(true);
    expect(typeof r.project.id).toBe("string");
    expect(r.project.id.length).toBeGreaterThan(0);
  });

  it("ensures research-related arrays exist even when absent", () => {
    const proj = { ...validProject, subjects: undefined, groups: undefined };
    const r = importCephxPayload({ format: "cephx", version: "2.1", project: proj });
    expect(r.ok).toBe(true);
    expect(Array.isArray(r.project.subjects)).toBe(true);
    expect(Array.isArray(r.project.groups)).toBe(true);
    expect(Array.isArray(r.project.timepoints)).toBe(true);
  });
});

// ─── validateCepht (enhanced) ─────────────────────────────────────────────
describe("validateCepht", () => {
  const mk = (overrides) => ({
    format: CEPHT_FORMAT,
    name: "Test Template",
    version: "2.0",
    markups: [{ label: "SNA", type: "angle3" }],
    ...overrides,
  });

  it("accepts a valid v2.0 template with markups", () => {
    expect(validateCepht(mk())).toBeNull();
  });

  it("accepts a valid v1.0 template (definitions only)", () => {
    expect(validateCepht(mk({ version: "1.0" }))).toBeNull();
  });

  it("rejects non-object input", () => {
    expect(typeof validateCepht(null)).toBe("string");
    expect(typeof validateCepht(42)).toBe("string");
  });

  it("rejects wrong format", () => {
    expect(validateCepht(mk({ format: "wrong" }))).toMatch(/cepht/);
  });

  it("rejects non-array markups", () => {
    expect(validateCepht(mk({ markups: "not-an-array" }))).toMatch(/markups/);
  });

  it("rejects an unsupported .cepht version", () => {
    expect(validateCepht(mk({ version: "0.1" }))).toMatch(/Unsupported/);
  });

  it("rejects a markup entry that is not an object", () => {
    expect(validateCepht(mk({ markups: ["bad"] }))).toMatch(/not an object/);
  });

  it("rejects non-array points in a v2.0 template", () => {
    expect(validateCepht(mk({ markups: [{ label: "X", points: "oops" }] }))).toMatch(/non-array points/);
  });

  it("allows missing points in a v2.0 template (placed=false)", () => {
    expect(validateCepht(mk({ markups: [{ label: "X" }] }))).toBeNull();
  });

  it("returns null for empty markups array", () => {
    expect(validateCepht(mk({ markups: [] }))).toBeNull();
  });
});

// ─── constants ─────────────────────────────────────────────────────────────
describe("format constants", () => {
  it("CEPHX_FORMAT is 'cephx'", () => expect(CEPHX_FORMAT).toBe("cephx"));
  it("CEPHX_VERSION is '2.1'", () => expect(CEPHX_VERSION).toBe("2.1"));
  it("CEPHT_FORMAT is 'cepht'", () => expect(CEPHT_FORMAT).toBe("cepht"));
  it("CEPHT_VERSIONS includes 1.0 and 2.0", () => {
    expect(CEPHT_VERSIONS).toContain("1.0");
    expect(CEPHT_VERSIONS).toContain("2.0");
  });
});
