import { isValidBtcAddress } from "@/lib/invoices";

export type PublishCheck =
  | { ok: true }
  | { ok: false; error: "btc_address_required" | "btc_address_invalid" };

export function canPublishInvoice(payload: {
  btc_address?: string | null;
}): PublishCheck {
  const address = payload.btc_address?.trim();
  if (!address) {
    return { ok: false, error: "btc_address_required" };
  }
  if (!isValidBtcAddress(address)) {
    return { ok: false, error: "btc_address_invalid" };
  }
  return { ok: true };
}
