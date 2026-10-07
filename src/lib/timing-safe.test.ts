import { describe, it, expect } from "vitest";
import { timingSafeStringEqual } from "./timing-safe";

describe("timingSafeStringEqual", () => {
  it("is true for equal strings", () => {
    expect(timingSafeStringEqual("s3cret-value", "s3cret-value")).toBe(true);
  });

  it("is false for different strings of equal length", () => {
    expect(timingSafeStringEqual("s3cret-value", "s3cret-valuf")).toBe(false);
  });

  it("is false for different lengths", () => {
    expect(timingSafeStringEqual("short", "a-much-longer-secret")).toBe(false);
  });

  it("is false when either side is null or undefined", () => {
    expect(timingSafeStringEqual(null, "x")).toBe(false);
    expect(timingSafeStringEqual("x", undefined)).toBe(false);
    expect(timingSafeStringEqual(null, null)).toBe(false);
  });

  it("is true for two empty strings", () => {
    expect(timingSafeStringEqual("", "")).toBe(true);
  });
});
