import { describe, it, expect } from "vitest";
import { isTestDatabaseUrl } from "./sweep-guard.mjs";

describe("dev:sweep database guard", () => {
  it("allows the test project and a local Supabase", () => {
    expect(isTestDatabaseUrl("https://hfqjxuosyxbkkvghanzw.supabase.co")).toBe(true);
    expect(isTestDatabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isTestDatabaseUrl("http://localhost:54321")).toBe(true);
  });

  it("refuses any other project (production included), lookalikes and missing values", () => {
    expect(isTestDatabaseUrl("https://someotherproject.supabase.co")).toBe(false);
    expect(isTestDatabaseUrl("https://hfqjxuosyxbkkvghanzw.supabase.co.evil.example")).toBe(false);
    expect(isTestDatabaseUrl("https://evil.example/hfqjxuosyxbkkvghanzw.supabase.co")).toBe(false);
    expect(isTestDatabaseUrl(undefined)).toBe(false);
    expect(isTestDatabaseUrl("not a url")).toBe(false);
  });
});
