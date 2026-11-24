// Synthetic frontend-only schedule regression tests; no private records or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../kris/index.html',import.meta.url),'utf8');
const start=html.indexOf('function protocolOn('),end=html.indexOf('const logFor =',start);
assert.ok(start>=0&&end>start,'Date-aware frontend functions are present');
const context=vm.createContext({dkey:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`});
vm.runInContext(html.slice(start,end),context);
const evaluate=(source,vars={})=>{Object.assign(context,vars);return JSON.parse(JSON.stringify(vm.runInContext(source,context)));};
const prior={id:'fixture-dose',name:'Earlier name',active:true,doseMcg:3000,unit:'mcg',mcgPerUnit:100,timing:'Morning',schedule:{days:[2,6]}};
const current={...prior,name:'Current name',doseMcg:2500,scheduleHistory:[{through:'2026-02-01',protocol:prior}]};
const retired={...prior,id:'fixture-retired',active:false,endDate:'2026-02-01',scheduleHistory:[{through:'2026-02-01',protocol:{...prior,id:'fixture-retired'}}]};
const fresh={id:'fixture-iu',active:true,doseMcg:2,unit:'IU',mcgPerUnit:0.1,timing:'Bedtime',schedule:{days:[1,2,3,4,5]},startDate:'2026-02-02'};

test('calendar-date boundaries preserve old doses, retired records and new item start dates',()=>{
 const before=JSON.stringify([current,retired,fresh]);
 assert.equal(evaluate("protocolOn(c,'2026-02-01').doseMcg",{c:current}),3000);
 assert.equal(evaluate("protocolOn(c,'2026-02-02').doseMcg",{c:current}),2500);
 assert.equal(evaluate("protocolOn(c,'2026-02-01').active",{c:retired}),true);
 assert.equal(evaluate("protocolOn(c,'2026-02-02').active",{c:retired}),false);
 assert.equal(evaluate("protocolOn(c,'2026-02-01').active",{c:fresh}),false);
 assert.equal(evaluate("protocolOn(c,'2026-02-02').active",{c:fresh}),true);
 assert.equal(JSON.stringify([current,retired,fresh]),before);
});
test('weekday and bedtime placement follow date-effective records',()=>{
 for(const [date,expected] of [['2026-01-31',false],['2026-02-01',false],['2026-02-02',true],['2026-02-06',true],['2026-02-07',false],['2026-02-08',false]])
  assert.equal(evaluate('dueOn(c,new Date(day+"T12:00:00"))',{c:fresh,day:date}),expected,date);
 assert.equal(evaluate('blockOf(c)',{c:fresh}),'pm');
 assert.equal(evaluate('dueOn(c,new Date("2026-01-31T12:00:00"))',{c:retired}),true);
 assert.equal(evaluate('dueOn(c,new Date("2026-02-07T12:00:00"))',{c:retired}),false);
});
test('reactivation restores current visibility without changing a prior active period or inactive gap',()=>{
 const restarted=evaluate('reactivateProtocol(c,"2026-02-09")',{c:retired});
 assert.equal(restarted.active,true);assert.equal(restarted.startDate,'2026-02-09');assert.equal('endDate'in restarted,false);
 assert.equal(evaluate('protocolOn(c,"2026-01-31").active',{c:restarted}),true);
 assert.equal(evaluate('protocolOn(c,"2026-02-07").active',{c:restarted}),false);
 assert.equal(evaluate('protocolOn(c,"2026-02-10").active',{c:restarted}),true);
 const sameDay=evaluate('reactivateProtocol(c,"2026-02-02")',{c:retired});
 assert.deepEqual(sameDay.scheduleHistory,retired.scheduleHistory,'Same boundary must not replace earlier directions');
});
