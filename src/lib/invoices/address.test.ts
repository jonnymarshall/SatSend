import { describe, expect, it } from "vitest";
import { ADDRESS_KEYS, addressColumns, addressKey, addressLines, addressOf, emptyAddressValues } from "./address";
import { invoiceSchema } from "./schema";
import { COUNTRIES, countryMatches, countryName, isCountryCode } from "@/lib/countries";

describe("address keys", () => {
  it("names one column per party and part", () => {
    expect(addressKey("your", "line1")).toBe("your_address_line1");
    expect(addressKey("client", "country")).toBe("client_address_country");
    expect(ADDRESS_KEYS).toHaveLength(12);
  });

  it("starts every part empty", () => {
    const empty = emptyAddressValues();
    expect(Object.keys(empty)).toEqual(ADDRESS_KEYS);
    expect(Object.values(empty).every((v) => v === "")).toBe(true);
  });
});

describe("addressLines", () => {
  it("prints a full address in order, with the country's name", () => {
    expect(
      addressLines({
        line1: "221B Baker Street",
        line2: "Flat 2",
        city: "London",
        region: "Greater London",
        postcode: "NW1 6XE",
        country: "GB",
      })
    ).toEqual(["221B Baker Street", "Flat 2", "London, Greater London NW1 6XE", "United Kingdom"]);
  });

  it("skips empty parts, leaving no gaps", () => {
    expect(addressLines({ line1: "1 Queen's Road Central", city: "Central", country: "HK" })).toEqual([
      "1 Queen's Road Central",
      "Central",
      "Hong Kong SAR China",
    ]);
    expect(addressLines({ postcode: "90210" })).toEqual(["90210"]);
  });

  it("treats blank and whitespace parts as empty", () => {
    expect(addressLines({ line1: "  ", line2: "", city: null, country: "" })).toEqual([]);
  });

  it("leaves out an unknown country code rather than printing it", () => {
    expect(addressLines({ line1: "1 Main St", country: "ZZ" })).toEqual(["1 Main St"]);
  });
});

describe("addressOf", () => {
  it("reads one party's parts off an invoice row", () => {
    const row = {
      your_address_line1: "1 Main St",
      your_address_country: "US",
      client_address_line1: "2 High St",
      client_address_city: null,
    };
    expect(addressOf(row, "your")).toMatchObject({ line1: "1 Main St", country: "US" });
    expect(addressOf(row, "client")).toMatchObject({ line1: "2 High St", city: null });
  });
});

describe("countries", () => {
  it("lists current countries by name, with no groupings or retired codes", () => {
    expect(countryName("US")).toBe("United States");
    expect(countryName("XK")).toBe("Kosovo");
    for (const gone of ["EU", "UN", "UK", "SU", "YU", "ZZ"]) expect(isCountryCode(gone)).toBe(false);
    expect(Object.keys(COUNTRIES)).toHaveLength(250);
  });

  it("is sorted by name", () => {
    const names = Object.values(COUNTRIES) as string[];
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  });
});

describe("addressColumns", () => {
  it("trims every part and stores blanks as null", () => {
    const cols = addressColumns({ your_address_line1: "  1 Main St ", your_address_city: "", client_address_country: "GB" });
    expect(cols.your_address_line1).toBe("1 Main St");
    expect(cols.your_address_city).toBeNull();
    expect(cols.client_address_country).toBe("GB");
    expect(Object.keys(cols)).toEqual(ADDRESS_KEYS);
  });
});

describe("invoiceSchema address rules", () => {
  const base = { line_items: [{ description: "x", quantity: 1, unit_price: 1 }], tax_percent: 0 };

  it("accepts any mix of parts, including none", () => {
    expect(invoiceSchema.safeParse(base).success).toBe(true);
    expect(invoiceSchema.safeParse({ ...base, client_address_city: "Central", client_address_country: "HK" }).success).toBe(true);
  });

  it("rejects a country that isn't on the list", () => {
    const r = invoiceSchema.safeParse({ ...base, your_address_country: "XX" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["your_address_country"]);
  });

  it("rejects a part over 200 characters", () => {
    const r = invoiceSchema.safeParse({ ...base, client_address_line1: "a".repeat(201) });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Max 200 characters");
  });
});

describe("countryMatches", () => {
  it("matches the start of any word, ignoring case and accents", () => {
    expect(countryMatches("United Kingdom", "uni")).toBe(true);
    expect(countryMatches("United Kingdom", "kingdom")).toBe(true);
    expect(countryMatches("United Kingdom", "united k")).toBe(true);
    expect(countryMatches("Réunion", "reu")).toBe(true);
    expect(countryMatches("Côte d’Ivoire", "ivo")).toBe(true);
    expect(countryMatches("Tunisia", "uni")).toBe(false);
    expect(countryMatches("Réunion", "uni")).toBe(false);
    expect(countryMatches("France", "")).toBe(true);
  });
});
