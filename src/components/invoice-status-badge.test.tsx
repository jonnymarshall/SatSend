import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceStatusBadge } from "./invoice-status-badge";

describe("InvoiceStatusBadge", () => {
  it("renders an Underpaid label for the underpaid status", () => {
    render(<InvoiceStatusBadge status="underpaid" />);
    expect(screen.getByText("Underpaid")).toBeInTheDocument();
  });
});
