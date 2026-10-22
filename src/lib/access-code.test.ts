import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { accessToken, hasAccess, isAccessCodeValid } from "./access-code";

describe("isAccessCodeValid", () => {
  it("returns true when no code is required", () => {
    expect(isAccessCodeValid(null, null)).toBe(true);
    expect(isAccessCodeValid(null, "anything")).toBe(true);
  });

  it("returns true when provided code matches required code", () => {
    expect(isAccessCodeValid("ABC123", "ABC123")).toBe(true);
  });

  it("returns false when provided code does not match", () => {
    expect(isAccessCodeValid("ABC123", "WRONG")).toBe(false);
  });

  it("returns false when code is required but nothing is provided", () => {
    expect(isAccessCodeValid("ABC123", null)).toBe(false);
  });

  it("matches case-insensitively (legacy uppercase codes still accept lowercase input)", () => {
    expect(isAccessCodeValid("ABC123", "abc123")).toBe(true);
    expect(isAccessCodeValid("abc123", "ABC123")).toBe(true);
    expect(isAccessCodeValid("AbC123", "aBc123")).toBe(true);
  });
});

describe("access cookie fingerprint (v1.5.26)", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("never contains the code itself", () => {
    const token = accessToken("inv-1", "SECRET1");
    expect(token).not.toContain("SECRET1");
    expect(token.toLowerCase()).not.toContain("secret1");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("opens the invoice it was made for, whatever the code's case", () => {
    expect(hasAccess("inv-1", "SECRET1", accessToken("inv-1", "secret1"))).toBe(true);
  });

  it("does not open another invoice with the same code", () => {
    expect(hasAccess("inv-2", "SECRET1", accessToken("inv-1", "SECRET1"))).toBe(false);
  });

  it("refuses the plain code, a wrong code's fingerprint, and nothing", () => {
    expect(hasAccess("inv-1", "SECRET1", "SECRET1")).toBe(false);
    expect(hasAccess("inv-1", "SECRET1", accessToken("inv-1", "WRONG1"))).toBe(false);
    expect(hasAccess("inv-1", "SECRET1", null)).toBe(false);
  });

  it("needs no cookie when the invoice has no code", () => {
    expect(hasAccess("inv-1", null, null)).toBe(true);
  });

  it("can't be made without the server's secret", () => {
    const made = accessToken("inv-1", "SECRET1");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "another-key");
    expect(hasAccess("inv-1", "SECRET1", made)).toBe(false);
  });

  it("fails closed when the server's secret is missing", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(() => accessToken("inv-1", "SECRET1")).toThrow();
    expect(hasAccess("inv-1", "SECRET1", "anything")).toBe(false);
  });
});
