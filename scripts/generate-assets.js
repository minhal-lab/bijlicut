/**
 * generate-assets.js — BijliCut brand asset generator.
 *
 * Renders crisp dark-mode/amber PNGs from inline SVG using `sharp`:
 *   • assets/icon.png   (1024×1024) — charcoal bg + glowing amber bolt
 *   • assets/splash.png (2048×2048) — dark bg + bolt + "BijliCut" wordmark
 *
 * Run: node scripts/generate-assets.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BOLT = 'M13 2L3 14h9l-1 8 10-12h-9l1-8z'; // 24×24 viewBox bolt

const defs = (glowStdDev) => `
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="78%">
      <stop offset="0%" stop-color="#1e1e1e"/>
      <stop offset="100%" stop-color="#0d0d0d"/>
    </radialGradient>
    <linearGradient id="bolt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#ffd35c"/>
      <stop offset="55%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#ff7a00"/>
    </linearGradient>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="${glowStdDev}" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>`;

// Centre the bolt (its bbox centre ≈ 12,12) at (cx,cy) and scale it up.
const bolt = (cx, cy, scale) =>
  `<g filter="url(#glow)" transform="translate(${cx},${cy}) scale(${scale}) translate(-12,-12)">
     <path d="${BOLT}" fill="url(#bolt)" stroke="#ffe08a" stroke-width="0.4"/>
   </g>`;

const iconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  ${defs(16)}
  <rect width="1024" height="1024" fill="url(#bg)"/>
  ${bolt(512, 512, 34)}
</svg>`;

const splashSvg = `
<svg width="2048" height="2048" viewBox="0 0 2048 2048" xmlns="http://www.w3.org/2000/svg">
  ${defs(22)}
  <rect width="2048" height="2048" fill="#121212"/>
  ${bolt(1024, 780, 30)}
  <text x="1024" y="1360" text-anchor="middle"
        font-family="'Segoe UI','Helvetica Neue',Arial,sans-serif"
        font-size="210" font-weight="800" letter-spacing="-4">
    <tspan fill="#ffffff">Bijli</tspan><tspan fill="#f59e0b">Cut</tspan>
  </text>
  <text x="1024" y="1470" text-anchor="middle"
        font-family="'Segoe UI','Helvetica Neue',Arial,sans-serif"
        font-size="62" font-weight="500" letter-spacing="6" fill="#6b7280">
    DECODE YOUR BILL
  </text>
</svg>`;

async function main() {
  const out = path.join(__dirname, '..', 'assets');
  fs.mkdirSync(out, { recursive: true });

  await sharp(Buffer.from(iconSvg)).png().toFile(path.join(out, 'icon.png'));
  await sharp(Buffer.from(splashSvg)).png().toFile(path.join(out, 'splash.png'));

  for (const f of ['icon.png', 'splash.png']) {
    const meta = await sharp(path.join(out, f)).metadata();
    console.log(`✓ assets/${f} — ${meta.width}×${meta.height}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
