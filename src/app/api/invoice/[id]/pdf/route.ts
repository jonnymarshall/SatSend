import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchPublicInvoice } from "@/lib/invoice-public";
import { renderInvoicePdf } from "@/lib/invoices/invoice-pdf";
import { buildPdfFilename } from "@/lib/invoices/pdf-filename";
import { getAppUrl } from "@/lib/app-url";
import { isAccessCodeValid, accessCookieName } from "@/lib/access-code";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoice = await fetchPublicInvoice(id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // v1.4.25-H (H-SEC-1): the access code must gate the PDF too, not just the
  // HTML page. Return 404 (not 403) so we never confirm the invoice exists, and
  // do it before any caching. This runs against the same cookie the page sets.
  const cookieStore = await cookies();
  const provided = cookieStore.get(accessCookieName(id))?.value ?? null;
  if (!isAccessCodeValid(invoice.access_code, provided)) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Cache by the invoice's version. `updated_at` is bumped by a DB trigger on
  // every write (including the sweep), so a changed invoice always gets a fresh
  // tag. "private" because the PDF can be access-protected, and no-cache means
  // the browser revalidates (cheap 304) rather than re-rendering every time.
  const etag = `"${invoice.id}-${new Date(invoice.updated_at).getTime()}"`;
  const cacheHeaders = { etag, "cache-control": "private, no-cache" };
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: cacheHeaders });
  }

  const pdf = await renderInvoicePdf(invoice, { appUrl: getAppUrl() });
  const filename = buildPdfFilename(invoice);
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_");
  const encodedFilename = encodeURIComponent(filename);

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
      ...cacheHeaders,
    },
  });
}
