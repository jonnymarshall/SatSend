"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/signal/button";
import { Card } from "@/components/signal/card";
import { Field } from "@/components/signal/field";
import { SatSendLogo } from "@/components/brand/satsend-logo";

// Centered single-card layout shared by both login states (v1.5-H).
function LoginFrame({ children }: { children: React.ReactNode }) {
  return (
    <main id="login--main" className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <SatSendLogo id="login--logo" style={{ width: 148 }} className="mb-8" />
      <Card id="login--card" className="w-full max-w-sm">
        {children}
      </Card>
    </main>
  );
}

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
      <LoginFrame>
        <div id="login--success" className="space-y-2 text-center">
          <h1 id="login--success-heading" className="font-display tracking-heading text-2xl font-bold">
            Check your email
          </h1>
          <p id="login--success-body" className="text-[15px] text-(--color-text-secondary)">
            We sent a magic link to <span className="font-medium text-(--color-ink)">{email}</span>.
          </p>
        </div>
      </LoginFrame>
    );
  }

  return (
    <LoginFrame>
      <div id="login--intro" className="mb-6 space-y-1.5">
        <h1 id="login--heading" className="font-display tracking-heading text-2xl font-bold">
          Sign in to SatSend
        </h1>
        <p id="login--subheading" className="text-[15px] text-(--color-text-secondary)">
          Enter your email and we&apos;ll send you a magic link.
        </p>
      </div>

      <form id="login--form" onSubmit={handleSubmit} className="space-y-5">
        <Field
          id="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <Button id="login--submit-button" type="submit" className="w-full" disabled={loading} loading={loading}>
          {loading ? "Sending…" : "Send magic link"}
        </Button>
      </form>
    </LoginFrame>
  );
}
