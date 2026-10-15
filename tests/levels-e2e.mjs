// Synthetic records only. Exercise both browser engines without touching production sync.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {startStaticServer} from './helpers/static-server.mjs';
import {loadPlaywright} from './helpers/playwright.mjs';
const {chromium,webkit}=await loadPlaywright();
const root=new URL('../',import.meta.url).pathname;
const server=await startStaticServer(root);
const now=Date.parse('2026-10-14T16:00:00Z');
const log=(id,patch={})=>({id,profile:'Roman',peptideId:'tirzepatide',peptide:'Tirzepatide',doseMcg:10000,datetime:'2026-10-09T16:00:00Z',route:'sc',...patch});
const fixture={protocols:[{id:'r',profile:'Roman',peptideId:'mots-c',peptideName:'MOTS-c',active:false},{id:'s',profile:'Scott',peptideId:'hcg',peptideName:'HCG',active:false}],logs:[log('a'),log('b',{peptideId:'testosterone-cypionate',peptide:'Testosterone cypionate',route:'inj',doseMcg:20000}),log('c',{peptideId:'mots-c',peptide:'MOTS-c',route:'inj'}),log('d',{peptideId:'hcg',peptide:'HCG',doseMcg:500,doseUnit:'IU',datetime:'2026-10-13T07:00:00Z'}),log('e',{peptideId:'cagrilintide',peptide:'Cagrilintide'}),log('s',{profile:'Scott',peptideId:'hcg',peptide:'Scott only HCG',doseMcg:500,doseUnit:'IU'}),log('future',{peptideId:'future-only',peptide:'Future only',datetime:'2026-10-15T00:00:00Z'}),log('skip',{peptideId:'skip-only',peptide:'Skipped only',skipped:true})],vials:[]};
await mkdir(root+'.playwright/levels',{recursive:true});
let checks=0;
const check=(label,value)=>{assert.ok(value,label);checks++;console.log('PASS '+label);};
try {
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]) {
  const browser=await engine.launch({headless:true});
  try {
   const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/New_York',reducedMotion:'reduce',serviceWorkers:'block'});
   await ctx.addInitScript(fx=>{if(localStorage.getItem('__levels_fixture'))return;for(const k of ['protocols','logs','vials'])localStorage.setItem('protocol_os_'+k,JSON.stringify(fx[k]));localStorage.setItem('protocol_os_meta',JSON.stringify({migrations:['m1_roman_test_daily_anavar_2026-10']}));localStorage.setItem('protocol_os_active_profile','Roman');localStorage.setItem('protocol_os_loaded_v4','true');localStorage.setItem('__levels_fixture','1');},fixture);
   const page=await ctx.newPage();await page.clock.install({time:new Date(now)});await page.clock.pauseAt(new Date(now));
   let initialLogs; const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(server.url);initialLogs=await page.evaluate(()=>localStorage.getItem('protocol_os_logs'));await page.getByRole('button',{name:'Levels',exact:true}).click();
   check(name+' tab and current-time title',await page.getByRole('heading',{name:'Levels',exact:true}).isVisible());
   check(name+' four bottom navigation items',await page.locator('.pill-nav-item').count()===4);
   check(name+' route-confirmed numeric amount',await page.locator('.level-card').filter({hasText:'Tirzepatide'}).getByText('5 mg',{exact:true}).isVisible());
   check(name+' profile isolated',!await page.getByText('Scott only HCG',{exact:true}).count());
   check(name+' skipped and future-only absent',!await page.getByText('Future only',{exact:true}).count()&&!await page.getByText('Skipped only',{exact:true}).count());
   const t=page.locator('.level-card').filter({hasText:'Tirzepatide'});await t.locator('.level-card-toggle').click();
   check(name+' historical chart and dose list',await t.getByRole('img').count()===1&&await t.locator('.level-dose-list li').count()===1);
   await t.getByRole('button',{name:'30d',exact:true}).click();check(name+' chart range changes',await t.getByRole('img').getAttribute('aria-label').then(x=>x.includes('30 days')));
   await t.getByRole('slider').focus();await t.getByRole('slider').press('Home');check(name+' keyboard scrubbing',await t.locator('.level-readout').innerText().then(x=>x.includes('<0.01 mcg')));
   await t.getByText('Model details & source',{exact:true}).click();check(name+' primary source opens safely',await t.getByRole('link',{name:/Read the half-life/}).getAttribute('rel').then(x=>x.includes('noopener')));
   const cyp=page.locator('.level-card').filter({hasText:'Testosterone cypionate'});await cyp.locator('.level-card-toggle').click();
   check(name+' unspecified injection not guessed',await cyp.getByRole('combobox').inputValue()==='');
   await cyp.getByRole('combobox').selectOption('cyp-im');check(name+' reference selection produces estimate',await cyp.locator('.level-current').isVisible());
   await page.reload();await page.getByRole('button',{name:'Levels',exact:true}).click();await cyp.locator('.level-card-toggle').click();
   check(name+' reference choice survives reload',await cyp.getByRole('combobox').inputValue()==='cyp-im');
   await page.getByRole('button',{name:/^Profile:/}).click();await page.getByRole('menuitemradio',{name:/Scott/}).click();
   check(name+' switching profile resets filters and isolates history',await page.locator('.level-card').count()===1&&await page.getByText('Scott only HCG',{exact:true}).isVisible());
   await page.getByRole('button',{name:/^Profile:/}).click();await page.getByRole('menuitemradio',{name:/Roman/}).click();
   await cyp.locator('.level-card-toggle').click();check(name+' reference stays with original profile',await cyp.getByRole('combobox').inputValue()==='cyp-im');
   await page.getByRole('button',{name:/^Profile:/}).click();await page.getByRole('menuitem',{name:/Theme: Auto/}).click();
   check(name+' dark theme applies',await page.locator('html').getAttribute('data-theme')==='dark');
   await page.getByRole('menuitemradio',{name:/Roman/}).click();await page.screenshot({path:root+'.playwright/levels/'+name+'-dark.png',fullPage:true});
   await page.getByRole('button',{name:/^Profile:/}).click();await page.getByRole('menuitem',{name:/Theme: Dark/}).click();
   check(name+' light theme applies',await page.locator('html').getAttribute('data-theme')==='light');
   await page.getByRole('menuitemradio',{name:/Roman/}).click();
   await page.getByRole('searchbox',{name:'Search logged compounds'}).fill('MOTS');await page.locator('.level-card-toggle').click();
   check(name+' unknown compound honest empty state',await page.getByText(/No sourced human half-life model/).isVisible());
   check(name+' unknown compound has no chart',await page.locator('.level-card svg').count()===0);
   await page.getByRole('searchbox').fill('nothing-matches');check(name+' search empty state',await page.getByText('No compounds match this search and filter.').isVisible());
   await page.getByRole('searchbox').fill('');await page.getByRole('button',{name:'Modeled',exact:true}).click();check(name+' modeled filter',await page.locator('.level-card').count()===4);
   // Live time advances without reloading.
   await page.getByRole('searchbox').fill('Tirzepatide');await page.clock.fastForward(5*24*3600000);check(name+' clock refresh recomputes',await page.locator('.level-card-value').innerText().then(x=>x.includes('2.5 mg')));
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});check(name+' fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));}
   await page.setViewportSize({width:390,height:844});await page.getByRole('searchbox').fill('');await page.getByRole('button',{name:'All compounds',exact:true}).click();await page.screenshot({path:root+'.playwright/levels/'+name+'.png',fullPage:true});
   check(name+' logs unchanged by model selection',await page.evaluate(()=>localStorage.getItem('protocol_os_logs')).then(v=>v===initialLogs));
   await cyp.locator('.level-card-toggle').click();
   await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='protocol_os_levels_models_v1')throw new DOMException('Quota exceeded','QuotaExceededError');return original.call(this,key,value);};});
   await cyp.getByRole('combobox').selectOption('');
   check(name+' storage failure explained without losing session choice',await page.getByRole('alert').filter({hasText:'could not be saved'}).isVisible()&&!await cyp.locator('.level-current').count());
   check(name+' no runtime errors',errors.length===0);
   await ctx.close();
   const empty=await browser.newContext({serviceWorkers:'block'});const p=await empty.newPage();await p.goto(server.url);await p.getByRole('button',{name:'Levels',exact:true}).click();check(name+' first run no fabricated readings',await p.getByRole('heading',{name:'No recorded doses yet'}).isVisible());await empty.close();
  } finally {await browser.close();}
 }
 console.log(`${checks} Levels browser checks passed`);
} finally {await server.close();}
