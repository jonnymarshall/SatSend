import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { fetchPublicInvoice } from "@/lib/invoice-public";
import { fetchBtcPrice } from "@/lib/btc-price";
import { isAccessCodeValid, accessCookieName } from "@/lib/access-code";
import { AccessCodeGate } from "./access-code-gate";
import { InvoicePaymentView } from "./invoice-payment-view";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientInvoicePage({ params }: Props) {
  const { id } = await params;

  const invoice = await fetchPublicInvoice(id);
  if (!invoice) notFound();

  const cookieStore = await cookies();
  const storedCode = cookieStore.get(accessCookieName(id))?.value ?? null;

  if (!isAccessCodeValid(invoice.access_code, storedCode)) {
    return <AccessCodeGate invoiceId={id} />;
  }

  let btcPrice: number | null = null;
  if (invoice.btc_address) {
    try {
      const result = await fetchBtcPrice(invoice.currency);
      btcPrice = result.price;
    } catch {
      // BTC price unavailable — show fallback in view
    }
  }

  return <InvoicePaymentView invoice={invoice} btcPrice={btcPrice} />;
}
