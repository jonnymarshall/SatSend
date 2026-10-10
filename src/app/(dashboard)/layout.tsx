import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { Button } from "@/components/signal/button";
import { signOutAction } from "./sign-out-action";
import { AppHeader, AppMain } from "./app-header";

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
          <AppHeader email="dev@playwright.test" />
          <AppMain>{children}</AppMain>
        </div>
      );
    }
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader email={user.email ?? ""}>
        <form action={signOutAction}>
          <Button id="nav--sign-out-button" type="submit" variant="secondary" size="sm" className="h-11 md:h-9">
            Log out
          </Button>
        </form>
      </AppHeader>
      <AppMain>{children}</AppMain>
    </div>
  );
}
