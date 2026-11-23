import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchBtcPrice } from "@/lib/btc-price";
import { hasAccess, accessCookieName } from "@/lib/access-code";
import { QUOTE_KEEP_MS, QUOTE_REUSE_MS, QUOTE_VALID_MS, quoteSats } from "@/lib/invoices/quotes";

/*
 * A locked quote (v1.5.29, roadmap v1.5.2.22-H). "Pay now in Bitcoin" asks here
 * for the bitcoin amount to show. The server works it out at the current price
 * and records it, so the payment can later be judged against exactly what the
 * client was shown. The database hands back a quote made in the last minute
 * instead of making another, so reloads can't fill the table.
 */

// Only an invoice awaiting payment gets a quote; once a payment exists the QR
// is gone (v1.5.27).
const QUOTABLE_STATUSES = new Set(["pending", "overdue"]);

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id, status, btc_address, total_fiat, currency, access_code")
    .eq("id", id)
    .single();

  const notFound = NextResponse.json({ error: "Invoice not found" }, { status: 404, headers: NO_STORE });
  if (error || !invoice) return notFound;

  const cookieStore = await cookies();
  const storedCode = cookieStore.get(accessCookieName(id))?.value ?? null;
  if (!hasAccess(id, invoice.access_code, storedCode)) return notFound;

  if (!QUOTABLE_STATUSES.has(invoice.status) || !invoice.btc_address) {
    return NextResponse.json({ error: "Invoice is not awaiting payment" }, { status: 409, headers: NO_STORE });
  }

  let btcPrice: number;
  try {
    btcPrice = (await fetchBtcPrice(invoice.currency)).price;
  } catch {
    return NextResponse.json({ error: "BTC price unavailable" }, { status: 503, headers: NO_STORE });
  }

  const { data: rows, error: quoteError } = await supabase.rpc("take_invoice_quote", {
    p_invoice_id: id,
    p_amount_sats: quoteSats(invoice.total_fiat, btcPrice),
    p_btc_price: btcPrice,
    p_total_fiat: invoice.total_fiat,
    p_currency: invoice.currency,
    p_valid_seconds: QUOTE_VALID_MS / 1000,
    p_reuse_seconds: QUOTE_REUSE_MS / 1000,
    p_keep_seconds: QUOTE_KEEP_MS / 1000,
  });
  const quote = rows?.[0];
  if (quoteError || !quote) {
    console.error("[quote] storing the quote failed", id, quoteError);
    return NextResponse.json({ error: "Try again shortly" }, { status: 503, headers: NO_STORE });
  }

  return NextResponse.json(
    { amountSats: quote.amount_sats, btcPrice: quote.btc_price, expiresAt: quote.expires_at },
    { headers: NO_STORE },
  );
}
