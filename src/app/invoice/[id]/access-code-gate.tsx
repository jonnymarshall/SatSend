"use client";

import { useActionState, useState } from "react";
import { verifyAccessCode, type AccessCodeState } from "./actions";
import { SatSendLogo } from "@/components/brand/satsend-logo";
import { Button } from "@/components/signal/button";
import { Card } from "@/components/signal/card";
import { Input } from "@/components/signal/input";

interface Props {
  invoiceId: string;
}

const initialState: AccessCodeState = { error: undefined };

export function AccessCodeGate({ invoiceId }: Props) {
  const boundAction = verifyAccessCode.bind(null, invoiceId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [code, setCode] = useState("");

  return (
    <main id="access-gate--main" className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <SatSendLogo id="access-gate--logo" style={{ width: 132 }} className="mb-8" />
      <Card id="access-gate--card" className="w-full max-w-sm">
        <div id="access-gate--intro" className="mb-6 space-y-1.5">
          <h1 id="access-gate--heading" className="font-display tracking-heading text-2xl font-bold">Enter access code</h1>
          <p id="access-gate--subheading" className="text-[15px] text-(--color-text-secondary)">
            This invoice is protected. Enter the code provided by the sender.
          </p>
        </div>

        <form id="access-gate--form" action={formAction} className="space-y-5">
          <div id="access-gate--field" className="flex flex-col gap-2">
            <label id="access-gate--label" htmlFor="access_code" className="text-sm font-medium">
              Access code
            </label>
            <Input
              id="access_code"
              name="access_code"
              type="text"
              autoComplete="off"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toLowerCase().slice(0, 16))}
              aria-invalid={state?.error ? true : undefined}
              aria-describedby={state?.error ? "access-gate--error" : undefined}
              className="font-mono tracking-widest"
            />
            {state?.error && (
              <p id="access-gate--error" className="text-sm text-(--color-danger-text)">{state.error}</p>
            )}
          </div>

          <Button id="access-gate--submit" type="submit" disabled={pending} loading={pending} className="w-full">
            {pending ? "Verifying…" : "Continue"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
