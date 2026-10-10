import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "@/components/invoice-form";

export default async function NewInvoicePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  return (
    <div id="invoice-form-page" className="space-y-6">
      <h1 id="invoice-form-page--heading" className="font-display tracking-heading text-[28px] leading-tight font-bold md:text-[32px]">New Invoice</h1>
      <InvoiceForm sessionEmail={user.email} />
    </div>
  );
}
