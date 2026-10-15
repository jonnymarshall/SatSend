/**
 * Writes the Supabase sign-up / sign-in email templates (v1.5.11).
 *
 *   npx tsx scripts/email/build-auth-templates.tsx
 *
 * Re-run after changing src/lib/email/templates/layout.tsx or auth-emails.tsx;
 * a drift test fails until the committed HTML matches. Then re-apply the files
 * to the hosted projects (Auth → Email Templates).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AUTH_TEMPLATES, buildAuthTemplate } from "../../src/lib/email/templates/auth-emails";

async function main() {
  const outDir = path.resolve(__dirname, "../../supabase/templates");
  mkdirSync(outDir, { recursive: true });

  for (const template of AUTH_TEMPLATES) {
    const file = path.join(outDir, template.file);
    writeFileSync(file, await buildAuthTemplate(template));
    console.log(`wrote ${path.relative(process.cwd(), file)} (subject: "${template.subject}")`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
