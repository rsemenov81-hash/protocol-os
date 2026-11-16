#!/usr/bin/env node
// Opens a real browser window on your insurer's member portal. YOU log in (password and MFA never
// touch this script). While you click through claims, EOBs and benefits it saves what the portal
// sends back: JSON responses, PDFs, downloads and the visible text of each page.
//
//   node .claude/skills/fehb/capture.mjs [startUrl]      -> fehb/capture/
//
// After you log in, the agent can do the clicking for you through a local control URL the script
// prints (look / click / goto / back / scroll / close / done). It can only navigate: there is no
// way for it to type, and anything that looks like it changes something is refused.
//
// Close the browser window when you are done.
import { createHash, randomBytes } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Word-bounded so /authorizations (prior auths, which we want) is not mistaken for /auth.
const AUTH_URL = /\b(log-?in|sign-?in|oauth2?|auth|authn|authenticate|token|sso|saml|password|mfa|otp)\b/i;
const AUTH_BODY = /access_token|id_token|refresh_token|"password"/i;

export function record(context, out) {
  for (const d of ['json', 'docs', 'text']) mkdirSync(join(out, d), { recursive: true });
  let n = 0;
  const seen = new Set();
  const save = (dir, ext, body, url) => {
    const name = `${String(++n).padStart(4, '0')}.${ext}`;
    writeFileSync(join(out, dir, name), body);
    appendFileSync(join(out, 'index.jsonl'), JSON.stringify({ file: `${dir}/${name}`, url }) + '\n');
    console.log(`saved ${dir}/${name}  ${url.slice(0, 100)}`);
  };

  context.on('response', async (res) => {
    try {
      const url = res.url();
      const type = res.headers()['content-type'] || '';
      if (!res.ok() || AUTH_URL.test(new URL(url).pathname)) return; // never keep login traffic
      if (type.includes('json')) {
        const body = await res.text();
        if (body.length > 2 && !AUTH_BODY.test(body)) save('json', 'json', body, url);
      } else if (type.includes('pdf')) {
        save('docs', 'pdf', await res.body(), url);
      }
    } catch {} // body gone (redirect, closed tab): nothing to keep
  });

  const watch = (page) => {
    page.on('download', async (dl) => {
      const name = `${String(++n).padStart(4, '0')}-${dl.suggestedFilename()}`;
      await dl.saveAs(join(out, 'docs', name)).catch(() => {});
      console.log(`saved docs/${name}`);
    });
  };
  context.pages().forEach(watch);
  context.on('page', watch);

  // Single-page apps never "navigate", so poll: keep each new screenful of text once.
  const snap = async () => {
    for (const page of context.pages()) {
      try {
        if (AUTH_URL.test(new URL(page.url()).pathname)) continue;
        const text = await page.evaluate(() => document.body?.innerText || '');
        const hash = createHash('sha1').update(text).digest('hex');
        if (text.length < 200 || seen.has(hash)) continue;
        seen.add(hash);
        save('text', 'txt', `URL: ${page.url()}\n\n${text}`, page.url());
      } catch {} // page mid-navigation
    }
  };
  const timer = setInterval(snap, 3000);
  return { snap, stop: () => clearInterval(timer) };
}

const UNSAFE = /log ?out|sign ?out|delete|remove|cancel|submit|pay\b|send|save|update|enroll|change|edit/i;
const site = (u) => new URL(u).hostname.split('.').slice(-2).join('.');

// What the agent sees: where it is, what it can click (numbered), and the page text.
async function look(page) {
  if (AUTH_URL.test(new URL(page.url()).pathname)) return `URL: ${page.url()}\nLogin page: waiting for the user.`;
  // ponytail: top document only. If the portal puts claims in an iframe, walk page.frames() here.
  const { items, text } = await page.evaluate(() => {
    document.querySelectorAll('[data-fehb-n]').forEach((e) => e.removeAttribute('data-fehb-n'));
    const els = [...document.querySelectorAll('a[href], button, summary, [role=button], [role=tab], [role=link], [role=menuitem]')]
      .filter((e) => e.getClientRects().length);
    return {
      items: els.map((e, i) => {
        e.setAttribute('data-fehb-n', i);
        return (e.innerText || e.getAttribute('aria-label') || e.title || '').trim().replace(/\s+/g, ' ').slice(0, 80);
      }),
      text: document.body?.innerText || '',
    };
  });
  const list = items.map((t, i) => (t ? `[${i}] ${t}` : '')).filter(Boolean).slice(0, 250).join('\n');
  return `URL: ${page.url()}\nCLICKABLE:\n${list}\nTEXT:\n${text.slice(0, 8000)}`;
}

export async function control(context, onDone = () => {}) {
  const token = randomBytes(8).toString('hex'); // so a web page in another tab cannot drive this
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const [, tok, cmd] = u.pathname.split('/');
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    if (tok !== token) return res.writeHead(403).end('no');
    try {
      const page = context.pages().at(-1); // newest tab: EOBs often open in a new one
      if (cmd === 'done') { res.end('closing'); return onDone(); }
      if (cmd === 'click') {
        const el = page.locator(`[data-fehb-n="${Number(u.searchParams.get('n'))}"]`);
        const label = `${await el.innerText({ timeout: 3000 }).catch(() => '')} ${(await el.getAttribute('aria-label').catch(() => '')) || ''}`.trim();
        if (UNSAFE.test(label)) return res.writeHead(400).end(`refused: "${label}" looks like it changes something. Ask the user to do it.`);
        await el.click({ timeout: 5000 });
      } else if (cmd === 'goto') {
        const to = new URL(u.searchParams.get('url'), page.url());
        if (site(to) !== site(page.url())) return res.writeHead(400).end('refused: different site');
        await page.goto(to.href);
      } else if (cmd === 'back') await page.goBack();
      else if (cmd === 'scroll') await page.mouse.wheel(0, 3000);
      else if (cmd === 'close') { if (context.pages().length > 1) await page.close(); }
      else if (cmd !== 'look') return res.writeHead(404).end('look | click?n= | goto?url= | back | scroll | close | done');
      await context.pages().at(-1).waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      res.end(await look(context.pages().at(-1)));
    } catch (e) {
      res.writeHead(500).end(String(e.message || e));
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}/${token}` };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const out = join('fehb', 'capture');
  // Your installed Chrome looks less like a bot to the portal; fall back to Playwright's Chromium.
  const browser = await chromium.launch({ headless: false, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: false }));
  const context = await browser.newContext({ acceptDownloads: true, viewport: null });
  const rec = record(context, out);
  const ctl = await control(context, () => browser.close());
  const page = await context.newPage();
  await page.goto(process.argv[2] || 'https://member.carefirst.com').catch(() => {});
  console.log(`\nLog in, then open: every claim + its EOB (all of this year, and last year if offered),
benefits/coverage, deductible and out-of-pocket totals, prior authorizations, prescriptions.
Use the portal's own "download"/"export" buttons where it has them. Close the window when done.

Or let the agent click for you. CONTROL ${ctl.url}\n`);
  await new Promise((done) => {
    browser.on('disconnected', done);
    context.on('close', done);
    page.on('close', () => context.pages().length || done());
  });
  rec.stop();
  await browser.close().catch(() => {});
  console.log(`\nCapture is in ${out}/ (gitignored). Now run /fehb in Claude Code.`);
  process.exit(0);
}
