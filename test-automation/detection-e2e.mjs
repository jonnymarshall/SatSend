// Testnet4 detection end-to-end. Dev-only, exploratory.
//
// Proves the real detection path against a real testnet4 payment: the sweep
// route + its CRON_SECRET auth, the due queue, the amount check, the
// pending -> payment_detected write, and the payment_detected email row.
//
// HARD GATE: pending -> payment_detected.
// BEST EFFORT (separate, marked): payment_detected -> paid at 2 confirmations,
// which depends on testnet4 miners and is not allowed to fail the session.
//
// Usage:
//   node test-automation/detection-e2e.mjs                 # hard gate
//   node test-automation/detection-e2e.mjs wait <id> <txid> <maxMin>   # best-effort paid
//
// Reads config from the local environment file. Never prints secrets.

import {
  APP_URL,
  HOT_INDEX,
  RECEIVE,
  addressBalance,
  buildAndSend,
  derive,
  ensureTestUser,
  fetchJson,
  fetchUtxos,
  loadEnv,
  sb,
  sleep,
  walletRoot,
} from "./lib.mjs";

const INVOICE_INDEX_BASE = 2000;

function log(msg) {
  console.log(msg);
}

async function getPrice() {
  const res = await fetch(`${APP_URL}/api/btc-price?currency=USD`);
  if (!res.ok) throw new Error(`btc-price returned ${res.status}`);
  const { price } = await res.json();
  if (!Number.isFinite(price)) throw new Error("btc-price did not return a number");
  return price;
}

async function sweep(env) {
  const res = await fetch(`${APP_URL}/api/cron/payment-sweep`, {
    headers: env.CRON_SECRET ? { Authorization: `Bearer ${env.CRON_SECRET}` } : {},
  });
  const text = await res.text();
  return { httpStatus: res.status, body: text };
}

async function invoice(env, id) {
  const rows = await sb(
    env,
    `invoices?id=eq.${id}&select=id,status,btc_txid,mempool_seen_at,published_at,stage_attempt,next_check_at,total_fiat,amount_received_sats,amount_received_fiat,overpaid`
  );
  return rows[0];
}

async function emails(env, id) {
  return sb(
    env,
    `email_events?invoice_id=eq.${id}&select=email_type,status,recipient&order=created_at.asc`
  );
}

async function createInvoice(env, root, fiat) {
  const userId = await ensureTestUser(env);
  const index = INVOICE_INDEX_BASE + (Date.now() % 6000);
  const { address } = derive(root, RECEIVE, index);
  const nowIso = new Date().toISOString();
  const row = {
    user_id: userId,
    invoice_number: `E2E-${index}`,
    your_email: "",
    client_name: "E2E client",
    client_email: "",
    line_items: [{ description: "E2E item", quantity: 1, unit_price: fiat }],
    subtotal_fiat: fiat,
    tax_fiat: 0,
    tax_percent: 0,
    total_fiat: fiat,
    currency: "USD",
    status: "pending",
    btc_address: address,
    access_code: null,
    stage_attempt: 0,
    mempool_seen_at: null,
    published_at: nowIso,
    next_check_at: nowIso,
  };
  const inserted = await sb(env, "invoices", {
    method: "POST",
    body: row,
    prefer: "return=representation",
  });
  return { invoice: inserted[0], address, index };
}

async function pay(root, hotAddress, toAddress, sats, feeRate = 2) {
  const utxos = (await fetchUtxos(hotAddress)) ?? [];
  const inputs = utxos
    .map((u) => ({ path: RECEIVE, index: HOT_INDEX, txid: u.txid, vout: u.vout, value: u.value }))
    .sort((a, b) => b.value - a.value);
  if (!inputs.length) throw new Error("hot wallet has no UTXOs on testnet4");
  return buildAndSend({ root, inputs, toAddress, sats, changeAddress: hotAddress, feeRate });
}

function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  log(`${ok ? "PASS" : "FAIL"}  ${name}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
  return ok;
}

async function runHardGate(env) {
  const root = walletRoot(env);
  const hotAddress = derive(root, RECEIVE, HOT_INDEX).address;

  log(`hot wallet: ${hotAddress} (${JSON.stringify(await addressBalance(hotAddress))})`);

  const fiat = 1;
  const { invoice: inv, address, index } = await createInvoice(env, root, fiat);
  log(`invoice ${inv.id}  $${fiat}  -> ${address} (idx ${index})`);

  const price = await getPrice();
  const sats = Math.round((fiat / price) * 1e8);
  log(`price $${price}  paying ${sats} sats`);

  const payment = await pay(root, hotAddress, address, sats);
  log(`paid: tx ${payment.txid}  fee ${payment.fee}  vsize ${payment.vsize}`);
  log("waiting for the sweep to detect it (hard gate: payment_detected)...");

  const deadline = Date.now() + 4 * 60_000;
  let final = null;
  while (Date.now() < deadline) {
    const s = await sweep(env);
    log(`  sweep HTTP ${s.httpStatus}: ${s.body}`);
    final = await invoice(env, inv.id);
    if (final.status !== "pending") break;
    await sleep(15_000);
  }

  const mail = await emails(env, inv.id);
  const detectedMail = mail.some((e) => e.email_type === "payment_detected");
  const nextCheckMs = final?.next_check_at ? new Date(final.next_check_at).getTime() : null;
  const seenMs = final?.mempool_seen_at ? new Date(final.mempool_seen_at).getTime() : null;

  log("\n--- HARD GATE: pending -> payment_detected ---");
  const results = [
    check("status", final?.status, "payment_detected"),
    check("btc_txid", final?.btc_txid, payment.txid),
    check("mempool_seen_at set", Boolean(final?.mempool_seen_at), true),
    check("stage_attempt (first sighting)", final?.stage_attempt, 0),
    check(
      "next_check_at ~= mempool_seen_at + 10min",
      nextCheckMs != null && seenMs != null ? Math.round((nextCheckMs - seenMs) / 60_000) : null,
      10
    ),
    check("payment_detected email row", detectedMail, true),
  ];
  const failed = results.filter((r) => !r).length;
  log(`\nHARD GATE: ${failed === 0 ? "PASS" : `FAIL (${failed})`}`);
  log(`invoice_id=${inv.id}`);
  log(`txid=${payment.txid}`);
  log(`emails=${JSON.stringify(mail)}`);
  if (failed) process.exitCode = 1;
}

async function runWaitPaid(env, id, txid, maxMin) {
  log(`best-effort: waiting up to ${maxMin} min for ${txid} to reach 2 confirmations (invoice ${id})`);
  const deadline = Date.now() + maxMin * 60_000;
  let final = null;
  let lastConfs = null;
  while (Date.now() < deadline) {
    const status = await fetchJson(`https://mempool.space/testnet4/api/tx/${txid}/status`);
    if (status?.confirmed) {
      const tip = Number(await (await fetch("https://mempool.space/testnet4/api/blocks/tip/height")).text());
      if (Number.isFinite(tip)) lastConfs = tip - status.block_height + 1;
    } else {
      lastConfs = 0;
    }
    log(`  confirmations: ${lastConfs ?? "?"}`);
    if (lastConfs !== null && lastConfs >= 2) {
      const s = await sweep(env);
      log(`  sweep HTTP ${s.httpStatus}: ${s.body}`);
      final = await invoice(env, id);
      if (final.status === "paid" || final.status === "underpaid") break;
    }
    await sleep(60_000);
  }

  final = await invoice(env, id);
  const mail = await emails(env, id);
  const confirmedMail = mail.some((e) => e.email_type === "payment_confirmed");
  log("\n--- BEST EFFORT: payment_detected -> paid ---");
  const results = [
    check("status", final?.status, "paid"),
    check("amount_received_sats set", final?.amount_received_sats != null, true),
    check("payment_confirmed email row", confirmedMail, true),
  ];
  const failed = results.filter((r) => !r).length;
  if (failed) {
    log("BEST EFFORT: not confirmed in-session (record as an outstanding verification, not a failure)");
  } else {
    log("BEST EFFORT: PASS");
  }
  log(`emails=${JSON.stringify(mail)}`);
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const env = loadEnv();
  if (cmd === "wait") {
    const [id, txid, maxMin] = args;
    if (!id || !txid) throw new Error("usage: detection-e2e.mjs wait <id> <txid> <maxMin>");
    await runWaitPaid(env, id, txid, Number(maxMin ?? 40));
    return;
  }
  await runHardGate(env);
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(1);
});
