// SyncCore unit tests — the pure merge/prepare rules behind cloud sync, loaded from the app source
// between the SYNC-CORE-BEGIN/END markers (no bundler, no browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/app/main.jsx'), 'utf8');
const m = src.match(/SYNC-CORE-BEGIN[^\n]*\n([\s\S]*?)\/\/ ===== SYNC-CORE-END/);
assert.ok(m, 'SYNC-CORE markers missing from src/app/main.jsx');
const { SyncCore } = new Function(m[1] + '\nreturn { SyncCore };')();

const T0 = '2026-10-03T08:00:00.000Z', T1 = '2026-10-03T09:00:00.000Z', T2 = '2026-10-03T10:00:00.000Z';
const log = (id, extra = {}) => ({ id, protocolId: 'p1', profile: 'Roman', datetime: '2026-10-03T07:00', doseMcg: 2000, ...extra });
const state = (logs, meta = {}) => ({ protocols: [], vials: [], logs, meta });

test('first prepare stamps every unstamped row and leaves stamped rows alone', () => {
  const out = SyncCore.prepare(state([log('a'), log('b', { updatedAt: T0 })]), null, T1);
  assert.equal(out.changed, true);
  assert.equal(out.logs.find(l => l.id === 'a').updatedAt, T1);
  assert.equal(out.logs.find(l => l.id === 'b').updatedAt, T0);
  assert.deepEqual(out.meta.tombstones, { protocols: {}, vials: {}, logs: {} });
});

test('a legacy row that entered the snapshot unstamped is stamped once, then left alone', () => {
  const legacy = state([log('a')]);
  const base = SyncCore.snapshot(legacy);            // e.g. rows added by a migration after the pull
  const out = SyncCore.prepare(legacy, base, T1);
  assert.equal(out.logs[0].updatedAt, T1);
  const again = SyncCore.prepare(out, SyncCore.snapshot(out), T2);
  assert.equal(again.changed, false);
});

test('prepare is idempotent against its own snapshot', () => {
  const s = state([log('a')]);
  const out = SyncCore.prepare(s, null, T1);
  const base = SyncCore.snapshot(out);
  const again = SyncCore.prepare(out, base, T2);
  assert.equal(again.changed, false);
  assert.equal(again.logs, out.logs, 'same array when nothing changed');
});

test('an edit since the last sync gets a fresh stamp; untouched rows keep theirs', () => {
  const synced = SyncCore.prepare(state([log('a'), log('b')]), null, T0);
  const base = SyncCore.snapshot(synced);
  const edited = state(synced.logs.map(l => l.id === 'a' ? { ...l, doseMcg: 2500 } : l), synced.meta);
  const out = SyncCore.prepare(edited, base, T1);
  assert.equal(out.logs.find(l => l.id === 'a').updatedAt, T1);
  assert.equal(out.logs.find(l => l.id === 'b').updatedAt, T0);
});

test('a row that disappears after a sync leaves a dated delete marker', () => {
  const synced = SyncCore.prepare(state([log('a'), log('b')]), null, T0);
  const base = SyncCore.snapshot(synced);
  const out = SyncCore.prepare(state(synced.logs.filter(l => l.id !== 'a'), synced.meta), base, T1);
  assert.equal(out.changed, true);
  assert.equal(out.meta.tombstones.logs.a, T1);
  assert.equal(out.meta.tombstones.logs.b, undefined);
});

test('the P0: an undone dose does not come back from a stale cloud copy', () => {
  // device pushes a and b, undoes a, then merges against the cloud copy that still has a
  const synced = SyncCore.prepare(state([log('a'), log('b')]), null, T0);
  const cloud = { ...synced };                                   // what the cloud holds after the push
  const base = SyncCore.snapshot(synced);
  const local = SyncCore.prepare(state(synced.logs.filter(l => l.id !== 'a'), synced.meta), base, T1);
  const merged = SyncCore.merge(local, cloud);
  assert.deepEqual(merged.logs.map(l => l.id), ['b']);
  assert.equal(merged.meta.tombstones.logs.a, T1, 'marker survives the merge');
});

test('a row re-created after its deletion wins over the marker', () => {
  const local = state([log('a', { updatedAt: T2 })], { tombstones: { logs: { a: T1 }, protocols: {}, vials: {} } });
  const remote = state([], { tombstones: { logs: { a: T1 }, protocols: {}, vials: {} } });
  const merged = SyncCore.merge(local, remote);
  assert.deepEqual(merged.logs.map(l => l.id), ['a']);
  // and prepare drops the stale marker once the row is back
  const prepared = SyncCore.prepare(local, null, T2);
  assert.equal(prepared.meta.tombstones.logs.a, undefined);
});

test('newest copy wins per id; ties and unstamped rows stay local; remote-only rows are added', () => {
  const local = state([log('a', { doseMcg: 1, updatedAt: T0 }), log('b', { doseMcg: 1, updatedAt: T1 }), log('c', { doseMcg: 1 })]);
  const remote = state([log('a', { doseMcg: 2, updatedAt: T1 }), log('b', { doseMcg: 2, updatedAt: T0 }), log('c', { doseMcg: 2 }), log('d', { updatedAt: T0 })]);
  const merged = SyncCore.merge(local, remote);
  const by = Object.fromEntries(merged.logs.map(l => [l.id, l]));
  assert.equal(by.a.doseMcg, 2, 'remote newer');
  assert.equal(by.b.doseMcg, 1, 'local newer');
  assert.equal(by.c.doseMcg, 1, 'unstamped: local');
  assert.ok(by.d, 'remote-only row added');
  assert.deepEqual(merged.logs.map(l => l.id), ['a', 'b', 'c', 'd'], 'local order kept, remote-only appended');
});

test('meta: migration markers are unioned, other keys local-first, tombstones merged newest', () => {
  const local = state([], { migrations: ['m1'], note: 'L', tombstones: { logs: { x: T0 }, protocols: {}, vials: {} } });
  const remote = state([], { migrations: ['m0', 'm1'], note: 'R', other: 1, tombstones: { logs: { x: T1, y: T0 }, protocols: {}, vials: {} } });
  const merged = SyncCore.merge(local, remote);
  assert.deepEqual(merged.meta.migrations.sort(), ['m0', 'm1']);
  assert.equal(merged.meta.note, 'L');
  assert.equal(merged.meta.other, 1);
  assert.deepEqual(merged.meta.tombstones.logs, { x: T1, y: T0 });
});

test('delete markers older than 90 days are pruned', () => {
  const old = '2026-06-01T00:00:00.000Z';
  const out = SyncCore.prepare(state([], { tombstones: { logs: { gone: old, fresh: T0 }, protocols: {}, vials: {} } }), null, T1);
  assert.deepEqual(out.meta.tombstones.logs, { fresh: T0 });
});

test('protocols and vials follow the same rules as logs', () => {
  const local = { protocols: [{ id: 'p', doseMcg: 1, updatedAt: T0 }], vials: [{ id: 'v', remainingMcg: 5, updatedAt: T1 }], logs: [], meta: {} };
  const remote = { protocols: [{ id: 'p', doseMcg: 2, updatedAt: T1 }], vials: [{ id: 'v', remainingMcg: 9, updatedAt: T0 }], logs: [], meta: {} };
  const merged = SyncCore.merge(local, remote);
  assert.equal(merged.protocols[0].doseMcg, 2);
  assert.equal(merged.vials[0].remainingMcg, 5);
});

test('validateImport refuses junk, previews counts, skips malformed rows', () => {
  assert.equal(SyncCore.validateImport(null).ok, false);
  assert.equal(SyncCore.validateImport([]).ok, false);
  assert.equal(SyncCore.validateImport({ hello: 1 }).ok, false);
  assert.equal(SyncCore.validateImport({ _format: 'protocol-os-export/v1', protocols: [] }).ok, false, 'nothing usable');
  const r = SyncCore.validateImport({ _format: 'protocol-os-export/v1', protocols: [{ id: 'p', peptideId: 'x', schedule: {} }, { id: 'bad' }], logs: [null, 5, log('a')], vials: [{ id: 'v' }] });
  assert.equal(r.ok, true);
  assert.equal(r.protocols.length, 1);
  assert.equal(r.logs.length, 1);
  assert.equal(r.vials.length, 1);
  assert.equal(r.skipped, 3);
  const noMarker = SyncCore.validateImport({ protocols: [{ id: 'p', peptideName: 'X', timeline: [] }] });
  assert.equal(noMarker.ok, true, 'arrays without a marker are accepted');
});

test('upsert replaces by id and keeps everything else', () => {
  const out = SyncCore.upsert([log('a', { doseMcg: 1 }), log('b')], [log('a', { doseMcg: 9 }), log('c')]);
  assert.deepEqual(out.map(l => l.id + ':' + l.doseMcg), ['a:9', 'b:2000', 'c:2000']);
});
