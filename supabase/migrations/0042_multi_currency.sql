-- R-44 — Multi-currency (release 1.6.0).
--
-- Widens currency_whitelist (0027: USD only) to the 33 currencies in
-- src/lib/currencies.ts (a test keeps the two lists in step). Widening only:
-- every existing row is USD, and the code running before this release only
-- writes USD, so it's safe to apply ahead of the merge.
--
-- Drop and re-add: Postgres can't alter a CHECK in place. NOT VALID then
-- VALIDATE (migration-safety), so an unexpected row fails loudly.

alter table public.invoices drop constraint if exists currency_whitelist;

alter table public.invoices add constraint currency_whitelist check (
  currency in (
    'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF',
    'AED', 'BDT', 'BMD', 'BRL', 'CNY', 'CZK', 'DKK', 'GEL', 'HKD', 'INR',
    'ILS', 'LKR', 'MYR', 'MXN', 'TWD', 'NGN', 'NOK', 'PHP', 'PLN', 'SAR',
    'SGD', 'ZAR', 'SEK', 'THB', 'TRY', 'UAH'
  )
) not valid;

alter table public.invoices validate constraint currency_whitelist;
