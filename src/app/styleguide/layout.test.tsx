import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { notFound } = vi.hoisted(() => ({ notFound: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    notFound();
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/font/google", () => ({ Onest: () => ({ variable: "font-onest-var" }) }));

import { isUiKitEnabled } from "./kit-flag";
import StyleguideLayout, { metadata } from "./layout";

describe("UI kit gate", () => {
  const original = process.env.SHOW_UI_KIT;
  beforeEach(() => notFound.mockClear());
  afterEach(() => {
    if (original === undefined) delete process.env.SHOW_UI_KIT;
    else process.env.SHOW_UI_KIT = original;
  });

  it("is off unless SHOW_UI_KIT is exactly '1'", () => {
    expect(isUiKitEnabled({})).toBe(false);
    expect(isUiKitEnabled({ SHOW_UI_KIT: "true" })).toBe(false);
    expect(isUiKitEnabled({ SHOW_UI_KIT: "0" })).toBe(false);
    expect(isUiKitEnabled({ SHOW_UI_KIT: "1" })).toBe(true);
  });

  it("404s when the flag is off", () => {
    delete process.env.SHOW_UI_KIT;
    expect(() => StyleguideLayout({ children: null })).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("renders the scoped Signal Amber wrapper when the flag is on", () => {
    process.env.SHOW_UI_KIT = "1";
    const el = StyleguideLayout({ children: null }) as React.ReactElement<{ "data-theme": string; id: string }>;
    expect(notFound).not.toHaveBeenCalled();
    expect(el.props["data-theme"]).toBe("signal-amber");
    expect(el.props.id).toBe("styleguide");
  });

  it("is never indexed", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
