"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/signal/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
    });
    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <main id="login--main" className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-3">
          <h1 id="login--success-heading" className="text-2xl font-semibold">Check your email</h1>
          <p className="text-muted-foreground text-sm">
            We sent a magic link to <span className="text-foreground">{email}</span>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main id="login--main" className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 id="login--heading" className="text-2xl font-semibold">Sign in to SatSend</h1>
          <p className="text-muted-foreground text-sm">
            Enter your email and we&apos;ll send you a magic link.
          </p>
        </div>

        <form id="login--form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label id="login--email-label" htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <Button id="login--submit-button" type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send magic link"}
          </Button>
        </form>
      </div>
    </main>
  );
}
