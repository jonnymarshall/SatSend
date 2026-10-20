import { AuthForm } from "@/components/auth/auth-form";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// Log in (v1.5.14). `?email=` carries the address over from Create account;
// `?error=auth` comes from /auth/callback when a link has expired or was used.
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <AuthForm mode="login" initialEmail={first(params.email)} linkExpired={first(params.error) === "auth"} />;
}
