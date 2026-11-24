// Kris's actual frontend with synthetic in-memory records. Every API request is
// intercepted; no credential, private record or backend write leaves this test.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';
const root=resolve(fileURLToPath(new URL('../kris/',import.meta.url)));
const out=fileURLToPath(new URL('../.playwright/kris/',import.meta.url));await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
 try{
  if(req.method!=='GET'){res.writeHead(405);return res.end();}
  const path=new URL(req.url,'http://localhost').pathname;
  if(!path.startsWith('/kris/')){res.writeHead(404);return res.end();}
  const file=resolve(root,'.'+decodeURIComponent(path.slice('/kris'.length)),path.endsWith('/')?'index.html':'');
  if(!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
  const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
function fixture(){
 const prior={id:'fixture-dose',name:'Earlier compound',category:'Synthetic',active:true,unit:'mcg',doseMcg:3000,mcgPerUnit:100,vialAmount:0,bacMl:0,timing:'Morning',schedule:{days:[2,6]},purpose:'Synthetic earlier directions.',benefits:[],ingredients:[]};
 const retired={...prior,id:'fixture-retired',name:'Retired compound',doseMcg:1000,timing:'Bedtime',schedule:{days:[6]}};
 return {_rev:1,role:'admin',compounds:[
  {...prior,name:'Current compound',doseMcg:2500,purpose:'Synthetic current directions.',scheduleHistory:[{through:'2026-02-01',protocol:prior}]},
  {...retired,active:false,endDate:'2026-02-01',scheduleHistory:[{through:'2026-02-01',protocol:retired}]},
  {id:'fixture-iu',name:'IU compound',category:'Synthetic',active:true,unit:'IU',doseMcg:2,mcgPerUnit:0.1,vialAmount:0,bacMl:0,timing:'Bedtime',schedule:{days:[1,2,3,4,5]},startDate:'2026-02-02',purpose:'Synthetic weekday bedtime directions.',benefits:[],ingredients:[]}
 ],logs:[{id:'fixture-prior-log',compoundId:'fixture-dose',datetime:'2026-01-31T08:00',doseMcg:3000,units:30,by:'member'}],labs:[],scans:[]};
}
async function run(name,engine){
 let state=fixture();const originalLog=structuredClone(state.logs[0]);const requests=[],errors=[],blocked=[];const checks=[];
 const browser=await engine.launch();
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/New_York',locale:'en-US',reducedMotion:'reduce',serviceWorkers:'block'});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin===origin)return route.continue();
  if(url.hostname==='kris-protocol.rsemenov81.workers.dev'){
   requests.push({method:req.method(),path:url.pathname});
   const headers={'Access-Control-Allow-Origin':origin,'Content-Type':'application/json','Cache-Control':'no-store'};
   if(req.method()==='GET'&&url.pathname==='/state')return route.fulfill({status:200,headers,body:JSON.stringify(state)});
   if(req.method()==='POST'&&url.pathname==='/log'){
    const body=req.postDataJSON();assert.ok(body.log,'Test must only submit its synthetic new log');
    assert.equal(body.log.compoundId,'fixture-iu');
    state.logs=[{...body.log,by:'admin'},...state.logs.filter(l=>l.id!==body.log.id)];
    return route.fulfill({status:200,headers,body:JSON.stringify({ok:true,log:state.logs[0]})});
   }
   if(req.method()==='POST'&&url.pathname==='/admin'){
    const body=req.postDataJSON();assert.equal(body.baseRev,state._rev);assert.ok(Array.isArray(body.compounds));
    state={...state,compounds:body.compounds,_rev:state._rev+1};
    return route.fulfill({status:200,headers,body:JSON.stringify({ok:true,_rev:state._rev})});
   }
  }
  blocked.push(url.hostname+url.pathname);return route.abort('blockedbyclient');
 });
 await context.addInitScript(()=>{
  const ActualDate=Date,fixed=Date.parse('2026-02-02T17:00:00Z');
  class FixedDate extends ActualDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}}
  globalThis.Date=FixedDate;localStorage.setItem('kris_token','synthetic-fixture-only');
 });
 const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 const card=id=>page.locator(`[data-act="opendose"][data-id="${id}"]`);
 const close=async()=>{await page.locator('[data-act="closesheet"]').click();await page.waitForFunction(()=>!document.querySelector('#sheet').classList.contains('open'));};
 async function selectDay(date){
  await page.getByRole('tab',{name:'Today',exact:true}).click();
  if(!await page.locator(`[data-act="day"][data-k="${date}"]`).count())await page.getByRole('button',{name:'Previous week',exact:true}).click();
  await page.locator(`[data-act="day"][data-k="${date}"]`).click();
 }
 async function doseCard(id,units,detail){assert.equal((await card(id).locator('.hv').textContent()).trim(),units);assert.equal((await card(id).locator('.by').textContent()).trim(),detail);}
 try{
  await page.goto(origin+'/kris/');await page.waitForFunction(()=>document.querySelectorAll('[data-act="opendose"]').length===1);
  await doseCard('fixture-iu','20','2 IU · 0.2 mL');
  assert.match(await card('fixture-iu').innerText(),/Bedtime/);
  const sections=await page.locator('.sect').allTextContents();assert.ok(sections.some(t=>/Evening|PM|Bedtime/.test(t)));
  await card('fixture-iu').click();await page.waitForFunction(()=>document.querySelector('#conv')?.textContent.includes('2 IU'));
  assert.equal(await page.locator('#dv').inputValue(),'20.0');
  for(const invalid of ['', 'abc', '0', '-1']){
   await page.locator('#dv').fill(invalid);await page.locator('#dv').press('Tab');
   assert.equal(await page.locator('#go').isDisabled(),true,'Invalid dose must disable logging');
   await page.locator('#go').dispatchEvent('click');
   assert.equal(requests.filter(r=>r.method==='POST'&&r.path==='/log').length,0);
  }
  await page.locator('#dv').fill('19.5');
  await page.waitForFunction(()=>document.querySelector('#conv')?.textContent.includes('1.95 IU'));
  await page.locator('#go').click();
  await page.waitForFunction(()=>document.querySelector('[data-id="fixture-iu"] .hv')?.textContent.trim()==='19.5');
  const sent=state.logs.find(l=>l.compoundId==='fixture-iu');assert.equal(sent.doseMcg,1.95);assert.equal(sent.units,19.5);
  assert.deepEqual(state.logs.find(l=>l.id===originalLog.id),originalLog);
  checks.push('Weekday bedtime 2 IU / 20 units / 0.2 mL; fractional 1.95 IU submitted without rounding');
  await selectDay('2026-02-03');assert.equal(await page.locator('[data-act="opendose"]').count(),2);
  await doseCard('fixture-dose','25','2.5 mg · 0.25 mL');await doseCard('fixture-iu','20','2 IU · 0.2 mL');
  await card('fixture-dose').click();await page.waitForFunction(()=>document.querySelector('#conv')?.textContent.includes('2.5 mg'));assert.equal(await page.locator('#dv').inputValue(),'25.0');
  assert.equal(await page.locator('#go').isDisabled(),true,'Future doses cannot be logged');await close();
  await selectDay('2026-02-06');assert.equal(await card('fixture-iu').count(),1);
  await selectDay('2026-02-07');assert.equal(await card('fixture-iu').count(),0);assert.equal(await card('fixture-retired').count(),0);await doseCard('fixture-dose','25','2.5 mg · 0.25 mL');
  checks.push('New dose on existing two weekdays; bedtime item on weekdays only; retired item absent after cutoff');
  await selectDay('2026-01-31');assert.equal(await page.locator('[data-act="opendose"]').count(),2);
  await doseCard('fixture-dose','30','3 mg · 0.3 mL');assert.match(await card('fixture-dose').innerText(),/Earlier compound/);assert.equal(await card('fixture-retired').count(),1);assert.equal(await card('fixture-iu').count(),0);
  await card('fixture-dose').click();await page.waitForFunction(()=>document.querySelector('#conv')?.textContent.includes('3 mg'));assert.equal(await page.locator('#dv').inputValue(),'30.0');await close();
  await card('fixture-retired').click();
  await page.waitForFunction(()=>document.querySelector('#times .chip.sel')?.dataset.t==='2026-01-31T22:00');
  await close();
  await page.screenshot({path:resolve(out,`${name}-historical.png`),fullPage:true});
  checks.push('Earlier day and log retain original dose, name, draw and retired item');
  await page.locator('[data-act="today"]').click();
  await page.locator('[data-act="editcomp"][data-id="fixture-iu"]').click();
  assert.equal(await page.locator('#f-time').inputValue(),'Bedtime');await page.locator('#f-save').click();
  await page.waitForFunction(()=>!document.querySelector('#sheet').classList.contains('open'));
  assert.equal(state.compounds.find(c=>c.id==='fixture-iu').timing,'Bedtime');
  await page.locator('[data-act="editcomp"][data-id="fixture-retired"]').click();await page.locator('#f-deact').click();
  await page.waitForFunction(()=>!document.querySelector('#sheet').classList.contains('open'));
  const restarted=state.compounds.find(c=>c.id==='fixture-retired');assert.equal(restarted.active,true);assert.equal(restarted.startDate,'2026-02-02');assert.equal('endDate'in restarted,false);
  assert.equal(restarted.scheduleHistory[0].protocol.active,true,'Same-day reactivation retains earlier active snapshot');
  checks.push('Bedtime persists through editing; explicit reactivation clears retirement boundary while retaining history');
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:width===1440?1000:844});
   for(const label of ['Today','Library','Labs','Progress']){
    await page.getByRole('tab',{name:label,exact:true}).click();
    assert.equal(await page.getByRole('tab',{name:label,exact:true}).getAttribute('aria-selected'),'true');
    const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,tabs:[...document.querySelectorAll('#navigation .tab')].map(el=>{const r=el.getBoundingClientRect();return {visible:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};})}));
    assert.ok(geometry.overflow<=1,`${width}px ${label}: horizontal overflow`);assert.equal(geometry.tabs.length,4);assert.ok(geometry.tabs.every(t=>t.visible&&t.hit));
   }
  }
  checks.push('Four tabs remain visible and clickable without overflow at four viewport widths');
  assert.deepEqual(state.logs.find(l=>l.id===originalLog.id),originalLog);assert.deepEqual(errors,[]);
  assert.equal(requests.filter(r=>r.method==='POST'&&r.path==='/log').length,1);
  await writeFile(resolve(out,`${name}-receipt.json`),JSON.stringify({passed:true,checks,interceptedRequests:requests,externalRequestsBlocked:blocked,pageErrors:errors,productionRequests:0},null,2));
  console.log(`${name}: ${checks.length} Kris browser checks passed`);
 }catch(e){await page.screenshot({path:resolve(out,`${name}-failure.png`),fullPage:true}).catch(()=>{});await writeFile(resolve(out,`${name}-failure.json`),JSON.stringify({message:e.stack,checks,requests,errors},null,2));throw e;}
 finally{await browser.close();}
}
try{await run('chromium',chromium);await run('webkit',webkit);}finally{await new Promise(done=>server.close(done));}
