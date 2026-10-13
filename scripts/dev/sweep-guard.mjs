// Which databases `npm run dev:sweep` may run the payment sweep against
// (v1.5.8, roadmap v1.5.0.5-H). AGENTS.md: a local session may enable the sweep
// only against the local/test database, never one shared with production.
// Allowlist, not blocklist: an unknown project is refused.

/** Supabase project refs that are test databases. */
export const TEST_PROJECT_REFS = ["hfqjxuosyxbkkvghanzw"]; // SatSend-dev

/** @param {string | undefined} supabaseUrl */
export function isTestDatabaseUrl(supabaseUrl) {
  if (!supabaseUrl) return false;
  let host;
  try {
    host = new URL(supabaseUrl).hostname;
  } catch {
    return false;
  }
  if (host === "localhost" || host === "127.0.0.1") return true; // supabase start
  return TEST_PROJECT_REFS.some((ref) => host === `${ref}.supabase.co`);
}
