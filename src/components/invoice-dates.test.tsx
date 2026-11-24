import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceDates } from "./invoice-dates";

// v1.5.19: the date shown is the day it was first SENT, never the day the draft
// was created. The owner sees "Date Sent"; the client sees "Invoice date".
describe("InvoiceDates", () => {
  it("owner: 'Date Sent:' with the sent date", () => {
    render(<InvoiceDates audience="owner" sentAt="2026-04-15T12:00:00Z" dueDate="2026-05-15" />);
    expect(screen.getByText(/date sent:/i)).toBeInTheDocument();
    expect(screen.getByText(/apr(il)? 15,? 2026/i)).toBeInTheDocument();
  });

  it("client: 'Invoice date:' with the same date, never 'Date Sent'", () => {
    render(<InvoiceDates audience="client" sentAt="2026-04-15T12:00:00Z" dueDate="2026-05-15" />);
    expect(screen.getByText(/invoice date:/i)).toBeInTheDocument();
    expect(screen.queryByText(/date sent/i)).not.toBeInTheDocument();
    expect(screen.getByText(/apr(il)? 15,? 2026/i)).toBeInTheDocument();
  });

  it.each(["owner", "client"] as const)("%s: a draft (not sent) shows no sent or invoice date", (audience) => {
    render(<InvoiceDates audience={audience} sentAt={null} dueDate="2026-05-15" />);
    expect(screen.queryByText(/date sent|invoice date/i)).not.toBeInTheDocument();
    expect(screen.getByText(/date due:/i)).toBeInTheDocument();
  });

  // v1.5.31: the SatSend reference is a row in the same style as the dates.
  it("shows 'SatSend reference:' first, styled like the date rows, when given", () => {
    render(<InvoiceDates audience="client" reference="7K3QX9AB" sentAt="2026-04-15T12:00:00Z" dueDate="2026-05-15" />);
    const rows = document.querySelectorAll("#invoice-dates > p");
    expect(rows[0]).toHaveTextContent("SatSend reference: SS-7K3QX9AB");
    expect(rows[0].id).toBe("invoice-dates--reference");
    expect(rows[0].className).toBe(rows[1].className);
    expect(rows[0].querySelector("span")!.className).toBe(rows[1].querySelector("span")!.className);
  });

  it("shows no reference row when none is given", () => {
    render(<InvoiceDates audience="owner" sentAt={null} dueDate={null} />);
    expect(screen.queryByText(/satsend reference/i)).not.toBeInTheDocument();
  });

  it("shows 'Date Due:' with the date, or 'No due date'", () => {
    const { rerender } = render(<InvoiceDates audience="owner" sentAt={null} dueDate="2026-05-15" />);
    expect(screen.getByText(/may 15,? 2026/i)).toBeInTheDocument();
    rerender(<InvoiceDates audience="owner" sentAt={null} dueDate={null} />);
    expect(screen.getByText(/no due date/i)).toBeInTheDocument();
  });
});
