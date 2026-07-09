import { describe, it, expect } from "vitest";
import { anonymizeProject, hasUnanonymizedPHI } from "../anonymize.js";

// ═════════════════════════════════════════════════════════════════
// De-identification with audit trail (P2 + P3).
// ═════════════════════════════════════════════════════════════════

function makeProject() {
  return {
    id: "p1", name: "Case 001",
    meta: { patientId: "HOSP-123", patientName: "John Doe", dob: "1990-05-12", age: "34", gender: "M", clinician: "Dr. Smith", facility: "General Hospital", referral: "Ortho", notes: "sensitive note", anonymized: false },
    sessions: [
      { id: "s1", subjectId: "SUB-123", meta: { patientId: "HOSP-123", operatorId: "opA", group: "Treatment", timepoint: "T1", age: "34", sex: "M", trialNumber: 1 } },
      { id: "s2", subjectId: "SUB-123", meta: { patientId: "HOSP-123", operatorId: "opB", group: "Treatment", timepoint: "T2", age: "34", sex: "M", trialNumber: 2 } },
    ],
  };
}

describe("anonymizeProject", () => {
  it("is non-destructive — the original project is not mutated", async () => {
    const p = makeProject();
    const before = JSON.stringify(p);
    await anonymizeProject(p, { reason: "manual" });
    expect(JSON.stringify(p)).toBe(before);
    expect(p.meta.patientName).toBe("John Doe"); // still there
    expect(p.sessions[0].meta.patientId).toBe("HOSP-123");
  });

  it("clears patient PHI in project.meta and every session.meta", async () => {
    const p = makeProject();
    const a = await anonymizeProject(p, { reason: "export" });
    expect(a.meta.patientName).toBe("");
    expect(a.meta.dob).toBe("");
    expect(a.meta.age).toBe("");
    expect(a.meta.clinician).toBe("");
    expect(a.meta.facility).toBe("");
    expect(a.meta.referral).toBe("");
    expect(a.meta.notes).toBe("[Anonymized]");
    expect(a.meta.patientId).toMatch(/^ANON-/);
    expect(a.meta.anonymized).toBe(true);
    for (const s of a.sessions) {
      expect(s.meta.patientId).toBe("");
      expect(s.meta.age).toBe("");
      expect(s.meta.sex).toBe("");
      expect(s.subjectId).toBe("");
    }
  });

  it("pseudonymizes operatorIds (Rater-1, Rater-2) and keeps group/timepoint/trial", async () => {
    const a = await anonymizeProject(makeProject(), { reason: "export" });
    expect(a.sessions[0].meta.operatorId).toBe("Rater-1");
    expect(a.sessions[1].meta.operatorId).toBe("Rater-2");
    expect(a.sessions[0].meta.group).toBe("Treatment"); // research label kept
    expect(a.sessions[0].meta.timepoint).toBe("T1");
    expect(a.sessions[1].meta.trialNumber).toBe(2);
  });

  it("appends a structured audit-log entry with who/when/reason", async () => {
    const a = await anonymizeProject(makeProject(), { operatorId: "clerk-9", reason: "manual" });
    const log = a.meta.anonymizationLog;
    expect(log).toHaveLength(1);
    const e = log[0];
    expect(e.operatorId).toBe("clerk-9");
    expect(e.reason).toBe("manual");
    expect(typeof e.timestamp).toBe("number");
    expect(e.iso).toMatch(/^20\d\d-/);
    expect(e.fieldsCleared.length).toBeGreaterThan(0);
  });

  it("retains salted provenance hashes (not the original values)", async () => {
    const a = await anonymizeProject(makeProject(), { reason: "export" });
    const e = a.meta.anonymizationLog[0];
    expect(e.provenance).toBeTruthy();
    expect(e.provenance.salt).toBeTruthy();
    expect(e.provenance.hashes["project.patientName"]).toBeTruthy();
    // The original value must not appear anywhere in the anonymized output.
    expect(JSON.stringify(a)).not.toContain("John Doe");
    expect(JSON.stringify(a)).not.toContain("1990-05-12");
    expect(JSON.stringify(a)).not.toContain("HOSP-123");
  });

  it("accumulates audit entries across repeated anonymizations", async () => {
    let p = makeProject();
    p = await anonymizeProject(p, { reason: "manual" });
    // Re-anonymize the already-anonymized project (simulating a second pass).
    p = await anonymizeProject(p, { reason: "audit" });
    expect(p.meta.anonymizationLog).toHaveLength(2);
    expect(p.meta.anonymizationLog[0].reason).toBe("manual");
    expect(p.meta.anonymizationLog[1].reason).toBe("audit");
  });
});

describe("hasUnanonymizedPHI", () => {
  it("detects PHI in an un-anonymized project", () => {
    expect(hasUnanonymizedPHI(makeProject())).toBe(true);
  });
  it("returns false after anonymization", async () => {
    const a = await anonymizeProject(makeProject(), { reason: "export" });
    expect(hasUnanonymizedPHI(a)).toBe(false);
  });
  it("flags per-session patient PHI even if project.meta is clean", () => {
    const p = { meta: { anonymized: true }, sessions: [{ meta: { patientId: "X" } }] };
    expect(hasUnanonymizedPHI(p)).toBe(true);
  });
  it("returns false for null/empty projects", () => {
    expect(hasUnanonymizedPHI(null)).toBe(false);
    expect(hasUnanonymizedPHI({ meta: {}, sessions: [] })).toBe(false);
  });
});
