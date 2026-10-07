// v1.4.31.2-H — integration harness, second suite: the database's money and
// status invariants (migration 0027) against REAL Postgres.
//
// These rules exist only in the database (CHECK constraints and triggers), so
// the mocked suites are structurally blind to whether they actually fire — the
// same class of blind spot that hid the anon-execute hole in v1.4.31.1-H.
//
// Local-only; runs against the TEST Supabase project.
// Run: node test-automation/db-invariants.mjs   (or: npm run test:db)
// Skips (exit 0) when the anon key is absent.

import { loadEnv } from "./lib.mjs";

const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!URL || !SERVICE) {
  console.log("skip: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(0);
}
if (!ANON) {
  console.log("skip: no anon/publishable key set (NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  process.exit(0);
}
if (/hvkcdezablbqgahvumao/.test(URL)) throw new Error("refusing to run against PRODUCTION");
if (env.PAYMENT_SWEEP_ENABLED) throw new Error("refusing to run: PAYMENT_SWEEP_ENABLED is set");

// --- helpers (mirrors rls-integration.mjs) --------------------------------

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
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: res.status, ok: res.ok, json, text };
}

const rnd = () => Math.random().toString(16).slice(2).padEnd(16, "0");
let seq = 0;
const validInvoice = (userId) => ({
  user_id: userId,
  status: "pending",
  btc_address: `tb1q${rnd()}${rnd()}`,
  invoice_number: `INTTEST-DB-${Date.now()}-${seq++}`,
  client_name: "Integration Test",
  client_email: "db-int@example.com",
  currency: "USD",
  subtotal_fiat: 100,
  tax_fiat: 20,
  tax_percent: 20,
  total_fiat: 120,
  line_items: [{ quantity: 1, unit_price: 100 }],
});

async function makeUser(tag) {
  const email = `db-int-${tag}-${Date.now()}@satsend.dev`;
  const password = `pw-${rnd()}${rnd()}`;
  const created = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const user = await created.json();
  if (!created.ok) throw new Error(`create user failed (${created.status})`);
  const tokenRes = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`sign in failed (${tokenRes.status})`);
  return { id: user.id, jwt: token.access_token };
}

async function insert(jwt, body) {
  return rest("invoices", { method: "POST", jwt, key: ANON, prefer: "return=representation", body });
}

// --- suite ----------------------------------------------------------------

let failures = 0;
const check = (name, pass, detail = "") => {
  console.log(`${pass ? "  ok  " : " FAIL "} ${name}${detail && !pass ? ` — ${detail}` : ""}`);
  if (!pass) failures++;
};

const created = [];
const cleanup = async () => {
  for (const id of created) {
    await rest(`invoices?id=eq.${id}`, { method: "PATCH", body: { status: "draft" }, prefer: "return=minimal" });
    await rest(`invoices?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  }
};

const isCheckViolation = (r) => !r.ok && r.status === 400 && r.json?.code === "23514";

let user;
try {
  console.log(`\nDB money/status invariants vs real Postgres — ${URL}\n`);
  user = await makeUser("main");

  const reject = async (name, overrides) => {
    const res = await insert(user.jwt, { ...validInvoice(user.id), ...overrides });
    check(name, isCheckViolation(res), `status ${res.status} ${res.json?.code ?? ""} ${res.text?.slice(0, 80)}`);
  };

  // Impossible money is refused by the CHECK constraints (0027).
  await reject("total not equal to subtotal + tax is rejected", { total_fiat: 999 });
  await reject("negative money is rejected", { subtotal_fiat: -5, tax_fiat: 0, total_fiat: -5 });
  await reject("non-USD currency is rejected", { currency: "EUR" });
  await reject("tax percent over 100 is rejected", { tax_percent: 150 });
  await reject("malformed line_items are rejected", { line_items: "not-an-array" });
  await reject("line_items element missing unit_price is rejected", {
    line_items: [{ quantity: 1 }],
  });

  // A valid one inserts (the controls above mean something).
  const good = await insert(user.jwt, validInvoice(user.id));
  check("a valid invoice inserts", good.ok && !!good.json?.[0]?.id, `status ${good.status}`);
  const goodId = good.json?.[0]?.id;
  if (goodId) created.push(goodId);

  // Non-draft invoices may not be deleted (financial audit trail).
  const delNonDraft = await rest(`invoices?id=eq.${goodId}`, { method: "DELETE", prefer: "return=minimal" });
  check("deleting a non-draft invoice is blocked", !delNonDraft.ok, `status ${delNonDraft.status}`);

  // A paid invoice's money is frozen, but its status is still writable.
  const paid = await insert(user.jwt, { ...validInvoice(user.id), status: "paid" });
  const paidId = paid.json?.[0]?.id;
  if (paidId) created.push(paidId);
  check("a paid invoice inserts", paid.ok && !!paidId, `status ${paid.status}`);

  const editMoney = await rest(`invoices?id=eq.${paidId}`, {
    method: "PATCH", body: { subtotal_fiat: 200 }, prefer: "return=minimal",
  });
  check("editing money on a paid invoice is blocked", isCheckViolation(editMoney),
    `status ${editMoney.status} ${editMoney.json?.code ?? ""}`);

  const editStatus = await rest(`invoices?id=eq.${paidId}`, {
    method: "PATCH", body: { status: "payment_detected" }, prefer: "return=minimal",
  });
  check("editing status on a paid invoice is allowed", editStatus.ok, `status ${editStatus.status}`);

  // A draft may be deleted (the one allowed case).
  const draft = await insert(user.jwt, { ...validInvoice(user.id), status: "draft" });
  const draftId = draft.json?.[0]?.id;
  check("a draft inserts", draft.ok && !!draftId, `status ${draft.status}`);
  const delDraft = await rest(`invoices?id=eq.${draftId}`, { method: "DELETE", prefer: "return=minimal" });
  check("deleting a draft is allowed", delDraft.ok, `status ${delDraft.status}`);
} finally {
  await cleanup();
  if (user) {
    await fetch(`${URL}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    }).catch(() => {});
  }
}

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
