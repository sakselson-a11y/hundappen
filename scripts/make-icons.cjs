// Genererar PNG-ikoner från scripts/icon.svg. Kör: node scripts/make-icons.cjs
const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');

const svg = readFileSync(__dirname + '/icon.svg', 'utf8');
const sizes = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 };

(async () => {
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of Object.entries(sizes)) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: `public/icons/${name}` });
}
await browser.close();
})();
