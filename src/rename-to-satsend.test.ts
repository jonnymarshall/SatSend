import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

// Construct the forbidden token at runtime so this file is not its own match.
const FORBIDDEN = ["pay", "bitty"].join("");
const FORBIDDEN_RE = new RegExp(FORBIDDEN, "i");

function grepCount(targets: string[], extra = ""): { count: number; files: string[] } {
  const existing = targets.filter((t) => existsSync(path.join(ROOT, t)));
  if (existing.length === 0) return { count: 0, files: [] };
  try {
    const out = execSync(`grep -RIil "${FORBIDDEN}" ${extra} ${existing.join(" ")}`, {
      cwd: ROOT,
      encoding: "utf8",
    });
    const files = out.trim().split("\n").filter(Boolean);
    return { count: files.length, files };
  } catch (err) {
    const e = err as { status?: number };
    if (e.status === 1) return { count: 0, files: [] };
    throw err;
  }
}

describe(`v1.4.15 rename guard — living copy reads SatSend, not the old name`, () => {
  it(`src/ contains zero forbidden references`, () => {
    const { files } = grepCount(["src"]);
    expect(files).toEqual([]);
  });

  it(`manual-tests/ contains zero forbidden references`, () => {
    const { files } = grepCount(["manual-tests"]);
    expect(files).toEqual([]);
  });

  it(`top-level docs and config contain zero forbidden references`, () => {
    const { files } = grepCount([
      "README.md",
      "AGENTS.md",
      "CLAUDE.md",
      "package.json",
      "package-lock.json",
    ]);
    expect(files).toEqual([]);
  });

  it(`development/ living docs contain zero forbidden references (archive excluded)`, () => {
    const { files } = grepCount(
      ["development"],
      "--exclude=ROADMAP-ARCHIVE.md --exclude-dir=archive",
    );
    expect(files).toEqual([]);
  });

  it(`ROADMAP.md title line reads SatSend`, () => {
    const head = execSync("head -1 development/ROADMAP.md", {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(head).not.toMatch(FORBIDDEN_RE);
  });
});
