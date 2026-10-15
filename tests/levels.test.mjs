import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLevels, remainingAt, levelSeries, resolveModel, parseDoseTime, formatLevel, LEVEL_MODELS, HOUR} from '../src/app/levels.js';
const NOW=Date.parse('2026-10-14T16:00:00Z');
const dose=(patch={})=>({id:'a',profile:'Roman',peptideId:'tirzepatide',peptide:'Tirzepatide',datetime:'2026-10-09T16:00:00Z',doseMcg:10000,route:'sc',...patch});
const build=(logs,extra={})=>buildLevels({logs,now:NOW,profile:'Roman',...extra});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('single dose decays to half, quarter, eighth at exact half-lives',()=>{
 const e=[{at:NOW,amount:100}]; for(let n=0;n<4;n++)near(remainingAt(e,NOW+n*8*HOUR,8),100/2**n);
});
test('sums repeated doses, including doses older than chart window',()=>{
 const g=build([dose(),dose({id:'b',datetime:'2026-10-14T16:00:00Z',doseMcg:2000}),dose({id:'c',datetime:'2026-10-04T16:00:00Z',doseMcg:4000})]).groups[0]; near(g.remaining,8000);
});
test('no planned exposure, skipped, zero, negative, invalid or future doses enter model',()=>{
 const r=build([dose({skipped:true}),dose({id:'b',doseMcg:0}),dose({id:'c',doseMcg:-1}),dose({id:'d',datetime:'2026-10-15T16:00:00Z'}),dose({id:'e',datetime:'nonsense'}),dose({id:'f',doseMcg:Infinity})],{protocols:[{id:'planned',profile:'Roman',doseMcg:100000}]}); assert.equal(r.groups.length,0);assert.deepEqual(r.ignored,{skipped:1,invalid:4,future:1,duplicate:0,unassigned:0});
});
test('finished and removed protocols keep historical exposure; dose amount never comes from plan',()=>{
 const r=build([dose({protocolId:'past'})],{protocols:[{id:'past',profile:'Roman',active:false,endDate:'2026-10-10',doseMcg:999999}]});near(r.groups[0].remaining,5000);
});
test('profile isolation; infer missing owner only from owning protocol, never active profile',()=>{
 const r=build([dose(),dose({id:'b',profile:'Trey'}),dose({id:'c',profile:undefined}),dose({id:'d',profile:undefined,protocolId:'rp'})],{protocols:[{id:'rp',profile:'Roman'}]});assert.equal(r.groups[0].entries.length,2);assert.equal(r.ignored.unassigned,1);
});
test('duplicate ID keeps latest edit, and an updated skip removes exposure',()=>{
 const r=build([dose({updatedAt:'2026-10-13T00:00Z'}),dose({doseMcg:2000,updatedAt:'2026-10-14T00:00Z'})]);near(r.groups[0].remaining,1000);assert.equal(r.ignored.duplicate,1);
 assert.equal(build([dose(),dose({skipped:true,updatedAt:'2026-10-14T00:00Z'})]).groups.length,0);
});
test('mg and g tags use canonical doseMcg; never stale doseValue',()=>{
 const r=build([dose({doseUnit:'mg',doseValue:999}),dose({id:'b',doseUnit:'g',doseValue:99})]);assert.equal(r.groups.length,1);near(r.groups[0].remaining,10000);
});
test('IU stays IU and untagged hCG is unavailable, not mass',()=>{
 const r=build([dose({peptideId:'hcg',peptide:'HCG',doseMcg:500,doseUnit:'IU',datetime:'2026-10-13T07:00:00Z'}),dose({id:'b',peptideId:'hcg',peptide:'HCG',doseMcg:500})]);near(r.groups.find(g=>g.unit==='IU').remaining,250);assert.equal(r.groups.find(g=>g.unit==='unknown').models.length,0);assert.equal(formatLevel(250,'IU'),'250 IU');
});
test('generic injection requires explicit choice; persists as a separate model assumption',()=>{
 const g=build([dose({route:'inj'})]).groups[0];assert.equal(g.model,null);assert.equal(g.models.length,1);assert.equal(resolveModel(g,{[g.key]:'tirz-sc'}).id,'tirz-sc');assert.equal(resolveModel(g,{[g.key]:'cyp-im'}),null);
});
test('today protocol route never rewrites historical route; explicit mismatches cannot be overridden',()=>{
 const g=build([dose({route:undefined,protocolId:'p'})],{protocols:[{id:'p',profile:'Roman',route:'sc'}]}).groups[0];assert.equal(g.model,null);
 const sublingual=build([dose({peptideId:'tadalafil',peptide:'Tadalafil (2.5mg SL)',route:undefined})]).groups[0];assert.equal(sublingual.models.length,0);assert.equal(resolveModel(sublingual,{[sublingual.key]:'tadalafil-oral'}),null);
 assert.equal(build([dose({route:'iv'})]).groups[0].models.length,0);
});
test('testosterone esters remain distinct and generic testosterone is not guessed as cypionate',()=>{
 const r=build([dose({peptideId:'testosterone',peptide:'Testosterone Cyp',route:'im'}),dose({id:'b',peptideId:'testosterone-enanthate',peptide:'Testosterone enanthate',route:'im'}),dose({id:'c',peptideId:'testosterone',peptide:'Testosterone',route:'im'})]);assert.equal(r.groups.length,3);assert.equal(r.groups.filter(g=>g.model).length,1);
});
test('pens and blends never receive a single half-life or collapse into one pen',()=>{
 const r=build([dose({peptideId:'__pen__',peptide:'Blue Pen',protocolId:'blue'}),dose({id:'b',peptideId:'__pen__',peptide:'Golden Pen',protocolId:'gold'}),dose({id:'c',peptideId:'ipa-cjc',peptide:'Ipamorelin + CJC-1295'})]);assert.equal(r.groups.length,3);assert.ok(r.groups.every(g=>!g.model&&g.models.length===0));
});
test('unknown research compounds stay visible without invented values',()=>{
 const g=build([dose({peptideId:'mots-c',peptide:'MOTS-c'})]).groups[0];assert.equal(g.remaining,null);assert.equal(g.models.length,0);
});
test('bad dates rejected, exact timestamps and time-zone offsets agree',()=>{
 for(const s of ['2026-02-30T12:00','2026-13-01T00:00','2026-10-14','2026-10-14T24:00','2026-10-14T12:60','2026-10-14T12:00:60'])assert.ok(Number.isNaN(parseDoseTime(s)),s);
 assert.equal(parseDoseTime('2026-10-14T12:00:00-04:00'),NOW);assert.equal(parseDoseTime('2026-10-14T16:00:00.000Z'),NOW);
});
test('DST elapsed time uses actual time; nonexistent datetime-local excluded',()=>{
 const prev=process.env.TZ;process.env.TZ='America/New_York';try{assert.ok(Number.isNaN(parseDoseTime('2026-03-08T02:30')));near((parseDoseTime('2026-03-08T03:30')-parseDoseTime('2026-03-08T01:30'))/HOUR,1);}finally{process.env.TZ=prev||'UTC';}
});
test('small residual is not rounded to a definitive cleared zero',()=>{assert.equal(formatLevel(1e-12,'mass'),'<0.01 mcg');assert.equal(formatLevel(1500,'mass'),'1.5 mg');assert.equal(formatLevel(null,'mass'),'—');});
test('backfilled and needsReview records included with coverage flags',()=>{const g=build([dose({backfilled:true,needsReview:true,datetime:'2026-10-09T16:00'})]).groups[0];assert.equal(g.localTimes,1);assert.equal(g.backfilled,1);assert.equal(g.review,1);});
test('dose events create vertical steps, range starts with residual from older doses',()=>{
 const e=[{at:NOW-10*24*HOUR,amount:100},{at:NOW-2*HOUR,amount:100},{at:NOW-2*HOUR,amount:50}];const p=levelSeries(e,NOW,120,7);near(p[0].amount,remainingAt(e,p[0].time,120));near(p.at(-1).amount,remainingAt(e,NOW,120));const spike=p.filter(x=>x.time===NOW-2*HOUR);assert.equal(spike.length,2);near(spike[1].amount-spike[0].amount,150);
});
test('cagrilintide uncertainty endpoints bracket midpoint estimates',()=>{
 const g=build([dose({peptideId:'cagrilintide',peptide:'Cagrilintide'})]).groups[0];assert.ok(remainingAt(g.entries,NOW,g.model.range[0])<g.remaining);assert.ok(remainingAt(g.entries,NOW,g.model.range[1])>g.remaining);
});
test('all references carry public primary source links, valid half-lives and route restrictions',()=>{for(const m of LEVEL_MODELS){assert.ok(m.hours>0&&Number.isFinite(m.hours));assert.ok(m.source.startsWith('https://'));assert.ok(m.routes.length);assert.ok(m.note.length>30);}assert.equal(LEVEL_MODELS.find(m=>m.id==='deca-im').kind,'depot');});
test('large history chart remains bounded by samples plus actual events',()=>{
 const e=Array.from({length:20000},(_,i)=>({at:NOW-i*24*HOUR,amount:100}));const t=performance.now();const p=levelSeries(e,NOW,120,7);assert.ok(p.length<=137);near(p.at(-1).amount,remainingAt(e,NOW,120));assert.ok(performance.now()-t<1000);
});
test('non-numeric scalar coercions cannot become doses',()=>{assert.equal(build([dose({doseMcg:true}),dose({id:'b',doseMcg:[100]})]).groups.length,0);});
