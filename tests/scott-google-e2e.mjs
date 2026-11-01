import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const name = path.endsWith('/sw.js') ? 'sw.js' : path.endsWith('/manifest.webmanifest') ? 'manifest.webmanifest' : 'index.html';
  res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html');
  res.end(await readFile(new URL('../scott/' + name, import.meta.url)));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      const requests = []; page.on('request', r => requests.push(r.url()));
      await page.addInitScript(() => localStorage.setItem('scott_saved_fixture', 'preserved'));
      for (const route of ['', '?tab=protocol', '?tab=history', '?tab=meds', '?tab=library', '#labs']) {
        await page.goto(`http://127.0.0.1:${server.address().port}/scott/${route}`);
        assert.equal((await page.locator('body').innerText()).trim(), 'Google it.');
      }
      await page.clock.install();
      await page.reload();
      let dialogs = 0; page.on('dialog', async dialog => { assert.equal(dialog.message(), 'Google it.'); dialogs++; await dialog.dismiss(); });
      await page.clock.fastForward(3599000); assert.equal(dialogs, 0);
      await page.clock.fastForward(61000); await page.waitForTimeout(100); assert.equal(dialogs, 1);
      await page.clock.fastForward(3600000); await page.waitForTimeout(100); assert.equal(dialogs, 2);
      assert.equal(await page.evaluate(() => localStorage.getItem('scott_saved_fixture')), 'preserved');
      assert.equal(requests.some(url => url.includes('workers.dev')), false);
      assert.deepEqual(errors, []);
      console.log(`${engine.name()}: blank routes, hourly foreground reminder, no record requests, records preserved PASS`);
    } finally { await browser.close(); }
  }
} finally { server.close(); }
