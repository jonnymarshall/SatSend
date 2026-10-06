// Test harness for SatSend. Dev-only.
//
//   node test-automation/harness.mjs user
//   node test-automation/harness.mjs create 1        # create a published test invoice for $1
//   node test-automation/harness.mjs consolidate     # sweep wallet funds into one hot address
//   node test-automation/harness.mjs balance
//   node test-automation/harness.mjs send <address> <sats>
//
// Reads all config from the local environment file. Never prints secrets.

import { readFileSync, writeFileSync } from "node:fs";
import {
  APP_URL,
  HOT_INDEX,
  INVOICE_INDEX_START,
  RECEIVE,
  addressBalance,
  buildAndSend,
  collectSpendable,
  derive,
  ensureTestUser,
  fetchUtxos,
  loadEnv,
  sb,
  sleep,
  walletRoot,
} from "./lib.mjs";

const STATE_URL = new URL("./.state.json", import.meta.url);

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

const estimateVsize = (nIn, nOut) => 11 + nIn * 68 + nOut * 31;

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
    const id = await ensureTestUser(env);
    console.log(id);
    return;
  }

  if (cmd === "create") {
    const fiat = Number(args[0] ?? 1);
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
    const invoice = inserted[0];
    console.log(JSON.stringify({ id: invoice.id, address, fiat, path: `${RECEIVE}/${index}` }));
    return;
  }

  if (cmd === "balance") {
    const hot = await addressBalance(hotAddress);
    console.log(`hot ${hotAddress}: ${(hot?.confirmed ?? 0) + (hot?.pending ?? 0)} sats`);
    const utxos = await collectSpendable(root, 250);
    const total = utxos.reduce((sum, u) => sum + u.value, 0);
    console.log(`wallet total: ${total} sats across ${utxos.length} utxos`);
    return;
  }

  if (cmd === "consolidate") {
    const utxos = await collectSpendable(root, 250);
    if (!utxos.length) throw new Error("nothing to consolidate");
    const total = utxos.reduce((sum, u) => sum + u.value, 0);
    const fee = estimateVsize(utxos.length, 1) * 2;
    const result = await buildAndSend({
      root,
      inputs: utxos,
      toAddress: hotAddress,
      sats: total - fee,
      changeAddress: hotAddress,
      feeRate: 2,
    });
    console.log(`consolidated ${total} sats (${utxos.length} inputs) -> ${hotAddress}`);
    console.log(JSON.stringify(result));
    return;
  }

  if (cmd === "send") {
    const to = args[0];
    const sats = Number(args[1]);
    const feeRate = Number(args[2] ?? 2);
    if (!to || !Number.isFinite(sats)) {
      console.log("usage: send <address> <sats> [feeRate]");
      return;
    }
    let inputs = (await fetchUtxos(hotAddress))?.map((u) => ({
      path: RECEIVE,
      index: HOT_INDEX,
      txid: u.txid,
      vout: u.vout,
      value: u.value,
    })) ?? [];
    if (inputs.reduce((s, u) => s + u.value, 0) < sats + estimateVsize(inputs.length || 1, 2) * feeRate) {
      // Not enough in the hot address; fall back to a full scan.
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
    const result = await buildAndSend({
      root,
      inputs: selected,
      toAddress: to,
      sats,
      changeAddress: hotAddress,
      feeRate,
    });
    console.log(JSON.stringify(result));
    return;
  }

  if (cmd === "show") {
    const id = args[0];
    const rows = await sb(
      env,
      `invoices?id=eq.${id}&select=id,status,total_fiat,amount_received_sats,btc_price_at_detection,amount_received_fiat,overpaid,btc_txid,mempool_seen_at,next_check_at`
    );
    console.log(JSON.stringify(rows[0], null, 2));
    return;
  }

  if (cmd === "emails") {
    const id = args[0];
    const rows = await sb(env, `email_events?invoice_id=eq.${id}&select=email_type,status,recipient&order=created_at.asc`);
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (cmd === "detect") {
    const id = args[0];
    const txid = args[1];
    const status = args[2] ?? "payment_detected";
    const res = await fetch(`${APP_URL}/api/invoices/${id}/payment-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txid, status }),
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

  console.log("usage: harness.mjs user | create <fiat> | balance | consolidate | send <address> <sats> [feeRate] | show <id> | emails <id> | detect <id> <txid> [status] | sweep | hot");
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(1);
});
