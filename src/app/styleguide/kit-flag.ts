/**
 * The internal UI kit (/styleguide) is TEMPORARY (v1.5.0-H) and deleted at the end
 * of v1.5-H. It renders only when SHOW_UI_KIT=1 is set in that environment; every
 * other environment (including production by default) gets a 404.
 */
export function isUiKitEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.SHOW_UI_KIT === "1";
}
