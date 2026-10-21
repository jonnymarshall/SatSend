import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

/*
 * The QR library draws the code a client scans to pay (v1.5.18). It is updated
 * only on purpose, never automatically: package.json pins the exact version (no
 * ^ or ~), and the lockfile holds that version with its integrity hash, so
 * `npm ci` (CI, and Vercel with a lockfile) installs exactly the audited copy.
 *
 * To upgrade deliberately: review the new release, change the version here AND
 * in package.json, run `npm install qrcode@<version> --save-exact`, and commit
 * the lockfile.
 */
const AUDITED = {
  qrcode: {
    version: "1.5.4",
    integrity: "sha512-1ca71Zgiu6ORjHqFBDpnSMTR2ReToX4l1Au1VFLyVeBTFavzQnv5JxMFr3ukHVKpSrSA2MCk0lNJSykjUfz7Zg==",
  },
};

const root = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));

describe("QR code library is pinned (v1.5.18)", () => {
  it("package.json asks for exactly the audited version, with no range", () => {
    expect(pkg.dependencies.qrcode).toBe(AUDITED.qrcode.version);
    expect(pkg.devDependencies["@types/qrcode"]).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("the lockfile installs that exact copy (version and integrity hash)", () => {
    const entry = lock.packages["node_modules/qrcode"];
    expect(entry.version).toBe(AUDITED.qrcode.version);
    expect(entry.integrity).toBe(AUDITED.qrcode.integrity);
    expect(lock.packages[""].dependencies.qrcode).toBe(AUDITED.qrcode.version);
  });
});
