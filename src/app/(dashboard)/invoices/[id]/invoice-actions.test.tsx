import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InvoiceActions } from "./invoice-actions";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

vi.mock("../actions", () => ({
  publishInvoice: vi.fn().mockResolvedValue(undefined),
  publishAndSendEmail: vi.fn().mockResolvedValue({ emailStatus: "sent" }),
  publishAndMarkSent: vi.fn().mockResolvedValue(undefined),
  markPaid: vi.fn().mockResolvedValue(undefined),
  markOverdue: vi.fn().mockResolvedValue(undefined),
  markUnpaid: vi.fn().mockResolvedValue(undefined),
  deleteDraft: vi.fn().mockResolvedValue(undefined),
  duplicateInvoice: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../bulk-actions", () => ({
  bulkArchive: vi.fn().mockResolvedValue(undefined),
  bulkUnarchive: vi.fn().mockResolvedValue(undefined),
  bulkDelete: vi.fn().mockResolvedValue(undefined),
}));

import {
  publishInvoice,
  publishAndSendEmail,
  publishAndMarkSent,
  markPaid,
  duplicateInvoice,
  deleteDraft,
} from "../actions";
import { bulkArchive, bulkUnarchive, bulkDelete } from "../bulk-actions";

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
  const draft = { id: "inv-d", status: "draft", client_email: "ada@example.com" };

  it("renders Edit draft, Publish (split-button), Duplicate, Delete buttons", () => {
    render(<InvoiceActions invoice={draft} />);
    expect(screen.getByRole("link", { name: /edit draft/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /publish/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /duplicate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("does not render non-draft-only actions (Mark as menu, View public invoice, Archive, Unarchive)", () => {
    render(<InvoiceActions invoice={draft} />);
    expect(screen.queryByRole("button", { name: /^mark as$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /view public invoice/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^archive$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /unarchive/i })).not.toBeInTheDocument();
  });

  it("calls publishAndSendEmail when 'Send now via email' is chosen from the Publish menu", async () => {
    render(<InvoiceActions invoice={draft} />);
    fireEvent.click(screen.getByRole("button", { name: /publish/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /send now via email/i }));
    await waitFor(() => expect(publishAndSendEmail).toHaveBeenCalledWith("inv-d"));
  });

  it("calls publishInvoice when 'Publish only' is chosen from the Publish menu", async () => {
    render(<InvoiceActions invoice={draft} />);
    fireEvent.click(screen.getByRole("button", { name: /publish/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /publish only/i }));
    await waitFor(() => expect(publishInvoice).toHaveBeenCalledWith("inv-d"));
  });

  it("calls publishAndMarkSent when 'Mark as sent' is chosen from the Publish menu", async () => {
    render(<InvoiceActions invoice={draft} />);
    fireEvent.click(screen.getByRole("button", { name: /publish/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^mark as sent$/i }));
    await waitFor(() => expect(publishAndMarkSent).toHaveBeenCalledWith("inv-d"));
  });

  it("calls duplicateInvoice when Duplicate is clicked", async () => {
    render(<InvoiceActions invoice={draft} />);
    fireEvent.click(screen.getByRole("button", { name: /duplicate/i }));
    await waitFor(() => expect(duplicateInvoice).toHaveBeenCalledWith("inv-d"));
  });

  it("calls deleteDraft when Delete is clicked on a draft", async () => {
    render(<InvoiceActions invoice={draft} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(deleteDraft).toHaveBeenCalledWith("inv-d"));
  });
});

describe("InvoiceActions — v1.4.8 send-via-email gating", () => {
  it("disables 'Send now via email' once email_attempted_at is set (failed prior attempt)", () => {
    const invoice = {
      id: "inv-failed",
      status: "pending",
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
      status: "pending",
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
      status: "pending",
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
      status: "pending",
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
    vi.mocked(publishAndSendEmail).mockResolvedValueOnce({ emailStatus: "failed" });
    const invoice = { id: "inv-fail", status: "draft", client_email: "ada@example.com" };
    render(<InvoiceActions invoice={invoice} />);
    fireEvent.click(screen.getByRole("button", { name: /publish/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /send now via email/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/email delivery failed/i);
  });

  it("shows a queued-for-delivery notice when publishAndSendEmail returns emailStatus='sent'", async () => {
    vi.mocked(publishAndSendEmail).mockResolvedValueOnce({ emailStatus: "sent" });
    const invoice = { id: "inv-ok", status: "draft", client_email: "ada@example.com" };
    render(<InvoiceActions invoice={invoice} />);
    fireEvent.click(screen.getByRole("button", { name: /publish/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /send now via email/i }));
    const status = await screen.findByRole("status");
    expect(status.textContent).toMatch(/queued for delivery to ada@example\.com/i);
  });

  it("hides the Send menu once the invoice has been manually marked sent AND an email has been attempted (failed)", () => {
    const invoice = {
      id: "inv-manual-then-failed",
      status: "pending",
      client_email: "ada@example.com",
      email_attempted_at: "2026-04-28T11:00:00Z",
      sent_at: "2026-04-28T10:00:00Z",
      send_method: "manual" as const,
    };
    render(<InvoiceActions invoice={invoice} />);
    expect(screen.queryByRole("button", { name: /^send$/i })).not.toBeInTheDocument();
  });

  it("shows the Send menu (not gated) when an invoice is published but not yet sent", () => {
    const invoice = {
      id: "inv-unpub",
      status: "pending",
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

  it("renders the 'Sent via email on …' line when send_method='email'", () => {
    const invoice = {
      id: "inv-emailed",
      status: "pending",
      client_email: "ada@example.com",
      email_attempted_at: "2026-04-28T10:00:00Z",
      sent_at: "2026-04-28T10:00:00Z",
      send_method: "email" as const,
    };
    render(<InvoiceActions invoice={invoice} />);
    expect(screen.getByText(/sent via email on/i)).toBeInTheDocument();
  });

  it("renders the 'Marked as sent on …' line when send_method='manual'", () => {
    const invoice = {
      id: "inv-manual2",
      status: "pending",
      client_email: "ada@example.com",
      email_attempted_at: null,
      sent_at: "2026-04-28T10:00:00Z",
      send_method: "manual" as const,
    };
    render(<InvoiceActions invoice={invoice} />);
    expect(screen.getByText(/marked as sent on/i)).toBeInTheDocument();
  });
});

describe("InvoiceActions — pending status", () => {
  const pending = { id: "inv-p", status: "pending" };

  it("renders View public invoice, Mark as menu, Archive, Duplicate, Delete (no Copy public link — already on the Share section)", () => {
    render(<InvoiceActions invoice={pending} />);
    expect(screen.getByRole("link", { name: /view public invoice/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy public link/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^mark as$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /duplicate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("does not render draft-only actions (Edit draft, Mark as sent) or Unarchive", () => {
    render(<InvoiceActions invoice={pending} />);
    expect(screen.queryByRole("link", { name: /edit draft/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark as sent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /unarchive/i })).not.toBeInTheDocument();
  });

  it("View public invoice link points to /invoice/<id> and opens in a new tab", () => {
    render(<InvoiceActions invoice={pending} />);
    const link = screen.getByRole("link", { name: /view public invoice/i });
    expect(link).toHaveAttribute("href", "/invoice/inv-p");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("calls markPaid when Paid is chosen from the Mark as menu", async () => {
    render(<InvoiceActions invoice={pending} />);
    fireEvent.click(screen.getByRole("button", { name: /^mark as$/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^paid$/i }));
    await waitFor(() => expect(markPaid).toHaveBeenCalledWith("inv-p"));
  });

  it("calls bulkArchive when Archive is clicked", async () => {
    render(<InvoiceActions invoice={pending} />);
    fireEvent.click(screen.getByRole("button", { name: /^archive$/i }));
    await waitFor(() => expect(bulkArchive).toHaveBeenCalledWith(["inv-p"]));
  });

  it("calls bulkDelete when Delete is clicked on a non-draft", async () => {
    render(<InvoiceActions invoice={pending} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(bulkDelete).toHaveBeenCalledWith(["inv-p"]));
  });
});

describe("InvoiceActions — archived status", () => {
  const archived = { id: "inv-a", status: "archived" };

  it("renders Unarchive (not Archive) and does not render the Mark as menu", () => {
    render(<InvoiceActions invoice={archived} />);
    expect(screen.getByRole("button", { name: /unarchive/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^archive$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^mark as$/i })).not.toBeInTheDocument();
  });

  it("calls bulkUnarchive when Unarchive is clicked", async () => {
    render(<InvoiceActions invoice={archived} />);
    fireEvent.click(screen.getByRole("button", { name: /unarchive/i }));
    await waitFor(() => expect(bulkUnarchive).toHaveBeenCalledWith(["inv-a"]));
  });

  it("still renders View public invoice, Duplicate, Delete for archived", () => {
    render(<InvoiceActions invoice={archived} />);
    expect(screen.getByRole("link", { name: /view public invoice/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /duplicate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });
});

describe("InvoiceActions — paid status", () => {
  // v1.4.14: Unpaid is gated by payment_confirmation_method.
  const paidManual = {
    id: "inv-paid",
    status: "paid",
    payment_confirmation_method: "manual" as const,
  };
  const paidOnchain = {
    id: "inv-paid",
    status: "paid",
    payment_confirmation_method: "onchain" as const,
  };

  it("Mark as menu hides the Paid item (already paid) and offers Unpaid for manual confirmations", () => {
    render(<InvoiceActions invoice={paidManual} />);
    fireEvent.click(screen.getByRole("button", { name: /^mark as$/i }));
    expect(screen.queryByRole("menuitem", { name: /^paid$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^unpaid$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^overdue$/i })).not.toBeInTheDocument();
  });

  it("Mark as menu hides Unpaid for on-chain confirmations (cannot revert without replacing address)", () => {
    render(<InvoiceActions invoice={paidOnchain} />);
    fireEvent.click(screen.getByRole("button", { name: /^mark as$/i }));
    expect(screen.queryByRole("menuitem", { name: /^unpaid$/i })).not.toBeInTheDocument();
  });

  it("still renders View public invoice, Archive, Duplicate, Delete", () => {
    render(<InvoiceActions invoice={paidManual} />);
    expect(screen.getByRole("link", { name: /view public invoice/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /duplicate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });
});

describe("InvoiceActions — marked_as_paid status (v1.4.14)", () => {
  const markedAsPaid = {
    id: "inv-mp",
    status: "marked_as_paid",
    payment_confirmation_method: "manual" as const,
  };

  it("renders Confirm payment received and Dispute / revert buttons", () => {
    render(<InvoiceActions invoice={markedAsPaid} />);
    expect(
      screen.getByRole("button", { name: /confirm payment received/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dispute \/ revert/i })).toBeInTheDocument();
  });

  it("hides the generic Mark As menu (Confirm/Dispute take over)", () => {
    render(<InvoiceActions invoice={markedAsPaid} />);
    expect(screen.queryByRole("button", { name: /^mark as$/i })).not.toBeInTheDocument();
  });
});
