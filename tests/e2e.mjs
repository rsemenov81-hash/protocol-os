#!/usr/bin/env node
// Headless walkthrough of the BUILT Protocol OS (index.html) against a fixture shaped like Roman's
// live blob. One PASS/FAIL line per check; exit 1 when any check failed, 2 when the run itself crashed.
//
//   node tests/e2e.mjs          (or `npm run e2e`)
//   E2E_OUT=<dir>               screenshots + the downloaded CSV (default: .playwright/ in the repo, git-ignored)
//   E2E_TZ=<Area/City>          time zone for this process AND the browser (default America/New_York)
//   E2E_HEADED=1                watch it run;  E2E_SLOWMO=250 slows every action (ms)
//   E2E_VERBOSE=1               print the detail string on PASS lines too
//
// Needs a built index.html (`npm run build`). Nothing else: the script serves the repo itself on a
// free port and resolves Playwright from node_modules or the machine-wide install.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './helpers/static-server.mjs';
import { loadPlaywright } from './helpers/playwright.mjs';
import { romanFixture, seedLocalStorage, seedArgs, todayDk, addDays } from './helpers/fixture.mjs';

const TZ = process.env.E2E_TZ || 'America/New_York';
process.env.TZ = TZ;   // before any Date math: the fixture's "today" has to be the browser's "today"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'index.html');
const OUT = process.env.E2E_OUT ? resolve(process.env.E2E_OUT) : join(ROOT, '.playwright');
const VERBOSE = !!process.env.E2E_VERBOSE;

if (!existsSync(INDEX)) {
  console.error(`index.html not found at ${INDEX}\nThe e2e runs against the BUILT app. Run \`npm run build\` first (then \`npm run check\` confirms it is current).`);
  process.exit(2);
}

const today = todayDk();
const tomorrow = addDays(today, 1);
const yesterday = addDays(today, -1);
const FIXTURE = romanFixture(today);

const results = [];
function check(name, ok, detail) {
  ok = !!ok;
  results.push({ name, ok, detail });
  const extra = detail && (!ok || VERBOSE) ? `  — ${detail}` : '';
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra}`);
  return ok;
}
const flat = (s) => String(s).replace(/\n/g, ' | ');
const dayNum = (dk) => String(new Date(dk + 'T12:00:00').getDate());
const dow = (dk) => new Date(dk + 'T12:00:00').getDay();
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthIndex = (label) => { const m = /^(\w+) (\d{4})$/.exec(label.trim()); const i = m ? MONTHS.indexOf(m[1]) : -1; return i < 0 ? NaN : +m[2] * 12 + i; };
const monthIndexOfDk = (dk) => +dk.slice(0, 4) * 12 + (+dk.slice(5, 7) - 1);

mkdirSync(OUT, { recursive: true });
const shot = (page, name, opts = {}) => page.screenshot({ path: join(OUT, name), ...opts }).catch(() => {});

let browser, server, page;
const t0 = Date.now();
try {
  const { chromium } = await loadPlaywright();
  server = await startStaticServer(ROOT);
  const URL = `${server.url}/index.html`;
  console.log(`e2e: serving ${ROOT} at ${server.url} · today=${today} (${TZ}) · output → ${OUT}`);

  browser = await chromium.launch({ headless: !process.env.E2E_HEADED, slowMo: Number(process.env.E2E_SLOWMO) || 0 });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true,
    serviceWorkers: 'block', timezoneId: TZ, locale: 'en-US',
  });
  await ctx.addInitScript(seedLocalStorage, seedArgs(FIXTURE));
  page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(URL);
  await page.getByText('PROTOCOL OS').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), k);

  // Header calendar: open it, walk to the target month by reading the heading, pick the day.
  const calendar = () => page.locator('[role="dialog"][aria-label="Choose date"]');
  async function openCalendar() { await page.getByRole('button', { name: 'Open calendar' }).click(); await calendar().waitFor(); return calendar(); }
  async function pickDate(dk) {
    const dlg = await openCalendar();
    const heading = dlg.getByRole('button', { name: 'Previous month' }).locator('xpath=following-sibling::*[1]');
    const want = monthIndexOfDk(dk);
    for (let i = 0; i < 48; i++) {
      const cur = monthIndex(await heading.innerText());
      if (Number.isNaN(cur)) throw new Error(`calendar heading not understood: "${await heading.innerText()}"`);
      if (cur === want) break;
      await dlg.getByRole('button', { name: cur > want ? 'Previous month' : 'Next month' }).click();
    }
    await dlg.getByRole('button', { name: dayNum(dk), exact: true }).first().click();
    await page.waitForTimeout(500);
  }
  // Since the src/ build the Administer sheet keeps the Plan card behind a <details class="plan-dis">
  // disclosure that is CLOSED on a today sheet (open only for plan-only future days). The checks below
  // assert the same Plan-card content as before; this only expands the disclosure when it is collapsed.
  async function openPlan() {
    const dis = page.locator('.sheet-body details.plan-dis');
    if (await dis.count() && !(await dis.first().evaluate((el) => el.open))) {
      await dis.first().locator('summary').click();
      await page.waitForTimeout(250);
    }
  }

  // 1. migration applied locally (no sync configured)
  let logs = await ls('protocol_os_logs');
  let protos = await ls('protocol_os_protocols');
  const meta = await ls('protocol_os_meta');
  const anavarLogs = logs.filter((l) => l.protocolId === 'p_m1_anavar');
  check('migration: 38 Anavar entries Aug 22–Sep 28', anavarLogs.length === 38, String(anavarLogs.length));
  const t = protos.find((p) => p.id === 'p_live_t');
  check('migration: testosterone has daily revision from 2026-08-22', t && t.timeline && t.timeline.some((e) => e.id === 'tl_m1_test_daily' && e.from === '2026-08-22'));
  check('migration: base mirrors daily 20 mg', t && t.schedule.days.length === 7 && t.doseUnit === 'mg' && t.doseValue === 20);
  const tBack = logs.filter((l) => l.protocolId === 'p_live_t' && l.backfilled);
  check('migration: testosterone back-filled through yesterday, not today',
    tBack.length > 30 && !logs.some((l) => l.protocolId === 'p_live_t' && l.datetime.startsWith(today)) && !tBack.some((l) => l.datetime.startsWith(yesterday)),
    String(tBack.length));
  check('migration: marker stored', meta && meta.migrations && meta.migrations.length === 1);
  const an = protos.find((p) => p.id === 'p_m1_anavar');
  check('migration: Anavar protocol finished (endDate, inactive)', an && an.endDate === '2026-09-28' && an.active === false);

  // 2. today view: testosterone card present, says Daily; Anavar absent
  const tCard = page.getByRole('button', { name: /Testosterone Cyp/ }).first();
  check('today: testosterone card rendered', await tCard.count() === 1);
  const tCardText = await tCard.innerText();
  check('today: card shows Daily + 10u', /Daily/.test(tCardText) && /10\s*u/.test(tCardText.replace(/\n/g, ' ')), flat(tCardText));
  check('today: Anavar not on today', await page.getByRole('button', { name: /Anavar/ }).count() === 0);
  await shot(page, 'shot-1-today.png', { fullPage: true });

  // 3. tile sheet → Plan card
  await tCard.click();
  await openPlan();
  await page.getByText(/Plan · today/).waitFor();
  const planText = await page.locator('.sheet-body').innerText();
  check('sheet: Plan card shows Daily · 20 mg · since Aug 22', /Daily · 20 mg/.test(planText) && /since Aug 22/.test(planText), planText.split('\n').slice(0, 8).join(' | '));
  check('sheet: Finish cycle + Change from today buttons', await page.getByRole('button', { name: /Finish cycle/ }).count() === 1 && await page.getByRole('button', { name: /Change from today/ }).count() === 1);
  check('sheet: The Draw visible (concentration known)', await page.getByText('The Draw').count() === 1);
  await shot(page, 'shot-2-sheet.png');

  // 4. Finish cycle → confirm → endDate=today; reopen → Resume
  await page.getByRole('button', { name: /Finish cycle/ }).click();
  await page.getByRole('button', { name: 'Finish cycle', exact: true }).last().click();
  await page.waitForTimeout(500);
  protos = await ls('protocol_os_protocols');
  check('finish: endDate = today, still active today', protos.find((p) => p.id === 'p_live_t').endDate === today && protos.find((p) => p.id === 'p_live_t').active === true);
  await tCard.click();
  await openPlan();
  await page.getByRole('button', { name: /Resume/ }).waitFor();
  check('finish: sheet now offers Resume and shows ends today', /ends/.test(await page.locator('.sheet-body').innerText()));
  await page.getByRole('button', { name: /Resume/ }).click();
  await page.waitForTimeout(500);
  protos = await ls('protocol_os_protocols');
  check('resume: endDate cleared', !protos.find((p) => p.id === 'p_live_t').endDate);

  // 5. Change from tomorrow → MWF: timeline gains a future entry, base stays daily, card hints
  await tCard.click();
  await openPlan();
  await page.getByRole('button', { name: /Change from today/ }).click();
  await page.getByText('Edit Protocol').waitFor();
  check('edit: plan history lists Original + Since Aug 22', await page.getByText('Original', { exact: true }).count() === 1 && await page.getByText(/Since Aug 22/).count() >= 1);
  await page.getByRole('button', { name: 'Tomorrow' }).click();
  await page.getByRole('button', { name: 'MWF', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(600);
  protos = await ls('protocol_os_protocols');
  const t2 = protos.find((p) => p.id === 'p_live_t');
  check('edit: future revision saved (3 entries), base still daily today',
    t2.timeline.length === 3 && t2.timeline[2].from === tomorrow && t2.schedule.days.length === 7,
    JSON.stringify(t2.timeline.map((e) => [e.from, e.schedule.days.join('')])));
  check('edit: card footer hints the upcoming plan', /MWF from/.test(await tCard.innerText()), flat(await tCard.innerText()));

  // 6. future day → plan-only sheet
  const tomorrowNum = dayNum(tomorrow);
  const weekBtns = page.locator('.week .day');
  const nWeek = await weekBtns.count();
  let clicked = false;
  for (let i = 0; i < nWeek; i++) {
    const txt = (await weekBtns.nth(i).locator('.dnum').innerText()).trim();
    const isSel = await weekBtns.nth(i).evaluate((el) => el.classList.contains('sel'));
    if (txt === tomorrowNum && !isSel) { await weekBtns.nth(i).click(); clicked = true; break; }
  }
  if (!clicked) await pickDate(tomorrow);   // tomorrow is in next week — use the calendar
  await page.waitForTimeout(500);
  const tomorrowDue = t2.timeline[2].schedule.days.includes(dow(tomorrow));
  const tCardTomorrow = page.getByRole('button', { name: /Testosterone Cyp/ }).first();
  check('future: testosterone shown tomorrow only if MWF says so', (await tCardTomorrow.count() === 1) === tomorrowDue, 'due=' + tomorrowDue);
  // rows of a future day carry the 'fut' disc (the old grid used .card-future); the row body opens the plan-only sheet
  const anyCard = page.locator('.blk-row:has(.blk-disc.fut) .blk-main').first();
  check('future: cards render in future state', await page.locator('.blk-disc.fut').count() >= 1);
  await anyCard.click();
  await page.getByText(/Scheduled for/).waitFor();
  check('future: plan-only sheet (no Log button, Close only)', await page.getByRole('button', { name: /^Log/ }).count() === 0 && await page.getByRole('button', { name: 'Close', exact: true }).count() >= 1);
  await shot(page, 'shot-3-future-sheet.png');
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.waitForTimeout(400);

  // 7. past day inside the Anavar cycle → Anavar visible + logged
  await pickDate('2026-09-10');
  const anCard = page.getByRole('button', { name: /Anavar/ }).first();
  check('past: Anavar card on Sep 10, logged 50 mg',
    await anCard.count() === 1 && /Logged/.test(await anCard.innerText()) && /50\s*mg/.test((await anCard.innerText()).replace(/\n/g, ' ')),
    (await anCard.count()) ? flat(await anCard.innerText()) : 'missing');
  const tPast = page.getByRole('button', { name: /Testosterone Cyp/ }).first();
  check('past: testosterone on Sep 10 shows back-filled daily log', await tPast.count() === 1 && /Logged/.test(await tPast.innerText()));
  await shot(page, 'shot-4-sep10.png', { fullPage: true });
  // Aug 21 (before the revision): testosterone follows the ORIGINAL Tue/Thu/Sat plan → Friday not shown
  await pickDate('2026-08-21');
  check('past: Aug 21 (Fri) has no testosterone card (original Tue/Thu/Sat plan)', await page.getByRole('button', { name: /Testosterone Cyp/ }).count() === 0);
  check('past: Aug 21 has no Anavar (starts Aug 22)', await page.getByRole('button', { name: /Anavar/ }).count() === 0);
  await (await openCalendar()).getByRole('button', { name: 'Today', exact: true }).click();
  await page.waitForTimeout(400);

  // 8. Add protocol with Every other day
  await page.getByRole('button', { name: 'Add protocol' }).click();
  await page.getByText(/Add to Roman/).waitFor();
  await page.locator('.sheet-body select').first().selectOption('npp');
  await page.getByRole('button', { name: 'Every other day' }).click();
  check('add: EOD preview strip renders 14 days', await page.locator('[aria-label="Dose days over the next 14 days"] > div').count() === 14);
  check('add: oil vial labels (no BAC)', await page.getByText('Vial volume (mL)').count() === 1 && await page.getByText(/pre-mixed oil/).count() >= 1);
  await page.getByRole('button', { name: 'Add Protocol', exact: true }).click();
  await page.waitForTimeout(400);
  const gateBtn = page.getByRole('button', { name: /Log — flagged for review|Log anyway/ });
  if (await gateBtn.count()) await gateBtn.click();
  await page.waitForTimeout(600);
  protos = await ls('protocol_os_protocols');
  const npp = protos.find((p) => p.peptideId === 'npp');
  check('add: NPP saved as every-other-day with anchor + mirrored legacy days',
    npp && npp.schedule.every === 2 && npp.schedule.anchor === today && Array.isArray(npp.schedule.days) && npp.schedule.days.length === 4,
    npp && JSON.stringify(npp.schedule));
  const nppCard = page.getByRole('button', { name: /NPP/ }).first();
  check('add: NPP card on today reads EOD', await nppCard.count() === 1 && /EOD/.test(await nppCard.innerText()), (await nppCard.count()) ? flat(await nppCard.innerText()) : 'missing');

  // 9. History tab
  await page.getByRole('button', { name: 'History' }).click();
  await page.getByText('Logged data').waitFor();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.waitForTimeout(300);
  const hist = await page.locator('body').innerText();
  check('history: Anavar entries listed', /Anavar/.test(hist));
  const compSel = page.locator('select[aria-label="Compound filter"]');
  const opts = await compSel.locator('option').allInnerTexts();
  check('history: compound filter lists Anavar + Testosterone', opts.some((o) => /Anavar/.test(o)) && opts.some((o) => /Testosterone/.test(o)), opts.join(' / '));
  await compSel.selectOption({ label: opts.find((o) => /Anavar/.test(o)) });
  await page.waitForTimeout(300);
  check('history: filtered stat tile shows 38 doses', /38/.test(await page.locator('.lg').first().innerText()));
  check('history: bulk delete offered for a filtered compound', await page.getByRole('button', { name: /Delete these 38 entries/ }).count() === 1);
  await shot(page, 'shot-5-history.png', { fullPage: true });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /CSV · 38/ }).click()]);
  const csvPath = join(OUT, 'history.csv');
  await dl.saveAs(csvPath);
  const csv = readFileSync(csvPath, 'utf8');
  check('history: CSV download has header + 38 rows', csv.split('\n').length === 39 && /^\uFEFFDate,Time,Compound/.test(csv), csv.split('\n')[1]);
  // row sheet → edit via Protocol tab hand-off
  await page.locator('.card button').first().click();
  await page.getByRole('button', { name: /Edit dose \/ time/ }).waitFor();
  await page.getByRole('button', { name: /Edit dose \/ time/ }).click();
  await page.getByText('Edit Dose').waitFor({ timeout: 5000 });
  check('history → protocol hand-off opens Edit Dose on that day', true);
  await shot(page, 'shot-6-edit-dose.png');
  // back-date sheet preview
  await page.getByRole('button', { name: 'Close' }).first().click().catch(() => {});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'History' }).click();
  await page.getByRole('button', { name: 'Add back-dated entries' }).click();
  await page.getByText('Back-dated entries').first().waitFor();
  await page.locator('.sheet-body select').first().selectOption('p_hcg');
  await page.waitForTimeout(200);
  const bdText = await page.locator('.sheet-body').innerText();
  check('backdate: preview counts scheduled days for HCG', /Will add \d+ entr/.test(bdText), bdText.split('\n').find((l) => /Will add/.test(l)));
  await page.getByRole('button', { name: /^Add \d+ entr/ }).click();
  await page.waitForTimeout(500);
  logs = await ls('protocol_os_logs');
  check('backdate: HCG entries written with IU tag', logs.some((l) => l.protocolId === 'p_hcg' && l.backfilled && l.doseUnit === 'IU'));

  check('no console/page errors', errors.length === 0, errors.slice(0, 5).join(' || '));
} catch (err) {
  console.error('\nE2E crashed:', err && err.stack || err);
  if (page) await shot(page, 'crash.png', { fullPage: true });
  process.exitCode = 2;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await server.close().catch(() => {});
}

const failed = results.filter((r) => !r.ok);
const secs = ((Date.now() - t0) / 1000).toFixed(1);
if (process.exitCode === 2) {
  console.log(`\ne2e: CRASHED after ${results.length} check(s) (${results.length - failed.length} passed, ${failed.length} failed) in ${secs}s`);
} else if (failed.length) {
  console.log(`\ne2e: ${failed.length}/${results.length} CHECKS FAILED in ${secs}s:\n` + failed.map((f) => `  - ${f.name}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`\ne2e: all ${results.length} checks passed in ${secs}s`);
  process.exitCode = 0;
}
process.exit(process.exitCode);
