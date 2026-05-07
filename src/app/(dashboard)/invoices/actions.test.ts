import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/email/send", () => ({
  sendInvoicePublishedEmail: vi.fn().mockResolvedValue({ status: "sent" }),
}));
vi.mock("@/lib/invoice-events", () => ({ logInvoiceEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/mempool", () => ({ addressHasHistory: vi.fn().mockResolvedValue(false) }));

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { sendInvoicePublishedEmail } from "@/lib/email/send";
import { logInvoiceEvent } from "@/lib/invoice-events";
import { addressHasHistory } from "@/lib/mempool";
import {
  saveDraft,
  publishInvoice,
  publishAndSendEmail,
  publishAndMarkSent,
  markPaid,
  markUnpaid,
  deleteDraft,
  markOverdue,
  duplicateInvoice,
} from "./actions";

const VALID_DRAFT = {
  client_name: "Acme Corp",
  client_email: "acme@example.com",
  line_items: [{ description: "Work", quantity: 1, unit_price: 1000 }],
  tax_percent: 0,
  accepts_bitcoin: true,
  btc_address: "bc1qtest",
  due_date: "2026-06-01",
};

type AnySupabase = Awaited<ReturnType<typeof createClient>>;

function makeSupabase({
  fetchData = null as object | null,
  insertData = { id: "inv-1", status: "draft" } as object,
  insertError = null as object | null,
  btcConflict = null as object | null,
  updateError = null as object | null,
  deleteError = null as object | null,
  userId = "user-1",
} = {}) {
  // insert chain: .insert().select().single()
  const insertSingle = vi.fn().mockResolvedValue({ data: insertData, error: insertError });
  const insertChain = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ single: insertSingle }),
  });

  // update chain: .update().eq()
  const updateEq = vi.fn().mockResolvedValue({ data: {}, error: updateError });
  const updateChain = vi.fn().mockReturnValue({ eq: updateEq });

  // delete chain: .delete().eq()
  const deleteEq = vi.fn().mockResolvedValue({ data: null, error: deleteError });
  const deleteChain = vi.fn().mockReturnValue({ eq: deleteEq });

  // select chain: differentiate by column list
  //   select("*")          → fetch by id → .eq(id).single()
  //   select("id, invoice_number") → uniqueness — two variants since v1.4.13.6:
  //     publish/update path: .eq(address).neq(status).neq(id).maybeSingle()
  //     save path:           .eq(address).neq(status).maybeSingle()
  const maybeSingle = vi.fn().mockResolvedValue({ data: btcConflict, error: null });
  const uniqIdNeq = vi.fn().mockReturnValue({ maybeSingle });
  const uniqStatusNeq = vi.fn().mockReturnValue({ neq: uniqIdNeq, maybeSingle });
  const uniqAddressEq = vi.fn().mockReturnValue({ neq: uniqStatusNeq });

  const fetchSingle = vi.fn().mockResolvedValue({ data: fetchData, error: null });
  const fetchIdEq = vi.fn().mockReturnValue({ single: fetchSingle });

  const selectChain = vi.fn((cols: string) =>
    cols === "id, invoice_number"
      ? { eq: uniqAddressEq }
      : { eq: fetchIdEq }
  );

  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
    },
    from: vi.fn(() => ({
      insert: insertChain,
      select: selectChain,
      update: updateChain,
      delete: deleteChain,
    })),
  } as unknown as AnySupabase);

  return { insertSingle, insertChain, updateChain, updateEq, deleteEq, maybeSingle };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Re-establish the default: addressHasHistory returns false (fresh address) unless
  // a test overrides it. clearAllMocks clears call history but not once-mocks; if a
  // RED test queued a once-mock that never got consumed, it would leak into later tests.
  vi.mocked(addressHasHistory).mockReset().mockResolvedValue(false);
});

describe("saveDraft", () => {
  it("inserts an invoice with status draft and returns it", async () => {
    const { insertSingle } = makeSupabase();
    const result = await saveDraft(VALID_DRAFT);
    expect(result.id).toBe("inv-1");
    expect(result.status).toBe("draft");
    expect(insertSingle).toHaveBeenCalled();
  });

  it("rejects when the BTC address already has on-chain or mempool history (v1.4.12 hotfix)", async () => {
    const { insertSingle } = makeSupabase();
    vi.mocked(addressHasHistory).mockResolvedValueOnce(true);
    await expect(saveDraft(VALID_DRAFT)).rejects.toThrow(
      /btc_address: This address has already received transactions/i,
    );
    expect(insertSingle).not.toHaveBeenCalled();
  });

  it("proceeds when mempool.space is unreachable — fail-open (v1.4.12 hotfix)", async () => {
    const { insertSingle } = makeSupabase();
    vi.mocked(addressHasHistory).mockResolvedValueOnce(null);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await saveDraft(VALID_DRAFT);
    expect(insertSingle).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/mempool.*unreachable|address history check skipped/i),
    );
    warnSpy.mockRestore();
  });

  it("skips the freshness check when accepts_bitcoin is false (no address to check)", async () => {
    const { insertSingle } = makeSupabase();
    await saveDraft({ ...VALID_DRAFT, accepts_bitcoin: false });
    expect(addressHasHistory).not.toHaveBeenCalled();
    expect(insertSingle).toHaveBeenCalled();
  });

  it("rejects when the BTC address is already used on another non-draft invoice in the user's account (v1.4.13.6)", async () => {
    const { insertSingle } = makeSupabase({
      btcConflict: { id: "inv-prev", invoice_number: "INV-007" },
    });
    await expect(saveDraft(VALID_DRAFT)).rejects.toThrow(
      /btc_address: This bitcoin address has already been used on invoice INV-007/i,
    );
    expect(insertSingle).not.toHaveBeenCalled();
  });
});

describe("updateDraft", () => {
  // updateDraft does a status pre-fetch (single) then an update().eq().select().single().
  // The default makeSupabase select chain returns BASE_INVOICE; we need a draft fixture.
  const draftFixture = { id: "inv-1", user_id: "user-1", status: "draft" };

  it("rejects when updating with a BTC address that has prior history (v1.4.12 hotfix)", async () => {
    makeSupabase({ fetchData: draftFixture });
    vi.mocked(addressHasHistory).mockResolvedValueOnce(true);
    const { updateDraft } = await import("./actions");
    await expect(
      updateDraft("inv-1", { ...VALID_DRAFT, btc_address: "bc1qpoisoned" }),
    ).rejects.toThrow(/btc_address: This address has already received transactions/i);
  });

  it("rejects when updating with a BTC address already used on another non-draft invoice (v1.4.13.6)", async () => {
    makeSupabase({
      fetchData: draftFixture,
      btcConflict: { id: "inv-prev", invoice_number: "INV-042" },
    });
    const { updateDraft } = await import("./actions");
    await expect(
      updateDraft("inv-1", { ...VALID_DRAFT, btc_address: "bc1qreused" }),
    ).rejects.toThrow(
      /btc_address: This bitcoin address has already been used on invoice INV-042/i,
    );
  });
});

const PUBLISHABLE_INVOICE = {
  id: "inv-1",
  status: "draft",
  user_id: "user-1",
  accepts_bitcoin: true,
  btc_address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
  client_email: "client@example.com",
  client_name: "Ada",
  your_name: "Charles",
  your_email: "charles@example.com",
  your_company: null,
  invoice_number: "INV-77",
  total_fiat: 500,
  currency: "USD",
  access_code: "SECRET42",
  due_date: "2026-07-10",
};

describe("publish actions — synchronous overdue flip (v1.4.11)", () => {
  // A draft published with a past due date should land directly on `overdue`
  // rather than `pending` (which would otherwise show as misclassified until
  // the next cron tick — up to 60 seconds, and never in dev).
  const PAST_DUE_INVOICE = { ...PUBLISHABLE_INVOICE, due_date: "2020-01-01" };

  it("publishInvoice with a past due_date flips status straight to overdue", async () => {
    const { updateChain } = makeSupabase({ fetchData: PAST_DUE_INVOICE });
    await publishInvoice("inv-1");
    const payload = updateChain.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe("overdue");
  });

  it("publishInvoice with a past due_date logs marked_as_overdue", async () => {
    makeSupabase({ fetchData: PAST_DUE_INVOICE });
    await publishInvoice("inv-1");
    expect(logInvoiceEvent).toHaveBeenCalledWith({
      invoiceId: "inv-1",
      userId: "user-1",
      eventType: "marked_as_overdue",
    });
  });

  it("publishInvoice with no due_date stays pending (no flip)", async () => {
    const { updateChain } = makeSupabase({
      fetchData: { ...PUBLISHABLE_INVOICE, due_date: null },
    });
    await publishInvoice("inv-1");
    const payload = updateChain.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe("pending");
    expect(logInvoiceEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "marked_as_overdue" }),
    );
  });

  it("publishInvoice with a future due_date stays pending (no flip)", async () => {
    const { updateChain } = makeSupabase({ fetchData: PUBLISHABLE_INVOICE });
    await publishInvoice("inv-1");
    const payload = updateChain.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe("pending");
  });

  it("publishAndMarkSent with a past due_date: status=overdue AND sent_at set", async () => {
    const { updateChain } = makeSupabase({ fetchData: PAST_DUE_INVOICE });
    await publishAndMarkSent("inv-1");
    const payload = updateChain.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe("overdue");
    expect(payload.sent_at).toBeTruthy();
    expect(payload.send_method).toBe("manual");
  });

  it("publishAndSendEmail with a past due_date and successful email: status=overdue AND email metadata set", async () => {
    vi.mocked(sendInvoicePublishedEmail).mockResolvedValueOnce({ status: "sent" });
    const { updateChain } = makeSupabase({ fetchData: PAST_DUE_INVOICE });
    await publishAndSendEmail("inv-1");
    const payload = updateChain.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe("overdue");
    expect(payload.sent_at).toBeTruthy();
    expect(payload.send_method).toBe("email");
    expect(payload.email_attempted_at).toBeTruthy();
  });
});

describe("publishInvoice — btc_address publish-gate (v1.4.14)", () => {
  it("rejects when the invoice has no btc_address", async () => {
    const noAddress = { ...PUBLISHABLE_INVOICE, btc_address: null };
    const { updateChain } = makeSupabase({ fetchData: noAddress });
    await expect(publishInvoice("inv-1")).rejects.toThrow(
      /btc_address.*required/i,
    );
    expect(updateChain).not.toHaveBeenCalled();
  });
});

describe("publishInvoice (publish-only, no email)", () => {
  it("sets status=pending without firing the invoice_published email", async () => {
    const { updateChain } = makeSupabase({ fetchData: PUBLISHABLE_INVOICE });
    await publishInvoice("inv-1");

    expect(sendInvoicePublishedEmail).not.toHaveBeenCalled();
    const payload = updateChain.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe("pending");
  });

  it("does not set sent_at, send_method, or email_attempted_at on the update payload", async () => {
    const { updateChain } = makeSupabase({ fetchData: PUBLISHABLE_INVOICE });
    await publishInvoice("inv-1");

    const payload = updateChain.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("sent_at");
    expect(payload).not.toHaveProperty("send_method");
    expect(payload).not.toHaveProperty("email_attempted_at");
  });

  it("throws if the BTC address is already used on an active invoice", async () => {
    makeSupabase({
      fetchData: PUBLISHABLE_INVOICE,
      btcConflict: { id: "inv-other", status: "pending" },
    });
    await expect(publishInvoice("inv-1")).rejects.toThrow(/btc_address: This bitcoin address/i);
  });

  it("rejects when the BTC address already has on-chain or mempool history (v1.4.12)", async () => {
    makeSupabase({ fetchData: PUBLISHABLE_INVOICE });
    vi.mocked(addressHasHistory).mockResolvedValueOnce(true);
    await expect(publishInvoice("inv-1")).rejects.toThrow(
      /btc_address: This address has already received transactions/i,
    );
  });

  it("proceeds when the BTC address has no prior history (v1.4.12)", async () => {
    const { updateChain } = makeSupabase({ fetchData: PUBLISHABLE_INVOICE });
    vi.mocked(addressHasHistory).mockResolvedValueOnce(false);
    await publishInvoice("inv-1");
    expect(updateChain).toHaveBeenCalled();
  });

  it("proceeds when mempool.space is unreachable — fail-open (v1.4.12)", async () => {
    const { updateChain } = makeSupabase({ fetchData: PUBLISHABLE_INVOICE });
    vi.mocked(addressHasHistory).mockResolvedValueOnce(null);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await publishInvoice("inv-1");
    expect(updateChain).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/mempool.*unreachable|address history check skipped/i),
    );
    warnSpy.mockRestore();
  });

  it("initialises background-polling columns (next_check_at = +15s, stage_attempt = 0, mempool_seen_at = null) alongside the status change", async () => {
    const { updateChain } = makeSupabase({ fetchData: PUBLISHABLE_INVOICE });
    const before = Date.now();
    await publishInvoice("inv-1");
    const after = Date.now();

    const payload = updateChain.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.stage_attempt).toBe(0);
    expect(payload.mempool_seen_at).toBeNull();

    // v1.4.13: tightened from +60s → +15s so a tab-closed payer reaches the
    // first cron-side mempool poll well before the prior 60–120s worst case.
    const nextCheck = new Date(payload.next_check_at as string).getTime();
    expect(nextCheck).toBeGreaterThanOrEqual(before + 15_000 - 1_000);
    expect(nextCheck).toBeLessThanOrEqual(after + 15_000 + 1_000);
  });
});

describe("publishAndSendEmail", () => {
  it("on email success: status=pending, sent_at set, send_method='email', email_attempted_at set", async () => {
    vi.mocked(sendInvoicePublishedEmail).mockResolvedValueOnce({ status: "sent" });
    const { updateChain } = makeSupabase({ fetchData: PUBLISHABLE_INVOICE });
    const before = Date.now();
    await publishAndSendEmail("inv-1");
    const after = Date.now();

    const payload = updateChain.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe("pending");
    expect(payload.send_method).toBe("email");

    const sentAt = new Date(payload.sent_at as string).getTime();
    expect(sentAt).toBeGreaterThanOrEqual(before - 1_000);
    expect(sentAt).toBeLessThanOrEqual(after + 1_000);

    const attemptAt = new Date(payload.email_attempted_at as string).getTime();
    expect(attemptAt).toBeGreaterThanOrEqual(before - 1_000);
    expect(attemptAt).toBeLessThanOrEqual(after + 1_000);
  });

  it("on email failure: status=pending, email_attempted_at set, sent_at and send_method NULL", async () => {
    vi.mocked(sendInvoicePublishedEmail).mockResolvedValueOnce({ status: "failed" });
    const { updateChain } = makeSupabase({ fetchData: PUBLISHABLE_INVOICE });
    await publishAndSendEmail("inv-1");

    const payload = updateChain.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe("pending");
    expect(payload.sent_at).toBeNull();
    expect(payload.send_method).toBeNull();
    expect(payload.email_attempted_at).toBeTruthy();
  });

  it("calls sendInvoicePublishedEmail with the invoice details", async () => {
    makeSupabase({ fetchData: PUBLISHABLE_INVOICE });
    await publishAndSendEmail("inv-1");
    expect(sendInvoicePublishedEmail).toHaveBeenCalledTimes(1);
    expect(sendInvoicePublishedEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "client@example.com",
      userId: "user-1",
      senderName: "Charles",
      clientName: "Ada",
      invoiceId: "inv-1",
      invoiceNumber: "INV-77",
      totalFiat: 500,
      currency: "USD",
      accessCode: "SECRET42",
      dueDateDisplay: "July 10, 2026",
    }));
  });

  it("throws if the BTC address is already used on an active invoice", async () => {
    makeSupabase({
      fetchData: PUBLISHABLE_INVOICE,
      btcConflict: { id: "inv-other", status: "pending" },
    });
    await expect(publishAndSendEmail("inv-1")).rejects.toThrow(/btc_address: This bitcoin address/i);
  });

  it("returns the email outcome to the caller", async () => {
    vi.mocked(sendInvoicePublishedEmail).mockResolvedValueOnce({ status: "failed" });
    makeSupabase({ fetchData: PUBLISHABLE_INVOICE });
    const result = await publishAndSendEmail("inv-1");
    expect(result).toEqual({ emailStatus: "failed" });
  });
});

describe("publishAndMarkSent", () => {
  it("status=pending, sent_at set, send_method='manual', email_attempted_at NULL, no email", async () => {
    const { updateChain } = makeSupabase({ fetchData: PUBLISHABLE_INVOICE });
    const before = Date.now();
    await publishAndMarkSent("inv-1");
    const after = Date.now();

    expect(sendInvoicePublishedEmail).not.toHaveBeenCalled();
    const payload = updateChain.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe("pending");
    expect(payload.send_method).toBe("manual");
    // email_attempted_at must NOT be touched — preserves any prior failed-attempt timestamp
    expect(payload).not.toHaveProperty("email_attempted_at");

    const sentAt = new Date(payload.sent_at as string).getTime();
    expect(sentAt).toBeGreaterThanOrEqual(before - 1_000);
    expect(sentAt).toBeLessThanOrEqual(after + 1_000);
  });

  it("logs a marked_as_sent invoice_events row alongside the sent_at update", async () => {
    makeSupabase({ fetchData: PUBLISHABLE_INVOICE });
    await publishAndMarkSent("inv-1");
    expect(logInvoiceEvent).toHaveBeenCalledWith({
      invoiceId: "inv-1",
      userId: "user-1",
      eventType: "marked_as_sent",
    });
  });

  it("with { withDownload: true }, response includes the PDF download URL", async () => {
    makeSupabase({ fetchData: PUBLISHABLE_INVOICE });
    const result = await publishAndMarkSent("inv-1", { withDownload: true });
    expect(result).toEqual({ downloadUrl: "/api/invoices/inv-1/pdf" });
  });

  it("with { withDownload: false } (default), returns no download URL", async () => {
    makeSupabase({ fetchData: PUBLISHABLE_INVOICE });
    const result = await publishAndMarkSent("inv-1");
    expect(result).toBeUndefined();
  });

  it("throws if the BTC address is already used on an active invoice", async () => {
    makeSupabase({
      fetchData: PUBLISHABLE_INVOICE,
      btcConflict: { id: "inv-other", status: "pending" },
    });
    await expect(publishAndMarkSent("inv-1")).rejects.toThrow(/btc_address: This bitcoin address/i);
  });
});

describe("deleteDraft", () => {
  it("deletes an invoice when it is a draft", async () => {
    const { deleteEq } = makeSupabase({
      fetchData: { id: "inv-1", status: "draft", user_id: "user-1" },
    });
    await deleteDraft("inv-1");
    expect(deleteEq).toHaveBeenCalled();
  });

  it("throws if the invoice is not a draft", async () => {
    makeSupabase({
      fetchData: { id: "inv-1", status: "pending", user_id: "user-1" },
    });
    await expect(deleteDraft("inv-1")).rejects.toThrow(/only draft/i);
  });
});

describe("markPaid", () => {
  it("sets status to paid on the invoice", async () => {
    const { updateChain } = makeSupabase({
      fetchData: { id: "inv-1", status: "pending", user_id: "user-1" },
    });
    await markPaid("inv-1");
    const payload = updateChain.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe("paid");
  });

  it("logs a marked_as_paid invoice_events row", async () => {
    makeSupabase({ fetchData: { id: "inv-1", status: "pending", user_id: "user-1" } });
    await markPaid("inv-1");
    expect(logInvoiceEvent).toHaveBeenCalledWith({
      invoiceId: "inv-1",
      userId: "user-1",
      eventType: "marked_as_paid",
    });
  });
});

describe("markUnpaid", () => {
  it("sets status to pending on a paid invoice", async () => {
    const { updateChain } = makeSupabase({
      fetchData: { id: "inv-1", status: "paid", user_id: "user-1" },
    });
    await markUnpaid("inv-1");
    const payload = updateChain.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe("pending");
  });

  it("logs a marked_as_unpaid invoice_events row", async () => {
    makeSupabase({ fetchData: { id: "inv-1", status: "paid", user_id: "user-1" } });
    await markUnpaid("inv-1");
    expect(logInvoiceEvent).toHaveBeenCalledWith({
      invoiceId: "inv-1",
      userId: "user-1",
      eventType: "marked_as_unpaid",
    });
  });
});

describe("markOverdue", () => {
  it("sets status to overdue on a pending invoice", async () => {
    const { updateEq } = makeSupabase({
      fetchData: { id: "inv-1", status: "pending", user_id: "user-1" },
    });
    await markOverdue("inv-1");
    expect(updateEq).toHaveBeenCalled();
  });

  it("logs a marked_as_overdue invoice_events row", async () => {
    makeSupabase({ fetchData: { id: "inv-1", status: "pending", user_id: "user-1" } });
    await markOverdue("inv-1");
    expect(logInvoiceEvent).toHaveBeenCalledWith({
      invoiceId: "inv-1",
      userId: "user-1",
      eventType: "marked_as_overdue",
    });
  });
});

describe("duplicateInvoice", () => {
  const SOURCE_INVOICE = {
    id: "inv-src",
    user_id: "user-1",
    status: "paid",
    invoice_number: "INV-001",
    your_name: "Freelancer",
    your_email: "me@example.com",
    your_company: "My Co",
    your_address: "1 Street",
    your_tax_id: "TAX-1",
    client_name: "Acme",
    client_email: "acme@example.com",
    client_company: "Acme Co",
    client_address: "2 Street",
    client_tax_id: "TAX-2",
    line_items: [{ description: "Work", quantity: 1, unit_price: 1000 }],
    tax_percent: 10,
    tax_fiat: 100,
    subtotal_fiat: 1000,
    total_fiat: 1100,
    currency: "USD",
    accepts_bitcoin: true,
    btc_address: "bc1qtest",
    due_date: "2026-06-01",
    access_code: "LETMEIN1",
    btc_txid: "txid-should-clear",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  };

  it("inserts a new draft invoice with status=draft, cleared btc_address / btc_txid, and preserved access_code", async () => {
    const { insertChain, insertSingle } = makeSupabase({
      fetchData: SOURCE_INVOICE,
      insertData: { id: "inv-new", status: "draft" },
    });

    await duplicateInvoice("inv-src");

    const insertArg = insertChain.mock.calls[0][0];
    expect(insertArg.status).toBe("draft");
    expect(insertArg.access_code).toBe("LETMEIN1");
    expect(insertArg.btc_address).toBeNull();
    expect(insertArg.btc_txid).toBeNull();
    expect(insertArg.user_id).toBe("user-1");
    expect(insertArg.client_name).toBe("Acme");
    expect(insertArg.line_items).toEqual(SOURCE_INVOICE.line_items);
    expect(insertArg).not.toHaveProperty("id");
    expect(insertArg).not.toHaveProperty("created_at");
    expect(insertArg).not.toHaveProperty("updated_at");
    expect(insertSingle).toHaveBeenCalled();
  });

  it('appends " (copy)" to invoice_number when source has one', async () => {
    const { insertChain } = makeSupabase({
      fetchData: { ...SOURCE_INVOICE, invoice_number: "INV-001" },
      insertData: { id: "inv-new" },
    });
    await duplicateInvoice("inv-src");
    expect(insertChain.mock.calls[0][0].invoice_number).toBe("INV-001 (copy)");
  });

  it("leaves invoice_number null when source has no number", async () => {
    const { insertChain } = makeSupabase({
      fetchData: { ...SOURCE_INVOICE, invoice_number: null },
      insertData: { id: "inv-new" },
    });
    await duplicateInvoice("inv-src");
    expect(insertChain.mock.calls[0][0].invoice_number).toBeNull();
  });

  it("redirects to /invoices/[new-id]/edit after creating the draft", async () => {
    makeSupabase({
      fetchData: SOURCE_INVOICE,
      insertData: { id: "inv-new" },
    });
    await duplicateInvoice("inv-src");
    expect(redirect).toHaveBeenCalledWith("/invoices/inv-new/edit");
  });

  it("throws when the invoice belongs to another user", async () => {
    makeSupabase({
      fetchData: { ...SOURCE_INVOICE, user_id: "someone-else" },
    });
    await expect(duplicateInvoice("inv-src")).rejects.toThrow(/not found/i);
  });
});
