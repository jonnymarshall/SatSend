// v1.4.31.1-H — integration harness, first suite: prove the address-uniqueness
// RPC against REAL RLS. Local-only; runs against the TEST Supabase project.
//
// Mocks cannot verify this: whether anon is actually denied EXECUTE, whether the
// function truly returns a bare boolean, and whether the cross-tenant backstop
// fires are all Postgres/PostgREST behaviours. So this hits the real database.
//
// Invariants enforced here:
//   - TEST project only (aborts if the URL looks like production).
//   - PAYMENT_SWEEP_ENABLED must not be set (one writer per database).
//
// v1.5.26 adds the access-code guess limit (migration 0036).
//
// Run: node test-automation/rls-integration.mjs   (or: npm run test:rls)
// Skips (exit 0) when the anon key is absent, so it never blocks a plain checkout.

import { loadEnv } from "./lib.mjs";

const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// --- guards ---------------------------------------------------------------

if (!URL || !SERVICE) {
  console.log("skip: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(0);
}
if (!ANON) {
  console.log("skip: no anon/publishable key set (NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  process.exit(0);
}
if (/hvkcdezablbqgahvumao/.test(URL)) {
  throw new Error("refusing to run: this URL is the PRODUCTION project");
}
if (env.PAYMENT_SWEEP_ENABLED) {
  throw new Error("refusing to run: PAYMENT_SWEEP_ENABLED is set (one writer per database)");
}

// --- tiny REST helpers ----------------------------------------------------

async function rest(path, { method = "GET", body, jwt, key = SERVICE, prefer } = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${jwt ?? key}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON error body */ }
  return { status: res.status, ok: res.ok, json, text };
}

const rpc = (addr, jwt, key) =>
  rest("rpc/is_address_registered", { method: "POST", body: { addr }, jwt, key });

const rnd = () => Math.random().toString(16).slice(2).padEnd(16, "0");
const testAddr = () => `tb1q${rnd()}${rnd()}`;

async function makeUser(tag) {
  const email = `rls-int-${tag}-${Date.now()}@satsend.dev`;
  const password = `pw-${rnd()}${rnd()}`;
  const created = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const user = await created.json();
  if (!created.ok) throw new Error(`create user ${tag} failed (${created.status})`);
  const tokenRes = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`sign in ${tag} failed (${tokenRes.status})`);
  return { id: user.id, email, jwt: token.access_token };
}

async function deleteUser(id) {
  await fetch(`${URL}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  }).catch(() => {});
}

// --- the suite ------------------------------------------------------------

let failures = 0;
const check = (name, pass, detail = "") => {
  console.log(`${pass ? "  ok  " : " FAIL "} ${name}${detail && !pass ? ` — ${detail}` : ""}`);
  if (!pass) failures++;
};

const created = [];
async function cleanup() {
  for (const { id, userId } of created) {
    // Non-draft invoices are not deletable by design; flip to draft first, then delete.
    await rest(`invoices?id=eq.${id}`, { method: "PATCH", body: { status: "draft" }, prefer: "return=minimal" });
    await rest(`invoices?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  }
}

let userA, userB;
try {
  console.log(`\nAddress-uniqueness RPC vs real RLS — ${URL}\n`);

  // 1. anon is denied EXECUTE (revoked from public, granted to authenticated).
  const anonCall = await rpc(testAddr(), null, ANON);
  check("anon cannot execute is_address_registered", !anonCall.ok,
    `status ${anonCall.status}`);

  userA = await makeUser("a");
  userB = await makeUser("b");

  // 2. authenticated caller gets a bare boolean (false for an unused address).
  const fresh = testAddr();
  const asA = await rpc(fresh, userA.jwt, ANON);
  check("authenticated caller receives a JSON boolean", asA.ok && typeof asA.json === "boolean",
    `status ${asA.status}, body ${JSON.stringify(asA.json)}`);
  check("an unused address reads false", asA.json === false);

  // 3. cross-tenant backstop: A registers an address on a non-draft invoice;
  //    B (a different tenant, whom RLS prevents from seeing it) still gets true.
  const shared = testAddr();
  const insert = await rest("invoices", {
    method: "POST",
    jwt: userA.jwt,
    key: ANON,
    prefer: "return=representation",
    body: {
      user_id: userA.id,
      status: "pending",
      btc_address: shared,
      invoice_number: `INTTEST-${Date.now()}`,
      client_name: "Integration Test",
      client_email: "rls-int@example.com",
      currency: "USD",
      subtotal_fiat: 0,
      tax_fiat: 0,
      tax_percent: 0,
      total_fiat: 0,
      line_items: [],
    },
  });
  check("user A can insert a non-draft invoice with the address", insert.ok,
    `status ${insert.status} ${insert.text?.slice(0, 120)}`);
  const invoiceId = insert.json?.[0]?.id;
  if (invoiceId) created.push({ id: invoiceId, userId: userA.id });

  const asB = await rpc(shared, userB.jwt, ANON);
  check("backstop fires cross-tenant (B sees A's address as registered)", asB.json === true,
    `body ${JSON.stringify(asB.json)}`);

  // 4. RLS: B cannot read A's invoice at all.
  const bReadsA = await rest(`invoices?id=eq.${invoiceId}&select=id`, { jwt: userB.jwt, key: ANON });
  check("RLS hides A's invoice from B", Array.isArray(bReadsA.json) && bReadsA.json.length === 0,
    `body ${JSON.stringify(bReadsA.json)}`);

  // 5. Access-code guess limit (v1.5.26, migration 0036): server-only, and
  //    5 wrong guesses per window per (invoice, connection).
  const guess = (args, key = SERVICE) =>
    rest("rpc/take_access_code_guess", {
      method: "POST",
      key,
      body: { p_limit: 5, p_window_seconds: 900, p_wrong: true, ...args },
    });
  const conn = `int-${rnd()}`;
  const anonGuess = await guess({ p_invoice_id: invoiceId, p_client_key: conn }, ANON);
  check("anon cannot execute take_access_code_guess", !anonGuess.ok, `status ${anonGuess.status}`);
  const userGuess = await rest("rpc/take_access_code_guess", {
    method: "POST", jwt: userA.jwt, key: ANON,
    body: { p_invoice_id: invoiceId, p_client_key: conn, p_wrong: true, p_limit: 5, p_window_seconds: 900 },
  });
  check("a signed-in user cannot execute take_access_code_guess", !userGuess.ok, `status ${userGuess.status}`);
  const anonRead = await rest("access_code_attempts?select=id", { key: ANON });
  check("anon cannot read access_code_attempts", !anonRead.ok || (Array.isArray(anonRead.json) && anonRead.json.length === 0),
    `status ${anonRead.status}`);

  const answers = [];
  for (let i = 0; i < 5; i++) answers.push((await guess({ p_invoice_id: invoiceId, p_client_key: conn })).json);
  check("5 wrong guesses are allowed", answers.every((a) => a === true), JSON.stringify(answers));
  const sixth = await guess({ p_invoice_id: invoiceId, p_client_key: conn });
  check("the 6th guess is refused", sixth.json === false, JSON.stringify(sixth.json));
  const rightAfter = await guess({ p_invoice_id: invoiceId, p_client_key: conn, p_wrong: false });
  check("even a right guess is refused once the limit is reached", rightAfter.json === false,
    JSON.stringify(rightAfter.json));
  const otherConn = await guess({ p_invoice_id: invoiceId, p_client_key: `int-${rnd()}` });
  check("another connection is unaffected", otherConn.json === true, JSON.stringify(otherConn.json));

  const second = await rest("invoices", {
    method: "POST", prefer: "return=representation",
    body: {
      user_id: userA.id, status: "draft", invoice_number: `INTTEST2-${Date.now()}`,
      client_name: "Integration Test", client_email: "rls-int@example.com", currency: "USD",
      subtotal_fiat: 0, tax_fiat: 0, tax_percent: 0, total_fiat: 0, line_items: [],
    },
  });
  const secondId = second.json?.[0]?.id;
  if (secondId) created.push({ id: secondId, userId: userA.id });
  const otherInvoice = await guess({ p_invoice_id: secondId, p_client_key: conn });
  check("another invoice is unaffected for the same connection", otherInvoice.json === true,
    `status ${second.status} ${second.text?.slice(0, 200)}`);
  const shortWindow = await guess({ p_invoice_id: invoiceId, p_client_key: conn, p_window_seconds: 0, p_wrong: false });
  check("old guesses age out of the window", shortWindow.json === true, JSON.stringify(shortWindow.json));
} finally {
  await cleanup();
  if (userA) await deleteUser(userA.id);
  if (userB) await deleteUser(userB.id);
}

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
