import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import NotFound from "./not-found";

describe("root not-found boundary (v1.4.24-H / H-FE-4)", () => {
  it("renders a styled not-found message with a home link", () => {
    render(<NotFound />);
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go home/i })).toBeInTheDocument();
  });
});
