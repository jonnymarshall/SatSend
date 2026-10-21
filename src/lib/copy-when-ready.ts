/**
 * Copy text that isn't known yet (v1.5.19). Call this synchronously inside the
 * click handler: Safari only allows clipboard writes during the click itself,
 * so with ClipboardItem the write starts now and its text arrives when `text`
 * resolves. Elsewhere it falls back to writeText once the text is ready.
 * Resolves true if the text was copied; never throws.
 */
export function copyWhenReady(text: Promise<string | null>): Promise<boolean> {
  const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  if (!clipboard) return Promise.resolve(false);

  if (typeof ClipboardItem !== "undefined" && typeof clipboard.write === "function") {
    const blob = text.then((t) => {
      if (!t) throw new Error("nothing to copy");
      return new Blob([t], { type: "text/plain" });
    });
    return clipboard
      .write([new ClipboardItem({ "text/plain": blob })])
      .then(() => true)
      .catch(() => false);
  }

  return text
    .then((t) => (t ? clipboard.writeText(t).then(() => true) : false))
    .catch(() => false);
}

/**
 * Start a copy now and supply the text later (v1.5.19): call inside the click,
 * then `provide(link)` once it's known, or `provide(null)` to cancel.
 */
export function deferredCopy(): { provide: (text: string | null) => void; copied: Promise<boolean> } {
  let provide!: (text: string | null) => void;
  const text = new Promise<string | null>((resolve) => (provide = resolve));
  return { provide, copied: copyWhenReady(text) };
}
