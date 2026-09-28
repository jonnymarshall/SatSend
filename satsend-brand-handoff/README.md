# SatSend Brand Handoff

This folder is intended to be copied directly into the SatSend repository.

Start with:

1. `DESIGN.md`
2. `design-tokens.css`
3. `agent-implementation-brief.md`

## Logo usage

For the live React application, prefer `SatSendLogo.tsx`.

It uses the same clean inline-SVG construction as the approved logo and requires **Onest** to be loaded by the application.

The supplied SVG files are scalable and clean, but they currently use SVG text rather than outlined paths:

- `assets/satsend-logo.svg` — light backgrounds
- `assets/satsend-logo-reversed.svg` — dark backgrounds
- `assets/satsend-logo-monochrome.svg` — single-colour applications

Because they use SVG text, they require Onest to render the intended letterforms. Do not describe these files as font-independent or path-based.

For a future standalone media-kit logo, create an outlined-path SVG directly from the Onest font outlines after final approval. Do not raster-trace the logo.

## Reference image

`OPTION-D-reference.png` is a visual reference board. It is not a pixel-perfect specification and should not be used to sample colours or measurements; use the written token files instead.
