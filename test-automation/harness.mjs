// Test harness for SatSend. Dev-only.
//
//   node test-automation/harness.mjs user
//   node test-automation/harness.mjs create 1
//   node test-automation/harness.mjs consolidate
//   node test-automation/harness.mjs balance
//   node test-automation/harness.mjs send <address> <sats>
//   node test-automation/harness.mjs show <invoiceId>
//   node test-automation/harness.mjs emails <invoiceId>
//   node test-automation/harness.mjs confs <txid>
//   node test-automation/harness.mjs detect <invoiceId> <txid> [status]
//   node test-automation/harness.mjs sweep
//   node test-automation/harness.mjs run <fiat> <exact|under|over> [maxWaitMinutes]
//
// Reads all config from the local environment file. Never prints secrets.

import { readFileSync, writeFileSync } from "node:fs";
import {
  APP_URL,
  HOT_INDEX,
  INVOICE_INDEX_START,
  MEMPOOL,
  RECEIVE,
  addressBalance,
  buildAndSend,
  collectSpendable,
  derive,
  ensureTestUser,
  fetchJson,
  fetchUtxos,
  loadEnv,
  sb,
  sleep,
  walletRoot,
} from "./lib.mjs";

const STATE_URL = new URL("./.state.json", import.meta.url);
const estimateVsize = (nIn, nOut) => 11 + nIn * 68 + nOut * 31;

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_URL, "utf8"));
  } catch {
    return { invoiceCounter: 0 };
  }
}

function writeState(state) {
  writeFileSync(STATE_URL, JSON.stringify(state, null, 2));
}

async function getPrice() {
  const res = await fetch(`${APP_URL}/api/btc-price?currency=USD`);
  if (!res.ok) throw new Error(`btc-price returned ${res.status}`);
  const { price } = await res.json();
  if (!Number.isFinite(price)) throw new Error("btc-price did not return a number");
  return price;
}

async function confirmations(txid) {
  const status = await fetchJson(`${MEMPOOL}/api/tx/${txid}/status`);
  if (!status) return null;
  if (!status.confirmed) return 0;
  const tipText = await (await fetch(`${MEMPOOL}/api/blocks/tip/height`)).text();
  const tip = Number(tipText);
  if (!Number.isFinite(tip)) return null;
  return tip - status.block_height + 1;
}

async function waitForConfirmations(txid, min, maxMinutes) {
  const deadline = Date.now() + maxMinutes * 60_000;
  for (;;) {
    const c = await confirmations(txid);
    console.log(`  confirmations: ${c ?? "?"}`);
    if (c !== null && c >= min) return c;
    if (Date.now() > deadline) throw new Error(`timed out after ${maxMinutes} min waiting for ${min} confirmations`);
    await sleep(60_000);
  }
}

async function createInvoice(env, root, fiat) {
  const userId = await ensureTestUser(env);
  const state = readState();
  const index = INVOICE_INDEX_START + state.invoiceCounter;
  state.invoiceCounter += 1;
  writeState(state);
  const { address } = derive(root, RECEIVE, index);
  const row = {
    user_id: userId,
    invoice_number: `TEST-${state.invoiceCounter}`,
    your_email: "",
    client_name: "Test client",
    client_email: "",
    line_items: [{ description: "Test item", quantity: 1, unit_price: fiat }],
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
    next_check_at: new Date().toISOString(),
  };
  const inserted = await sb(env, "invoices", { method: "POST", body: row, prefer: "return=representation" });
  return { invoice: inserted[0], address, path: `${RECEIVE}/${index}` };
}

async function payAddress(root, hotAddress, toAddress, sats, feeRate = 2) {
  let inputs = (await fetchUtxos(hotAddress))?.map((u) => ({
    path: RECEIVE,
    index: HOT_INDEX,
    txid: u.txid,
    vout: u.vout,
    value: u.value,
  })) ?? [];
  if (inputs.reduce((s, u) => s + u.value, 0) < sats + estimateVsize(inputs.length || 1, 2) * feeRate) {
    inputs = await collectSpendable(root, 250);
  }
  inputs.sort((a, b) => b.value - a.value);
  const selected = [];
  let total = 0;
  for (const u of inputs) {
    selected.push(u);
    total += u.value;
    if (total >= sats + estimateVsize(selected.length, 2) * feeRate) break;
  }
  return buildAndSend({ root, inputs: selected, toAddress, sats, changeAddress: hotAddress, feeRate });
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const env = loadEnv();
  const root = walletRoot(env);
  const hotAddress = derive(root, RECEIVE, HOT_INDEX).address;

  if (cmd === "hot") {
    console.log(hotAddress);
    return;
  }

  if (cmd === "user") {
    console.log(await ensureTestUser(env));
    return;
  }

  if (cmd === "create") {
    const { invoice, address, path } = await createInvoice(env, root, Number(args[0] ?? 1));
    console.log(JSON.stringify({ id: invoice.id, address, path, fiat: invoice.total_fiat }));
    return;
  }

  if (cmd === "balance") {
    const hot = await addressBalance(hotAddress);
    console.log(`hot ${hotAddress}: ${(hot?.confirmed ?? 0) + (hot?.pending ?? 0)} sats`);
    const utxos = await collectSpendable(root, 250);
    console.log(`wallet total: ${utxos.reduce((s, u) => s + u.value, 0)} sats across ${utxos.length} utxos`);
    return;
  }

  if (cmd === "consolidate") {
    const utxos = await collectSpendable(root, 250);
    if (!utxos.length) throw new Error("nothing to consolidate");
    const total = utxos.reduce((s, u) => s + u.value, 0);
    const fee = estimateVsize(utxos.length, 1) * 2;
    const result = await buildAndSend({ root, inputs: utxos, toAddress: hotAddress, sats: total - fee, changeAddress: hotAddress });
    console.log(`consolidated ${total} sats (${utxos.length} inputs) -> ${hotAddress}`);
    console.log(JSON.stringify(result));
    return;
  }

  if (cmd === "send") {
    const [to, satsRaw, feeRateRaw] = args;
    const sats = Number(satsRaw);
    if (!to || !Number.isFinite(sats)) {
      console.log("usage: send <address> <sats> [feeRate]");
      return;
    }
    console.log(JSON.stringify(await payAddress(root, hotAddress, to, sats, Number(feeRateRaw ?? 2))));
    return;
  }

  if (cmd === "show") {
    const rows = await sb(env, `invoices?id=eq.${args[0]}&select=id,status,total_fiat,amount_received_sats,btc_price_at_detection,amount_received_fiat,overpaid,btc_txid,mempool_seen_at`);
    console.log(JSON.stringify(rows[0], null, 2));
    return;
  }

  if (cmd === "emails") {
    const rows = await sb(env, `email_events?invoice_id=eq.${args[0]}&select=email_type,status,recipient&order=created_at.asc`);
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (cmd === "confs") {
    console.log(await confirmations(args[0]));
    return;
  }

  if (cmd === "detect") {
    const [id, txid, status] = args;
    const res = await fetch(`${APP_URL}/api/invoices/${id}/payment-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txid, status: status ?? "payment_detected" }),
    });
    console.log(`HTTP ${res.status}: ${await res.text()}`);
    return;
  }

  if (cmd === "sweep") {
    const res = await fetch(`${APP_URL}/api/cron/payment-sweep`, {
      headers: env.CRON_SECRET ? { Authorization: `Bearer ${env.CRON_SECRET}` } : {},
    });
    console.log(`HTTP ${res.status}: ${await res.text()}`);
    return;
  }

  if (cmd === "run") {
    const fiat = Number(args[0] ?? 1);
    const mode = args[1] ?? "exact";
    const maxWait = Number(args[2] ?? 60);

    const { invoice, address } = await createInvoice(env, root, fiat);
    console.log(`invoice ${invoice.id}  $${fiat}  ${mode}  -> ${address}`);

    const price = await getPrice();
    const base = Math.round((fiat / price) * 1e8);
    const factor = mode === "under" ? 0.8 : mode === "over" ? 1.2 : 1;
    const sats = Math.round(base * factor);
    console.log(`price $${price}  paying ${sats} sats`);

    const payment = await payAddress(root, hotAddress, address, sats);
    console.log(`paid: tx ${payment.txid}  fee ${payment.fee}`);

    console.log(`waiting for 2 confirmations (max ${maxWait} min)...`);
    await waitForConfirmations(payment.txid, 2, maxWait);

    await fetch(`${APP_URL}/api/invoices/${invoice.id}/payment-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txid: payment.txid, status: "paid" }),
    });

    let final = null;
    for (let i = 0; i < 12; i++) {
      const rows = await sb(env, `invoices?id=eq.${invoice.id}&select=status,total_fiat,amount_received_sats,btc_price_at_detection,amount_received_fiat,overpaid`);
      final = rows[0];
      if (final.status === "paid" || final.status === "underpaid") break;
      await sleep(5000);
    }

    const expectedStatus = mode === "under" ? "underpaid" : "paid";
    const expectedOverpaid = mode === "over";
    const emails = await sb(env, `email_events?invoice_id=eq.${invoice.id}&select=email_type,status&order=created_at.asc`);
    const confirmedEmail = emails.some((e) => e.email_type === "payment_confirmed");

    const checks = [
      ["status", final.status, expectedStatus],
      ["overpaid", final.overpaid, expectedOverpaid],
      ["amount_received_sats", final.amount_received_sats != null, true],
      ["btc_price_at_detection", final.btc_price_at_detection != null, true],
      ["payment_confirmed email", confirmedEmail, true],
    ];
    const failed = checks.filter(([, got, want]) => got !== want);

    console.log("\n--- RESULT ---");
    for (const [name, got, want] of checks) {
      console.log(`${got === want ? "PASS" : "FAIL"}  ${name}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
    }
    console.log(`received: ${final.amount_received_fiat} fiat (${final.amount_received_sats} sats @ ${final.btc_price_at_detection})`);
    console.log(failed.length === 0 ? "RESULT: PASS" : `RESULT: FAIL (${failed.length})`);
    if (failed.length) process.exitCode = 1;
    return;
  }

  console.log("usage: harness.mjs user | create <fiat> | balance | consolidate | send <address> <sats> [feeRate] | show <id> | emails <id> | confs <txid> | detect <id> <txid> [status] | sweep | run <fiat> <exact|under|over> [maxWaitMin] | hot");
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(1);
});
