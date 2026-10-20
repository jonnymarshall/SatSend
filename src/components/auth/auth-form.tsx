"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/signal/button";
import { Card } from "@/components/signal/card";
import { Field } from "@/components/signal/field";
import { LogoHomeLink } from "@/components/brand/logo-home-link";
import { cn } from "@/lib/utils";

/**
 * Log in and Create account (v1.5.14, roadmap v1.5.1.4-H). Both use magic
 * links, but they are separate pages you switch between, so nobody who meant to
 * log in lands in a brand-new empty account:
 * - Log in never creates an account (`shouldCreateUser: false`); Supabase
 *   answers `otp_disabled` for an unknown email, and we offer Create account.
 * - Create account asks the server first (/api/auth/signup-check, rate limited)
 *   and offers Log in if the email already has an account.
 * Errors are shown, not hidden behind "Check your email".
 */
export type AuthMode = "login" | "signup";

const COPY = {
  login: {
    heading: "Log in to SatSend",
    subheading: "Enter your email and we'll send you a sign-in link.",
    button: "Send sign-in link",
    sending: "Sending…",
    sent: "We've sent a sign-in link to",
    switchPrompt: "No account?",
    switchLink: "Create one",
  },
  signup: {
    heading: "Create your SatSend account",
    subheading: "Enter your email and we'll send you a link to confirm it.",
    button: "Create account",
    sending: "Creating…",
    sent: "We've sent a link to confirm your account to",
    switchPrompt: "Already have an account?",
    switchLink: "Log in",
  },
} as const;

type Outcome =
  | { kind: "idle" }
  | { kind: "sent" }
  | { kind: "wrong-page" } // login: no account; signup: account exists
  | { kind: "error"; message: string };

const TOO_MANY_SIGNUPS = "Too many sign-up attempts from your connection. Please try again in an hour.";
const GENERIC_ERROR = "Something went wrong. Please try again in a moment.";

function otpErrorMessage(error: { code?: string; status?: number }): string {
  if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit" || error.status === 429) {
    return "Please wait a minute before asking for another link.";
  }
  if (error.code === "email_address_invalid" || error.code === "validation_failed") {
    return "That email address doesn't look right. Please check it.";
  }
  return GENERIC_ERROR;
}

const otherPage = (mode: AuthMode, email: string) => {
  const path = mode === "login" ? "/signup" : "/login";
  return email ? `${path}?email=${encodeURIComponent(email)}` : path;
};

function AuthFrame({ mode, children }: { mode: AuthMode; children: React.ReactNode }) {
  return (
    <main id={`${mode}--main`} className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <LogoHomeLink id={`${mode}--logo`} logoStyle={{ width: 148 }} className="mb-8" />
      <Card id={`${mode}--card`} className="w-full max-w-sm">
        {children}
      </Card>
    </main>
  );
}

export function AuthForm({
  mode,
  initialEmail = "",
  linkExpired = false,
}: {
  mode: AuthMode;
  initialEmail?: string;
  linkExpired?: boolean;
}) {
  const copy = COPY[mode];
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const trimmed = email.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setOutcome({ kind: "idle" });
    try {
      setOutcome(mode === "login" ? await logIn(trimmed) : await signUp(trimmed));
    } catch {
      setOutcome({ kind: "error", message: GENERIC_ERROR });
    } finally {
      setLoading(false);
    }
  }

  if (outcome.kind === "sent") {
    return (
      <AuthFrame mode={mode}>
        <div id={`${mode}--success`} className="space-y-2 text-center">
          <h1 id={`${mode}--success-heading`} className="font-display tracking-heading text-2xl font-bold">
            Check your email
          </h1>
          <p id={`${mode}--success-body`} className="text-[15px] text-(--color-text-secondary)">
            {copy.sent} <span className="font-medium text-(--color-ink)">{trimmed}</span>.
          </p>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame mode={mode}>
      <div id={`${mode}--intro`} className="mb-6 space-y-1.5">
        <h1 id={`${mode}--heading`} className="font-display tracking-heading text-2xl font-bold">
          {copy.heading}
        </h1>
        <p id={`${mode}--subheading`} className="text-[15px] text-(--color-text-secondary)">
          {copy.subheading}
        </p>
      </div>

      {linkExpired && mode === "login" ? (
        <p
          id="login--link-expired"
          role="status"
          className="mb-5 rounded-(--radius-md) bg-(--color-canvas) px-3.5 py-3 text-sm text-(--color-ink)"
        >
          That link has expired or was already used. Enter your email and we&apos;ll send a new one.
        </p>
      ) : null}

      <form id={`${mode}--form`} onSubmit={handleSubmit} className="space-y-5">
        <Field
          id="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (outcome.kind !== "idle") setOutcome({ kind: "idle" });
          }}
          placeholder="you@example.com"
        />

        {outcome.kind === "wrong-page" ? (
          <div id={`${mode}--wrong-page`} className="space-y-3 rounded-(--radius-md) bg-(--color-canvas) px-3.5 py-3">
            <p id={`${mode}--wrong-page-message`} className="text-sm text-(--color-ink)">
              {mode === "login"
                ? "There's no SatSend account for that email."
                : "You already have an account with that email."}
            </p>
            <Link
              id={`${mode}--wrong-page-link`}
              href={otherPage(mode, trimmed)}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "w-full")}
            >
              {mode === "login" ? "Create an account" : "Log in instead"}
            </Link>
          </div>
        ) : null}

        {outcome.kind === "error" ? (
          <p id={`${mode}--error`} role="alert" className="text-sm text-(--color-danger-text)">
            {outcome.message}
          </p>
        ) : null}

        <Button id={`${mode}--submit-button`} type="submit" className="w-full" disabled={loading} loading={loading}>
          {loading ? copy.sending : copy.button}
        </Button>
      </form>

      <p id={`${mode}--switch`} className="mt-5 text-center text-sm text-(--color-text-secondary)">
        {copy.switchPrompt}{" "}
        <Link
          id={`${mode}--switch-link`}
          href={otherPage(mode, trimmed)}
          className="font-medium text-(--color-ink) underline decoration-(--color-brand) underline-offset-3"
        >
          {copy.switchLink}
        </Link>
      </p>
    </AuthFrame>
  );
}

function sendLink(email: string, shouldCreateUser: boolean) {
  return createClient().auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser,
      emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
    },
  });
}

async function logIn(email: string): Promise<Outcome> {
  const { error } = await sendLink(email, false);
  if (!error) return { kind: "sent" };
  // Supabase's answer for an email with no account when sign-up is off.
  if (error.code === "otp_disabled") return { kind: "wrong-page" };
  return { kind: "error", message: otpErrorMessage(error) };
}

async function signUp(email: string): Promise<Outcome> {
  const res = await fetch("/api/auth/signup-check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (res.status === 429) return { kind: "error", message: TOO_MANY_SIGNUPS };
  if (res.status === 400) return { kind: "error", message: "That email address doesn't look right. Please check it." };
  if (!res.ok) return { kind: "error", message: GENERIC_ERROR };
  const { registered } = (await res.json()) as { registered: boolean };
  if (registered) return { kind: "wrong-page" };

  const { error } = await sendLink(email, true);
  return error ? { kind: "error", message: otpErrorMessage(error) } : { kind: "sent" };
}
