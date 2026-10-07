import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DashboardLoading from "./(dashboard)/loading";
import InvoiceLoading from "./invoice/[id]/loading";

describe("loading boundaries (v1.4.24-H / H-FE-4)", () => {
  it("dashboard loading renders a status spinner", () => {
    render(<DashboardLoading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
  });

  it("invoice loading renders a status spinner", () => {
    render(<InvoiceLoading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/loading invoice/i)).toBeInTheDocument();
  });
});
