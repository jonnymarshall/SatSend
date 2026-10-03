#!/usr/bin/env node
// Dev-only testnet4 wallet tooling for automated testing.
//
// Reads TESTNET_WALLET_MNEMONIC from the environment. Run it with Node's
// --env-file so it never needs the secret on the command line and never prints
// it:
//
//   node --env-file=.env.local test-automation/wallet.mjs find 5
//   node --env-file=.env.local test-automation/wallet.mjs address 0
//
// Nothing here touches mainnet. The wallet is only used to pay testnet4
// invoices during automated tests.

import { readFileSync } from "node:fs";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { Transaction, p2pkh, p2sh, p2tr, p2wpkh, TEST_NETWORK } from "@scure/btc-signer";

// Load TESTNET_WALLET_MNEMONIC from .env.local the same way the app does, so the
// secret is never passed on the command line and never printed. Only the one
// variable this tool needs is imported.
function loadEnvLocal() {
  if (process.env.TESTNET_WALLET_MNEMONIC) return;
  let text;
  try {
    text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return;
  }
  for (const key of ["TESTNET_WALLET_MNEMONIC", "NEXT_PUBLIC_BTC_NETWORK"]) {
    const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)\\s*$`, "m"));
    if (!match) continue;
    let value = match[1];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const MEMPOOL = process.env.MEMPOOL_TESTNET4_URL ?? "https://mempool.space/testnet4";

// BIP84 testnet, both chains: /0 is the receive chain, /1 is the change chain.
// Addresses 0 and 1 on the receive chain are confirmed to belong to this seed,
// so this is the wallet layout. Add other layouts here if a future wallet needs
// them.
const PATHS = [
  { path: "m/84'/1'/0'/0", type: "p2wpkh" }, // receive chain
  { path: "m/84'/1'/0'/1", type: "p2wpkh" }, // change chain
];

function loadMnemonic() {
  const raw = process.env.TESTNET_WALLET_MNEMONIC ?? "";
  const mnemonic = raw.trim().replace(/\s+/g, " ");
  if (!mnemonic) throw new Error("TESTNET_WALLET_MNEMONIC is not set");
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error("TESTNET_WALLET_MNEMONIC is not a valid BIP39 mnemonic");
  }
  return mnemonic;
}

function addressFor(root, path, index, type) {
  const child = root.derive(`${path}/${index}`);
  const pub = child.publicKey;
  if (!pub) throw new Error(`could not derive public key for ${path}/${index}`);
  switch (type) {
    case "p2wpkh":
      return p2wpkh(pub, TEST_NETWORK).address;
    case "p2pkh":
      return p2pkh(pub, TEST_NETWORK).address;
    case "p2sh-p2wpkh":
      return p2sh(p2wpkh(pub), TEST_NETWORK).address;
    case "p2tr":
      return p2tr(pub.slice(1), undefined, TEST_NETWORK).address;
    default:
      throw new Error(`unknown address type: ${type}`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Returns { confirmed, pending } or null if the request genuinely failed after
// retries. Null must NOT be treated as zero, or rate limiting silently looks
// like an empty address.
async function balance(address) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(800 * attempt);
    try {
      const res = await fetch(`${MEMPOOL}/api/address/${address}`);
      if (!res.ok) continue;
      const j = await res.json();
      const confirmed = j.chain_stats.funded_txo_sum - j.chain_stats.spent_txo_sum;
      const pending = j.mempool_stats.funded_txo_sum - j.mempool_stats.spent_txo_sum;
      return { confirmed, pending };
    } catch {
      continue;
    }
  }
  return null;
}

const hexToBytes = (hex) => Uint8Array.from(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));

async function fetchUtxos(address) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(800 * attempt);
    try {
      const res = await fetch(`${MEMPOOL}/api/address/${address}/utxo`);
      if (!res.ok) continue;
      return await res.json();
    } catch {
      continue;
    }
  }
  return null;
}

async function collectSpendable(root, maxIndex) {
  const spendable = [];
  for (const { path, type } of PATHS) {
    for (let i = 0; i <= maxIndex; i++) {
      const child = root.derive(`${path}/${i}`);
      const address = addressFor(root, path, i, type);
      const utxos = await fetchUtxos(address);
      if (utxos) {
        for (const u of utxos) {
          spendable.push({
            path,
            index: i,
            address,
            txid: u.txid,
            vout: u.vout,
            value: u.value,
            privateKey: child.privateKey,
          });
        }
      }
      await sleep(120);
    }
  }
  return spendable;
}

// Rough P2WPKH sizes. Good enough for fee selection on testnet.
const estimateVsize = (nIn, nOut) => 11 + nIn * 68 + nOut * 31;

async function broadcast(rawHex) {
  const res = await fetch(`${MEMPOOL}/api/tx`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: rawHex,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`broadcast failed (${res.status}): ${text}`);
  return text.trim();
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  loadEnvLocal();
  const mnemonic = loadMnemonic();
  const root = HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic));

  console.log(`network env: ${process.env.NEXT_PUBLIC_BTC_NETWORK ?? "(unset)"}`);
  console.log(`mempool: ${MEMPOOL}`);

  if (cmd === "address") {
    const { path, type } = PATHS[0];
    const index = Number(arg ?? 0);
    console.log(`${path}/${index} (${type}) -> ${addressFor(root, path, index, type)}`);
    return;
  }

  if (cmd === "find") {
    const max = Number(arg ?? 5);
    let found = 0;
    let errors = 0;
    let totalSats = 0;
    for (const { path, type } of PATHS) {
      for (let i = 0; i <= max; i++) {
        const address = addressFor(root, path, i, type);
        const bal = await balance(address);
        if (!bal) {
          errors += 1;
          console.log(`  (request failed for ${path}/${i} ${address})`);
          continue;
        }
        const sats = bal.confirmed + bal.pending;
        if (sats > 0) {
          found += 1;
          totalSats += sats;
          console.log(`FUNDED ${path}/${i} (${type}) ${address} ${sats} sats (confirmed ${bal.confirmed}, pending ${bal.pending})`);
        }
        await sleep(150);
      }
    }
    console.log(
      `scan complete: ${found} funded, total ${totalSats} sats, request failures: ${errors}`
    );
    return;
  }

  if (cmd === "utxos") {
    const max = Number(arg ?? 200);
    const utxos = await collectSpendable(root, max);
    utxos.sort((a, b) => b.value - a.value);
    let total = 0;
    for (const u of utxos) {
      total += u.value;
      console.log(`${u.value} sats  ${u.path}/${u.index}  ${u.txid}:${u.vout}`);
    }
    console.log(`spendable: ${utxos.length} utxos, total ${total} sats`);
    return;
  }

  if (cmd === "send") {
    const to = process.argv[3];
    const sats = Number(process.argv[4]);
    const feeRate = Number(process.argv[5] ?? 2);
    if (!to || !Number.isFinite(sats)) {
      console.log("usage: send <toAddress> <sats> [feeRate]");
      return;
    }

    const max = Number(process.env.WALLET_SCAN_MAX ?? 200);
    const utxos = await collectSpendable(root, max);
    utxos.sort((a, b) => b.value - a.value);

    const selected = [];
    let total = 0;
    let fee = 0;
    let nOut = 1;
    for (const u of utxos) {
      selected.push(u);
      total += u.value;
      nOut = total - sats - estimateVsize(selected.length, 2) * feeRate >= 546 ? 2 : 1;
      fee = estimateVsize(selected.length, nOut) * feeRate;
      if (total >= sats + fee) break;
    }
    if (total < sats + fee) {
      throw new Error(`insufficient funds: have ${total} sats, need ${sats} + ${fee} fee`);
    }
    const change = total - sats - fee;

    // Change returns to our own wallet on the change chain. Reusing one change
    // address is fine for the test wallet; only invoice addresses must be fresh.
    const changeAddress = addressFor(root, "m/84'/1'/0'/1", 200, "p2wpkh");

    const tx = new Transaction();
    for (const u of selected) {
      const child = root.derive(`${u.path}/${u.index}`);
      const script = p2wpkh(child.publicKey, TEST_NETWORK).script;
      tx.addInput({
        txid: u.txid,
        index: u.vout,
        witnessUtxo: { script, amount: BigInt(u.value) },
      });
    }
    tx.addOutputAddress(to, BigInt(sats), TEST_NETWORK);
    if (nOut === 2) tx.addOutputAddress(changeAddress, BigInt(change), TEST_NETWORK);

    selected.forEach((u, i) => tx.signIdx(u.privateKey, i));
    tx.finalize();

    console.log(`to=${to} sats=${sats} inputs=${selected.length} total=${total} fee=${fee} change=${nOut === 2 ? change : 0} vsize=${tx.vsize}`);
    const txid = await broadcast(tx.hex);
    console.log(`broadcast: ${txid}`);
    return;
  }

  console.log("usage: wallet.mjs address [index] | find [maxIndex] | utxos [maxIndex] | send <to> <sats> [feeRate]");
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(1);
});
