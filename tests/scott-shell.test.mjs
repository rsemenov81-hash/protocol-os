// Shell lifecycle regressions. Actual viewport geometry is checked separately in browser QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../scott/index.html', import.meta.url), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function shell() {
  const elements = new Map(), listeners = new Map();
  const element = () => {
    const classes = new Set();
    return {
      innerHTML: '', style: {}, inert: false, hidden: false, isConnected: true,
      classList: { add(...xs) { xs.forEach(x => classes.add(x)); }, remove(...xs) { xs.forEach(x => classes.delete(x)); }, contains(x) { return classes.has(x); } },
      addEventListener() {}, setAttribute(k, v) { this[k] = v; }, removeAttribute(k) { delete this[k]; },
      querySelectorAll() { return []; }, focus() { this.focused = true; },
    };
  };
  const document = {
    querySelector(s) { if (!elements.has(s)) elements.set(s, element()); return elements.get(s); },
    querySelectorAll() { return []; },
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); },
    body: element(), activeElement: null,
  };
  const context = vm.createContext({
    document, localStorage: { getItem() { return ''; }, setItem() {}, removeItem() {} },
    navigator: { userAgent: 'test' }, window: { addEventListener() {}, scrollTo() {} },
    location: { search: '', hash: '' }, URLSearchParams, URL, Response, AbortController,
    fetch: async () => new Response('{}'), setTimeout: () => 1, clearTimeout() {}, setInterval() {},
    requestAnimationFrame(fn) { fn(); }, console,
  });
  vm.runInContext(source.replace(/render\(\);\s*if \(S.token\) pull\(\);\s*$/, ''), context);
  return {
    run: code => vm.runInContext(code, context), elements, document,
    click: async (act, tab) => {
      const target = { dataset: { act, tab }, closest(selector) { return selector === '[data-act]' ? this : null; } };
      for (const listener of listeners.get('click') || []) await listener({ target, stopPropagation() {} });
    },
  };
}

test('navigation shell is outside the content container that shrinks when both stacks collapse', () => {
  // This protects the DOM boundary responsible for fixed navigation stability; it is not a pixel test.
  const bodyBeforeScript = html.slice(html.indexOf('<body>'), html.indexOf('<script>'));
  assert.match(bodyBeforeScript, /<div id="app"><\/div>\s*<(?:div|nav)\b[^>]*id="navigation"/);
});

test('all authenticated destinations retain a five-destination navigation shell', () => {
  const a = shell();
  a.run("S.token='fixture'; S.loaded=true; S.role='member';");
  for (const tab of ['protocol', 'supps', 'labs', 'progress', 'more', 'meds', 'library']) {
    a.run(`S.tab=${JSON.stringify(tab)}; render();`);
    const nav = a.elements.get('#navigation');
    assert.ok(nav, `${tab}: navigation shell populated`);
    assert.match(nav.innerHTML, /Today/);
    assert.match(nav.innerHTML, /Stacks/);
    assert.match(nav.innerHTML, /Labs/);
    assert.match(nav.innerHTML, /Progress/);
    assert.match(nav.innerHTML, /More/);
    assert.equal((nav.innerHTML.match(/data-act="tab"/g) || []).length, 5, `${tab}: exactly five primary actions`);
    assert.doesNotMatch(a.elements.get('#app').innerHTML, /class="tabbar"/, `${tab}: nav is not nested in content`);
  }
});

test('collapsed empty and populated stacks keep the shared navigation available', () => {
  const a = shell();
  a.run("S.token='fixture'; S.loaded=true; S.role='member'; S.tab='supps'; S.data.stacks=[{id:'am',name:'Morning stack',time:'10:00'},{id:'pm',name:'Night stack',time:'21:30'}]; S.open.clear(); render();");
  const nav = a.elements.get('#navigation');
  assert.ok(nav?.innerHTML.includes('Stacks'));
  assert.equal(a.run('S.open.size'), 0);
  a.run("S.data.compounds=[{id:'example',name:'Example',stack:'am',kind:'supp',active:true}]; render();");
  assert.equal(a.elements.get('#navigation'), nav, 'the persistent host is preserved');
  assert.match(nav.innerHTML, /Stacks/);
});

test('an unauthenticated or unloaded shell does not leave stale authenticated navigation', () => {
  const a = shell();
  a.run("S.token='fixture'; S.loaded=true; S.role='member'; render(); S.token=''; render();");
  let nav = a.elements.get('#navigation');
  assert.ok(nav && (nav.hidden || !nav.innerHTML.trim()), 'sign-out hides stale navigation');
  a.run("S.token='fixture'; S.loaded=true; render(); S.loaded=false; S.sync='error'; render();");
  nav = a.elements.get('#navigation');
  assert.ok(nav && (nav.hidden || !nav.innerHTML.trim()), 'loading/error hides stale navigation');
});

test('a modal makes the persistent navigation inert and closing restores it', () => {
  const a = shell();
  a.run("S.token='fixture'; S.loaded=true; S.role='member'; render(); openSheet('<p>Example</p>');");
  assert.equal(a.elements.get('#app').inert, true);
  assert.equal(a.elements.get('#navigation').inert, true, 'out-of-content navigation cannot escape modal focus');
  a.run('closeSheet()');
  assert.equal(a.elements.get('#navigation').inert, false);
  assert.equal(a.elements.get('#app').inert, false);
});

test('tab actions remain functional through the persistent shell', async () => {
  const a = shell();
  a.run("S.token='fixture'; S.loaded=true; S.role='member'; render();");
  await a.click('tab', 'supps');
  assert.equal(a.run('S.tab'), 'supps');
  assert.match(a.elements.get('#app').innerHTML, /Morning|stack|Supplement/i);
  assert.match(a.elements.get('#navigation').innerHTML, /Stacks/);
  await a.click('tab', 'progress');
  assert.equal(a.run('S.tab'), 'progress');
  assert.match(a.elements.get('#navigation').innerHTML, /Progress/);
});
