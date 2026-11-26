"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check } from "lucide-react";
import { CURRENCIES, CURRENCY_CODES, type CurrencyCode } from "@/lib/currencies";
import { countryMatches } from "@/lib/countries";
import { inputClassName } from "@/components/signal/input";
import { NO_AUTOFILL } from "@/lib/no-autofill";

/**
 * The invoice's currency (R-44): a searchable list, common currencies first.
 * Typing matches the start of the code or any word of the name ("eur",
 * "euro", "franc"). Always has a value; there's no clear button.
 *
 * Ids: `input-currency`, `input-currency--list`.
 */

type CurrencyItem = { value: CurrencyCode; label: string };

const ITEMS: CurrencyItem[] = CURRENCY_CODES.map((value) => ({ value, label: `${value} — ${CURRENCIES[value]}` }));

export function CurrencyPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (code: CurrencyCode) => void;
  error?: string;
}) {
  const selected = ITEMS.find((c) => c.value === value) ?? null;
  return (
    <div id="currency-field" className="flex flex-col gap-2">
      <label htmlFor="input-currency" className="block text-sm font-medium text-(--color-ink)">
        Currency
      </label>
      <Combobox.Root
        items={ITEMS}
        value={selected}
        onValueChange={(item: CurrencyItem | null) => item && onChange(item.value)}
        itemToStringLabel={(item: CurrencyItem) => item.label}
        filter={(item: CurrencyItem, query: string) => countryMatches(`${item.value} ${CURRENCIES[item.value]}`, query)}
        isItemEqualToValue={(a: CurrencyItem, b: CurrencyItem) => a.value === b.value}
      >
        <div id="input-currency--wrap" className="relative max-w-xs">
          <Combobox.Input
            id="input-currency"
            {...NO_AUTOFILL}
            aria-invalid={error ? true : undefined}
            className={inputClassName}
          />
        </div>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4} className="isolate z-50">
            <Combobox.Popup
              id="input-currency--list"
              className="max-h-[min(var(--available-height),18rem)] w-(--anchor-width) overflow-y-auto rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-1 text-sm text-(--color-ink) shadow-(--shadow-overlay)"
            >
              <Combobox.Empty className="px-3 py-2 text-(--color-text-secondary) empty:hidden">
                No currency matches
              </Combobox.Empty>
              <Combobox.List>
                {(item: CurrencyItem) => (
                  <Combobox.Item
                    key={item.value}
                    value={item}
                    className="flex cursor-pointer items-center gap-2 rounded-(--radius-sm) px-3 py-2 outline-none select-none data-highlighted:bg-(--color-brand-soft)"
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
      {error && <p className="text-sm text-(--color-danger-text)">{error}</p>}
    </div>
  );
}
