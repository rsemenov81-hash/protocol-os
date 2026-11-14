#!/usr/bin/env node
// Opens a real browser window on your insurer's member portal. YOU log in (password and MFA never
// touch this script). While you click through claims, EOBs and benefits it saves what the portal
// sends back: JSON responses, PDFs, downloads and the visible text of each page.
//
//   node .claude/skills/fehb/capture.mjs [startUrl]      -> fehb/capture/
//
// Close the browser window when you are done.
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const out = join('fehb', 'capture');
  // Your installed Chrome looks less like a bot to the portal; fall back to Playwright's Chromium.
  const browser = await chromium.launch({ headless: false, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: false }));
  const context = await browser.newContext({ acceptDownloads: true, viewport: null });
  const rec = record(context, out);
  const page = await context.newPage();
  await page.goto(process.argv[2] || 'https://member.carefirst.com').catch(() => {});
  console.log(`\nLog in, then open: every claim + its EOB (all of this year, and last year if offered),
benefits/coverage, deductible and out-of-pocket totals, prior authorizations, prescriptions.
Use the portal's own "download"/"export" buttons where it has them. Close the window when done.\n`);
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
