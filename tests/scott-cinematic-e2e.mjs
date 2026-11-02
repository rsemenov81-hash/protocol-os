// Decorative motion only; synthetic data, with every backend request intercepted.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(import.meta.dirname,'..');
const source=await readFile(resolve(root,'tests/scott-e2e.mjs'),'utf8');
const fixture=new Function(source.slice(source.indexOf('function freshFixture()'),source.indexOf('let state = freshFixture()'))+'return freshFixture();')();
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://local').pathname;const file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));if(!file.startsWith(root+'/'))throw Error();const data=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.mp4':'video/mp4','.webm':'video/webm','.jpg':'image/jpeg'})[extname(file)]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.env.SCOTT_VISUAL_URL||`http://127.0.0.1:${server.address().port}/scott/`;
const browser=await chromium.launch(process.env.SCOTT_BROWSER_CHANNEL ? {channel:process.env.SCOTT_BROWSER_CHANNEL} : {});
await mkdir(resolve(root,'.playwright/scott-cinematic'),{recursive:true});
try{
 for(const mode of ['motion','reduced','save-data','paused']){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:mode==='reduced'?'reduce':'no-preference'});
  let videoRequests=0,writes=0;const errors=[];
  await context.route('**/*',route=>{const req=route.request(),u=new URL(req.url());if(u.hostname.endsWith('.workers.dev')){if(req.method()==='GET'&&u.pathname==='/state')return route.fulfill({json:fixture});writes++;return route.abort();}if(/\.(mp4|webm)$/.test(u.pathname))videoRequests++;if(u.origin===new URL(base).origin)return route.continue();return route.abort();});
  await context.addInitScript(({mode})=>{localStorage.setItem('scott_token','synthetic-preview-only');if(mode==='paused')localStorage.setItem('scott_motion_paused','1');if(mode==='save-data')Object.defineProperty(navigator,'connection',{value:{saveData:true,addEventListener(){}}});},{mode});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.getByRole('tab',{name:'Today',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
  const video=page.locator('#ambient-video'),button=page.locator('#motion-toggle');
  if(mode==='motion'){
   await page.waitForFunction(()=>document.querySelector('video').currentTime>0.1);assert.equal(await video.evaluate(v=>v.muted&&v.loop&&v.playsInline),true);
   await button.click();await page.waitForFunction(()=>document.querySelector('video').paused);assert.equal(await button.textContent(),'Play background');
   await button.click();await page.waitForFunction(()=>!document.querySelector('video').paused);
   await page.screenshot({path:resolve(root,'.playwright/scott-cinematic/mobile-synthetic.png'),fullPage:true});
   await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await page.waitForFunction(()=>document.querySelector('video').paused);
   await page.evaluate(()=>scrollTo(0,0));await page.waitForFunction(()=>!document.querySelector('video').paused);
   await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:resolve(root,'.playwright/scott-cinematic/desktop-synthetic.png'),fullPage:true});
   for(const label of ['Stacks','Labs','Progress','More']){await page.getByRole('tab',{name:label,exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
   await button.click();await page.reload();await page.waitForLoadState('networkidle');assert.equal(await video.getAttribute('src'),null);assert.equal(await button.textContent(),'Play background');
  }else{
   await page.waitForLoadState('networkidle');assert.equal(await video.getAttribute('src'),null);assert.equal(videoRequests,0);assert.equal(await video.evaluate(v=>v.paused),true);assert.equal(await button.textContent(),mode==='paused'?'Play background':'Motion off');
   if(mode==='reduced')await page.screenshot({path:resolve(root,'.playwright/scott-cinematic/reduced-synthetic.png'),fullPage:true});
  }
  assert.deepEqual(errors,[]);assert.equal(writes,0);await context.close();console.log(`PASS cinematic ${mode}`);
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
