// Tests for protocol-sync-worker.js (v1.6.0; the v1.5.0 contract). Plain Node 22: `node --test tests/worker.test.mjs`.
// No dependencies: a Map-backed fake KV, a fake ctx, and node:test's Date mock for frozen clocks.
import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../protocol-sync-worker.js';

const VERSION = '1.6.0';
const BASE = 'https://protocol-sync.example.workers.dev';
const APP_ORIGIN = 'https://rsemenov81-hash.github.io';

// ---------- fakes ----------
function fakeKV({ failPutMatching } = {}) {
  const store = new Map(); // name -> { value, expirationTtl }
  return {
    store,
    async get(name) { const e = store.get(name); return e ? e.value : null; },
    async put(name, value, opts = {}) {
      if (failPutMatching && failPutMatching.test(name)) throw new Error('KV put failed (injected)');
      store.set(name, { value: String(value), expirationTtl: opts.expirationTtl ?? null });
    },
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
function mkEnv(kvOpts) {
  return { PROTOCOL_KV: fakeKV(kvOpts), SYNC_TOKEN: 'w', READ_TOKEN: 'r' };
}
function req(path, { method = 'GET', headers = {}, body, origin } = {}) {
  const h = new Headers(headers);
  if (origin) h.set('Origin', origin);
  const init = { method, headers: h };
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request(BASE + path, init);
}
async function call(env, ctx, path, opts) {
  return worker.fetch(req(path, opts), env, ctx);
}
async function rpc(env, ctx, profile, name, args = {}, { token = 'r', headers = {} } = {}) {
  const res = await call(env, ctx, `/mcp?profile=${profile}${token ? `&token=${token}` : ''}`, {
    method: 'POST', headers, body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
  });
  assert.equal(res.status, 200, `rpc ${name} status`);
  const j = await res.json();
  if (j.error) throw new Error(`rpc ${name}: ${j.error.message}`);
  return JSON.parse(j.result.content[0].text);
}
async function rpcRaw(env, ctx, profile, method, params = {}) {
  const res = await call(env, ctx, `/mcp?profile=${profile}&token=r`, { method: 'POST', body: { jsonrpc: '2.0', id: 7, method, params } });
  return res.json();
}
function freeze(iso) { try { mock.timers.reset(); } catch {} mock.timers.enable({ apis: ['Date'], now: new Date(iso) }); }
afterEach(() => { try { mock.timers.reset(); } catch {} });

// ---------- seed data (shapes from app.jsx) ----------
// Frozen "now": 2026-10-03T14:00:00Z = 10:00 EDT, Saturday 2026-10-03 in America/New_York.
const NOW = '2026-10-03T14:00:00Z';
const TODAY = '2026-10-03', YESTERDAY = '2026-10-02', D2 = '2026-10-01', D3 = '2026-09-30';
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const TS = '2026-10-03T13:59:00.000Z';
function seedBlob() {
  const protocols = [
    // Roman: daily Testosterone (mg-tagged)
    { id: 'p_test', profile: 'Roman', peptideId: 'testosterone-cyp', peptideName: 'Testosterone Cypionate', route: 'inj', doseMcg: 20000, doseUnit: 'mg', doseValue: 20, schedule: { days: ALL_DAYS, timeOfDay: 'morning' }, startDate: '2026-09-01', active: true, updatedAt: TS },
    // Roman: daily HCG, an IU dose — doseMcg carries the IU number
    { id: 'p_hcg', profile: 'Roman', peptideId: 'hcg', peptideName: 'HCG', route: 'inj', doseMcg: 500, doseUnit: 'IU', doseValue: 500, schedule: { days: ALL_DAYS, timeOfDay: 'morning' }, startDate: '2026-09-01', active: true, updatedAt: TS },
    // Roman: archived (active:false, no endDate) — hidden everywhere
    { id: 'p_old', profile: 'Roman', peptideId: 'ipamorelin', peptideName: 'Ipamorelin', route: 'inj', doseMcg: 200, schedule: { days: ALL_DAYS, timeOfDay: 'night' }, startDate: '2026-06-01', active: false, updatedAt: TS },
    // Scott: daily BPC-157
    { id: 'p_bpc', profile: 'Scott', peptideId: 'bpc-157', peptideName: 'BPC-157', route: 'inj', doseMcg: 250, schedule: { days: ALL_DAYS, timeOfDay: 'morning' }, startDate: '2026-09-15', active: true, updatedAt: TS },
  ];
  const logs = [
    // real dose today (Roman)
    { id: 'l1', protocolId: 'p_test', profile: 'Roman', peptide: 'Testosterone Cypionate', peptideId: 'testosterone-cyp', datetime: `${TODAY}T08:00`, doseMcg: 20000, doseUnit: 'mg', doseValue: 20, doseMl: 0.1, updatedAt: TS },
    // skip row today (Roman, HCG) — exactly as the app writes it
    { id: 'l2', protocolId: 'p_hcg', profile: 'Roman', peptide: 'HCG', peptideId: 'hcg', vialId: null, datetime: `${TODAY}T08:00`, doseMcg: 0, skipped: true, updatedAt: TS },
    // dose yesterday (Roman)
    { id: 'l3', protocolId: 'p_test', profile: 'Roman', peptide: 'Testosterone Cypionate', peptideId: 'testosterone-cyp', datetime: `${YESTERDAY}T08:10`, doseMcg: 20000, doseUnit: 'mg', doseValue: 20, updatedAt: TS },
    // IU dose yesterday (Roman) — must count as a dose
    { id: 'l4', protocolId: 'p_hcg', profile: 'Roman', peptide: 'HCG', peptideId: 'hcg', datetime: `${YESTERDAY}T08:12`, doseMcg: 500, doseUnit: 'IU', doseValue: 500, updatedAt: TS },
    // Scott's dose today
    { id: 'l5', protocolId: 'p_bpc', profile: 'Scott', peptide: 'BPC-157', peptideId: 'bpc-157', datetime: `${TODAY}T07:00`, doseMcg: 250, updatedAt: TS },
    // Roman skipped Testosterone two days ago (scores as missed)
    { id: 'l6', protocolId: 'p_test', profile: 'Roman', peptide: 'Testosterone Cypionate', peptideId: 'testosterone-cyp', datetime: `${D2}T08:00`, doseMcg: 0, skipped: true, notes: 'travel', updatedAt: TS },
    // malformed: 0 mcg, not a skip — ignored everywhere
    { id: 'l7', protocolId: 'p_test', profile: 'Roman', peptide: 'Testosterone Cypionate', peptideId: 'testosterone-cyp', datetime: `${D3}T08:00`, doseMcg: 0, updatedAt: TS },
    // back-dated Scott dose
    { id: 'l8', protocolId: 'p_bpc', profile: 'Scott', peptide: 'BPC-157', peptideId: 'bpc-157', datetime: `${YESTERDAY}T09:00`, doseMcg: 250, backfilled: true, updatedAt: TS },
  ];
  const vials = [
    { id: 'v_shared', peptideId: 'testosterone-cyp', peptideName: 'Testosterone Cypionate', active: true, mcgPerMl: 200000, updatedAt: TS },
    { id: 'v_tim', peptideId: 'bpc-157', peptideName: 'BPC-157', active: true, inventoryProfile: 'Tim', updatedAt: TS },
  ];
  const meta = { tombstones: { logs: { l_deleted: TS }, protocols: {}, vials: {} }, migrations: ['m1'] };
  return { protocols, vials, storage: [], logs, meta };
}
async function seedAll(env, blob = seedBlob(), rev = 3) {
  await env.PROTOCOL_KV.put('protocol:all', JSON.stringify({ ...blob, _rev: rev, _syncedAt: TS, profile: 'all' }));
}
async function seedProfile(env, profile, blob, rev = 1) {
  await env.PROTOCOL_KV.put(`protocol:${profile}`, JSON.stringify({ ...blob, _rev: rev, _syncedAt: TS, profile }));
}

// =====================================================================================
describe('version', () => {
  test('health, initialize and get_protocol all report the worker version', async () => {
    const env = mkEnv(), ctx = fakeCtx();
    const h = await (await call(env, ctx, '/health')).json();
    assert.equal(h.version, VERSION);
    const init = await rpcRaw(env, ctx, 'Roman', 'initialize');
    assert.equal(init.result.serverInfo.version, VERSION);
    const p = await rpc(env, ctx, 'Roman', 'get_protocol');
    assert.equal(p.workerVersion, VERSION);
    assert.equal(p.scheduleRules, 'v1');
  });
});

// =====================================================================================
describe('skips are not doses', () => {
  let env, ctx;
  beforeEach(async () => { freeze(NOW); env = mkEnv(); ctx = fakeCtx(); await seedAll(env); });

  test('get_today: skip listed under skipped, not logged, and not still due', async () => {
    const t = await rpc(env, ctx, 'Roman', 'get_today');
    assert.equal(t.date, TODAY);
    assert.deepEqual(t.scheduled.map((s) => s.name).sort(), ['HCG', 'Testosterone Cypionate']);
    assert.equal(t.loggedCount, 1);
    assert.deepEqual(t.logged.map((l) => l.compound), ['Testosterone Cypionate']);
    assert.equal(t.logged[0].dose, '20 mg');
    assert.equal(t.skippedCount, 1);
    assert.deepEqual(t.skipped, [{ compound: 'HCG', time: `${TODAY}T08:00` }]);
    assert.deepEqual(t.stillDue, []);
    // nothing in logged says "0 mcg"
    assert.ok(!JSON.stringify(t.logged).includes('0mcg'));
  });

  test('get_today: an unskipped, unlogged compound is still due', async () => {
    const blob = seedBlob();
    blob.logs = blob.logs.filter((l) => l.id !== 'l2'); // drop the HCG skip
    await seedAll(env, blob);
    const t = await rpc(env, ctx, 'Roman', 'get_today');
    assert.deepEqual(t.stillDue, ['HCG']);
    assert.equal(t.skippedCount, 0);
  });

  test('get_logs_for_date: skips separated with compound and time; IU dose counts as a dose', async () => {
    const d = await rpc(env, ctx, 'Roman', 'get_logs_for_date', { date: TODAY });
    assert.equal(d.count, 1);
    assert.equal(d.logs[0].compound, 'Testosterone Cypionate');
    assert.equal(d.skippedCount, 1);
    assert.deepEqual(d.skipped, [{ compound: 'HCG', time: `${TODAY}T08:00` }]);
    const y = await rpc(env, ctx, 'Roman', 'get_logs_for_date', { date: YESTERDAY });
    assert.equal(y.count, 2);
    const hcg = y.logs.find((l) => l.compound === 'HCG');
    assert.equal(hcg.dose, '500 IU');
    assert.deepEqual(y.skipped, []);
    // a skip with notes carries them; a malformed 0-mcg row is ignored
    const d2 = await rpc(env, ctx, 'Roman', 'get_logs_for_date', { date: D2 });
    assert.equal(d2.count, 0);
    assert.deepEqual(d2.skipped, [{ compound: 'Testosterone Cypionate', time: `${D2}T08:00`, notes: 'travel' }]);
    const d3 = await rpc(env, ctx, 'Roman', 'get_logs_for_date', { date: D3 });
    assert.equal(d3.count, 0);
    assert.equal(d3.skippedCount, 0);
  });

  test('get_adherence: skips count as missed, reported per compound and per day', async () => {
    const a = await rpc(env, ctx, 'Roman', 'get_adherence', { days: 7 });
    assert.equal(a.windowDays, 7);
    assert.equal(a.from, '2026-09-27');
    assert.equal(a.to, TODAY);
    assert.equal(a.totalDoses, 3);
    assert.equal(a.totalSkipped, 2);
    const testo = a.scheduled.find((s) => s.name === 'Testosterone Cypionate');
    assert.deepEqual(testo, { name: 'Testosterone Cypionate', expected: 7, logged: 2, skipped: 1, missed: 5, extra: 0, adherencePct: 29 });
    const hcg = a.scheduled.find((s) => s.name === 'HCG');
    assert.deepEqual(hcg, { name: 'HCG', expected: 7, logged: 1, skipped: 1, missed: 6, extra: 0, adherencePct: 14 });
    assert.deepEqual(a.byDay, [
      { date: D2, doses: 0, skipped: 1 },
      { date: YESTERDAY, doses: 2, skipped: 0 },
      { date: TODAY, doses: 1, skipped: 1 },
    ]);
    // the archived protocol is not scored, Scott's protocol is not visible to Roman
    assert.deepEqual(a.scheduled.map((s) => s.name).sort(), ['HCG', 'Testosterone Cypionate']);
    assert.deepEqual(a.unmatchedLogged, []);
  });

  test('get_adherence: a day with only a skip never scores 100%', async () => {
    const blob = seedBlob();
    blob.protocols = blob.protocols.filter((p) => p.id === 'p_hcg');
    blob.logs = [{ id: 's1', protocolId: 'p_hcg', profile: 'Roman', peptide: 'HCG', peptideId: 'hcg', datetime: `${TODAY}T08:00`, doseMcg: 0, skipped: true }];
    await seedAll(env, blob);
    const a = await rpc(env, ctx, 'Roman', 'get_adherence', { days: 1 });
    assert.deepEqual(a.scheduled, [{ name: 'HCG', expected: 1, logged: 0, skipped: 1, missed: 1, extra: 0, adherencePct: 0 }]);
    assert.deepEqual(a.byDay, [{ date: TODAY, doses: 0, skipped: 1 }]);
  });
});

// =====================================================================================
describe('shared record (protocol:all) with per-profile fallback', () => {
  let env, ctx;
  beforeEach(() => { freeze(NOW); env = mkEnv(); ctx = fakeCtx(); });

  test('reads protocol:all sliced by profile, source "all", even when a stale per-profile key exists', async () => {
    await seedAll(env);
    const stale = seedBlob();
    stale.protocols = [{ id: 'p_stale', profile: 'Roman', peptideId: 'stale', peptideName: 'STALE', schedule: { days: ALL_DAYS }, active: true }];
    stale.logs = [];
    await seedProfile(env, 'Roman', stale, 9);
    const r = await rpc(env, ctx, 'Roman', 'get_protocol');
    assert.equal(r.source, 'all');
    assert.equal(r.rev, 3);
    assert.equal(r.profile, 'Roman');
    assert.deepEqual(r.protocols.map((p) => p.name).sort(), ['HCG', 'Testosterone Cypionate']);
    const s = await rpc(env, ctx, 'Scott', 'get_protocol');
    assert.equal(s.source, 'all');
    assert.deepEqual(s.protocols.map((p) => p.name), ['BPC-157']);
    const st = await rpc(env, ctx, 'Scott', 'get_today');
    assert.deepEqual(st.logged.map((l) => l.compound), ['BPC-157']);
    assert.deepEqual(st.stillDue, []);
    const sy = await rpc(env, ctx, 'Scott', 'get_logs_for_date', { date: YESTERDAY });
    assert.equal(sy.count, 1);
    assert.equal(sy.logs[0].backdated, true);
    // a profile with no data in the shared record is empty, still source "all"
    const j = await rpc(env, ctx, 'Jamal', 'get_protocol');
    assert.equal(j.source, 'all');
    assert.equal(j.activeCount, 0);
  });

  test('falls back to protocol:<profile> with source "profile" when protocol:all is absent', async () => {
    const blob = seedBlob();
    blob.protocols = blob.protocols.filter((p) => p.profile === 'Roman');
    blob.logs = blob.logs.filter((l) => l.profile === 'Roman');
    await seedProfile(env, 'Roman', blob, 5);
    const r = await rpc(env, ctx, 'Roman', 'get_protocol');
    assert.equal(r.source, 'profile');
    assert.equal(r.rev, 5);
    assert.deepEqual(r.protocols.map((p) => p.name).sort(), ['HCG', 'Testosterone Cypionate']);
    const t = await rpc(env, ctx, 'Roman', 'get_today');
    assert.equal(t.loggedCount, 1);
    assert.equal(t.skippedCount, 1);
    // empty KV: still answers, source "profile"
    const e = await rpc(env, ctx, 'Scott', 'get_protocol');
    assert.equal(e.source, 'profile');
    assert.equal(e.activeCount, 0);
    assert.equal(e.rev, 0);
  });

  test('a log without profile follows its protocol; vials filter by inventoryProfile', async () => {
    const blob = seedBlob();
    blob.logs.push({ id: 'l_np', protocolId: 'p_bpc', peptide: 'BPC-157', peptideId: 'bpc-157', datetime: `${TODAY}T07:30`, doseMcg: 250 });
    await seedAll(env, blob);
    const roman = await rpc(env, ctx, 'Roman', 'get_logs_for_date', { date: TODAY });
    assert.ok(!roman.logs.some((l) => l.compound === 'BPC-157'), 'orphan-profile log stays with its protocol owner');
    const scott = await rpc(env, ctx, 'Scott', 'get_logs_for_date', { date: TODAY });
    assert.equal(scott.logs.filter((l) => l.compound === 'BPC-157').length, 2);
  });

  test('/sync accepts ?profile=all like any other key: own rev, If-Match, :prev', async () => {
    const blob = seedBlob();
    const r1 = await call(env, ctx, '/sync?profile=all', { method: 'POST', headers: { Authorization: 'Bearer w', 'Content-Type': 'application/json' }, body: blob });
    assert.equal(r1.status, 200);
    const j1 = await r1.json();
    assert.deepEqual({ ok: j1.ok, profile: j1.profile, rev: j1.rev }, { ok: true, profile: 'all', rev: 1 });
    assert.ok(env.PROTOCOL_KV.store.has('protocol:all'));
    const g = await (await call(env, ctx, '/sync?profile=all', { headers: { Authorization: 'Bearer w' } })).json();
    assert.equal(g._rev, 1);
    assert.equal(g.profile, 'all');
    assert.equal(g.protocols.length, 4);
    // fields the new app adds are stored untouched
    assert.equal(g.protocols[0].updatedAt, TS);
    assert.deepEqual(g.meta.tombstones.logs, { l_deleted: TS });
    assert.equal(g.logs.find((l) => l.id === 'l2').skipped, true);
    // second write with the right If-Match -> rev 2 and :prev holds rev 1
    const r2 = await call(env, ctx, '/sync?profile=all', { method: 'POST', headers: { Authorization: 'Bearer w', 'If-Match': '"1"' }, body: blob });
    assert.equal(r2.status, 200);
    assert.equal((await r2.json()).rev, 2);
    const prev = await (await call(env, ctx, '/sync?profile=all&prev=1', { headers: { Authorization: 'Bearer w' } })).json();
    assert.equal(prev._rev, 1);
    // the MCP now reads from it
    const p = await rpc(env, ctx, 'Roman', 'get_protocol');
    assert.equal(p.source, 'all');
    assert.equal(p.rev, 2);
  });
});

// =====================================================================================
describe('409 merge contract and empty-KV recovery', () => {
  test('stale If-Match -> 409 with currentRev; matching If-Match passes; no If-Match on empty KV creates rev 1', async () => {
    freeze(NOW);
    const env = mkEnv(), ctx = fakeCtx();
    const empty = await (await call(env, ctx, '/sync?profile=Roman', { headers: { Authorization: 'Bearer w' } })).json();
    assert.equal(empty._empty, true);
    assert.deepEqual(empty.protocols, []);
    const blob = seedBlob();
    const a = await call(env, ctx, '/sync?profile=Roman', { method: 'POST', headers: { Authorization: 'Bearer w' }, body: blob });
    assert.equal(a.status, 200);
    assert.equal(a.headers.get('ETag'), '"1"');
    const stale = await call(env, ctx, '/sync?profile=Roman', { method: 'POST', headers: { Authorization: 'Bearer w', 'If-Match': '"0"' }, body: blob });
    assert.equal(stale.status, 409);
    const sj = await stale.json();
    assert.equal(sj.currentRev, 1);
    assert.match(sj.error, /Stale write/);
    const ok = await call(env, ctx, '/sync?profile=Roman', { method: 'POST', headers: { Authorization: 'Bearer w', 'If-Match': '"1"' }, body: blob });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).rev, 2);
    const g = await call(env, ctx, '/sync?profile=Roman', { headers: { Authorization: 'Bearer w' } });
    assert.equal(g.headers.get('ETag'), '"2"');
    assert.equal((await g.json())._rev, 2);
    // bad bodies are rejected, not stored
    const bad = await call(env, ctx, '/sync?profile=Roman', { method: 'POST', headers: { Authorization: 'Bearer w' }, body: { logs: 'nope' } });
    assert.equal(bad.status, 400);
    const notJson = await call(env, ctx, '/sync?profile=Roman', { method: 'POST', headers: { Authorization: 'Bearer w' }, body: '{oops' });
    assert.equal(notJson.status, 400);
  });
});

// =====================================================================================
describe('daily snapshots', () => {
  let env, ctx;
  const W = { Authorization: 'Bearer w' };
  beforeEach(() => { freeze(NOW); env = mkEnv(); ctx = fakeCtx(); });

  test('first accepted POST of the local day writes protocol:<key>:snap:<date> with a 30-day TTL; later POSTs that day do not overwrite it', async () => {
    const b1 = seedBlob();
    const r1 = await call(env, ctx, '/sync?profile=Roman', { method: 'POST', headers: W, body: b1 });
    assert.equal(r1.status, 200);
    await ctx.flush();
    assert.equal(ctx.promises.length, 1, 'snapshot goes through ctx.waitUntil');
    const snapKey = `protocol:Roman:snap:${TODAY}`;
    const e = env.PROTOCOL_KV.store.get(snapKey);
    assert.ok(e, 'snapshot written');
    assert.equal(e.expirationTtl, 30 * 86400);
    const snap1 = JSON.parse(e.value);
    assert.equal(snap1._rev, 1);
    assert.equal(snap1.protocols.length, 4);
    // the :prev copy is still kept
    const b2 = { ...b1, logs: b1.logs.slice(0, 2) };
    const r2 = await call(env, ctx, '/sync?profile=Roman', { method: 'POST', headers: { ...W, 'If-Match': '"1"' }, body: b2 });
    assert.equal(r2.status, 200);
    await ctx.flush();
    assert.ok(env.PROTOCOL_KV.store.has('protocol:Roman:prev'));
    assert.equal(JSON.parse(env.PROTOCOL_KV.store.get('protocol:Roman:prev').value)._rev, 1);
    assert.equal(JSON.parse(env.PROTOCOL_KV.store.get(snapKey).value)._rev, 1, 'same-day POST leaves the snapshot alone');
    // a rejected POST (409) writes nothing
    const r3 = await call(env, ctx, '/sync?profile=Roman', { method: 'POST', headers: { ...W, 'If-Match': '"1"' }, body: b2 });
    assert.equal(r3.status, 409);
    assert.equal([...env.PROTOCOL_KV.store.keys()].filter((k) => k.includes(':snap:')).length, 1);
    // next local day -> a second snapshot of the then-current blob
    freeze('2026-10-04T12:00:00Z');
    const r4 = await call(env, ctx, '/sync?profile=Roman', { method: 'POST', headers: { ...W, 'If-Match': '"2"' }, body: b2 });
    assert.equal(r4.status, 200);
    await ctx.flush();
    assert.equal(JSON.parse(env.PROTOCOL_KV.store.get('protocol:Roman:snap:2026-10-04').value)._rev, 3);
  });

  test('works without ctx (awaited inline) and never fails the POST when the snapshot put throws', async () => {
    const env2 = mkEnv({ failPutMatching: /:snap:/ });
    const r = await call(env2, undefined, '/sync?profile=Roman', { method: 'POST', headers: W, body: seedBlob() });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).rev, 1);
    assert.ok(env2.PROTOCOL_KV.store.has('protocol:Roman'));
    assert.ok(![...env2.PROTOCOL_KV.store.keys()].some((k) => k.includes(':snap:')));
    const env3 = mkEnv();
    const r3 = await call(env3, undefined, '/sync?profile=Roman', { method: 'POST', headers: W, body: seedBlob() });
    assert.equal(r3.status, 200);
    assert.ok(env3.PROTOCOL_KV.store.has(`protocol:Roman:snap:${TODAY}`), 'without ctx the snapshot is awaited inline');
  });

  test('snapshots=1 lists newest first; snapshot=DATE fetches the blob; 404 when missing; write token required', async () => {
    const put = (d, rev) => env.PROTOCOL_KV.put(`protocol:Roman:snap:${d}`, JSON.stringify({ _rev: rev, protocols: [], logs: [] }), { expirationTtl: 30 * 86400 });
    await put('2026-09-28', 1); await put('2026-10-02', 7); await put('2026-09-30', 4);
    await env.PROTOCOL_KV.put('protocol:Scott:snap:2026-10-01', '{}');
    await env.PROTOCOL_KV.put('protocol:Roman:snap:garbage', '{}');
    const list = await call(env, ctx, '/sync?profile=Roman&snapshots=1', { headers: W });
    assert.equal(list.status, 200);
    assert.deepEqual(await list.json(), { profile: 'Roman', snapshots: ['2026-10-02', '2026-09-30', '2026-09-28'] });
    const one = await call(env, ctx, '/sync?profile=Roman&snapshot=2026-09-30', { headers: W });
    assert.equal(one.status, 200);
    assert.equal(one.headers.get('Content-Type'), 'application/json');
    assert.equal((await one.json())._rev, 4);
    const missing = await call(env, ctx, '/sync?profile=Roman&snapshot=2026-01-01', { headers: W });
    assert.equal(missing.status, 404);
    assert.match((await missing.json()).error, /No snapshot/);
    const badDate = await call(env, ctx, '/sync?profile=Roman&snapshot=yesterday', { headers: W });
    assert.equal(badDate.status, 400);
    const ro1 = await call(env, ctx, '/sync?profile=Roman&snapshots=1', { headers: { Authorization: 'Bearer r' } });
    assert.equal(ro1.status, 403);
    const ro2 = await call(env, ctx, '/sync?profile=Roman&snapshot=2026-09-30', { headers: { Authorization: 'Bearer r' } });
    assert.equal(ro2.status, 403);
    const none = await call(env, ctx, '/sync?profile=Roman&snapshots=1');
    assert.equal(none.status, 401);
    // many snapshots paginate through the KV cursor
    const envBig = mkEnv();
    for (let i = 1; i <= 25; i++) await envBig.PROTOCOL_KV.put(`protocol:all:snap:2026-09-${String(i).padStart(2, '0')}`, '{}');
    const origList = envBig.PROTOCOL_KV.list.bind(envBig.PROTOCOL_KV);
    envBig.PROTOCOL_KV.list = (o) => origList({ ...o, limit: 10 });
    const big = await (await call(envBig, ctx, '/sync?profile=all&snapshots=1', { headers: W })).json();
    assert.equal(big.snapshots.length, 25);
    assert.equal(big.snapshots[0], '2026-09-25');
    assert.equal(big.snapshots[24], '2026-09-01');
  });
});

// =====================================================================================
describe('auth: Bearer header preferred over ?token', () => {
  let env, ctx;
  beforeEach(() => { env = mkEnv(); ctx = fakeCtx(); });

  test('header decides when it carries a valid token; ?token keeps working alone or as fallback', async () => {
    const body = seedBlob();
    // header write + query read -> write wins (header preferred)
    let r = await call(env, ctx, '/sync?profile=Roman&token=r', { method: 'POST', headers: { Authorization: 'Bearer w' }, body });
    assert.equal(r.status, 200);
    // header read + query write -> read wins (header preferred) -> 403 on POST
    r = await call(env, ctx, '/sync?profile=Roman&token=w', { method: 'POST', headers: { Authorization: 'Bearer r' }, body });
    assert.equal(r.status, 403);
    // query only (MCP connector style) still works
    r = await call(env, ctx, '/sync?profile=Roman&token=r');
    assert.equal(r.status, 200);
    r = await call(env, ctx, '/sync?profile=Roman&token=r', { method: 'POST', body });
    assert.equal(r.status, 403);
    r = await call(env, ctx, '/sync?profile=Roman&token=w', { method: 'POST', body });
    assert.equal(r.status, 200);
    // header only
    r = await call(env, ctx, '/sync?profile=Roman', { headers: { Authorization: 'Bearer r' } });
    assert.equal(r.status, 200);
    r = await call(env, ctx, '/sync?profile=Roman', { headers: { Authorization: 'Bearer w' } });
    assert.equal(r.status, 200);
    // a header that matches nothing does not lock out a valid ?token
    r = await call(env, ctx, '/sync?profile=Roman&token=r', { headers: { Authorization: 'Bearer bogus' } });
    assert.equal(r.status, 200);
    // nothing valid -> 401
    r = await call(env, ctx, '/sync?profile=Roman');
    assert.equal(r.status, 401);
    r = await call(env, ctx, '/sync?profile=Roman&token=nope', { headers: { Authorization: 'Bearer nope' } });
    assert.equal(r.status, 401);
    r = await call(env, ctx, '/mcp?profile=Roman', { method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'ping' } });
    assert.equal(r.status, 401);
  });

  test('MCP works with the read token in the query string and with the Bearer header', async () => {
    const q = await rpcRaw(env, ctx, 'Roman', 'ping');
    assert.deepEqual(q, { jsonrpc: '2.0', id: 7, result: {} });
    const h = await call(env, ctx, '/mcp?profile=Roman', { method: 'POST', headers: { Authorization: 'Bearer r' }, body: { jsonrpc: '2.0', id: 2, method: 'tools/list' } });
    assert.equal(h.status, 200);
    const tools = (await h.json()).result.tools.map((t) => t.name).sort();
    assert.deepEqual(tools, ['get_adherence', 'get_logs_for_date', 'get_proposals', 'get_protocol', 'get_today', 'propose_change']);
  });
});

// =====================================================================================
describe('CORS and caching', () => {
  let env, ctx;
  beforeEach(() => { env = mkEnv(); ctx = fakeCtx(); });
  const acao = (res) => res.headers.get('Access-Control-Allow-Origin');

  test('echoes only the GitHub Pages origin and localhost/127.0.0.1 with a port', async () => {
    for (const o of [APP_ORIGIN, 'http://localhost:5173', 'http://localhost:8000', 'http://127.0.0.1:3000']) {
      const res = await call(env, ctx, '/sync?profile=Roman', { headers: { Authorization: 'Bearer r' }, origin: o });
      assert.equal(acao(res), o, `echo ${o}`);
      assert.equal(res.headers.get('Vary'), 'Origin');
    }
    for (const o of ['https://evil.example', 'https://rsemenov81-hash.github.io.evil.example', 'http://rsemenov81-hash.github.io', 'http://localhost', 'https://localhost:5173', 'null']) {
      const res = await call(env, ctx, '/sync?profile=Roman', { headers: { Authorization: 'Bearer r' }, origin: o });
      assert.equal(acao(res), null, `no echo for ${o}`);
      assert.equal(res.headers.get('Access-Control-Allow-Methods'), null);
    }
    // no Origin (MCP connector, curl): no CORS headers at all
    const bare = await call(env, ctx, '/sync?profile=Roman', { headers: { Authorization: 'Bearer r' } });
    assert.equal(acao(bare), null);
    assert.equal(bare.headers.get('Access-Control-Expose-Headers'), null);
    // 401 responses follow the same rule
    const unauth = await call(env, ctx, '/sync?profile=Roman', { origin: APP_ORIGIN });
    assert.equal(unauth.status, 401);
    assert.equal(acao(unauth), APP_ORIGIN);
  });

  test('OPTIONS preflight: allowed origin gets the headers the app needs, others get none', async () => {
    const ok = await call(env, ctx, '/sync?profile=Roman', { method: 'OPTIONS', origin: APP_ORIGIN, headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type,if-match' } });
    assert.equal(ok.status, 204);
    assert.equal(acao(ok), APP_ORIGIN);
    const allow = ok.headers.get('Access-Control-Allow-Headers').toLowerCase();
    for (const h of ['authorization', 'content-type', 'if-match']) assert.ok(allow.includes(h), `allow ${h}`);
    assert.ok(ok.headers.get('Access-Control-Allow-Methods').includes('POST'));
    assert.ok(ok.headers.get('Access-Control-Expose-Headers').includes('ETag'));
    const no = await call(env, ctx, '/sync?profile=Roman', { method: 'OPTIONS', origin: 'https://evil.example' });
    assert.equal(no.status, 204);
    assert.equal(acao(no), null);
    assert.equal(no.headers.get('Access-Control-Allow-Headers'), null);
    const mcp = await call(env, ctx, '/mcp', { method: 'OPTIONS', origin: 'http://localhost:4321' });
    assert.equal(acao(mcp), 'http://localhost:4321');
  });

  test('Cache-Control: no-store on every /sync and /mcp response', async () => {
    await seedAll(env);
    const checks = [
      call(env, ctx, '/sync?profile=Roman', { headers: { Authorization: 'Bearer r' } }),
      call(env, ctx, '/sync?profile=Roman', { method: 'POST', headers: { Authorization: 'Bearer w' }, body: seedBlob() }),
      call(env, ctx, '/sync?profile=Roman', { method: 'POST', headers: { Authorization: 'Bearer r' }, body: seedBlob() }),
      call(env, ctx, '/sync?profile=Roman'),
      call(env, ctx, '/sync?profile=Roman&snapshots=1', { headers: { Authorization: 'Bearer w' } }),
      call(env, ctx, '/mcp?profile=Roman&token=r', { method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'ping' } }),
      call(env, ctx, '/mcp?profile=Roman&token=r', { method: 'POST', body: { jsonrpc: '2.0', method: 'notifications/initialized' } }),
      call(env, ctx, '/mcp?profile=Roman&token=r'),
    ];
    const results = await Promise.all(checks);
    for (const res of results) assert.equal(res.headers.get('Cache-Control'), 'no-store', `${res.url} ${res.status}`);
    assert.equal(results[6].status, 202);
    assert.equal(results[7].status, 405);
  });
});

// =====================================================================================
describe('DST-safe adherence window', () => {
  // A daily log on every day of a range: byDay then lists exactly the window's dates.
  function dailyBlob(from, to, profile = 'Roman') {
    const logs = [];
    const t0 = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10), 12);
    const t1 = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10), 12);
    for (let t = t0; t <= t1; t += 864e5) {
      const dk = new Date(t).toISOString().slice(0, 10);
      logs.push({ id: 'd' + dk, protocolId: 'p_test', profile, peptide: 'Testosterone Cypionate', peptideId: 'testosterone-cyp', datetime: `${dk}T08:00`, doseMcg: 20000 });
    }
    const protocols = [{ id: 'p_test', profile, peptideId: 'testosterone-cyp', peptideName: 'Testosterone Cypionate', doseMcg: 20000, schedule: { days: ALL_DAYS }, startDate: '2026-01-01', active: true }];
    return { protocols, logs, vials: [], storage: [], meta: {} };
  }
  const consecutive = (dates) => dates.every((d, i) => i === 0 || Math.round((Date.parse(d) - Date.parse(dates[i - 1])) / 864e5) === 1);

  for (const [label, now, today, mustInclude, from] of [
    ['spring forward (00:30 EDT, 2026-03-09)', '2026-03-09T04:30:00Z', '2026-03-09', '2026-03-08', '2026-03-03'],
    ['fall back (23:30 EST, 2026-11-05)', '2026-11-06T04:30:00Z', '2026-11-05', '2026-11-01', '2026-10-30'],
  ]) {
    test(label, async () => {
      freeze(now);
      const env = mkEnv(), ctx = fakeCtx();
      await seedProfile(env, 'Roman', dailyBlob('2026-02-20', '2026-11-15'));
      const a = await rpc(env, ctx, 'Roman', 'get_adherence', { days: 7 });
      assert.equal(a.to, today);
      assert.equal(a.from, from);
      const dates = a.byDay.map((d) => d.date);
      assert.equal(dates.length, 7, 'seven days');
      assert.equal(new Set(dates).size, 7, 'all distinct');
      assert.ok(consecutive(dates), `consecutive: ${dates.join(',')}`);
      assert.ok(dates.includes(mustInclude), `includes ${mustInclude}`);
      assert.equal(dates[6], today);
      assert.equal(dates[0], from);
      assert.deepEqual(a.scheduled, [{ name: 'Testosterone Cypionate', expected: 7, logged: 7, skipped: 0, missed: 0, extra: 0, adherencePct: 100 }]);
    });
  }
});

// =====================================================================================
describe('unchanged behaviour: schedule rules and get_protocol fields', () => {
  test('endsOn, nextChange, every-other-day expected counts and PRN reporting', async () => {
    freeze(NOW);
    const env = mkEnv(), ctx = fakeCtx();
    const protocols = [
      { id: 'eod', profile: 'Roman', peptideId: 'npp', peptideName: 'NPP', doseMcg: 100000, doseUnit: 'mg', doseValue: 100, schedule: { every: 2, anchor: '2026-10-01', timeOfDay: 'morning' }, startDate: '2026-09-01', active: true },
      { id: 'cycle', profile: 'Roman', peptideId: 'anavar', peptideName: 'Anavar', doseMcg: 25000, schedule: { days: ALL_DAYS }, startDate: '2026-09-20', endDate: '2026-10-10', active: true,
        timeline: [{ from: '2026-09-20', schedule: { days: ALL_DAYS }, doseMcg: 25000 }, { from: '2026-10-06', schedule: { days: [1, 3, 5] }, doseMcg: 50000 }] },
      { id: 'prn', profile: 'Roman', peptideId: 'bpc-157', peptideName: 'BPC-157', doseMcg: 250, schedule: { days: [] }, active: true },
    ];
    await seedAll(env, { protocols, logs: [], vials: [], storage: [], meta: {} });
    const p = await rpc(env, ctx, 'Roman', 'get_protocol');
    const npp = p.protocols.find((x) => x.name === 'NPP');
    assert.equal(npp.days, 'Every other day');
    assert.equal(npp.dose, '100 mg');
    const ana = p.protocols.find((x) => x.name === 'Anavar');
    assert.equal(ana.endsOn, '2026-10-10');
    assert.deepEqual(ana.nextChange, { from: '2026-10-06', days: 'Mon/Wed/Fri', dose: '50mg' });
    const a = await rpc(env, ctx, 'Roman', 'get_adherence', { days: 7 });
    // window 09-27..10-03; EOD anchored 10-01 -> due 09-27, 09-29, 10-01, 10-03 = 4
    assert.equal(a.scheduled.find((x) => x.name === 'NPP').expected, 4);
    assert.deepEqual(a.prnOrUnscheduled, [{ name: 'BPC-157', logged: 0, skipped: 0 }]);
    const t = await rpc(env, ctx, 'Roman', 'get_today');
    assert.deepEqual(t.stillDue.sort(), ['Anavar', 'NPP']);
  });
});
