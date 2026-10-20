import { AuthForm } from "@/components/auth/auth-form";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// Create account (v1.5.14). `?email=` carries the address over from Log in.
export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <AuthForm mode="signup" initialEmail={first(params.email)} />;
}
