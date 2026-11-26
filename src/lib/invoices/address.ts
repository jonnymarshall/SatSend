import { countryName } from "@/lib/countries";

/**
 * Structured addresses (v1.7). Each party's address is six optional parts,
 * stored as flat columns (`your_address_line1` ... `client_address_country`)
 * and kept flat in the form and payload too, so a field's name is its column.
 *
 * Every part is optional and nothing is country-specific (Jonny, 2026-11-26),
 * so any address in the world fits. The country is an ISO 3166-1 alpha-2 code,
 * printed as its name.
 */

export const ADDRESS_PARTS = ["line1", "line2", "city", "region", "postcode", "country"] as const;
export type AddressPart = (typeof ADDRESS_PARTS)[number];
export type AddressParty = "your" | "client";
export type AddressKey = `${AddressParty}_address_${AddressPart}`;

/** The longest any free-text part may be (matches the database check). */
export const ADDRESS_PART_MAX = 200;

export function addressKey(party: AddressParty, part: AddressPart): AddressKey {
  return `${party}_address_${part}`;
}

export const ADDRESS_KEYS: AddressKey[] = (["your", "client"] as const).flatMap((party) =>
  ADDRESS_PARTS.map((part) => addressKey(party, part))
);

export type PostalAddress = Partial<Record<AddressPart, string | null>>;

/** Every address field empty: the form's starting values. */
export function emptyAddressValues(): Record<AddressKey, string> {
  return Object.fromEntries(ADDRESS_KEYS.map((k) => [k, ""])) as Record<AddressKey, string>;
}

/** All twelve parts off an invoice row, for the form (missing parts as ""). */
export function addressFormValues(row: Partial<Record<AddressKey, string | null>>): Record<AddressKey, string> {
  return Object.fromEntries(ADDRESS_KEYS.map((k) => [k, row[k] ?? ""])) as Record<AddressKey, string>;
}

/** One party's parts off an invoice row (or form values). */
export function addressOf(row: Partial<Record<AddressKey, string | null>>, party: AddressParty): PostalAddress {
  return Object.fromEntries(ADDRESS_PARTS.map((part) => [part, row[addressKey(party, part)] ?? null]));
}

const clean = (v: string | null | undefined) => (v ?? "").trim();

/** The twelve columns to write: each part trimmed, blanks stored as null. */
export function addressColumns(values: Partial<Record<AddressKey, string | null>>): Record<AddressKey, string | null> {
  return Object.fromEntries(ADDRESS_KEYS.map((k) => [k, clean(values[k]) || null])) as Record<
    AddressKey,
    string | null
  >;
}

/**
 * The address as printed lines, empty parts left out: line 1, line 2, then
 * "City, Region Postcode", then the country's name. Used by the invoice pages
 * and the PDF so they print an address the same way.
 */
export function addressLines(address: PostalAddress): string[] {
  const place = [clean(address.city), clean(address.region)].filter(Boolean).join(", ");
  const locality = [place, clean(address.postcode)].filter(Boolean).join(" ");
  return [clean(address.line1), clean(address.line2), locality, countryName(clean(address.country)) ?? ""].filter(
    Boolean
  );
}
