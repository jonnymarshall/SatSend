import { type NextRequest, NextResponse } from "next/server";
import { fetchBtcPrice } from "@/lib/btc-price";
import { isCurrencyCode } from "@/lib/currencies";

// v1.4.25-H: only supported currencies (R-44: the same list as the database's
// currency whitelist). The value flows into external API URLs, so reject
// anything else explicitly rather than silently pricing in the wrong currency.

export async function GET(request: NextRequest) {
  const currency = (request.nextUrl.searchParams.get("currency") ?? "USD").toUpperCase();

  if (!isCurrencyCode(currency)) {
    return NextResponse.json(
      { error: `Unsupported currency: ${currency}` },
      { status: 400 }
    );
  }

  try {
    const result = await fetchBtcPrice(currency);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[btc-price] fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch BTC price" },
      { status: 503 }
    );
  }
}
