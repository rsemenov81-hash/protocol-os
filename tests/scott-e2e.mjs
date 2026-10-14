// Scott's real frontend against synthetic, in-memory records only. Run in CI with
// `npx playwright install --with-deps chromium webkit && npm run e2e:scott`.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const scottRoot = resolve(root, 'scott');
const output = resolve(root, '.playwright/scott');
await mkdir(output, { recursive: true });
const originalHTML = await readFile(resolve(scottRoot, 'index.html'), 'utf8');
const apiDeclaration = "const API = 'https://scott-protocol.rsemenov81.workers.dev';";
assert.ok(originalHTML.includes(apiDeclaration), 'fixture must replace the real API before serving the app');

function freshFixture() {
  const stackItems = ['am', 'pm'].flatMap((stack, s) => Array.from({ length: s ? 7 : 12 }, (_, i) => ({
    id: `fixture-${stack}-${i}`, name: `Fixture ${stack === 'am' ? 'morning' : 'night'} item ${i + 1}`,
    kind: i === 0 ? 'med' : 'supp', stack, active: true, brand: 'Synthetic test product', serving: '1 capsule',
    ingredients: [{ name: 'Fixture ingredient', amount: '10 mg' }],
    purpose: 'Synthetic content for interface testing.', benefits: ['A fixture description.'],
  })));
  return {
    _rev: 1, role: 'member',
    stacks: [{ id: 'am', name: 'Morning stack', time: '10:00' }, { id: 'pm', name: 'Night stack', time: '21:30' }],
    compounds: [
      { id: 'fixture-daily', name: 'Daily tablet', active: true, category: 'Oral', doseMcg: 10000,
        timing: 'Morning', schedule: { days: [0, 1, 2, 3, 4, 5, 6] }, mcgPerUnit: 0 },
      { id: 'fixture-old', name: 'Earlier tablet', active: false, category: 'Oral', doseMcg: 5000 },
      ...stackItems,
      { id: 'fixture-formula', name: '=Fixture formula', active: false, kind: 'supp', stack: 'am' },
    ],
    logs: [
      { id: 'fixture-log-1', compoundId: 'fixture-daily', datetime: '2026-01-02T12:00', doseMcg: 10000, units: null, by: 'member' },
      { id: 'fixture-log-2', compoundId: 'fixture-old', datetime: '2026-01-03T13:00', doseMcg: 5000, units: null, by: 'member' },
    ],
    labs: [
      { date: '2026-02-01', markers: [
        { name: 'Alpha marker', value: 12, unit: 'mg/dL', lo: 1, hi: 10, flag: 'H' },
        { name: 'Beta marker', value: 6, unit: 'mg/dL', lo: 1, hi: 10 },
        { name: 'Qualitative marker', value: '<0.7', unit: 'index', reference: '<0.9' },
      ] },
      { date: '2026-01-01', markers: [{ name: 'Alpha marker', value: 8, unit: 'mg/dL', lo: 1, hi: 10 }] },
    ],
    scans: [
      { id: 'fixture-base', date: '2026-01-01', measuredAt: '2026-01-01T08:00', weightLb: 180, smmLb: 80, pbfPct: null },
      { id: 'fixture-early', date: '2026-02-01', measuredAt: '2026-02-01T08:00', weightLb: 175, smmLb: 81, pbfPct: 18 },
      { id: 'fixture-late', date: '2026-02-01', measuredAt: '2026-02-01T18:00', weightLb: 174, smmLb: 81, pbfPct: 17 },
    ],
  };
}

let state = freshFixture(), failState = false, logWrites = 0, origin;
const apiCalls = [], serverErrors = [];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, origin).pathname;
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    if (pathname.startsWith('/api/')) {
      apiCalls.push(`${req.method} ${pathname}`);
      if (req.headers.authorization !== 'Bearer fixture-member') return json(401, { error: 'Invalid fixture code' });
      if (pathname === '/api/state' && req.method === 'GET') return json(failState ? 503 : 200, failState ? { error: 'Fixture connection failure' } : state);
      if (pathname === '/api/log' && req.method === 'POST') {
        let raw = ''; for await (const chunk of req) raw += chunk;
        const body = JSON.parse(raw);
        if (body.deleteId) state.logs = state.logs.filter(log => log.id !== body.deleteId);
        else if (body.log) state.logs = [{ ...body.log, by: 'member' }, ...state.logs.filter(log => log.id !== body.log.id)];
        else return json(400, { error: 'Missing fixture log' });
        state._rev++; logWrites++;
        return json(200, { ok: true, rev: state._rev });
      }
      if (pathname === '/api/admin') return json(403, { error: 'Administrator access required' });
      return json(404, { error: 'Unknown fixture route' });
    }
    if (!pathname.startsWith('/scott/')) { res.writeHead(404); return res.end(); }
    const filename = resolve(scottRoot, '.' + decodeURIComponent(pathname.slice('/scott'.length)), pathname.endsWith('/') ? 'index.html' : '');
    if (!filename.startsWith(scottRoot + sep)) { res.writeHead(403); return res.end(); }
    const content = filename === resolve(scottRoot, 'index.html')
      ? originalHTML.replace(apiDeclaration, `const API = '${origin}/api';`)
      : await readFile(filename);
    res.writeHead(200, { 'Content-Type': `${mime[extname(filename)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(content);
  } catch (error) {
    if (error.code !== 'ENOENT') serverErrors.push(error.message);
    res.writeHead(error.code === 'ENOENT' ? 404 : 500); res.end();
  }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
origin = `http://127.0.0.1:${server.address().port}`;

const tab = (page, name) => page.getByRole('tab', { name, exact: true });
async function navGeometry(page, label) {
  await page.waitForFunction(() => [...document.querySelectorAll('#navigation .tab')].length === 5);
  const geometry = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    tabs: [...document.querySelectorAll('#navigation .tab')].map(el => {
      const b = el.getBoundingClientRect();
      return { name: el.textContent.trim(), x: b.x, y: b.y, width: b.width, height: b.height,
        visible: b.top >= 0 && b.left >= 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1,
        hit: el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)) };
    }),
  }));
  assert.ok(geometry.overflow <= 1, `${label}: no horizontal overflow (${geometry.overflow}px)`);
  for (const item of geometry.tabs) {
    assert.ok(item.visible && item.hit, `${label}: ${item.name} visible and clickable: ${JSON.stringify(item)}`);
    assert.ok(item.width >= 44 && item.height >= 44, `${label}: ${item.name} has a usable touch target`);
  }
}
async function countIs(page, selector, count) {
  await page.waitForFunction(({ selector, count }) => document.querySelectorAll(selector).length === count, { selector, count });
}
async function textIs(page, selector, expected) {
  await page.waitForFunction(({ selector, expected }) => document.querySelector(selector)?.textContent.trim() === expected, { selector, expected });
}

const results = [];
async function runBrowser(name, engine) {
  state = freshFixture(); failState = false; logWrites = 0; apiCalls.length = 0;
  const browser = await engine.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, timezoneId: 'UTC', locale: 'en-US', reducedMotion: 'reduce',
    serviceWorkers: 'block', acceptDownloads: true });
  // No request can reach production, font CDNs, or any other external service.
  const externalRequests = [];
  await context.route('**/*', route => {
    const requestURL = new URL(route.request().url());
    if (requestURL.origin === origin) return route.continue();
    externalRequests.push(requestURL.hostname);
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const check = (label) => { results.push(`${name}: ${label}`); console.log(`ok ${name}: ${label}`); };
  try {
    await page.goto(`${origin}/scott/`);
    await page.getByLabel('Access code', { exact: true }).fill('fixture-member');
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await tab(page, 'Today').waitFor();
    await page.waitForFunction(() => Boolean(window.ScottInsights));
    assert.equal(await page.locator('[data-act="addcomp"], [data-act="addstack"], [data-act="addlab"], [data-act="addscan"]').count(), 0);
    check('member connects through the real sign-in form');

    // Reproduce the disappearing-navigation sequence, including a tall scroll first.
    await tab(page, 'Stacks').click();
    for (const id of ['am', 'pm']) await page.locator(`details.stk[data-open="stack:${id}"] > summary`).click();
    await page.locator('details.stk[data-open="stack:pm"] details.it').last().scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => scrollY > 0), 'regression must start with a genuinely scrolled page');
    for (const id of ['pm', 'am']) await page.locator(`details.stk[data-open="stack:${id}"] > summary`).click();
    assert.equal(await page.locator('details.stk[open]').count(), 0);
    assert.equal(await page.locator('[data-act="opendose"], [data-act="takepill"]').count(), 0, 'stacks have no daily check-in controls');
    await navGeometry(page, 'after collapsing both scrolled stacks');
    for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }, { width: 740, height: 390 }]) {
      await page.setViewportSize(viewport);
      for (const destination of ['Today', 'Stacks', 'Labs', 'Progress', 'More']) {
        await tab(page, destination).click();
        assert.equal(await tab(page, destination).getAttribute('aria-selected'), 'true');
        await navGeometry(page, `${viewport.width}×${viewport.height} ${destination}`);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await tab(page, 'Stacks').click();
    await tab(page, 'Stacks').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await tab(page, 'Labs').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('End');
    assert.equal(await tab(page, 'More').getAttribute('aria-selected'), 'true');
    check('collapsed stacks, five viewport sizes, primary navigation and keyboard navigation');

    await page.locator('[data-act="tab"][data-tab="history"]').click();
    await countIs(page, '.history-row', 2);
    await page.getByLabel('Search recorded doses').fill('earlier');
    await countIs(page, '.history-row', 1); // deliberately no blur/change event
    assert.match(await page.locator('.history-row').innerText(), /Earlier tablet/);
    assert.equal(await page.getByLabel('Search recorded doses').evaluate(el => el === document.activeElement), true);
    await page.getByLabel('Search recorded doses').fill('no such fixture');
    await countIs(page, '.history-row', 0);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await page.getByLabel('From', { exact: true }).fill('2026-01-02');
    await page.getByLabel('To', { exact: true }).fill('2026-01-02');
    await page.getByLabel('To', { exact: true }).press('Tab');
    await countIs(page, '.history-row', 1);
    assert.match(await page.locator('.history-row').innerText(), /Daily tablet/);
    await page.getByLabel('From', { exact: true }).fill('2026-01-04');
    await page.getByLabel('From', { exact: true }).press('Tab');
    await countIs(page, '.history-row', 0);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await countIs(page, '.history-row', 2);
    check('history live typing, inclusive dates, reversed range and clearing filters');

    await tab(page, 'Labs').click();
    await textIs(page, '#lab-result-count', '3 of 3 results shown');
    await page.locator('[data-act="lab-filter"][data-filter="outside"]').click();
    await textIs(page, '#lab-result-count', '1 of 3 results shown');
    await page.getByLabel('Find a marker').fill('Beta');
    await textIs(page, '#lab-result-count', '0 of 3 results shown');
    assert.equal(await page.locator('#lab-no-results').isVisible(), true);
    await page.getByLabel('Find a marker').fill('Alpha');
    await countIs(page, '.lab-result:not([hidden])', 1);
    await page.locator('[data-act="lab-filter"][data-filter="all"]').click();
    await page.getByLabel('Find a marker').fill('');
    await countIs(page, '.lab-result:not([hidden])', 3);
    assert.match(await page.locator('.lab-result[data-marker="qualitative marker"]').innerText(), /<0\.7/);
    await page.getByLabel('Results to show').selectOption('2026-01-01');
    await textIs(page, '#lab-result-count', '1 of 1 results shown');
    assert.match(await page.locator('.lab-result').innerText(), /8/);
    assert.equal(await page.locator('[data-act="addlab"]').count(), 0);
    check('combined lab range/search filters, panel selection and qualitative results');

    await tab(page, 'Progress').click();
    assert.equal(await page.getByLabel('Measurement', { exact: true }).inputValue(), 'fixture-late');
    assert.deepEqual(await page.locator('#scan-baseline option').evaluateAll(options => options.map(o => o.value)), ['fixture-early', 'fixture-base']);
    assert.match(await page.locator('#scan-comparison').innerText(), /08:00.*18:00/);
    assert.match(await page.locator('.metric-tile').first().innerText(), /−1\.0/);
    await page.getByLabel('Compare with').selectOption('fixture-base');
    assert.match(await page.locator('.metric-tile').first().innerText(), /−6\.0/);
    assert.equal(await page.locator('.metric-tile').nth(2).locator('.delta').count(), 0, 'missing baseline body fat is not treated as zero');
    await page.getByLabel('Measurement', { exact: true }).selectOption('fixture-base');
    assert.equal(await page.locator('#scan-baseline').count(), 0);
    assert.equal(await page.locator('.metric-tile .delta').count(), 0);
    assert.equal(await page.locator('[data-act="addscan"]').count(), 0);
    check('same-day scan selection, earlier-only comparison and missing values');

    await tab(page, 'Today').click();
    const opener = page.getByRole('button', { name: 'Review and log Daily tablet', exact: true });
    await opener.focus();
    await opener.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Protocol details' });
    await dialog.waitFor();
    assert.equal(await page.locator('#navigation').evaluate(el => el.inert), true);
    for (const invalid of ['', '0', '-1', 'invalid', '1e999']) {
      await page.getByLabel('Dose', { exact: true }).fill(invalid);
      assert.equal(await page.locator('#go').isDisabled(), true, `invalid dose ${JSON.stringify(invalid)} cannot submit`);
    }
    await page.getByLabel('Dose', { exact: true }).fill('10');
    assert.equal(await page.locator('#go').isEnabled(), true);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(logWrites, 0, 'cancel never sends a log');
    assert.equal(await page.locator('#navigation').evaluate(el => el.inert), false);
    assert.equal(await opener.evaluate(el => el === document.activeElement), true, 'closing restores focus');
    await opener.click();
    await page.locator('#go').click();
    await page.getByRole('button', { name: 'Review logged dose for Daily tablet', exact: true }).waitFor();
    assert.equal(logWrites, 1);
    assert.equal(state.logs.filter(log => !log.id.startsWith('fixture-log-')).length, 1);
    assert.equal(state.logs.find(log => !log.id.startsWith('fixture-log-')).doseMcg, 10000);
    check('dose validation, cancel, modal focus containment and one successful save');

    // Verify the real browser download event and on-disk file, not merely the toast.
    await tab(page, 'More').click();
    const csvAssertions = {
      protocol: ['"Name","Type","Active"', '"Daily tablet"', '"\'=Fixture formula"', 'one stack reminder'],
      history: ['"Entry ID","Recorded date/time"', '"fixture-log-1"', '"fixture-log-2"', '"10000","mcg"'],
      labs: ['"Collection date","Marker","Value"', '"Alpha marker","12"', '"Qualitative marker","<0.7"'],
      scans: ['"Measurement ID","Date","Measured at"', '"fixture-late"', '"2026-02-01T18:00"', '"Weight","174","lb"'],
    };
    for (const [type, snippets] of Object.entries(csvAssertions)) {
      const downloadEvent = page.waitForEvent('download');
      await page.locator(`[data-act="export-csv"][data-type="${type}"]`).click();
      const download = await downloadEvent;
      assert.match(download.suggestedFilename(), new RegExp(`^scott-${type}-\\d{4}-\\d{2}-\\d{2}\\.csv$`));
      assert.equal(await download.failure(), null);
      const filename = await download.path();
      assert.ok(filename, 'browser persisted the CSV download');
      const bytes = await readFile(filename);
      assert.ok(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), 'CSV has a UTF-8 BOM');
      const content = bytes.toString('utf8');
      assert.notEqual(content.charCodeAt(1), 0xfeff, 'CSV has exactly one BOM');
      for (const snippet of snippets) assert.ok(content.includes(snippet), `${type}: downloaded CSV includes ${snippet}`);
      assert.ok(!content.includes('fixture-member'), 'access code is not exported');
      await writeFile(resolve(output, `${name}-${type}.csv`), bytes);
    }
    check('all four CSV exports create valid on-disk downloads with expected synthetic content');

    await tab(page, 'Today').click();
    await page.getByRole('button', { name: 'Review logged dose for Daily tablet', exact: true }).click();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await opener.waitFor();
    assert.equal(state.logs.length, 2);
    assert.equal(logWrites, 2);
    check('logged dose can be removed and reconciles with the fixture');

    failState = true;
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('button',{name:'Synced, tap to refresh',exact:true}).click();
    await page.getByText('Couldn’t refresh. Showing the last loaded records.',{exact:true}).waitFor();
    await page.setViewportSize({width:320,height:740});
    await navGeometry(page,'loaded data during failed refresh');
    assert.equal(await page.locator('.connection-notice').isVisible(),true);
    failState = false;
    await page.getByRole('button',{name:'Retry',exact:true}).click();
    await countIs(page,'.connection-notice',0);
    check('loaded records remain accessible with mobile refresh-error recovery');
    failState = true;
    await page.reload();
    await page.getByRole('heading', { name: 'Couldn’t connect', exact: true }).waitFor();
    assert.equal(await page.getByRole('tab').count(), 0);
    failState = false;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await tab(page, 'Today').waitFor();
    await navGeometry(page, 'recovered connection');
    assert.equal(await page.locator('#ambient-video').getAttribute('src'), null, 'reduced motion does not load a video');
    assert.equal(await page.locator('#motion-toggle').isDisabled(), true);
    assert.equal(apiCalls.some(call => call.endsWith('/api/admin')), false);
    assert.equal(externalRequests.some(host => host.endsWith('.workers.dev')), false, 'production API was never requested');
    assert.deepEqual(errors, [], 'no uncaught browser errors');
    await tab(page, 'Stacks').click();
    await page.screenshot({ path: resolve(output, `${name}-stacks.png`), fullPage: true });
    check('connection failure/retry, member restrictions and reduced motion');
  } catch (error) {
    await page.screenshot({ path: resolve(output, `${name}-failure.png`), fullPage: true }).catch(() => {});
    await writeFile(resolve(output, `${name}-failure.txt`), `${error.stack}\nBrowser errors: ${JSON.stringify(errors)}\n`);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

try {
  await runBrowser('chromium', chromium);
  await runBrowser('webkit', webkit);
  assert.deepEqual(serverErrors, [], 'fixture server had no unexpected errors');
  console.log(`Scott browser regression suite: ${results.length} scenarios passed across Chromium and WebKit.`);
} finally {
  await new Promise(done => server.close(done));
}
