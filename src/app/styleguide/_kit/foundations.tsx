import tokens from "../../../../satsend-brand-handoff/design-tokens.json";
import { SatSendLogo } from "@/components/brand/satsend-logo";
import { SatSendMark } from "@/components/brand/satsend-mark";
import { StatusBadge, type InvoiceStatus } from "@/components/signal/status-badge";
import { contrastRatio } from "@/lib/design/contrast";
import { PROPOSED_TEXT_SHADES } from "@/lib/design/proposed-tokens";
import { KitSection, Specimen, Tok } from "./section";

const C = tokens.color;

/* ---------------------------------------------------------------- Logo */

export function LogoSection() {
  return (
    <KitSection
      id="logo"
      index={1}
      title="Logo"
      intro="The supplied SatSendLogo component, unchanged. It is live SVG text, so it needs Onest loaded; that is why it only looks right inside this kit for now."
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div id="styleguide--logo--primary" className="flex flex-col gap-4 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-8">
          <SatSendLogo style={{ width: 260 }} />
          <p className="text-sm text-(--color-text-secondary)">Primary, on light surfaces</p>
        </div>
        <div id="styleguide--logo--reversed" className="flex flex-col gap-4 rounded-(--radius-lg) bg-(--color-ink) p-8">
          <SatSendLogo variant="reversed" style={{ width: 260 }} />
          <p className="text-sm text-[#B9BCC7]">Reversed, on ink</p>
        </div>
        <div id="styleguide--logo--monochrome" className="flex flex-col gap-4 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-8">
          <SatSendLogo variant="monochrome" style={{ width: 260 }} />
          <p className="text-sm text-(--color-text-secondary)">Monochrome, single colour</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
        <Specimen id="styleguide--logo--sizes" title="Sizes" note="Navbar target is 126 to 160px wide. Never below 112px.">
          <div className="flex flex-col gap-5 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-6">
            {[160, 140, 112].map((w) => (
              <div key={w} className="proxy-id--styleguide--logo--size flex items-center justify-between gap-4">
                <SatSendLogo style={{ width: w }} />
                <Tok>{w}px</Tok>
              </div>
            ))}
          </div>
        </Specimen>
        <Specimen id="styleguide--logo--icons" title="App icon and favicon" note="From assets/satsend-favicon.svg, plus a light variant.">
          <div className="flex items-end gap-5 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-6">
            <SatSendMark variant="dark" width={72} height={72} />
            <SatSendMark variant="light" width={72} height={72} />
            <SatSendMark variant="dark" width={32} height={32} />
            <SatSendMark variant="dark" width={16} height={16} />
          </div>
        </Specimen>
        <Specimen id="styleguide--logo--rules" title="Rules" note="From DESIGN.md §2.">
          <ul className="flex list-disc flex-col gap-2 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-6 pl-10 text-[15px] leading-[1.5]">
            <li>No coin, bolt, shield or padlock in the mark.</li>
            <li>.me always smaller than SatSend.</li>
            <li>Clear space at least the height of the lowercase a.</li>
            <li>Never rebuilt from two positioned spans.</li>
          </ul>
        </Specimen>
      </div>
    </KitSection>
  );
}

/* -------------------------------------------------------------- Colour */

const BRAND: Array<{ key: keyof typeof C; token: string; role: string }> = [
  { key: "ink", token: "--color-ink", role: "Text, headings, dark surfaces" },
  { key: "canvas", token: "--color-canvas", role: "Page background" },
  { key: "surface", token: "--color-surface", role: "Cards, panels, inputs" },
  { key: "border", token: "--color-border", role: "Borders and dividers" },
  { key: "textSecondary", token: "--color-text-secondary", role: "Secondary text, metadata" },
  { key: "brand", token: "--color-brand", role: "Primary actions, selected states" },
  { key: "brandHover", token: "--color-brand-hover", role: "Brand hover and pressed" },
  { key: "brandSoft", token: "--color-brand-soft", role: "Subtle brand highlights" },
];

const STATUS_ROWS: Array<{ status: InvoiceStatus; name: string; fg: keyof typeof C; soft: keyof typeof C; shade: keyof typeof PROPOSED_TEXT_SHADES }> = [
  { status: "paid", name: "Success / Paid", fg: "success", soft: "successSoft", shade: "success" },
  { status: "pending", name: "Sent / Pending", fg: "sent", soft: "sentSoft", shade: "sent" },
  { status: "payment_detected", name: "Payment detected", fg: "detected", soft: "detectedSoft", shade: "detected" },
  { status: "underpaid", name: "Warning / Underpaid", fg: "warning", soft: "warningSoft", shade: "warning" },
  { status: "overdue", name: "Danger / Overdue", fg: "danger", soft: "dangerSoft", shade: "danger" },
  { status: "draft", name: "Neutral / Draft", fg: "neutral", soft: "neutralSoft", shade: "neutral" },
];

function Swatch({ hex, bordered }: { hex: string; bordered?: boolean }) {
  return (
    <span
      aria-hidden
      className={`block h-20 w-full rounded-(--radius-md) ${bordered ? "border border-(--color-border)" : ""}`}
      style={{ background: hex }}
    />
  );
}

export function ColourSection() {
  return (
    <KitSection
      id="colour"
      index={2}
      title="Colour"
      intro="Neutral surfaces carry the product; amber is for brand actions only. Status colours are their own system and never borrow the brand accent."
    >
      <Specimen id="styleguide--colour--brand" title="Core palette">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {BRAND.map((b) => (
            <div key={b.key} className="proxy-id--styleguide--colour--swatch flex flex-col gap-2">
              <Swatch hex={C[b.key]} bordered={["canvas", "surface", "border", "brandSoft"].includes(b.key)} />
              <div>
                <p className="text-sm font-semibold">{b.role}</p>
                <Tok>{b.token}</Tok>
                <p className="font-mono text-[12px] text-(--color-text-secondary)">{C[b.key]}</p>
              </div>
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen
        id="styleguide--colour--status"
        title="Status colours"
        note="Left badge uses the handoff text colour. Right badge uses the proposed AA text shade (dot unchanged). Ratios are text on the soft background."
        className="mt-12"
      >
        <div className="overflow-x-auto rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface)">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-(--color-border) text-[13px] text-(--color-text-secondary)">
                <th scope="col" className="px-5 py-3 font-medium">State</th>
                <th scope="col" className="px-5 py-3 font-medium">Foreground</th>
                <th scope="col" className="px-5 py-3 font-medium">Soft</th>
                <th scope="col" className="px-5 py-3 font-medium">Spec badge</th>
                <th scope="col" className="px-5 py-3 font-medium">AA proposal</th>
              </tr>
            </thead>
            <tbody>
              {STATUS_ROWS.map((r) => {
                const shade = PROPOSED_TEXT_SHADES[r.shade].value;
                return (
                  <tr key={r.status} className="proxy-id--styleguide--colour--status-row border-b border-(--color-border) last:border-0">
                    <td className="px-5 py-3.5 font-medium">{r.name}</td>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-2">
                        <span aria-hidden className="size-4 rounded-full" style={{ background: C[r.fg] }} />
                        <span className="font-mono text-[12px]">{C[r.fg]}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-2">
                        <span aria-hidden className="size-4 rounded-full border border-(--color-border)" style={{ background: C[r.soft] }} />
                        <span className="font-mono text-[12px]">{C[r.soft]}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-3">
                        <StatusBadge status={r.status} text="spec" />
                        <Tok>{contrastRatio(C[r.fg], C[r.soft]).toFixed(2)}:1</Tok>
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-3">
                        <StatusBadge status={r.status} text="aa" />
                        <Tok>
                          {contrastRatio(shade, C[r.soft]).toFixed(2)}:1 ({shade})
                        </Tok>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Specimen>
    </KitSection>
  );
}

/* ---------------------------------------------------------- Typography */

const TYPE: Array<{
  token: string;
  size: string;
  lh: string;
  face: "Onest" | "Geist";
  weight: string;
  cls: string;
  sample: string;
}> = [
  { token: "Display", size: "64 / 44", lh: "1.02", face: "Onest", weight: "800", cls: "font-display tracking-display text-[44px] leading-[1.05] font-[800] md:text-[64px] md:leading-[1.02]", sample: "Invoice in minutes." },
  { token: "H1", size: "48 / 36", lh: "1.08", face: "Onest", weight: "750", cls: "font-display tracking-display text-[36px] leading-[1.08] font-[750] md:text-[48px]", sample: "Get paid in bitcoin" },
  { token: "H2", size: "36 / 30", lh: "1.15", face: "Onest", weight: "700", cls: "font-display tracking-display text-[30px] leading-[1.15] font-[700] md:text-[36px]", sample: "Recent invoices" },
  { token: "H3", size: "28 / 24", lh: "1.25", face: "Onest", weight: "700", cls: "font-display tracking-heading text-[24px] leading-[1.25] font-[700] md:text-[28px]", sample: "Payment details" },
  { token: "H4", size: "22 / 20", lh: "1.3", face: "Geist", weight: "600", cls: "text-[20px] leading-[1.3] font-semibold md:text-[22px]", sample: "Line items" },
  { token: "Body L", size: "18", lh: "1.55", face: "Geist", weight: "400", cls: "text-[18px] leading-[1.55]", sample: "Share one link. Your client pays in bitcoin, and you both see it land." },
  { token: "Body", size: "16", lh: "1.55", face: "Geist", weight: "400", cls: "text-base leading-[1.55]", sample: "We check the network for your payment and update this invoice automatically." },
  { token: "Small", size: "14", lh: "1.45", face: "Geist", weight: "500", cls: "text-sm leading-[1.45] font-medium", sample: "Due 21 Oct 2026, 3 days from now" },
  { token: "Caption", size: "12", lh: "1.4", face: "Geist", weight: "400", cls: "text-[12px] leading-[1.4] text-(--color-text-secondary)", sample: "Exchange rate locked at 14:02 UTC" },
];

export function TypeSection() {
  return (
    <KitSection
      id="type"
      index={3}
      title="Typography"
      intro="Onest for the logo, display and large headings. Geist for everything people read and operate: UI, body, inputs, tables, figures."
    >
      <div className="flex flex-col divide-y divide-(--color-border) rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface)">
        {TYPE.map((t) => (
          <div key={t.token} className="proxy-id--styleguide--type--row grid grid-cols-1 gap-3 p-5 md:grid-cols-[180px_1fr] md:items-baseline md:gap-8 md:p-6">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold">{t.token}</p>
              <Tok>
                {t.size}px, lh {t.lh}
              </Tok>
              <Tok>
                {t.face} {t.weight}
              </Tok>
            </div>
            <p className={t.cls}>{t.sample}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <Specimen id="styleguide--type--figures" title="Figures" note="Tabular numbers so amounts line up in lists. Fiat first, BTC second but clear.">
          <div className="flex flex-col gap-1 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-6 text-right tabular-nums">
            <p className="text-[15px] font-semibold">$12,480.00</p>
            <p className="text-[15px] font-semibold">$850.00</p>
            <p className="text-[15px] font-semibold">$4,200.50</p>
            <p className="mt-2 text-[13px] text-(--color-text-secondary)">0.19840000 BTC</p>
          </div>
        </Specimen>
        <Specimen id="styleguide--type--weights" title="Weights in use">
          <div className="flex flex-col gap-2 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-6 text-[17px]">
            <p className="font-normal">Geist 400, body</p>
            <p className="font-medium">Geist 500, medium UI</p>
            <p className="font-semibold">Geist 600, strong UI and buttons</p>
            <p className="font-display text-[20px] font-[700]">Onest 700, headings</p>
            <p className="font-display text-[20px] font-[800]">Onest 800, display</p>
          </div>
        </Specimen>
      </div>
    </KitSection>
  );
}

/* --------------------------------------------------------- Foundations */

export function FoundationsSection() {
  const space = Object.entries(tokens.space);
  const radius = Object.entries(tokens.radius);
  return (
    <KitSection
      id="foundations"
      index={4}
      title="Spacing, radius, elevation"
      intro="An 8px system with a 4px micro-step. Marketing breathes; product UI is denser. Borders come before shadows."
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Specimen id="styleguide--foundations--spacing" title="Spacing">
          <div className="flex flex-col gap-2.5 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-6">
            {space.map(([k, v]) => (
              <div key={k} className="proxy-id--styleguide--foundations--space flex items-center gap-3">
                <span className="w-20 shrink-0">
                  <Tok>space-{k}</Tok>
                </span>
                <span aria-hidden className="h-3 rounded-[2px] bg-(--color-brand-soft)" style={{ width: Math.min(v, 128) }} />
                <Tok>{v}px</Tok>
              </div>
            ))}
          </div>
        </Specimen>
        <Specimen id="styleguide--foundations--radius" title="Radius" note="Pills only for statuses and small chips.">
          <div className="grid grid-cols-3 gap-4 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-6">
            {radius.map(([k, v]) => (
              <div key={k} className="proxy-id--styleguide--foundations--radius flex flex-col items-center gap-2">
                <span aria-hidden className="size-14 border border-(--color-border-strong) bg-(--color-canvas)" style={{ borderRadius: v }} />
                <Tok>
                  {k} {v === 999 ? "pill" : `${v}px`}
                </Tok>
              </div>
            ))}
          </div>
        </Specimen>
        <Specimen id="styleguide--foundations--elevation" title="Elevation" note="Most product cards are border only. Shadows for floating panels.">
          <div className="grid grid-cols-3 gap-4 rounded-(--radius-lg) bg-(--color-canvas) p-6">
            <div className="flex flex-col items-center gap-2">
              <span aria-hidden className="size-16 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface)" />
              <Tok>border</Tok>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span aria-hidden className="size-16 rounded-(--radius-lg) bg-(--color-surface) shadow-(--shadow-card)" />
              <Tok>card</Tok>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span aria-hidden className="size-16 rounded-(--radius-lg) bg-(--color-surface) shadow-(--shadow-overlay)" />
              <Tok>overlay</Tok>
            </div>
          </div>
        </Specimen>
      </div>
    </KitSection>
  );
}
