import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { Button } from "@/components/signal/button";
import { signOutAction } from "./sign-out-action";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "development") {
    const cookieStore = await cookies();
    if (cookieStore.get("dev-auth-bypass")?.value === "playwright") {
      return (
        <div className="min-h-screen flex flex-col">
          <header id="nav--header" className="border-b border-border px-6 py-4 flex items-center justify-between">
            <Link href="/invoices" className="font-semibold tracking-tight text-primary">SatSend</Link>
            <span id="nav--user-email" className="text-sm text-muted-foreground">dev@playwright.test</span>
          </header>
          <main id="dashboard--main" className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
            {children}
          </main>
        </div>
      );
    }
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header id="nav--header" className="border-b border-border px-6 py-4 flex items-center justify-between">
        <Link href="/invoices" className="font-semibold tracking-tight text-primary">SatSend</Link>
        <div id="nav--right" className="flex items-center gap-4">
          <span id="nav--user-email" className="text-sm text-muted-foreground">{user.email}</span>
          <form action={signOutAction}>
            <Button id="nav--sign-out-button" type="submit" variant="secondary" size="sm">Log out</Button>
          </form>
        </div>
      </header>
      <main id="dashboard--main" className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
