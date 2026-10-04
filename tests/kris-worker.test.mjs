// Tests for kris/worker.js (the kris-protocol Cloudflare Worker). Plain Node 22: `node --test tests/kris-worker.test.mjs`.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../kris/worker.js';

const BASE = 'https://kris-protocol.example.workers.dev';
const APP_ORIGIN = 'https://rsemenov81-hash.github.io';

function fakeKV() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, String(v)); },
  };
}
let env;
beforeEach(() => { env = { KRIS_KV: fakeKV(), ADMIN_CODE: 'roman-code', MEMBER_CODE: 'kris-code' }; });

async function call(path, { method = 'GET', token, body, origin } = {}) {
  const h = new Headers();
  if (token) h.set('Authorization', 'Bearer ' + token);
  if (origin) h.set('Origin', origin);
  const init = { method, headers: h };
  if (body !== undefined) { h.set('Content-Type', 'application/json'); init.body = typeof body === 'string' ? body : JSON.stringify(body); }
  const res = await worker.fetch(new Request(BASE + path, init), env);
  let j = null; try { j = await res.json(); } catch {}
  return { status: res.status, body: j, headers: res.headers };
}
const state = (token = 'kris-code') => call('/state', { token }).then(r => r.body);
const logAs = (token, log) => call('/log', { method: 'POST', token, body: { log } });

describe('auth and health', () => {
  test('health needs no code', async () => {
    const r = await call('/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
  });
  test('wrong or missing code is 401 with the message the app shows', async () => {
    assert.equal((await call('/state')).status, 401);
    const r = await call('/state', { token: 'nope' });
    assert.equal(r.status, 401);
    assert.equal(r.body.error, 'Bad access code');
  });
  test('each code gets its role', async () => {
    assert.equal((await state('roman-code')).role, 'admin');
    assert.equal((await state('kris-code')).role, 'member');
  });
  test('missing secrets fail closed', async () => {
    env.MEMBER_CODE = '';
    assert.equal((await call('/state', { token: 'roman-code' })).status, 500);
  });
});

describe('Kris seed protocol', () => {
  test('an empty KV serves the four compounds at rev 1', async () => {
    const s = await state();
    assert.equal(s._rev, 1);
    assert.deepEqual(s.compounds.map(c => c.name), ['Retatrutide', 'HCG', 'KLOW', 'Nandrolone']);
    assert.deepEqual(s.logs, []);
  });
  test('doses, days and syringe strengths', async () => {
    const by = Object.fromEntries((await state()).compounds.map(c => [c.name, c]));
    // same formula as the app's concOf(): mcg per U-100 unit
    const conc = (c) => c.unit === 'IU' ? c.vialAmount / (c.bacMl * 100) : (c.vialAmount * 1000) / (c.bacMl * 100);

    const reta = by.Retatrutide;
    assert.deepEqual(reta.schedule.days, [6]);
    assert.equal(reta.doseMcg, 2000);
    assert.equal(conc(reta), 50);
    assert.equal(reta.doseMcg / conc(reta), 40); // 40 units = 0.4 mL

    assert.equal(by.HCG.unit, 'IU');
    assert.equal(by.HCG.doseMcg, 250);
    assert.deepEqual(by.HCG.schedule.days, [2, 6]);

    const klow = by.KLOW;
    assert.deepEqual(klow.schedule.days, [0, 1, 2, 3, 4, 5, 6]);
    assert.equal(Math.round((klow.doseMcg / conc(klow)) * 10) / 10, 10); // 10 units from the 80 mg / 3 mL cartridge
    assert.equal(klow.ingredients.reduce((a, i) => a + i.mg, 0), 80);

    assert.equal(by.Nandrolone.doseMcg, 100000);
    assert.deepEqual(by.Nandrolone.schedule.days, [6]);
  });
});

describe('admin writes', () => {
  test('Roman saves with the current rev; a stale rev is 409', async () => {
    const s = await state('roman-code');
    const next = s.compounds.map(c => c.id === 'c_klow' ? { ...c, doseMcg: 2400 } : c);
    const ok = await call('/admin', { method: 'POST', token: 'roman-code', body: { baseRev: s._rev, compounds: next } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body._rev, 2);
    const stale = await call('/admin', { method: 'POST', token: 'roman-code', body: { baseRev: s._rev, labs: [] } });
    assert.equal(stale.status, 409);
    const after = await state();
    assert.equal(after.compounds.find(c => c.id === 'c_klow').doseMcg, 2400);
  });
  test('Kris cannot change the protocol', async () => {
    const r = await call('/admin', { method: 'POST', token: 'kris-code', body: { baseRev: 1, compounds: [] } });
    assert.equal(r.status, 403);
    assert.equal((await state()).compounds.length, 4);
  });
  test('malformed lists are refused', async () => {
    const r = await call('/admin', { method: 'POST', token: 'roman-code', body: { baseRev: 1, compounds: [{ name: 'no id' }] } });
    assert.equal(r.status, 400);
  });
});

describe('dose logs', () => {
  const reta = { id: 'l1', compoundId: 'c_reta', datetime: '2026-10-03T08:00', doseMcg: 2000, units: 40 };

  test('Kris logs a dose and it is stamped as his', async () => {
    const r = await logAs('kris-code', reta);
    assert.equal(r.status, 200);
    const s = await state();
    assert.equal(s.logs.length, 1);
    assert.equal(s.logs[0].by, 'member');
    assert.equal(s.logs[0].units, 40);
  });
  test('re-posting the same id updates instead of duplicating', async () => {
    await logAs('kris-code', reta);
    await logAs('kris-code', { ...reta, doseMcg: 1500, units: 30 });
    const s = await state();
    assert.equal(s.logs.length, 1);
    assert.equal(s.logs[0].doseMcg, 1500);
  });
  test('the dose gate refuses 5x or more, server side', async () => {
    const r = await logAs('kris-code', { ...reta, doseMcg: 10000 });
    assert.equal(r.status, 422);
    assert.match(r.body.error, /dose gate/);
    assert.equal((await logAs('kris-code', { ...reta, doseMcg: 9999 })).status, 200);
  });
  test('bad input is refused', async () => {
    assert.equal((await logAs('kris-code', { ...reta, compoundId: 'nope' })).status, 400);
    assert.equal((await logAs('kris-code', { ...reta, doseMcg: 0 })).status, 400);
    assert.equal((await logAs('kris-code', { ...reta, datetime: 'yesterday' })).status, 400);
    assert.equal((await call('/log', { method: 'POST', token: 'kris-code', body: 'not json' })).status, 400);
  });
  test('Kris cannot change or remove a dose Roman logged; Roman can remove any', async () => {
    await logAs('roman-code', reta);
    assert.equal((await logAs('kris-code', { ...reta, doseMcg: 1000 })).status, 403);
    assert.equal((await call('/log', { method: 'POST', token: 'kris-code', body: { deleteId: 'l1' } })).status, 403);
    await logAs('kris-code', { ...reta, id: 'l2', compoundId: 'c_hcg', doseMcg: 250, units: null });
    const del = await call('/log', { method: 'POST', token: 'roman-code', body: { deleteId: 'l2' } });
    assert.equal(del.body.removed, true);
    assert.deepEqual((await state()).logs.map(l => l.id), ['l1']);
  });
  test('logging does not bump the rev, so it never blocks an admin save', async () => {
    await logAs('kris-code', reta);
    assert.equal((await state()).logs.length, 1);
    const r = await call('/admin', { method: 'POST', token: 'roman-code', body: { baseRev: 1, labs: [] } });
    assert.equal(r.status, 200);
    assert.equal((await state()).logs.length, 1);
  });
});

describe('CORS', () => {
  test('the GitHub Pages origin is echoed, others are not', async () => {
    const ok = await call('/state', { token: 'kris-code', origin: APP_ORIGIN });
    assert.equal(ok.headers.get('Access-Control-Allow-Origin'), APP_ORIGIN);
    const bad = await call('/state', { token: 'kris-code', origin: 'https://evil.example' });
    assert.equal(bad.headers.get('Access-Control-Allow-Origin'), null);
  });
  test('preflight allows the Authorization header', async () => {
    const r = await worker.fetch(new Request(BASE + '/log', { method: 'OPTIONS', headers: { Origin: APP_ORIGIN } }), env);
    assert.equal(r.status, 204);
    assert.match(r.headers.get('Access-Control-Allow-Headers'), /Authorization/);
  });
});
