import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InvoiceActions } from "./invoice-actions";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

vi.mock("../actions", () => ({
  publishAndSendEmail: vi.fn().mockResolvedValue({ emailStatus: "sent" }),
  publishAndMarkSent: vi.fn().mockResolvedValue({ ok: true, data: { reference: "7K3QX9AB" } }),
  markPaid: vi.fn().mockResolvedValue(undefined),
  markOverdue: vi.fn().mockResolvedValue(undefined),
  markUnpaid: vi.fn().mockResolvedValue(undefined),
  deleteDraft: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/components/notice", () => ({ showNotice: vi.fn() }));
vi.mock("../bulk-actions", () => ({
  bulkArchive: vi.fn().mockResolvedValue(undefined),
  bulkUnarchive: vi.fn().mockResolvedValue({ unarchived: 1, skipped: 0 }),
  bulkDelete: vi.fn().mockResolvedValue(undefined),
}));

import { showNotice } from "@/components/notice";
import {
  publishAndSendEmail,
  publishAndMarkSent,
  markPaid,
  markUnpaid,
  deleteDraft,
} from "../actions";
import { bulkArchive, bulkUnarchive, bulkDelete } from "../bulk-actions";

// v1.5.41: Mark as, Archive / Unarchive, Duplicate and Delete live in the
// More menu, so the page shows at most three buttons plus More.
function openMore() {
  fireEvent.click(screen.getByRole("button", { name: /^more$/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { origin: "https://example.test" },
  });
});

describe("InvoiceActions — draft status", () => {
  const draft = { id: "inv-d", reference: "7K3QX9AB", btc_address: "tb1q9dx7sdre8fll42wu2aq6zm28c3refs9yst4fdt", status: "draft" as const, client_email: "ada@example.com" };

  it("shows Edit draft, Send and More as buttons, with Duplicate and Delete in More, and no Publish", () => {
    render(<InvoiceActions invoice={draft} />);
    expect(screen.getByRole("link", { name: /edit draft/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^send$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publish/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /duplicate/i })).not.toBeInTheDocument();
    openMore();
    expect(screen.getByRole("menuitem", { name: /duplicate/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
  });

  it("does not offer non-draft-only actions (Mark as, View public invoice, Archive, Unarchive)", () => {
    render(<InvoiceActions invoice={draft} />);
    expect(screen.queryByRole("link", { name: /view public invoice/i })).not.toBeInTheDocument();
    openMore();
    expect(screen.queryByRole("menuitem", { name: /mark as/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^archive$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /unarchive/i })).not.toBeInTheDocument();
  });

  it("calls publishAndSendEmail when 'Send now via email' is chosen from the Send menu", async () => {
    render(<InvoiceActions invoice={draft} />);
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /send now via email/i }));
    await waitFor(() => expect(publishAndSendEmail).toHaveBeenCalledWith("inv-d"));
  });

  it("'Copy link and mark as sent' sends it, copies the client's link and says so (v1.5.19)", async () => {
    render(<InvoiceActions invoice={draft} />);
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /copy link and mark as sent/i }));
    await waitFor(() => expect(publishAndMarkSent).toHaveBeenCalledWith("inv-d"));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://example.test/invoice/ss-7k3qx9ab"),
    );
    await waitFor(() => expect(showNotice).toHaveBeenCalledWith("Link copied"));
  });

  it("if marking as sent fails, nothing is copied (v1.5.19)", async () => {
    vi.mocked(publishAndMarkSent).mockResolvedValueOnce({ ok: false, field: "btc_address", message: "Invalid BTC address" });
    render(<InvoiceActions invoice={draft} />);
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /copy link and mark as sent/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid BTC address");
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(showNotice).not.toHaveBeenCalledWith("Link copied");
  });

  // v1.5.34: Duplicate is a link to a pre-filled New Invoice form; nothing is saved.
  it("Duplicate links to the New Invoice form filled in from this invoice", () => {
    render(<InvoiceActions invoice={draft} />);
    openMore();
    expect(screen.getByRole("menuitem", { name: /duplicate/i })).toHaveAttribute("href", "/invoices/new?from=ss-7k3qx9ab");
  });

  it("calls deleteDraft when Delete is clicked on a draft", async () => {
    render(<InvoiceActions invoice={draft} />);
    openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
    await waitFor(() => expect(deleteDraft).toHaveBeenCalledWith("inv-d"));
  });
});

describe("InvoiceActions — v1.4.8 send-via-email gating", () => {
  it("disables 'Send now via email' once email_attempted_at is set (failed prior attempt)", () => {
    const invoice = {
      id: "inv-failed",
      reference: "7K3QX9AB", btc_address: "tb1q9dx7sdre8fll42wu2aq6zm28c3refs9yst4fdt",
      status: "pending" as const,
      client_email: "ada@example.com",
      email_attempted_at: "2026-04-28T10:00:00Z",
      sent_at: null,
      send_method: null,
    };
    render(<InvoiceActions invoice={invoice} />);
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    const item = screen.getByRole("menuitem", { name: /send now via email/i });
    expect(item).toHaveAttribute("data-disabled");
  });

  it("keeps the Send menu visible after manual mark-as-sent, but with only 'Send now via email' enabled", () => {
    const invoice = {
      id: "inv-manual",
      reference: "7K3QX9AB", btc_address: "tb1q9dx7sdre8fll42wu2aq6zm28c3refs9yst4fdt",
      status: "pending" as const,
      client_email: "ada@example.com",
      email_attempted_at: null,
      sent_at: "2026-04-28T10:00:00Z",
      send_method: "manual" as const,
    };
    render(<InvoiceActions invoice={invoice} />);
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    const item = screen.getByRole("menuitem", { name: /send now via email/i });
    expect(item).not.toHaveAttribute("data-disabled");
    // Manual-side options are now no-ops, hide them.
    expect(screen.queryByRole("menuitem", { name: /download and mark as sent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^mark as sent$/i })).not.toBeInTheDocument();
  });

  it("hides the Send menu once the invoice has been successfully delivered via email", () => {
    const invoice = {
      id: "inv-emailed",
      reference: "7K3QX9AB", btc_address: "tb1q9dx7sdre8fll42wu2aq6zm28c3refs9yst4fdt",
      status: "pending" as const,
      client_email: "ada@example.com",
      email_attempted_at: "2026-04-28T10:00:00Z",
      sent_at: "2026-04-28T10:00:00Z",
      send_method: "email" as const,
    };
    render(<InvoiceActions invoice={invoice} />);
    expect(screen.queryByRole("button", { name: /^send$/i })).not.toBeInTheDocument();
  });

  it("keeps the Send menu visible after manual mark-as-sent EVEN when client_email is empty (Send via email is disabled with tooltip)", () => {
    const invoice = {
      id: "inv-no-email",
      reference: "7K3QX9AB", btc_address: "tb1q9dx7sdre8fll42wu2aq6zm28c3refs9yst4fdt",
      status: "pending" as const,
      client_email: "",
      email_attempted_at: null,
      sent_at: "2026-04-29T10:00:00Z",
      send_method: "manual" as const,
    };
    render(<InvoiceActions invoice={invoice} />);
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    const item = screen.getByRole("menuitem", { name: /send now via email/i });
    expect(item).toHaveAttribute("data-disabled");
  });

  it("shows a failed-email alert banner when publishAndSendEmail returns emailStatus='failed'", async () => {
    vi.mocked(publishAndSendEmail).mockResolvedValueOnce({ ok: true, data: { emailStatus: "failed" } });
    const invoice = { id: "inv-fail", reference: "7K3QX9AB", btc_address: "tb1q9dx7sdre8fll42wu2aq6zm28c3refs9yst4fdt", status: "draft" as const, client_email: "ada@example.com" };
    render(<InvoiceActions invoice={invoice} />);
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /send now via email/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn't be sent/i);
    expect(alert.textContent).toMatch(/still a draft/i);
  });

  it("shows a queued-for-delivery notice when publishAndSendEmail returns emailStatus='sent'", async () => {
    vi.mocked(publishAndSendEmail).mockResolvedValueOnce({ ok: true, data: { emailStatus: "sent" } });
    const invoice = { id: "inv-ok", reference: "7K3QX9AB", btc_address: "tb1q9dx7sdre8fll42wu2aq6zm28c3refs9yst4fdt", status: "draft" as const, client_email: "ada@example.com" };
    render(<InvoiceActions invoice={invoice} />);
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /send now via email/i }));
    const status = await screen.findByRole("status");
    expect(status.textContent).toMatch(/queued for delivery to ada@example\.com/i);
  });

  it("hides the Send menu once the invoice has been manually marked sent AND an email has been attempted (failed)", () => {
    const invoice = {
      id: "inv-manual-then-failed",
      reference: "7K3QX9AB", btc_address: "tb1q9dx7sdre8fll42wu2aq6zm28c3refs9yst4fdt",
      status: "pending" as const,
      client_email: "ada@example.com",
      email_attempted_at: "2026-04-28T11:00:00Z",
      sent_at: "2026-04-28T10:00:00Z",
      send_method: "manual" as const,
    };
    render(<InvoiceActions invoice={invoice} />);
    expect(screen.queryByRole("button", { name: /^send$/i })).not.toBeInTheDocument();
  });

  it("shows the Send menu for an older invoice that went live without being sent (pre-v1.5.19)", () => {
    const invoice = {
      id: "inv-unpub",
      reference: "7K3QX9AB", btc_address: "tb1q9dx7sdre8fll42wu2aq6zm28c3refs9yst4fdt",
      status: "pending" as const,
      client_email: "ada@example.com",
      email_attempted_at: null,
      sent_at: null,
      send_method: null,
    };
    render(<InvoiceActions invoice={invoice} />);
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    const item = screen.getByRole("menuitem", { name: /send now via email/i });
    expect(item).not.toHaveAttribute("data-disabled");
  });

  it("no longer repeats 'Sent via email on …' above the buttons (v1.5.35)", () => {
    const invoice = {
      id: "inv-emailed",
      reference: "7K3QX9AB", btc_address: "tb1q9dx7sdre8fll42wu2aq6zm28c3refs9yst4fdt",
      status: "pending" as const,
      client_email: "ada@example.com",
      email_attempted_at: "2026-04-28T10:00:00Z",
      sent_at: "2026-04-28T10:00:00Z",
      send_method: "email" as const,
    };
    render(<InvoiceActions invoice={invoice} />);
    // v1.5.35 (roadmap v1.4.22): the activity feed's "Invoice sent" entry says
    // this; the line above the buttons repeated it.
    expect(screen.queryByText(/sent via email on/i)).not.toBeInTheDocument();
    expect(document.getElementById("invoice-actions--delivery-status")).toBeNull();
  });

  it("no longer repeats 'Marked as sent on …' above the buttons (v1.5.35)", () => {
    const invoice = {
      id: "inv-manual2",
      reference: "7K3QX9AB", btc_address: "tb1q9dx7sdre8fll42wu2aq6zm28c3refs9yst4fdt",
      status: "pending" as const,
      client_email: "ada@example.com",
      email_attempted_at: null,
      sent_at: "2026-04-28T10:00:00Z",
      send_method: "manual" as const,
    };
    render(<InvoiceActions invoice={invoice} />);
    // v1.5.35: the feed's "Marked as sent" entry says this.
    expect(screen.queryByText(/marked as sent on/i)).not.toBeInTheDocument();
    expect(document.getElementById("invoice-actions--delivery-status")).toBeNull();
  });
});

describe("InvoiceActions — pending status", () => {
  const pending = { id: "inv-p", reference: "7K3QX9AB", btc_address: "tb1q9dx7sdre8fll42wu2aq6zm28c3refs9yst4fdt", status: "pending" as const };

  it("shows View public invoice, Download PDF, Send and More; Mark as, Archive, Duplicate and Delete are in More", () => {
    render(<InvoiceActions invoice={pending} />);
    expect(screen.getByRole("link", { name: /view public invoice/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download pdf/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^send$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy public link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^archive$/i })).not.toBeInTheDocument();
    expect(document.querySelectorAll("#invoice-actions--buttons > *")).toHaveLength(4);
    openMore();
    expect(screen.getByRole("menuitem", { name: /^mark as paid$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^archive$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /duplicate/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
  });

  it("does not offer draft-only actions (Edit draft, Mark as sent) or Unarchive", () => {
    render(<InvoiceActions invoice={pending} />);
    expect(screen.queryByRole("link", { name: /edit draft/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark as sent/i })).not.toBeInTheDocument();
    openMore();
    expect(screen.queryByRole("menuitem", { name: /unarchive/i })).not.toBeInTheDocument();
  });

  it("View public invoice link points to the short link (v1.5.31) and opens in a new tab", () => {
    render(<InvoiceActions invoice={pending} />);
    const link = screen.getByRole("link", { name: /view public invoice/i });
    expect(link).toHaveAttribute("href", "/invoice/ss-7k3qx9ab");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("calls markPaid when Mark as paid is chosen", async () => {
    render(<InvoiceActions invoice={pending} />);
    openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: /^mark as paid$/i }));
    await waitFor(() => expect(markPaid).toHaveBeenCalledWith("inv-p"));
  });

  it("calls markOverdue and markUnpaid for the other choices", async () => {
    render(<InvoiceActions invoice={{ ...pending, status: "overdue" as const }} />);
    openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: /^mark as pending$/i }));
    await waitFor(() => expect(markUnpaid).toHaveBeenCalledWith("inv-p"));
  });

  it("More is disabled while an action runs", async () => {
    vi.mocked(markPaid).mockImplementationOnce(() => new Promise(() => {}));
    render(<InvoiceActions invoice={pending} />);
    openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: /^mark as paid$/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^more$/i })).toBeDisabled());
  });

  it("calls bulkArchive when Archive is clicked", async () => {
    render(<InvoiceActions invoice={pending} />);
    openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: /^archive$/i }));
    await waitFor(() => expect(bulkArchive).toHaveBeenCalledWith(["inv-p"]));
  });

  // v1.5.37 (roadmap v1.4.24): only drafts can be deleted. It used to call
  // bulkDelete, which skipped the invoice, then went back to the list as if
  // it had been deleted.
  it("Delete is greyed out on a non-draft, says why, and does nothing", async () => {
    render(<InvoiceActions invoice={pending} />);
    openMore();
    const del = screen.getByRole("menuitem", { name: /delete/i });
    expect(del).toHaveAttribute("aria-disabled", "true");
    // Shown as a second line (phones have no hover), like the list's menu.
    expect(del).toHaveTextContent("Only drafts can be deleted. You can archive a sent invoice instead.");
    fireEvent.click(del);
    expect(bulkDelete).not.toHaveBeenCalled();
    expect(deleteDraft).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("InvoiceActions — archived status", () => {
  const archived = { id: "inv-a", reference: "7K3QX9AB", btc_address: "tb1q9dx7sdre8fll42wu2aq6zm28c3refs9yst4fdt", status: "archived" as const };

  it("offers Unarchive (not Archive) and no Mark as choices", () => {
    render(<InvoiceActions invoice={archived} />);
    openMore();
    expect(screen.getByRole("menuitem", { name: /unarchive/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^archive$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /mark as/i })).not.toBeInTheDocument();
  });

  it("calls bulkUnarchive when Unarchive is clicked", async () => {
    render(<InvoiceActions invoice={archived} />);
    openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: /unarchive/i }));
    await waitFor(() => expect(bulkUnarchive).toHaveBeenCalledWith(["inv-a"]));
  });

  it("shows an error when Unarchive can't restore (prior status wasn't recorded)", async () => {
    vi.mocked(bulkUnarchive).mockResolvedValueOnce({ unarchived: 0, skipped: 1 });
    render(<InvoiceActions invoice={archived} />);
    openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: /unarchive/i }));
    expect(await screen.findByText(/previous status wasn't recorded/i)).toBeInTheDocument();
  });

  it("still offers View public invoice, Duplicate, Delete for archived", () => {
    render(<InvoiceActions invoice={archived} />);
    expect(screen.getByRole("link", { name: /view public invoice/i })).toBeInTheDocument();
    openMore();
    expect(screen.getByRole("menuitem", { name: /duplicate/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
  });
});

describe("InvoiceActions — paid status", () => {
  const paid = { id: "inv-paid", reference: "7K3QX9AB", btc_address: "tb1q9dx7sdre8fll42wu2aq6zm28c3refs9yst4fdt", status: "paid" as const };

  it("Mark as menu hides the Paid item (already paid) and offers Unpaid", () => {
    // Overdue is no longer offered for paid invoices: per the four-cases spec
    // (v1.4.11), only unpaid statuses are eligible for the manual "Mark as
    // overdue" button. A paid invoice must first be marked Unpaid.
    render(<InvoiceActions invoice={paid} />);
    openMore();
    expect(screen.queryByRole("menuitem", { name: /^mark as paid$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^mark as unpaid$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^mark as overdue$/i })).not.toBeInTheDocument();
  });

  it("still offers View public invoice, Archive, Duplicate, Delete", () => {
    render(<InvoiceActions invoice={paid} />);
    expect(screen.getByRole("link", { name: /view public invoice/i })).toBeInTheDocument();
    openMore();
    expect(screen.getByRole("menuitem", { name: /^archive$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /duplicate/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
  });

  it("paid on the blockchain: no Mark as choices at all (v1.5.27)", () => {
    render(<InvoiceActions invoice={{ ...paid, btc_txid: "abc" }} />);
    openMore();
    expect(screen.queryByRole("menuitem", { name: /mark as/i })).not.toBeInTheDocument();
  });
});
