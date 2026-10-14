// Trey push integration tests with a synthetic recipient. No real notifications are sent.
// fetch is mocked to capture what the worker sends to the push service; payloads are decrypted (RFC 8291)
// and the VAPID JWT is verified against the key /push/config hands out.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import worker, { runReminders } from '../trey/worker.js';

const { subtle } = webcrypto;
const BASE = 'https://trey-protocol.example.workers.dev';
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
  env = { TREY_KV: fakeKV(), ADMIN_TOKEN: 'roman-code', MEMBER_TOKEN: 'trey-code' };
  sent = []; pushStatus = 201;
  globalThis.fetch = async (url, init) => { sent.push({ url: String(url), init }); return new Response(null, { status: pushStatus }); };
});
afterEach(() => { globalThis.fetch = realFetch; });

async function call(path, { method = 'GET', token = 'trey-code', body } = {}) {
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
    assert.equal(Object.keys(JSON.parse(env.TREY_KV.store.get('subs'))).length, 1);
    assert.equal((await subscribe(sub)).status, 200, 'same endpoint updates in place');
    assert.equal(Object.keys(JSON.parse(env.TREY_KV.store.get('subs'))).length, 1);
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
  test('supplement stacks: one "time to take it" push at 10:00 and 21:30, never part of a dose block', async () => {
    const stackItem = (id, stack, name) => ({ id, stack, kind: 'supp', name, serving: '1 capsule', ingredients: [], active: true });
    await setCompounds([VITD, stackItem('s1', 'am', 'Creatine'), stackItem('s2', 'am', 'Omega-3'), { ...stackItem('s3', 'am', 'Old one'), active: false }]);
    assert.deepEqual((await state()).stacks.map(x => [x.id, x.time]), [['am', '10:00'], ['pm', '21:30']]);
    const sub = await genSubscriber('https://push.example/stack');
    await subscribe(sub);

    assert.equal((await runReminders(env, at('2026-10-12T08:05'))).sent, 1);
    assert.equal((await decrypt(sent[0].init.body, sub)).body, '1 due: Vitamin D3 5,000 IU. Tap to log.', 'stack items stay out of the dose block');

    assert.equal((await runReminders(env, at('2026-10-12T10:00'))).sent, 1);
    const msg = await decrypt(sent[1].init.body, sub);
    assert.equal(msg.title, 'Morning stack');
    assert.equal(msg.body, 'Time to take it — 2 items: Creatine, Omega-3.');
    assert.equal(msg.data.tab, 'supps');
    assert.equal((await runReminders(env, at('2026-10-12T10:10'))).sent, 0, 'once a day');

    assert.equal((await runReminders(env, at('2026-10-12T21:35'))).sent, 0, 'the night stack is empty: nothing to send');
  });
  test('stack-only subscription sends morning and night exactly once without dose reminders or nudges', async () => {
    await setCompounds([VITD, { id:'am-stack',stack:'am',kind:'supp',name:'Example AM' }, { id:'pm-stack',stack:'pm',kind:'supp',name:'Example PM' }]);
    const sub=await genSubscriber('https://push.example/stacks-only');
    await subscribe(sub,{times:{am:'',pm:''},nudge:0});
    assert.equal((await runReminders(env,at('2026-10-12T08:05'))).sent,0);
    assert.equal((await runReminders(env,at('2026-10-12T10:05'))).sent,1);
    assert.equal((await decrypt(sent[0].init.body,sub)).title,'Morning stack');
    assert.equal((await runReminders(env,at('2026-10-12T10:10'))).sent,0);
    assert.equal((await runReminders(env,at('2026-10-12T20:05'))).sent,0);
    assert.equal((await runReminders(env,at('2026-10-12T21:35'))).sent,1);
    assert.equal((await decrypt(sent[1].init.body,sub)).title,'Night stack');
    assert.equal((await runReminders(env,at('2026-10-12T21:40'))).sent,0);
    assert.equal((await runReminders(env,at('2026-10-12T22:05'))).sent,0);
  });
  test('a 410 from the push service drops the device; test and unsubscribe work by endpoint', async () => {
    await setCompounds([VITD]);
    const sub = await genSubscriber('https://push.example/gone');
    await subscribe(sub);
    assert.equal((await call('/push/test', { method: 'POST', body: { endpoint: sub.subscription.endpoint } })).status, 200);
    assert.equal((await decrypt(sent[0].init.body, sub)).body, 'Reminders are on for this device.');
    pushStatus = 410;
    assert.deepEqual(await runReminders(env, at('2026-10-12T08:01')), { sent: 0, failed: 1 });
    assert.deepEqual(JSON.parse(env.TREY_KV.store.get('subs')), {});
    pushStatus = 201;
    await subscribe(sub);
    assert.equal((await call('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.subscription.endpoint } })).body.removed, true);
    assert.equal((await call('/push/test', { method: 'POST', body: { endpoint: sub.subscription.endpoint } })).status, 404);
  });
});


describe('Trey notification reliability', () => {
  test('notification text retains a fractional IU dose', async () => {
    await setCompounds([{...TEST, name:'Fractional fixture', unit:'IU', doseMcg:2.5, schedule:{days:[1]}}]);
    const sub = await genSubscriber('https://web.push.apple.com/fraction');
    await subscribe(sub);
    assert.equal((await runReminders(env, at('2026-10-12T08:00'))).sent,1);
    assert.match((await decrypt(sent[0].init.body,sub)).body,/2\.5 IU/);
  });
  test('a temporary push failure can retry in the same window and then deduplicates', async () => {
    await setCompounds([VITD]);
    const sub = await genSubscriber('https://web.push.apple.com/retry'); await subscribe(sub);
    pushStatus = 503;
    assert.deepEqual(await runReminders(env,at('2026-10-12T08:00')),{sent:0,failed:1});
    pushStatus = 201;
    assert.deepEqual(await runReminders(env,at('2026-10-12T08:01')),{sent:1,failed:0});
    assert.deepEqual(await runReminders(env,at('2026-10-12T08:02')),{sent:0,failed:0});
  });
  test('a transport exception does not prevent a later retry', async () => {
    await setCompounds([VITD]);
    const sub = await genSubscriber('https://web.push.apple.com/network'); await subscribe(sub);
    globalThis.fetch = async () => {throw Error('temporary network failure');};
    assert.deepEqual(await runReminders(env,at('2026-10-12T08:00')),{sent:0,failed:1});
    globalThis.fetch = async (url,init) => {sent.push({url,init});return new Response(null,{status:201});};
    assert.deepEqual(await runReminders(env,at('2026-10-12T08:01')),{sent:1,failed:0});
  });
  test('the cron uses its scheduled time even if execution is delayed', async () => {
    await setCompounds([VITD]);
    const sub = await genSubscriber('https://web.push.apple.com/cron'); await subscribe(sub);
    let task;
    await worker.scheduled({scheduledTime:at('2026-10-12T08:00').getTime()},env,{waitUntil:p=>task=p});
    await task;
    assert.equal(sent.length,1);
  });
  test('device status confirms the server subscription and schedule', async () => {
    const sub=await genSubscriber('https://web.push.apple.com/status');
    const body={endpoint:sub.subscription.endpoint};
    assert.equal((await call('/push/status',{method:'POST',body})).body.registered,false);
    await subscribe(sub);
    const result=await call('/push/status',{method:'POST',body});
    assert.equal(result.status,200); assert.equal(result.body.registered,true);
    assert.deepEqual(result.body.times,{am:'08:00',pm:'20:00'});
    assert.equal((await call('/push/status',{method:'POST',body,token:''})).status,401);
    assert.equal(JSON.stringify(result.body).includes('keys'),false);
  });
  test('schedule follows daylight saving time in the device timezone', async () => {
    await setCompounds([VITD]);
    const sub=await genSubscriber('https://web.push.apple.com/dst'); await subscribe(sub);
    assert.equal((await runReminders(env,new Date('2026-11-02T12:00:00Z'))).sent,0);
    assert.equal((await runReminders(env,new Date('2026-11-02T13:00:00Z'))).sent,1);
  });
});
