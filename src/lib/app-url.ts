type Env = Record<string, string | undefined>;

const clean = (v: string | undefined) => v?.trim().replace(/\/+$/, "") || undefined;

/**
 * Public base URL of the app, for links in emails, PDFs and the share link
 * (fix/app-url, v1.5.4). Order:
 * 1. NEXT_PUBLIC_SITE_URL, then NEXT_PUBLIC_APP_URL (explicit configuration).
 * 2. On Vercel production: VERCEL_PROJECT_PRODUCTION_URL, which Vercel sets on
 *    every deployment to the project's shortest production custom domain (or its
 *    vercel.app domain if there is none). Host only, so https:// is added.
 * 3. On other Vercel deployments (preview): VERCEL_URL, that deployment's URL.
 * 4. http://localhost:3000, only off Vercel (local dev).
 *
 * Production previously set neither variable in step 1, so every link fell
 * through to localhost.
 */
export function getAppUrl(env: Env = process.env): string {
  const explicit = clean(env.NEXT_PUBLIC_SITE_URL) ?? clean(env.NEXT_PUBLIC_APP_URL);
  if (explicit) return explicit;

  const production = clean(env.VERCEL_PROJECT_PRODUCTION_URL);
  if (env.VERCEL_ENV === "production" && production) return `https://${production}`;

  const deployment = clean(env.VERCEL_URL);
  if (deployment) return `https://${deployment}`;

  return "http://localhost:3000";
}
