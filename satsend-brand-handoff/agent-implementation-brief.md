# SatSend implementation brief for coding agents

Read `DESIGN.md` first. Treat it as authoritative.

## Non-negotiable brand decisions

- Direction: Option D / Signal Amber.
- Wordmark: `SatSend` is primary; `.me` is smaller and secondary.
- Display/logo font: Onest.
- UI/body font: Geist Sans.
- Primary brand colour: `#D89B24`.
- Main canvas: `#FCFBF7`.
- Main text: `#151C2E`.
- The app must NOT become green-led.
- Green is reserved for success / Paid.
- Payment detected uses violet.
- Sent uses blue.
- Underpaid uses warning orange.
- Overdue uses red.
- Bitcoin visual explicitness: around 2–2.5 / 5.

## Implementation sequence

1. Load fonts.
2. Import `design-tokens.css` globally.
3. Build or refactor base primitives: Button, Input, Card, StatusBadge.
4. Use the supplied `SatSendLogo.tsx` inline-SVG component for the SatSend wordmark; do not recreate the lockup with separately positioned spans.
5. Apply neutral surfaces and borders across the product before adding amber.
6. Apply semantic status colours.
7. Refactor dashboard/invoice UI around the spacing and type scales.
8. Use product UI itself as the core visual on marketing pages.
9. Check mobile layouts and 44px minimum touch targets.
10. Run accessibility/contrast checks before considering the work complete.

Generated design-board imagery is visual inspiration only. Written tokens and component rules win if there is any disagreement.
