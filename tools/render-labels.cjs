// Usage: node tools/render-labels.cjs <html file> <out dir> [scale]
// Screenshots every element carrying data-shot="<name>" into <out dir>/<name>.png (needs the preinstalled Playwright Chromium).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const html = process.argv[2];
  const out = process.argv[3];
  const scale = Number(process.argv[4] || '2');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1900, height: 1200 }, deviceScaleFactor: scale });
  await page.goto('file://' + path.resolve(html));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);
  const fonts = await page.evaluate(() => Array.from(document.fonts).filter((f) => f.status === 'loaded').map((f) => f.family));
  console.log('fonts loaded:', Array.from(new Set(fonts)).join(', ') || '(none)');
  const handles = await page.$$('[data-shot]');
  for (const h of handles) {
    const name = await h.getAttribute('data-shot');
    await h.screenshot({ path: path.join(out, name + '.png') });
    console.log('shot', name);
  }
  await browser.close();
})();
