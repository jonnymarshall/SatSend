/**
 * Currencies an invoice can be in (R-44, Jonny 2026-11-26). Every one:
 * - has cents (two decimals), which totals and rounding assume;
 * - has a bitcoin price on both Coinbase and CoinGecko (checked 2026-11-26),
 *   so a price lookup never fails just because one source lacks it.
 * Left out for now (roadmap R-62, post-launch): no-cents or three-decimal
 * currencies (JPY, KRW, VND, CLP, HUF, IDR, PKR, MMK, BHD, KWD) and ARS (no
 * Coinbase price). Never offered: RUB (sanctions) and VEF (retired).
 *
 * The database check (migration 0042) lists the same codes; a test keeps the
 * two in step. The first seven are shown at the top of the picker.
 */
export const CURRENCIES = {
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  CAD: "Canadian Dollar",
  AUD: "Australian Dollar",
  NZD: "New Zealand Dollar",
  CHF: "Swiss Franc",
  AED: "UAE Dirham",
  BDT: "Bangladeshi Taka",
  BMD: "Bermudan Dollar",
  BRL: "Brazilian Real",
  CNY: "Chinese Yuan",
  CZK: "Czech Koruna",
  DKK: "Danish Krone",
  GEL: "Georgian Lari",
  HKD: "Hong Kong Dollar",
  INR: "Indian Rupee",
  ILS: "Israeli New Shekel",
  LKR: "Sri Lankan Rupee",
  MYR: "Malaysian Ringgit",
  MXN: "Mexican Peso",
  TWD: "New Taiwan Dollar",
  NGN: "Nigerian Naira",
  NOK: "Norwegian Krone",
  PHP: "Philippine Peso",
  PLN: "Polish Zloty",
  SAR: "Saudi Riyal",
  SGD: "Singapore Dollar",
  ZAR: "South African Rand",
  SEK: "Swedish Krona",
  THB: "Thai Baht",
  TRY: "Turkish Lira",
  UAH: "Ukrainian Hryvnia",
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

/** Shown first in the picker. */
export const COMMON_CURRENCIES: CurrencyCode[] = ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF"];

export const DEFAULT_CURRENCY: CurrencyCode = "USD";

export function isCurrencyCode(code: string): code is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, code);
}

/**
 * An amount in a currency, e.g. "$1,234.50", "€1,234.50", "CA$1,234.50",
 * "CHF 1,234.50". One formatter for every page, email and PDF.
 */
export function formatMoney(amount: number | string | null, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount ?? 0));
}
