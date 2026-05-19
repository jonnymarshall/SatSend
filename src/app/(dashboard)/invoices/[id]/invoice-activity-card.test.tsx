import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { InvoiceActivityCard } from "./invoice-activity-card";

interface EmailRow {
  id: string;
  email_type: "invoice_published" | "payment_detected" | "payment_confirmed";
  recipient: string;
  status: "queued" | "sent" | "delivered" | "bounced" | "complained" | "failed" | "skipped_no_api_key";
  error_message: string | null;
  created_at: string;
}

interface InvoiceEventRow {
  id: string;
  event_type: "marked_as_sent" | "marked_as_paid" | "marked_as_overdue" | "marked_as_unpaid";
  created_at: string;
}

function mockSupabase({
  emailEvents = [] as EmailRow[],
  invoiceEvents = [] as InvoiceEventRow[],
}) {
  const order = vi.fn((table: "email" | "invoice") => ({
    then: undefined,
  }));
  const fromImpl = vi.fn((table: string) => {
    const data = table === "email_events" ? emailEvents : invoiceEvents;
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data }),
        }),
      }),
    };
  });
  vi.mocked(createClient).mockResolvedValue({
    from: fromImpl,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { fromImpl, order };
}

beforeEach(() => vi.clearAllMocks());

describe("InvoiceActivityCard", () => {
  it("renders the heading 'Activity'", async () => {
    mockSupabase({
      emailEvents: [{
        id: "e1",
        email_type: "invoice_published",
        recipient: "ada@example.com",
        status: "sent",
        error_message: null,
        created_at: "2026-04-15T10:00:00Z",
      }],
    });
    render(await InvoiceActivityCard({ invoiceId: "inv-1" }));
    expect(screen.getByRole("heading", { name: /^activity$/i })).toBeInTheDocument();
  });

  it("renders nothing when there are no events of either kind", async () => {
    mockSupabase({});
    const result = await InvoiceActivityCard({ invoiceId: "inv-1" });
    expect(result).toBeNull();
  });

  it("renders an email event with the recipient", async () => {
    mockSupabase({
      emailEvents: [{
        id: "e1",
        email_type: "invoice_published",
        recipient: "ada@example.com",
        status: "sent",
        error_message: null,
        created_at: "2026-04-15T10:00:00Z",
      }],
    });
    render(await InvoiceActivityCard({ invoiceId: "inv-1" }));
    expect(screen.getByText(/ada@example\.com/i)).toBeInTheDocument();
  });

  it("renders manual event labels for each invoice_events type", async () => {
    mockSupabase({
      invoiceEvents: [
        { id: "i1", event_type: "marked_as_sent", created_at: "2026-04-15T11:00:00Z" },
        { id: "i2", event_type: "marked_as_paid", created_at: "2026-04-15T12:00:00Z" },
        { id: "i3", event_type: "marked_as_overdue", created_at: "2026-04-15T13:00:00Z" },
        { id: "i4", event_type: "marked_as_unpaid", created_at: "2026-04-15T14:00:00Z" },
      ],
    });
    render(await InvoiceActivityCard({ invoiceId: "inv-1" }));
    expect(screen.getByText(/marked as sent/i)).toBeInTheDocument();
    expect(screen.getByText(/marked as paid/i)).toBeInTheDocument();
    expect(screen.getByText(/marked as overdue/i)).toBeInTheDocument();
    expect(screen.getByText(/marked as unpaid/i)).toBeInTheDocument();
  });

  it("merges email and manual events ordered most-recent-first", async () => {
    mockSupabase({
      emailEvents: [{
        id: "e1",
        email_type: "invoice_published",
        recipient: "ada@example.com",
        status: "sent",
        error_message: null,
        created_at: "2026-04-15T10:00:00Z", // oldest
      }],
      invoiceEvents: [
        { id: "i1", event_type: "marked_as_paid", created_at: "2026-04-15T13:00:00Z" }, // newest
        { id: "i2", event_type: "marked_as_sent", created_at: "2026-04-15T12:00:00Z" }, // middle
      ],
    });
    render(await InvoiceActivityCard({ invoiceId: "inv-1" }));

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toMatch(/marked as paid/i);
    expect(items[1].textContent).toMatch(/marked as sent/i);
    expect(items[2].textContent).toMatch(/ada@example\.com/i);
  });

  it("uses distinct icons per event type (Mail / Send / CheckCircle / Clock / AlertCircle)", async () => {
    mockSupabase({
      emailEvents: [
        { id: "e1", email_type: "invoice_published", recipient: "a@x", status: "sent", error_message: null, created_at: "2026-04-15T10:00:00Z" },
        { id: "e2", email_type: "invoice_published", recipient: "b@x", status: "failed", error_message: "boom", created_at: "2026-04-15T10:30:00Z" },
      ],
      invoiceEvents: [
        { id: "i1", event_type: "marked_as_sent", created_at: "2026-04-15T11:00:00Z" },
        { id: "i2", event_type: "marked_as_paid", created_at: "2026-04-15T12:00:00Z" },
        { id: "i3", event_type: "marked_as_overdue", created_at: "2026-04-15T13:00:00Z" },
        { id: "i4", event_type: "marked_as_unpaid", created_at: "2026-04-15T14:00:00Z" },
      ],
    });
    const { container } = render(await InvoiceActivityCard({ invoiceId: "inv-1" }));
    expect(container.querySelector('[data-icon="mail"]')).not.toBeNull();
    expect(container.querySelector('[data-icon="alert-circle"]')).not.toBeNull();
    expect(container.querySelector('[data-icon="send"]')).not.toBeNull();
    expect(container.querySelector('[data-icon="check-circle"]')).not.toBeNull();
    expect(container.querySelector('[data-icon="clock"]')).not.toBeNull();
    expect(container.querySelector('[data-icon="rotate-ccw"]')).not.toBeNull();
  });

  it("appends 'awaiting delivery' to a 'sent' email row (transient state)", async () => {
    mockSupabase({
      emailEvents: [{
        id: "e1",
        email_type: "invoice_published",
        recipient: "ada@example.com",
        status: "sent",
        error_message: null,
        created_at: "2026-04-15T10:00:00Z",
      }],
    });
    render(await InvoiceActivityCard({ invoiceId: "inv-1" }));
    expect(screen.getByText(/awaiting delivery/i)).toBeInTheDocument();
  });

  it("renders a 'delivered' email with the mail-check icon", async () => {
    mockSupabase({
      emailEvents: [{
        id: "e1",
        email_type: "invoice_published",
        recipient: "ada@example.com",
        status: "delivered",
        error_message: null,
        created_at: "2026-04-15T10:00:00Z",
      }],
    });
    const { container } = render(await InvoiceActivityCard({ invoiceId: "inv-1" }));
    expect(screen.getByText(/delivered/i)).toBeInTheDocument();
    expect(container.querySelector('[data-icon="mail-check"]')).not.toBeNull();
    expect(screen.queryByText(/awaiting delivery/i)).toBeNull();
  });

  it("renders a 'bounced' email with the mail-x icon and surfaces the error_message", async () => {
    mockSupabase({
      emailEvents: [{
        id: "e1",
        email_type: "invoice_published",
        recipient: "ada@example.com",
        status: "bounced",
        error_message: "mailbox does not exist",
        created_at: "2026-04-15T10:00:00Z",
      }],
    });
    const { container } = render(await InvoiceActivityCard({ invoiceId: "inv-1" }));
    expect(screen.getByText(/bounced/i)).toBeInTheDocument();
    expect(container.querySelector('[data-icon="mail-x"]')).not.toBeNull();
    expect(screen.getByText(/mailbox does not exist/i)).toBeInTheDocument();
  });

  it("renders a 'complained' email as 'marked as spam' with the mail-warning icon", async () => {
    mockSupabase({
      emailEvents: [{
        id: "e1",
        email_type: "invoice_published",
        recipient: "ada@example.com",
        status: "complained",
        error_message: null,
        created_at: "2026-04-15T10:00:00Z",
      }],
    });
    const { container } = render(await InvoiceActivityCard({ invoiceId: "inv-1" }));
    expect(screen.getByText(/marked as spam/i)).toBeInTheDocument();
    expect(container.querySelector('[data-icon="mail-warning"]')).not.toBeNull();
  });
});
