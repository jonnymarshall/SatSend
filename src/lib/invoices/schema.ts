import { z } from "zod";
import { MIN_ACCESS_CODE_LENGTH } from "@/lib/invoices";

// One definition of a valid invoice, shared by the form and the server actions
// (v1.4.29-H). Field-validation failures are RETURNED as a result, never thrown:
// Next masks thrown server-action messages in production, which is why users
// used to see a useless generic error.
export type FieldError = { ok: false; field: string; message: string };
export type ActionResult<T = undefined> = { ok: true; data: T } | FieldError;

const blankToUndefined = (v: unknown) => (v === "" || v === undefined ? undefined : v);

export const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().min(0),
  unit_price: z.number().min(0),
});

export const invoiceSchema = z.object({
  invoice_number: z.preprocess(
    blankToUndefined,
    z.string().max(30, "Max 30 characters").optional()
  ),
  your_name: z.preprocess(blankToUndefined, z.string().optional()),
  your_email: z.preprocess(blankToUndefined, z.email("Must be a valid email").optional()),
  your_company: z.preprocess(blankToUndefined, z.string().optional()),
  your_address: z.preprocess(blankToUndefined, z.string().optional()),
  your_tax_id: z.preprocess(blankToUndefined, z.string().optional()),
  client_name: z.preprocess(blankToUndefined, z.string().optional()),
  client_email: z.preprocess(blankToUndefined, z.email("Must be a valid email").optional()),
  client_company: z.preprocess(blankToUndefined, z.string().optional()),
  client_address: z.preprocess(blankToUndefined, z.string().optional()),
  client_tax_id: z.preprocess(blankToUndefined, z.string().optional()),
  line_items: z
    .array(lineItemSchema)
    .min(1, "Add at least one line item")
    .max(100, "Max 100 line items"),
  tax_percent: z.number().min(0, "Tax percent cannot be negative").max(100, "Max 100%"),
  // Address FORMAT is validated by the form (client) and canPublishInvoice (at
  // publish); the server-side save path never validated format, so the schema
  // does not either — this branch must not add new rejection behaviour.
  btc_address: z.preprocess(blankToUndefined, z.string().optional()),
  due_date: z.preprocess(blankToUndefined, z.string().optional()),
  access_code: z.preprocess(
    blankToUndefined,
    z.string().min(MIN_ACCESS_CODE_LENGTH, `At least ${MIN_ACCESS_CODE_LENGTH} characters`).optional()
  ),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;

/** The first Zod issue as a FieldError (field is the issue path). */
export function firstFieldError(error: z.ZodError): FieldError {
  const issue = error.issues[0];
  return { ok: false, field: issue.path.join(".") || "_form", message: issue.message };
}

/**
 * Translate a Postgres constraint violation into a FieldError, so a DB rejection
 * (e.g. the btc_address unique index) reaches the user instead of a generic
 * production message. Returns null for anything that is not a known field rule.
 */
export function dbErrorToFieldError(error: { code?: string; message: string }): FieldError | null {
  if (error.code === "23505") {
    if (error.message.includes("btc_address")) {
      return {
        ok: false,
        field: "btc_address",
        message: "This bitcoin address has already been used on another invoice. Use a fresh address.",
      };
    }
    if (error.message.includes("invoice_number")) {
      return {
        ok: false,
        field: "invoice_number",
        message: "You already have an invoice with this number.",
      };
    }
  }
  return null;
}
