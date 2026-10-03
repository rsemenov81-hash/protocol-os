// Tests for the Claude proposal inbox in protocol-sync-worker.js (v1.6.0).
// Plain Node 22, no dependencies: `node --test tests/worker-proposals.test.mjs`.
import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../protocol-sync-worker.js';

const VERSION = '1.6.0';
const BASE = 'https://protocol-sync.example.workers.dev';
const W = { Authorization: 'Bearer w' };
const R = { Authorization: 'Bearer r' };

// ---------- fakes (same shapes as tests/worker.test.mjs) ----------
function fakeKV() {
  const store = new Map();
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
const mkEnv = () => ({ PROTOCOL_KV: fakeKV(), SYNC_TOKEN: 'w', READ_TOKEN: 'r' });
function req(path, { method = 'GET', headers = {}, body } = {}) {
  const init = { method, headers: new Headers(headers) };
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request(BASE + path, init);
}
const call = (env, ctx, path, opts) => worker.fetch(req(path, opts), env, ctx);
async function rpc(env, ctx, profile, name, args = {}, token = 'r') {
  const res = await call(env, ctx, `/mcp?profile=${profile}&token=${token}`, { method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } } });
  assert.equal(res.status, 200, `rpc ${name} status`);
  const j = await res.json();
  if (j.error) throw new Error(j.error.message);
  return JSON.parse(j.result.content[0].text);
}
function freeze(iso) { try { mock.timers.reset(); } catch {} mock.timers.enable({ apis: ['Date'], now: new Date(iso) }); }
afterEach(() => { try { mock.timers.reset(); } catch {} });

// ---------- seed ----------
// 2026-10-03T14:00:00Z = 10:00 EDT, Saturday 2026-10-03 in New York.
const NOW = '2026-10-03T14:00:00Z';
const TODAY = '2026-10-03';
const ALL = [0, 1, 2, 3, 4, 5, 6];
const TS = '2026-10-03T13:59:00.000Z';
function seedBlob() {
  return {
    protocols: [
      { id: 'p_test', profile: 'Roman', peptideId: 'testosterone-cyp', peptideName: 'Testosterone Cypionate', route: 'inj', doseMcg: 20000, doseUnit: 'mg', doseValue: 20, schedule: { days: ALL, timeOfDay: 'morning' }, startDate: '2026-09-01', active: true, updatedAt: TS },
      { id: 'p_hcg', profile: 'Roman', peptideId: 'hcg', peptideName: 'HCG', route: 'inj', doseMcg: 500, doseUnit: 'IU', doseValue: 500, schedule: { days: ALL, timeOfDay: 'morning' }, startDate: '2026-09-01', active: true, updatedAt: TS },
      { id: 'p_old', profile: 'Roman', peptideId: 'ipamorelin', peptideName: 'Ipamorelin', route: 'inj', doseMcg: 200, schedule: { days: ALL, timeOfDay: 'night' }, startDate: '2026-06-01', active: false, updatedAt: TS },
      { id: 'p_bpc', profile: 'Scott', peptideId: 'bpc-157', peptideName: 'BPC-157', route: 'inj', doseMcg: 250, schedule: { days: ALL, timeOfDay: 'morning' }, startDate: '2026-09-15', active: true, updatedAt: TS },
    ],
    logs: [], vials: [], storage: [], meta: { tombstones: { logs: {}, protocols: {}, vials: {} } },
  };
}
async function seedAll(env, blob = seedBlob(), rev = 3) {
  await env.PROTOCOL_KV.put('protocol:all', JSON.stringify({ ...blob, _rev: rev, _syncedAt: TS, profile: 'all' }));
}
const PROPOSE = { profile: 'Roman', peptideName: 'testosterone cypionate', change: { doseMcg: 25000, doseUnit: 'mg', schedule: { days: ALL } }, rationale: 'Trough T came back low on the 20 mg dose.', effectiveFrom: '2026-10-05' };
const stored = (env, profile) => JSON.parse(env.PROTOCOL_KV.store.get(`proposals:${profile}`).value);

// =====================================================================================
describe('version and tool list', () => {
  test('1.6.0 everywhere; tools/list carries propose_change and get_proposals', async () => {
    const env = mkEnv(), ctx = fakeCtx();
    assert.equal((await (await call(env, ctx, '/health')).json()).version, VERSION);
    const init = await (await call(env, ctx, '/mcp?profile=Roman&token=r', { method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} } })).json();
    assert.equal(init.result.serverInfo.version, VERSION);
    assert.equal((await rpc(env, ctx, 'Roman', 'get_protocol')).workerVersion, VERSION);
    const list = await (await call(env, ctx, '/mcp?profile=Roman&token=r', { method: 'POST', body: { jsonrpc: '2.0', id: 2, method: 'tools/list' } })).json();
    const tools = Object.fromEntries(list.result.tools.map((t) => [t.name, t]));
    assert.ok(tools.propose_change && tools.get_proposals);
    assert.deepEqual(tools.propose_change.inputSchema.required, ['profile', 'change', 'rationale']);
    assert.deepEqual(Object.keys(tools.propose_change.inputSchema.properties.change.properties).sort(), ['doseMcg', 'doseUnit', 'endDate', 'note', 'schedule']);
    assert.deepEqual(tools.get_proposals.inputSchema.properties.status.enum, ['pending', 'approved', 'dismissed', 'all']);
  });
});

// =====================================================================================
describe('propose_change (MCP)', () => {
  let env, ctx;
  beforeEach(async () => { freeze(NOW); env = mkEnv(); ctx = fakeCtx(); await seedAll(env); });

  test('read token creates a pending proposal, visible through get_proposals and GET /proposals', async () => {
    const r = await rpc(env, ctx, 'Roman', 'propose_change', PROPOSE, 'r');
    assert.equal(r.ok, true);
    assert.match(r.id, /^pr_[0-9a-f]{12}$/);
    assert.equal(r.summary, 'Proposed for Roman: Testosterone Cypionate 25 mg daily from Oct 5');
    const list = stored(env, 'Roman');
    assert.equal(list.length, 1);
    const p = list[0];
    assert.equal(p.id, r.id);
    assert.equal(p.profile, 'Roman');
    assert.equal(p.protocolId, 'p_test');
    assert.equal(p.peptideName, 'Testosterone Cypionate');
    assert.deepEqual(p.change, { doseMcg: 25000, doseUnit: 'mg', schedule: { days: ALL } });
    assert.equal(p.rationale, PROPOSE.rationale);
    assert.equal(p.effectiveFrom, '2026-10-05');
    assert.equal(p.status, 'pending');
    assert.equal(p.createdAt, new Date(NOW).toISOString());
    assert.equal(p.createdBy, 'mcp');
    assert.equal(p.resolvedAt, null);
    assert.equal(p.resolution, null);
    assert.equal(p.summary, r.summary);
    assert.deepEqual(r.proposal, p);
    // get_proposals (MCP, read token)
    const g = await rpc(env, ctx, 'Roman', 'get_proposals', { profile: 'Roman' });
    assert.deepEqual({ profile: g.profile, status: g.status, count: g.count, pendingCount: g.pendingCount }, { profile: 'Roman', status: 'all', count: 1, pendingCount: 1 });
    assert.equal(g.proposals[0].id, r.id);
    assert.equal((await rpc(env, ctx, 'Roman', 'get_proposals', { profile: 'Roman', status: 'pending' })).count, 1);
    assert.equal((await rpc(env, ctx, 'Roman', 'get_proposals', { profile: 'Roman', status: 'approved' })).count, 0);
    assert.equal((await rpc(env, ctx, 'Roman', 'get_proposals', { profile: 'Scott' })).count, 0);
    // profile falls back to the ?profile= of the MCP URL
    assert.equal((await rpc(env, ctx, 'Roman', 'get_proposals', {})).count, 1);
    // GET /proposals (HTTP, write token)
    const h = await call(env, ctx, '/proposals?profile=Roman', { headers: W });
    assert.equal(h.status, 200);
    const hj = await h.json();
    assert.equal(hj.pendingCount, 1);
    assert.equal(hj.proposals.length, 1);
    assert.deepEqual(hj.proposals[0], p);
    // the protocol itself is untouched: proposals are inert
    const prot = await rpc(env, ctx, 'Roman', 'get_protocol');
    assert.equal(prot.protocols.find((x) => x.name === 'Testosterone Cypionate').dose, '20 mg');
  });

  test('resolves by protocolId; effectiveFrom defaults to today (New York); write token works too; summaries', async () => {
    const a = await rpc(env, ctx, 'Scott', 'propose_change', { profile: 'Scott', protocolId: 'p_bpc', change: { endDate: '2026-10-20' }, rationale: 'Finish the cycle.' }, 'w');
    assert.equal(a.summary, 'Proposed for Scott: BPC-157 ends Oct 20 from Oct 3');
    assert.equal(stored(env, 'Scott')[0].effectiveFrom, TODAY);
    const b = await rpc(env, ctx, 'Roman', 'propose_change', { profile: 'Roman', peptideName: 'HCG', change: { schedule: { every: 2, anchor: '2026-10-04' } }, rationale: 'Space it out.' });
    assert.equal(b.summary, 'Proposed for Roman: HCG every other day from Oct 3');
    const c = await rpc(env, ctx, 'Roman', 'propose_change', { profile: 'Roman', peptideName: 'hcg', change: { doseMcg: 250 }, rationale: 'Halve it.' });
    assert.equal(c.summary, 'Proposed for Roman: HCG 250 IU from Oct 3', 'unit inherited from the protocol when the change has none');
    const d = await rpc(env, ctx, 'Roman', 'propose_change', { profile: 'Roman', peptideName: 'Testosterone Cypionate', change: { note: 'Split into two injections.' }, rationale: 'Smoother levels.' });
    assert.equal(d.summary, 'Proposed for Roman: Testosterone Cypionate (note) from Oct 3');
    const e = await rpc(env, ctx, 'Roman', 'propose_change', { profile: 'Roman', peptideName: 'testosterone-cyp', change: { schedule: { days: [1, 3, 5], timeOfDay: 'evening' } }, rationale: 'MWF.' });
    assert.equal(e.summary, 'Proposed for Roman: Testosterone Cypionate Mon/Wed/Fri from Oct 3', 'peptideId matches too');
    // an archived protocol can still be addressed by id (it is Roman's); days are de-duplicated and sorted
    const f = await rpc(env, ctx, 'Roman', 'propose_change', { profile: 'Roman', protocolId: 'p_old', change: { schedule: { days: [5, 1, 1, 3] } }, rationale: 'Restart.' });
    assert.deepEqual(stored(env, 'Roman').find((p) => p.id === f.id).change.schedule.days, [1, 3, 5]);
    assert.equal(stored(env, 'Roman').length, 5);
    assert.equal(stored(env, 'Roman')[0].id, f.id, 'newest first');
    // profile argument is sanitised like ?profile= (so it lands on a profile that has no protocols)
    await assert.rejects(rpc(env, ctx, 'Roman', 'propose_change', { profile: 'Roman?x', peptideName: 'HCG', change: { doseMcg: 300 }, rationale: 'r' }), /No protocol named "HCG" for Romanx \(known: none\)/);
    assert.ok(!env.PROTOCOL_KV.store.has('proposals:Romanx'));
  });

  test('validation errors, nothing stored', async () => {
    const bad = (args, re, token = 'r') => assert.rejects(rpc(env, ctx, 'Roman', 'propose_change', args, token), re);
    const base = { profile: 'Roman', peptideName: 'HCG', change: { doseMcg: 250 }, rationale: 'r' };
    await bad({ ...base, peptideName: 'Nope' }, /No protocol named "Nope" for Roman \(known: Testosterone Cypionate, HCG, Ipamorelin\)/);
    await bad({ ...base, peptideName: 'BPC-157' }, /No protocol named "BPC-157" for Roman/, 'w'); // Scott's, not Roman's
    await bad({ ...base, peptideName: undefined, protocolId: 'p_zzz' }, /No protocol with id "p_zzz" for Roman/);
    await bad({ ...base, peptideName: undefined }, /protocolId or peptideName is required/);
    await bad({ ...base, profile: undefined }, /profile is required/);
    await bad({ ...base, rationale: '  ' }, /rationale is required/);
    await bad({ ...base, rationale: undefined }, /rationale is required/);
    await bad({ ...base, change: {} }, /at least one of doseMcg, doseUnit, schedule, endDate, note/);
    await bad({ ...base, change: undefined }, /change must be an object/);
    await bad({ ...base, change: 'double it' }, /change must be an object/);
    await bad({ ...base, change: { doseMcg: 0 } }, /doseMcg must be a number > 0/);
    await bad({ ...base, change: { doseMcg: -5 } }, /doseMcg must be a number > 0/);
    await bad({ ...base, change: { doseMcg: 'lots' } }, /doseMcg must be a number > 0/);
    await bad({ ...base, change: { doseUnit: 'ml' } }, /doseUnit must be one of mcg \| mg \| IU \| g/);
    await bad({ ...base, change: { schedule: { days: [1, 7] } } }, /days must be an array of integers 0 \(Sun\) – 6 \(Sat\)/);
    await bad({ ...base, change: { schedule: { days: 'daily' } } }, /days must be an array/);
    await bad({ ...base, change: { schedule: { days: [1.5] } } }, /days must be an array/);
    await bad({ ...base, change: { schedule: {} } }, /schedule is empty/);
    await bad({ ...base, change: { schedule: { every: 0 } } }, /every must be an integer/);
    await bad({ ...base, change: { endDate: 'next week' } }, /endDate must be YYYY-MM-DD/);
    await bad({ ...base, change: { dose: 5 } }, /unknown change field\(s\): dose/);
    await bad({ ...base, effectiveFrom: 'tomorrow' }, /effectiveFrom must be YYYY-MM-DD/);
    await assert.rejects(rpc(env, ctx, 'Roman', 'get_proposals', { profile: 'Roman', status: 'bogus' }), /status must be pending \| approved \| dismissed \| all/);
    assert.ok(!env.PROTOCOL_KV.store.has('proposals:Roman'), 'nothing stored');
    // without a token the MCP call is refused like any other
    const un = await call(env, ctx, '/mcp?profile=Roman', { method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'propose_change', arguments: base } } });
    assert.equal(un.status, 401);
  });

  test('cap at 20, newest first', async () => {
    const ids = [];
    for (let i = 1; i <= 25; i++) {
      freeze(new Date(Date.parse(NOW) + i * 60000).toISOString());
      ids.push((await rpc(env, ctx, 'Roman', 'propose_change', { ...PROPOSE, rationale: `reason ${i}` })).id);
    }
    const list = stored(env, 'Roman');
    assert.equal(list.length, 20);
    assert.equal(list[0].id, ids[24], 'newest first');
    assert.equal(list[19].id, ids[5]);
    assert.deepEqual(list.map((p) => p.rationale), Array.from({ length: 20 }, (_, i) => `reason ${25 - i}`));
    for (const old of ids.slice(0, 5)) assert.ok(!list.some((p) => p.id === old), `${old} dropped`);
    const g = await rpc(env, ctx, 'Roman', 'get_proposals', { profile: 'Roman' });
    assert.equal(g.count, 20);
    assert.equal(g.pendingCount, 20);
    assert.equal((await (await call(env, ctx, '/sync?profile=Roman', { headers: R })).json())._proposalsPending, 20);
  });
});

// =====================================================================================
describe('HTTP inbox: GET /proposals, POST /proposals/<id>', () => {
  let env, ctx, id1, id2;
  beforeEach(async () => {
    freeze(NOW); env = mkEnv(); ctx = fakeCtx(); await seedAll(env);
    id1 = (await rpc(env, ctx, 'Roman', 'propose_change', PROPOSE)).id;
    freeze('2026-10-03T14:01:00Z');
    id2 = (await rpc(env, ctx, 'Roman', 'propose_change', { profile: 'Roman', peptideName: 'HCG', change: { doseMcg: 250 }, rationale: 'Halve it.' })).id;
  });

  test('approve and dismiss update status/resolvedAt/resolution; listing puts pending first', async () => {
    freeze('2026-10-03T15:00:00Z');
    const ap = await call(env, ctx, `/proposals/${id1}`, { method: 'POST', headers: W, body: { status: 'approved', note: 'applied in the app' } });
    assert.equal(ap.status, 200);
    const aj = await ap.json();
    assert.equal(aj.ok, true);
    assert.equal(aj.proposal.id, id1);
    assert.equal(aj.proposal.status, 'approved');
    assert.equal(aj.proposal.resolvedAt, '2026-10-03T15:00:00.000Z');
    assert.equal(aj.proposal.resolution, 'applied in the app');
    assert.equal(aj.proposal.resolvedBy, 'app');
    assert.equal(aj.proposal.createdAt, new Date(NOW).toISOString(), 'everything else kept');
    const di = await (await call(env, ctx, `/proposals/${id2}`, { method: 'POST', headers: W, body: { status: 'dismissed' } })).json();
    assert.equal(di.proposal.status, 'dismissed');
    assert.equal(di.proposal.resolution, null);
    // stored
    const list = stored(env, 'Roman');
    assert.deepEqual(list.map((p) => [p.id, p.status]), [[id2, 'dismissed'], [id1, 'approved']]);
    // listing: pending first, then newest first; status filter
    freeze('2026-10-03T15:05:00Z');
    const id3 = (await rpc(env, ctx, 'Roman', 'propose_change', { profile: 'Roman', peptideName: 'HCG', change: { note: 'n' }, rationale: 'r' })).id;
    const all = await (await call(env, ctx, '/proposals?profile=Roman', { headers: W })).json();
    assert.equal(all.pendingCount, 1);
    assert.deepEqual(all.proposals.map((p) => p.id), [id3, id2, id1]);
    const pend = await (await call(env, ctx, '/proposals?profile=Roman&status=pending', { headers: W })).json();
    assert.deepEqual(pend.proposals.map((p) => p.id), [id3]);
    const appr = await (await call(env, ctx, '/proposals?profile=Roman&status=approved', { headers: W })).json();
    assert.deepEqual(appr.proposals.map((p) => p.id), [id1]);
    assert.equal((await rpc(env, ctx, 'Roman', 'get_proposals', { profile: 'Roman', status: 'dismissed' })).proposals[0].id, id2);
    assert.deepEqual((await rpc(env, ctx, 'Roman', 'get_proposals', { profile: 'Roman' })).proposals.map((p) => p.id), [id3, id2, id1]);
    // ?profile=all spans profiles
    await rpc(env, ctx, 'Scott', 'propose_change', { profile: 'Scott', protocolId: 'p_bpc', change: { endDate: '2026-10-20' }, rationale: 'r' });
    const span = await (await call(env, ctx, '/proposals?profile=all', { headers: W })).json();
    assert.equal(span.proposals.length, 4);
    assert.equal(span.pendingCount, 2);
    assert.deepEqual(span.proposals.slice(0, 2).map((p) => p.status), ['pending', 'pending']);
    assert.equal((await rpc(env, ctx, 'Roman', 'get_proposals', { profile: 'all', status: 'pending' })).count, 2);
    // a resolved proposal can be re-resolved (idempotent, last decision wins)
    const re = await (await call(env, ctx, `/proposals/${id2}`, { method: 'POST', headers: W, body: { status: 'approved' } })).json();
    assert.equal(re.proposal.status, 'approved');
  });

  test('errors: unknown id 404, bad status/body 400, GET on an id 405, write token required, no token 401', async () => {
    assert.equal((await call(env, ctx, '/proposals/pr_000000000000', { method: 'POST', headers: W, body: { status: 'approved' } })).status, 404);
    assert.equal((await call(env, ctx, '/proposals/evil%20id', { method: 'POST', headers: W, body: { status: 'approved' } })).status, 404);
    const bs = await call(env, ctx, `/proposals/${id1}`, { method: 'POST', headers: W, body: { status: 'pending' } });
    assert.equal(bs.status, 400);
    assert.match((await bs.json()).error, /status must be approved or dismissed/);
    assert.equal((await call(env, ctx, `/proposals/${id1}`, { method: 'POST', headers: W, body: { status: 'approved', note: 5 } })).status, 400);
    assert.equal((await call(env, ctx, `/proposals/${id1}`, { method: 'POST', headers: W, body: '{oops' })).status, 400);
    assert.equal((await call(env, ctx, `/proposals/${id1}`, { method: 'GET', headers: W })).status, 405);
    assert.equal((await call(env, ctx, '/proposals?profile=Roman', { method: 'POST', headers: W, body: {} })).status, 405);
    assert.equal((await call(env, ctx, '/proposals?profile=Roman&status=bogus', { headers: W })).status, 400);
    // read token: HTTP inbox refused (403) — the MCP tools remain open to it
    assert.equal((await call(env, ctx, '/proposals?profile=Roman', { headers: R })).status, 403);
    assert.equal((await call(env, ctx, `/proposals/${id1}`, { method: 'POST', headers: R, body: { status: 'approved' } })).status, 403);
    assert.equal((await call(env, ctx, '/proposals?profile=Roman')).status, 401);
    assert.equal(stored(env, 'Roman').find((p) => p.id === id1).status, 'pending', 'untouched');
    assert.equal((await call(env, ctx, '/proposals?profile=Roman', { headers: W })).headers.get('Cache-Control'), 'no-store');
  });
});

// =====================================================================================
describe('_proposalsPending on GET /sync', () => {
  let env, ctx;
  beforeEach(async () => { freeze(NOW); env = mkEnv(); ctx = fakeCtx(); });

  test('counts pending across all profiles for ?profile=all, per profile otherwise; empty KV reports 0', async () => {
    const empty = await (await call(env, ctx, '/sync?profile=all', { headers: W })).json();
    assert.equal(empty._empty, true);
    assert.equal(empty._proposalsPending, 0);
    await seedAll(env);
    const blob = seedBlob();
    await env.PROTOCOL_KV.put('protocol:Roman', JSON.stringify({ ...blob, protocols: blob.protocols.filter((p) => p.profile === 'Roman'), _rev: 5, _syncedAt: TS, profile: 'Roman' }));
    const none = await call(env, ctx, '/sync?profile=all', { headers: W });
    assert.equal((await none.json())._proposalsPending, 0);
    const r1 = await rpc(env, ctx, 'Roman', 'propose_change', PROPOSE);
    await rpc(env, ctx, 'Roman', 'propose_change', { profile: 'Roman', peptideName: 'HCG', change: { doseMcg: 250 }, rationale: 'r' });
    await rpc(env, ctx, 'Scott', 'propose_change', { profile: 'Scott', protocolId: 'p_bpc', change: { endDate: '2026-10-20' }, rationale: 'r' });
    const all = await call(env, ctx, '/sync?profile=all', { headers: W });
    assert.equal(all.status, 200);
    assert.equal(all.headers.get('ETag'), '"3"');
    assert.equal(all.headers.get('Content-Type'), 'application/json');
    assert.equal(all.headers.get('Cache-Control'), 'no-store');
    const aj = await all.json();
    assert.equal(aj._proposalsPending, 3);
    assert.equal(aj._rev, 3);
    assert.equal(aj.profile, 'all');
    assert.equal(aj.protocols.length, 4, 'the record itself is intact');
    assert.deepEqual(aj.meta, seedBlob().meta);
    const roman = await (await call(env, ctx, '/sync?profile=Roman', { headers: R })).json();
    assert.equal(roman._proposalsPending, 2, 'read token sees the count too');
    assert.equal(roman._rev, 5);
    assert.equal((await (await call(env, ctx, '/sync?profile=Scott', { headers: W })).json())._proposalsPending, 1, 'per-profile count even when that key is empty');
    assert.equal((await (await call(env, ctx, '/sync?profile=Jamal', { headers: W })).json())._proposalsPending, 0);
    // resolving one lowers the count
    await call(env, ctx, `/proposals/${r1.id}`, { method: 'POST', headers: W, body: { status: 'approved' } });
    assert.equal((await (await call(env, ctx, '/sync?profile=all', { headers: W })).json())._proposalsPending, 2);
    assert.equal((await (await call(env, ctx, '/sync?profile=Roman', { headers: W })).json())._proposalsPending, 1);
    // the prev copy and snapshots are unaffected paths
    assert.equal((await call(env, ctx, '/sync?profile=all&snapshots=1', { headers: W })).status, 200);
  });

  test('a client that echoes _proposalsPending back on POST does not get it stored', async () => {
    const r = await call(env, ctx, '/sync?profile=all', { method: 'POST', headers: W, body: { ...seedBlob(), _proposalsPending: 99 } });
    assert.equal(r.status, 200);
    const raw = JSON.parse(env.PROTOCOL_KV.store.get('protocol:all').value);
    assert.ok(!('_proposalsPending' in raw), 'not persisted');
    assert.equal(raw._rev, 1);
    const g = await (await call(env, ctx, '/sync?profile=all', { headers: W })).json();
    assert.equal(g._proposalsPending, 0, 'the live count, not the echoed one');
    assert.equal(g._rev, 1);
  });
});
