import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessCodeGate } from "./access-code-gate";

vi.mock("./actions", () => ({
  verifyAccessCode: vi.fn(),
}));

describe("AccessCodeGate access code input", () => {
  it("lowercases characters as the payer types", async () => {
    const user = userEvent.setup();
    render(<AccessCodeGate invoiceKey="abc" />);
    const input = document.getElementById("access_code") as HTMLInputElement;
    await user.type(input, "FoO12");
    expect(input.value).toBe("foo12");
  });

  it("clamps the access code to 16 characters", async () => {
    const user = userEvent.setup();
    render(<AccessCodeGate invoiceKey="abc" />);
    const input = document.getElementById("access_code") as HTMLInputElement;
    await user.type(input, "a".repeat(20));
    expect(input.value).toHaveLength(16);
  });
});
