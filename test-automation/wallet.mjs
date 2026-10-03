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
import { p2pkh, p2sh, p2tr, p2wpkh, TEST_NETWORK } from "@scure/btc-signer";

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
          console.log(`FUNDED ${path}/${i} (${type}) ${address} ${sats} sats (confirmed ${bal.confirmed}, pending ${bal.pending})`);
        }
        await sleep(250);
      }
    }
    console.log(
      found === 0
        ? `no funded address found in the scanned range (request failures: ${errors})`
        : `scan complete: ${found} funded (request failures: ${errors})`
    );
    return;
  }

  console.log("usage: wallet.mjs address [index] | find [maxIndex]");
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(1);
});
