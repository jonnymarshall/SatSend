import { describe, it, expect } from "vitest";
// @ts-expect-error Lucide's per-icon modules ship no types; read for the drift check only.
import { __iconNode as clock } from "lucide-react/dist/esm/icons/clock.js";
// @ts-expect-error see above
import { __iconNode as circleCheck } from "lucide-react/dist/esm/icons/circle-check.js";
// @ts-expect-error see above
import { __iconNode as triangleAlert } from "lucide-react/dist/esm/icons/triangle-alert.js";
// @ts-expect-error see above
import { __iconNode as circlePlus } from "lucide-react/dist/esm/icons/circle-plus.js";
import { PAYMENT_ICON_NODES } from "./payment-icons";

type Node = [string, Record<string, string>];
const strip = (nodes: Node[]) =>
  nodes.map(([tag, attrs]) => [tag, Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== "key"))]);

describe("PAYMENT_ICON_NODES (v1.5.28)", () => {
  it.each([
    ["payment_detected", clock],
    ["paid", circleCheck],
    ["underpaid", triangleAlert],
    ["overpaid", circlePlus],
  ] as const)("%s matches the Lucide icon the invoice page shows", (state, lucide) => {
    expect(PAYMENT_ICON_NODES[state]).toEqual(strip(lucide as Node[]));
  });
});
