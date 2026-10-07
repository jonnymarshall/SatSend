import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ErrorBoundary from "./error";

describe("root error boundary (v1.4.24-H / H-FE-4)", () => {
  it("renders a friendly message and calls reset when Try again is clicked", () => {
    const reset = vi.fn();
    render(<ErrorBoundary error={new Error("boom")} reset={reset} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
