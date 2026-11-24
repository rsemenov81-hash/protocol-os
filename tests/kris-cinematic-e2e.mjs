// Kris's real cinematic layer, with synthetic records and all backend traffic intercepted.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, '.playwright/kris-cinematic');
const fixture = {
  _rev: 1, role: 'member', logs: [], labs: [], scans: [],
  compounds: Array.from({ length: 6 }, (_, i) => ({
    id: `cinema-fixture-${i}`, name: `Sample compound ${i + 1}`, active: true,
    category: 'Synthetic', unit: 'mcg', doseMcg: 1000, mcgPerUnit: 100,
    timing: 'Morning', schedule: { days: [0, 1, 2, 3, 4, 5, 6] },
    purpose: 'Synthetic interface fixture.',
  })),
};
const mime = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json',
};
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://local').pathname;
    const filename = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!filename.startsWith(root + sep)) throw new Error('Invalid path');
    const data = await readFile(filename);
    res.setHeader('Content-Type', mime[extname(filename)] || 'application/octet-stream');
    res.end(data);
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = process.env.KRIS_VISUAL_URL || `http://127.0.0.1:${server.address().port}/kris/`;
const browser = await chromium.launch(process.env.KRIS_BROWSER_CHANNEL ? { channel: process.env.KRIS_BROWSER_CHANNEL } : {});
await mkdir(output, { recursive: true });

try {
  for (const mode of ['motion', 'reduced', 'save-data', 'paused']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
      reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference',
    });
    let videoRequests = 0, writes = 0;
    const errors = [], unexpectedBackend = [], failedAssets = [];
    await context.route('**/*', route => {
      const req = route.request(), url = new URL(req.url());
      if (url.hostname.endsWith('.workers.dev')) {
        if (url.hostname !== 'kris-protocol.rsemenov81.workers.dev') {
          unexpectedBackend.push(url.hostname); return route.abort();
        }
        if (req.method() === 'GET' && url.pathname === '/state') return route.fulfill({ json: fixture });
        writes++; return route.abort();
      }
      if (/\.(mp4|webm)$/.test(url.pathname)) videoRequests++;
      if (url.origin === new URL(base).origin) return route.continue();
      return route.abort();
    });
    await context.addInitScript(({ mode }) => {
      localStorage.setItem('kris_token', 'synthetic-preview-only');
      // Scott's preference must neither control Kris nor be overwritten by him.
      localStorage.setItem('scott_motion_paused', mode === 'paused' ? '0' : '1');
      if (mode === 'paused') localStorage.setItem('kris_motion_paused', '1');
      if (mode === 'save-data') Object.defineProperty(navigator, 'connection', {
        value: { saveData: true, addEventListener() {} },
      });
    }, { mode });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400 && new URL(response.url()).origin === new URL(base).origin) failedAssets.push(response.url());
    });
    await page.goto(base);
    await page.getByRole('tab', { name: 'Today', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    const video = page.locator('#ambient-video'), button = page.locator('#motion-toggle');

    if (mode === 'motion') {
      await page.waitForFunction(() => document.querySelector('video').currentTime > 0.1);
      assert.equal(await video.evaluate(v => v.muted && v.loop && v.playsInline), true);
      assert.equal(await video.evaluate(v => v.videoWidth > 0 && v.videoHeight > 0), true);
      const firstTime = await video.evaluate(v => v.currentTime);
      await page.waitForFunction(time => document.querySelector('video').currentTime > time + 0.15, firstTime);
      assert.match(await video.getAttribute('src'), /\/scott\/assets\/autumn-dc-blue-hour\.(mp4|webm)$/);
      assert.ok(videoRequests > 0);

      await button.click();
      await page.waitForFunction(() => document.querySelector('video').paused);
      assert.equal(await button.textContent(), 'Play background');
      assert.equal(await page.evaluate(() => localStorage.getItem('kris_motion_paused')), '1');
      assert.equal(await page.evaluate(() => localStorage.getItem('scott_motion_paused')), '1');
      await button.click();
      await page.waitForFunction(() => !document.querySelector('video').paused);
      await page.screenshot({ path: resolve(output, 'mobile-synthetic.png'), fullPage: true });

      await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
      await page.waitForFunction(() => {
        const v = document.querySelector('video');
        return v.getBoundingClientRect().bottom <= 0 && v.paused;
      });
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForFunction(() => !document.querySelector('video').paused);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({ path: resolve(output, 'desktop-synthetic.png'), fullPage: true });
      for (const label of ['Today', 'Library', 'Labs', 'Progress']) {
        await page.getByRole('tab', { name: label, exact: true }).click();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(await page.locator('#ambient-video').count(), 1);
      }
      await button.click();
      await page.reload();
      await page.waitForLoadState('networkidle');
      assert.equal(await video.getAttribute('src'), null);
      assert.equal(await button.textContent(), 'Play background');
    } else {
      await page.waitForLoadState('networkidle');
      assert.equal(await video.getAttribute('src'), null);
      assert.equal(videoRequests, 0);
      assert.equal(await video.evaluate(v => v.paused), true);
      assert.equal(await button.textContent(), mode === 'paused' ? 'Play background' : 'Motion off');
      if (mode === 'reduced') await page.screenshot({ path: resolve(output, 'reduced-synthetic.png'), fullPage: true });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpectedBackend, []);
    assert.deepEqual(failedAssets, []);
    assert.equal(writes, 0);
    await context.close();
    console.log(`PASS Kris cinematic ${mode}`);
  }
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
