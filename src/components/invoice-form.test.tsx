import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoiceForm } from "./invoice-form";
import { saveDraft } from "@/app/(dashboard)/invoices/actions";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock("@/app/(dashboard)/invoices/actions", () => ({
  saveDraft: vi.fn().mockResolvedValue({ id: "test-id" }),
  updateDraft: vi.fn().mockResolvedValue({}),
  publishInvoice: vi.fn().mockResolvedValue({}),
  publishAndSendEmail: vi.fn().mockResolvedValue({ emailStatus: "sent" }),
  publishAndMarkSent: vi.fn().mockResolvedValue(undefined),
}));

describe("InvoiceForm your_email field", () => {
  it("prefills your_email from sessionEmail and renders it disabled", () => {
    render(<InvoiceForm sessionEmail="owner@example.com" />);
    const input = document.getElementById("input-your-email") as HTMLInputElement;
    expect(input.value).toBe("owner@example.com");
    expect(input.disabled).toBe(true);
  });

  it("ignores initialValues.your_email and uses sessionEmail when both are provided", () => {
    render(
      <InvoiceForm
        sessionEmail="owner@example.com"
        initialValues={{ your_email: "stale@example.com" }}
      />
    );
    const input = document.getElementById("input-your-email") as HTMLInputElement;
    expect(input.value).toBe("owner@example.com");
  });

  it("does not allow typing in the disabled your_email field", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm sessionEmail="owner@example.com" />);
    const input = document.getElementById("input-your-email") as HTMLInputElement;
    await user.type(input, "x");
    expect(input.value).toBe("owner@example.com");
  });
});

describe("InvoiceForm access code", () => {
  it("lowercases access codes as the user types", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm />);
    const input = document.getElementById("input-access-code") as HTMLInputElement;
    await user.type(input, "FoO12");
    expect(input.value).toBe("foo12");
  });

  it("clamps access codes to 16 characters", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm />);
    const input = document.getElementById("input-access-code") as HTMLInputElement;
    await user.type(input, "a".repeat(20));
    expect(input.value).toHaveLength(16);
  });
});

describe("InvoiceForm bitcoin-only (v1.4.14)", () => {
  it("does not render an Accept Bitcoin checkbox", () => {
    render(<InvoiceForm />);
    expect(
      screen.queryByRole("checkbox", { name: /accept bitcoin/i }),
    ).not.toBeInTheDocument();
  });

  it("always renders the BTC address input by default", () => {
    render(<InvoiceForm />);
    expect(screen.getByPlaceholderText(/bc1q/i)).toBeInTheDocument();
  });

  it("saves a draft without a BTC address", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm />);
    await user.click(
      screen.getByRole("button", { name: /save (draft|as draft)/i }),
    );
    expect(saveDraft).toHaveBeenCalledTimes(1);
  });

  it("blocks publish when btc_address is empty and surfaces an error", async () => {
    const { publishInvoice } = await import("@/app/(dashboard)/invoices/actions");
    const user = userEvent.setup();
    render(<InvoiceForm />);
    await user.click(screen.getByRole("button", { name: /^publish/i }));
    await user.click(
      await screen.findByRole("menuitem", { name: /publish only/i }),
    );
    expect(screen.getByText(/btc address.*required/i)).toBeInTheDocument();
    expect(publishInvoice).not.toHaveBeenCalled();
  });
});

describe("InvoiceForm BTC address validation", () => {
  async function choosePublishOnly(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /^publish/i }));
    await user.click(await screen.findByRole("menuitem", { name: /publish only/i }));
  }

  it("shows an error when publishing with an invalid BTC address", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm />);

    const btcInput = screen.getByPlaceholderText(/bc1q/i);
    await user.type(btcInput, "notavalidaddress");
    await choosePublishOnly(user);

    expect(screen.getByText(/invalid btc address/i)).toBeInTheDocument();
  });

  it("does not show a BTC address error when the address is valid", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm />);

    const btcInput = screen.getByPlaceholderText(/bc1q/i);
    await user.type(btcInput, "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq");
    await choosePublishOnly(user);

    expect(screen.queryByText(/invalid btc address/i)).not.toBeInTheDocument();
  });
});

describe("InvoiceForm publish/send menu", () => {
  it("renders a 'Publish' split-button (not the legacy 'Publish invoice' button)", () => {
    render(<InvoiceForm />);
    expect(screen.getByRole("button", { name: /^publish/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publish invoice/i })).not.toBeInTheDocument();
  });

  it("offers all four publish options for a new draft", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm />);
    await user.click(screen.getByRole("button", { name: /^publish/i }));
    expect(await screen.findByRole("menuitem", { name: /send now via email/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /download and mark as sent/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^mark as sent$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /publish only/i })).toBeInTheDocument();
  });

  it("disables 'Send now via email' when no client_email is filled in", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm />);
    await user.click(screen.getByRole("button", { name: /^publish/i }));
    const item = await screen.findByRole("menuitem", { name: /send now via email/i });
    expect(item).toHaveAttribute("data-disabled");
  });
});

describe("InvoiceForm line item validation", () => {
  it("rejects qty values above 100,000", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm />);

    const qtyInput = screen.getByRole("textbox", { name: /qty/i });
    await user.clear(qtyInput);
    await user.type(qtyInput, "100001");

    expect(qtyInput).not.toHaveValue("100001");
  });

  it("accepts qty values at or below 100,000", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm />);

    const qtyInput = screen.getByRole("textbox", { name: /qty/i });
    await user.clear(qtyInput);
    await user.type(qtyInput, "100000");

    expect(qtyInput).toHaveValue("100000");
  });

  it("rejects qty with more than 2 decimal places", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm />);

    const qtyInput = screen.getByRole("textbox", { name: /qty/i });
    await user.clear(qtyInput);
    await user.type(qtyInput, "1.234");

    expect(qtyInput).not.toHaveValue("1.234");
  });

  it("accepts qty with up to 2 decimal places", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm />);

    const qtyInput = screen.getByRole("textbox", { name: /qty/i });
    await user.clear(qtyInput);
    await user.type(qtyInput, "1.25");

    expect(qtyInput).toHaveValue("1.25");
  });

  it("rejects unit price values above 1,000,000,000", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm />);

    const priceInput = screen.getByRole("textbox", { name: /unit price/i });
    await user.clear(priceInput);
    await user.type(priceInput, "1000000001");

    expect(priceInput).not.toHaveValue("1000000001");
  });

  it("accepts unit price values at or below 1,000,000,000", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm />);

    const priceInput = screen.getByRole("textbox", { name: /unit price/i });
    await user.clear(priceInput);
    await user.type(priceInput, "1000000000");

    expect(priceInput).toHaveValue("1000000000");
  });

  it("rejects unit price with more than 2 decimal places", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm />);

    const priceInput = screen.getByRole("textbox", { name: /unit price/i });
    await user.clear(priceInput);
    await user.type(priceInput, "9.999");

    expect(priceInput).not.toHaveValue("9.999");
  });
});

describe("InvoiceForm line-item drag-to-reorder", () => {
  const initialValues = {
    line_items: [
      { description: "Alpha", quantity: 1, unit_price: 10 },
      { description: "Beta", quantity: 2, unit_price: 20 },
      { description: "Gamma", quantity: 3, unit_price: 30 },
    ],
  };

  function focusHandle(rowIndex: number) {
    const handle = document.getElementById(`drag-handle-line-item-${rowIndex}`);
    if (!handle) throw new Error(`drag handle for row ${rowIndex} not found`);
    handle.focus();
    return handle;
  }

  it("reorders line items via keyboard sensor (row 1 above row 0)", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm initialValues={initialValues} />);

    focusHandle(1);
    await user.keyboard("[Space]");
    await user.keyboard("[ArrowUp]");
    await user.keyboard("[Space]");

    const descInputs = document.querySelectorAll<HTMLInputElement>(
      "[id^='input-line-item-'][id$='-description']"
    );
    expect(descInputs[0].value).toBe("Beta");
    expect(descInputs[1].value).toBe("Alpha");
    expect(descInputs[2].value).toBe("Gamma");
  });

  it("persists reordered line items in the saveDraft payload", async () => {
    const user = userEvent.setup();
    vi.mocked(saveDraft).mockClear();
    render(<InvoiceForm initialValues={initialValues} />);

    focusHandle(2);
    await user.keyboard("[Space]");
    await user.keyboard("[ArrowUp]");
    await user.keyboard("[ArrowUp]");
    await user.keyboard("[Space]");

    await user.click(screen.getByRole("button", { name: /save draft/i }));

    expect(saveDraft).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(saveDraft).mock.calls[0][0];
    expect(payload.line_items?.map((i) => i.description)).toEqual(["Gamma", "Alpha", "Beta"]);
  });
});

describe("InvoiceForm — server-error field placement and scroll on save-draft (v1.4.12 hotfix)", () => {
  function fillRequiredAndEnableBitcoin(form: HTMLElement) {
    const btcCheckbox = form.querySelector("#input-accepts-bitcoin") as HTMLInputElement;
    return btcCheckbox;
  }

  it("attaches a 'btc_address:' server error to the BTC address field (not the form-level banner)", async () => {
    const user = userEvent.setup();
    vi.mocked(saveDraft).mockClear();
    vi.mocked(saveDraft).mockRejectedValueOnce(
      new Error("btc_address: This address has already received transactions — use a fresh address for each invoice."),
    );

    render(<InvoiceForm sessionEmail="owner@example.com" />);

    const btcToggle = document.getElementById("input-accepts-bitcoin") as HTMLInputElement;
    await user.click(btcToggle);
    const addressInput = document.getElementById("input-btc-address") as HTMLInputElement;
    await user.type(addressInput, "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq");

    await user.click(screen.getByRole("button", { name: /save draft/i }));

    // The error must render alongside the BTC address field, not in the form-level banner.
    const fieldError = await screen.findByText(/already received transactions/i);
    expect(fieldError).toBeInTheDocument();

    // The form-level banner ('_form' error) must NOT carry this message — i.e. the
    // raw "btc_address: ..." string with prefix must not appear anywhere on the page.
    expect(screen.queryByText(/^btc_address:/)).not.toBeInTheDocument();
  });

  it("scrolls the BTC address field into view when save-draft fails with a btc_address error", async () => {
    const user = userEvent.setup();
    vi.mocked(saveDraft).mockClear();
    vi.mocked(saveDraft).mockRejectedValueOnce(
      new Error("btc_address: This address has already received transactions — use a fresh address for each invoice."),
    );

    render(<InvoiceForm sessionEmail="owner@example.com" />);

    const btcToggle = document.getElementById("input-accepts-bitcoin") as HTMLInputElement;
    await user.click(btcToggle);
    const addressInput = document.getElementById("input-btc-address") as HTMLInputElement;
    await user.type(addressInput, "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq");

    const scrollSpy = vi.spyOn(addressInput, "scrollIntoView");
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await screen.findByText(/already received transactions/i);
    expect(scrollSpy).toHaveBeenCalled();
  });
});
