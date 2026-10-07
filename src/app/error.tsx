"use client";

import { useEffect } from "react";

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
      className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        An unexpected error occurred. You can try again.
      </p>
      <button
        id="root-error--retry"
        type="button"
        onClick={reset}
        className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted/40"
      >
        Try again
      </button>
    </main>
  );
}
