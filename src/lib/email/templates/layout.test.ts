import { describe, expect, it } from "vitest";
import { emailLogoUrl } from "./layout";

describe("emailLogoUrl", () => {
  it("uses the app's own address when it is public", () => {
    expect(emailLogoUrl("https://satsend.me")).toBe("https://satsend.me/brand/satsend-logo-email.png");
    expect(emailLogoUrl("https://preview-abc.vercel.app")).toBe(
      "https://preview-abc.vercel.app/brand/satsend-logo-email.png",
    );
  });

  it("borrows the live site's logo when sending from local dev (email apps can't reach localhost)", () => {
    expect(emailLogoUrl("http://localhost:3000")).toBe("https://satsend.me/brand/satsend-logo-email.png");
    expect(emailLogoUrl("http://127.0.0.1:3000")).toBe("https://satsend.me/brand/satsend-logo-email.png");
  });
});
