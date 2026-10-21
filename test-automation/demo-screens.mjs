// Demo account for marketing screenshots (v1.5.18). Dev-only, TEST DATABASE ONLY.
//
//   node test-automation/demo-screens.mjs        create (once) and print a sign-in link
//
// Creates maya@example.com on SatSend-dev with four believable invoices (two
// paid, one sent and waiting, one draft) on fresh testnet addresses from the
// test wallet (index 7000+, well clear of the harness's ranges), then prints a
// one-time magic link that signs a browser in as that user. Nothing is emailed:
// rows are written directly and the link is generated, not sent.
//
// Refuses to run against any project but SatSend-dev.

import { derive, loadEnv, RECEIVE, sb, sbHeaders, walletRoot } from "./lib.mjs";

const TEST_PROJECT_REF = "hfqjxuosyxbkkvghanzw"; // SatSend-dev
const DEMO_EMAIL = "maya@example.com";
const ADDRESS_INDEX_START = 7000;

const env = loadEnv();
if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(TEST_PROJECT_REF)) {
  throw new Error("Refusing: .env.local does not point at SatSend-dev.");
}
const appUrl = process.env.SATSEND_APP_URL ?? "http://localhost:3000";

async function ensureDemoUser() {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers: sbHeaders(env) });
  const data = await res.json();
  const existing = (data.users ?? data).find((u) => u.email === DEMO_EMAIL);
  if (existing) return existing.id;
  const created = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: sbHeaders(env),
    body: JSON.stringify({ email: DEMO_EMAIL, email_confirm: true }),
  });
  const body = await created.json();
  if (!created.ok) throw new Error(`create user failed (${created.status}): ${JSON.stringify(body)}`);
  return body.id;
}

const ME = {
  your_name: "Maya Chen",
  your_company: "Maya Chen Design",
  your_email: DEMO_EMAIL,
  your_address: "14 Harbour Street, Bristol BS1 4QA",
};

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
const dateIn = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

function invoice(i, { number, client, company, email, items, status, publishedDaysAgo, dueIn, paid }) {
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
  return {
    ...ME,
    invoice_number: number,
    client_name: client,
    client_company: company,
    client_email: email,
    line_items: items,
    subtotal_fiat: subtotal,
    tax_percent: 0,
    tax_fiat: 0,
    total_fiat: subtotal,
    currency: "USD",
    status,
    due_date: dateIn(dueIn),
    created_at: daysAgo(publishedDaysAgo + 1),
    published_at: status === "draft" ? null : daysAgo(publishedDaysAgo),
    next_check_at: null, // never swept
    stage_attempt: 0,
    ...(paid ?? {}),
    _index: ADDRESS_INDEX_START + i,
  };
}

const SAMPLES = [
  {
    number: "INV-0041",
    client: "Leo Hart",
    company: "Bright Media",
    email: "leo@example.com",
    items: [{ description: "Brand refresh: logo, colours and type", quantity: 1, unit_price: 850 }],
    status: "paid",
    publishedDaysAgo: 18,
    dueIn: -4,
    paid: { amount_received_sats: 1160000, amount_received_fiat: 850, btc_price_at_detection: 73275.86, mempool_seen_at: daysAgo(15) },
  },
  {
    number: "INV-0042",
    client: "Sam Okafor",
    company: "Northwind Studio",
    email: "sam@example.com",
    items: [
      { description: "Website redesign: design and build", quantity: 1, unit_price: 2200 },
      { description: "Content migration", quantity: 4, unit_price: 75 },
    ],
    status: "paid",
    publishedDaysAgo: 9,
    dueIn: 5,
    paid: { amount_received_sats: 3412000, amount_received_fiat: 2500, btc_price_at_detection: 73270.81, mempool_seen_at: daysAgo(2) },
  },
  {
    number: "INV-0043",
    client: "Priya Shah",
    company: "Acme Studio",
    email: "priya@example.com",
    items: [
      { description: "Monthly design retainer: October", quantity: 1, unit_price: 1200 },
      { description: "Extra illustration (hours)", quantity: 3, unit_price: 60 },
    ],
    status: "pending",
    publishedDaysAgo: 1,
    dueIn: 13,
  },
  {
    number: "INV-0044",
    client: "Jonas Berg",
    company: "Fjord Coffee",
    email: "jonas@example.com",
    items: [{ description: "Packaging design: 3 bag labels", quantity: 3, unit_price: 320 }],
    status: "draft",
    publishedDaysAgo: 0,
    dueIn: 21,
  },
].map((s, i) => invoice(i, s));

async function main() {
  const userId = await ensureDemoUser();
  const existing = await sb(env, `invoices?user_id=eq.${userId}&select=id,invoice_number,status`);
  if (existing.length === 0) {
    const root = walletRoot(env);
    for (const { _index, ...row } of SAMPLES) {
      const btc_address = derive(root, RECEIVE, _index).address;
      const paidTxid = row.status === "paid" ? { btc_txid: Buffer.from(row.invoice_number.padEnd(32, "0")).toString("hex").slice(0, 64) } : {};
      await sb(env, "invoices", { method: "POST", body: { ...row, user_id: userId, btc_address, ...paidTxid } });
    }
  }
  const rows = await sb(env, `invoices?user_id=eq.${userId}&select=id,invoice_number,status&order=invoice_number`);
  console.log(JSON.stringify(rows));

  const link = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: sbHeaders(env),
    body: JSON.stringify({ type: "magiclink", email: DEMO_EMAIL, redirect_to: `${appUrl}/auth/callback?next=/invoices` }),
  });
  const body = await link.json();
  if (!link.ok) throw new Error(`generate_link failed (${link.status}): ${JSON.stringify(body)}`);
  console.log(body.action_link ?? body.properties?.action_link);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
