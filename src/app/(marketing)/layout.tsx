import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

// Public marketing site (v1.5.16): the homepage and its placeholder pages.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="site" className="flex min-h-dvh w-full flex-col bg-(--color-canvas)">
      <SiteHeader />
      <main id="site--main" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
