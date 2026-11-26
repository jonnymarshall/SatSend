import { describe, it, expect, beforeEach, vi } from "vitest";
import { invoiceListUrl, rememberInvoiceListUrl } from "./list-return";

beforeEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("invoice list return address (R-63)", () => {
  it("is /invoices when nothing is remembered", () => {
    expect(invoiceListUrl()).toBe("/invoices");
  });

  it("returns the list address last shown, page and all", () => {
    rememberInvoiceListUrl("/invoices?page=2");
    expect(invoiceListUrl()).toBe("/invoices?page=2");
  });

  it("the latest list address wins", () => {
    rememberInvoiceListUrl("/invoices?page=2");
    rememberInvoiceListUrl("/invoices");
    expect(invoiceListUrl()).toBe("/invoices");
  });

  it("never returns anything but the list, e.g. an edit page or another site", () => {
    for (const bad of ["/invoices/abc/edit", "//evil.example/invoices", "https://evil.example/invoices", "/invoicesx"]) {
      window.sessionStorage.setItem("satsend:invoice-list-url", bad);
      expect(invoiceListUrl()).toBe("/invoices");
      rememberInvoiceListUrl(bad);
      expect(window.sessionStorage.getItem("satsend:invoice-list-url")).toBe(bad);
    }
  });

  it("still works when the browser blocks storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => rememberInvoiceListUrl("/invoices?page=3")).not.toThrow();
    expect(invoiceListUrl()).toBe("/invoices");
  });
});
