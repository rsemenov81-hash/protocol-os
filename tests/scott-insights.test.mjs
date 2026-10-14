import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { activityRows, exportCSV, nextStack } from '../scott/insights.js';

const fixture = () => ({
  token: 'PRIVATE_TOKEN_MUST_NOT_LEAK',
  stacks: [{ id: 'am', name: 'Morning stack', time: '10:00' }, { id: 'pm', name: 'Night stack', time: '21:30' }],
  compounds: [
    { id: 'a', name: 'Example injection', doseMcg: 75000, schedule: {days: [5, 1, 1]}, category: 'Hormone', token: 'SECRET_FIELD' },
    { id: 'b', name: 'Example IU compound', doseMcg: 500, unit: 'IU' },
    { id: 'c', name: 'Example tablet', kind: 'med', dose: '1 tablet' },
    { id: 'd', name: 'Example supplement', kind: 'supp', stack: 'am', serving: '2 capsules', ingredients: [{name: 'Ingredient', amount: '200 mg'}] },
  ],
  logs: [
    { id: 'l1', compoundId: 'a', datetime: '2026-10-01T08:00', doseMcg: 75000, units: 30, by: 'member' },
    { id: 'l3', compoundId: 'c', datetime: '2026-10-03T09:30', doseMcg: null, units: null, by: 'admin' },
    { id: 'l2', compoundId: 'b', datetime: '2026-10-02T09:00', doseMcg: 500, units: 10, by: 'member' },
  ],
  labs: [{ date: '2026-06-01', markers: [{name: 'Bounded result', value: '<0.7', unit: 'mIU/mL', lo: 1, hi: 10, flag: 'L', reference: '1–10', note: 'Original wording'}], sources: [{name: 'Original report.pdf', url:'https://secret.invalid/?token=SECRET_URL'}] }],
  scans: [
    {id:'s1', date:'2026-06-01', measuredAt:'2026-06-01T08:00', metrics:[{name:'Weight (lb)',value:'150.2'},{name:'Body fat (%)',value:'15'}], source:{name:'Source.csv', accessCode:'PRIVATE_CODE'}},
    {id:'s2', date:'2026-06-01', measuredAt:'2026-06-01T19:00', weightLb:151, pbfPct:0, tbwLb:null},
  ],
});

test('activity shows only recorded entries and retains actual recorded dose instead of current plan', () => {
  const data = fixture(); data.compounds[0].doseMcg = 100000;
  const rows = activityRows(data);
  assert.deepEqual(rows.map(r => r.id), ['l3','l2','l1']);
  assert.equal(rows[2].doseText, '75 mg');
  assert.equal(rows[1].doseText, '500 IU');
  assert.equal(rows[0].doseText, 'Taken');
  assert.equal(rows.length, data.logs.length);
  assert.equal(rows.some(r => r.kind === 'stack'), false);
});

test('history date filters are inclusive and query searches names, dates and recorded amounts', () => {
  const data = fixture();
  assert.deepEqual(activityRows(data,{from:'2026-10-01',to:'2026-10-02'}).map(r=>r.id), ['l2','l1']);
  assert.deepEqual(activityRows(data,{query:'EXAMPLE 500 iu'}).map(r=>r.id), ['l2']);
  assert.deepEqual(activityRows(data,{query:'2026-10-03 admin'}).map(r=>r.id), ['l3']);
  assert.deepEqual(activityRows(data,{query:'does not exist'}), []);
});

test('invalid and reversed date ranges do not silently return unfiltered private history', () => {
  for (const options of [{from:'2026-02-30'}, {to:'yesterday'}, {from:'2026-10-04',to:'2026-10-01'}]) assert.deepEqual(activityRows(fixture(),options),[]);
});

test('removed items and unparseable timestamps remain in unfiltered history without invented units', () => {
  const data=fixture();
  data.logs.push({id:'gone', compoundId:'missing', datetime:'invalid date', doseMcg:'<5', units:0});
  const row=activityRows(data).at(-1);
  assert.equal(row.id,'gone'); assert.equal(row.recordedDose,'<5'); assert.equal(row.recordedUnit,'');
  assert.equal(row.name,'Item no longer available');
  assert.equal(activityRows(data,{from:'2026-01-01'}).some(r=>r.id==='gone'),false);
});

test('history handles same-day distinct timestamps and does not mutate the input', () => {
  const data=fixture();
  data.logs.push({id:'l4',compoundId:'a',datetime:'2026-10-03T10:00',doseMcg:1250});
  const before=JSON.stringify(data);
  assert.deepEqual(activityRows(data,{from:'2026-10-03',to:'2026-10-03'}).map(r=>r.id),['l4','l3']);
  assert.equal(JSON.stringify(data),before);
  assert.equal(activityRows(data)[0].doseText,'1.25 mg');
});

test('protocol export retains stack grouping, directions, unique scheduled days and dose units', () => {
  const out=exportCSV(fixture(),'protocol');
  assert.match(out,/"75000","mcg"/); assert.match(out,/"500","IU"/);
  assert.match(out,/Mon, Fri/); assert.match(out,/Morning stack/); assert.match(out,/Daily at 10:00 · one stack reminder/);
  assert.match(out,/Ingredient: 200 mg/); assert.match(out,/2 capsules/);
});

test('CSV export uses an explicit allowlist and excludes auth fields and document URLs', () => {
  for(const type of ['protocol','history','labs','scans']) {
    const out=exportCSV(fixture(),type);
    assert.doesNotMatch(out,/PRIVATE_TOKEN|SECRET_FIELD|SECRET_URL|PRIVATE_CODE|https:\/\//);
  }
});

test('CSV quotes delimiters, newlines and quotes and defuses string formula prefixes', () => {
  for(const prefix of ['=1+1','+SUM(A1:A2)','-cmd','@SUM(1)',' \t=1','\r\n+1']) {
    const data={compounds:[{name:prefix,serving:'two, "quoted"\nlines'}]};
    const out=exportCSV(data,'protocol');
    assert.ok(out.includes('"\''+prefix+'"'));
    assert.ok(out.includes('"two, ""quoted""\nlines"'));
  }
  const out=exportCSV({labs:[{date:'2026-01-01',markers:[{name:'Numeric result',value:-2.5,lo:0}]}]},'labs');
  assert.match(out,/"-2.5"/); assert.doesNotMatch(out,/"'-2.5"/);
});

test('labs export preserves bounded and textual results, source references and zero values', () => {
  const data=fixture(); data.labs[0].markers.push({name:'Text result',value:'Not detected',unit:''},{name:'Zero',value:0,lo:0,hi:1});
  const out=exportCSV(data,'labs');
  assert.match(out,/"<0.7","mIU\/mL","1–10","1","10","L","Original wording","Original report.pdf"/);
  assert.match(out,/"Not detected"/); assert.match(out,/"Zero","0"/);
});

test('scan export preserves imported metric names and same-day times and skips missing manual values', () => {
  const out=exportCSV(fixture(),'scans');
  assert.match(out,/"s1","2026-06-01","2026-06-01T08:00","Weight \(lb\)","150.2","lb"/);
  assert.match(out,/"s2","2026-06-01","2026-06-01T19:00","Weight","151","lb"/);
  assert.match(out,/"Body fat","0","%"/); assert.doesNotMatch(out,/Total body water/);
  assert.equal(out.split('\r\n').filter(Boolean).length,5);
});

test('empty datasets export headers and unsupported types fail clearly', () => {
  for(const type of ['protocol','history','labs','scans']) assert.equal(exportCSV({},type).split('\r\n').filter(Boolean).length,1);
  assert.throws(()=>exportCSV({},'secret'),RangeError);
  assert.deepEqual(activityRows({}),[]);
});

test('next stack chooses the next local scheduled time, including exact time', () => {
  const stacks=fixture().stacks;
  assert.equal(nextStack(stacks,new Date(2026,9,14,9,0)).id,'am');
  assert.equal(nextStack(stacks,new Date(2026,9,14,10,0)).minutesUntil,0);
  const evening=nextStack(stacks,new Date(2026,9,14,10,0,1));
  assert.equal(evening.id,'pm'); assert.equal(evening.dayOffset,0); assert.equal(evening.time,'21:30');
});

test('next stack rolls over year and month by calendar and never mutates its input date', () => {
  const now=new Date(2026,11,31,23,45), stamp=now.getTime();
  const next=nextStack(fixture().stacks,now);
  assert.equal(next.id,'am'); assert.equal(next.date,'2027-01-01'); assert.equal(next.dayOffset,1); assert.equal(next.minutesUntil,615);
  assert.equal(now.getTime(),stamp);
});

test('next stack excludes invalid and disabled schedules and makes no delivery assertion', () => {
  const stacks=[{id:'bad',time:'25:99'},{id:'bad2',time:'9:30'},{id:'off',time:'10:00',enabled:false},{id:'inactive',time:'11:00',active:false}];
  assert.equal(nextStack(stacks,new Date()),null); assert.equal(nextStack([],new Date('invalid')),null);
  const next=nextStack(fixture().stacks,new Date(2026,9,14,9));
  assert.equal('notificationsEnabled' in next,false); assert.equal('delivered' in next,false);
});

test('next stack uses local calendar time across daylight-saving changes, not a fixed 24-hour offset', () => {
  const script=`import {nextStack} from ${JSON.stringify(new URL('../scott/insights.js',import.meta.url).href)};
    const n=nextStack([{id:'am',name:'Morning',time:'10:00'}],new Date(2026,2,7,23,0));
    process.stdout.write(JSON.stringify({date:n.date,hour:n.dueAt.getHours(),minutes:n.minutesUntil}));`;
  const output=execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ:'America/New_York'},encoding:'utf8'});
  assert.deepEqual(JSON.parse(output),{date:'2026-03-08',hour:10,minutes:600});
});
