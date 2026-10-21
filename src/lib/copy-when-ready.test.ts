import { describe, it, expect, vi, afterEach } from "vitest";
import { copyWhenReady } from "./copy-when-ready";

// v1.5.19: "Copy link and mark as sent" only knows the link after the server
// answers. Safari only allows clipboard writes during the click, so the write
// starts on the click with the text still to come (ClipboardItem + promise).
afterEach(() => {
  vi.unstubAllGlobals();
});

function stubClipboard(clipboard: Partial<Clipboard>, ClipboardItemImpl?: unknown) {
  vi.stubGlobal("navigator", { ...navigator, clipboard });
  if (ClipboardItemImpl) vi.stubGlobal("ClipboardItem", ClipboardItemImpl);
  else vi.stubGlobal("ClipboardItem", undefined);
}

describe("copyWhenReady", () => {
  it("starts a ClipboardItem write straight away and fills it with the text later", async () => {
    const written: Array<Record<string, Promise<Blob>>> = [];
    class FakeItem {
      constructor(public data: Record<string, Promise<Blob>>) {
        written.push(data);
      }
    }
    const write = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ write }, FakeItem);

    let resolveText!: (t: string) => void;
    const done = copyWhenReady(new Promise<string>((r) => (resolveText = r)));
    expect(write).toHaveBeenCalledTimes(1); // synchronously, inside the click

    resolveText("https://satsend.me/invoice/abc");
    expect(await done).toBe(true);
    const blob = await written[0]["text/plain"];
    expect(await blob.text()).toBe("https://satsend.me/invoice/abc");
  });

  it("falls back to writeText where ClipboardItem isn't available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    expect(await copyWhenReady(Promise.resolve("link"))).toBe(true);
    expect(writeText).toHaveBeenCalledWith("link");
  });

  it("reports false, without throwing, when there's nothing to copy or the browser refuses", async () => {
    stubClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    expect(await copyWhenReady(Promise.resolve("link"))).toBe(false);
    expect(await copyWhenReady(Promise.resolve(null))).toBe(false);
  });
});

describe("deferredCopy", () => {
  it("copies what's provided later, and nothing when cancelled", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    const { deferredCopy } = await import("./copy-when-ready");

    const a = deferredCopy();
    a.provide("https://satsend.me/invoice/1");
    expect(await a.copied).toBe(true);

    const b = deferredCopy();
    b.provide(null);
    expect(await b.copied).toBe(false);
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});
