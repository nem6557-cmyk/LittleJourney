// Regenerates every icon/splash asset from one SVG butterfly mark.
//   node scripts/generate-brand-assets.mjs   (set CHROMIUM_PATH if Playwright's browser isn't installed)
// Uses the Chromium that Playwright already provides — no extra dependencies.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── The mark (1024 x 1024 design space, centred on 512,512) ──
const wings = (fillTop, fillBottom) => `
  <g id="half">
    <path d="M506 488 C470 330 330 236 226 262 C150 282 138 372 188 436 C238 500 374 520 506 506 Z" fill="${fillTop}"/>
    <path d="M506 520 C420 528 308 572 304 664 C300 744 400 770 454 716 C494 676 504 600 506 520 Z" fill="${fillBottom}"/>
    <circle cx="300" cy="378" r="22" fill="#FFD93D" opacity="0.95"/>
    <circle cx="372" cy="658" r="14" fill="#FF6B9D" opacity="0.95"/>
  </g>`;

const mark = ({ top = '#FFFFFF', bottom = '#E7E4FF', body = '#3F3D9E', accent = true } = {}) => `
  <g>
    ${wings(top, bottom)}
    <use href="#half" transform="translate(1024,0) scale(-1,1)"/>
    <rect x="496" y="372" width="32" height="332" rx="16" fill="${body}"/>
    <path d="M504 382 C494 336 470 304 438 284" stroke="${body}" stroke-width="12" stroke-linecap="round" fill="none"/>
    <path d="M520 382 C530 336 554 304 586 284" stroke="${body}" stroke-width="12" stroke-linecap="round" fill="none"/>
    <circle cx="438" cy="284" r="14" fill="${body}"/><circle cx="586" cy="284" r="14" fill="${body}"/>
  </g>
  ${accent ? '' : ''}`;

const gradient = `
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7B73FF"/><stop offset="1" stop-color="#4A42DB"/>
  </linearGradient></defs>`;

// Scale the mark around the centre (used to keep it inside adaptive-icon / splash safe zones).
const scaled = (svg, k) => `<g transform="translate(512 512) scale(${k}) translate(-512 -512)">${svg}</g>`;

const svgDoc = (inner, size = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${inner}</svg>`;

const assets = [
  // iOS/Android store icon: full-bleed, NO transparency (App Store rejects alpha).
  { out: 'assets/icon.png', size: 1024, transparent: false,
    svg: svgDoc(`${gradient}<rect width="1024" height="1024" fill="url(#bg)"/>${scaled(mark(), 1.0)}`) },
  // Android adaptive foreground: mark inside the central 66% safe zone, transparent.
  { out: 'assets/adaptive-icon.png', size: 1024, transparent: true,
    svg: svgDoc(scaled(mark(), 0.62)) },
  // Splash glyph (background colour #6C63FF is set in app.config.ts).
  { out: 'assets/splash-icon.png', size: 1024, transparent: true,
    svg: svgDoc(scaled(mark(), 0.55)) },
  // Android notification small icon: must be white-on-transparent.
  { out: 'assets/notification-icon.png', size: 96, transparent: true,
    svg: svgDoc(scaled(mark({ top: '#FFFFFF', bottom: '#FFFFFF', body: '#FFFFFF' }).replace(/<circle cx="(300|372)"[^>]*\/>/g, ''), 0.9)) },
  { out: 'assets/favicon.png', size: 48, transparent: false,
    svg: svgDoc(`${gradient}<rect width="1024" height="1024" rx="200" fill="url(#bg)"/>${scaled(mark(), 0.95)}`) },
  // PWA / Microsoft Store.
  { out: 'public/icon-192.png', size: 192, transparent: false,
    svg: svgDoc(`${gradient}<rect width="1024" height="1024" fill="url(#bg)"/>${scaled(mark(), 1.0)}`) },
  { out: 'public/icon-512.png', size: 512, transparent: false,
    svg: svgDoc(`${gradient}<rect width="1024" height="1024" fill="url(#bg)"/>${scaled(mark(), 1.0)}`) },
  // Maskable: full-bleed with the mark inside the 80% safe circle.
  { out: 'public/icon-maskable-512.png', size: 512, transparent: false,
    svg: svgDoc(`${gradient}<rect width="1024" height="1024" fill="url(#bg)"/>${scaled(mark(), 0.72)}`) },
  // Microsoft Store tile logos.
  { out: 'public/icon-150.png', size: 150, transparent: false,
    svg: svgDoc(`${gradient}<rect width="1024" height="1024" fill="url(#bg)"/>${scaled(mark(), 0.85)}`) },
  { out: 'public/icon-1024.png', size: 1024, transparent: false,
    svg: svgDoc(`${gradient}<rect width="1024" height="1024" fill="url(#bg)"/>${scaled(mark(), 1.0)}`) },
];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
for (const a of assets) {
  await page.setViewportSize({ width: a.size, height: a.size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${a.svg.replace(/width="\d+" height="\d+"/, `width="${a.size}" height="${a.size}"`)}</body></html>`,
  );
  const target = resolve(root, a.out);
  mkdirSync(dirname(target), { recursive: true });
  await page.screenshot({ path: target, omitBackground: a.transparent, clip: { x: 0, y: 0, width: a.size, height: a.size } });
  console.log('wrote', a.out);
}
await browser.close();
