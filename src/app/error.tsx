"use client";

import { useEffect } from "react";
import { SatSendMark } from "@/components/brand/satsend-mark";
import { Button } from "@/components/signal/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="root-error"
      className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center"
    >
      <SatSendMark id="root-error--mark" aria-hidden className="size-12" />
      <h1 id="root-error--title" className="font-display tracking-heading text-3xl font-bold">
        Something went wrong
      </h1>
      <p id="root-error--body" className="max-w-md text-base text-(--color-text-secondary)">
        An unexpected error occurred. You can try again.
      </p>
      <Button id="root-error--retry" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
