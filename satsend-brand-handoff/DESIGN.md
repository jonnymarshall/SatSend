# SatSend Design System

> Status: **Approved brand direction — Option D / Signal Amber**
>
> Primary brand: `SatSend`
>
> Domain extension: `.me` is secondary and visually subordinate.

## 1. Brand intent

SatSend is a Bitcoin invoicing and payment product for freelancers, independent professionals, Bitcoin-native businesses, and—secondarily—conventional businesses that occasionally need to pay or receive Bitcoin.

The product should feel:

- easy
- quick
- clean
- professional
- secure
- friendly
- optimistic

The interface should read first as a polished invoicing / payments product and only secondarily as a Bitcoin product. Avoid stereotypical crypto visual language.

### Visual positioning

Use an airy, product-led layout with strong typography, generous whitespace, soft rounded geometry, restrained elevation, and a single dominant brand accent.

Do **not** use mint/green as the dominant brand colour. That space is too close to Zaprite.

---

## 2. Logo system

### Primary wordmark

The approved wordmark is text-led:

**SatSend** + smaller **.me**

- `SatSend` is the brand.
- `.me` is a secondary domain extension.
- Use a refined, distinctive, slightly rounded typographic treatment.
- No Bitcoin symbol, coin, lightning bolt, invoice sheet, paper plane, shield, or padlock in the primary wordmark.
- The preferred visual direction is the earlier **A3** wordmark: confident, compact, slightly distinctive, but not quirky.

### Recommended implementation

For the application, use the supplied `SatSendLogo.tsx` inline-SVG component.

```tsx
import { SatSendLogo } from "./SatSendLogo";

<SatSendLogo style={{ width: 150 }} />
```

The component mirrors the approved clean SVG construction and keeps `SatSend` and `.me` in one SVG text flow. The `.me` uses a small negative optical adjustment (`dx="-1.5"`) so it sits tightly against the end of `SatSend`.

The current SVG assets are **text-based SVGs**, not outlined-path SVGs. They require **Onest** to be available to render the intended letterforms. For the website/app, the inline React component is preferred because it participates in the page where Onest is already loaded.

Do not rebuild the mark with two independently positioned HTML spans; that can introduce spacing differences.

A future final media-kit/master logo can be exported as a font-independent outlined-path SVG directly from the Onest vector outlines after the wordmark geometry is fully approved. Do not create that master by raster tracing.

Use the reversed variant on dark backgrounds:

```tsx
<SatSendLogo variant="reversed" style={{ width: 150 }} />
```

Use `variant="monochrome"` where a single-colour mark is required.

### Minimum sizing

- Full wordmark: minimum 112px wide digitally.
- Navbar target: ~126–160px wide depending on layout.
- Do not allow `.me` to become visually equal in weight to `SatSend`.

### Clear space

Maintain clear space around the wordmark equal to at least the height of the lowercase `a`.

---

## 3. Core colour system

### Brand colours

| Token | Value | Role |
|---|---|---|
| `--color-ink` | `#151C2E` | Primary text, headings, dark surfaces |
| `--color-canvas` | `#FCFBF7` | Main page background |
| `--color-surface` | `#FFFFFF` | Cards, panels, inputs |
| `--color-brand` | `#D89B24` | Primary CTA, links, selected states, logo `.me` |
| `--color-brand-hover` | `#C48716` | Brand hover/pressed state |
| `--color-brand-soft` | `#F8E9BF` | Subtle branded backgrounds / highlights |
| `--color-text-secondary` | `#6F7282` | Secondary body text and metadata |
| `--color-border` | `#ECE8DD` | Borders, dividers, input outlines |

### Semantic colours

Brand colour and status colour must remain separate concepts.

| State | Foreground | Soft background | Use |
|---|---|---|---|
| Success / Paid | `#2F9A74` | `#E7F6F0` | Confirmed payment / success |
| Info / Sent | `#4776E6` | `#EAF0FF` | Invoice sent / neutral informational state |
| Payment detected | `#6E7CF6` | `#ECEEFF` | Payment detected but not yet final |
| Warning / Underpaid | `#F0A43B` | `#FFF2DD` | Partial payment / attention |
| Danger / Overdue | `#D95F5F` | `#FCE8E8` | Overdue / destructive / errors |
| Draft / Neutral | `#7A8190` | `#F0F1F3` | Draft / inactive |

### Colour usage

- Use amber for **brand actions**, not for every highlighted UI state.
- Keep most surfaces white or canvas.
- Do not tint large portions of the dashboard amber.
- The product should feel calm and financial, not yellow/orange.
- Success is green even though green is not the brand colour.
- Avoid Bitcoin-orange as a default accent; Bitcoin-specific orange may appear only where a Bitcoin asset/icon itself genuinely requires it.

---

## 4. Typography

All fonts must be free/open-source.

### Display / brand

**Onest**

Use for:

- logo
- landing-page display headings
- large section headings
- high-emphasis figures where a little personality is useful

Recommended weights:

- Display: 700–800
- Headings: 650–750

### Product / body

**Geist Sans**

Use for:

- UI
- body copy
- inputs
- tables
- invoice data
- metadata
- navigation

Recommended weights:

- Body: 400
- Medium UI: 500
- Strong UI: 600

### Type scale

| Token | Desktop | Mobile | Line height |
|---|---:|---:|---:|
| Display | 64px | 44px | 1.00–1.05 |
| H1 | 48px | 36px | 1.08 |
| H2 | 36px | 30px | 1.15 |
| H3 | 28px | 24px | 1.25 |
| H4 | 22px | 20px | 1.3 |
| Body L | 18px | 18px | 1.55 |
| Body | 16px | 16px | 1.55 |
| Small | 14px | 14px | 1.45 |
| Caption | 12px | 12px | 1.4 |

### Heading treatment

Use tight letter spacing on Onest headings:

```css
letter-spacing: -0.045em;
```

Use less aggressive spacing below ~28px.

---

## 5. Spacing

Use an 8px-oriented system while allowing a 4px micro-step.

```text
space-1   4px
space-2   8px
space-3  12px
space-4  16px
space-5  24px
space-6  32px
space-7  48px
space-8  64px
space-9  96px
space-10 128px
```

Use generous section spacing on marketing pages; product UI should be denser.

---

## 6. Radius

```text
radius-sm      6px   small controls / tiny tags
radius-md     10px   buttons / inputs
radius-lg     16px   cards / panels
radius-xl     24px   large marketing cards
radius-pill  999px   status tags / pills
```

Avoid excessive pill-shaped controls. Reserve full pills mainly for statuses, compact filters, and small chips.

---

## 7. Borders and elevation

### Border

```css
border: 1px solid var(--color-border);
```

### Card shadow

```css
box-shadow: 0 4px 24px rgba(21, 28, 46, 0.08);
```

Use shadows sparingly. Most product cards can rely on border + surface contrast.

### Raised overlay

```css
box-shadow:
  0 12px 36px rgba(21, 28, 46, 0.12),
  0 2px 8px rgba(21, 28, 46, 0.06);
```

For modals, popovers, and floating payment panels only.

---

## 8. Status system

Status is semantic and must not inherit the brand accent automatically.

### Draft

- neutral
- invoice exists but has not been sent

### Sent

- informational blue
- invoice/payment request has been sent to the client

### Payment detected

- violet
- payment has been seen but is not yet considered complete/final by the application

### Paid

- green
- payment is complete according to SatSend's payment rules

### Underpaid

- orange
- payment has been received but amount is insufficient

### Overdue

- red
- payment is required and due date has passed

### Badge construction

```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 28px;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  font: 500 0.8125rem/1 "Geist", sans-serif;
}
```

Use both a coloured dot and text. Do not rely on colour alone.

---

## 9. Components

### Primary button

- Amber background
- White or very dark text depending on audited contrast
- 10px radius
- 44px minimum height
- Geist 600

```css
.button-primary {
  min-height: 44px;
  padding: 0 20px;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--color-brand);
  color: var(--color-ink);
  font-weight: 600;
}
```

### Secondary button

- White surface
- Dark text
- 1px border

### Inputs

- White surface
- 1px warm-neutral border
- 10px radius
- 44px minimum height
- Focus ring uses a translucent amber rather than a heavy amber border

```css
.input:focus-visible {
  border-color: var(--color-brand);
  outline: 3px solid rgba(216, 155, 36, 0.18);
  outline-offset: 1px;
}
```

### Cards

Product cards:

- surface white
- 16px radius
- 1px border
- 20–24px internal padding

Marketing cards can use 24px radius and more generous padding.

---

## 10. Layout language

### Marketing site

- Max content width: 1200–1280px
- Large, typography-led hero
- Product screenshots should be prominent
- Avoid stock photography
- Use real product UI as a major visual asset
- Sections should breathe
- Amber should appear in controlled, high-signal locations

### Product app

- Denser than marketing site
- Strong information hierarchy
- Monetary amounts align cleanly
- Fiat amount is usually primary; BTC amount secondary but clearly visible
- Status tags should be immediately scannable
- Tables and lists must remain calm and mostly neutral

---

## 11. Bitcoin visual language

Target Bitcoin explicitness: **2–2.5 / 5**

Do:

- write “bitcoin” plainly in messaging
- show BTC / sats where relevant in product UI
- show wallet/payment details when relevant
- use Bitcoin-native terminology where the task requires it

Do not:

- use orange/black crypto aesthetics as the general brand
- scatter ₿ symbols decoratively
- use lightning bolts decoratively
- use coins, rockets, cyberpunk imagery, trading-chart aesthetics, or neon gradients
- make the app resemble an exchange or wallet unless the screen actually performs those functions

---

## 12. Accessibility

- Target WCAG 2.2 AA.
- Never encode invoice/payment status by colour alone.
- Minimum interactive target: 44×44px on touch.
- Ensure focus indicators are visible.
- Verify amber button text contrast before shipping; if a chosen amber shade fails with white, use `--color-ink`.
- Body copy should not be lighter than `--color-text-secondary`.

---

## 13. Responsive behavior

### Mobile `< 640px`

- Single-column marketing layouts
- 24px page gutters
- Display headings ~44px max
- Product tables may become stacked rows/cards
- Keep status and amount together where possible

### Tablet `640–1024px`

- 1–2 column layouts
- 32px gutters
- Preserve hierarchy before preserving exact desktop geometry

### Desktop `> 1024px`

- Full layout
- 40–64px outer gutters
- max-width container

---

## 14. Agent implementation rules

When implementing SatSend, the agent should:

1. Install/load **Onest** and **Geist Sans** from an open-source source appropriate to the stack.
2. Define the tokens from `design-tokens.css` at application root.
3. Implement the wordmark as live HTML/CSS for primary navigation.
4. Use amber only for brand/action emphasis.
5. Keep payment states semantic and independent of the brand accent.
6. Prefer product screenshots/UI illustrations to generic decorative imagery.
7. Use borders before shadows for product surfaces.
8. Keep the dashboard mostly neutral.
9. Apply the status system consistently everywhere.
10. Do not invent new brand colours without a clear semantic reason.

---

## 15. Voice cues for visual copy

Brand copy should be:

- concise
- reassuring without sounding corporate
- plain English
- specific
- action-oriented

Prefer:

- “Create invoice”
- “Send payment link”
- “Payment detected”
- “Paid”
- “Get paid in bitcoin”

Avoid:

- “Revolutionize your financial freedom”
- “Join the future of money”
- generic crypto hype
- excessive exclamation marks

---

## 16. Source of truth

For implementation, treat these repo files as the source of truth:

- `DESIGN.md` — rules and rationale
- `design-tokens.css` — CSS variables
- `design-tokens.json` — machine-readable tokens
- `assets/satsend-logo.svg` — clean text-based SVG export for light backgrounds (requires Onest)
- `assets/satsend-logo-reversed.svg` — dark-background logo
- `assets/satsend-logo-monochrome.svg` — single-colour logo
- `assets/satsend-favicon.svg` — favicon concept
- `OPTION-D-reference.png` — visual reference board, **not** a pixel-perfect implementation spec

The written tokens and rules take precedence over accidental inconsistencies in generated reference imagery.
