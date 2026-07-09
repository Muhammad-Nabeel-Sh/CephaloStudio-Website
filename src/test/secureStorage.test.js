import { describe, it, expect } from "vitest";
import { encryptJSON, decryptJSON, secureStorageAvailable, clearSecureStorage } from "../storage/secureStorage.js";

// ═════════════════════════════════════════════════════════════════
// Encryption-at-rest for the PHI autosave (P1).
// Round-trip + envelope-shape + plaintext-fallback + migration tests.
// ═════════════════════════════════════════════════════════════════

describe("secureStorage", () => {
  const phi = [{ id: "p1", meta: { patientId: "John Doe", dob: "1990-01-01" }, sessions: [] }];

  it("encryptJSON produces an envelope object (not a bare plaintext string)", async () => {
    const env = await encryptJSON(phi);
    expect(env).toBeDefined();
    expect(typeof env).toBe("object");
    expect(env.v).toBe(1);
    // enc flag reflects whatever the environment supports
    expect(typeof env.enc).toBe("boolean");
  });

  it("round-trips PHI through encrypt → decrypt when crypto is available", async () => {
    const env = await encryptJSON(phi);
    if (!secureStorageAvailable()) {
      // Plaintext-fallback environment (jsdom without SubtleCrypto): the
      // envelope still round-trips via the plaintext branch.
      expect(env.enc).toBe(false);
      const out = await decryptJSON(env);
      expect(out).toEqual(phi);
      return;
    }
    expect(env.enc).toBe(true);
    // The ciphertext must not contain the PHI string.
    expect(JSON.stringify(env)).not.toContain("John Doe");
    const out = await decryptJSON(env);
    expect(out).toEqual(phi);
  });

  it("decryptJSON returns null for a non-envelope (legacy plaintext array detection)", async () => {
    expect(await decryptJSON(null)).toBeNull();
    expect(await decryptJSON("not-an-envelope")).toBeNull();
    expect(await decryptJSON([1, 2, 3])).toBeNull();
  });

  it("decryptJSON handles the plaintext fallback envelope", async () => {
    const env = { v: 1, enc: false, plaintext: JSON.stringify([{ id: "x" }]) };
    const out = await decryptJSON(env);
    expect(out).toEqual([{ id: "x" }]);
  });

  it("clearSecureStorage resolves and is safe to call repeatedly", async () => {
    await expect(clearSecureStorage("cephalometry_projects_test")).resolves.toBeUndefined();
    await expect(clearSecureStorage("cephalometry_projects_test")).resolves.toBeUndefined();
  });
});
