import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SatSendLogo } from "./satsend-logo";

describe("SatSendLogo", () => {
  it("is the brand handoff component with only the decided .me spacing change", () => {
    const root = process.cwd();
    const ours = readFileSync(join(root, "src/components/brand/satsend-logo.tsx"), "utf8");
    const handoff = readFileSync(join(root, "satsend-brand-handoff/SatSendLogo.tsx"), "utf8");
    // The one deliberate change (decided 2026-10-09): dx -1.5 -> 1.5, so the gap
    // between "d" and "." equals the gap between "." and "m".
    const expected = handoff
      .replace(
        ' * - The `.me` spacing is intentionally tightened with dx="-1.5".',
        ' * - The `.me` offset is dx="1.5" (handoff: -1.5). Decided 2026-10-09: at -1.5 the\n' +
          ' *   "d" and "." almost touch; 1.5 makes the d-to-dot gap equal the dot-to-m gap.',
      )
      .replace('dx="-1.5"', 'dx="1.5"');
    expect(expected).not.toBe(handoff);
    expect(ours).toBe(expected);
  });

  it("keeps SatSend and .me in one SVG text flow", () => {
    const { container } = render(<SatSendLogo />);
    expect(screen.getByRole("img", { name: "SatSend" })).toBeTruthy();
    const tspans = container.querySelectorAll("text > tspan");
    expect([...tspans].map((t) => t.textContent)).toEqual(["SatSend", ".me"]);
    expect(tspans[1].getAttribute("dx")).toBe("1.5");
  });
});
