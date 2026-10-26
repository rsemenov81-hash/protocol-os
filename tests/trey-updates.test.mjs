// Synthetic records only. Course boundaries must agree in the UI and scheduler.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker, {dueFor} from '../trey/worker.js';
import {exportCSV} from '../trey/insights.js';

const html=fs.readFileSync(new URL('../trey/index.html',import.meta.url),'utf8');
const course={id:'course-fixture',name:'Synthetic course',active:true,doseMcg:100,mcgPerUnit:10,timing:'Before bed',schedule:{days:[0,1,2,3,4,5,6],startDate:'2030-03-01',endDate:'2030-03-10'}};
const ctx=vm.createContext({dkey:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`});
vm.runInContext(html.match(/const dueOn = [\s\S]*?;\nconst withinCourse = [\s\S]*?;\n/)[0]+'\nthis.dueOn=dueOn;',ctx);

test('ten-night course includes both endpoints and stops in UI and reminders',()=>{
  const s={compounds:[course],logs:[]};
  for(const [day,expected] of [['2030-02-28',false],['2030-03-01',true],['2030-03-10',true],['2030-03-11',false]]){
    assert.equal(ctx.dueOn(course,new Date(day+'T12:00:00')),expected,day+' UI');
    assert.equal(dueFor(s,day,'pm').length,Number(expected),day+' reminder');
  }
  assert.equal(Array.from({length:12},(_,i)=>dueFor(s,`2030-03-${String(i+1).padStart(2,'0')}`,'pm').length).reduce((a,b)=>a+b,0),10);
  assert.equal(dueFor({...s,logs:[{compoundId:course.id,datetime:'2030-03-10T22:00'}]},'2030-03-10','pm').length,0);
});

function fixture(){
  const initial={_rev:7,compounds:[course],logs:[{id:'history',compoundId:course.id,datetime:'2030-03-02T22:00',doseMcg:100,by:'member'}],labs:[{id:'lab'}],scans:[{id:'scan'}],custom:{retained:true}};
  const store=new Map([['trey:state',JSON.stringify(initial)]]);
  const env={ADMIN_TOKEN:'admin-fixture',MEMBER_TOKEN:'member-fixture',TREY_KV:{get:async k=>store.get(k)||null,put:async(k,v)=>store.set(k,v)}};
  const call=async(path,body,admin=false)=>{const r=await worker.fetch(new Request('https://example.test'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+(admin?env.ADMIN_TOKEN:env.MEMBER_TOKEN),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,body:await r.json()};};
  return {initial,store,call};
}
test('private education and announcements persist without changing records or permissions',async()=>{
  const {initial,store,call}=fixture();
  const patch={baseRev:7,library:[{id:'reading',title:'Synthetic reading'}],faq:[{id:'faq',question:'Synthetic FAQ'}],announcements:[{id:'update',title:'Synthetic update'}]};
  assert.equal((await call('/admin',patch)).status,403);
  assert.equal((await call('/admin',patch,true)).status,200);
  const state=(await call('/state')).body;
  for(const key of ['compounds','logs','labs','scans','custom'])assert.deepEqual(state[key],initial[key]);
  for(const key of ['library','faq','announcements'])assert.deepEqual(state[key],patch[key]);
  assert.equal(JSON.parse(store.get('trey:state:prev'))._rev,7);
  assert.equal((await call('/admin',patch,true)).status,409);
});
test('course dates reject invalid ordering/calendar dates without writing',async()=>{
  const {store,call}=fixture();const before=store.get('trey:state');
  for(const schedule of [{startDate:'2030-03-12',endDate:'2030-03-01'},{startDate:'2030-02-30'},{endDate:'invalid'}]){
    assert.equal((await call('/admin',{baseRev:7,compounds:[{...course,schedule}]},true)).status,400);
    assert.equal(store.get('trey:state'),before);
  }
  assert.equal((await call('/admin',{faq:[]},true)).status,428);
});
test('logging uses the recorded course date, with historical corrections still available',async()=>{
  const {call}=fixture();
  for(const [day,status] of [['2030-02-28',422],['2030-03-01',200],['2030-03-10',200],['2030-03-11',422]]){
    assert.equal((await call('/log',{log:{id:day,compoundId:course.id,datetime:day+'T22:00',doseMcg:100}})).status,status);
  }
  assert.equal((await call('/log',{log:{id:'history',compoundId:course.id,datetime:'2030-03-02T21:00',doseMcg:100}})).status,200);
});
test('protocol CSV retains course dates and separate blend ingredients',()=>{
  const csv=exportCSV({compounds:[{...course,ingredients:[{name:'Component A',mg:10},{name:'Component B',mg:5}]}]},'protocol');
  assert.match(csv,/2030-03-01 through 2030-03-10/);assert.match(csv,/Component A: 10 mg; Component B: 5 mg/);
});
