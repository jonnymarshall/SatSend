import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InvoiceDataTable } from "./data-table";
import type { InvoiceRow } from "./columns";

let mockSearchParams = new URLSearchParams();
// router.replace updates mockSearchParams so subsequent renders see the new URL,
// matching real App Router behavior (useSearchParams is reactive to router.replace).
const mockReplace = vi.fn((url: string) => {
  const qIdx = url.indexOf("?");
  mockSearchParams = qIdx >= 0 ? new URLSearchParams(url.slice(qIdx + 1)) : new URLSearchParams();
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, refresh: vi.fn() }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/invoices",
}));
vi.mock("./bulk-actions", () => ({
  bulkArchive: vi.fn().mockResolvedValue({ archived: 1, skipped: 0 }),
  bulkDelete: vi.fn().mockResolvedValue(undefined),
  bulkMarkPaid: vi.fn().mockResolvedValue(undefined),
  bulkUnarchive: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./actions", () => ({
  publishInvoice: vi.fn().mockResolvedValue(undefined),
  publishAndSendEmail: vi.fn().mockResolvedValue({ emailStatus: "sent" }),
  publishAndMarkSent: vi.fn().mockResolvedValue(undefined),
  duplicateInvoice: vi.fn().mockResolvedValue(undefined),
  markOverdue: vi.fn().mockResolvedValue(undefined),
  markUnpaid: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./use-invoice-realtime", () => ({
  useInvoiceRealtime: vi.fn(),
}));

import { bulkArchive, bulkDelete, bulkMarkPaid, bulkUnarchive } from "./bulk-actions";
import { publishInvoice, publishAndSendEmail, publishAndMarkSent, duplicateInvoice, markOverdue, markUnpaid } from "./actions";

const baseRow = {
  client_email: "client@example.com",
  sent_at: null,
  send_method: null,
  email_attempted_at: null,
  last_publish_email_status: null,
  last_publish_email_error: null,
};

const MOCK_INVOICES: InvoiceRow[] = [
  { ...baseRow, id: "inv-1", invoice_number: "INV-001", client_name: "Acme", total_fiat: 1000, currency: "USD", status: "draft", due_date: null, created_at: "2026-04-15T12:00:00Z" },
  // inv-2 covers case #3 (pending, no due date) so the "Mark as overdue" button is available.
  { ...baseRow, id: "inv-2", invoice_number: "INV-002", client_name: "Globex", total_fiat: 500, currency: "USD", status: "pending", due_date: null, created_at: "2026-04-16T12:00:00Z", sent_at: "2026-04-16T12:00:00Z", send_method: "email", email_attempted_at: "2026-04-16T12:00:00Z" },
  { ...baseRow, id: "inv-3", invoice_number: "INV-003", client_name: "Initech", total_fiat: 250, currency: "USD", status: "paid", due_date: null, created_at: "2026-04-17T12:00:00Z", sent_at: "2026-04-17T12:00:00Z", send_method: "email", email_attempted_at: "2026-04-17T12:00:00Z" },
  { ...baseRow, id: "inv-4", invoice_number: "INV-004", client_name: "Umbrella", total_fiat: 750, currency: "USD", status: "archived", due_date: null, created_at: "2026-04-18T12:00:00Z" },
];

const bulkActionsBtn = () => document.getElementById("invoice-data-table--bulk-actions") as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
});

// Build a list of 15 pending invoices so pagination spans 2 pages (default pageSize=10).
const PAGINATED: InvoiceRow[] = Array.from({ length: 15 }, (_, i) => ({
  ...baseRow,
  id: `pg-${String(i + 1).padStart(2, "0")}`,
  invoice_number: `PG-${String(i + 1).padStart(2, "0")}`,
  client_name: `Pager ${String(i + 1).padStart(2, "0")}`,
  total_fiat: 100,
  currency: "USD",
  status: "pending" as const,
  due_date: null,
  created_at: `2026-04-${String((i % 28) + 1).padStart(2, "0")}T12:00:00Z`,
  sent_at: "2026-04-15T12:00:00Z",
  send_method: "email" as const,
  email_attempted_at: "2026-04-15T12:00:00Z",
}));

describe("InvoiceDataTable — structure", () => {
  it("renders column headers: Invoice, Client, Date Sent, Date Due, Amount, Status", () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    expect(screen.getByRole("button", { name: /^invoice/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^client/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /date sent/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /date due/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^amount/i })).toBeInTheDocument();
    expect(screen.getByText(/^status$/i)).toBeInTheDocument();
  });

  it("hides archived invoices by default", () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    expect(screen.queryByText("Umbrella")).not.toBeInTheDocument();
  });

  it("shows 'X of N invoices selected' footer", () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    expect(screen.getByText(/0 of 3 invoices selected/)).toBeInTheDocument();
  });

  it("disables the bulk actions button when no rows are selected", () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    expect(bulkActionsBtn()).toBeDisabled();
  });
});

describe("InvoiceDataTable — filtering", () => {
  it("filters rows by invoice number", () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    fireEvent.change(screen.getByPlaceholderText(/filter by invoice/i), {
      target: { value: "INV-002" },
    });
    expect(screen.getByText("Globex")).toBeInTheDocument();
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
  });

  it("filters rows by client name", () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    fireEvent.change(screen.getByPlaceholderText(/filter by invoice/i), {
      target: { value: "Acme" },
    });
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.queryByText("Globex")).not.toBeInTheDocument();
  });
});

describe("InvoiceDataTable — clear selected", () => {
  it("does not render the 'Clear selected' button when no rows are selected", () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    expect(screen.queryByRole("button", { name: /clear selected/i })).not.toBeInTheDocument();
  });

  it("renders the 'Clear selected' button once a row is selected", () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const rowCheckboxes = screen.getAllByRole("checkbox", { name: /select row/i });
    fireEvent.click(rowCheckboxes[0]);
    expect(screen.getByRole("button", { name: /clear selected/i })).toBeInTheDocument();
  });

  it("clears row selection when clicked and preserves filter and archive-toggle state", () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const filterInput = screen.getByPlaceholderText(/filter by invoice/i) as HTMLInputElement;
    fireEvent.change(filterInput, { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: /show archived/i }));
    const rowCheckboxes = screen.getAllByRole("checkbox", { name: /select row/i });
    fireEvent.click(rowCheckboxes[0]);
    // After selection: bulk actions button should be enabled and Clear selected visible
    expect(bulkActionsBtn()).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /clear selected/i }));
    // After clearing: bulk actions disabled again, button gone
    expect(bulkActionsBtn()).toBeDisabled();
    expect(screen.queryByRole("button", { name: /clear selected/i })).not.toBeInTheDocument();
    // filter preserved
    expect(filterInput.value).toBe("Acme");
    // archive toggle preserved (button now reads "Hide archived")
    expect(screen.getByRole("button", { name: /hide archived/i })).toBeInTheDocument();
  });
});

describe("InvoiceDataTable — archive toggle", () => {
  it("reveals archived invoices when toggled", () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: /show archived/i }));
    expect(screen.getByText("Umbrella")).toBeInTheDocument();
  });
});

describe("InvoiceDataTable — archive feedback", () => {
  it("shows a feedback message when some selected rows could not be archived", async () => {
    vi.mocked(bulkArchive).mockResolvedValueOnce({ archived: 1, skipped: 1 });
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const rowCheckboxes = screen.getAllByRole("checkbox", { name: /select row/i });
    fireEvent.click(rowCheckboxes[0]); // draft (will be skipped)
    fireEvent.click(rowCheckboxes[1]); // pending (will be archived)
    fireEvent.click(bulkActionsBtn());
    fireEvent.click(screen.getByRole("menuitem", { name: /archive/i }));
    expect(await screen.findByText(/archived 1.*skipped 1/i)).toBeInTheDocument();
  });

  it("does not show a feedback message when nothing was skipped", async () => {
    vi.mocked(bulkArchive).mockResolvedValueOnce({ archived: 1, skipped: 0 });
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const rowCheckboxes = screen.getAllByRole("checkbox", { name: /select row/i });
    fireEvent.click(rowCheckboxes[1]); // pending
    fireEvent.click(bulkActionsBtn());
    fireEvent.click(screen.getByRole("menuitem", { name: /archive/i }));
    await waitFor(() => expect(bulkArchive).toHaveBeenCalled());
    expect(screen.queryByText(/skipped/i)).not.toBeInTheDocument();
  });
});

describe("InvoiceDataTable — bulk actions", () => {
  it("calls bulkMarkPaid with selected ids", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const rowCheckboxes = screen.getAllByRole("checkbox", { name: /select row/i });
    fireEvent.click(rowCheckboxes[1]); // inv-2
    fireEvent.click(bulkActionsBtn());
    fireEvent.click(screen.getByRole("menuitem", { name: /mark as paid/i }));
    await waitFor(() => expect(bulkMarkPaid).toHaveBeenCalledWith(["inv-2"]));
  });

  it("calls bulkArchive with selected ids", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const rowCheckboxes = screen.getAllByRole("checkbox", { name: /select row/i });
    fireEvent.click(rowCheckboxes[0]); // inv-1
    fireEvent.click(bulkActionsBtn());
    fireEvent.click(screen.getByRole("menuitem", { name: /archive/i }));
    await waitFor(() => expect(bulkArchive).toHaveBeenCalledWith(["inv-1"]));
  });

  it("opens confirmation dialog before calling bulkDelete", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const rowCheckboxes = screen.getAllByRole("checkbox", { name: /select row/i });
    fireEvent.click(rowCheckboxes[0]);
    fireEvent.click(bulkActionsBtn());
    fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
    expect(bulkDelete).not.toHaveBeenCalled();
    // AlertDialog title shows the count
    expect(await screen.findByText(/delete 1 invoice\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(bulkDelete).toHaveBeenCalledWith(["inv-1"]));
  });
});

describe("InvoiceDataTable — per-row actions", () => {
  it("shows 'Edit' and the four publish/send options for draft invoices", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    // open first row's dropdown (inv-1 is a draft)
    const openMenuButtons = screen.getAllByRole("button", { name: /open menu/i });
    fireEvent.click(openMenuButtons[0]);
    expect(await screen.findByRole("menuitem", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /send now via email/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /download and mark as sent/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^mark as sent$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /publish only/i })).toBeInTheDocument();
  });

  it("shows 'View public invoice' and 'Copy public link' for non-draft invoices", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    // second row is pending (inv-2)
    const openMenuButtons = screen.getAllByRole("button", { name: /open menu/i });
    fireEvent.click(openMenuButtons[1]);
    expect(await screen.findByRole("menuitem", { name: /view public invoice/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /copy public link/i })).toBeInTheDocument();
  });

  it("shows 'Duplicate' on every row (no placeholder flag)", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const openMenuButtons = screen.getAllByRole("button", { name: /open menu/i });
    fireEvent.click(openMenuButtons[0]);
    const item = await screen.findByRole("menuitem", { name: /duplicate/i });
    expect(item).toBeInTheDocument();
    expect(item.textContent).not.toMatch(/🚩/);
  });

  it("calls publishAndSendEmail when 'Send now via email' is clicked on a draft", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const openMenuButtons = screen.getAllByRole("button", { name: /open menu/i });
    fireEvent.click(openMenuButtons[0]); // inv-1 draft
    fireEvent.click(await screen.findByRole("menuitem", { name: /send now via email/i }));
    await waitFor(() => expect(publishAndSendEmail).toHaveBeenCalledWith("inv-1"));
  });

  it("calls publishInvoice when 'Publish only' is clicked on a draft", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const openMenuButtons = screen.getAllByRole("button", { name: /open menu/i });
    fireEvent.click(openMenuButtons[0]);
    fireEvent.click(await screen.findByRole("menuitem", { name: /publish only/i }));
    await waitFor(() => expect(publishInvoice).toHaveBeenCalledWith("inv-1"));
  });

  it("calls publishAndMarkSent when 'Mark as sent' is clicked on a draft", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const openMenuButtons = screen.getAllByRole("button", { name: /open menu/i });
    fireEvent.click(openMenuButtons[0]);
    fireEvent.click(await screen.findByRole("menuitem", { name: /^mark as sent$/i }));
    await waitFor(() => expect(publishAndMarkSent).toHaveBeenCalledWith("inv-1"));
  });

  it("calls duplicateInvoice when 'Duplicate' is clicked", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const openMenuButtons = screen.getAllByRole("button", { name: /open menu/i });
    fireEvent.click(openMenuButtons[1]); // inv-2 pending
    fireEvent.click(await screen.findByRole("menuitem", { name: /duplicate/i }));
    await waitFor(() => expect(duplicateInvoice).toHaveBeenCalledWith("inv-2"));
  });

  it("hides the publish/send menu items only on rows successfully delivered via email", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const openMenuButtons = screen.getAllByRole("button", { name: /open menu/i });
    fireEvent.click(openMenuButtons[1]); // inv-2 pending, already sent via email
    expect(await screen.findByRole("menuitem", { name: /^mark as paid$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /send now via email/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^mark as sent$/i })).not.toBeInTheDocument();
  });

  it("on a manually-marked-sent row, only 'Send now via email' is reachable from the publish/send group", async () => {
    const data: InvoiceRow[] = [
      {
        ...baseRow,
        id: "inv-manual",
        invoice_number: "INV-M",
        client_name: "Manual Co",
        total_fiat: 100,
        currency: "USD",
        status: "pending",
        due_date: null,
        created_at: "2026-04-19T12:00:00Z",
        sent_at: "2026-04-19T13:00:00Z",
        send_method: "manual",
        email_attempted_at: null,
      },
    ];
    render(<InvoiceDataTable data={data} userId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));

    const item = await screen.findByRole("menuitem", { name: /send now via email/i });
    expect(item).not.toHaveAttribute("data-disabled");
    expect(screen.queryByRole("menuitem", { name: /download and mark as sent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^mark as sent$/i })).not.toBeInTheDocument();
  });

  it("renders the email-sent indicator next to the status badge for emailed rows (inv-2 and inv-3)", () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    expect(screen.getAllByLabelText(/sent via email/i)).toHaveLength(2);
  });

  it("does not show 'Archive' on draft rows", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const openMenuButtons = screen.getAllByRole("button", { name: /open menu/i });
    fireEvent.click(openMenuButtons[0]); // inv-1 draft
    // the dropdown is open; confirm neither Archive nor Unarchive is present for drafts
    expect(await screen.findByRole("menuitem", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^archive$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^unarchive$/i })).not.toBeInTheDocument();
  });

  it("shows 'Unarchive' (not 'Archive') on archived rows", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: /show archived/i }));
    // archived row (inv-4) is now the 4th row (index 3)
    const openMenuButtons = screen.getAllByRole("button", { name: /open menu/i });
    fireEvent.click(openMenuButtons[3]);
    expect(await screen.findByRole("menuitem", { name: /^unarchive$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^archive$/i })).not.toBeInTheDocument();
  });

  it("calls bulkUnarchive when 'Unarchive' is clicked on an archived row", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: /show archived/i }));
    const openMenuButtons = screen.getAllByRole("button", { name: /open menu/i });
    fireEvent.click(openMenuButtons[3]); // inv-4 archived
    fireEvent.click(await screen.findByRole("menuitem", { name: /^unarchive$/i }));
    await waitFor(() => expect(bulkUnarchive).toHaveBeenCalledWith(["inv-4"]));
  });

  it("shows 'Download PDF' on non-draft rows wired to the PDF endpoint", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const openMenuButtons = screen.getAllByRole("button", { name: /open menu/i });
    fireEvent.click(openMenuButtons[1]); // inv-2 pending
    const item = await screen.findByRole("menuitem", { name: /download pdf/i });
    expect(item).toBeInTheDocument();
    const link = item.closest("a") ?? item.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe("/api/invoices/inv-2/pdf");
    expect(link!.hasAttribute("download")).toBe(true);
  });

  it("does not show 'Download PDF' on draft rows", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const openMenuButtons = screen.getAllByRole("button", { name: /open menu/i });
    fireEvent.click(openMenuButtons[0]); // inv-1 draft
    expect(await screen.findByRole("menuitem", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /download pdf/i })).not.toBeInTheDocument();
  });

  it("renders an email-failed indicator next to the status badge for rows whose last invoice_published email_event is failed", () => {
    const data: InvoiceRow[] = [
      {
        ...baseRow,
        id: "inv-failed",
        invoice_number: "INV-F",
        client_name: "Failed Co",
        total_fiat: 100,
        currency: "USD",
        status: "pending",
        due_date: null,
        created_at: "2026-04-19T12:00:00Z",
        sent_at: null,
        send_method: null,
        email_attempted_at: "2026-04-19T12:00:00Z",
        last_publish_email_status: "failed",
        last_publish_email_error: "Resend bounce",
      },
    ];
    render(<InvoiceDataTable data={data} userId="u1" />);
    expect(screen.getByLabelText(/email failed to send to this client/i)).toBeInTheDocument();
  });

  it("does not render the email-failed indicator on rows whose last publish email succeeded", () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    expect(screen.queryByLabelText(/email failed to send to this client/i)).not.toBeInTheDocument();
  });

  it("shows only the email-failed indicator (not the sent-via-email icon) on a row that was sent via email but the email failed", () => {
    const data: InvoiceRow[] = [
      {
        ...baseRow,
        id: "inv-failed-email",
        invoice_number: "INV-FE",
        client_name: "Failed Email Co",
        total_fiat: 100,
        currency: "USD",
        status: "pending",
        due_date: null,
        created_at: "2026-04-19T12:00:00Z",
        sent_at: "2026-04-19T12:00:00Z",
        send_method: "email",
        email_attempted_at: "2026-04-19T12:00:00Z",
        last_publish_email_status: "failed",
        last_publish_email_error: "Resend bounce",
      },
    ];
    render(<InvoiceDataTable data={data} userId="u1" />);
    expect(screen.getByLabelText(/email failed to send to this client/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/sent via email/i)).not.toBeInTheDocument();
  });

  it("shows 'Mark as overdue' on pending rows and calls markOverdue when clicked", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const openMenuButtons = screen.getAllByRole("button", { name: /open menu/i });
    fireEvent.click(openMenuButtons[1]); // inv-2 pending
    fireEvent.click(await screen.findByRole("menuitem", { name: /mark as overdue/i }));
    await waitFor(() => expect(markOverdue).toHaveBeenCalledWith("inv-2"));
  });

  it("does not show 'Mark as overdue' on draft rows", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const openMenuButtons = screen.getAllByRole("button", { name: /open menu/i });
    fireEvent.click(openMenuButtons[0]); // inv-1 draft
    expect(await screen.findByRole("menuitem", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /mark as overdue/i })).not.toBeInTheDocument();
  });

  it("does not show 'Mark as overdue' on paid rows", async () => {
    render(<InvoiceDataTable data={MOCK_INVOICES} userId="u1" />);
    const openMenuButtons = screen.getAllByRole("button", { name: /open menu/i });
    fireEvent.click(openMenuButtons[2]); // inv-3 paid
    // ensure menu actually opened
    expect(await screen.findByRole("menuitem", { name: /view public invoice/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /mark as overdue/i })).not.toBeInTheDocument();
  });
});

describe("InvoiceDataTable — overdue/pending row dropdown (cases #2, #3, #4)", () => {
  it("case #2: pending + future due date → hides 'Mark as overdue'", async () => {
    const data: InvoiceRow[] = [
      { ...baseRow, id: "inv-future", invoice_number: "INV-FUT", client_name: "Future Co", total_fiat: 100, currency: "USD", status: "pending", due_date: "2099-12-31", created_at: "2026-04-20T12:00:00Z" },
    ];
    render(<InvoiceDataTable data={data} userId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    expect(await screen.findByRole("menuitem", { name: /view public invoice/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /mark as overdue/i })).not.toBeInTheDocument();
  });

  it("case #4: overdue + no due date → shows 'Mark as pending' and calls markUnpaid", async () => {
    const data: InvoiceRow[] = [
      { ...baseRow, id: "inv-od", invoice_number: "INV-OD", client_name: "Late Co", total_fiat: 100, currency: "USD", status: "overdue", due_date: null, created_at: "2026-04-20T12:00:00Z" },
    ];
    render(<InvoiceDataTable data={data} userId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /mark as pending/i }));
    await waitFor(() => expect(markUnpaid).toHaveBeenCalledWith("inv-od"));
  });

  it("overdue + past due date → hides 'Mark as pending' (cron would re-flip)", async () => {
    const data: InvoiceRow[] = [
      { ...baseRow, id: "inv-od2", invoice_number: "INV-OD2", client_name: "Late Co", total_fiat: 100, currency: "USD", status: "overdue", due_date: "2020-01-01", created_at: "2026-04-20T12:00:00Z" },
    ];
    render(<InvoiceDataTable data={data} userId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    expect(await screen.findByRole("menuitem", { name: /view public invoice/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /mark as pending/i })).not.toBeInTheDocument();
  });
});

describe("InvoiceDataTable — pagination URL state", () => {
  it("starts on page 2 when ?page=2 is in the URL", () => {
    mockSearchParams = new URLSearchParams("page=2");
    render(<InvoiceDataTable data={PAGINATED} userId="u1" />);
    // Page 1 rows (PG-01..PG-10) hidden; page 2 rows (PG-11..PG-15) visible.
    expect(screen.queryByText("PG-01")).not.toBeInTheDocument();
    expect(screen.getByText("PG-11")).toBeInTheDocument();
    expect(screen.getByText("PG-15")).toBeInTheDocument();
  });

  it("clicking 'Next' pushes ?page=2 into the URL via router.replace", () => {
    render(<InvoiceDataTable data={PAGINATED} userId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    expect(mockReplace).toHaveBeenCalledWith("/invoices?page=2", { scroll: false });
  });

  it("clicking 'Previous' from page 2 strips the ?page= param entirely", () => {
    mockSearchParams = new URLSearchParams("page=2");
    render(<InvoiceDataTable data={PAGINATED} userId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: /^previous$/i }));
    expect(mockReplace).toHaveBeenCalledWith("/invoices", { scroll: false });
  });

  it.each(["foo", "0", "-1", ""])("treats invalid ?page=%s as page 1", (raw) => {
    mockSearchParams = new URLSearchParams(`page=${raw}`);
    render(<InvoiceDataTable data={PAGINATED} userId="u1" />);
    // Page 1 visible: PG-01 present, PG-11 (page 2 only) absent.
    expect(screen.getByText("PG-01")).toBeInTheDocument();
    expect(screen.queryByText("PG-11")).not.toBeInTheDocument();
  });

  it("clamps ?page= beyond last page to the last available page", () => {
    // 15 rows, pageSize 10 → last page is index 1 (page 2). ?page=99 should land on the last page.
    mockSearchParams = new URLSearchParams("page=99");
    render(<InvoiceDataTable data={PAGINATED} userId="u1" />);
    expect(screen.getByText("PG-11")).toBeInTheDocument();
    expect(screen.queryByText("PG-01")).not.toBeInTheDocument();
  });

  it("does not loop router.replace calls (regression: clamp + URL sync feedback loop)", async () => {
    // When ?page=99 triggers a clamp, the URL sync effect fires once to write the corrected
    // ?page=2. It must not fire a second time. Past bug: searchParams in deps caused a feedback
    // loop where every router.replace triggered another effect run.
    mockSearchParams = new URLSearchParams("page=99");
    render(<InvoiceDataTable data={PAGINATED} userId="u1" />);
    // Give effects a beat to settle.
    await new Promise((r) => setTimeout(r, 50));
    // Clamp: router.replace called exactly once with the corrected URL.
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/invoices?page=2", { scroll: false });
  });

  it("does not write to URL on initial mount when state already matches the URL", async () => {
    // Mounting with ?page=2 and parsing pageIndex=1 should be a no-op for URL writes —
    // the state already matches the URL, so the sync effect must not fire.
    mockSearchParams = new URLSearchParams("page=2");
    render(<InvoiceDataTable data={PAGINATED} userId="u1" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("preserves pageIndex when the data prop reference changes (regression: TanStack autoResetPageIndex)", async () => {
    // Real-world failure: clicking Next calls router.replace, which triggers an App
    // Router server re-fetch, which passes a NEW data array reference back to the
    // table. TanStack defaults autoResetPageIndex=true, which would silently reset
    // pageIndex to 0, snapping the user back to page 1. The fix is to disable
    // autoResetPageIndex.
    mockSearchParams = new URLSearchParams("page=2");
    const { rerender } = render(<InvoiceDataTable data={PAGINATED} userId="u1" />);
    expect(screen.getByText("PG-11")).toBeInTheDocument();
    // Simulate the server re-fetch handing us a fresh array with the same content.
    rerender(<InvoiceDataTable data={[...PAGINATED]} userId="u1" />);
    expect(screen.getByText("PG-11")).toBeInTheDocument();
    expect(screen.queryByText("PG-01")).not.toBeInTheDocument();
  });
});
