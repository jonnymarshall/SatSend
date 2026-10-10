#!/usr/bin/env python3
"""Generate the font-independent SatSend app icon (v1.5-H).

The handoff favicon (satsend-brand-handoff/assets/satsend-favicon.svg) draws its
"S" as live text in Onest. Browsers render favicons in isolation, without the
page's web fonts, so that "S" falls back to Arial. This script copies the handoff
geometry exactly but replaces the text with the real Onest 800 glyph outline.

Usage (needs `pip install fonttools` and the Onest variable font from
https://github.com/google/fonts/tree/main/ofl/onest):

    python3 scripts/brand/outline-mark.py path/to/Onest[wght].ttf > src/app/icon.svg

PNG/ICO sizes are rasterised from that SVG; see manual-tests/v1.5-H-redesign.md.
"""
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

# Handoff geometry (satsend-favicon.svg): <text x="14" y="44" font-size="38"
# font-weight="800">S</text>, ink tile 60x60 rx 15, amber dot r 5 at (48, 43).
X, BASELINE, SIZE, WEIGHT = 14, 44, 38, 800
INK, CANVAS, BRAND = "#151C2E", "#FCFBF7", "#D89B24"


def glyph_path(font_file: str, char: str) -> str:
    font = instantiateVariableFont(TTFont(font_file), {"wght": WEIGHT})
    glyph_set = font.getGlyphSet()
    name = font.getBestCmap()[ord(char)]
    scale = SIZE / font["head"].unitsPerEm
    pen = SVGPathPen(glyph_set, lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    # Font units are y-up; SVG is y-down, with the baseline at y=BASELINE.
    glyph_set[name].draw(TransformPen(pen, (scale, 0, 0, -scale, X, BASELINE)))
    return pen.getCommands()


def main() -> None:
    d = glyph_path(sys.argv[1], "S")
    print(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">\n'
        f'  <rect x="2" y="2" width="60" height="60" rx="15" fill="{INK}"/>\n'
        f'  <path fill="{CANVAS}" d="{d}"/>\n'
        f'  <circle cx="48" cy="43" r="5" fill="{BRAND}"/>\n'
        "</svg>"
    )


if __name__ == "__main__":
    main()
