// Shared primitives for the test-automation tooling. Dev-only.
//
// Loads config from the local environment file (never printed), derives testnet
// addresses from the test wallet, signs and broadcasts payments, and talks to
// the test database with the service role.

import { readFileSync } from "node:fs";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { Transaction, p2wpkh, TEST_NETWORK } from "@scure/btc-signer";

export const MEMPOOL = process.env.MEMPOOL_TESTNET4_URL ?? "https://mempool.space/testnet4";
export const APP_URL = process.env.SATSEND_APP_URL ?? "http://localhost:3000";

export const RECEIVE = "m/84'/1'/0'/0";
export const CHANGE = "m/84'/1'/0'/1";

// Where test invoices are paid to, and where the wallet's spendable balance
// lives, are kept out of the range the wallet has already used.
export const HOT_INDEX = 500;
export const INVOICE_INDEX_START = 1000;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function loadEnv() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

export function walletRoot(env) {
  const mnemonic = (env.TESTNET_WALLET_MNEMONIC ?? "").trim().replace(/\s+/g, " ");
  if (!mnemonic) throw new Error("TESTNET_WALLET_MNEMONIC is not set");
  if (!validateMnemonic(mnemonic, wordlist)) throw new Error("TESTNET_WALLET_MNEMONIC is not a valid BIP39 mnemonic");
  return HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic));
}

export function derive(root, path, index) {
  const child = root.derive(`${path}/${index}`);
  const p = p2wpkh(child.publicKey, TEST_NETWORK);
  return { address: p.address, script: p.script, privateKey: child.privateKey };
}

// --- mempool.space ---

export async function fetchJson(url, attempts = 4) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt) await sleep(800 * attempt);
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return await res.json();
    } catch {
      continue;
    }
  }
  return null;
}

export async function fetchUtxos(address) {
  return fetchJson(`${MEMPOOL}/api/address/${address}/utxo`);
}

export async function addressBalance(address) {
  const j = await fetchJson(`${MEMPOOL}/api/address/${address}`);
  if (!j) return null;
  return {
    confirmed: j.chain_stats.funded_txo_sum - j.chain_stats.spent_txo_sum,
    pending: j.mempool_stats.funded_txo_sum - j.mempool_stats.spent_txo_sum,
  };
}

export async function broadcast(rawHex) {
  const res = await fetch(`${MEMPOOL}/api/tx`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: rawHex,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`broadcast failed (${res.status}): ${text}`);
  return text.trim();
}

const estimateVsize = (nIn, nOut) => 11 + nIn * 68 + nOut * 31;

// Build a P2WPKH transaction from the given inputs, pay `sats` to `toAddress`,
// return change to `changeAddress`, sign with each input's key, and broadcast.
export async function buildAndSend({ root, inputs, toAddress, sats, changeAddress, feeRate = 2 }) {
  const total = inputs.reduce((sum, u) => sum + u.value, 0);
  const nOut = total - sats - estimateVsize(inputs.length, 2) * feeRate >= 546 ? 2 : 1;
  const fee = estimateVsize(inputs.length, nOut) * feeRate;
  if (total < sats + fee) {
    throw new Error(`insufficient funds: have ${total} sats, need ${sats} + ${fee} fee`);
  }
  const change = total - sats - fee;

  const tx = new Transaction();
  const keys = [];
  for (const u of inputs) {
    const { script, privateKey } = derive(root, u.path, u.index);
    tx.addInput({ txid: u.txid, index: u.vout, witnessUtxo: { script, amount: BigInt(u.value) } });
    keys.push(privateKey);
  }
  tx.addOutputAddress(toAddress, BigInt(sats), TEST_NETWORK);
  if (nOut === 2) tx.addOutputAddress(changeAddress, BigInt(change), TEST_NETWORK);
  keys.forEach((key, i) => tx.signIdx(key, i));
  tx.finalize();

  const txid = await broadcast(tx.hex);
  return { txid, fee, change, inputs: inputs.length, vsize: tx.vsize };
}

// Collect spendable outputs across the receive and change chains up to maxIndex.
export async function collectSpendable(root, maxIndex) {
  const out = [];
  for (const path of [RECEIVE, CHANGE]) {
    for (let i = 0; i <= maxIndex; i++) {
      const utxos = await fetchUtxos(derive(root, path, i).address);
      if (utxos) {
        for (const u of utxos) {
          out.push({ path, index: i, txid: u.txid, vout: u.vout, value: u.value });
        }
      }
      await sleep(120);
    }
  }
  return out;
}

// --- Supabase (test project, service role) ---

export function sbHeaders(env, extra = {}) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

export async function sb(env, path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: sbHeaders(env, prefer ? { Prefer: prefer } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`supabase ${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

export const TEST_EMAIL = "test@satsend.dev";

export async function ensureTestUser(env) {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
    headers: sbHeaders(env),
  });
  if (res.ok) {
    const data = await res.json();
    const users = data.users ?? data;
    const existing = users.find((u) => u.email === TEST_EMAIL);
    if (existing) return existing.id;
  }
  const created = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: sbHeaders(env),
    body: JSON.stringify({ email: TEST_EMAIL, email_confirm: true }),
  });
  const body = await created.json();
  if (!created.ok) throw new Error(`create user failed (${created.status}): ${JSON.stringify(body)}`);
  return body.id;
}
