import { describe, it, expect } from "vitest";
import {
  REFERENCE_LABEL,
  formatReference,
  referencePath,
  publicInvoicePath,
  parseInvoiceKey,
} from "./reference";

// v1.5.31 (roadmap v1.5.2.14-H): the SatSend reference. The database stores the
// bare 8 characters (uppercase Crockford base32); people see "SS-7K3QX9AB" and
// links use "ss-7k3qx9ab". Anything a person types or pastes should still find
// the invoice.

const UUID = "653fe277-ecbb-47d4-9ea7-8a96c76d6494";

describe("the SatSend reference", () => {
  it("has one label, used everywhere", () => {
    expect(REFERENCE_LABEL).toBe("SatSend reference");
  });

  it("is shown uppercase with the SS- prefix", () => {
    expect(formatReference("7K3QX9AB")).toBe("SS-7K3QX9AB");
  });

  it("is lowercase in links", () => {
    expect(referencePath("7K3QX9AB")).toBe("ss-7k3qx9ab");
    expect(publicInvoicePath({ reference: "7K3QX9AB" })).toBe("/invoice/ss-7k3qx9ab");
  });
});

describe("parseInvoiceKey", () => {
  it.each([
    ["ss-7k3qx9ab", "lowercase link form"],
    ["SS-7K3QX9AB", "as printed"],
    ["7K3QX9AB", "without the prefix"],
    ["7k3qx9ab", "lowercase without the prefix"],
    [" SS-7K3QX9AB ", "with spaces around it"],
    ["ss7k3qx9ab", "prefix without the hyphen"],
  ])("finds a reference typed %s (%s)", (input) => {
    expect(parseInvoiceKey(input)).toEqual({ kind: "reference", reference: "7K3QX9AB" });
  });

  it("reads look-alike letters the Crockford way (I and L as 1, O as 0)", () => {
    expect(parseInvoiceKey("SS-7K3QX9AI")).toEqual({ kind: "reference", reference: "7K3QX9A1" });
    expect(parseInvoiceKey("ss-l0o00000")).toEqual({ kind: "reference", reference: "10000000" });
  });

  it("still accepts an old UUID link, in any case", () => {
    expect(parseInvoiceKey(UUID)).toEqual({ kind: "id", id: UUID });
    expect(parseInvoiceKey(UUID.toUpperCase())).toEqual({ kind: "id", id: UUID });
  });

  it.each([
    ["", "empty"],
    ["not-a-uuid", "nonsense"],
    ["SS-7K3QX9A", "too short"],
    ["SS-7K3QX9ABC", "too long"],
    ["SS-7K3QX9AU", "U is not in the alphabet"],
    ["XX-7K3QX9AB", "another prefix"],
    ["SS-7K3Q-X9AB", "a hyphen inside"],
  ])("rejects %s (%s) without a lookup", (input) => {
    expect(parseInvoiceKey(input)).toBeNull();
  });
});
