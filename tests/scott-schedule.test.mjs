// Date-effective protocols must agree in the UI, reminders, logs and exports.
// Synthetic records only; no personal data or network calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import worker, { protocolOn, dueFor } from '../scott/worker.js';
import { activityRows } from '../scott/insights.js';

const html = readFileSync(new URL('../scott/index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('function protocolOn('), html.indexOf('const blockOf ='));
const context = vm.createContext({dkey: d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`});
vm.runInContext(source, context);
const old = {id:'fixture',name:'Earlier name',doseMcg:4000,unit:'mcg',mcgPerUnit:200,active:true,timing:'Morning',schedule:{days:[1,5]}};
const current = {...old,name:'Current name',doseMcg:1000,schedule:{days:[1,3,5]},scheduleHistory:[{through:'2026-11-22',protocol:old}]};
const fresh = {id:'new-fixture',name:'New item',doseMcg:1000,unit:'mcg',active:true,timing:'Morning',startDate:'2026-11-23',schedule:{days:[1,3,5]}};
const retired = {...old,id:'retired',active:false,endDate:'2026-11-22',scheduleHistory:[{through:'2026-11-22',protocol:{...old,id:'retired'}}]};

test('UI and worker resolve the same inclusive history boundary without mutating source records', () => {
  const before=JSON.stringify([current,fresh,retired]);
  for (const c of [current,fresh,retired]) for (const day of ['2026-11-20','2026-11-22','2026-11-23','2026-11-25']) {
    context.fixture=c; context.day=day;
    assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('protocolOn(fixture, day)', context))),protocolOn(c,day));
  }
  assert.equal(protocolOn(current,'2026-11-22').doseMcg,4000);
  assert.equal(protocolOn(current,'2026-11-23').doseMcg,1000);
  assert.equal(protocolOn(fresh,'2026-11-22').active,false);
  assert.equal(protocolOn(fresh,'2026-11-23').active,true);
  assert.equal(protocolOn(retired,'2026-11-22').active,true);
  assert.equal(protocolOn(retired,'2026-11-23').active,false);
  assert.equal(JSON.stringify([current,fresh,retired]),before);
});

test('reminders use the dose and weekday in effect, excluding new and retired items outside their dates', () => {
  const state={compounds:[current,fresh,retired],logs:[]};
  assert.deepEqual(dueFor(state,'2026-11-18','am'),[],'earlier Wednesday had no schedule');
  assert.deepEqual(dueFor(state,'2026-11-20','am').map(c=>[c.id,c.doseMcg]),[['fixture',4000],['retired',4000]]);
  assert.deepEqual(dueFor(state,'2026-11-25','am').map(c=>[c.id,c.doseMcg]),[['fixture',1000],['new-fixture',1000]]);
  state.logs.push({compoundId:'fixture',datetime:'2026-11-25T09:00'});
  assert.deepEqual(dueFor(state,'2026-11-25','am').map(c=>c.id),['new-fixture']);
});

test('multiple revisions choose the earliest snapshot that still covers the date', () => {
  const c={...current,scheduleHistory:[{through:'2026-12-20',protocol:{...old,doseMcg:2000}},{through:'2026-11-22',protocol:old}]};
  assert.equal(protocolOn(c,'2026-11-20').doseMcg,4000);
  assert.equal(protocolOn(c,'2026-12-01').doseMcg,2000);
  assert.equal(protocolOn(c,'2026-12-21').doseMcg,1000);
});

test('history/export labels follow the recorded day while recorded dose and syringe units stay untouched', () => {
  const data={compounds:[current],logs:[{id:'prior',compoundId:current.id,datetime:'2026-11-20T08:00',doseMcg:4500,units:22.5},{id:'now',compoundId:current.id,datetime:'2026-11-23T08:00',doseMcg:1000,units:5}]};
  const rows=activityRows(data);
  assert.equal(rows[0].name,'Current name');
  assert.equal(rows[1].name,'Earlier name');
  assert.equal(rows[1].recordedDose,4500);
  assert.equal(rows[1].syringeUnits,22.5);
});

test('worker checks historical doses against historical recommendation and rejects dates outside a compound lifetime', async () => {
  let state={_rev:1,compounds:[current,fresh,retired],logs:[],labs:[],scans:[]};
  const env={ADMIN_CODE:'test-admin',MEMBER_CODE:'test-member',SCOTT_KV:{get:async()=>JSON.stringify(state),put:async(_key,value)=>{state=JSON.parse(value);}}};
  const log=async(compoundId,datetime,doseMcg)=>worker.fetch(new Request('https://fixture.test/log',{method:'POST',headers:{Authorization:'Bearer test-admin','Content-Type':'application/json'},body:JSON.stringify({log:{compoundId,datetime,doseMcg}})}),env);
  assert.equal((await log('fixture','2026-11-20T09:00',6000)).status,200,'1.5 times historical dose should not use new 1mg threshold');
  assert.equal((await log('fixture','2026-11-23T09:00',6000)).status,422,'existing 5x gate remains enforced for current dose');
  assert.equal((await log('new-fixture','2026-11-20T09:00',1000)).status,400);
  assert.equal((await log('retired','2026-11-23T09:00',4000)).status,400);
  assert.equal(state.logs.length,1);
});

test('explicit reactivation clears the old end date and preserves the retired interval', () => {
  context.retired=retired;
  const revived=JSON.parse(JSON.stringify(vm.runInContext("reactivateProtocol(retired, '2026-12-01')",context)));
  assert.equal(revived.active,true);
  assert.equal(revived.startDate,'2026-12-01');
  assert.equal('endDate' in revived,false);
  assert.equal(protocolOn(revived,'2026-11-20').active,true,'old scheduled period stays available');
  assert.equal(protocolOn(revived,'2026-11-25').active,false,'retired days remain retired');
  assert.equal(protocolOn(revived,'2026-12-01').active,true,'restart is inclusive');
  assert.equal(retired.endDate,'2026-11-22','original record is untouched');
  const sameDay=JSON.parse(JSON.stringify(vm.runInContext("reactivateProtocol(retired, '2026-11-23')",context)));
  assert.equal(sameDay.scheduleHistory.length,1,'same boundary must preserve existing snapshot');
  assert.equal(protocolOn(sameDay,'2026-11-20').active,true);
  assert.equal(protocolOn(sameDay,'2026-11-23').active,true);
});
