import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AUTH_TEMPLATES, buildAuthTemplate } from "./auth-emails";

const root = path.resolve(__dirname, "../../../..");

describe.each(AUTH_TEMPLATES)("auth email: $name", (template) => {
  it("leaves Supabase's link placeholder intact (not escaped or encoded)", async () => {
    const html = await buildAuthTemplate(template);
    // Button and the written-out link.
    expect(html.match(/href="\{\{ \.ConfirmationURL \}\}"/g)?.length).toBe(2);
    expect(html).toContain(">{{ .ConfirmationURL }}<");
    expect(html).not.toMatch(/%7B%7B|&#123;|&lbrace;/);
  });

  it("loads the logo from the live site and never mentions localhost", async () => {
    const html = await buildAuthTemplate(template);
    expect(html).toContain('src="https://satsend.me/brand/satsend-logo-email.png"');
    expect(html).not.toMatch(/localhost|127\.0\.0\.1/);
  });

  it("has the agreed button and closing line", async () => {
    // Pretty-printing wraps long text across lines; HTML treats that as one space.
    const html = (await buildAuthTemplate(template)).replace(/\s+/g, " ");
    expect(html).toContain(template.button);
    expect(html).toContain("If you didn&#x27;t ask for this, ignore this email.");
  });

  it("committed HTML matches a fresh build (run scripts/email/build-auth-templates.tsx)", async () => {
    const committed = readFileSync(path.join(root, "supabase/templates", template.file), "utf8");
    expect(committed).toBe(await buildAuthTemplate(template));
  });

  it("supabase/config.toml points at the file with the agreed subject", () => {
    const config = readFileSync(path.join(root, "supabase/config.toml"), "utf8");
    const section = config.split(`[auth.email.template.${template.name}]`)[1]?.split(/\n\[/)[0] ?? "";
    expect(section).toContain(`subject = "${template.subject}"`);
    expect(section).toContain(`content_path = "./supabase/templates/${template.file}"`);
  });
});

it("covers both emails passwordless login sends", () => {
  expect(AUTH_TEMPLATES.map((t) => [t.name, t.subject])).toEqual([
    ["confirmation", "Confirm your SatSend account"],
    ["magic_link", "Your SatSend sign-in link"],
  ]);
});
