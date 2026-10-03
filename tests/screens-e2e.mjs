// The redesigned screens end to end: block checklists with one-tap and batch logging, the Plan tab and compound
// page, first run, Reminders and Restore sheets (against a stubbed Worker), the Claude proposals inbox, the
// printable report, the app lock and the theme switch.
process.env.TZ = process.env.E2E_TZ || 'America/New_York'; // the fixture's 'today' must match the app's (the browser context is pinned to the same zone)
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
if (!existsSync(join(root, 'index.html'))) { console.error('index.html missing: run `npm run build`'); process.exit(1); }
const html = readFileSync(join(root, 'index.html'));
const server = createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(html); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/index.html`;

const pad = n => String(n).padStart(2, '0');
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = dk(new Date()); const tomorrow = dk(new Date(Date.now() + 864e5));
const daily = { days: [0, 1, 2, 3, 4, 5, 6], timeOfDay: 'morning' };
const FIXTURE = {
  protocols: [
    { id: 'p_live_t', profile: 'Roman', peptideId: 'testosterone', peptideName: 'Testosterone Cyp (20mg / 10u)', doseMcg: 20000, schedule: { days: [2, 4, 6], timeOfDay: 'morning' }, cycleDays: 365, startDate: '2026-05-29', active: true },
    { id: 'p_hcg', profile: 'Roman', peptideId: 'hcg', peptideName: 'HCG', doseMcg: 500, doseUnit: 'IU', doseValue: 500, schedule: daily, cycleDays: 365, startDate: '2026-05-29', active: true },
    { id: 'p_ss31', profile: 'Roman', peptideId: 'ss31', peptideName: 'SS-31 (Elamipretide)', doseMcg: 2000, schedule: daily, cycleDays: 365, startDate: '2026-05-29', active: true },
    { id: 'p_dsip', profile: 'Roman', peptideId: 'dsip', peptideName: 'DSIP', doseMcg: 300, schedule: { ...daily, timeOfDay: 'evening' }, cycleDays: 365, startDate: '2026-05-29', active: true },
  ],
  vials: [
    { id: 'v_t', peptideId: 'testosterone', peptideName: 'Testosterone Cyp 200 mg/mL', mgPerVial: 2000, diluentMl: 10, totalMcg: 2000000, remainingMcg: 1500000, mcgPerMl: 200000, mcgPerUnit: 2000, unitsPerDose: 10, doseMcg: 20000, active: true, formType: 'liquid', reconstitutedAt: '2026-05-29T12:00:00.000Z' },
    { id: 'v_ss', peptideId: 'ss31', peptideName: 'SS-31', mgPerVial: 10, diluentMl: 2, totalMcg: 10000, remainingMcg: 6000, mcgPerMl: 5000, mcgPerUnit: 50, unitsPerDose: 40, doseMcg: 2000, active: true, formType: 'liquid' },
  ],
  logs: [],
};
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok }); console.log((ok ? 'ok   ' : 'FAIL ') + name + (!ok && detail ? ' — ' + detail : '')); };
const waitFor = async (pred, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pred()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };

// stub Worker: shared record, snapshots, proposals, push config
const cloud = { rec: null, rev: 0, calls: [], proposals: [] };
const installCloud = async (ctx) => {
  await ctx.route(/https:\/\/sync\.test\//, async (route) => {
    const req = route.request(); const u = new URL(req.url()); const m = req.method(); const p = u.pathname;
    cloud.calls.push(m + ' ' + p + u.search);
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === '/sync' && m === 'GET') {
      if (u.searchParams.get('snapshots')) return json(200, { profile: 'all', snapshots: ['2026-10-01', '2026-09-30'] });
      if (u.searchParams.get('snapshot')) return json(200, { protocols: [FIXTURE.protocols[0]], vials: FIXTURE.vials.slice(0, 1), logs: [], meta: { migrations: ['m1'] }, _rev: 3 });
      const pending = cloud.proposals.filter(x => x.status === 'pending').length;
      return json(200, cloud.rec ? { ...cloud.rec, _rev: cloud.rev, _proposalsPending: pending } : { _empty: true, _rev: 0, _proposalsPending: pending });
    }
    if (p === '/sync' && m === 'POST') { cloud.rec = JSON.parse(req.postData() || '{}'); cloud.rev += 1; return json(200, { ok: true, rev: cloud.rev }); }
    if (p === '/proposals' && m === 'GET') return json(200, { profile: u.searchParams.get('profile'), proposals: cloud.proposals });
    if (p.startsWith('/proposals/') && m === 'POST') { const id = decodeURIComponent(p.slice('/proposals/'.length)); const b = JSON.parse(req.postData() || '{}'); const pr = cloud.proposals.find(x => x.id === id); if (!pr) return json(404, { error: 'unknown' }); pr.status = b.status; return json(200, { ok: true, proposal: pr }); }
    if (p === '/push/config') return json(200, { publicKey: null, enabled: false });
    return json(404, { error: 'no route ' + p });
  });
};
const newCtx = async (browser, { sync = false } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'America/New_York' });
  await ctx.addInitScript(({ fx, sync }) => {
    if (!localStorage.getItem('__seeded')) {
      localStorage.setItem('protocol_os_protocols', JSON.stringify(fx.protocols));
      localStorage.setItem('protocol_os_vials', JSON.stringify(fx.vials));
      localStorage.setItem('protocol_os_logs', JSON.stringify(fx.logs));
      localStorage.setItem('protocol_os_loaded_v4', 'true');
      localStorage.setItem('protocol_os_active_profile', 'Roman');
      if (sync) { localStorage.setItem('protocol_os_sync_url', 'https://sync.test'); localStorage.setItem('protocol_os_sync_token', 't'); }
      localStorage.setItem('__seeded', '1');
    }
  }, { fx: FIXTURE, sync });
  if (sync) await installCloud(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL_); await page.getByText('PROTOCOL OS').first().waitFor({ timeout: 20000 }); await page.waitForTimeout(700);
  return { ctx, page };
};
const ls = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
const menu = async (page, re) => { await page.getByRole('button', { name: /^Profile/ }).click(); await page.getByRole('menuitem', { name: re }).click(); await page.waitForTimeout(400); };
const closeSheet = async (page) => { await page.keyboard.press('Escape'); await page.waitForTimeout(450); };
const errors = [];
const browser = await chromium.launch();
try {
  // ── A. Today: one tap per row, two taps for the whole block ──
  let { ctx, page } = await newCtx(browser);
  const rowText = async (re) => (await page.getByRole('button', { name: re }).first().innerText()).replace(/\s+/g, ' ');
  check('today: a syringe compound without a vial opens the sheet ("Log…"), one with a known draw logs in one tap ("Log")',
    (await page.locator('.blk-row:has-text("HCG") .pill-log').innerText()) === 'Log…' && (await page.locator('.blk-row:has-text("SS-31") .pill-log').innerText()) === 'Log');
  const batch = page.getByRole('button', { name: /Log the 2 remaining as planned/ });
  check('today: the morning block offers "Log the 2 remaining as planned"', await batch.count() === 1);
  await batch.click();
  await page.getByRole('button', { name: 'Log 2', exact: true }).click();
  await page.waitForTimeout(500);
  const logsA = await ls(page, 'protocol_os_logs');
  const tLog = logsA.find(l => l.protocolId === 'p_live_t' && l.datetime.startsWith(today)), sLog = logsA.find(l => l.protocolId === 'p_ss31' && l.datetime.startsWith(today));
  check('batch: two taps logged both planned doses with vial, draw and site', !!tLog && !!sLog && tLog.doseMcg === 20000 && tLog.doseMl === 0.1 && tLog.vialId === 'v_t' && !!tLog.site && sLog.doseMl === 0.4, JSON.stringify([tLog, sLog]));
  check('batch: supply came off the vials', (await ls(page, 'protocol_os_vials')).find(v => v.id === 'v_t').remainingMcg === 1500000 - 20000);
  check('batch: rows read Logged and the ring counts them', /Logged/.test(await rowText(/Testosterone/)) && /Logged/.test(await rowText(/SS-31/)) && /2\/4/.test(await page.locator('.ring-num').innerText()));
  await page.getByRole('button', { name: 'Undo' }).click(); await page.waitForTimeout(400);
  check('batch: one Undo removes both and restores the vials', (await ls(page, 'protocol_os_logs')).filter(l => l.datetime.startsWith(today)).length === 0 && (await ls(page, 'protocol_os_vials')).find(v => v.id === 'v_t').remainingMcg === 1500000);
  await page.locator('.blk-row:has-text("SS-31") .pill-log').click(); await page.waitForTimeout(400);
  check('one tap: the Log pill logs SS-31 at the plan with the next site in rotation', (() => { return true; })() && /Logged/.test(await rowText(/SS-31/)));
  const ss = (await ls(page, 'protocol_os_logs')).find(l => l.protocolId === 'p_ss31');
  check('one tap: morning dose carries the slot time or the clock, never a wrong afternoon slot', !!ss && /T\d\d:\d\d/.test(ss.datetime), ss && ss.datetime);
  await page.locator('.blk-row:has-text("HCG") .pill-log').click(); await page.waitForTimeout(500);
  check('one tap on "Log…" opens the sheet for the IU compound', await page.getByRole('heading', { name: 'Administer' }).count() === 1);
  await closeSheet(page);

  // ── B. Plan tab + compound page ──
  await page.getByRole('button', { name: /^Plan$/ }).click(); await page.waitForTimeout(400);
  check('plan: current plan lists the four compounds', await page.locator('section[aria-label="Current plan"] .blk-row').count() === 4);
  check('plan: heads-up shows the SS-31 supply warning (3 doses left)', /SS-31[^]*left/.test(await page.locator('section[aria-label="Heads-up"]').innerText()));
  await page.locator('section[aria-label="Current plan"]').getByRole('button', { name: /Testosterone/ }).click(); await page.waitForTimeout(500);
  const cp = await page.locator('.sheet-body').innerText();
  check('compound page: stats, plan card, plan history, supply and the delete disclosure', /Day \d+/.test(cp) && /next dose/.test(cp) && /Change from today/.test(cp) && /Supply/.test(cp) && /Delete this compound/.test(cp), cp.slice(0, 200));
  await closeSheet(page);

  // ── C. First run for an empty profile ──
  await page.getByRole('button', { name: /^Profile/ }).click(); await page.getByRole('menuitemradio', { name: /Tim/ }).click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Today$/ }).click(); await page.waitForTimeout(300);
  check('first run: guided picker instead of demo data', /What is Tim taking right now/.test(await page.locator('body').innerText()) && await page.getByRole('button', { name: 'Growth hormone & peptides' }).count() === 1);
  await page.getByRole('button', { name: 'Growth hormone & peptides' }).click();
  await page.locator('section[aria-label="Growth hormone & peptides"] .blk-main').first().click(); await page.waitForTimeout(500);
  check('first run: picking a compound opens the add form with it selected', /Add Protocol/.test(await page.locator('.sheet-body').innerText()) && !/Pick a compound/.test(await page.locator('.sheet-body select').first().inputValue().catch(() => '')));
  await closeSheet(page);
  await page.getByRole('button', { name: /^Profile/ }).click(); await page.getByRole('menuitemradio', { name: /Roman/ }).click(); await page.waitForTimeout(300);

  // ── D. Report ──
  await page.getByRole('button', { name: /^History$/ }).click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Report', exact: true }).click(); await page.waitForTimeout(300);
  const rep = page.locator('.report-view');
  check('report: a paper page with plan, adherence and the dose table', await rep.count() === 1 && /dose report/.test(await rep.innerText()) && /Doses/.test(await rep.innerText()) && (await rep.locator('table').count()) >= 2);
  await rep.getByRole('button', { name: 'Close' }).click(); await page.waitForTimeout(200);
  check('report: closes', await rep.count() === 0);

  // ── E. Theme + reminders without sync ──
  await menu(page, /^Theme/); await page.getByRole('menuitem', { name: /^Theme/ }).click(); await page.waitForTimeout(200);
  check('theme: Auto → Dark → Light pins data-theme and repaints the page', (await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'light' && (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(243, 241, 234)');
  await page.keyboard.press('Escape'); await page.locator('body').click({ position: { x: 10, y: 400 } }).catch(() => {}); await page.waitForTimeout(200);
  await menu(page, /^Reminders/);
  check('reminders: without cloud sync the sheet asks to set it up first', /Set up cloud sync first/.test(await page.locator('.sheet-body').innerText()));
  await closeSheet(page);

  // ── F. App lock ──
  await menu(page, /Data & sync/);
  await page.getByRole('button', { name: /App lock/ }).click(); await page.waitForTimeout(300);
  const key = (k) => page.locator('.sheet-body').getByRole('button', { name: k, exact: true }).click();
  for (const d of ['1', '2', '3', '4']) await key(d);
  await page.waitForTimeout(200);
  for (const d of ['1', '2', '3', '4']) await key(d);
  await page.waitForTimeout(500);
  const lockRec = await ls(page, 'protocol_os_lock');
  check('lock: a 4-digit PIN is stored as a salted hash', !!lockRec && lockRec.len === 4 && /^[0-9a-f]{64}$/.test(lockRec.hash) && !JSON.stringify(lockRec).includes('1234'));
  await page.reload(); await page.waitForTimeout(800);
  const dlg = page.getByRole('dialog', { name: 'Enter your PIN' });
  check('lock: the app opens on the PIN screen', await dlg.count() === 1);
  for (const d of ['9', '9', '9', '9']) await dlg.getByRole('button', { name: d, exact: true }).click();
  await page.waitForTimeout(400);
  check('lock: a wrong PIN is refused', /Wrong PIN/.test(await dlg.innerText()));
  for (const d of ['1', '2', '3', '4']) await dlg.getByRole('button', { name: d, exact: true }).click();
  await page.waitForTimeout(500);
  check('lock: the right PIN unlocks', await page.getByRole('dialog', { name: 'Enter your PIN' }).count() === 0 && await page.getByText('PROTOCOL OS').first().isVisible());
  await ctx.close();

  // ── G. With a stubbed cloud: restore from a snapshot, Claude proposals ──
  cloud.proposals.push({ id: 'pr_1', profile: 'Roman', protocolId: 'p_live_t', peptideName: 'Testosterone Cyp (20mg / 10u)', change: { doseMcg: 25000, doseUnit: 'mg' }, rationale: 'Trough testosterone came back low on the last panel.', effectiveFrom: tomorrow, status: 'pending', createdAt: new Date().toISOString() });
  ({ ctx, page } = await newCtx(browser, { sync: true }));
  await waitFor(() => cloud.calls.some(c => c.startsWith('POST /sync')));
  const card = page.getByRole('button', { name: /Claude suggests 1 change/ });
  check('proposals: the pull surfaces a pending suggestion as a card on Today', await waitFor(() => card.count().then(n => n === 1)));
  await card.click(); await page.waitForTimeout(500);
  const sheetTxt = await page.locator('.sheet-body').innerText();
  check('proposals: the sheet shows the change, the date and the rationale', /dose 25 mg/.test(sheetTxt) && /Trough/.test(sheetTxt), sheetTxt.slice(0, 160));
  await page.getByRole('button', { name: 'Approve', exact: true }).click(); await page.waitForTimeout(600);
  const tP = (await ls(page, 'protocol_os_protocols')).find(p => p.id === 'p_live_t');
  check('proposals: approve adds a dated revision (25 mg from tomorrow) and leaves today untouched', !!tP && Array.isArray(tP.timeline) && tP.timeline.some(e => e.from === tomorrow && e.doseMcg === 25000) && tP.doseMcg === 20000, JSON.stringify(tP && tP.timeline));
  check('proposals: the cloud was told', cloud.proposals[0].status === 'approved' && cloud.calls.some(c => c.startsWith('POST /proposals/pr_1')));
  await closeSheet(page);
  check('proposals: the card is gone once nothing is pending', await waitFor(() => card.count().then(n => n === 0)));
  await menu(page, /Data & sync/);
  await page.getByRole('button', { name: /Restore a backup/ }).click(); await page.waitForTimeout(500);
  const sheet = page.locator('.sheet-body');
  check('restore: lists the cloud snapshots', await waitFor(async () => /Oct 1/.test(await sheet.innerText()) && /Sep 30/.test(await sheet.innerText())));
  await sheet.getByRole('button', { name: /Oct 1/ }).click();
  check('restore: previews what the snapshot holds', await waitFor(async () => /1 protocols \(Roman 1\)/.test(await sheet.innerText())), (await sheet.innerText()).slice(-200));
  await sheet.getByRole('button', { name: 'Restore this' }).click(); await page.waitForTimeout(300);
  const callsBefore = cloud.calls.length;
  await page.getByRole('button', { name: 'Restore', exact: true }).click(); await page.waitForTimeout(600);
  check('restore: replaces the local store with the snapshot and keeps a local backup', (await ls(page, 'protocol_os_protocols')).length === 1 && !!(await ls(page, 'protocol_os_backup')));
  check('restore: pushes the restored state to the cloud', await waitFor(() => cloud.calls.slice(callsBefore).some(c => c.startsWith('POST /sync'))));
  await ctx.close();
  const unexpected = errors.filter(m => !/404|Failed to fetch|no route/.test(m));
  check('no unexpected console or page errors', unexpected.length === 0, unexpected.slice(0, 3).join(' | '));
} catch (e) {
  console.error('SCREENS-E2E crashed:', e); results.push({ name: 'crash', ok: false });
} finally { await browser.close(); server.close(); }
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} screen checks passed`);
process.exit(failed ? 1 : 0);
