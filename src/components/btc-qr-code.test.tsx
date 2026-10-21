import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

const pending: Array<{ uri: string; resolve: (url: string) => void }> = [];
vi.mock("qrcode", () => ({
  default: {
    toDataURL: (uri: string) => new Promise<string>((resolve) => pending.push({ uri, resolve })),
  },
}));

import { BtcQrCode } from "./btc-qr-code";

describe("BtcQrCode (v1.5.18)", () => {
  it("ignores a late result for a value it no longer shows", async () => {
    const { rerender } = render(<BtcQrCode uri="bitcoin:old" size={120} />);
    rerender(<BtcQrCode uri="bitcoin:new" size={120} />);

    await act(async () => pending.find((p) => p.uri === "bitcoin:new")!.resolve("data:new"));
    await act(async () => pending.find((p) => p.uri === "bitcoin:old")!.resolve("data:old"));

    expect(screen.getByRole("img")).toHaveAttribute("src", "data:new");
  });

  it("does nothing if the result arrives after it's gone", async () => {
    pending.length = 0;
    const { unmount } = render(<BtcQrCode uri="bitcoin:gone" size={120} />);
    unmount();
    await expect(act(async () => pending[0].resolve("data:gone"))).resolves.not.toThrow();
  });
});
