import type { ReactNode } from "react";

/**
 * v1.5.37 (roadmap v1.4.24): a menu item's label with an optional second line.
 * When the item is unavailable, the second line says why. Disabled menu items
 * ignore the mouse (and phones have no hover), so the reason is shown, not left
 * to a hover tooltip. Otherwise the second line is the item's usual hint, if it
 * has one (e.g. "Share the link yourself").
 */
export function MenuItemLabel({
  label,
  reason,
  hint,
}: {
  label: ReactNode;
  reason?: string;
  hint?: string;
}) {
  const second = reason ?? hint;
  if (!second) return <>{label}</>;
  return (
    <span className="flex flex-col items-start gap-0.5">
      <span>{label}</span>
      <span className="proxy-id--menu-item--second-line text-xs text-(--color-text-secondary)">{second}</span>
    </span>
  );
}
