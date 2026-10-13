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
const state = (token) => call('/state', { token }).then(r => r.body);
async function setCompounds(compounds) {
  const s = await state('roman-code');
  const r = await call('/admin', { method: 'POST', token: 'roman-code', body: { baseRev: s._rev, compounds } });
  assert.equal(r.status, 200);
}

// 2026-10-12 is a Monday (dow 1). Fixed items: a daily AM supplement, a Monday PM med, a Saturday-only injection.
const VITD = { id: 'vd', kind: 'supp', name: 'Vitamin D3', dose: '5,000 IU', timing: 'Morning', schedule: { days: [0, 1, 2, 3, 4, 5, 6] } };
const MET = { id: 'met', kind: 'med', name: 'Metformin', dose: '500 mg', timing: 'Evening', schedule: { days: [1] } };
const TEST = { id: 'tc', name: 'Testosterone Cypionate', doseMcg: 75000, mcgPerUnit: 2500, timing: 'Morning', schedule: { days: [6] } };
const PRN = { id: 'prn', kind: 'supp', name: 'Melatonin', dose: '3 mg', timing: 'Nightly', schedule: { days: [] } };

describe('protocol and logs', () => {
  test('codes and roles', async () => {
    assert.equal((await call('/health', { token: '' })).status, 200);
    assert.equal((await call('/state', { token: 'nope' })).status, 401);
    assert.equal((await state('scott-code')).role, 'member');
    assert.equal((await state('roman-code')).role, 'admin');
  });
  test("an empty KV serves Scott's four compounds at rev 1", async () => {
    const s = await state('scott-code');
    assert.equal(s._rev, 1);
    assert.deepEqual(s.compounds.map(c => c.name), ['Testosterone Cypionate', 'Nandrolone Decanoate', 'HCG', 'Anavar']);
    assert.ok(s.compounds.every(c => !c.kind && c.active), 'all four sit on the Protocol tab');
    assert.deepEqual(s.logs, []);
  });
  test('seed doses, days and syringe draws', async () => {
    const by = Object.fromEntries((await state()).compounds.map(c => [c.name, c]));
    // the app's concOf(): strength per U-100 syringe unit
    const conc = (c) => c.vialAmount > 0 && c.bacMl > 0
      ? (c.unit === 'IU' ? c.vialAmount / (c.bacMl * 100) : (c.vialAmount * 1000) / (c.bacMl * 100))
      : Number(c.mcgPerUnit) || 0;
    const draw = (c) => ({ units: Math.round((c.doseMcg / conc(c)) * 10) / 10, mL: c.doseMcg / conc(c) / 100 });

    const t = by['Testosterone Cypionate'];
    assert.deepEqual(t.schedule.days, [1, 5]); // Mon, Fri
    assert.equal(t.doseMcg, 75000);
    assert.equal(conc(t), 2500); // 250 mg/mL
    assert.deepEqual(draw(t), { units: 30, mL: 0.3 });

    const n = by['Nandrolone Decanoate'];
    assert.deepEqual(n.schedule.days, [1, 5]);
    assert.equal(n.doseMcg, 50000);
    assert.equal(conc(n), 3000); // 300 mg/mL
    assert.equal(draw(n).units, 16.7);
    assert.ok(Math.abs(draw(n).mL - 1 / 6) < 1e-9, '50 mg / 300 mg/mL = 0.1667 mL');

    const h = by.HCG;
    assert.equal(h.unit, 'IU');
    assert.deepEqual(h.schedule.days, [2, 6]); // Tue, Sat
    assert.equal(h.doseMcg, 500);
    assert.equal(conc(h), 50); // 10,000 IU in 2 mL
    assert.deepEqual(draw(h), { units: 10, mL: 0.1 });

    const a = by.Anavar;
    assert.deepEqual(a.schedule.days, [0, 1, 2, 3, 4, 5, 6]);
    assert.equal(a.doseMcg, 10000);
    assert.equal(conc(a), 0, 'oral: no syringe draw');
  });
  test('the seed passes the dose gate at its own doses', async () => {
    for (const c of (await state()).compounds) {
      const r = await call('/log', { method: 'POST', body: { log: { compoundId: c.id, datetime: '2026-10-12T08:00', doseMcg: c.doseMcg } } });
      assert.equal(r.status, 200, c.name);
    }
  });
  test('only Roman edits the protocol', async () => {
    const r = await call('/admin', { method: 'POST', body: { baseRev: 1, compounds: [VITD] } });
    assert.equal(r.status, 403);
  });
  test('supplements and meds log as "taken" with no dose', async () => {
    await setCompounds([VITD, MET, TEST]);
    const r = await call('/log', { method: 'POST', body: { log: { id: 'l1', compoundId: 'vd', datetime: '2026-10-12T08:10' } } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.log, { id: 'l1', compoundId: 'vd', datetime: '2026-10-12T08:10', doseMcg: null, units: null, by: 'member' });
  });
  test('injections keep the dose rules and the 5× gate', async () => {
    await setCompounds([VITD, MET, TEST]);
    assert.equal((await call('/log', { method: 'POST', body: { log: { compoundId: 'tc', datetime: '2026-10-12T08:10' } } })).status, 400);
    assert.equal((await call('/log', { method: 'POST', body: { log: { compoundId: 'tc', datetime: '2026-10-12T08:10', doseMcg: 375000 } } })).status, 422);
    const ok = await call('/log', { method: 'POST', body: { log: { compoundId: 'tc', datetime: '2026-10-12T08:10', doseMcg: 75000, units: 30 } } });
    assert.equal(ok.body.log.doseMcg, 75000);
  });
  test("Scott cannot remove Roman's log", async () => {
    await setCompounds([VITD]);
    await call('/log', { method: 'POST', token: 'roman-code', body: { log: { id: 'r1', compoundId: 'vd', datetime: '2026-10-12T08:00' } } });
    assert.equal((await call('/log', { method: 'POST', body: { deleteId: 'r1' } })).status, 403);
  });
});

// ---------- push ----------
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

describe('push reminders', () => {
  test('/push/config mints one VAPID key and keeps it', async () => {
    const a = (await call('/push/config')).body.publicKey;
    assert.equal(fromB64u(a).length, 65);
    assert.equal((await call('/push/config', { token: 'roman-code' })).body.publicKey, a);
  });
  test('subscribe validates its input', async () => {
    const sub = await genSubscriber('https://push.example/abc');
    assert.equal((await call('/push/subscribe', { method: 'POST', body: { subscription: { endpoint: 'http://x' } } })).status, 400);
    assert.equal((await subscribe(sub, { times: { am: '8am' } })).status, 400);
    assert.equal((await subscribe(sub)).status, 200);
    assert.equal(Object.keys(JSON.parse(env.SCOTT_KV.store.get('subs'))).length, 1);
    assert.equal((await subscribe(sub)).status, 200, 'same endpoint updates in place');
    assert.equal(Object.keys(JSON.parse(env.SCOTT_KV.store.get('subs'))).length, 1);
  });
  test('the morning push lists what is due and unlogged, signed and encrypted, once', async () => {
    await setCompounds([VITD, MET, TEST, PRN]);
    const sub = await genSubscriber('https://web.push.apple.com/abc');
    await subscribe(sub);
    const { publicKey } = (await call('/push/config')).body;

    assert.deepEqual(await runReminders(env, at('2026-10-12T07:50')), { sent: 0, failed: 0 }, 'before the time');
    assert.deepEqual(await runReminders(env, at('2026-10-12T08:05')), { sent: 1, failed: 0 });
    assert.equal(sent[0].url, 'https://web.push.apple.com/abc');
    assert.equal(sent[0].init.headers['Content-Encoding'], 'aes128gcm');
    await verifyVapid(sent[0].init.headers.Authorization, publicKey, sent[0].url);
    const msg = await decrypt(sent[0].init.body, sub);
    assert.equal(msg.title, 'Morning protocol');
    assert.equal(msg.body, '1 due: Vitamin D3 5,000 IU. Tap to log.', 'Saturday injection, PM med and PRN are not in the morning list');
    assert.equal(msg.data.tab, 'supps');

    assert.deepEqual(await runReminders(env, at('2026-10-12T08:12')), { sent: 0, failed: 0 }, 'same window again: deduped');
  });
  test('a logged block sends nothing; the nudge only goes out while something is still due', async () => {
    await setCompounds([VITD, MET]);
    const sub = await genSubscriber('https://push.example/n');
    await subscribe(sub, { nudge: 30 });
    await call('/log', { method: 'POST', body: { log: { compoundId: 'met', datetime: '2026-10-12T19:58' } } });
    assert.equal((await runReminders(env, at('2026-10-12T20:05'))).sent, 0, 'Metformin already taken');
    assert.equal((await runReminders(env, at('2026-10-12T08:31'))).sent, 1, '08:30 nudge for the untaken Vitamin D');
    assert.equal((await decrypt(sent[0].init.body, sub)).title, 'Still due: Morning protocol');
  });
  test('a late-evening time is checked against the day it belongs to', async () => {
    await setCompounds([MET]); // Mondays only
    const sub = await genSubscriber('https://push.example/late');
    await subscribe(sub, { times: { am: '', pm: '23:55' } });
    assert.equal((await runReminders(env, at('2026-10-13T00:05'))).sent, 1, '23:55 Monday, seen from 00:05 Tuesday');
  });
  test('a 410 from the push service drops the device; test and unsubscribe work by endpoint', async () => {
    await setCompounds([VITD]);
    const sub = await genSubscriber('https://push.example/gone');
    await subscribe(sub);
    assert.equal((await call('/push/test', { method: 'POST', body: { endpoint: sub.subscription.endpoint } })).status, 200);
    assert.equal((await decrypt(sent[0].init.body, sub)).body, 'Reminders are on for this device.');
    pushStatus = 410;
    assert.deepEqual(await runReminders(env, at('2026-10-12T08:01')), { sent: 0, failed: 1 });
    assert.deepEqual(JSON.parse(env.SCOTT_KV.store.get('subs')), {});
    pushStatus = 201;
    await subscribe(sub);
    assert.equal((await call('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.subscription.endpoint } })).body.removed, true);
    assert.equal((await call('/push/test', { method: 'POST', body: { endpoint: sub.subscription.endpoint } })).status, 404);
  });
});
