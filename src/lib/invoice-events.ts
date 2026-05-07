import { createAdminClient } from "@/lib/supabase/admin";

export type InvoiceEventType =
  | "marked_as_sent"
  | "marked_as_paid"
  | "marked_as_overdue"
  | "marked_as_unpaid"
  | "payment_confirmed";

export interface LogInvoiceEventArgs {
  invoiceId: string;
  userId: string;
  eventType: InvoiceEventType;
}

export async function logInvoiceEvent(args: LogInvoiceEventArgs): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("invoice_events")
      .insert({
        invoice_id: args.invoiceId,
        user_id: args.userId,
        event_type: args.eventType,
      });
    if (error) {
      console.error(`[invoice-events] failed to record ${args.eventType}`, error);
    }
  } catch (err) {
    console.error(`[invoice-events] failed to record ${args.eventType}`, err);
  }
}
