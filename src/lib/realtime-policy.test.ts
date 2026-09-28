import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The public payer page subscribes to a private broadcast channel named
// `invoice:<id>`. Supabase evaluates realtime.messages RLS against the
// *requested* topic, exposed through the `realtime.topic()` helper — not the
// `topic` column on the table. Migration 0023 used the bare column, so every
// join was refused ("Unauthorized ... Channel topic"). This guards the newest
// definition of that policy so the bare column can't be reintroduced.
//
// (Historical migrations 0022/0023 still contain the old predicate, so the
// check looks only at the latest migration that defines the policy.)
const POLICY_NAME = "anon_select_invoice_status_broadcast";

describe("realtime policy for the public invoice broadcast", () => {
  it("uses realtime.topic() in the newest migration that defines the policy", () => {
    const dir = join(process.cwd(), "supabase", "migrations");

    const defining = readdirSync(dir)
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .filter((name) => readFileSync(join(dir, name), "utf8").includes(POLICY_NAME));

    expect(defining.length).toBeGreaterThan(0);

    const latest = defining[defining.length - 1];
    const sql = readFileSync(join(dir, latest), "utf8");

    expect(sql).toContain("realtime.topic()");
  });
});
