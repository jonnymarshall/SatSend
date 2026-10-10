import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import { Field } from "./field";
import { STATUS_TONES, StatusBadge, type InvoiceStatus } from "./status-badge";

describe("Signal primitives", () => {
  it("StatusBadge covers every app status with a dot and a text label", () => {
    for (const status of Object.keys(STATUS_TONES) as InvoiceStatus[]) {
      const { container, unmount } = render(<StatusBadge status={status} />);
      expect(container.textContent).toBe(STATUS_TONES[status].label);
      expect(container.querySelector("[aria-hidden]")).toBeTruthy();
      unmount();
    }
  });

  it("StatusBadge uses the AA text shade and keeps the bright dot", () => {
    const { container } = render(<StatusBadge status="paid" />);
    const cls = container.firstElementChild!.className;
    expect(cls).toContain("text-(--color-success-text)");
    expect(container.querySelector("[aria-hidden]")!.className).toContain("bg-(--color-success)");
  });

  it("Field sets its ring colour at rest, so focus never animates through another colour", () => {
    render(<Field id="kit-name" label="Name" />);
    const cls = screen.getByLabelText("Name").className;
    expect(cls).toMatch(/(^| )outline-\[rgba\(216,155,36/);
    expect(cls).not.toContain("outline-color");
    expect(cls).toContain("border-(--color-border-strong)");
    expect(cls).toContain("focus-visible:border-(--color-brand-strong)");
  });

  it("Button defaults to a 44px primary and reports loading", () => {
    render(<Button loading>Create invoice</Button>);
    const btn = screen.getByRole("button", { name: "Create invoice" });
    expect(btn.className).toContain("h-11");
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.getAttribute("type")).toBe("button");
  });

  it("Field labels its input and wires error + helper descriptions", () => {
    render(<Field id="kit-email" label="Email" error="Must be a valid email" helper="We send receipts here" />);
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("kit-email--error kit-email--helper");
  });
});
