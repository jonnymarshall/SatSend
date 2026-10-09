import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SatSendLogo } from "./satsend-logo";

describe("SatSendLogo", () => {
  it("is byte-identical to the brand handoff component", () => {
    const root = process.cwd();
    const ours = readFileSync(join(root, "src/components/brand/satsend-logo.tsx"), "utf8");
    const handoff = readFileSync(join(root, "satsend-brand-handoff/SatSendLogo.tsx"), "utf8");
    expect(ours).toBe(handoff);
  });

  it("keeps SatSend and .me in one SVG text flow", () => {
    const { container } = render(<SatSendLogo />);
    expect(screen.getByRole("img", { name: "SatSend" })).toBeTruthy();
    const tspans = container.querySelectorAll("text > tspan");
    expect([...tspans].map((t) => t.textContent)).toEqual(["SatSend", ".me"]);
  });
});
