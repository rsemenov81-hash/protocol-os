// Cloud-sync scenarios against a stubbed Worker: the Oct 2 audit's P0 (an undone dose returning after a
// profile switch through a stale-write merge), no re-upload on an unchanged launch, offline push retry,
// launch-pull retry, and the second P0 (a skip edited into a dose must count as a dose).
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
if (!existsSync(join(root, 'index.html'))) { console.error('index.html missing: run `npm run build`'); process.exit(1); }

const html = readFileSync(join(root, 'index.html'));
const server = createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(html); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/index.html`;

const today = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
const daily = { days: [0, 1, 2, 3, 4, 5, 6], timeOfDay: 'morning' };
const FIXTURE = {
  protocols: [
    { id: 'p_live_t', profile: 'Roman', peptideId: 'testosterone', peptideName: 'Testosterone Cyp (20mg / 10u)', doseMcg: 20000, schedule: { days: [2, 4, 6], timeOfDay: 'morning' }, cycleDays: 365, startDate: '2026-05-29', active: true },
    { id: 'p_hcg', profile: 'Roman', peptideId: 'hcg', peptideName: 'HCG', doseMcg: 500, doseUnit: 'IU', doseValue: 500, schedule: daily, cycleDays: 365, startDate: '2026-05-29', active: true },
    { id: 'p_dsip', profile: 'Roman', peptideId: 'dsip', peptideName: 'DSIP', doseMcg: 300, schedule: { ...daily, timeOfDay: 'evening' }, cycleDays: 365, startDate: '2026-05-29', active: true },
    { id: 'p_scott', profile: 'Scott', peptideId: 'ss31', peptideName: 'SS-31 (Elamipretide)', doseMcg: 2000, schedule: daily, cycleDays: 365, startDate: '2026-05-29', active: true },
  ],
  vials: [
    { id: 'v_t', peptideId: 'testosterone', peptideName: 'Testosterone Cyp 200 mg/mL', mgPerVial: 2000, diluentMl: 10, totalMcg: 2000000, remainingMcg: 1500000, mcgPerMl: 200000, mcgPerUnit: 2000, unitsPerDose: 10, doseMcg: 20000, active: true, formType: 'liquid', reconstitutedAt: '2026-05-29T12:00:00.000Z' },
  ],
  logs: [],
};

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok }); console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };

// ── stub cloud: one record per ?profile key, _rev + If-Match → 409, like the Worker ──
const cloud = { store: new Map(), calls: [], failNextPost: false, failGets: 0 };
const installCloud = async (ctx) => {
  await ctx.route(/https:\/\/sync\.test\/sync/, async (route) => {
    const req = route.request(); const u = new URL(req.url()); const key = u.searchParams.get('profile') || 'default';
    cloud.calls.push({ m: req.method(), key, ifMatch: req.headers()['if-match'] || null });
    if (req.method() === 'GET') {
      if (cloud.failGets > 0) { cloud.failGets--; return route.abort('connectionfailed'); }
      const rec = cloud.store.get(key);
      const body = rec ? { ...rec.blob, _rev: rec.rev } : { _empty: true, _rev: 0 };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    if (req.method() === 'POST') {
      if (cloud.failNextPost) { cloud.failNextPost = false; return route.abort('connectionfailed'); }
      const rec = cloud.store.get(key); const cur = rec ? rec.rev : 0;
      const im = req.headers()['if-match']; const sent = im ? im.replace(/"/g, '') : null;
      if (rec && String(cur) !== String(sent)) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'stale', currentRev: cur }) });
      const blob = JSON.parse(req.postData() || '{}'); const rev = cur + 1;
      cloud.store.set(key, { rev, blob });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, rev }) });
    }
    return route.fulfill({ status: 405, body: '' });
  });
};
const posts = () => cloud.calls.filter(c => c.m === 'POST').length;
const waitFor = async (pred, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (pred()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
const newCtx = async (browser, seed) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript((fx) => {
    if (!localStorage.getItem('__seeded')) {
      localStorage.setItem('protocol_os_protocols', JSON.stringify(fx.protocols));
      localStorage.setItem('protocol_os_vials', JSON.stringify(fx.vials));
      localStorage.setItem('protocol_os_logs', JSON.stringify(fx.logs));
      localStorage.setItem('protocol_os_loaded_v4', 'true');
      localStorage.setItem('protocol_os_active_profile', 'Roman');
      localStorage.setItem('protocol_os_sync_url', 'https://sync.test');
      localStorage.setItem('protocol_os_sync_token', 'test-token');
      localStorage.setItem('__seeded', '1');
    }
  }, seed);
  await installCloud(ctx);
  return ctx;
};
const openApp = async (page) => { await page.goto(URL_); await page.getByText('PROTOCOL OS').first().waitFor({ timeout: 20000 }); };
const ls = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
const switchProfile = async (page, name) => {
  await page.getByRole('button', { name: /^Profile/ }).click();
  await page.getByRole('menuitemradio', { name: new RegExp(name) }).click();
  await page.waitForTimeout(300);
};
const cloudLogs = () => ((cloud.store.get('all') || {}).blob || {}).logs || [];
const cloudTombs = () => ((((cloud.store.get('all') || {}).blob || {}).meta || {}).tombstones || {}).logs || {};

const browser = await chromium.launch();
const errors = [];
try {
  // ── 1. launch: pull the shared record, push once, and never re-upload an unchanged store ──
  let ctx = await newCtx(browser, FIXTURE); let page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await openApp(page);
  check('launch: one GET of the shared record (?profile=all)', await waitFor(() => cloud.calls.some(c => c.m === 'GET' && c.key === 'all')), JSON.stringify(cloud.calls.slice(0, 3)));
  check('launch: first push lands (migrations changed the store)', await waitFor(() => posts() === 1, 6000), 'posts=' + posts());
  await page.waitForTimeout(2500);
  check('launch: exactly one push, not a storm', posts() === 1, 'posts=' + posts());
  const stamped = cloudLogs().every(l => typeof l.updatedAt === 'string');
  check('push: every entry carries updatedAt', cloudLogs().length > 0 && stamped, 'logs=' + cloudLogs().length);
  const callsBefore = cloud.calls.length;
  await page.reload(); await page.getByText('PROTOCOL OS').first().waitFor({ timeout: 20000 }); await page.waitForTimeout(3500);
  const newCalls = cloud.calls.slice(callsBefore);
  check('relaunch with an unchanged store: pull only, no re-upload', newCalls.filter(c => c.m === 'POST').length === 0 && newCalls.some(c => c.m === 'GET'), JSON.stringify(newCalls));

  // ── 2. the P0: log, undo, stale cloud copy, profile switch, 409 merge → the undone dose stays gone ──
  const p0 = posts();
  await page.getByRole('button', { name: /Testosterone/ }).first().click();
  await page.getByRole('button', { name: /^Log / }).click();
  await page.waitForTimeout(900); // plunger-depress commit animation
  const gate = page.getByRole('button', { name: /Log — flagged for review|Log anyway/ });
  if (await gate.count()) await gate.first().click();
  check('log: push after logging', await waitFor(() => posts() === p0 + 1, 6000), 'posts=' + posts());
  const logged = cloudLogs().find(l => l.protocolId === 'p_live_t' && l.datetime.startsWith(today));
  check('log: the dose is in the cloud', !!logged, logged && logged.id);
  await page.getByRole('button', { name: 'Undo' }).click();
  check('undo: push after undo', await waitFor(() => posts() === p0 + 2, 6000), 'posts=' + posts());
  check('undo: the dose left the cloud and left a dated delete marker', logged && !cloudLogs().some(l => l.id === logged.id) && typeof cloudTombs()[logged.id] === 'string', JSON.stringify(Object.keys(cloudTombs())));
  // another writer: bump the rev and put the stale copy (with the undone dose) back, as a lagging device would
  { const rec = cloud.store.get('all'); const blob = JSON.parse(JSON.stringify(rec.blob)); blob.logs.unshift({ ...logged, updatedAt: undefined }); delete blob.meta.tombstones.logs[logged.id]; cloud.store.set('all', { rev: rec.rev + 1, blob }); }
  await switchProfile(page, 'Scott');
  await page.getByRole('button', { name: /SS-31/ }).first().click();
  await page.getByRole('button', { name: /^Log / }).click();
  await page.waitForTimeout(300);
  const gate2 = page.getByRole('button', { name: /Log — flagged for review|Log anyway/ });
  if (await gate2.count()) await gate2.first().click();
  check('scott: stale write hits 409 and is merged', await waitFor(() => cloud.calls.filter(c => c.m === 'POST').length >= p0 + 4, 8000) && cloud.calls.some(c => c.m === 'GET' && c.key === 'all'), 'posts=' + posts());
  await page.waitForTimeout(800);
  check('P0 fixed: after the merge the undone dose is still gone from the cloud', logged && !cloudLogs().some(l => l.id === logged.id), JSON.stringify(cloudLogs().map(l => l.id)));
  check('scott: his dose is in the cloud', cloudLogs().some(l => l.protocolId === 'p_scott'));
  const local = await ls(page, 'protocol_os_logs');
  check('P0 fixed: the undone dose is gone locally too', !local.some(l => l.id === logged.id));
  await switchProfile(page, 'Roman');
  const tName = await page.getByRole('button', { name: /Testosterone/ }).first().evaluate(el => el.getAttribute('aria-label') || el.innerText);
  check('P0 fixed: the Testosterone tile does not read Logged', tName && !/Logged/.test(tName), tName);

  // ── 3. offline push retries when the network returns ──
  const p3 = posts();
  cloud.failNextPost = true;
  await page.getByRole('button', { name: /DSIP/ }).first().click();
  await page.getByRole('button', { name: /^Log / }).click();
  await page.waitForTimeout(300);
  const gate3 = page.getByRole('button', { name: /Log — flagged for review|Log anyway/ });
  if (await gate3.count()) await gate3.first().click();
  check('offline: the push attempt failed', await waitFor(() => posts() === p3 + 1, 6000));
  await page.waitForTimeout(500);
  check('offline: capsule says sync failed', (await page.locator('.sync-cap').innerText()).toLowerCase().includes('fail'), await page.locator('.sync-cap').innerText());
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  check('online: the queued push is retried and succeeds', await waitFor(() => posts() === p3 + 2 && cloudLogs().some(l => l.protocolId === 'p_dsip'), 8000), 'posts=' + posts());
  await page.waitForTimeout(400);
  check('online: capsule back to synced', /synced/.test(await page.locator('.sync-cap').innerText()), await page.locator('.sync-cap').innerText());

  // ── 4. second P0: a skip edited into a real dose counts as a dose everywhere ──
  await page.getByRole('button', { name: /HCG/ }).first().click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.waitForTimeout(500);
  const hcgSkipped = await page.getByRole('button', { name: /HCG/ }).first().evaluate(el => el.getAttribute('aria-label') || el.innerText);
  check('skip: tile shows the planned 500 IU, not 0', /500\s+IU/.test(hcgSkipped || '') && /Skipped/.test(hcgSkipped || ''), (hcgSkipped || '').replace(/\s+/g, ' '));
  await page.getByRole('button', { name: /HCG/ }).first().click();
  await page.getByRole('heading', { name: 'Edit Dose' }).waitFor();
  await page.locator('input[type="number"]').first().fill('500'); // the dose field comes first now (dose-first sheet)
  check('edit skip: Save button restates 500 IU', /500 IU/.test(await page.getByRole('button', { name: /^Save ·/ }).innerText()), await page.getByRole('button', { name: /^Save ·/ }).innerText());
  await page.getByRole('button', { name: /^Save ·/ }).click();
  await page.waitForTimeout(300);
  const gate4 = page.getByRole('button', { name: /Log — flagged for review|Log anyway/ });
  if (await gate4.count()) await gate4.first().click();
  await page.waitForTimeout(600);
  const hcgLog = (await ls(page, 'protocol_os_logs')).find(l => l.protocolId === 'p_hcg' && l.datetime.startsWith(today));
  check('P0 fixed: the saved dose is no longer flagged skipped', hcgLog && !hcgLog.skipped && hcgLog.doseMcg === 500, JSON.stringify(hcgLog));
  const hcgTile = await page.getByRole('button', { name: /HCG/ }).first().evaluate(el => el.getAttribute('aria-label') || el.innerText);
  check('P0 fixed: the HCG tile reads Logged', /Logged/.test(hcgTile || ''), hcgTile);
  await ctx.close();

  // ── 5. launch-pull retry: a dead-spot launch must not kill sync for the session ──
  cloud.calls.length = 0; cloud.failGets = 1;
  ctx = await newCtx(browser, FIXTURE); page = await ctx.newPage();
  await openApp(page);
  check('launch retry: a second GET follows the failed one within ~3 s', await waitFor(() => cloud.calls.filter(c => c.m === 'GET').length >= 2, 6000), JSON.stringify(cloud.calls));
  check('launch retry: the capsule recovers to synced', await waitFor(async () => true, 100) && /synced/.test(await page.locator('.sync-cap').innerText()), await page.locator('.sync-cap').innerText());
  await ctx.close();

  // the scenario deliberately provokes one 409 and one dropped connection; anything else is a real error
  const unexpected = errors.filter(m => !/409 \(Conflict\)|ERR_CONNECTION_FAILED|Failed to fetch|GET-on-409/.test(m));
  check('no unexpected console or page errors', unexpected.length === 0, unexpected.slice(0, 3).join(' | '));
} catch (e) {
  console.error('SYNC-E2E crashed:', e);
  results.push({ name: 'crash', ok: false });
} finally {
  await browser.close(); server.close();
}
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} sync checks passed`);
process.exit(failed ? 1 : 0);
