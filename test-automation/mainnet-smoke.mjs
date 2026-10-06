// Mainnet smoke test (S2.3). Dev-only. Run with SATSEND_NETWORK=mainnet.
//
// Creates a real mainnet invoice with a fresh, wallet-visible address, pays it a
// small amount from the mainnet wallet, waits for two confirmations, then drives
// the app's payment route and reports pass/fail.

import {
  APP_URL,
  CHANGE,
  MEMPOOL,
  NET_NAME,
  RECEIVE,
  buildAndSend,
  collectSpendable,
  derive,
  ensureTestUser,
  fetchJson,
  loadEnv,
  sb,
  sleep,
  walletRoot,
} from "./lib.mjs";

const INVOICE_INDEX = 5;
const FIAT = 1;

async function confirmations(txid) {
  const status = await fetchJson(`${MEMPOOL}/api/tx/${txid}/status`);
  if (!status) return null;
  if (!status.confirmed) return 0;
  const tip = Number(await (await fetch(`${MEMPOOL}/api/blocks/tip/height`)).text());
  return tip - status.block_height + 1;
}

async function main() {
  if (NET_NAME !== "mainnet") throw new Error("run with SATSEND_NETWORK=mainnet");
  const env = loadEnv();
  const root = walletRoot(env);

  const utxos = await collectSpendable(root, 20);
  const totalSpendable = utxos.reduce((sum, u) => sum + u.value, 0);
  console.log(`wallet spendable: ${totalSpendable} sats across ${utxos.length} utxos`);
  if (!utxos.length) throw new Error("no spendable mainnet funds found");

  const invoiceAddress = derive(root, RECEIVE, INVOICE_INDEX).address;
  console.log(`invoice address (index ${INVOICE_INDEX}): ${invoiceAddress}`);

  const userId = await ensureTestUser(env);
  const row = {
    user_id: userId,
    invoice_number: "MAINNET-SMOKE",
    your_email: "",
    client_name: "Mainnet smoke",
    client_email: "",
    line_items: [{ description: "Mainnet smoke", quantity: 1, unit_price: FIAT }],
    subtotal_fiat: FIAT,
    tax_fiat: 0,
    tax_percent: 0,
    total_fiat: FIAT,
    currency: "USD",
    status: "pending",
    btc_address: invoiceAddress,
    access_code: null,
    stage_attempt: 0,
    mempool_seen_at: null,
    next_check_at: new Date().toISOString(),
  };
  const invoice = (await sb(env, "invoices", { method: "POST", body: row, prefer: "return=representation" }))[0];
  console.log(`invoice ${invoice.id} for $${FIAT}`);

  const price = (await (await fetch(`${APP_URL}/api/btc-price?currency=USD`)).json()).price;
  const sats = Math.round((FIAT / price) * 1e8);
  console.log(`price $${price} -> paying ${sats} sats`);

  const fees = await fetchJson(`${MEMPOOL}/api/v1/fees/recommended`);
  const feeRate = Math.max(1, Math.min(5, Math.ceil(fees?.halfHourFee ?? 1)));
  console.log(`feeRate ${feeRate} sat/vB`);

  utxos.sort((a, b) => b.value - a.value);
  const selected = [];
  let total = 0;
  for (const u of utxos) {
    selected.push(u);
    total += u.value;
    if (total >= sats + 300) break;
  }
  const changeAddress = derive(root, CHANGE, 0).address;

  const result = await buildAndSend({ root, inputs: selected, toAddress: invoiceAddress, sats, changeAddress, feeRate });
  console.log(`paid: ${JSON.stringify(result)}`);

  console.log("waiting for 2 confirmations (mainnet, up to 60 min)...");
  const deadline = Date.now() + 60 * 60_000;
  for (;;) {
    const c = await confirmations(result.txid);
    console.log(`  confirmations: ${c ?? "?"}`);
    if (c !== null && c >= 2) break;
    if (Date.now() > deadline) throw new Error("timed out waiting for confirmations");
    await sleep(60_000);
  }

  await fetch(`${APP_URL}/api/invoices/${invoice.id}/payment-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txid: result.txid, status: "paid" }),
  });

  let final = null;
  for (let i = 0; i < 12; i++) {
    const rows = await sb(
      env,
      `invoices?id=eq.${invoice.id}&select=status,total_fiat,amount_received_sats,btc_price_at_detection,amount_received_fiat,overpaid`
    );
    final = rows[0];
    if (final.status === "paid" || final.status === "underpaid") break;
    await sleep(5000);
  }
  console.log(JSON.stringify(final, null, 2));

  const pass = (final.status === "paid" || final.status === "underpaid") && final.amount_received_sats != null;
  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(1);
});
