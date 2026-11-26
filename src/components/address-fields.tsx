"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, X } from "lucide-react";
import { COUNTRIES, countryMatches, type CountryCode } from "@/lib/countries";
import { addressKey, type AddressKey, type AddressParty, type AddressPart } from "@/lib/invoices/address";
import { inputClassName } from "@/components/signal/input";
import { cn } from "@/lib/utils";
import { NO_AUTOFILL } from "@/lib/no-autofill";

/**
 * One party's address in the invoice form (v1.7): line 1, line 2, city,
 * state/province/region, post code and a searchable country list. Every part
 * is optional and nothing is country-specific, so any address fits.
 *
 * Ids: `input-<party>-address-<part>` (e.g. `input-client-address-city`), inside
 * `<party>-address` (ui-element-ids).
 */

type CountryItem = { value: CountryCode; label: string };

const COUNTRY_ITEMS: CountryItem[] = (Object.entries(COUNTRIES) as [CountryCode, string][]).map(([value, label]) => ({
  value,
  label,
}));

export function addressInputId(key: AddressKey): string {
  return `input-${key.replace(/_/g, "-")}`;
}

const TEXT_PARTS: { part: Exclude<AddressPart, "country">; label: string; autoComplete: string; wide?: boolean }[] = [
  { part: "line1", label: "Address line 1", autoComplete: "address-line1", wide: true },
  { part: "line2", label: "Address line 2", autoComplete: "address-line2", wide: true },
  { part: "city", label: "City", autoComplete: "address-level2" },
  { part: "region", label: "State / province / region", autoComplete: "address-level1" },
  { part: "postcode", label: "Post code", autoComplete: "postal-code" },
];

export function AddressFields({
  party,
  values,
  errors,
  onChange,
}: {
  party: AddressParty;
  values: Record<AddressKey, string>;
  errors: Record<string, string>;
  onChange: (key: AddressKey, value: string) => void;
}) {
  // Autofill only for the user's own address. The client's fields opt out of
  // password managers too: filling them with the user's address is always wrong.
  const fillProps = (autoComplete: string) => (party === "your" ? { autoComplete } : NO_AUTOFILL);
  const countryKey = addressKey(party, "country");
  const countryId = addressInputId(countryKey);
  const selected = COUNTRY_ITEMS.find((c) => c.value === values[countryKey]) ?? null;

  return (
    <fieldset id={`${party}-address`} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <legend className="sr-only">Address</legend>
      {TEXT_PARTS.map(({ part, label, autoComplete, wide }) => {
        const key = addressKey(party, part);
        const id = addressInputId(key);
        return (
          <div key={part} className={cn("flex flex-col gap-2", wide && "sm:col-span-2")}>
            <label htmlFor={id} className="block text-sm font-medium text-(--color-ink)">
              {label}
            </label>
            {/* The wrapper keeps anything a password manager injects next to
                the input (LastPass's icon) out of the column's gap, which
                otherwise pushed the fields below out of line. */}
            <div id={`${id}--wrap`} className="relative">
              <input
                id={id}
                type="text"
                value={values[key]}
                onChange={(e) => onChange(key, e.target.value)}
                {...fillProps(autoComplete)}
                aria-invalid={errors[key] ? true : undefined}
                className={inputClassName}
              />
            </div>
            {errors[key] && <p className="text-sm text-(--color-danger-text)">{errors[key]}</p>}
          </div>
        );
      })}

      <div className="flex flex-col gap-2">
        <label htmlFor={countryId} className="block text-sm font-medium text-(--color-ink)">
          Country
        </label>
        <Combobox.Root
          items={COUNTRY_ITEMS}
          value={selected}
          onValueChange={(item: CountryItem | null) => onChange(countryKey, item?.value ?? "")}
          itemToStringLabel={(item: CountryItem) => item.label}
          filter={(item: CountryItem, query: string) => countryMatches(item.label, query)}
          isItemEqualToValue={(a: CountryItem, b: CountryItem) => a.value === b.value}
        >
          <div id={`${countryId}--wrap`} className="relative">
            <Combobox.Input
              id={countryId}
              {...fillProps("off")}
              aria-invalid={errors[countryKey] ? true : undefined}
              className={cn(inputClassName, "pr-10")}
            />
            {selected && (
              <Combobox.Clear
                id={`${countryId}--clear`}
                aria-label="Clear country"
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-(--radius-sm) text-(--color-text-secondary) hover:text-(--color-ink)"
              >
                <X className="size-4" aria-hidden />
              </Combobox.Clear>
            )}
          </div>
          <Combobox.Portal>
            <Combobox.Positioner sideOffset={4} className="isolate z-50">
              <Combobox.Popup
                id={`${countryId}--list`}
                className="max-h-[min(var(--available-height),18rem)] w-(--anchor-width) overflow-y-auto rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-1 text-sm text-(--color-ink) shadow-(--shadow-overlay)"
              >
                <Combobox.Empty className="px-3 py-2 text-(--color-text-secondary) empty:hidden">
                  No country matches
                </Combobox.Empty>
                <Combobox.List>
                  {(item: CountryItem) => (
                    <Combobox.Item
                      key={item.value}
                      value={item}
                      className="flex cursor-default items-center gap-2 rounded-(--radius-sm) px-3 py-2 outline-none select-none data-highlighted:bg-(--color-brand-soft)"
                    >
                      <span className="flex-1">{item.label}</span>
                      <Combobox.ItemIndicator>
                        <Check className="size-4" aria-hidden />
                      </Combobox.ItemIndicator>
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
        {errors[countryKey] && <p className="text-sm text-(--color-danger-text)">{errors[countryKey]}</p>}
      </div>
    </fieldset>
  );
}
