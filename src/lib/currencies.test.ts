import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CURRENCY_CODES, COMMON_CURRENCIES, formatMoney, isCurrencyCode } from "./currencies";

describe("currencies (R-44)", () => {
  it("matches the database's currency_whitelist exactly", () => {
    const sql = readFileSync("supabase/migrations/0042_multi_currency.sql", "utf8");
    const inList = sql.slice(sql.indexOf("currency in ("), sql.indexOf(")", sql.indexOf("currency in (")));
    const dbCodes = [...inList.matchAll(/'([A-Z]{3})'/g)].map((m) => m[1]);
    expect(dbCodes.sort()).toEqual([...CURRENCY_CODES].sort());
  });

  it("has only currencies with cents", () => {
    for (const code of CURRENCY_CODES) {
      expect(new Intl.NumberFormat("en-US", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits).toBe(2);
    }
  });

  it("leaves out no-cents currencies, the rouble and the retired bolívar", () => {
    for (const code of ["JPY", "KRW", "KWD", "RUB", "VEF", "ARS"]) expect(isCurrencyCode(code)).toBe(false);
  });

  it("lists the common ones first", () => {
    expect(CURRENCY_CODES.slice(0, COMMON_CURRENCIES.length)).toEqual(COMMON_CURRENCIES);
  });

  it("formats amounts with the currency's symbol or code", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(formatMoney(1234.5, "EUR")).toBe("€1,234.50");
    expect(formatMoney("10", "CAD")).toBe("CA$10.00");
    expect(formatMoney(5, "CHF")).toBe("CHF\u00a05.00"); // a non-breaking space
  });
});
