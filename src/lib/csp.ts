/**
 * v1.5.33 (roadmap v1.5.2.24-H): the strict Content-Security-Policy, built per
 * request by the proxy (src/proxy.ts) so each page view gets its own nonce.
 *
 * - Scripts: only those carrying this request's nonce, plus what they load
 *   ('strict-dynamic'). Next.js reads the nonce from the request's CSP header
 *   and puts it on its own scripts. No inline or eval'd script can run, which is
 *   the main defence against injected script stealing a signed-in session.
 * - Connections: SatSend itself, its Supabase project (REST and the realtime
 *   websocket) and mempool.space (REST and websocket). A host missing here
 *   silently stops live payment updates, so the list is pinned by tests.
 *   Price feeds are fetched by the server, not the browser.
 * - Styles keep 'unsafe-inline': components set style attributes, which a nonce
 *   can't cover, and injected CSS can't run code.
 *
 * Every page is server-rendered on each request already (next build shows them
 * all as dynamic), so nonces cost no speed. A static page would get no nonce
 * and its scripts would be blocked: check `next build` if a page goes static.
 */
const MEMPOOL_HOST = "mempool.space";

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function buildCsp({
  nonce,
  supabaseUrl,
  isDev,
}: {
  nonce: string;
  supabaseUrl: string;
  isDev: boolean;
}): string {
  const supabaseHost = new URL(supabaseUrl).host;
  const directives: string[] = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://${MEMPOOL_HOST} wss://${MEMPOOL_HOST}`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  // Local development runs over plain http.
  if (!isDev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
