// Rasterise the outlined wordmark for email (v1.5.5, roadmap v1.5.1-H). Most
// email apps do not show SVG, so emails use this PNG. 2x the 132px display width
// keeps it sharp on high-density screens.
//
// Usage: node scripts/brand/raster-logo.mjs   (after build-brand-assets.py)
import sharp from "sharp";

const WIDTH = 264;
await sharp("public/brand/satsend-logo.svg", { density: 72 * (WIDTH / 420) * 2 })
  .resize({ width: WIDTH })
  .png()
  .toFile("public/brand/satsend-logo-email.png");
console.log("wrote public/brand/satsend-logo-email.png");
