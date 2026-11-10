// Vitae Lab storefront prototype (vitae-lab/site): layout stability, motion modes, product views and
// the preview cart. Everything is local; font requests are blocked so the run needs no network.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const shots = resolve(root, '.playwright/vitae-site');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp4': 'video/mp4', '.webm': 'video/webm', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://local').pathname;
    const file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(root + '/')) throw Error();
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = process.env.VITAE_URL || `http://127.0.0.1:${server.address().port}/vitae-lab/site/`;
const FDA = 'These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.';
const RETIRED = ['Explore collection', 'Research-informed essentials', 'Everyday, considered', 'Protein, creatine, vitamins and minerals', 'Clear serving sizes. Ingredients you can inspect'];
const browser = await chromium.launch();
await mkdir(shots, { recursive: true });
let ran = 0;

async function open(opts = {}, hash = '') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts.context });
  const seen = { video: 0, errors: [] };
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (/\.(mp4|webm)$/.test(u.pathname)) { seen.video++; if (opts.noVideo) return route.abort(); }
    return u.origin === new URL(base).origin ? route.continue() : route.abort();   // fonts stay offline
  });
  if (opts.init) await context.addInitScript(opts.init);
  const page = await context.newPage();
  page.on('pageerror', (e) => seen.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) seen.errors.push(m.text()); });
  await page.goto(base + hash, { waitUntil: 'load' });
  return { context, page, seen };
}
// Motion off: all four goals and all six product names end up fully opaque (waits out the fade).
const allShown = (page) => page.waitForFunction(() => [...document.querySelectorAll('.rotator > li')].filter((li) => getComputedStyle(li).opacity === '1' && li.offsetHeight > 0).length === 10, null, { timeout: 5000 });
async function check(name, fn) { await fn(); ran++; console.log('ok', name); }

try {
  await check('no horizontal overflow from 320 to 1440 px, home and product', async () => {
    for (const [w, h] of [[320, 568], [390, 844], [768, 1024], [844, 390], [1440, 900]]) {
      for (const hash of ['', '#vanilla-whey-isolate']) {
        const { context, page, seen } = await open({ context: { viewport: { width: w, height: h } } }, hash);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        assert.ok(over <= 0, `${w}px ${hash || 'home'} overflows by ${over}px`);
        assert.deepEqual(seen.errors, []);
        if (!hash) await page.screenshot({ path: resolve(shots, `home-${w}.png`) });
        await context.close();
      }
    }
  });

  await check('opening rotates without moving anything', async () => {
    const { context, page } = await open();
    const box = () => page.evaluate(() => ['.rotator--goals', '#product-rotator', '#hero-packs', '.lede'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.top, r.height].map(Math.round); }));
    const word = () => page.locator('.rotator--goals > .is-on').textContent();
    const before = await box(), first = await word();
    assert.equal(first, 'Strength');
    await page.waitForFunction((w) => document.querySelector('.rotator--goals > .is-on').textContent !== w, first);
    await page.waitForFunction(() => document.querySelector('#product-rotator > .is-on a').getAttribute('href') !== '#creatine-monohydrate');
    assert.deepEqual(await box(), before);
    assert.deepEqual(await page.locator('.rotator--goals > li').allTextContents(), ['Strength', 'Longevity', 'Everyday vitality', 'Wellness']);
    // The static list of names is the catalogue in products.js, in order.
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#product-rotator a')].map((a) => [a.hash.slice(1), a.textContent])), await page.evaluate(() => VITAE_PRODUCTS.map((p) => [p.handle, p.name])));
    // The artwork shown always belongs to the product named.
    const pair = await page.evaluate(() => [document.querySelector('#product-rotator > .is-on a').getAttribute('href').slice(1), document.querySelector('#hero-packs > .is-on').dataset.handle]);
    assert.equal(pair[0], pair[1]);
    // Only the visible product link takes keyboard focus.
    assert.equal(await page.locator('#product-rotator a:not([tabindex="-1"])').count(), 1);
    await context.close();
  });

  await check('required and retired copy', async () => {
    const { context, page } = await open();
    const home = await page.locator('body').innerText();
    for (const s of RETIRED) assert.ok(!home.includes(s), `retired copy is back: ${s}`);
    assert.ok(home.includes(FDA));
    assert.equal(await page.locator('.opening .btn, .opening button').count(), 0, 'no button in the opening');
    assert.ok(!(await page.content()).includes('aggregateRating'));
    assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'noindex, nofollow');
    await context.close();
  });

  await check('real state: nothing can be added to a cart', async () => {
    const { context, page } = await open();
    assert.equal(await page.locator('[data-add]').count(), 0);
    assert.equal(await page.locator('#stories .btn[disabled]').count(), 6);
    await page.goto(base + '#vitamin-d3');
    await page.locator('#product-view h1').waitFor();
    assert.equal(await page.locator('#product-view .buy .btn').isDisabled(), true);
    assert.ok((await page.locator('#product-view').innerText()).includes('not available to buy yet'));
    await context.close();
  });

  await check('product view: focus, title, label facts, disclaimer, way back', async () => {
    const { context, page } = await open();
    await page.locator('#compare-body a[href="#magnesium-glycinate"]').click();
    await page.locator('#product-view h1').waitFor();
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'H1');
    assert.equal(await page.title(), 'Magnesium glycinate | Vitae Lab');
    const text = await page.locator('#product-view').innerText();
    for (const s of ['275 mg', '2,500 mg', '3 capsules', 'take three (3) capsules once daily', FDA]) assert.ok(text.includes(s), s);
    assert.equal(await page.locator('#home-view').isHidden(), true);
    await page.screenshot({ path: resolve(shots, 'product-390.png') });
    await page.locator('.product__back').click();
    await page.locator('#home-view').waitFor();
    assert.equal(await page.locator('#product-view').isHidden(), true);
    await context.close();
  });

  await check('simulated cart: add, change, persist, remove, honest checkout handoff', async () => {
    const { context, page } = await open({ init: () => localStorage.getItem('vitae-sim') ?? localStorage.setItem('vitae-sim', 'true') });
    await page.locator('#story-creatine-monohydrate [data-add]').click();
    const cart = page.locator('#cart');
    await cart.waitFor();
    assert.equal(await page.locator('#cart-count').textContent(), '(1)');
    await cart.getByRole('button', { name: 'Increase quantity of Creatine monohydrate' }).click();
    assert.equal(await cart.locator('.cart__line output').textContent(), '2');
    assert.equal(await page.evaluate(() => document.querySelector('#cart').contains(document.activeElement)), true, 'focus stays in the dialog');
    assert.equal(await page.locator('#cart-subtotal').textContent(), 'Shown once prices are set');
    await page.locator('#checkout-btn').click();
    assert.match(await page.locator('#cart-handoff').textContent(), /no order was placed and nothing was charged/);
    await page.keyboard.press('Escape');
    assert.equal(await cart.evaluate((d) => d.open), false);
    await page.reload();
    assert.equal(await page.locator('#cart-count').textContent(), '(2)', 'cart survives a reload');
    // Product page quantity adds to what is already there.
    await page.goto(base + '#creatine-monohydrate');
    await page.getByRole('button', { name: 'Increase quantity', exact: true }).click();
    await page.locator('#product-view [data-add]').click();
    assert.equal(await page.locator('#cart-count').textContent(), '(4)');
    await page.screenshot({ path: resolve(shots, 'cart-390.png') });
    await cart.getByRole('button', { name: /Remove/ }).click();
    assert.equal(await page.locator('#cart-count').textContent(), '(0)');
    assert.ok((await cart.innerText()).includes('Your cart is empty.'));
    assert.equal(await page.locator('#cart-foot').isHidden(), true);
    await context.close();
  });

  await check('cart failure is reported and changes nothing', async () => {
    const { context, page } = await open({ init: () => { localStorage.setItem('vitae-sim', 'true'); window.VITAE_FAIL_CART = true; } });
    await page.locator('#story-vitamin-d3 [data-add]').click();
    const alert = page.locator('#cart-error');
    await alert.waitFor();
    assert.match(await alert.textContent(), /couldn’t update your cart/);
    assert.equal(await page.locator('#cart-count').textContent(), '(0)');
    await page.evaluate(() => { window.VITAE_FAIL_CART = false; });
    await page.locator('#cart-close').click();
    await page.locator('#story-vitamin-d3 [data-add]').click();
    assert.equal(await page.locator('#cart-count').textContent(), '(1)', 'recovers on retry');
    assert.equal(await alert.isHidden(), true);
    await context.close();
  });

  await check('motion on: one loop, after load, pausable and remembered', async () => {
    const { context, page, seen } = await open();
    await page.waitForFunction(() => document.querySelector('.scene__video').currentTime > 0.1);
    assert.equal(await page.evaluate(() => { const v = document.querySelector('.scene__video'); return v.muted && v.loop && v.playsInline && /water-640\.(mp4|webm)$/.test(v.currentSrc); }), true);
    const btn = page.locator('#motion-btn');
    assert.equal(await btn.textContent(), 'Pause motion');
    await btn.click();
    await page.waitForFunction(() => document.querySelector('.scene__video').paused);
    assert.equal(await btn.textContent(), 'Play motion');
    assert.equal(await btn.getAttribute('aria-pressed'), 'true');
    await allShown(page);
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-motion'), 'off');
    assert.equal(seen.video, 1, 'the loop is not fetched again while paused');
    await context.close();
  });

  for (const [name, opts] of [
    ['reduced motion', { context: { reducedMotion: 'reduce' } }],
    ['save-data', { init: () => Object.defineProperty(navigator, 'connection', { value: { saveData: true } }) }],
  ]) {
    await check(`${name}: poster only, no video request, nothing lost`, async () => {
      const { context, page, seen } = await open(opts);
      await page.waitForTimeout(600);
      assert.equal(seen.video, 0);
      assert.equal(await page.locator('.scene__poster').evaluate((i) => i.complete && i.naturalWidth > 0), true);
      assert.equal(await page.locator('#stories .story').count(), 6);
      if (name === 'reduced motion') {
        await allShown(page);
        assert.equal(await page.locator('#motion-btn').textContent(), 'Play motion');
        await page.screenshot({ path: resolve(shots, 'reduced-motion-390.png') });
      }
      assert.deepEqual(seen.errors, []);
      await context.close();
    });
  }

  await check('no H.264 in the browser: the WebM loop plays instead', async () => {
    // Playwright's open-source Chromium (CI) has no H.264 decoder; force the same answer everywhere.
    const { context, page, seen } = await open({ init: () => { HTMLMediaElement.prototype.canPlayType = (t) => (/mp4/.test(t) ? '' : 'probably'); } });
    await page.waitForFunction(() => document.querySelector('.scene__video').currentTime > 0.1);
    assert.equal(await page.evaluate(() => document.querySelector('.scene__video').currentSrc.endsWith('water-640.webm')), true);
    assert.equal(seen.video, 1);
    await context.close();
  });

  await check('video unavailable: the poster stays and the page still works', async () => {
    const { context, page, seen } = await open({ noVideo: true });
    await page.waitForTimeout(600);
    assert.equal(await page.locator('.scene__video').evaluate((v) => v.classList.contains('is-playing')), false);
    assert.equal(await page.locator('#stories .story').count(), 6);
    assert.deepEqual(seen.errors, []);
    await context.close();
  });

  await check('keyboard: skip link, menu, dialog returns focus', async () => {
    const { context, page } = await open();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'skip');
    const menu = page.locator('#menu-btn');
    await menu.focus();
    await page.keyboard.press('Enter');
    assert.equal(await menu.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#primary-nav a').first().isVisible(), true);
    await page.locator('#cart-btn').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#cart').evaluate((d) => d.open), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'cart-btn');
    await context.close();
  });

  console.log(`\nvitae-site: ${ran} checks passed`);
} finally {
  await browser.close();
  server.close();
}
