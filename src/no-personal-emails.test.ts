import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

// Real people's addresses never belong in the repo (Jonny, 2026-10-28: test
// emails go to a private address that must never be committed). Scripts take
// recipients on the command line instead. Fails on any address at a personal
// mail provider, except obvious placeholders like you+satsend1@gmail.com.
const PERSONAL =
  /[a-z0-9._%+-]+@(protonmail\.(com|ch)|proton\.me|pm\.me|gmail\.com|googlemail\.com|outlook\.com|hotmail\.com|live\.com|icloud\.com|me\.com|yahoo\.[a-z.]+|aol\.com)/gi;
const PLACEHOLDER = /^(you|your-?name|name|user|someone|example)(\+[a-z0-9]+)?@/i;

describe("no personal email addresses in the repo", () => {
  it("tracked files hold none", () => {
    const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
      .split("\0")
      .filter((f) => f && f !== "package-lock.json");
    const hits = execFileSync("git", ["grep", "-IhoiE", PERSONAL.source, "--", ...files], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    })
      .split("\n")
      .filter(Boolean)
      .filter((address) => !PLACEHOLDER.test(address));
    expect(hits).toEqual([]);
  });
});
