/**
 * Spread onto an input that password managers must leave alone (v1.7).
 *
 * Managers guess a field's purpose from its label, name and id, so "BTC
 * address" looks like a street address and LastPass filled it with the user's
 * address line 1. `autocomplete="off"` alone is ignored by most of them, so
 * each one's own opt-out is added too: LastPass, 1Password, Bitwarden and
 * Dashlane.
 */
export const NO_AUTOFILL = {
  autoComplete: "off",
  "data-lpignore": "true",
  "data-1p-ignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
} as const;
