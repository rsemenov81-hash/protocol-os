// Regression checks against the real inline frontend. No browser, credentials or live API.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../scott/index.html', import.meta.url), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
function app({ fetch = async () => new Response('{}'), token = '', timers = setTimeout } = {}) {
  const elements = new Map();
  const el = () => ({ innerHTML: '', style: {}, inert: true, classList: { add(){}, remove(){}, contains(){ return false; } }, addEventListener(){}, setAttribute(){}, removeAttribute(){}, focus(){} });
  const document = { querySelector(s) { if (!elements.has(s)) elements.set(s, el()); return elements.get(s); }, querySelectorAll(){ return []; }, addEventListener(){}, body: el(), activeElement: null };
  const ctx = vm.createContext({ document, localStorage: { getItem(){ return token; }, removeItem(){}, setItem(){} }, navigator: { userAgent: 'test' }, window: { addEventListener(){} }, location: { search: '', hash: '' }, URLSearchParams, URL, fetch, Response, AbortController, setTimeout: timers, clearTimeout, setInterval(){}, requestAnimationFrame(fn){ fn(); }, console });
  vm.runInContext(source.replace(/render\(\);\s*if \(S.token\) pull\(\);\s*$/, ''), ctx);
  return { ctx, run: (code) => vm.runInContext(code, ctx), elements };
}

test('initial network failure offers retry and code recovery instead of permanent loading', async () => {
  const a = app({ fetch: async () => { throw new Error('offline'); } });
  a.run("S.token='fixture';");
  await a.run('pull()');
  const view = a.elements.get('#app').innerHTML;
  assert.match(view, /Couldn’t connect/);
  assert.match(view, /data-act="pull"/);
  assert.match(view, /data-act="change-code"/);
  assert.doesNotMatch(view, /Loading your protocol/);
});

test('repeated background refreshes share one pending request', async () => {
  let calls = 0, resolve;
  const a = app({ fetch: () => { calls++; return new Promise(r => { resolve = r; }); } });
  a.run("S.token='fixture';");
  const first = a.run('pull(true)'), second = a.run('pull(true)');
  assert.equal(first, second);
  assert.equal(calls, 1);
  resolve(new Response(JSON.stringify({ role:'member' })));
  await first;
  assert.equal(a.run('S.loaded'), true);
});

test('API timeout aborts the request and presents an actionable error', async () => {
  const a = app({ timers: fn => setTimeout(fn, 1), fetch: (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('abort')))) });
  await assert.rejects(a.run("api('/state')"), /Connection timed out/);
});

test('no scheduled items has a clear empty day and a route back to today', () => {
  const a = app();
  a.run("S.role='member'; S.data.compounds=[{ id:'demo', name:'Example compound', schedule:{ days:[] } }]; S.viewDate=new Date(2020,0,1);");
  const view = a.run('protocolView()');
  assert.match(view, /No scheduled doses/);
  assert.match(view, /Back to today/);
  assert.match(view, /As Needed/);
});

test('admin edit is a sibling button, never an interactive control inside the dose button', () => {
  const a = app();
  a.run("S.role='admin';");
  const card = a.run("doseCardHTML({ id:'demo', name:'Example compound', doseMcg:1000, schedule:{days:[0,1,2,3,4,5,6]} }, false)");
  const mainButton = card.slice(card.indexOf('<button'), card.indexOf('</button>'));
  assert.doesNotMatch(mainButton, /data-act="editcomp"/);
  assert.match(card, /<\/button><button class="dose-edit"/);
});

test('missing scan values do not become zero-valued chart points or misleading deltas', () => {
  const a = app();
  a.run("S.role='member'; S.data.scans=[{date:'2026-01-01',weightLb:null},{date:'2026-02-01',weightLb:180}];");
  const view = a.run('progressView()');
  assert.doesNotMatch(view, /2 scans/);
  assert.doesNotMatch(view, /class="delta/);
  for (const expr of ['null', 'undefined', "''", "' '", "'invalid'"]) assert.equal(a.run(`hasNumber(${expr})`), false);
  assert.equal(a.run('hasNumber(0)'), true);
});

test('viewport permits magnification and closed dialogs are inert', () => {
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/);
  assert.match(html, /id="sheet"[^>]*aria-hidden="true"[^>]*inert/);
});

function doseSheet(a, c) {
  a.run(`openSheet = (_html, mount) => mount(testSheet); S.role='admin';`);
  const nodes = new Map();
  const get = s => {
    if (!nodes.has(s)) nodes.set(s, { value:'20', style:{}, innerHTML:'', textContent:'', classList:{toggle(){}}, setAttribute(){}, querySelectorAll(){ return []; }, addEventListener(k, fn){ this[k]=fn; } });
    return nodes.get(s);
  };
  a.ctx.testSheet = { querySelector:get, querySelectorAll(){ return []; } };
  a.ctx.compound = c;
  a.run('openDose(compound)');
  return get;
}

test('clearing a syringe dose cannot submit the previous valid value', async () => {
  let calls = 0;
  const a = app({ fetch:async () => { calls++; return new Response('{}'); } });
  const get = doseSheet(a, {id:'example',name:'Example',doseMcg:1000,mcgPerUnit:50,schedule:{days:[0,1,2,3,4,5,6]}});
  assert.equal(get('#go').disabled, false);
  get('#dv').value=''; get('#dv').input();
  assert.equal(get('#go').disabled, true);
  get('#dv').blur();
  assert.equal(get('#dv').value, '');
  await get('#go').onclick();
  assert.equal(calls, 0);
  get('#dv').value='10'; get('#dv').input();
  assert.equal(get('#go').disabled, false);
});

test('oral dose rejects blank, zero, negative and nonnumeric input', () => {
  const a = app();
  const get = doseSheet(a, {id:'oral',name:'Example oral',doseMcg:10000,category:'Oral',schedule:{days:[0,1,2,3,4,5,6]}});
  for (const value of ['', '0', '-2', 'invalid']) {
    get('#dv').value=value; get('#dv').input();
    assert.equal(get('#go').disabled, true, value);
  }
  get('#dv').value='10'; get('#dv').input();
  assert.equal(get('#go').disabled, false);
});

test('leaving a fractional syringe input preserves its exact entered units', () => {
  const a=app();
  const get=doseSheet(a,{id:'example',name:'Example',doseMcg:1000,mcgPerUnit:50,schedule:{days:[0,1,2,3,4,5,6]}});
  get('#dv').value='16.7'; get('#dv').input(); get('#dv').blur();
  assert.equal(get('#dv').value,'16.7');
  assert.match(get('#go').innerHTML,/16.7 units · 835 mcg/);
});

test('future scheduled days can be reviewed without recording an administration', async () => {
  let calls=0;
  const a=app({fetch:async()=>{calls++;return new Response('{}');}});
  a.run('S.viewDate=new Date(2099,0,1)');
  const get=doseSheet(a,{id:'example',name:'Example',doseMcg:1000,schedule:{days:[0,1,2,3,4,5,6]}});
  assert.equal(get('#go').disabled,true);
  assert.match(get('#go').textContent,/Scheduled for/);
  await get('#go').onclick();
  assert.equal(calls,0);
});

test('stack label strengths remain distinct from take instructions and unsafe source links are omitted', () => {
  const a=app();
  const view=a.run(`stackItemHTML({id:'demo',name:'Example',serving:'Follow prescription',servingLabel:'Prescription directions',ingredientBasis:'Per tablet',ingredients:[{name:'Ingredient',amount:'1 mg'}],sources:[{label:'Bad',url:'javascript:alert(1)'},{label:'Label',url:'https://example.com/label'}]})`);
  assert.match(view,/Prescription directions/);
  assert.match(view,/Per tablet/);
  assert.doesNotMatch(view,/javascript:/);
  assert.match(view,/rel="noopener noreferrer"/);
  assert.doesNotMatch(view,/data-act="togglepill"/);
});

test('unknown reminder tabs recover to PEDs instead of crashing render', () => {
  const a=app();
  a.run("S.token='fixture'; S.loaded=true; S.tab='invalid'; render();");
  assert.equal(a.run('S.tab'),'protocol');
});

test('blood results without a numeric value or reference bounds are not labeled in range', () => {
  const a=app();
  a.run("S.data.labs=[{date:'2026-01-01',markers:[{name:'No bounds',value:20},{name:'Text result',value:'Negative',lo:0,hi:1}]}];");
  const view=a.run('labsView()');
  assert.match(view,/No reference range/);
  assert.match(view,/No numeric result/);
  assert.doesNotMatch(view,/In range|NaN%/);
});

test('a missing visceral-fat measure has no healthy label', () => {
  const a=app();
  a.run("S.data.scans=[{date:'2026-01-01',weightLb:180,vfl:null}];");
  assert.doesNotMatch(a.run('progressView()'),/· healthy/);
});
