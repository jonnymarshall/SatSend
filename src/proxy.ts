import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/invoices"];

function isProtected(path: string) {
  return PROTECTED_PREFIXES.some((p) => path.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  if (
    process.env.NODE_ENV === "development" &&
    request.cookies.get("dev-auth-bypass")?.value === "playwright"
  ) {
    return response;
  }

  // v1.4.24-H (M-FE-4): getUser() revalidates the token with Supabase instead of
  // trusting the cookie, so a spoofed cookie can't satisfy the redirect check.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected(request.nextUrl.pathname)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl, 307);
  }

  return response;
}

// v1.4.24-H (H-FE-2): Next reads `config`, not `proxyConfig`. The old name was
// silently ignored, so the matcher never applied and the proxy ran on every
// request including static assets.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
