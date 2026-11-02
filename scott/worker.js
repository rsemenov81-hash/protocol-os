// scott-protocol — Cloudflare Worker + KV behind the Scott Protocol app (scott/index.html).
//
// The API the app calls (the Kris contract, plus supplements/meds and push reminders):
//   GET  /state            → { role, compounds, logs, labs, scans, _rev }
//   POST /admin            → { baseRev, compounds?, labs?, scans? }   admin only; 409 when baseRev is stale
//   POST /log              → { log: {id, compoundId, datetime, doseMcg, units} } upserts a dose
//                            { deleteId } removes one (Scott can only remove his own)
//   GET  /push/config      → { publicKey }   the VAPID key the browser subscribes with
//   POST /push/subscribe   → { subscription, times: {am, pm}, nudge, tz }   adds or updates this device
//   POST /push/unsubscribe → { endpoint }
//   POST /push/test        → { endpoint }   sends one test notification to that device
//   GET  /health           → { ok, version }   (no code needed)
//
// Compounds carry a `kind`: 'inject' (or missing) for the syringe doses, 'supp' for supplements and
// 'med' for medications. Supplements and meds are logged by a tap ("taken"): no dose number, no gate.
//
// Supplement stacks: compounds with `stack: 'am' | 'pm'` belong to the morning or night stack (see STACKS).
// They are not logged; each stack gets one "time to take it" reminder a day at its fixed time.
//
// Reminders: a Cron Trigger (*/15 * * * *) runs `scheduled`. For every subscribed device, when its
// morning or evening time (or time + nudge) falls in the last 15 minutes of its own time zone, it sends
// one push listing that block's items still unlogged today. Nothing due, nothing sent. Stack reminders
// go out the same way at each stack's time.
// The VAPID keypair is generated on first use and kept in KV, so there are no push secrets to paste.
//
// Two access codes, both stored as worker secrets (never in this file):
//   ADMIN_CODE  — Roman: edits the protocol, supplements, meds, blood panels and InBody scans; logs or removes anything.
//   MEMBER_CODE — Scott: logs his own doses, supplements and meds.
// The dose gate is enforced here too, not only in the app: an injection at 5× or more of the set dose is refused.
//
// KV binding: SCOTT_KV. Keys: "state" (the whole record), "vapid" (push keypair), "subs" (devices),
// "sent:<device>:<date>:<block | block:n | stack-am | stack-pm>" (2-day markers so a reminder goes out once).

const VERSION = '1.1.0';
const STATE_KEY = 'state';
const ALLOWED_ORIGINS = ['https://rsemenov81-hash.github.io'];
const MAX_LOGS = 5000;
const TZ = 'America/New_York';
const WINDOW_SEC = 15 * 60;
const VAPID_SUBJECT = 'https://rsemenov81-hash.github.io/protocol-os/scott/';
const BLOCK_TITLE = { am: 'Morning protocol', pm: 'Evening protocol' };
// Scott's two supplement stacks: one reminder each at a fixed time (the device's time zone), no logging.
// Items join a stack through their `stack` field ('am' | 'pm'); Roman loads them with the app's import link.
const STACKS = [{ id: 'am', name: 'Morning stack', time: '10:00' }, { id: 'pm', name: 'Night stack', time: '21:30' }];
const MAX_SUBS = 20;

// Scott's protocol as of 2026-10-13. Days: 0 = Sun … 6 = Sat. Doses are in mcg (mg × 1000) except HCG, which is in IU.
// vialAmount + bacMl give the syringe-unit strength the app draws with (U-100: 100 units = 1 mL); the oils use
// the vial's total mg in its mL. Supplements and meds start empty: Roman adds them on their tabs.
const SEED = {
  _rev: 1,
  compounds: [
    {
      id: 'c_test', name: 'Testosterone Cypionate', category: 'Hormone', timing: 'Morning', active: true,
      // an oil, not reconstituted: a 10 mL vial at 250 mg/mL (2,500 mg) = 2.5 mg per unit
      unit: 'mcg', doseMcg: 75000, vialAmount: 2500, bacMl: 10, mcgPerUnit: 2500, ingredients: [],
      schedule: { days: [1, 5] },
      purpose: 'The primary male hormone in a long-acting oil. Taken Monday and Friday. At 250 mg/mL, 0.3 mL = 30 units = 75 mg, so 150 mg a week. A 10 mL vial lasts about 16 weeks.',
      benefits: ['Energy and drive', 'Keeps muscle', 'Mood and recovery'],
    },
    {
      id: 'c_nand', name: 'Nandrolone Decanoate', category: 'Hormone', timing: 'Morning', active: true,
      // an oil: a 10 mL vial at 300 mg/mL (3,000 mg) = 3 mg per unit
      unit: 'mcg', doseMcg: 50000, vialAmount: 3000, bacMl: 10, mcgPerUnit: 3000, ingredients: [],
      schedule: { days: [1, 5] },
      purpose: 'An anabolic hormone injected Monday and Friday. Supports muscle, joint comfort and recovery from training. Long-acting, so the level stays steady between shots. At 300 mg/mL, 50 mg = 16.7 units (0.17 mL), so 100 mg a week.',
      benefits: ['Joint comfort', 'Muscle and strength', 'Recovery between sessions'],
    },
    {
      id: 'c_hcg', name: 'HCG', category: 'Hormone', timing: 'Morning', active: true,
      unit: 'IU', doseMcg: 500, vialAmount: 10000, bacMl: 2, mcgPerUnit: 50, ingredients: [],
      schedule: { days: [2, 6] },
      purpose: 'Signals the testes to keep working while on testosterone. Preserves their size, natural function and fertility. Taken Tuesday and Saturday. A 10,000 IU vial in 2 mL makes 500 IU = 10 units (0.1 mL).',
      benefits: ['Preserves fertility', 'Keeps natural production going', 'Supports testicular size'],
    },
    {
      id: 'c_anavar', name: 'Anavar', category: 'Oral', timing: 'Morning', active: true,
      // a tablet: no syringe, so no per-unit strength; it logs by amount
      unit: 'mcg', doseMcg: 10000, vialAmount: 0, bacMl: 0, mcgPerUnit: 0, ingredients: [],
      schedule: { days: [0, 1, 2, 3, 4, 5, 6] },
      purpose: 'Oxandrolone, an oral anabolic taken by mouth every day. Supports lean muscle and strength with little water retention. It is processed by the liver and can lower HDL cholesterol, so liver markers and lipids belong on each blood panel.',
      benefits: ['Lean muscle', 'Strength', 'Little water retention'],
    },
  ],
  logs: [],
  labs: [],
  scans: [],
};

const isPill = (c) => c.kind === 'supp' || c.kind === 'med';

// ---------- http helpers ----------
function corsHeaders(req) {
  const origin = req.headers.get('Origin') || '';
  const ok = ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (ok) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
function json(req, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(req) },
  });
}
const fail = (req, status, error) => json(req, status, { error });

// Constant-time string compare, so a wrong code takes as long to reject as a nearly-right one.
function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] || 0) ^ (eb[i] || 0);
  return diff === 0;
}
function roleOf(req, env) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') || '');
  const tok = m ? m[1].trim() : '';
  if (same(tok, env.ADMIN_CODE)) return 'admin';
  if (same(tok, env.MEMBER_CODE)) return 'member';
  return null;
}

// ---------- state ----------
async function load(env) {
  const raw = await env.SCOTT_KV.get(STATE_KEY);
  if (!raw) return structuredClone(SEED);
  const s = JSON.parse(raw);
  return {
    _rev: Number(s._rev) || 0,
    compounds: Array.isArray(s.compounds) ? s.compounds : [],
    logs: Array.isArray(s.logs) ? s.logs : [],
    labs: Array.isArray(s.labs) ? s.labs : [],
    scans: Array.isArray(s.scans) ? s.scans : [],
  };
}
const save = (env, s) => env.SCOTT_KV.put(STATE_KEY, JSON.stringify(s));

async function readBody(req) {
  try { const b = await req.json(); return b && typeof b === 'object' && !Array.isArray(b) ? b : null; }
  catch { return null; }
}

// ---------- routes ----------
async function handleAdmin(req, env, role) {
  if (role !== 'admin') return fail(req, 403, 'Only Roman can change the protocol');
  const body = await readBody(req);
  if (!body) return fail(req, 400, 'Send a JSON body');
  const s = await load(env);
  if (Number(body.baseRev) !== s._rev) return fail(req, 409, 'Someone saved first — reload and try again');
  let touched = false;
  for (const k of ['compounds', 'labs', 'scans']) {
    if (body[k] === undefined) continue;
    if (!Array.isArray(body[k]) || body[k].some(x => !x || typeof x !== 'object' || !x.id)) return fail(req, 400, `${k} must be a list of items with an id`);
    s[k] = body[k];
    touched = true;
  }
  if (!touched) return fail(req, 400, 'Nothing to change');
  s._rev += 1;
  await save(env, s);
  return json(req, 200, { ok: true, _rev: s._rev });
}

async function handleLog(req, env, role) {
  const body = await readBody(req);
  if (!body) return fail(req, 400, 'Send a JSON body');
  const s = await load(env);

  if (body.deleteId !== undefined) {
    const id = String(body.deleteId);
    const existing = s.logs.find(l => l.id === id);
    if (!existing) return json(req, 200, { ok: true, removed: false });
    if (role !== 'admin' && existing.by && existing.by !== role) return fail(req, 403, 'Logged by Roman — ask him to change it');
    s.logs = s.logs.filter(l => l.id !== id);
    await save(env, s);
    return json(req, 200, { ok: true, removed: true });
  }

  const log = body.log;
  if (!log || typeof log !== 'object') return fail(req, 400, 'Send { log } or { deleteId }');
  const c = s.compounds.find(x => x.id === log.compoundId);
  if (!c) return fail(req, 400, 'Unknown compound');
  if (typeof log.datetime !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(log.datetime)) return fail(req, 400, 'Bad date/time');
  const pill = isPill(c);
  const dose = Number(log.doseMcg);
  if (!pill) {
    if (!Number.isFinite(dose) || dose <= 0) return fail(req, 400, 'Dose must be above zero');
    const rec = Number(c.doseMcg) || 0;
    if (rec > 0 && dose / rec >= 5) return fail(req, 422, `Blocked by the dose gate: ${(dose / rec).toFixed(1)}× the set dose`);
  }

  const id = typeof log.id === 'string' && log.id ? log.id.slice(0, 64) : Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const existing = s.logs.find(l => l.id === id);
  if (existing && role !== 'admin' && existing.by && existing.by !== role) return fail(req, 403, 'Logged by Roman — ask him to change it');
  const units = log.units == null ? NaN : Number(log.units); // null (an oral, no syringe) stays null, not 0
  const entry = {
    id, compoundId: c.id, datetime: log.datetime.slice(0, 16),
    doseMcg: pill ? null : Math.round(dose),
    units: !pill && Number.isFinite(units) ? Math.round(units * 10) / 10 : null,
    by: existing && role === 'admin' && existing.by ? existing.by : role,
  };
  s.logs = [entry, ...s.logs.filter(l => l.id !== id)].slice(0, MAX_LOGS);
  await save(env, s);
  return json(req, 200, { ok: true, log: entry });
}

// ---------- Web Push (VAPID RFC 8292 + aes128gcm RFC 8291), crypto.subtle only ----------
// The same scheme as PUSH in protocol-sync-worker.js; the keypair lives in KV instead of secrets.
const te = new TextEncoder();
const b64u = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (str) => { const s = String(str || '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, ''); const bin = atob(s + '='.repeat((4 - s.length % 4) % 4)); return Uint8Array.from(bin, ch => ch.charCodeAt(0)); };
const concat = (...arrs) => { const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0)); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out; };
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}
const subId = async (endpoint) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(endpoint)))].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');

// ponytail: two first-ever /push/config calls in the same instant could each mint a key; the later one wins
// and the earlier device just turns reminders on again. Only possible on the very first setup.
async function vapid(env) {
  const raw = await env.SCOTT_KV.get('vapid');
  if (raw) return JSON.parse(raw);
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const k = { publicKey: b64u(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))), jwk: await crypto.subtle.exportKey('jwk', kp.privateKey) };
  await env.SCOTT_KV.put('vapid', JSON.stringify(k));
  return k;
}

async function encrypt(plaintext, p256dh, auth) {
  const uaPublic = unb64u(p256dh), authSecret = unb64u(auth);
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(authSecret, shared, concat(te.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(te.encode(plaintext), new Uint8Array([2]))));
  return concat(salt, new Uint8Array([0, 0, 16, 0, asPublic.length]), asPublic, ct);
}

// POST one payload to one device → { ok, status, gone } (gone = 404/410: the browser dropped the subscription).
async function sendPush(env, sub, payload) {
  const k = await vapid(env);
  const key = await crypto.subtle.importKey('jwk', k.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = (o) => b64u(te.encode(JSON.stringify(o)));
  const unsigned = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({ aud: new URL(sub.endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(unsigned)));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: `vapid t=${unsigned}.${b64u(sig)}, k=${k.publicKey}`, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '3600', Urgency: 'high' },
    body: await encrypt(JSON.stringify(payload), sub.keys.p256dh, sub.keys.auth),
  });
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}

const getSubs = async (env) => JSON.parse(await env.SCOTT_KV.get('subs') || '{}');
const putSubs = (env, subs) => env.SCOTT_KV.put('subs', JSON.stringify(subs));
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const validTz = (tz) => { try { Intl.DateTimeFormat('en-US', { timeZone: tz }); return typeof tz === 'string' && !!tz; } catch { return false; } };

async function handlePush(req, env, role, path) {
  if (path === '/push/config' && req.method === 'GET') return json(req, 200, { publicKey: (await vapid(env)).publicKey });
  if (req.method !== 'POST') return fail(req, 405, 'Method not allowed');
  const body = await readBody(req);
  if (!body) return fail(req, 400, 'Send a JSON body');

  if (path === '/push/subscribe') {
    const sub = body.subscription;
    const ok = sub && typeof sub.endpoint === 'string' && /^https:\/\//.test(sub.endpoint) && sub.keys && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string';
    if (!ok) return fail(req, 400, 'subscription must be { endpoint (https), keys: { p256dh, auth } }');
    try { if (unb64u(sub.keys.p256dh).length !== 65 || unb64u(sub.keys.auth).length < 16) throw 0; } catch { return fail(req, 400, 'subscription keys are malformed'); }
    const times = {};
    for (const b of ['am', 'pm']) {
      const t = body.times && body.times[b];
      if (t && !HM.test(t)) return fail(req, 400, `times.${b} must be HH:MM`);
      times[b] = t || '';
    }
    const nudge = Number(body.nudge) || 0;
    if (nudge < 0 || nudge > 240) return fail(req, 400, 'nudge must be 0–240 minutes');
    const id = await subId(sub.endpoint);
    const subs = await getSubs(env);
    subs[id] = {
      id, role, times, nudge: Math.round(nudge),
      subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
      tz: validTz(body.tz) ? body.tz : TZ,
      at: new Date().toISOString(),
    };
    // keep the newest MAX_SUBS devices so a stream of re-installs cannot grow the record without bound
    const keep = Object.values(subs).sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_SUBS);
    await putSubs(env, Object.fromEntries(keep.map(r => [r.id, r])));
    return json(req, 200, { ok: true, id });
  }

  const id = typeof body.endpoint === 'string' && body.endpoint ? await subId(body.endpoint) : '';
  if (!id) return fail(req, 400, 'endpoint is required');
  const subs = await getSubs(env);

  if (path === '/push/unsubscribe') {
    const removed = !!subs[id];
    delete subs[id];
    if (removed) await putSubs(env, subs);
    return json(req, 200, { ok: true, removed });
  }
  if (path === '/push/test') {
    if (!subs[id]) return fail(req, 404, 'This device is not subscribed — turn reminders on first');
    const r = await sendPush(env, subs[id].subscription, { title: 'Scott · Protocol', body: 'Reminders are on for this device.', data: { tab: 'protocol' } });
    if (r.gone) { delete subs[id]; await putSubs(env, subs); }
    return r.ok ? json(req, 200, { ok: true }) : fail(req, 502, `The push service answered ${r.status}${r.gone ? ' — turn reminders on again' : ''}`);
  }
  return fail(req, 404, 'Not found');
}

// ---------- the reminder pass behind the Cron Trigger ----------
// Same rules as the app: an empty days list = as needed (never reminded), timing words pick the block.
const blockOf = (c) => {
  const days = c.schedule && c.schedule.days;
  if (Array.isArray(days) && days.length === 0) return 'prn';
  return /night|even|pm|bed/i.test(c.timing || '') ? 'pm' : 'am';
};
const dowOf = (dk) => new Date(dk + 'T12:00:00Z').getUTCDay();
const addDays = (dk, n) => new Date(Date.parse(dk + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
function dueFor(s, dk, block) {
  const dow = dowOf(dk);
  return s.compounds.filter(c => c.active !== false && !c.stack && blockOf(c) === block
    && ((c.schedule && c.schedule.days) || [0, 1, 2, 3, 4, 5, 6]).includes(dow)
    && !s.logs.some(l => l.compoundId === c.id && (l.datetime || '').slice(0, 10) === dk));
}
function localNow(now, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(now).map(x => [x.type, x.value]));
  return { dk: `${p.year}-${p.month}-${p.day}`, sec: Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second) };
}
const fmtMg = (n) => n >= 1000 ? `${+(n / 1000).toFixed(2)} mg` : `${Math.round(n)} mcg`;
const doseText = (c) => isPill(c) ? (c.dose || '') : c.unit === 'IU' ? `${Math.round(c.doseMcg).toLocaleString('en-US')} IU` : (c.doseMcg ? fmtMg(c.doseMcg) : '');
const hmSec = (hm) => Number(hm.slice(0, 2)) * 3600 + Number(hm.slice(3, 5)) * 60;
const tabOf = (c) => c.kind === 'supp' ? 'supps' : c.kind === 'med' ? 'meds' : 'protocol';

// The reminders one device gets: each dose block at its own time (plus the nudge), and each supplement
// stack once at the stack's fixed time. build(dk) returns the push, or null when nothing is due.
function slotsFor(rec, s) {
  const out = [];
  for (const block of ['am', 'pm']) {
    if (!HM.test(rec.times[block] || '')) continue;
    const base = hmSec(rec.times[block]);
    const due = (dk) => dueFor(s(), dk, block);
    const push = (nudge) => (dk) => {
      const items = due(dk);
      if (!items.length) return null;
      const list = items.map(c => [c.name, doseText(c)].filter(Boolean).join(' ')).join(', ');
      return {
        title: (nudge ? 'Still due: ' : '') + BLOCK_TITLE[block],
        body: `${items.length} ${nudge ? 'still ' : ''}due: ${list}. Tap to log.`,
        data: { tab: tabOf(items[0]), tag: `${dk}-${block}` },
      };
    };
    out.push({ at: base, key: block, build: push(false) });
    if (rec.nudge > 0) out.push({ at: base + rec.nudge * 60, key: block + ':n', build: push(true) });
  }
  // supplement stacks are not logged, so this is a plain "time to take it" with what is in the stack
  for (const st of STACKS) out.push({ at: hmSec(st.time), key: 'stack-' + st.id, build: (dk) => {
    const items = s().compounds.filter(c => c.stack === st.id && c.active !== false);
    return items.length ? {
      title: st.name,
      body: `Time to take it — ${items.length} item${items.length === 1 ? '' : 's'}: ${items.map(c => c.name).join(', ')}.`,
      data: { tab: 'supps', tag: `${dk}-stack-${st.id}` },
    } : null;
  } });
  return out;
}

async function runReminders(env, now) {
  const out = { sent: 0, failed: 0 };
  const subs = await getSubs(env);
  let state = null, dropped = false;
  const s = () => state;
  for (const rec of Object.values(subs)) {
    const { dk: today, sec } = localNow(now, validTz(rec.tz) ? rec.tz : TZ);
    for (const { at, key, build } of slotsFor(rec, s)) {
      if (dropped && !subs[rec.id]) break;
      // did `at` fall in the last WINDOW_SEC (today, or just before midnight)? → which day it belongs to
      const d = ((sec - at % 86400) % 86400 + 86400) % 86400;
      if (d >= WINDOW_SEC) continue;
      const dk = addDays(today, (sec < at % 86400 ? -1 : 0) - Math.floor(at / 86400));
      const mark = `sent:${rec.id}:${dk}:${key}`;
      if (await env.SCOTT_KV.get(mark)) continue;
      state = state || await load(env);
      const payload = build(dk);
      if (!payload) continue;
      await env.SCOTT_KV.put(mark, '1', { expirationTtl: 2 * 86400 });
      const r = await sendPush(env, rec.subscription, payload).catch(() => ({ ok: false }));
      if (r.ok) out.sent++; else out.failed++;
      if (r.gone) { delete subs[rec.id]; dropped = true; }
    }
  }
  if (dropped) await putSubs(env, subs);
  return out;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
    if (url.pathname === '/health' || url.pathname === '/') return json(req, 200, { ok: true, version: VERSION });
    if (!env.SCOTT_KV) return fail(req, 500, 'KV binding SCOTT_KV is missing');
    if (!env.ADMIN_CODE || !env.MEMBER_CODE) return fail(req, 500, 'Access codes are not set');

    const role = roleOf(req, env);
    if (!role) return fail(req, 401, 'Bad access code');

    try {
      if (url.pathname === '/state' && req.method === 'GET') {
        const s = await load(env);
        return json(req, 200, { role, ...s, stacks: STACKS });
      }
      // Originals are private KV objects, never public Pages assets or URLs with a code.
      if (url.pathname === '/document' && req.method === 'GET') {
        const id = url.searchParams.get('id') || '';
        if (!/^doc_[a-f0-9]{20}$/.test(id)) return fail(req, 400, 'Invalid document');
        const raw = await env.SCOTT_KV.get('document:' + id);
        if (!raw) return fail(req, 404, 'Document not found');
        const file = JSON.parse(raw);
        if (!['application/pdf', 'text/csv'].includes(file.mime) || typeof file.base64 !== 'string' || typeof file.name !== 'string') return fail(req, 500, 'Document unavailable');
        return json(req, 200, { name: file.name, mime: file.mime, base64: file.base64, sha256: file.sha256 });
      }
      if (url.pathname === '/admin' && req.method === 'POST') return await handleAdmin(req, env, role);
      if (url.pathname === '/log' && req.method === 'POST') return await handleLog(req, env, role);
      if (url.pathname.startsWith('/push/')) return await handlePush(req, env, role, url.pathname);
      return fail(req, 404, 'Not found');
    } catch (e) {
      return fail(req, 500, 'Server error: ' + (e && e.message || e));
    }
  },
  // Cron Trigger */15 * * * * (Settings → Triggers): send the reminders whose time fell in the last 15 minutes.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReminders(env, new Date()));
  },
};
export { runReminders };
