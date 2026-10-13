#!/usr/bin/env node
// npm run dev:sweep (v1.5.8, roadmap v1.5.0.5-H)
//
// Runs the dev server WITH a background payment checker, like production has.
// Plain `npm run dev` has none, so statuses only move while an invoice page is
// open. This script:
//   1. refuses to start unless the app points at a test database;
//   2. starts `next dev` with PAYMENT_SWEEP_ENABLED=true and a one-off random
//      CRON_SECRET, both living only in that process (gone when you stop it);
//   3. calls the sweep every minute, printing only when something happens.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import nextEnv from "@next/env";
import { isTestDatabaseUrl } from "./sweep-guard.mjs";

const INTERVAL_MS = 60_000;
const FIRST_RUN_MS = 10_000;

nextEnv.loadEnvConfig(process.cwd(), true);

if (!isTestDatabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
  console.error(
    "[dev:sweep] Refusing to start: NEXT_PUBLIC_SUPABASE_URL is not a test database.\n" +
      "The payment sweep writes to the database; locally it may only run against the test project.\n" +
      "Use `npm run dev` instead, or add the test project ref to scripts/dev/sweep-guard.mjs."
  );
  process.exit(1);
}

const port = process.env.PORT || "3000";
const secret = randomBytes(24).toString("hex");

const server = spawn("npx", ["next", "dev", "--port", port], {
  stdio: "inherit",
  env: { ...process.env, PAYMENT_SWEEP_ENABLED: "true", CRON_SECRET: secret },
});

async function sweep() {
  try {
    const res = await fetch(`http://localhost:${port}/api/cron/payment-sweep`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(`[dev:sweep] sweep returned ${res.status}`, body);
    } else if (body.transitions || body.errors || body.overdueFlips) {
      console.info("[dev:sweep]", body);
    }
  } catch {
    // Server still starting or restarting; the next tick tries again.
  }
}

console.info(`[dev:sweep] background payment checks every ${INTERVAL_MS / 1000}s (test database)`);
const first = setTimeout(sweep, FIRST_RUN_MS);
const timer = setInterval(sweep, INTERVAL_MS);

function stop() {
  clearTimeout(first);
  clearInterval(timer);
  server.kill("SIGINT");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => {
  clearTimeout(first);
  clearInterval(timer);
  process.exit(code ?? 0);
});
