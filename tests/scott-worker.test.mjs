// Tests for scott/worker.js (the scott-protocol Cloudflare Worker). Plain Node 22: `node --test tests/scott-worker.test.mjs`.
// fetch is mocked to capture what the worker sends to the push service; payloads are decrypted (RFC 8291)
// and the VAPID JWT is verified against the key /push/config hands out.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import worker, { runReminders } from '../scott/worker.js';

const { subtle } = webcrypto;
const BASE = 'https://scott-protocol.example.workers.dev';
const te = new TextEncoder(), td = new TextDecoder();
const b64u = (bytes) => Buffer.from(bytes).toString('base64url');
const fromB64u = (s) => new Uint8Array(Buffer.from(s, 'base64url'));

function fakeKV() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
  };
}
let env, sent, pushStatus;
const realFetch = globalThis.fetch;
beforeEach(() => {
  env = { SCOTT_KV: fakeKV(), ADMIN_CODE: 'roman-code', MEMBER_CODE: 'scott-code' };
  sent = []; pushStatus = 201;
  globalThis.fetch = async (url, init) => { sent.push({ url: String(url), init }); return new Response(null, { status: pushStatus }); };
});
afterEach(() => { globalThis.fetch = realFetch; });

async function call(path, { method = 'GET', token = 'scott-code', body } = {}) {
  const h = new Headers();
  if (token) h.set('Authorization', 'Bearer ' + token);
  const init = { method, headers: h };
  if (body !== undefined) { h.set('Content-Type', 'application/json'); init.body = JSON.stringify(body); }
  const res = await worker.fetch(new Request(BASE + path, init), env);
  let j = null; try { j = await res.json(); } catch {}
  return { status: res.status, body: j };
}
async function genSubscriber(endpoint) {
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  return { kp, subscription: { endpoint, keys: { p256dh: b64u(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))), auth: b64u(webcrypto.getRandomValues(new Uint8Array(16))) } } };
}
async function hkdf(salt, ikm, info, len) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}
async function decrypt(body, sub) {
  const b = new Uint8Array(body);
  const salt = b.slice(0, 16), idlen = b[20], asPub = b.slice(21, 21 + idlen), ct = b.slice(21 + idlen);
  const asKey = await subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, sub.kp.privateKey, 256));
  const ikm = await hkdf(fromB64u(sub.subscription.keys.auth), shared, Buffer.concat([te.encode('WebPush: info\0'), fromB64u(sub.subscription.keys.p256dh), asPub]), 32);
  const aes = await subtle.importKey('raw', await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16), 'AES-GCM', false, ['decrypt']);
  const pt = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12) }, aes, ct));
  assert.equal(pt[pt.length - 1], 2, 'last-record delimiter');
  return JSON.parse(td.decode(pt.slice(0, -1)));
}
async function verifyVapid(auth, publicKey, endpoint) {
  const m = /^vapid t=([^,\s]+), k=([^,\s]+)$/.exec(auth);
  assert.ok(m, auth);
  assert.equal(m[2], publicKey);
  const [h, c, s] = m[1].split('.');
  const claims = JSON.parse(td.decode(fromB64u(c)));
  assert.equal(claims.aud, new URL(endpoint).origin);
  assert.match(claims.sub, /^https:\/\//);
  const key = await subtle.importKey('raw', fromB64u(publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromB64u(s), te.encode(`${h}.${c}`)), 'JWT signature verifies');
}
const subscribe = (sub, extra = {}) => call('/push/subscribe', { method: 'POST', body: { subscription: sub.subscription, times: { am: '08:00', pm: '20:00' }, nudge: 0, tz: 'America/New_York', ...extra } });
// 2026-10-12 is EDT (UTC-4): 08:05 local = 12:05Z.
const at = (local) => new Date(`${local}:00-04:00`);

test('retired record routes disclose nothing and preserve records for both roles', async () => {
  const record = JSON.stringify({ compounds: [{ doseMcg: 12345 }], logs: ['fixture'] });
  await env.SCOTT_KV.put('state', record);
  for (const token of ['roman-code', 'scott-code', '']) {
    for (const path of ['/state', '/state/', '/document?id=doc_fixture', '/admin', '/log']) {
      const result = await call(path, { token, method: ['/admin', '/log'].includes(path) ? 'POST' : 'GET', body: undefined });
      assert.equal(result.status, 410);
      assert.deepEqual(result.body, { message: 'Google it.' });
    }
  }
  assert.equal(await env.SCOTT_KV.get('state'), record);
});
test('existing subscription receives encrypted Google it once per hour, with no state reads', async () => {
  const sub = await genSubscriber('https://push.example/subscriber');
  assert.equal((await subscribe(sub)).status, 200);
  assert.equal((await subscribe(sub)).status, 200);
  assert.equal(Object.keys(JSON.parse(await env.SCOTT_KV.get('subs'))).length, 1);
  const get = env.SCOTT_KV.get.bind(env.SCOTT_KV);
  env.SCOTT_KV.get = key => { assert.notEqual(key, 'state'); return get(key); };
  for (const minute of ['00', '15', '30', '45']) await runReminders(env, new Date(`2026-11-01T12:${minute}:00Z`));
  assert.equal(sent.length, 1);
  const payload = await decrypt(sent[0].init.body, sub);
  assert.equal(payload.title, 'Google it.');
  assert.equal(payload.body, 'Google it.');
  const config = await call('/push/config');
  await verifyVapid(sent[0].init.headers.Authorization, config.body.publicKey, sub.subscription.endpoint);
  await runReminders(env, new Date('2026-11-01T13:00:00Z'));
  assert.equal(sent.length, 2);
});
test('expired subscriptions removed; no new subscriptions created by cron', async () => {
  assert.deepEqual(await runReminders(env, new Date()), { sent: 0, failed: 0 });
  const sub = await genSubscriber('https://push.example/expired');
  await subscribe(sub);
  pushStatus = 410;
  await runReminders(env, new Date());
  assert.deepEqual(JSON.parse(await env.SCOTT_KV.get('subs')), {});
});
test('test push is sanitized and requires authentication', async () => {
  assert.equal((await call('/push/config', { token: '' })).status, 401);
  const sub = await genSubscriber('https://push.example/test');
  await subscribe(sub);
  await call('/push/test', { method: 'POST', body: { endpoint: sub.subscription.endpoint } });
  assert.equal((await decrypt(sent[0].init.body, sub)).body, 'Google it.');
});
