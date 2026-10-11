import { describe, expect, it } from "vitest";
import { getAppUrl } from "./app-url";

// fix/app-url (v1.5.4): production had neither NEXT_PUBLIC_SITE_URL nor
// NEXT_PUBLIC_APP_URL set, so every email link, share link and PDF link pointed
// at http://localhost:3000.
describe("getAppUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL, then NEXT_PUBLIC_APP_URL", () => {
    expect(getAppUrl({ NEXT_PUBLIC_SITE_URL: "https://a.example", NEXT_PUBLIC_APP_URL: "https://b.example" })).toBe(
      "https://a.example",
    );
    expect(getAppUrl({ NEXT_PUBLIC_APP_URL: "https://b.example" })).toBe("https://b.example");
  });

  it("on a Vercel production deploy with nothing configured, uses the project's production domain", () => {
    expect(
      getAppUrl({
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "satsend.me",
        VERCEL_URL: "satsendofficial-abc123.vercel.app",
      }),
    ).toBe("https://satsend.me");
  });

  it("on a Vercel preview deploy, uses that deployment's own URL", () => {
    expect(
      getAppUrl({
        VERCEL_ENV: "preview",
        VERCEL_PROJECT_PRODUCTION_URL: "satsend.me",
        VERCEL_URL: "satsendofficial-abc123.vercel.app",
      }),
    ).toBe("https://satsendofficial-abc123.vercel.app");
  });

  it("falls back to localhost only off Vercel (local dev)", () => {
    expect(getAppUrl({})).toBe("http://localhost:3000");
  });

  it("drops a trailing slash so callers can append paths", () => {
    expect(getAppUrl({ NEXT_PUBLIC_APP_URL: "https://satsend.me/" })).toBe("https://satsend.me");
  });

  it("ignores blank values", () => {
    expect(getAppUrl({ NEXT_PUBLIC_SITE_URL: " ", VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "satsend.me" })).toBe(
      "https://satsend.me",
    );
  });
});
