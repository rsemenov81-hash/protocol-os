// Web Push client unit tests — src/app/push.js against faked browser globals (navigator, matchMedia,
// Notification, PushManager, localStorage, fetch). No browser, no network, no build.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  PUSH_STATUSES, PUSH_STORAGE_KEY,
  urlBase64ToUint8Array, uint8ArrayToUrlBase64,
  defaultReminderSettings, normalizeReminderSettings,
  isPushSupported, needsInstall, pushStatus,
  enableReminders, updateReminders, disableReminders, sendTestReminder, listReminderSubscriptions,
  listenForOpenBlock, getSavedReminders,
} from '../src/app/push.js';

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const SYNC_URL = 'https://protocol-sync.example.workers.dev/';
const TOKEN = 'secret-token';

// A VAPID-shaped key: 65 bytes, uncompressed P-256 point marker first.
const KEY = new Uint8Array(65); KEY[0] = 4; randomBytes(64).copy(Buffer.from(KEY.buffer), 1);
const KEY_B64 = Buffer.from(KEY).toString('base64url');

// ── Fake browser ─────────────────────────────────────────────────────────────────────────────────
function installGlobals(overrides) {
  const saved = Object.keys(overrides).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete globalThis[k];
    else Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true, enumerable: true });
  }
  return () => { for (const [k, d] of saved.reverse()) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; } };
}

function makeWorld(o = {}) {
  const {
    ua = CHROME_UA, standalone = false, displayStandalone = false, maxTouchPoints = 0,
    permission = 'default', requestResult = 'granted',
    hasSW = true, hasPush = true, hasNotification = true, hasRegistration = true,
    subscribed = false, subscribedKey = KEY, routes = [], local = null, location = undefined, history = undefined,
  } = o;
  const calls = { fetch: [], subscribe: [], unsubscribe: 0, permissionRequests: 0, swListeners: [], replaceState: [] };
  const order = [];
  const store = new Map();
  if (local) store.set(PUSH_STORAGE_KEY, JSON.stringify(local));
  const state = { sub: null };
  const makeSub = (keyBytes) => ({
    endpoint: 'https://push.example.net/send/abc123',
    expirationTime: null,
    options: { applicationServerKey: keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) },
    toJSON() { return { endpoint: this.endpoint, expirationTime: null, keys: { p256dh: 'BP256DH', auth: 'AUTH16' } }; },
    async unsubscribe() { calls.unsubscribe++; order.push('unsubscribe'); state.sub = null; return true; },
  });
  if (subscribed) state.sub = makeSub(subscribedKey);
  const reg = {
    active: {}, scope: 'https://rsemenov81-hash.github.io/protocol-os/',
    pushManager: {
      getSubscription: async () => state.sub,
      subscribe: async (opts) => { calls.subscribe.push(opts); order.push('subscribe'); state.sub = makeSub(new Uint8Array(opts.applicationServerKey)); return state.sub; },
    },
  };
  const sw = {
    getRegistration: async () => (hasRegistration ? reg : undefined),
    register: async () => reg,
    ready: Promise.resolve(reg),
    addEventListener: (type, fn) => calls.swListeners.push({ type, fn, on: true }),
    removeEventListener: (type, fn) => { const l = calls.swListeners.find(x => x.type === type && x.fn === fn); if (l) l.on = false; },
    dispatch(data) { calls.swListeners.filter(l => l.on && l.type === 'message').forEach(l => l.fn({ data })); },
  };
  const navigator = { userAgent: ua, standalone, maxTouchPoints };
  if (hasSW) navigator.serviceWorker = sw;
  const Notification = { permission, requestPermission: async () => { calls.permissionRequests++; order.push('permission'); Notification.permission = requestResult; return requestResult; } };
  const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) });
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    calls.fetch.push({ url, path: u.pathname + u.search, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined, signal: init.signal });
    order.push(init.method + ' ' + u.pathname);
    const r = routes.find(r => r.path === u.pathname + u.search || r.path === u.pathname) || routes.find(r => r.path === '*');
    if (!r) return resp(404, { error: 'no such route ' + u.pathname });
    if (r.throws) throw new TypeError('Failed to fetch');
    return resp(r.status || 200, r.body);
  };
  const globals = {
    navigator,
    matchMedia: (q) => ({ matches: displayStandalone && /standalone/.test(q) }),
    Notification: hasNotification ? Notification : undefined,
    PushManager: hasPush ? function PushManager() {} : undefined,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    fetch,
    location, history,
  };
  return { globals, calls, order, store, state, sw, reg };
}

async function withWorld(opts, fn) {
  const w = makeWorld(opts);
  const restore = installGlobals(w.globals);
  try { return await fn(w); } finally { restore(); }
}

const CONFIG_OK = { path: '/push/config', body: { publicKey: KEY_B64, enabled: true } };
const SUBSCRIBE_OK = { path: '/push/subscribe', body: { ok: true, id: 'sub_1' } };

// ── Encoding ─────────────────────────────────────────────────────────────────────────────────────
describe('urlBase64ToUint8Array', () => {
  test('decodes a base64url VAPID key to the exact 65 bytes', () => {
    const out = urlBase64ToUint8Array(KEY_B64);
    assert.ok(out instanceof Uint8Array);
    assert.equal(out.length, 65);
    assert.deepEqual(Array.from(out), Array.from(KEY));
  });
  test('round trips through uint8ArrayToUrlBase64 and matches Node base64url for every padding length', () => {
    for (let n = 0; n <= 12; n++) {
      const bytes = new Uint8Array(randomBytes(n));
      const enc = uint8ArrayToUrlBase64(bytes);
      assert.equal(enc, Buffer.from(bytes).toString('base64url'), 'length ' + n);
      assert.doesNotMatch(enc, /[+/=]/);
      assert.deepEqual(Array.from(urlBase64ToUint8Array(enc)), Array.from(bytes), 'length ' + n);
    }
  });
  test('tolerates padding, whitespace and empty input', () => {
    assert.deepEqual(Array.from(urlBase64ToUint8Array(' ' + KEY_B64 + '== ')), Array.from(KEY));
    assert.equal(urlBase64ToUint8Array('').length, 0);
    assert.equal(urlBase64ToUint8Array(null).length, 0);
    assert.equal(urlBase64ToUint8Array(undefined).length, 0);
  });
});

// ── Settings ─────────────────────────────────────────────────────────────────────────────────────
describe('reminder settings', () => {
  test('defaults have the Worker shape', () => {
    assert.deepEqual(defaultReminderSettings(), { blocks: { am: true, pre: true, pm: true }, times: { am: '08:00', pre: '06:00', pm: '19:00' }, nudgeMinutes: 30 });
    assert.notEqual(defaultReminderSettings(), defaultReminderSettings(), 'a fresh object every call');
  });
  test('normalize fills gaps, coerces booleans/numbers and rejects bad times', () => {
    assert.deepEqual(normalizeReminderSettings({ blocks: { pm: 0 }, times: { am: '7:00', pre: '05:30' }, nudgeMinutes: '45' }),
      { blocks: { am: true, pre: true, pm: false }, times: { am: '08:00', pre: '05:30', pm: '19:00' }, nudgeMinutes: 45 });
    assert.deepEqual(normalizeReminderSettings(null), defaultReminderSettings());
    assert.equal(normalizeReminderSettings({ nudgeMinutes: -5 }).nudgeMinutes, 30);
    assert.equal(normalizeReminderSettings({ nudgeMinutes: 0 }).nudgeMinutes, 0);
  });
});

// ── Status ───────────────────────────────────────────────────────────────────────────────────────
describe('pushStatus', () => {
  test('exported status list is the contract', () => assert.deepEqual(PUSH_STATUSES, ['unsupported', 'needs-install', 'denied', 'subscribed', 'off']));
  test('unsupported: no serviceWorker', () => withWorld({ hasSW: false }, async () => {
    assert.equal(isPushSupported(), false);
    assert.equal(await pushStatus(), 'unsupported');
  }));
  test('unsupported: no PushManager (desktop browser without push)', () => withWorld({ hasPush: false }, async () => assert.equal(await pushStatus(), 'unsupported')));
  test('unsupported: no Notification', () => withWorld({ hasNotification: false }, async () => assert.equal(await pushStatus(), 'unsupported')));
  test('needs-install: iPhone Safari tab, even though the tab exposes no PushManager', () => withWorld({ ua: IPHONE_UA, hasPush: false }, async () => {
    assert.equal(needsInstall(), true);
    assert.equal(await pushStatus(), 'needs-install');
  }));
  test('needs-install: iPadOS reporting a Macintosh UA with touch', () => withWorld({ ua: IPAD_DESKTOP_UA, maxTouchPoints: 5, hasPush: false }, async () => assert.equal(await pushStatus(), 'needs-install')));
  test('a real Mac (no touch) is not an iPad', () => withWorld({ ua: IPAD_DESKTOP_UA, maxTouchPoints: 0 }, async () => assert.equal(await pushStatus(), 'off')));
  test('iPhone home-screen app via navigator.standalone → off', () => withWorld({ ua: IPHONE_UA, standalone: true }, async () => assert.equal(await pushStatus(), 'off')));
  test('iPhone home-screen app via display-mode media query → subscribed when a subscription exists', () => withWorld({ ua: IPHONE_UA, displayStandalone: true, subscribed: true }, async () => assert.equal(await pushStatus(), 'subscribed')));
  test('denied wins over everything else once supported', () => withWorld({ permission: 'denied', subscribed: true }, async () => assert.equal(await pushStatus(), 'denied')));
  test('subscribed when pushManager has a subscription', () => withWorld({ subscribed: true, permission: 'granted' }, async () => assert.equal(await pushStatus(), 'subscribed')));
  test('off when supported but not subscribed', () => withWorld({}, async () => assert.equal(await pushStatus(), 'off')));
  test('off when no registration exists yet', () => withWorld({ hasRegistration: false }, async () => assert.equal(await pushStatus(), 'off')));
  test('off when matchMedia is missing entirely', () => withWorld({ matchMedia: undefined }, async () => assert.equal(await pushStatus(), 'off')));
});

// ── enableReminders ──────────────────────────────────────────────────────────────────────────────
describe('enableReminders', () => {
  test('happy path: permission → config → subscribe → POST, with the Worker body shape and a local copy', () =>
    withWorld({ routes: [CONFIG_OK, SUBSCRIBE_OK] }, async (w) => {
      const settings = { blocks: { am: true, pre: false, pm: true }, times: { am: '07:30', pre: '06:00', pm: '20:00' }, nudgeMinutes: 20 };
      const before = Date.now();
      const r = await enableReminders({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman', settings });
      assert.deepEqual(r, { ok: true, status: 'subscribed', id: 'sub_1' });

      assert.equal(w.calls.permissionRequests, 1);
      assert.deepEqual(w.order, ['permission', 'GET /push/config', 'subscribe', 'POST /push/subscribe']);

      const [cfg, post] = w.calls.fetch;
      assert.equal(cfg.url, 'https://protocol-sync.example.workers.dev/push/config', 'trailing slash on syncUrl is collapsed');
      assert.equal(cfg.method, 'GET');
      assert.equal(cfg.headers.Authorization, 'Bearer ' + TOKEN);
      assert.equal(cfg.headers['Content-Type'], 'application/json');
      assert.equal(cfg.body, undefined);

      assert.equal(w.calls.subscribe.length, 1);
      assert.equal(w.calls.subscribe[0].userVisibleOnly, true);
      assert.ok(w.calls.subscribe[0].applicationServerKey instanceof Uint8Array);
      assert.deepEqual(Array.from(w.calls.subscribe[0].applicationServerKey), Array.from(KEY));

      assert.equal(post.url, 'https://protocol-sync.example.workers.dev/push/subscribe');
      assert.equal(post.method, 'POST');
      assert.equal(post.headers.Authorization, 'Bearer ' + TOKEN);
      assert.equal(post.headers['Content-Type'], 'application/json');
      assert.deepEqual(Object.keys(post.body).sort(), ['device', 'profile', 'settings', 'subscription', 'tz']);
      assert.equal(post.body.profile, 'Roman');
      assert.deepEqual(post.body.subscription, { endpoint: 'https://push.example.net/send/abc123', expirationTime: null, keys: { p256dh: 'BP256DH', auth: 'AUTH16' } });
      assert.deepEqual(post.body.settings, settings);
      assert.equal(typeof post.body.tz, 'string');
      assert.match(post.body.device, /^Windows · Chrome$/);

      const saved = getSavedReminders();
      assert.deepEqual(Object.keys(saved).sort(), ['at', 'endpoint', 'id', 'profile', 'settings']);
      assert.equal(saved.endpoint, 'https://push.example.net/send/abc123');
      assert.equal(saved.profile, 'Roman');
      assert.deepEqual(saved.settings, settings);
      assert.equal(saved.id, 'sub_1');
      assert.ok(Date.parse(saved.at) >= before - 1000 && !Number.isNaN(Date.parse(saved.at)), 'at is an ISO timestamp');
    }));

  test('partial settings are normalized before they reach the Worker', () =>
    withWorld({ routes: [CONFIG_OK, SUBSCRIBE_OK], permission: 'granted' }, async (w) => {
      const r = await enableReminders({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Scott', settings: { blocks: { pm: false }, nudgeMinutes: '15' } });
      assert.equal(r.ok, true);
      assert.equal(w.calls.permissionRequests, 0, 'no prompt when already granted');
      assert.deepEqual(w.calls.fetch[1].body.settings, { blocks: { am: true, pre: true, pm: false }, times: { am: '08:00', pre: '06:00', pm: '19:00' }, nudgeMinutes: 15 });
    }));

  test('denied path: permission already denied → no network, no subscribe', () =>
    withWorld({ permission: 'denied', routes: [CONFIG_OK, SUBSCRIBE_OK] }, async (w) => {
      const r = await enableReminders({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman', settings: defaultReminderSettings() });
      assert.equal(r.ok, false);
      assert.equal(r.status, 'denied');
      assert.match(r.error, /blocked/i);
      assert.equal(w.calls.fetch.length, 0);
      assert.equal(w.calls.subscribe.length, 0);
      assert.equal(w.calls.permissionRequests, 0);
      assert.equal(getSavedReminders(), null);
    }));

  test('denied path: the user refuses the prompt', () =>
    withWorld({ permission: 'default', requestResult: 'denied', routes: [CONFIG_OK, SUBSCRIBE_OK] }, async (w) => {
      const r = await enableReminders({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman' });
      assert.deepEqual([r.ok, r.status], [false, 'denied']);
      assert.equal(w.calls.permissionRequests, 1);
      assert.equal(w.calls.fetch.length, 0, 'permission is asked before any request so the tap gesture is still fresh');
      assert.equal(w.calls.subscribe.length, 0);
    }));

  test('the prompt dismissed (stays default) → off, not denied', () =>
    withWorld({ permission: 'default', requestResult: 'default' }, async () => {
      const r = await enableReminders({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman' });
      assert.deepEqual([r.ok, r.status], [false, 'off']);
    }));

  test('needs-install on an iPhone Safari tab, before any prompt or request', () =>
    withWorld({ ua: IPHONE_UA, hasPush: false, routes: [CONFIG_OK] }, async (w) => {
      const r = await enableReminders({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman' });
      assert.deepEqual([r.ok, r.status], [false, 'needs-install']);
      assert.match(r.error, /Home Screen/);
      assert.equal(w.calls.fetch.length, 0);
      assert.equal(w.calls.permissionRequests, 0);
    }));

  test('unsupported browser returns a result instead of throwing', () =>
    withWorld({ hasSW: false }, async () => {
      const r = await enableReminders({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman' });
      assert.deepEqual([r.ok, r.status], [false, 'unsupported']);
    }));

  test('Worker with push disabled → no subscribe', () =>
    withWorld({ permission: 'granted', routes: [{ path: '/push/config', body: { publicKey: '', enabled: false } }] }, async (w) => {
      const r = await enableReminders({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman' });
      assert.deepEqual([r.ok, r.status], [false, 'off']);
      assert.match(r.error, /not enabled/);
      assert.equal(w.calls.subscribe.length, 0);
    }));

  test('config request failing on the network is returned, never thrown', () =>
    withWorld({ permission: 'granted', routes: [{ path: '/push/config', throws: true }] }, async (w) => {
      const r = await enableReminders({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman' });
      assert.equal(r.ok, false);
      assert.equal(r.status, 'off');
      assert.match(r.error, /Failed to fetch/);
      assert.equal(w.calls.subscribe.length, 0);
    }));

  test('config 401 surfaces the Worker error text', () =>
    withWorld({ permission: 'granted', routes: [{ path: '/push/config', status: 401, body: { error: 'bad token' } }] }, async () => {
      const r = await enableReminders({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman' });
      assert.equal(r.ok, false);
      assert.match(r.error, /bad token/);
    }));

  test('missing sync URL/token is a result, not a request', () =>
    withWorld({ permission: 'granted' }, async (w) => {
      const r = await enableReminders({ syncUrl: '', token: '', profile: 'Roman' });
      assert.equal(r.ok, false);
      assert.match(r.error, /not set up/);
      assert.equal(w.calls.fetch.length, 0);
    }));

  test('Worker rejecting the subscription drops the fresh browser subscription so status stays truthful', () =>
    withWorld({ permission: 'granted', routes: [CONFIG_OK, { path: '/push/subscribe', status: 500, body: { error: 'KV down' } }] }, async (w) => {
      const r = await enableReminders({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman' });
      assert.deepEqual([r.ok, r.status], [false, 'off']);
      assert.match(r.error, /KV down/);
      assert.equal(w.calls.unsubscribe, 1);
      assert.equal(w.state.sub, null);
      assert.equal(getSavedReminders(), null);
      assert.equal(await pushStatus(), 'off');
    }));

  test('an existing subscription with the same key is reused (no re-subscribe), then re-registered', () =>
    withWorld({ permission: 'granted', subscribed: true, routes: [CONFIG_OK, SUBSCRIBE_OK] }, async (w) => {
      const r = await enableReminders({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman' });
      assert.equal(r.ok, true);
      assert.equal(w.calls.subscribe.length, 0);
      assert.equal(w.calls.unsubscribe, 0);
      assert.equal(w.calls.fetch[1].method, 'POST');
    }));

  test('an existing subscription under a rotated Worker key is replaced', () =>
    withWorld({ permission: 'granted', subscribed: true, subscribedKey: (() => { const k = new Uint8Array(KEY); k[10] ^= 0xff; return k; })(), routes: [CONFIG_OK, SUBSCRIBE_OK] }, async (w) => {
      const r = await enableReminders({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman' });
      assert.equal(r.ok, true);
      assert.equal(w.calls.unsubscribe, 1);
      assert.equal(w.calls.subscribe.length, 1);
      assert.deepEqual(w.order.slice(-3), ['unsubscribe', 'subscribe', 'POST /push/subscribe']);
    }));

  test('subscribe() rejecting (e.g. NotAllowedError) is returned', () =>
    withWorld({ permission: 'granted', routes: [CONFIG_OK] }, async (w) => {
      w.reg.pushManager.subscribe = async () => { const e = new Error('Registration failed - permission denied'); e.name = 'NotAllowedError'; throw e; };
      const r = await enableReminders({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman' });
      assert.deepEqual([r.ok, r.status], [false, 'denied']);
      assert.match(r.error, /permission denied/);
    }));

  test('no registration yet: registers ./sw.js itself and continues', () =>
    withWorld({ permission: 'granted', hasRegistration: false, routes: [CONFIG_OK, SUBSCRIBE_OK] }, async (w) => {
      let registered = null;
      w.sw.register = async (url) => { registered = url; return w.reg; };
      const r = await enableReminders({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman' });
      assert.equal(r.ok, true);
      assert.equal(registered, './sw.js');
    }));
});

// ── updateReminders ──────────────────────────────────────────────────────────────────────────────
describe('updateReminders', () => {
  test('re-POSTs the existing subscription with the new settings and keeps the saved profile', () =>
    withWorld({ permission: 'granted', subscribed: true, routes: [SUBSCRIBE_OK], local: { endpoint: 'https://push.example.net/send/abc123', profile: 'Roman', settings: defaultReminderSettings(), at: '2026-10-01T00:00:00.000Z', id: 'sub_1' } }, async (w) => {
      const settings = { ...defaultReminderSettings(), times: { am: '09:00', pre: '06:00', pm: '21:00' } };
      const r = await updateReminders({ syncUrl: SYNC_URL, token: TOKEN, settings });
      assert.deepEqual(r, { ok: true, status: 'subscribed', id: 'sub_1' });
      assert.equal(w.calls.fetch.length, 1);
      assert.equal(w.calls.fetch[0].path, '/push/subscribe');
      assert.equal(w.calls.fetch[0].method, 'POST');
      assert.equal(w.calls.fetch[0].body.profile, 'Roman');
      assert.deepEqual(w.calls.fetch[0].body.settings, settings);
      assert.equal(w.calls.fetch[0].body.subscription.endpoint, 'https://push.example.net/send/abc123');
      assert.deepEqual(getSavedReminders().settings, settings);
      assert.equal(w.calls.subscribe.length, 0, 'never re-subscribes');
    }));
  test('not subscribed → off, nothing sent, stale local copy cleared', () =>
    withWorld({ permission: 'granted', routes: [SUBSCRIBE_OK], local: { endpoint: 'x', profile: 'Roman' } }, async (w) => {
      const r = await updateReminders({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman', settings: defaultReminderSettings() });
      assert.deepEqual([r.ok, r.status], [false, 'off']);
      assert.equal(w.calls.fetch.length, 0);
      assert.equal(getSavedReminders(), null);
    }));
  test('Worker failure keeps the subscription and reports', () =>
    withWorld({ permission: 'granted', subscribed: true, routes: [{ path: '/push/subscribe', status: 503, body: { error: 'later' } }] }, async (w) => {
      const r = await updateReminders({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman', settings: defaultReminderSettings() });
      assert.deepEqual([r.ok, r.status], [false, 'subscribed']);
      assert.match(r.error, /later/);
      assert.equal(w.calls.unsubscribe, 0);
    }));
});

// ── disableReminders ─────────────────────────────────────────────────────────────────────────────
describe('disableReminders', () => {
  test('unsubscribes, DELETEs by endpoint and clears the local copy', () =>
    withWorld({ permission: 'granted', subscribed: true, routes: [{ path: '/push/subscribe', body: { ok: true } }], local: { endpoint: 'https://push.example.net/send/abc123', profile: 'Roman' } }, async (w) => {
      const r = await disableReminders({ syncUrl: SYNC_URL, token: TOKEN });
      assert.deepEqual(r, { ok: true, status: 'off' });
      assert.equal(w.calls.unsubscribe, 1);
      assert.equal(w.calls.fetch.length, 1);
      assert.equal(w.calls.fetch[0].method, 'DELETE');
      assert.equal(w.calls.fetch[0].path, '/push/subscribe');
      assert.deepEqual(w.calls.fetch[0].body, { endpoint: 'https://push.example.net/send/abc123' });
      assert.equal(w.calls.fetch[0].headers.Authorization, 'Bearer ' + TOKEN);
      assert.equal(getSavedReminders(), null);
      assert.equal(await pushStatus(), 'off');
    }));
  test('Worker unreachable: device is still off, with a warning', () =>
    withWorld({ permission: 'granted', subscribed: true, routes: [{ path: '/push/subscribe', throws: true }] }, async (w) => {
      const r = await disableReminders({ syncUrl: SYNC_URL, token: TOKEN });
      assert.equal(r.ok, true);
      assert.equal(r.status, 'off');
      assert.match(r.warning, /Failed to fetch/);
      assert.equal(w.state.sub, null);
    }));
  test('only a local record left (browser already unsubscribed) still tells the Worker', () =>
    withWorld({ permission: 'granted', routes: [{ path: '/push/subscribe', body: { ok: true } }], local: { endpoint: 'https://push.example.net/send/old', profile: 'Roman' } }, async (w) => {
      const r = await disableReminders({ syncUrl: SYNC_URL, token: TOKEN });
      assert.deepEqual(r, { ok: true, status: 'off' });
      assert.deepEqual(w.calls.fetch[0].body, { endpoint: 'https://push.example.net/send/old' });
      assert.equal(getSavedReminders(), null);
    }));
  test('nothing to do without a service worker', () =>
    withWorld({ hasSW: false }, async (w) => {
      assert.deepEqual(await disableReminders({ syncUrl: SYNC_URL, token: TOKEN }), { ok: true, status: 'off' });
      assert.equal(w.calls.fetch.length, 0);
    }));
});

// ── sendTestReminder / listReminderSubscriptions ────────────────────────────────────────────────
describe('sendTestReminder', () => {
  test('POSTs the profile and passes the Worker result through', () =>
    withWorld({ permission: 'granted', subscribed: true, routes: [{ path: '/push/test', body: { ok: true, sent: 2 } }] }, async (w) => {
      const r = await sendTestReminder({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman' });
      assert.deepEqual(r, { ok: true, status: 'subscribed', result: { ok: true, sent: 2 } });
      assert.equal(w.calls.fetch[0].method, 'POST');
      assert.equal(w.calls.fetch[0].path, '/push/test');
      assert.deepEqual(w.calls.fetch[0].body, { profile: 'Roman' });
    }));
  test('failure is a result', () =>
    withWorld({ routes: [{ path: '/push/test', status: 404, body: { error: 'no devices' } }] }, async () => {
      const r = await sendTestReminder({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman' });
      assert.deepEqual([r.ok, r.status], [false, 'off']);
      assert.match(r.error, /no devices/);
    }));
  test('no profile → no request', () => withWorld({}, async (w) => {
    const r = await sendTestReminder({ syncUrl: SYNC_URL, token: TOKEN });
    assert.equal(r.ok, false);
    assert.equal(w.calls.fetch.length, 0);
  }));
});

describe('listReminderSubscriptions', () => {
  test('GETs ?profile= and accepts a bare array or a wrapped list', async () => {
    await withWorld({ routes: [{ path: '/push/subscriptions?profile=Roman', body: [{ id: 'a', device: 'iPhone · Safari (app)' }] }] }, async (w) => {
      const r = await listReminderSubscriptions({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman' });
      assert.equal(r.ok, true);
      assert.equal(r.subscriptions.length, 1);
      assert.equal(w.calls.fetch[0].method, 'GET');
      assert.equal(w.calls.fetch[0].path, '/push/subscriptions?profile=Roman');
    });
    await withWorld({ routes: [{ path: '/push/subscriptions?profile=Tim%20J', body: { subscriptions: [{ id: 'b' }] } }] }, async () => {
      const r = await listReminderSubscriptions({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Tim J' });
      assert.deepEqual(r.subscriptions, [{ id: 'b' }]);
    });
    await withWorld({ routes: [{ path: '*', throws: true }] }, async () => {
      const r = await listReminderSubscriptions({ syncUrl: SYNC_URL, token: TOKEN, profile: 'Roman' });
      assert.deepEqual([r.ok, r.subscriptions], [false, []]);
    });
  });
});

// ── listenForOpenBlock ───────────────────────────────────────────────────────────────────────────
describe('listenForOpenBlock', () => {
  test('delivers open-block messages from the service worker and unsubscribes cleanly', () =>
    withWorld({}, async (w) => {
      const got = [];
      const stop = listenForOpenBlock((data) => got.push(data));
      w.sw.dispatch({ type: 'something-else' });
      w.sw.dispatch({ type: 'open-block', data: { profile: 'Roman', block: 'am', date: '2026-10-03', url: './index.html?block=am' } });
      w.sw.dispatch({ type: 'open-block' });
      assert.deepEqual(got, [{ profile: 'Roman', block: 'am', date: '2026-10-03', url: './index.html?block=am' }, {}]);
      stop();
      w.sw.dispatch({ type: 'open-block', data: { block: 'pm' } });
      assert.equal(got.length, 2, 'no delivery after stop()');
      assert.equal(typeof stop, 'function');
    }));
  test('a launch URL carrying ?block= is handed over once and scrubbed from the address bar', () =>
    withWorld({
      location: { href: 'https://rsemenov81-hash.github.io/protocol-os/index.html?block=pm&date=2026-10-03&profile=Roman', search: '?block=pm&date=2026-10-03&profile=Roman', pathname: '/protocol-os/index.html', hash: '' },
      history: { replaceState: (...a) => replaced.push(a) },
    }, async () => {
      const got = [];
      listenForOpenBlock((data) => got.push(data));
      assert.equal(got.length, 0, 'delivered asynchronously, after the caller has set up state');
      await new Promise(r => setImmediate(r));
      assert.equal(got.length, 1);
      assert.equal(got[0].block, 'pm');
      assert.equal(got[0].date, '2026-10-03');
      assert.equal(got[0].profile, 'Roman');
      assert.equal(got[0].launched, true);
      assert.deepEqual(replaced, [[null, '', '/protocol-os/index.html']]);
    }));
  const replaced = [];
  test('without a service worker or handler it is a no-op', () =>
    withWorld({ hasSW: false }, async () => {
      assert.equal(typeof listenForOpenBlock(() => {}), 'function');
      assert.equal(typeof listenForOpenBlock(null), 'function');
      listenForOpenBlock(() => {})();
    }));
});
