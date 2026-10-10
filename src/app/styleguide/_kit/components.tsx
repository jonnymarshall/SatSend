import { ArrowRight, Mail, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/signal/button";
import { Card } from "@/components/signal/card";
import { Field } from "@/components/signal/field";
import { STATUS_TONES, StatusBadge, type InvoiceStatus } from "@/components/signal/status-badge";
import { EmptyState, InvoiceListItem, InvoiceTable, PaymentPanel, StatsCard } from "./patterns";
import { KitSection, Specimen } from "./section";

const STATUSES = Object.keys(STATUS_TONES) as InvoiceStatus[];

/** Text link: ink with an amber underline (decided 2026-10-09). */
export const LINK =
  "rounded-[2px] font-medium text-(--color-ink) underline decoration-(--color-brand) decoration-2 underline-offset-[3px] transition-[text-decoration-color] duration-150 hover:decoration-(--color-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ink)";

export function ComponentsSection() {
  return (
    <KitSection
      id="components"
      index={5}
      title="Components"
      intro="The base primitives, rebuilt against the tokens. Hover and keyboard focus are live: try them. Every control is at least 44px tall except the small button, which is for dense desktop toolbars only."
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Specimen id="styleguide--components--buttons" title="Buttons" note="Primary text is ink, because white on amber fails contrast.">
          <Card className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button id="styleguide--components--buttons--primary">
                Create invoice
                <ArrowRight />
              </Button>
              <Button id="styleguide--components--buttons--secondary" variant="secondary">
                View dashboard
              </Button>
              <Button id="styleguide--components--buttons--ghost" variant="ghost">
                Cancel
              </Button>
              <Button id="styleguide--components--buttons--danger" variant="danger">
                <Trash2 />
                Delete draft
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button id="styleguide--components--buttons--loading" loading>
                Publishing
              </Button>
              <Button id="styleguide--components--buttons--disabled" disabled>
                Publish
              </Button>
              <Button id="styleguide--components--buttons--icon" variant="secondary" size="icon" aria-label="New invoice">
                <Plus />
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-3 border-t border-(--color-border) pt-6">
              <Button id="styleguide--components--buttons--sm" size="sm" variant="secondary">
                Small 36
              </Button>
              <Button id="styleguide--components--buttons--md">Medium 44</Button>
              <Button id="styleguide--components--buttons--lg" size="lg">
                Large 52
              </Button>
            </div>
          </Card>
        </Specimen>

        <Specimen id="styleguide--components--inputs" title="Inputs" note="Label above, help and errors below. Click or Tab into a field: the border turns amber with a soft amber ring, and nothing flashes on the way.">
          <Card className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field id="styleguide--components--inputs--default" label="Client name" placeholder="e.g. Acme Studio" />
            <Field
              id="styleguide--components--inputs--icon"
              label="Search invoices"
              placeholder="Invoice or client"
              leadingIcon={<Search />}
            />
            <Field
              id="styleguide--components--inputs--focus"
              label="Focused (forced)"
              defaultValue="Website redesign"
              forceFocus
            />
            <Field
              id="styleguide--components--inputs--error"
              label="Client email"
              type="email"
              defaultValue="acme@studio"
              error="Must be a valid email"
              leadingIcon={<Mail />}
            />
            <Field
              id="styleguide--components--inputs--disabled"
              label="Currency"
              defaultValue="USD"
              disabled
              helper="Set when the invoice is created"
            />
            <Field
              id="styleguide--components--inputs--amount"
              label="Amount"
              inputMode="decimal"
              placeholder="0.00"
              helper="In the invoice currency"
            />
          </Card>
        </Specimen>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Specimen id="styleguide--components--badges" title="Status badges" note="Every app status, with a dot and a word.">
          <Card className="flex flex-col gap-4">
            <div id="styleguide--components--badges--all" className="flex flex-wrap gap-2.5">
              {STATUSES.map((s) => (
                <StatusBadge key={s} status={s} className="proxy-id--styleguide--components--badge" />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2.5 border-t border-(--color-border) pt-4">
              <StatusBadge status="paid" />
              <span
                id="styleguide--components--overpaid-chip"
                className="inline-flex min-h-7 items-center rounded-(--radius-pill) border border-(--color-border) px-2.5 text-[13px] font-medium text-(--color-ink)"
              >
                Overpaid by $40.00
              </span>
              <span className="text-sm text-(--color-text-secondary)">Overpaid is a flag beside Paid, not a status.</span>
            </div>
          </Card>
        </Specimen>

        <Specimen id="styleguide--components--cards" title="Cards" note="Product card, elevated card (rare), marketing card.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card id="styleguide--components--cards--product">
              <p className="text-sm text-(--color-text-secondary)">Product card</p>
              <p className="mt-1 text-[17px] font-semibold">Border, 16px radius</p>
            </Card>
            <Card id="styleguide--components--cards--elevated" elevated>
              <p className="text-sm text-(--color-text-secondary)">Elevated</p>
              <p className="mt-1 text-[17px] font-semibold">Card shadow</p>
            </Card>
            <Card id="styleguide--components--cards--marketing" variant="marketing" className="sm:col-span-2">
              <p className="font-display tracking-heading text-[24px] leading-[1.25] font-[700]">Marketing card</p>
              <p className="mt-2 max-w-[48ch] text-base leading-[1.55] text-(--color-text-secondary)">
                24px radius and more room, for landing-page feature blocks.
              </p>
            </Card>
          </div>
        </Specimen>
      </div>

      <Specimen
        id="styleguide--components--links"
        title="Links"
        note="Ink text with an amber underline: the amber marks it as a link, the ink keeps it readable. Spec amber as text (2.35:1) was too faint (decided 9 Oct)."
        className="mt-5"
      >
        <Card className="flex flex-col gap-3 text-[15px] leading-[1.6]">
          <p id="styleguide--components--links--inline">
            Your client can pay from any bitcoin wallet.{" "}
            <a id="styleguide--components--links--inline-link" href="#styleguide--components--links" className={LINK}>
              See which wallets work
            </a>
            , or{" "}
            <a id="styleguide--components--links--inline-link-2" href="#styleguide--components--links" className={LINK}>
              read how payments are detected
            </a>
            .
          </p>
          <p className="text-sm text-(--color-text-secondary)">Hover a link: the underline turns ink. Tab to one: an ink focus outline.</p>
        </Card>
      </Specimen>
    </KitSection>
  );
}

export function PatternsSection() {
  return (
    <KitSection
      id="patterns"
      index={6}
      title="Product patterns"
      intro="Real screens in miniature, assembled only from the primitives above. All figures are sample data."
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Specimen id="styleguide--patterns--list" title="Invoice list">
          <div className="flex flex-col gap-3">
            <InvoiceListItem idPrefix="styleguide--patterns--a" title="Website redesign" client="Acme Studio" date="12 Oct" fiat="$2,500.00" btc="0.03412 BTC" status="paid" />
            <InvoiceListItem idPrefix="styleguide--patterns--b" title="Design consultation" client="Bright Media" date="18 Oct" fiat="$850.00" btc="0.01160 BTC" status="payment_detected" />
            <InvoiceListItem idPrefix="styleguide--patterns--c" title="Monthly retainer" client="Northwind Ltd" date="21 Oct" fiat="$4,200.00" btc="0.05731 BTC" status="pending" />
          </div>
        </Specimen>
        <div className="flex flex-col gap-5">
          <Specimen id="styleguide--patterns--stats" title="Stats">
            <StatsCard idPrefix="styleguide--patterns" />
          </Specimen>
          <Specimen id="styleguide--patterns--empty" title="Empty state">
            <EmptyState idPrefix="styleguide--patterns" />
          </Specimen>
        </div>
      </div>

      <Specimen id="styleguide--patterns--table" title="Invoice table" note="Calm and mostly neutral. Status is the only colour in the row." className="mt-10">
        <InvoiceTable idPrefix="styleguide--patterns" />
      </Specimen>

      <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
        <Specimen id="styleguide--patterns--payer-pending" title="Payer page, waiting">
          <PaymentPanel idPrefix="styleguide--patterns--pending" status="pending" />
        </Specimen>
        <Specimen id="styleguide--patterns--payer-detected" title="Payer page, payment detected">
          <PaymentPanel idPrefix="styleguide--patterns--detected" status="payment_detected" />
        </Specimen>
      </div>
    </KitSection>
  );
}
