"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const title = label ?? "Copy to clipboard";

  return (
    <button
      onClick={handleCopy}
      className="-my-2 -mr-2 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-(--radius-sm) px-2 text-sm font-medium text-(--color-text-secondary) transition-colors hover:bg-(--color-neutral-soft) hover:text-(--color-ink) md:min-h-9"
      aria-label={title}
      title={title}
    >
      {copied ? <Check className="h-4 w-4 text-(--color-success-text)" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
