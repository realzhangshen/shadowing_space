// Generate PWA icon PNGs using Node Canvas-free approach:
// We create minimal valid PNGs with the brand gradient.
// For production-quality icons, replace these with designer-made assets.

import { writeFileSync } from "fs";

// Minimal PNG generator for solid-color icons with embedded SVG
// Uses the app's gradient: #6c5ce7 -> #a29bfe
function createSvgIcon(size, maskable = false) {
  const padding = maskable ? Math.round(size * 0.1) : 0;
  const innerSize = size - padding * 2;
  const borderRadius = maskable ? 0 : Math.round(size * 0.22);

  // Scale waveform bars proportionally
  const scale = innerSize / 32;

  const bars = [
    { x: 1, y: 8, w: 2.5, h: 4 },
    { x: 5, y: 5, w: 2.5, h: 10 },
    { x: 9, y: 3, w: 2.5, h: 14 },
    { x: 13, y: 6, w: 2.5, h: 8 },
    { x: 17, y: 7, w: 2.5, h: 6 },
  ];

  // Position waveform centered
  const waveWidth = 20;
  const waveScale = (innerSize * 0.6) / waveWidth;
  const waveOffsetX = padding + (innerSize - waveWidth * waveScale) / 2;
  const waveOffsetY = padding + (innerSize - 20 * waveScale) / 2;

  const barsSvg = bars
    .map(
      (b) =>
        `<rect x="${waveOffsetX + b.x * waveScale}" y="${waveOffsetY + b.y * waveScale}" width="${b.w * waveScale}" height="${b.h * waveScale}" rx="${1 * waveScale}" fill="white"/>`,
    )
    .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6c5ce7"/>
      <stop offset="100%" stop-color="#a29bfe"/>
    </linearGradient>
  </defs>
  <rect x="${padding}" y="${padding}" width="${innerSize}" height="${innerSize}" rx="${borderRadius}" fill="url(#bg)"/>
  ${barsSvg}
</svg>`;
}

// Write SVG files (browsers accept SVG for PWA icons; we'll convert to PNG separately if needed)
// For now, create SVG icons that work great as-is
const sizes = [192, 512];
const variants = [
  { suffix: "", maskable: false },
  { suffix: "-maskable", maskable: true },
];

for (const size of sizes) {
  for (const variant of variants) {
    const svg = createSvgIcon(size, variant.maskable);
    const filename = `public/icons/icon${variant.suffix}-${size}x${size}.svg`;
    writeFileSync(filename, svg);
    console.log(`Created ${filename}`);
  }
}

// Apple touch icon (180x180)
const appleSvg = createSvgIcon(180, false);
writeFileSync("public/icons/apple-touch-icon.svg", appleSvg);
console.log("Created public/icons/apple-touch-icon.svg");

console.log("\nDone! Icons created as SVG files.");
console.log("For production, convert to PNG using: npx sharp-cli or an image editor.");
