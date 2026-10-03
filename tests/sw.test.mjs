// Service worker tests — sw.js evaluated in a vm context with a fake `self` (listeners captured, fake
// caches/clients/registration), plus the PWA wiring it depends on: manifest, icons and head.html.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { decodePNG, COLORS, ICONS } from '../tools/make-icons.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SW_SRC = readFileSync(join(root, 'sw.js'), 'utf8');
const ORIGIN = 'https://rsemenov81-hash.github.io';
const SCOPE = ORIGIN + '/protocol-os/';

function loadSW({ clients = [] } = {}) {
  const listeners = {};
  const calls = { showNotification: [], openWindow: [], focus: [], postMessage: [], claim: 0, skipWaiting: 0, addAll: [], deleted: [] };
  const sandbox = {
    console, URL, setTimeout, clearTimeout,
    caches: {
      open: async () => ({ addAll: async (a) => { calls.addAll.push(a); }, match: async () => undefined, put: async () => {} }),
      keys: async () => ['protocol-os-v16', 'protocol-os-v17'],
      delete: async (k) => { calls.deleted.push(k); return true; },
    },
    fetch: async () => { throw new TypeError('network is off in tests'); },
  };
  sandbox.self = sandbox;
  sandbox.location = { origin: ORIGIN, href: SCOPE + 'sw.js' };
  sandbox.addEventListener = (type, fn) => { listeners[type] = fn; };
  sandbox.skipWaiting = () => { calls.skipWaiting++; };
  sandbox.registration = { scope: SCOPE, showNotification: async (title, options) => { calls.showNotification.push({ title, options }); } };
  sandbox.clients = {
    claim: async () => { calls.claim++; },
    matchAll: async () => clients,
    openWindow: async (url) => { calls.openWindow.push(url); return null; },
  };
  vm.createContext(sandbox);
  vm.runInContext(SW_SRC, sandbox, { filename: 'sw.js' });
  const consts = vm.runInContext('({ CACHE, ASSETS })', sandbox);
  return { sandbox, listeners, calls, ...consts };
}

// Objects built inside the vm context have another realm's Object.prototype, which strict deepEqual rejects.
const plain = (v) => JSON.parse(JSON.stringify(v));

const client = (url, calls) => ({ url, focus: async function () { calls.focus.push(url); return this; }, postMessage: (m) => calls.postMessage.push({ url, m }) });

function pushEvent(payload) {
  const waits = [];
  const ev = {
    data: payload === null ? null : {
      json: () => (typeof payload === 'string' ? JSON.parse(payload) : payload),
      text: () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
    },
    waitUntil: (p) => waits.push(p),
  };
  return { ev, done: () => Promise.all(waits) };
}

function clickEvent(data) {
  const waits = [];
  const state = { closed: false };
  const ev = { notification: { data, close() { state.closed = true; } }, waitUntil: (p) => waits.push(p) };
  return { ev, done: () => Promise.all(waits), state };
}

// ── Registration and precache ────────────────────────────────────────────────────────────────────
describe('sw.js shape', () => {
  test('registers install, activate, fetch, push and notificationclick', () => {
    const { listeners } = loadSW();
    assert.deepEqual(Object.keys(listeners).sort(), ['activate', 'fetch', 'install', 'notificationclick', 'push']);
  });
  test('CACHE is bumped to v17 and ASSETS precache the manifest and icons', () => {
    const { CACHE, ASSETS } = loadSW();
    assert.equal(CACHE, 'protocol-os-v17');
    for (const a of ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png']) {
      assert.ok(ASSETS.includes(a), 'ASSETS missing ' + a);
    }
    assert.ok(ASSETS.every(a => a.startsWith('./')), 'every asset is relative (GitHub Pages subpath)');
  });
  test('every precached asset exists in the repo root', () => {
    const { ASSETS } = loadSW();
    for (const a of ASSETS) {
      const p = join(root, a === './' ? 'index.html' : a);
      assert.ok(existsSync(p), a + ' does not exist on disk; addAll would fail the install');
    }
  });
  test('install precaches ASSETS and skips waiting', async () => {
    const { listeners, calls, ASSETS } = loadSW();
    const waits = [];
    listeners.install({ waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);
    assert.equal(calls.skipWaiting, 1);
    assert.deepEqual(calls.addAll, [ASSETS]);
  });
  test('activate drops older caches and claims clients', async () => {
    const { listeners, calls } = loadSW();
    const waits = [];
    listeners.activate({ waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);
    assert.deepEqual(calls.deleted, ['protocol-os-v16']);
    assert.equal(calls.claim, 1);
  });
  test('fetch: non-GET and cross-origin requests are left to the network; same-origin GETs are handled', () => {
    const { listeners } = loadSW();
    let handled = 0;
    const ev = (req) => ({ request: req, respondWith: (p) => { handled++; p.catch(() => {}); } });
    listeners.fetch(ev({ method: 'POST', url: SCOPE + 'index.html', mode: 'navigate' }));
    listeners.fetch(ev({ method: 'GET', url: 'https://protocol-sync.example.workers.dev/sync?profile=all', mode: 'cors' }));
    assert.equal(handled, 0);
    listeners.fetch(ev({ method: 'GET', url: SCOPE + 'icons/icon-192.png', mode: 'no-cors' }));
    assert.equal(handled, 1);
  });
});

// ── push ─────────────────────────────────────────────────────────────────────────────────────────
describe('push', () => {
  const payload = { title: 'Morning block', body: 'Testosterone 20 mg · BPC-157 500 mcg', data: { profile: 'Roman', block: 'am', date: '2026-10-03', url: './index.html?block=am&date=2026-10-03' } };

  test('shows a notification with the parsed title, body, tag, icon and data', async () => {
    const { listeners, calls } = loadSW();
    const { ev, done } = pushEvent(payload);
    listeners.push(ev);
    await done();
    assert.equal(calls.showNotification.length, 1);
    const { title, options } = calls.showNotification[0];
    assert.equal(title, 'Morning block');
    assert.equal(options.body, 'Testosterone 20 mg · BPC-157 500 mcg');
    assert.equal(options.tag, 'block-2026-10-03-am');
    assert.equal(options.renotify, true);
    assert.equal(options.icon, './icons/icon-192.png');
    assert.equal(options.badge, './icons/icon-192.png');
    assert.deepEqual(plain(options.data), payload.data);
  });

  test('a JSON string payload is parsed the same way', async () => {
    const { listeners, calls } = loadSW();
    const { ev, done } = pushEvent(JSON.stringify(payload));
    listeners.push(ev);
    await done();
    assert.equal(calls.showNotification[0].options.tag, 'block-2026-10-03-am');
  });

  test('a plain-text payload falls back to text() as the body', async () => {
    const { listeners, calls } = loadSW();
    const { ev, done } = pushEvent('Time for your evening block');
    listeners.push(ev);
    await done();
    const { title, options } = calls.showNotification[0];
    assert.equal(title, 'Protocol OS');
    assert.equal(options.body, 'Time for your evening block');
    assert.equal(options.tag, undefined);
    assert.equal(options.renotify, undefined, 'renotify is only set with a tag (Chromium throws otherwise)');
    assert.deepEqual(plain(options.data), {});
  });

  test('no block → no tag; an empty push still shows something', async () => {
    const { listeners, calls } = loadSW();
    const a = pushEvent({ title: 'Test reminder', body: 'Reminders are working' });
    listeners.push(a.ev); await a.done();
    assert.equal(calls.showNotification[0].title, 'Test reminder');
    assert.equal('tag' in calls.showNotification[0].options, false);
    const b = pushEvent(null);
    listeners.push(b.ev); await b.done();
    assert.equal(calls.showNotification[1].title, 'Protocol OS');
    assert.equal(calls.showNotification[1].options.body, '');
  });

  test('top-level block/date/url are accepted when the Worker flattens the payload', async () => {
    const { listeners, calls } = loadSW();
    const { ev, done } = pushEvent({ title: 'Pre block', body: 'x', block: 'pre', date: '2026-10-04' });
    listeners.push(ev);
    await done();
    assert.equal(calls.showNotification[0].options.tag, 'block-2026-10-04-pre');
    assert.deepEqual(plain(calls.showNotification[0].options.data), { block: 'pre', date: '2026-10-04' });
  });
});

// ── notificationclick ────────────────────────────────────────────────────────────────────────────
describe('notificationclick', () => {
  const data = { profile: 'Roman', block: 'am', date: '2026-10-03', url: './index.html?block=am&date=2026-10-03' };

  test('focuses an open client under the scope and posts open-block to it (no new window)', async () => {
    const w = loadSW({ clients: [] });
    w.sandbox.clients.matchAll = async () => [client('https://other.example/', w.calls), client(SCOPE + 'index.html', w.calls), client(SCOPE + 'index.html#today', w.calls)];
    const { ev, done, state } = clickEvent(data);
    w.listeners.notificationclick(ev);
    await done();
    assert.equal(state.closed, true);
    assert.deepEqual(w.calls.focus, [SCOPE + 'index.html'], 'first in-scope client only');
    assert.deepEqual(plain(w.calls.postMessage), [{ url: SCOPE + 'index.html', m: { type: 'open-block', data } }]);
    assert.deepEqual(w.calls.openWindow, []);
  });

  test('opens data.url when no client is under the scope', async () => {
    const w = loadSW({ clients: [] });
    w.sandbox.clients.matchAll = async () => [client(ORIGIN + '/other-app/', w.calls)];
    const { ev, done, state } = clickEvent(data);
    w.listeners.notificationclick(ev);
    await done();
    assert.equal(state.closed, true);
    assert.deepEqual(w.calls.focus, []);
    assert.deepEqual(w.calls.postMessage, []);
    assert.deepEqual(w.calls.openWindow, ['./index.html?block=am&date=2026-10-03']);
  });

  test('opens ./index.html when the payload carries no url, and survives a missing data object', async () => {
    const w = loadSW({ clients: [] });
    const a = clickEvent({ block: 'pm' });
    w.listeners.notificationclick(a.ev); await a.done();
    const b = clickEvent(undefined);
    w.listeners.notificationclick(b.ev); await b.done();
    assert.deepEqual(w.calls.openWindow, ['./index.html', './index.html']);
  });

  test('a client whose focus() rejects still gets the message', async () => {
    const w = loadSW({ clients: [] });
    const c = client(SCOPE + 'index.html', w.calls);
    c.focus = async () => { throw new Error('not allowed'); };
    w.sandbox.clients.matchAll = async () => [c];
    const { ev, done } = clickEvent(data);
    w.listeners.notificationclick(ev);
    await done();
    assert.equal(w.calls.postMessage.length, 1);
    assert.deepEqual(w.calls.openWindow, []);
  });
});

// ── PWA wiring: manifest, icons, head ────────────────────────────────────────────────────────────
describe('manifest.webmanifest', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
  test('has the installable-app fields with relative paths', () => {
    assert.equal(manifest.name, 'Protocol OS');
    assert.equal(manifest.short_name, 'Protocol');
    assert.ok(manifest.description && manifest.description.length > 20);
    assert.equal(manifest.start_url, './index.html');
    assert.equal(manifest.scope, './');
    assert.equal(manifest.id, './');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.orientation, 'portrait');
    assert.equal(manifest.background_color, '#0e2820');
    assert.equal(manifest.theme_color, '#0e2820');
  });
  test('icons: 192 + 512 any, 512 maskable, all present on disk and precached by the service worker', () => {
    const { ASSETS } = loadSW();
    const byPurpose = (p) => manifest.icons.filter(i => i.purpose === p).map(i => i.src);
    assert.deepEqual(byPurpose('any'), ['./icons/icon-192.png', './icons/icon-512.png']);
    assert.deepEqual(byPurpose('maskable'), ['./icons/maskable-512.png']);
    for (const i of manifest.icons) {
      assert.equal(i.type, 'image/png');
      assert.match(i.sizes, /^\d+x\d+$/);
      assert.ok(existsSync(join(root, i.src)), i.src + ' missing');
      assert.ok(ASSETS.includes(i.src), i.src + ' not precached');
    }
  });
});

describe('icons/', () => {
  const near = (a, b, tol = 2) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  const expectSizes = { 'icon-192.png': 192, 'icon-512.png': 512, 'maskable-512.png': 512, 'apple-touch-icon.png': 180 };
  test('tools/make-icons.mjs lists exactly the four PNGs', () => assert.deepEqual(ICONS.map(i => i.file).sort(), Object.keys(expectSizes).sort()));
  for (const [file, size] of Object.entries(expectSizes)) {
    test(`${file} is a valid ${size}x${size} RGBA PNG carrying the mark`, () => {
      const buf = readFileSync(join(root, 'icons', file));
      const png = decodePNG(buf); // throws on a bad signature, CRC, chunk order or size
      assert.equal(png.width, size);
      assert.equal(png.height, size);
      assert.equal(png.bitDepth, 8);
      assert.equal(png.colorType, 6, 'RGBA');
      assert.equal(png.interlace, 0);
      assert.equal(png.chunks[0], 'IHDR');
      assert.equal(png.chunks[png.chunks.length - 1], 'IEND');
      assert.ok(png.chunks.includes('IDAT'));
      assert.equal(manifestSizeOf(file), size);
      const c = Math.floor(size / 2);
      assert.ok(near(png.pixel(0, 0), [...COLORS.bg, 255]), 'corner is the emerald background');
      assert.ok(near(png.pixel(c, c), [...COLORS.dot, 255]), 'centre is the inner dot');
      const probe = png.pixel(Math.round(c + 0.22 * size), c);
      if (file === 'maskable-512.png') assert.ok(near(probe, [...COLORS.bg, 255]), 'maskable mark is smaller (safe zone)');
      else assert.ok(near(probe, [...COLORS.gold, 255]), 'gold disc at 22 % from centre');
      const R = ICONS.find(i => i.file === file).mark * size / 2;
      assert.ok(near(png.pixel(Math.round(c + 1.24 * R), c), [...COLORS.ring, 255]), 'lighter ring at 1.24 R');
      assert.ok(near(png.pixel(Math.round(c + 1.10 * R), c), [...COLORS.bg, 255]), 'gap between disc and ring');
      assert.equal(png.pixel(c, 1)[3], 255, 'opaque');
    });
  }
  function manifestSizeOf(file) {
    if (file === 'apple-touch-icon.png') return 180;
    const m = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8')).icons.find(i => i.src.endsWith('/' + file));
    return Number(m.sizes.split('x')[0]);
  }
  test('icon.svg is the same mark', () => {
    const svg = readFileSync(join(root, 'icons', 'icon.svg'), 'utf8');
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /#0e2820/);
    assert.match(svg, /#e3c886/);
    assert.equal((svg.match(/<circle/g) || []).length, 3, 'ring, disc, dot');
  });
});

describe('src/head.html', () => {
  const head = readFileSync(join(root, 'src/head.html'), 'utf8');
  test('links the manifest and a PNG apple-touch-icon, keeps the SVG favicon and the viewport', () => {
    assert.match(head, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
    assert.match(head, /<link rel="apple-touch-icon" href="\.\/icons\/apple-touch-icon\.png">/);
    assert.doesNotMatch(head, /apple-touch-icon" href="data:/, 'iOS ignores SVG touch icons');
    assert.match(head, /<link rel="icon" href="data:image\/svg\+xml,/);
    assert.ok(head.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">'));
    assert.match(head, /<meta name="apple-mobile-web-app-title" content="[^"]+">/);
    assert.match(head, /serviceWorker\.register\('\.\/sw\.js'\)/);
  });
});
