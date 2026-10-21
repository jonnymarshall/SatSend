import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { NoticeHost, showNotice } from "./notice";

// v1.5.19: a small, self-dismissing confirmation ("Link copied"). Nothing to
// close and nothing blocking.
afterEach(() => {
  vi.useRealTimers();
});

describe("Notice", () => {
  it("shows the message politely to screen readers, then goes away on its own", () => {
    vi.useFakeTimers();
    render(<NoticeHost />);
    act(() => showNotice("Link copied"));
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Link copied");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole("status")).not.toHaveTextContent("Link copied");
  });

  it("a newer message replaces the current one", () => {
    vi.useFakeTimers();
    render(<NoticeHost />);
    act(() => showNotice("First"));
    act(() => showNotice("Second"));
    expect(screen.getByRole("status")).toHaveTextContent("Second");
    expect(screen.getByRole("status")).not.toHaveTextContent("First");
  });
});
