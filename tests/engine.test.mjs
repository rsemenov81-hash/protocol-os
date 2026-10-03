// Schedule-engine unit tests. The engine is extracted from src/app/main.jsx at test time (see
// tests/helpers/engine.mjs), so these run against whatever is in the source right now, no build needed.
//
// One `test()` per assertion, named as in the original harness: the summary should read `# tests 65`.
// TODAY is pinned, every date below is explicit, and nothing here depends on the wall clock.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine } from './helpers/engine.mjs';

const m = loadEngine();
const TODAY = '2026-10-02';
const eq = (actual, expected, name) => test(name, () => assert.deepEqual(actual, expected));

// Shared fixtures (built once; every function under test is pure).
const eod = { schedule: { every: 2, anchor: '2026-10-02', days: [0, 1, 2, 3, 4, 5, 6] } };
const base = { id: 't', profile: 'Roman', schedule: { days: [2, 4, 6], timeOfDay: 'morning' }, doseMcg: 20000, doseUnit: null, doseValue: null, startDate: '2026-05-29', active: true };
// Dated revision in the past: daily 20 mg from Aug 22.
const rev = m.applyRevision(base, '2026-08-22', { schedule: { days: [0, 1, 2, 3, 4, 5, 6], timeOfDay: 'morning' }, doseMcg: 20000, doseUnit: 'mg', doseValue: 20 }, TODAY);
// Dated revision in the future: MWF evenings 25 mg from Oct 6.
const fut = m.applyRevision(base, '2026-10-06', { schedule: { days: [1, 3, 5], timeOfDay: 'evening' }, doseMcg: 25000, doseUnit: 'mg', doseValue: 25 }, TODAY);

describe('date keys', () => {
  eq(m.dkAdd('2026-08-31', 1), '2026-09-01', 'dkAdd month roll');
  eq(m.dkAdd('2026-03-08', 1), '2026-03-09', 'dkAdd across DST');
  eq(m.dkDiff('2026-09-28', '2026-08-22'), 37, 'dkDiff');
  eq(m.dkDow('2026-10-02'), 5, 'dow Fri');
});

describe('schedules: due, labels, frequency, normalization', () => {
  eq([m.dueOn(eod, '2026-10-02'), m.dueOn(eod, '2026-10-03'), m.dueOn(eod, '2026-10-04'), m.dueOn(eod, '2026-09-30'), m.dueOn(eod, '2026-09-29')], [true, false, true, true, false], 'EOD due pattern incl. before anchor');
  eq(m.dueOn({ schedule: { every: 3, anchor: '2026-10-01' } }, '2026-10-07'), true, 'q3d');
  eq(m.schedLabel(eod.schedule), 'Every other day', 'label eod');
  eq(m.schedLabel(eod.schedule, true), 'EOD', 'label eod short');
  eq(m.schedLabel({ days: [1, 2, 3, 4, 5] }), 'Weekdays', 'label wkdys');
  eq(m.schedLabel({ days: [2, 4, 6] }, true), 'TTS', 'label letters');
  eq(m.freqPerWeek(eod.schedule), 3.5, 'freq eod');
  eq(m.freqPerWeek({ days: [] }), null, 'freq prn');
  eq(m.isPrnSched({ days: [] }), true, 'prn');
  eq(m.isPrnSched({ days: [], every: 2 }), false, 'interval not prn');
  eq(m.normSched({ days: [3, 1], every: '2', anchor: '2026-10-05' }).every, 2, 'normSched coerces every');
  eq(m.normSched({ days: [3, 1] }).days, [1, 3], 'normSched sorts days');
});

describe('timeline: dated revisions', () => {
  eq(rev.timeline.length, 2, 'revision creates baseline + entry');
  eq(rev.timeline[0].from, null, 'baseline first');
  eq(rev.timeline[0].schedule.days, [2, 4, 6], 'baseline snapshot');
  eq(rev.schedule.days, [0, 1, 2, 3, 4, 5, 6], 'materialized base = today effective');
  eq(rev.doseUnit, 'mg', 'materialized unit');
  eq(m.protoAt(rev, '2026-08-21').schedule.days, [2, 4, 6], 'before effective -> baseline');
  eq(m.protoAt(rev, '2026-08-22').schedule.days, [0, 1, 2, 3, 4, 5, 6], 'on effective date -> new');
  eq(m.dueOn(m.protoAt(rev, '2026-08-21'), '2026-08-21'), false, 'Fri Aug 21 not due on Tue/Thu/Sat');
  eq(m.dueOn(m.protoAt(rev, '2026-08-22'), '2026-08-22'), true, 'Sat Aug 22 due (daily)');

  // future revision: base stays old until the day comes
  eq(fut.schedule.days, [2, 4, 6], 'future revision does not change base today');
  eq(m.nextRevision(fut, TODAY).from, '2026-10-06', 'nextRevision');
  eq(m.materializeProto(fut, '2026-10-06').schedule.days, [1, 3, 5], 'materialize on the day flips base');
  eq(m.materializeProto(fut, '2026-10-06').doseMcg, 25000, 'materialize dose');
  eq(m.materializeProto(fut, TODAY) === fut, true, 'materialize is identity when nothing changes');

  // replace an entry on the same date, keep others
  const two = m.applyRevision(fut, '2026-10-06', { schedule: { days: [0], timeOfDay: 'morning' }, doseMcg: 1000, doseUnit: null, doseValue: null }, TODAY);
  eq(two.timeline.length, 2, 'same-date revision replaces');
  eq(m.removeRevision(two, two.timeline[1].id, TODAY).timeline, undefined, 'removing last dated entry drops timeline');
  eq(m.removeRevision(two, two.timeline[1].id, TODAY).schedule.days, [2, 4, 6], '…and restores baseline fields');
});

describe('interval schedules mirror legacy days', () => {
  // legacy days mirror the next 7 days from today (Fri Oct 2 anchor -> Fri,Sun,Tue,Thu)
  const eodP = { id: 'e', schedule: { every: 2, anchor: '2026-10-02', days: [0, 1, 2, 3, 4, 5, 6], timeOfDay: 'morning' }, doseMcg: 100000 };
  const eodM = m.materializeProto(eodP, TODAY);
  eq(eodM.schedule.days, [0, 2, 4, 5], 'EOD mirrors due weekdays of today..+6 into legacy days');
  eq(m.materializeProto(eodM, TODAY) === eodM, true, 'EOD materialize stable');
  eq(m.materializeProto(eodM, '2026-10-03').schedule.days, [0, 2, 4], '…and shifts with the window (Sat Oct 3..Fri Oct 9 holds Sun/Tue/Thu)');
});

describe('range, finish and resume', () => {
  const fin = m.finishProto(fut, '2026-09-30', TODAY);
  eq(fin.endDate, '2026-09-30', 'finish sets endDate');
  eq(fin.active, false, 'finished in the past -> inactive for legacy readers');
  eq(fin.timeline, undefined, 'future revision after end dropped (and timeline collapsed)');
  eq([m.activeOn(fin, '2026-09-30'), m.activeOn(fin, '2026-10-01'), m.activeOn(fin, '2026-05-28'), m.activeOn(fin, '2026-06-01')], [true, false, false, true], 'activeOn range');
  eq(m.activeOn({ active: false }, '2026-10-01'), false, 'archived without endDate hidden');
  const res = m.resumeProto(fin, TODAY);
  eq([res.endDate, res.active], [undefined, true], 'resume');
  const finToday = m.finishProto(base, TODAY, TODAY);
  eq(finToday.active, true, 'finish today keeps active until tomorrow');
  eq(m.materializeProto(finToday, '2026-10-03').active, false, '…flips next day');
});

describe('back-dated entries', () => {
  const logs0 = [
    { id: 'x', protocolId: 't', datetime: '2026-08-25T07:00', doseMcg: 20000 },
    { id: 's', protocolId: 't', datetime: '2026-08-27T08:00', doseMcg: 0, skipped: true },
  ];
  const bf = m.buildBackfillLogs(rev, '2026-08-22', '2026-08-28', { idPrefix: 'bf_', doseMcg: 20000, doseUnit: 'mg', mcgPerMl: 200000, time: '07:00' }, logs0);
  eq(bf.map((l) => l.datetime.slice(0, 10)), ['2026-08-22', '2026-08-23', '2026-08-24', '2026-08-26', '2026-08-28'], 'backfill skips logged + skipped days');
  eq([bf[0].id, bf[0].doseMl, bf[0].doseUnit, bf[0].doseValue, bf[0].backfilled], ['bf_2026-08-22', 0.1, 'mg', 20, true], 'backfill log shape');
  const bfSched = m.buildBackfillLogs(base, '2026-08-17', '2026-08-23', { idPrefix: 'q_' }, []);
  eq(bfSched.map((l) => l.datetime.slice(0, 10)), ['2026-08-18', '2026-08-20', '2026-08-22'], 'onlyScheduled respects Tue/Thu/Sat');
  eq(m.buildBackfillLogs(base, '2026-08-17', '2026-08-19', { onlyScheduled: false }, []).length, 3, 'every-day mode');
});

describe('migration m1 (Roman: daily testosterone + Anavar cycle) against a live-shaped blob', () => {
  const live = {
    protocols: [
      { id: 'p_live_t', profile: 'Roman', peptideId: 'testosterone', peptideName: 'Testosterone Cyp (20mg / 10u)', doseMcg: 20000, schedule: { days: [2, 4, 6], timeOfDay: 'morning' }, cycleDays: 365, startDate: '2026-05-29', active: true },
      { id: 'other', profile: 'Roman', peptideId: 'hcg', peptideName: 'HCG', doseMcg: 500, schedule: { days: [2, 6], timeOfDay: 'morning' }, active: true },
    ],
    logs: [
      { id: 'l1', protocolId: 'p_live_t', peptideId: 'testosterone', peptide: 'Testosterone Cyp (20mg / 10u)', profile: 'Roman', datetime: '2026-10-01T07:06', doseMcg: 20000, doseMl: 0.1 },
      { id: 'l2', protocolId: 'p_live_t', peptideId: 'testosterone', profile: 'Roman', datetime: '2026-09-24T07:00', doseMcg: 20000 },
    ],
    vials: [{ id: 'v1', peptideId: 'testosterone', active: true, mcgPerMl: 200000 }],
    meta: {},
  };
  const r1 = m.runMigrations(live, 'Roman', TODAY);
  eq(r1.changed, true, 'm1 ran');
  eq(r1.meta.migrations.length, 1, 'marker written');
  const t = r1.protocols.find((p) => p.id === 'p_live_t');
  eq(t.timeline.length, 2, 'testosterone timeline');
  eq(t.timeline[1].from, '2026-08-22', 'daily from Aug 22');
  const tm = m.materializeProto(t, TODAY);
  eq([tm.schedule.days, tm.doseUnit, tm.doseValue], [[0, 1, 2, 3, 4, 5, 6], 'mg', 20], 'materialized daily 20 mg');
  const tLogs = r1.logs.filter((l) => l.protocolId === 'p_live_t');
  const days = m.dkDiff('2026-10-01', '2026-08-22') + 1;
  eq(tLogs.length, days, 'testosterone has one entry per day Aug 22..Oct 1 (today untouched)');
  eq(tLogs.filter((l) => l.backfilled).length, days - 2, '…of which all but the 2 real ones are back-filled');
  eq(tLogs.find((l) => l.id === 'bf_m1_test_2026-08-22').vialId, 'v1', 'backfill uses the live vial');
  eq(r1.logs.some((l) => l.datetime.startsWith('2026-10-02') && l.protocolId === 'p_live_t'), false, 'today not auto-logged');
  const an = r1.protocols.find((p) => p.id === 'p_m1_anavar');
  eq([an.active, an.endDate, an.startDate, an.route], [false, '2026-09-28', '2026-08-22', 'oral'], 'anavar protocol');
  eq(r1.logs.filter((l) => l.protocolId === 'p_m1_anavar').length, 38, '38 anavar days');
  eq(m.activeOn(an, '2026-09-10'), true, 'anavar visible in range');
  eq(m.activeOn(an, '2026-09-29'), false, 'anavar hidden after end');
  const r2 = m.runMigrations({ ...r1, vials: live.vials }, 'Roman', TODAY);
  eq(r2.changed, false, 'second run is a no-op (marker)');
  const r3 = m.runMigrations({ ...r1, vials: live.vials, meta: {} }, 'Roman', TODAY);
  eq(r3.logs.length, r1.logs.length, 're-run without marker adds nothing (deterministic ids)');
  eq(r3.protocols.find((p) => p.id === 'p_live_t').timeline.length, 2, 're-run does not duplicate timeline entry');
  eq(m.runMigrations(live, 'Scott', TODAY).changed, false, 'does not run for other profiles');
});
