import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import path from "path";

// v1.5.32 (roadmap v1.5.2.17-H): /.well-known/security.txt (RFC 9116) tells
// security researchers how to report a problem. Contact and Expires are
// required; an expired file is treated as stale, so this test also fails a
// couple of months before the date, as a reminder to renew it.
const FILE = path.join(process.cwd(), "public/.well-known/security.txt");

function field(text: string, name: string): string[] {
  return text
    .split("\n")
    .filter((line) => line.toLowerCase().startsWith(`${name.toLowerCase()}:`))
    .map((line) => line.slice(name.length + 1).trim());
}

describe("security.txt", () => {
  it("exists at /.well-known/security.txt", () => {
    expect(existsSync(FILE)).toBe(true);
  });

  it("names a contact: the Security page's report section, over https", () => {
    const text = readFileSync(FILE, "utf8");
    expect(field(text, "Contact")).toEqual(["https://satsend.me/security#security--report"]);
  });

  it("has an Expires date in RFC 3339 form, at least 60 days away and at most a year", () => {
    const text = readFileSync(FILE, "utf8");
    const [expires] = field(text, "Expires");
    expect(expires).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
    const days = (new Date(expires).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(60);
    expect(days).toBeLessThanOrEqual(366);
  });

  it("states its canonical address and that reports are read in English", () => {
    const text = readFileSync(FILE, "utf8");
    expect(field(text, "Canonical")).toEqual(["https://satsend.me/.well-known/security.txt"]);
    expect(field(text, "Preferred-Languages")).toEqual(["en"]);
  });
});
