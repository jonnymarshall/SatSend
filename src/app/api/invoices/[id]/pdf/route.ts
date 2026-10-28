import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderInvoicePdf } from "@/lib/invoices/invoice-pdf";
import { buildPdfFilename } from "@/lib/invoices/pdf-filename";
import { getAppUrl } from "@/lib/app-url";
import { toInvoice } from "@/lib/invoice-public";
import { safeTimeZone } from "@/lib/invoices/payment-summary";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // v1.5.28: payment times in the downloader's time zone (?tz=), else UTC.
  const timeZone = safeTimeZone(request.nextUrl.searchParams.get("tz"));
  const pdf = await renderInvoicePdf(toInvoice(invoice), { appUrl: getAppUrl(), timeZone });
  const filename = buildPdfFilename({ ...toInvoice(invoice), account_email: user.email ?? null });
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_");
  const encodedFilename = encodeURIComponent(filename);

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
      "cache-control": "private, no-store",
    },
  });
}
