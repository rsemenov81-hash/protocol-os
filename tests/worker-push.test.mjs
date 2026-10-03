// Tests for the Web Push reminders in protocol-sync-worker.js (v1.6.0).
// Plain Node 22, no dependencies: `node --test tests/worker-push.test.mjs`.
//   - a real VAPID keypair is generated here with node's WebCrypto;
//   - globalThis.fetch is mocked to capture what the worker sends to the push service;
//   - the JWT is verified against the public key (WebCrypto AND node:crypto.verify, ieee-p1363);
//   - the aes128gcm body is decrypted with the RFC 8291 receiver side implemented below.
import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, verify as nodeVerify, KeyObject } from 'node:crypto';
import worker, { PUSH } from '../protocol-sync-worker.js';

const { subtle } = webcrypto;
const BASE = 'https://protocol-sync.example.workers.dev';
const W = { Authorization: 'Bearer w' };
const R = { Authorization: 'Bearer r' };
const te = new TextEncoder(), td = new TextDecoder();
const b64u = (bytes) => Buffer.from(bytes).toString('base64url');
const fromB64u = (s) => new Uint8Array(Buffer.from(s, 'base64url'));

// ---------- fakes (same shapes as tests/worker.test.mjs) ----------
function fakeKV() {
  const store = new Map(); // name -> { value, expirationTtl }
  return {
    store,
    async get(name) { const e = store.get(name); return e ? e.value : null; },
    async put(name, value, opts = {}) { store.set(name, { value: String(value), expirationTtl: opts.expirationTtl ?? null }); },
    async delete(name) { store.delete(name); },
    async list({ prefix = '', limit = 1000, cursor } = {}) {
      const names = [...store.keys()].filter((n) => n.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = names.slice(start, start + limit);
      const done = start + limit >= names.length;
      return { keys: page.map((name) => ({ name })), list_complete: done, cursor: done ? undefined : String(start + limit) };
    },
  };
}
function fakeCtx() {
  const promises = [];
  return { promises, waitUntil(p) { promises.push(p); }, async flush() { await Promise.all(promises); } };
}
function req(path, { method = 'GET', headers = {}, body } = {}) {
  const init = { method, headers: new Headers(headers) };
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request(BASE + path, init);
}
const call = (env, ctx, path, opts) => worker.fetch(req(path, opts), env, ctx);
function freeze(iso) { try { mock.timers.reset(); } catch {} mock.timers.enable({ apis: ['Date'], now: new Date(iso) }); }

// ---------- a real VAPID keypair, generated once per test run ----------
async function genVapid() {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
  const jwk = await subtle.exportKey('jwk', kp.privateKey);
  return { publicKey: b64u(pub), privateKey: jwk.d, verifyKey: kp.publicKey };
}
const VAPID = await genVapid();
function mkEnv(extra = {}) {
  return { PROTOCOL_KV: fakeKV(), SYNC_TOKEN: 'w', READ_TOKEN: 'r', VAPID_PUBLIC_KEY: VAPID.publicKey, VAPID_PRIVATE_KEY: VAPID.privateKey, VAPID_SUBJECT: 'mailto:test@example.com', ...extra };
}

// ---------- a browser subscription: ECDH P-256 keypair + 16-byte auth secret ----------
async function genSubscriber(endpoint) {
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const p256dh = b64u(new Uint8Array(await subtle.exportKey('raw', kp.publicKey)));
  const auth = b64u(webcrypto.getRandomValues(new Uint8Array(16)));
  return { kp, endpoint, subscription: { endpoint, keys: { p256dh, auth } } };
}
async function expectedId(endpoint) {
  return Buffer.from(await subtle.digest('SHA-256', te.encode(endpoint))).toString('hex').slice(0, 24);
}

// ---------- RFC 8291 / RFC 8188 receiver side ----------
async function hkdf(salt, ikm, info, len) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}
const concat = (...parts) => new Uint8Array(Buffer.concat(parts.map((p) => Buffer.from(p))));
async function decryptPush(body, sub) {
  const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
  const salt = bytes.slice(0, 16);
  const rs = Buffer.from(bytes.slice(16, 20)).readUInt32BE(0);
  const idlen = bytes[20];
  const asPub = bytes.slice(21, 21 + idlen);
  const ct = bytes.slice(21 + idlen);
  const asKey = await subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, sub.kp.privateKey, 256));
  const uaPub = fromB64u(sub.subscription.keys.p256dh);
  const ikm = await hkdf(fromB64u(sub.subscription.keys.auth), shared, concat(te.encode('WebPush: info\0'), uaPub, asPub), 32);
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const aes = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const pt = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, ct));
  let end = pt.length;
  while (end > 0 && pt[end - 1] === 0) end--;
  assert.equal(pt[end - 1], 2, 'record ends with the 0x02 last-record delimiter');
  return { rs, idlen, json: JSON.parse(td.decode(pt.slice(0, end - 1))) };
}

// ---------- VAPID verification ----------
async function verifyVapid(authHeader, endpoint) {
  const m = /^vapid t=([^,\s]+), k=([^,\s]+)$/.exec(authHeader || '');
  assert.ok(m, `Authorization header shape: ${authHeader}`);
  assert.equal(m[2], VAPID.publicKey, 'k= is the VAPID public key');
  const [h, c, s] = m[1].split('.');
  assert.deepEqual(JSON.parse(td.decode(fromB64u(h))), { typ: 'JWT', alg: 'ES256' });
  const claims = JSON.parse(td.decode(fromB64u(c)));
  assert.equal(claims.aud, new URL(endpoint).origin);
  assert.equal(claims.sub, 'mailto:test@example.com');
  const nowSec = Math.floor(Date.now() / 1000);
  assert.ok(claims.exp > nowSec && claims.exp <= nowSec + 12 * 3600, `exp within 12h (got +${claims.exp - nowSec}s)`);
  const sig = fromB64u(s), data = te.encode(`${h}.${c}`);
  assert.equal(sig.length, 64, 'ES256 JWS signature is raw r||s');
  assert.equal(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, VAPID.verifyKey, sig, data), true, 'WebCrypto verify');
  assert.equal(nodeVerify('sha256', data, { key: KeyObject.from(VAPID.verifyKey), dsaEncoding: 'ieee-p1363' }, sig), true, 'node:crypto verify');
  return claims;
}

// ---------- fetch mock ----------
let calls = [];
const realFetch = globalThis.fetch;
function mockPush(statusFor = () => 201) {
  calls = [];
  globalThis.fetch = mock.fn(async (url, init = {}) => {
    const entry = { url: String(url), method: init.method, headers: new Headers(init.headers || {}), body: init.body };
    calls.push(entry);
    return new Response(null, { status: statusFor(entry) });
  });
}
afterEach(() => { globalThis.fetch = realFetch; try { mock.timers.reset(); } catch {} });

// ---------- seed (shapes from the app) ----------
// New York is EDT (UTC−4) on 2026-10-03: 08:03 local = 12:03Z.
const NY_0803 = '2026-10-03T12:03:00Z', NY_0833 = '2026-10-03T12:33:00Z', NY_0603 = '2026-10-03T10:03:00Z', NY_1903 = '2026-10-03T23:03:00Z';
const TODAY = '2026-10-03';
const ALL = [0, 1, 2, 3, 4, 5, 6];
const TS = '2026-10-02T20:00:00.000Z';
function protocolsSeed() {
  return [
    { id: 'p_test', profile: 'Roman', peptideId: 'testosterone-cyp', peptideName: 'Testosterone Cypionate', route: 'inj', doseMcg: 20000, doseUnit: 'mg', doseValue: 20, schedule: { days: ALL, timeOfDay: 'morning' }, startDate: '2026-09-01', active: true, updatedAt: TS },
    { id: 'p_hcg', profile: 'Roman', peptideId: 'hcg', peptideName: 'HCG', route: 'inj', doseMcg: 500, doseUnit: 'IU', doseValue: 500, schedule: { days: ALL, timeOfDay: 'morning' }, startDate: '2026-09-01', active: true, updatedAt: TS },
    { id: 'p_ipa', profile: 'Roman', peptideId: 'ipamorelin', peptideName: 'Ipamorelin', route: 'inj', doseMcg: 200, schedule: { days: ALL, timeOfDay: 'night' }, startDate: '2026-09-01', active: true, updatedAt: TS },
    { id: 'p_pre', profile: 'Roman', peptideId: 'bpc-157', peptideName: 'BPC-157', route: 'inj', doseMcg: 250, schedule: { days: ALL, timeOfDay: 'pre-workout' }, startDate: '2026-09-01', active: true, updatedAt: TS },
    { id: 'p_prn', profile: 'Roman', peptideId: 'tb-500', peptideName: 'TB-500', doseMcg: 2000, doseUnit: 'mg', doseValue: 2, schedule: { days: [] }, active: true, updatedAt: TS },
    { id: 'p_old', profile: 'Roman', peptideId: 'cjc', peptideName: 'CJC-1295', doseMcg: 100, schedule: { days: ALL, timeOfDay: 'morning' }, active: false, updatedAt: TS },
    { id: 'p_bpc_s', profile: 'Scott', peptideId: 'bpc-157', peptideName: 'BPC-157', doseMcg: 250, schedule: { days: ALL, timeOfDay: 'morning' }, startDate: '2026-09-15', active: true, updatedAt: TS },
  ];
}
const TESTO_DOSE = { id: 'l1', protocolId: 'p_test', profile: 'Roman', peptide: 'Testosterone Cypionate', peptideId: 'testosterone-cyp', datetime: `${TODAY}T07:55`, doseMcg: 20000, doseUnit: 'mg', doseValue: 20, updatedAt: TS };
const HCG_DOSE = { id: 'l2', protocolId: 'p_hcg', profile: 'Roman', peptide: 'HCG', peptideId: 'hcg', datetime: `${TODAY}T07:58`, doseMcg: 500, doseUnit: 'IU', doseValue: 500, updatedAt: TS };
const HCG_SKIP = { id: 'l3', protocolId: 'p_hcg', profile: 'Roman', peptide: 'HCG', peptideId: 'hcg', vialId: null, datetime: `${TODAY}T08:00`, doseMcg: 0, skipped: true, updatedAt: TS };
async function seed(env, logs = [TESTO_DOSE]) {
  await env.PROTOCOL_KV.put('protocol:all', JSON.stringify({ protocols: protocolsSeed(), logs, vials: [], storage: [], meta: {}, _rev: 2, _syncedAt: TS, profile: 'all' }));
}
async function subscribe(env, ctx, sub, { profile = 'Roman', settings, tz = 'America/New_York', device = 'iPhone', headers = W } = {}) {
  return call(env, ctx, '/push/subscribe', { method: 'POST', headers, body: { profile, subscription: sub.subscription, settings, tz, device } });
}
const runCron = async (env, ctx) => { const s = await worker.scheduled({ scheduledTime: Date.now(), cron: '*/15 * * * *' }, env, ctx); await ctx.flush(); return s; };
const APPLE = 'https://web.push.apple.com/QAbc123def', FCM = 'https://fcm.googleapis.com/fcm/send/xyz789', MOZ = 'https://updates.push.services.mozilla.com/wpush/v2/gAAAA';

// =====================================================================================
describe('push: config and subscription management', () => {
  let env, ctx;
  beforeEach(() => { freeze(NY_0803); env = mkEnv(); ctx = fakeCtx(); });

  test('GET /push/config: public key + enabled only when both secrets are set; write token only', async () => {
    const ok = await call(env, ctx, '/push/config', { headers: W });
    assert.equal(ok.status, 200);
    const j = await ok.json();
    assert.equal(j.publicKey, VAPID.publicKey);
    assert.equal(j.enabled, true);
    assert.equal(j.subject, 'mailto:test@example.com');
    const half = await (await call(mkEnv({ VAPID_PRIVATE_KEY: undefined }), ctx, '/push/config', { headers: W })).json();
    assert.deepEqual({ publicKey: half.publicKey, enabled: half.enabled }, { publicKey: VAPID.publicKey, enabled: false });
    const none = await (await call(mkEnv({ VAPID_PUBLIC_KEY: undefined, VAPID_PRIVATE_KEY: undefined }), ctx, '/push/config', { headers: W })).json();
    assert.deepEqual({ publicKey: none.publicKey, enabled: none.enabled }, { publicKey: null, enabled: false });
    assert.equal((await call(env, ctx, '/push/config', { headers: R })).status, 403);
    assert.equal((await call(env, ctx, '/push/config')).status, 401);
    assert.equal((await call(env, ctx, '/push/config', { headers: W })).headers.get('Cache-Control'), 'no-store');
  });

  test('subscribe → push:<sha256(endpoint)[0:24]>; re-post updates in place; list hides keys and endpoints; delete removes', async () => {
    const sub = await genSubscriber(APPLE);
    const r1 = await subscribe(env, ctx, sub, { settings: { blocks: { am: true, pre: false, pm: true }, times: { am: '08:00', pre: '06:00', pm: '19:00' }, nudgeMinutes: 0 } });
    assert.equal(r1.status, 200);
    const j1 = await r1.json();
    const id = await expectedId(APPLE);
    assert.equal(j1.ok, true);
    assert.equal(j1.id, id);
    assert.match(id, /^[0-9a-f]{24}$/);
    assert.equal(j1.updated, false);
    const stored = JSON.parse(env.PROTOCOL_KV.store.get(`push:${id}`).value);
    assert.equal(stored.id, id);
    assert.equal(stored.profile, 'Roman');
    assert.deepEqual(stored.subscription, sub.subscription);
    assert.deepEqual(stored.settings, { blocks: { am: true, pre: false, pm: true }, times: { am: '08:00', pre: '06:00', pm: '19:00' }, nudgeMinutes: 0 });
    assert.equal(stored.tz, 'America/New_York');
    assert.equal(stored.device, 'iPhone');
    assert.equal(stored.createdAt, new Date(NY_0803).toISOString());
    assert.equal(stored.updatedAt, stored.createdAt);
    // the same endpoint again, new settings and profile: same key, createdAt kept, updatedAt moves
    freeze(NY_0833);
    const r2 = await subscribe(env, ctx, sub, { profile: 'Scott', settings: { blocks: { am: true, pre: true, pm: false }, times: { am: '07:30' }, nudgeMinutes: 20 }, tz: 'America/Chicago', device: 'iPad' });
    assert.equal(r2.status, 200);
    const j2 = await r2.json();
    assert.equal(j2.id, id);
    assert.equal(j2.updated, true);
    assert.equal([...env.PROTOCOL_KV.store.keys()].filter((k) => k.startsWith('push:')).length, 1);
    const upd = JSON.parse(env.PROTOCOL_KV.store.get(`push:${id}`).value);
    assert.equal(upd.profile, 'Scott');
    assert.deepEqual(upd.settings, { blocks: { am: true, pre: true, pm: false }, times: { am: '07:30', pre: '06:00', pm: '19:00' }, nudgeMinutes: 20 });
    assert.equal(upd.tz, 'America/Chicago');
    assert.equal(upd.device, 'iPad');
    assert.equal(upd.createdAt, stored.createdAt);
    assert.equal(upd.updatedAt, new Date(NY_0833).toISOString());
    // defaults when settings are omitted
    const sub2 = await genSubscriber(FCM);
    const r3 = await call(env, ctx, '/push/subscribe', { method: 'POST', headers: W, body: { profile: 'Roman', subscription: sub2.subscription } });
    assert.equal(r3.status, 200);
    const d = JSON.parse(env.PROTOCOL_KV.store.get(`push:${await expectedId(FCM)}`).value);
    assert.deepEqual(d.settings, { blocks: { am: true, pre: false, pm: true }, times: { am: '08:00', pre: '06:00', pm: '19:00' }, nudgeMinutes: 0 });
    assert.equal(d.tz, 'America/New_York');
    assert.equal(d.device, null);
    // list: by profile, never keys or full endpoints
    const list = await (await call(env, ctx, '/push/subscriptions?profile=Scott', { headers: W })).json();
    assert.equal(list.subscriptions.length, 1);
    assert.deepEqual(Object.keys(list.subscriptions[0]).sort(), ['createdAt', 'device', 'endpointHost', 'id', 'profile', 'settings', 'tz', 'updatedAt']);
    assert.equal(list.subscriptions[0].endpointHost, 'web.push.apple.com');
    assert.ok(!JSON.stringify(list).includes(sub.subscription.keys.p256dh));
    assert.ok(!JSON.stringify(list).includes(sub.subscription.keys.auth));
    assert.ok(!JSON.stringify(list).includes('QAbc123def'));
    const roman = await (await call(env, ctx, '/push/subscriptions?profile=Roman', { headers: W })).json();
    assert.deepEqual(roman.subscriptions.map((s) => s.endpointHost), ['fcm.googleapis.com']);
    const all = await (await call(env, ctx, '/push/subscriptions?profile=all', { headers: W })).json();
    assert.equal(all.subscriptions.length, 2);
    // delete by endpoint (idempotent), then by id
    const del = await call(env, ctx, '/push/subscribe', { method: 'DELETE', headers: W, body: { endpoint: APPLE } });
    assert.equal(del.status, 200);
    assert.deepEqual(await del.json(), { ok: true, id, removed: true });
    assert.ok(!env.PROTOCOL_KV.store.has(`push:${id}`));
    assert.deepEqual(await (await call(env, ctx, '/push/subscribe', { method: 'DELETE', headers: W, body: { endpoint: APPLE } })).json(), { ok: true, id, removed: false });
    const del2 = await (await call(env, ctx, '/push/subscribe', { method: 'DELETE', headers: W, body: { id: await expectedId(FCM) } })).json();
    assert.equal(del2.removed, true);
    assert.equal([...env.PROTOCOL_KV.store.keys()].filter((k) => k.startsWith('push:')).length, 0);
  });

  test('validation → 400; read token → 403 on every /push route; unknown /push path → 404', async () => {
    const sub = await genSubscriber(APPLE);
    const post = (body) => call(env, ctx, '/push/subscribe', { method: 'POST', headers: W, body });
    const bad = async (body, re) => { const r = await post(body); assert.equal(r.status, 400, JSON.stringify(body)); assert.match((await r.json()).error, re); };
    await bad({ profile: 'Roman', subscription: { endpoint: 'http://web.push.apple.com/x', keys: sub.subscription.keys } }, /https URL/);
    await bad({ profile: 'Roman', subscription: { endpoint: 'not a url', keys: sub.subscription.keys } }, /https URL/);
    await bad({ profile: 'Roman', subscription: { endpoint: APPLE } }, /p256dh and subscription.keys.auth/);
    await bad({ profile: 'Roman', subscription: { endpoint: APPLE, keys: { p256dh: sub.subscription.keys.p256dh } } }, /p256dh and subscription.keys.auth/);
    await bad({ profile: 'Roman', subscription: { endpoint: APPLE, keys: { p256dh: 'AAAA', auth: sub.subscription.keys.auth } } }, /65 bytes/);
    await bad({ subscription: sub.subscription }, /profile is required/);
    await bad({ profile: 42, subscription: sub.subscription }, /profile is required/);
    await bad({ profile: 'all', subscription: sub.subscription }, /one person/);
    await bad({ profile: 'Roman', subscription: sub.subscription, settings: { times: { am: '8am' } } }, /settings.times.am must be HH:MM/);
    await bad({ profile: 'Roman', subscription: sub.subscription, settings: { times: { pm: '25:00' } } }, /settings.times.pm must be HH:MM/);
    await bad({ profile: 'Roman', subscription: sub.subscription, settings: { nudgeMinutes: -5 } }, /nudgeMinutes/);
    await bad({ profile: 'Roman', subscription: sub.subscription, tz: 'Mars/Olympus' }, /IANA time zone/);
    const notJson = await call(env, ctx, '/push/subscribe', { method: 'POST', headers: W, body: '{nope' });
    assert.equal(notJson.status, 400);
    assert.equal((await call(env, ctx, '/push/subscribe', { method: 'DELETE', headers: W, body: {} })).status, 400);
    assert.equal([...env.PROTOCOL_KV.store.keys()].filter((k) => k.startsWith('push:')).length, 0, 'nothing stored');
    for (const [path, method, body] of [['/push/config', 'GET'], ['/push/subscribe', 'POST', { profile: 'Roman', subscription: sub.subscription }], ['/push/subscribe', 'DELETE', { endpoint: APPLE }], ['/push/subscriptions?profile=Roman', 'GET'], ['/push/test', 'POST', { profile: 'Roman' }], ['/push/run', 'POST']]) {
      const r = await call(env, ctx, path, { method, headers: R, body });
      assert.equal(r.status, 403, `${method} ${path} with the read token`);
      assert.equal((await call(env, ctx, path, { method, body })).status, 401, `${method} ${path} without a token`);
    }
    assert.equal((await call(env, ctx, '/push/nope', { headers: W })).status, 404);
    assert.equal((await call(env, ctx, '/push/config', { method: 'POST', headers: W })).status, 405);
  });
});

// =====================================================================================
describe('push: scheduled reminders (cron */15, frozen at 08:03 New York)', () => {
  let env, ctx;
  beforeEach(async () => { freeze(NY_0803); env = mkEnv(); ctx = fakeCtx(); mockPush(); });

  test('one due unlogged morning dose → exactly one push: valid VAPID JWT, decryptable aes128gcm body; a second run sends nothing', async () => {
    await seed(env, [TESTO_DOSE]); // Testosterone logged, HCG still due, Ipamorelin is pm, BPC pre, TB-500 PRN
    const sub = await genSubscriber(APPLE);
    assert.equal((await subscribe(env, ctx, sub)).status, 200);
    const id = await expectedId(APPLE);
    const summary = await runCron(env, ctx);
    assert.equal(ctx.promises.length, 1, 'the pass runs under ctx.waitUntil');
    assert.deepEqual({ subscriptions: summary.subscriptions, sent: summary.sent, failed: summary.failed, errors: summary.errors }, { subscriptions: 1, sent: 1, failed: 0, errors: [] });
    assert.equal(calls.length, 1, 'exactly one push request');
    const c = calls[0];
    assert.equal(c.url, APPLE);
    assert.equal(c.method, 'POST');
    assert.equal(c.headers.get('Content-Encoding'), 'aes128gcm');
    assert.equal(c.headers.get('Content-Type'), 'application/octet-stream');
    assert.equal(c.headers.get('TTL'), '3600');
    assert.equal(c.headers.get('Urgency'), 'high');
    await verifyVapid(c.headers.get('Authorization'), APPLE);
    const dec = await decryptPush(c.body, sub);
    assert.equal(dec.rs, 4096);
    assert.equal(dec.idlen, 65);
    assert.deepEqual(dec.json, {
      title: 'Morning doses',
      body: '1 dose due: HCG 500 IU. Tap to open and log.',
      data: { profile: 'Roman', block: 'am', date: TODAY, url: './index.html#today' },
    });
    assert.ok(c.body.length <= 4096, 'push body within the 4 KiB limit');
    const marker = env.PROTOCOL_KV.store.get(`pushsent:${id}:${TODAY}:am`);
    assert.ok(marker, 'dedupe marker written');
    assert.equal(marker.expirationTtl, 2 * 86400);
    // same window again (e.g. a retried cron run): nothing goes out
    const again = await runCron(env, fakeCtx());
    assert.equal(calls.length, 1);
    assert.equal(again.sent, 0);
    assert.equal(again.deduped, 1);
    // 08:12 is still inside the window of 08:00 → still deduped; 08:18 is outside → nothing to do
    freeze('2026-10-03T12:12:00Z');
    assert.equal((await runCron(env, fakeCtx())).deduped, 1);
    freeze('2026-10-03T12:18:00Z');
    const later = await runCron(env, fakeCtx());
    assert.equal(later.windows, 0);
    assert.equal(calls.length, 1);
  });

  test('a skipped dose is handled: no reminder', async () => {
    await seed(env, [TESTO_DOSE, HCG_SKIP]);
    await subscribe(env, ctx, await genSubscriber(APPLE));
    const s = await runCron(env, ctx);
    assert.equal(calls.length, 0);
    assert.equal(s.windows, 1, 'the 08:00 window was checked');
    assert.equal(s.sent, 0);
    assert.ok(![...env.PROTOCOL_KV.store.keys()].some((k) => k.startsWith('pushsent:')), 'no marker when nothing was due');
  });

  test('a logged dose is handled: no reminder', async () => {
    await seed(env, [TESTO_DOSE, HCG_DOSE]);
    await subscribe(env, ctx, await genSubscriber(APPLE));
    const s = await runCron(env, ctx);
    assert.equal(calls.length, 0);
    assert.equal(s.sent, 0);
    assert.deepEqual(s.errors, []);
  });

  test('a log without protocolId still counts when it names the compound (keyOf match)', async () => {
    await seed(env, [{ ...TESTO_DOSE, protocolId: undefined }, { ...HCG_DOSE, protocolId: undefined }]);
    await subscribe(env, ctx, await genSubscriber(APPLE));
    await runCron(env, ctx);
    assert.equal(calls.length, 0);
  });

  test('two unlogged doses list both, in protocol order; archived and PRN compounds never appear', async () => {
    await seed(env, []);
    const sub = await genSubscriber(APPLE);
    await subscribe(env, ctx, sub);
    await runCron(env, ctx);
    assert.equal(calls.length, 1);
    const { json } = await decryptPush(calls[0].body, sub);
    assert.equal(json.title, 'Morning doses');
    assert.equal(json.body, '2 doses due: Testosterone Cypionate 20 mg, HCG 500 IU. Tap to open and log.');
    assert.ok(!json.body.includes('CJC') && !json.body.includes('TB-500') && !json.body.includes('Ipamorelin') && !json.body.includes('BPC'));
  });

  test('blocks disabled in settings never fire; the enabled pm block fires at its own time with its own title', async () => {
    await seed(env, []); // everything unlogged
    const sub = await genSubscriber(APPLE);
    await subscribe(env, ctx, sub, { settings: { blocks: { am: false, pre: false, pm: true }, times: { am: '08:00', pre: '06:00', pm: '19:00' } } });
    await runCron(env, ctx); // 08:03 — am disabled
    assert.equal(calls.length, 0);
    freeze(NY_0603);
    await runCron(env, fakeCtx()); // 06:03 — pre disabled although BPC-157 (pre-workout) is due
    assert.equal(calls.length, 0);
    freeze(NY_1903);
    const s = await runCron(env, fakeCtx()); // 19:03 — pm enabled, Ipamorelin (night) due
    assert.equal(calls.length, 1);
    assert.equal(s.sent, 1);
    const { json } = await decryptPush(calls[0].body, sub);
    assert.deepEqual(json, { title: 'Evening doses', body: '1 dose due: Ipamorelin 200mcg. Tap to open and log.', data: { profile: 'Roman', block: 'pm', date: TODAY, url: './index.html#today' } });
    // default settings: pre is off, so 06:03 is silent even with a pre-workout dose due
    const env2 = mkEnv(); await seed(env2, []); await subscribe(env2, fakeCtx(), await genSubscriber(FCM));
    freeze(NY_0603);
    calls = [];
    await runCron(env2, fakeCtx());
    assert.equal(calls.length, 0);
    // pre enabled → 'Pre-workout doses'
    const env3 = mkEnv(); await seed(env3, []); const sub3 = await genSubscriber(MOZ);
    await subscribe(env3, fakeCtx(), sub3, { settings: { blocks: { am: false, pre: true, pm: false } } });
    await runCron(env3, fakeCtx());
    assert.equal(calls.length, 1);
    assert.equal((await decryptPush(calls[0].body, sub3)).json.title, 'Pre-workout doses');
  });

  test('nudge: fires at time + nudgeMinutes only while doses remain, with its own dedupe key', async () => {
    await seed(env, [TESTO_DOSE]);
    const sub = await genSubscriber(APPLE);
    await subscribe(env, ctx, sub, { settings: { blocks: { am: true, pre: false, pm: false }, times: { am: '08:00' }, nudgeMinutes: 30 } });
    const id = await expectedId(APPLE);
    await runCron(env, ctx); // 08:03 → the regular reminder
    assert.equal(calls.length, 1);
    freeze(NY_0833); // 08:33 → 08:30 nudge window; the 08:00 window is over
    const s = await runCron(env, fakeCtx());
    assert.equal(calls.length, 2);
    assert.equal(s.sent, 1);
    const { json } = await decryptPush(calls[1].body, sub);
    assert.deepEqual(json, { title: 'Still due: Morning doses', body: '1 dose still due: HCG 500 IU. Tap to open and log.', data: { profile: 'Roman', block: 'am', date: TODAY, url: './index.html#today', nudge: true } });
    assert.ok(env.PROTOCOL_KV.store.has(`pushsent:${id}:${TODAY}:am:nudge`));
    assert.ok(env.PROTOCOL_KV.store.has(`pushsent:${id}:${TODAY}:am`));
    const again = await runCron(env, fakeCtx());
    assert.equal(calls.length, 2);
    assert.equal(again.deduped, 1);
    // everything logged by nudge time → no nudge
    const env2 = mkEnv(); await seed(env2, [TESTO_DOSE, HCG_DOSE]);
    await subscribe(env2, fakeCtx(), await genSubscriber(FCM), { settings: { nudgeMinutes: 30 } });
    calls = [];
    const quiet = await runCron(env2, fakeCtx());
    assert.equal(calls.length, 0);
    assert.equal(quiet.windows, 1);
    // nudgeMinutes 0 (default) → no nudge window at all
    const env3 = mkEnv(); await seed(env3, [TESTO_DOSE]);
    await subscribe(env3, fakeCtx(), await genSubscriber(MOZ));
    assert.equal((await runCron(env3, fakeCtx())).windows, 0);
  });

  test('404 / 410 from the push service deletes the subscription', async () => {
    for (const status of [410, 404]) {
      const e = mkEnv(); await seed(e, [TESTO_DOSE]);
      const sub = await genSubscriber(APPLE);
      await subscribe(e, fakeCtx(), sub);
      const id = await expectedId(APPLE);
      assert.ok(e.PROTOCOL_KV.store.has(`push:${id}`));
      mockPush(() => status);
      const s = await runCron(e, fakeCtx());
      assert.equal(calls.length, 1);
      assert.equal(s.sent, 0);
      assert.equal(s.failed, 1);
      assert.match(s.errors[0], new RegExp(`HTTP ${status} \\(subscription removed\\)`));
      assert.ok(!e.PROTOCOL_KV.store.has(`push:${id}`), `${status} removed the record`);
      // other statuses keep it
      const e2 = mkEnv(); await seed(e2, [TESTO_DOSE]);
      await subscribe(e2, fakeCtx(), await genSubscriber(FCM));
      mockPush(() => 500);
      const s2 = await runCron(e2, fakeCtx());
      assert.equal(s2.failed, 1);
      assert.ok(e2.PROTOCOL_KV.store.has(`push:${await expectedId(FCM)}`));
    }
  });

  test('each subscription is evaluated in its own time zone', async () => {
    await seed(env, []);
    const london = await genSubscriber(MOZ), ny = await genSubscriber(APPLE);
    await subscribe(env, ctx, london, { tz: 'Europe/London' });
    await subscribe(env, ctx, ny, { tz: 'America/New_York' });
    freeze('2026-10-03T07:03:00Z'); // 08:03 BST in London, 03:03 EDT in New York
    const s = await runCron(env, fakeCtx());
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, MOZ);
    assert.equal(s.subscriptions, 2);
    await verifyVapid(calls[0].headers.get('Authorization'), MOZ);
    assert.equal((await decryptPush(calls[0].body, london)).json.data.date, TODAY);
  });

  test('a time just before midnight is attributed to the right day', async () => {
    await seed(env, []);
    const sub = await genSubscriber(APPLE);
    await subscribe(env, ctx, sub, { settings: { blocks: { am: false, pre: false, pm: true }, times: { pm: '23:55' } } });
    freeze('2026-10-04T04:05:00Z'); // 00:05 EDT on Oct 4 → 23:55 fell on Oct 3
    await runCron(env, fakeCtx());
    assert.equal(calls.length, 1);
    const { json } = await decryptPush(calls[0].body, sub);
    assert.equal(json.data.date, TODAY);
    assert.ok(env.PROTOCOL_KV.store.has(`pushsent:${await expectedId(APPLE)}:${TODAY}:pm`));
  });

  test('never throws: missing KV, missing VAPID secrets, a corrupt record, a profile with no data', async () => {
    const noKv = await worker.scheduled({ scheduledTime: Date.now() }, { SYNC_TOKEN: 'w' }, fakeCtx());
    assert.match(noKv.errors[0], /PROTOCOL_KV/);
    const noVapid = mkEnv({ VAPID_PRIVATE_KEY: undefined });
    await seed(noVapid, []); await subscribe(noVapid, fakeCtx(), await genSubscriber(APPLE));
    const nv = await worker.scheduled({}, noVapid, fakeCtx());
    assert.match(nv.errors[0], /VAPID/);
    assert.equal(calls.length, 0);
    // a corrupt record and an unknown profile sit next to a good one: the good one still goes out
    await seed(env, []);
    await env.PROTOCOL_KV.put('push:000000000000000000000000', '{nope');
    await env.PROTOCOL_KV.put('push:111111111111111111111111', JSON.stringify({ id: '111111111111111111111111', profile: 'Nobody', subscription: (await genSubscriber(FCM)).subscription, settings: {}, tz: 'America/New_York' }));
    const sub = await genSubscriber(APPLE);
    await subscribe(env, ctx, sub);
    const s = await runCron(env, fakeCtx());
    assert.equal(s.subscriptions, 2);
    assert.equal(s.sent, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, APPLE);
    // scheduled works without ctx too
    freeze(NY_0833);
    const s2 = await worker.scheduled(undefined, env, undefined);
    assert.equal(typeof s2.at, 'string');
    // a fetch that throws is reported, not thrown
    freeze(NY_0803);
    const e3 = mkEnv(); await seed(e3, []); await subscribe(e3, fakeCtx(), await genSubscriber(MOZ));
    globalThis.fetch = async () => { throw new Error('network down'); };
    const s3 = await runCron(e3, fakeCtx());
    assert.equal(s3.failed, 1);
    assert.match(s3.errors[0], /network down/);
  });

  test('POST /push/run runs the same pass over HTTP (write token) and returns its summary', async () => {
    await seed(env, [TESTO_DOSE]);
    await subscribe(env, ctx, await genSubscriber(APPLE));
    const r = await call(env, ctx, '/push/run', { method: 'POST', headers: W });
    assert.equal(r.status, 200);
    const s = await r.json();
    assert.equal(s.sent, 1);
    assert.equal(calls.length, 1);
    assert.equal((await call(env, ctx, '/push/run', { method: 'GET', headers: W })).status, 405);
  });
});

// =====================================================================================
describe('push: POST /push/test', () => {
  let env, ctx;
  beforeEach(async () => { freeze(NY_0803); env = mkEnv(); ctx = fakeCtx(); mockPush(); await seed(env, []); });

  test('sends a test notification to every subscription of the profile, none to other profiles', async () => {
    const a = await genSubscriber(APPLE), b = await genSubscriber(FCM), c = await genSubscriber(MOZ);
    await subscribe(env, ctx, a, { profile: 'Roman', device: 'iPhone' });
    await subscribe(env, ctx, b, { profile: 'Roman', device: 'Mac' });
    await subscribe(env, ctx, c, { profile: 'Scott' });
    const r = await call(env, ctx, '/push/test', { method: 'POST', headers: W, body: { profile: 'Roman' } });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.sent, 2);
    assert.equal(j.failed, 0);
    assert.deepEqual(j.results.map((x) => x.id).sort(), [await expectedId(APPLE), await expectedId(FCM)].sort());
    assert.ok(j.results.every((x) => x.status === 201));
    assert.deepEqual(calls.map((x) => x.url).sort(), [FCM, APPLE].sort());
    const appleCall = calls.find((x) => x.url === APPLE);
    await verifyVapid(appleCall.headers.get('Authorization'), APPLE);
    const { json } = await decryptPush(appleCall.body, a);
    assert.equal(json.title, 'Protocol OS reminders');
    assert.match(json.body, /Test notification for Roman/);
    assert.deepEqual(json.data, { profile: 'Roman', block: 'test', date: TODAY, url: './index.html#today' });
    // the profile falls back to ?profile= when the body has none
    calls = [];
    const r2 = await (await call(env, ctx, '/push/test?profile=Scott', { method: 'POST', headers: W, body: {} })).json();
    assert.equal(r2.sent, 1);
    assert.equal(calls[0].url, MOZ);
    // a profile without subscriptions
    const r3 = await (await call(env, ctx, '/push/test', { method: 'POST', headers: W, body: { profile: 'Jamal' } })).json();
    assert.deepEqual({ sent: r3.sent, failed: r3.failed, results: r3.results }, { sent: 0, failed: 0, results: [] });
    // the test also obeys the write-token rule and the configuration check
    assert.equal((await call(env, ctx, '/push/test', { method: 'POST', headers: R, body: { profile: 'Roman' } })).status, 403);
    const off = await call(mkEnv({ VAPID_PRIVATE_KEY: undefined }), ctx, '/push/test', { method: 'POST', headers: W, body: { profile: 'Roman' } });
    assert.equal(off.status, 503);
    assert.match((await off.json()).error, /VAPID_PRIVATE_KEY/);
  });

  test('per-subscription results: a 410 is reported and the record removed, the rest still go out', async () => {
    const a = await genSubscriber(APPLE), b = await genSubscriber(FCM);
    await subscribe(env, ctx, a); await subscribe(env, ctx, b);
    mockPush((entry) => (entry.url === FCM ? 410 : 201));
    const j = await (await call(env, ctx, '/push/test', { method: 'POST', headers: W, body: { profile: 'Roman' } })).json();
    assert.equal(j.sent, 1);
    assert.equal(j.failed, 1);
    const gone = j.results.find((x) => x.id === undefined || x.status === 410);
    assert.equal(gone.status, 410);
    assert.equal(gone.removed, true);
    assert.ok(!env.PROTOCOL_KV.store.has(`push:${await expectedId(FCM)}`));
    assert.ok(env.PROTOCOL_KV.store.has(`push:${await expectedId(APPLE)}`));
  });
});

// =====================================================================================
describe('PUSH helpers (exported for tests)', () => {
  test('base64url round-trips (padding tolerated); subscriptionId = first 24 hex chars of sha256(endpoint)', async () => {
    const bytes = webcrypto.getRandomValues(new Uint8Array(37));
    const enc = PUSH.b64uEncode(bytes);
    assert.ok(!/[+/=]/.test(enc));
    assert.deepEqual([...PUSH.b64uDecode(enc)], [...bytes]);
    assert.deepEqual([...PUSH.b64uDecode(Buffer.from(bytes).toString('base64'))], [...bytes], 'standard base64 with padding decodes too');
    assert.equal(await PUSH.subscriptionId(APPLE), await expectedId(APPLE));
    assert.equal(PUSH.configured({ VAPID_PUBLIC_KEY: 'a', VAPID_PRIVATE_KEY: 'b' }), true);
    assert.equal(PUSH.configured({ VAPID_PUBLIC_KEY: 'a' }), false);
  });

  test('importVapidKey + vapidJwt produce an ES256 JWT that verifies; bad key material is rejected', async () => {
    freeze(NY_0803);
    const key = await PUSH.importVapidKey(VAPID.publicKey, VAPID.privateKey);
    const jwt = await PUSH.vapidJwt('https://web.push.apple.com', 'mailto:test@example.com', key);
    const claims = await verifyVapid(`vapid t=${jwt}, k=${VAPID.publicKey}`, APPLE);
    assert.equal(claims.exp, Math.floor(Date.now() / 1000) + 12 * 3600);
    await assert.rejects(PUSH.importVapidKey(VAPID.publicKey.slice(0, 40), VAPID.privateKey), /65-byte/);
    await assert.rejects(PUSH.importVapidKey(VAPID.publicKey, 'AAAA'), /32-byte/);
    // headers also accept a padded public key in the env and normalise k=
    const h = await PUSH.vapidHeaders(APPLE, { VAPID_PUBLIC_KEY: VAPID.publicKey + '==', VAPID_PRIVATE_KEY: VAPID.privateKey, VAPID_SUBJECT: 'mailto:test@example.com' });
    await verifyVapid(h.Authorization, APPLE);
  });

  test('encrypt produces an aes128gcm body only the subscriber can open; a fresh ephemeral key and salt every time', async () => {
    const sub = await genSubscriber(APPLE), other = await genSubscriber(FCM);
    const payload = { title: 'x', body: 'y'.repeat(300), data: { n: 1 } };
    const b1 = await PUSH.encrypt(te.encode(JSON.stringify(payload)), sub.subscription.keys.p256dh, sub.subscription.keys.auth);
    const b2 = await PUSH.encrypt(te.encode(JSON.stringify(payload)), sub.subscription.keys.p256dh, sub.subscription.keys.auth);
    assert.deepEqual((await decryptPush(b1, sub)).json, payload);
    assert.deepEqual((await decryptPush(b2, sub)).json, payload);
    assert.notDeepEqual([...b1.slice(0, 16)], [...b2.slice(0, 16)], 'different salt');
    assert.notDeepEqual([...b1.slice(21, 86)], [...b2.slice(21, 86)], 'different ephemeral key');
    await assert.rejects(decryptPush(b1, other), 'another subscriber cannot decrypt');
    await assert.rejects(PUSH.encrypt(te.encode('x'), 'AAAA', sub.subscription.keys.auth), /65-byte/);
    await assert.rejects(PUSH.encrypt(te.encode('x'), sub.subscription.keys.p256dh, 'AAAA'), /16 bytes/);
  });
});
