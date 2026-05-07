import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MarkAsMenu } from "./mark-as-menu";

const onMarkPaid = vi.fn();
const onMarkUnpaid = vi.fn();
const onMarkOverdue = vi.fn();

beforeEach(() => vi.clearAllMocks());

function open() {
  fireEvent.click(screen.getByRole("button", { name: /mark as/i }));
}

function renderMenu(props: {
  status: string;
  dueDate?: string | null;
  invoiceId?: string;
  paymentConfirmationMethod?: "onchain" | "manual" | null;
}) {
  // Default to "manual" so legacy tests that don't care about the gate keep
  // their existing behavior (Unpaid visible for paid invoices). Tests that
  // pass null explicitly must keep null.
  const method =
    "paymentConfirmationMethod" in props ? props.paymentConfirmationMethod ?? null : "manual";
  render(
    <MarkAsMenu
      invoiceId={props.invoiceId ?? "inv-1"}
      status={props.status}
      dueDate={props.dueDate ?? null}
      paymentConfirmationMethod={method}
      onMarkPaid={onMarkPaid}
      onMarkUnpaid={onMarkUnpaid}
      onMarkOverdue={onMarkOverdue}
    />,
  );
}

describe("MarkAsMenu — overdue/pending visibility (the four cases)", () => {
  it("case #3: pending + no due date → shows Paid + Overdue (no Pending; already unpaid)", () => {
    renderMenu({ status: "pending", dueDate: null });
    open();
    expect(screen.getByRole("menuitem", { name: /^paid$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^overdue$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^pending$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^unpaid$/i })).not.toBeInTheDocument();
  });

  it("case #2: pending + future due date → hides Overdue (no manual flip before due date)", () => {
    renderMenu({ status: "pending", dueDate: "2099-12-31" });
    open();
    expect(screen.getByRole("menuitem", { name: /^paid$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^overdue$/i })).not.toBeInTheDocument();
  });

  it("case #1: pending + past due date → hides Overdue (cron auto-flips)", () => {
    renderMenu({ status: "pending", dueDate: "2020-01-01" });
    open();
    expect(screen.queryByRole("menuitem", { name: /^overdue$/i })).not.toBeInTheDocument();
  });

  it("case #4: overdue + no due date → shows Paid + Pending (no Overdue; already overdue)", () => {
    renderMenu({ status: "overdue", dueDate: null });
    open();
    expect(screen.getByRole("menuitem", { name: /^paid$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^pending$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^overdue$/i })).not.toBeInTheDocument();
  });

  it("overdue + future due date → hides Pending (case #4 requires no due date)", () => {
    renderMenu({ status: "overdue", dueDate: "2099-12-31" });
    open();
    expect(screen.queryByRole("menuitem", { name: /^pending$/i })).not.toBeInTheDocument();
  });

  it("payment_detected + no due date: still treated as unpaid → shows Paid + Overdue (case #3 variant)", () => {
    renderMenu({ status: "payment_detected", dueDate: null });
    open();
    expect(screen.getByRole("menuitem", { name: /^paid$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^overdue$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^unpaid$/i })).not.toBeInTheDocument();
  });
});

describe("MarkAsMenu — paid → pending gating by payment_confirmation_method (v1.4.14)", () => {
  it("paid + manual confirmation: shows Unpaid (revert is safe)", () => {
    renderMenu({ status: "paid", paymentConfirmationMethod: "manual" });
    open();
    expect(screen.getByRole("menuitem", { name: /^unpaid$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^paid$/i })).not.toBeInTheDocument();
  });

  it("paid + on-chain confirmation: hides Unpaid (revert would re-detect)", () => {
    renderMenu({ status: "paid", paymentConfirmationMethod: "onchain" });
    open();
    expect(screen.queryByRole("menuitem", { name: /^unpaid$/i })).not.toBeInTheDocument();
  });

  it("paid + null confirmation method (legacy): hides Unpaid (treated as on-chain)", () => {
    renderMenu({ status: "paid", paymentConfirmationMethod: null });
    open();
    expect(screen.queryByRole("menuitem", { name: /^unpaid$/i })).not.toBeInTheDocument();
  });
});

describe("MarkAsMenu — wiring", () => {
  it("invokes the right handler with the invoice id", () => {
    renderMenu({ invoiceId: "inv-99", status: "pending", dueDate: null });
    open();
    fireEvent.click(screen.getByRole("menuitem", { name: /^paid$/i }));
    expect(onMarkPaid).toHaveBeenCalledWith("inv-99");
    expect(onMarkUnpaid).not.toHaveBeenCalled();
    expect(onMarkOverdue).not.toHaveBeenCalled();
  });

  it("Pending item invokes onMarkUnpaid (sets status back to pending)", () => {
    renderMenu({ invoiceId: "inv-99", status: "overdue", dueDate: null });
    open();
    fireEvent.click(screen.getByRole("menuitem", { name: /^pending$/i }));
    expect(onMarkUnpaid).toHaveBeenCalledWith("inv-99");
  });

  it("trigger is disabled when busy is true", () => {
    render(
      <MarkAsMenu
        invoiceId="inv-1"
        status="pending"
        dueDate={null}
        paymentConfirmationMethod={null}
        busy
        onMarkPaid={onMarkPaid}
        onMarkUnpaid={onMarkUnpaid}
        onMarkOverdue={onMarkOverdue}
      />,
    );
    expect(screen.getByRole("button", { name: /mark as/i })).toBeDisabled();
  });
});
