#!/usr/bin/env node
// Dev-only wallet tooling. Testnet by default; set SATSEND_NETWORK=mainnet to use
// the mainnet wallet. Reads the seed from the local environment file and never
// prints it.
//
//   node test-automation/wallet.mjs address 0
//   node test-automation/wallet.mjs find 20
//   SATSEND_NETWORK=mainnet node test-automation/wallet.mjs find 20
//   SATSEND_NETWORK=mainnet node test-automation/wallet.mjs balance <address>

import { CHANGE, NET_NAME, RECEIVE, addressBalance, derive, loadEnv, sleep, walletRoot } from "./lib.mjs";

const PATHS = [RECEIVE, CHANGE];

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  const env = loadEnv();
  const root = walletRoot(env);
  console.log(`network: ${NET_NAME}`);

  if (cmd === "address") {
    const index = Number(arg ?? 0);
    console.log(`${RECEIVE}/${index} -> ${derive(root, RECEIVE, index).address}`);
    return;
  }

  if (cmd === "balance") {
    console.log(JSON.stringify(await addressBalance(arg)));
    return;
  }

  if (cmd === "find") {
    const max = Number(arg ?? 20);
    let found = 0;
    let errors = 0;
    let total = 0;
    for (const path of PATHS) {
      for (let i = 0; i <= max; i++) {
        const address = derive(root, path, i).address;
        const bal = await addressBalance(address);
        if (!bal) {
          errors += 1;
          continue;
        }
        const sats = bal.confirmed + bal.pending;
        if (sats > 0) {
          found += 1;
          total += sats;
          console.log(`FUNDED ${path}/${i} ${address} ${sats} sats`);
        }
        await sleep(150);
      }
    }
    console.log(`scan complete: ${found} funded, total ${total} sats, failures ${errors}`);
    return;
  }

  console.log("usage: wallet.mjs address [index] | find [maxIndex] | balance <address>");
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(1);
});
