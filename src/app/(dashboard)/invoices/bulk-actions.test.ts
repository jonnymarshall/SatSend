import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { bulkArchive, bulkDelete, bulkMarkPaid, bulkUnarchive } from "./bulk-actions";

type AnySupabase = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;

// A single mock that supports all the query shapes the bulk actions use:
//   SELECT: .select(cols).eq(...).in(...).neq(...).neq(...)    (bulkArchive fetch)
//           .select(cols).eq(...).in(...).eq("status", "archived")  (bulkUnarchive fetch)
//   UPDATE: .update(payload).eq(...).in(...)                    (bulkMarkPaid)
//           .update(payload).eq(...).eq(...)                    (bulkArchive/bulkUnarchive per-row)
//   DELETE: .delete().eq(...).in(...)                           (bulkDelete)
//
// The trick: every chainable method returns the same "builder" object, which is also
// a Promise resolving to a configurable result. Each helper records its call args so
// tests can assert against them.

interface BuilderConfig {
  selectResult?: { data: Row[] | null; error: { message: string } | null };
  updateResult?: { error: { message: string } | null };
  deleteResult?: { error: { message: string } | null };
  userId?: string;
}

function makeSupabase(config: BuilderConfig = {}) {
  const {
    selectResult = { data: [], error: null },
    updateResult = { error: null },
    deleteResult = { error: null },
    userId = "user-1",
  } = config;

  const updatePayloads: Row[] = [];
  const updateFilters: Array<{ method: string; args: unknown[] }> = [];
  const selectCols: string[] = [];
  const selectFilters: Array<{ method: string; args: unknown[] }> = [];
  const deleteFilters: Array<{ method: string; args: unknown[] }> = [];

  function makeBuilder(
    kind: "select" | "update" | "delete",
    resultFor: () => { data?: Row[] | null; error: { message: string } | null }
  ): Record<string, unknown> {
    const recordFilter = (method: string, args: unknown[]) => {
      if (kind === "select") selectFilters.push({ method, args });
      else if (kind === "update") updateFilters.push({ method, args });
      else deleteFilters.push({ method, args });
    };
    // The builder is a thenable Promise-like: awaiting it yields the configured result.
    const thenable: Record<string, unknown> = {
      eq: vi.fn((...args: unknown[]) => {
        recordFilter("eq", args);
        return thenable;
      }),
      in: vi.fn((...args: unknown[]) => {
        recordFilter("in", args);
        return thenable;
      }),
      neq: vi.fn((...args: unknown[]) => {
        recordFilter("neq", args);
        return thenable;
      }),
      then: (onFulfilled: (v: unknown) => void, onRejected?: (e: unknown) => void) =>
        Promise.resolve(resultFor()).then(onFulfilled, onRejected),
    };
    return thenable;
  }

  const from = vi.fn(() => ({
    select: vi.fn((cols: string) => {
      selectCols.push(cols);
      return makeBuilder("select", () => selectResult);
    }),
    update: vi.fn((payload: Row) => {
      updatePayloads.push(payload);
      return makeBuilder("update", () => updateResult);
    }),
    delete: vi.fn(() => makeBuilder("delete", () => deleteResult)),
  }));

  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
    },
    from,
  } as unknown as AnySupabase);

  return { from, updatePayloads, updateFilters, selectCols, selectFilters, deleteFilters };
}

beforeEach(() => vi.clearAllMocks());

describe("bulkArchive", () => {
  it("captures each row's current status into pre_archive_status and sets status=archived", async () => {
    const { updatePayloads } = makeSupabase({
      selectResult: {
        data: [
          { id: "inv-1", status: "paid" },
          { id: "inv-2", status: "overdue" },
        ],
        error: null,
      },
    });
    await bulkArchive(["inv-1", "inv-2"]);
    expect(updatePayloads).toEqual([
      { status: "archived", pre_archive_status: "paid" },
      { status: "archived", pre_archive_status: "overdue" },
    ]);
  });

  it("excludes draft and archived rows from the fetch (never archives them)", async () => {
    const { selectFilters } = makeSupabase({ selectResult: { data: [], error: null } });
    await bulkArchive(["inv-1"]);
    const neqCalls = selectFilters.filter((f) => f.method === "neq").map((f) => f.args);
    expect(neqCalls).toEqual(
      expect.arrayContaining([["status", "draft"], ["status", "archived"]])
    );
  });

  it("scopes both fetch and update to the authenticated user", async () => {
    const { selectFilters, updateFilters } = makeSupabase({
      selectResult: { data: [{ id: "inv-1", status: "paid" }], error: null },
      userId: "user-99",
    });
    await bulkArchive(["inv-1"]);
    const selectUserScopes = selectFilters.filter(
      (f) => f.method === "eq" && f.args[0] === "user_id"
    );
    const updateUserScopes = updateFilters.filter(
      (f) => f.method === "eq" && f.args[0] === "user_id"
    );
    expect(selectUserScopes[0].args).toEqual(["user_id", "user-99"]);
    expect(updateUserScopes[0].args).toEqual(["user_id", "user-99"]);
  });

  it("does nothing when no matching rows are found", async () => {
    const { updatePayloads } = makeSupabase({ selectResult: { data: [], error: null } });
    await bulkArchive(["inv-1"]);
    expect(updatePayloads).toEqual([]);
  });

  it("returns archived and skipped counts so callers can surface feedback", async () => {
    makeSupabase({
      selectResult: {
        data: [
          { id: "inv-1", status: "paid" },
          { id: "inv-2", status: "overdue" },
        ],
        error: null,
      },
    });
    const result = await bulkArchive(["inv-1", "inv-2", "inv-3", "inv-4"]);
    expect(result).toEqual({ archived: 2, skipped: 2 });
  });

  it("returns archived=0, skipped=N when nothing matches", async () => {
    makeSupabase({ selectResult: { data: [], error: null } });
    const result = await bulkArchive(["inv-1", "inv-2"]);
    expect(result).toEqual({ archived: 0, skipped: 2 });
  });

  it("throws when the update step returns an error", async () => {
    makeSupabase({
      selectResult: { data: [{ id: "inv-1", status: "paid" }], error: null },
      updateResult: { error: { message: "archive failed" } },
    });
    await expect(bulkArchive(["inv-1"])).rejects.toThrow("archive failed");
  });
});

describe("bulkUnarchive", () => {
  it("restores each row to its pre_archive_status and clears pre_archive_status", async () => {
    const { updatePayloads } = makeSupabase({
      selectResult: {
        data: [
          { id: "inv-1", pre_archive_status: "paid" },
          { id: "inv-2", pre_archive_status: "overdue" },
        ],
        error: null,
      },
    });
    await bulkUnarchive(["inv-1", "inv-2"]);
    expect(updatePayloads).toEqual([
      { status: "paid", pre_archive_status: null },
      { status: "overdue", pre_archive_status: null },
    ]);
  });

  it("falls back to 'pending' when pre_archive_status is null (legacy rows)", async () => {
    const { updatePayloads } = makeSupabase({
      selectResult: { data: [{ id: "inv-1", pre_archive_status: null }], error: null },
    });
    await bulkUnarchive(["inv-1"]);
    expect(updatePayloads).toEqual([{ status: "pending", pre_archive_status: null }]);
  });

  it("only unarchives rows whose status is currently 'archived'", async () => {
    const { selectFilters } = makeSupabase({ selectResult: { data: [], error: null } });
    await bulkUnarchive(["inv-1"]);
    const statusScope = selectFilters.find(
      (f) => f.method === "eq" && f.args[0] === "status"
    );
    expect(statusScope?.args).toEqual(["status", "archived"]);
  });

  it("scopes fetch and update to the authenticated user", async () => {
    const { selectFilters, updateFilters } = makeSupabase({
      selectResult: { data: [{ id: "inv-1", pre_archive_status: "paid" }], error: null },
      userId: "user-13",
    });
    await bulkUnarchive(["inv-1"]);
    expect(
      selectFilters.find((f) => f.method === "eq" && f.args[0] === "user_id")?.args
    ).toEqual(["user_id", "user-13"]);
    expect(
      updateFilters.find((f) => f.method === "eq" && f.args[0] === "user_id")?.args
    ).toEqual(["user_id", "user-13"]);
  });

  it("throws when the update step returns an error", async () => {
    makeSupabase({
      selectResult: { data: [{ id: "inv-1", pre_archive_status: "paid" }], error: null },
      updateResult: { error: { message: "unarchive failed" } },
    });
    await expect(bulkUnarchive(["inv-1"])).rejects.toThrow("unarchive failed");
  });
});

describe("bulkDelete", () => {
  it("deletes all given invoices regardless of status", async () => {
    const { deleteFilters } = makeSupabase();
    await bulkDelete(["inv-1", "inv-2", "inv-3"]);
    const inCall = deleteFilters.find((f) => f.method === "in");
    expect(inCall?.args).toEqual(["id", ["inv-1", "inv-2", "inv-3"]]);
  });

  it("scopes the delete to the authenticated user", async () => {
    const { deleteFilters } = makeSupabase({ userId: "user-7" });
    await bulkDelete(["inv-1"]);
    const eqCall = deleteFilters.find((f) => f.method === "eq" && f.args[0] === "user_id");
    expect(eqCall?.args).toEqual(["user_id", "user-7"]);
  });

  it("throws when supabase delete returns an error", async () => {
    makeSupabase({ deleteResult: { error: { message: "delete failed" } } });
    await expect(bulkDelete(["inv-1"])).rejects.toThrow("delete failed");
  });
});

describe("bulkMarkPaid", () => {
  it("updates all given invoices to paid status with manual confirmation fields (v1.4.14)", async () => {
    const { updatePayloads } = makeSupabase();
    await bulkMarkPaid(["inv-1", "inv-2"]);
    expect(updatePayloads[0]).toMatchObject({
      status: "paid",
      payment_confirmation_method: "manual",
    });
    expect(updatePayloads[0].paid_at).toBeTruthy();
  });

  it("scopes the update to the authenticated user", async () => {
    const { updateFilters } = makeSupabase({ userId: "user-42" });
    await bulkMarkPaid(["inv-1"]);
    const eqCall = updateFilters.find((f) => f.method === "eq" && f.args[0] === "user_id");
    expect(eqCall?.args).toEqual(["user_id", "user-42"]);
  });

  it("filters by the given ids", async () => {
    const { updateFilters } = makeSupabase();
    await bulkMarkPaid(["inv-3", "inv-4"]);
    const inCall = updateFilters.find((f) => f.method === "in");
    expect(inCall?.args).toEqual(["id", ["inv-3", "inv-4"]]);
  });

  it("throws when supabase returns an error", async () => {
    makeSupabase({ updateResult: { error: { message: "update failed" } } });
    await expect(bulkMarkPaid(["inv-1"])).rejects.toThrow("update failed");
  });
});
