// Scott-only replacement. Private KV records remain untouched.
const VERSION = '2.0.0';
const ALLOWED_ORIGINS = ['https://rsemenov81-hash.github.io'];
const TZ = 'America/New_York';
const MAX_SUBS = 20;
const VAPID_SUBJECT = 'https://rsemenov81-hash.github.io/protocol-os/scott/';
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
async function readBody(req) {
  try { const b = await req.json(); return b && typeof b === 'object' && !Array.isArray(b) ? b : null; }
  catch { return null; }
}

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
    const r = await sendPush(env, subs[id].subscription, { title: 'Google it.', body: 'Google it.', data: { tag: 'google-it-test' } });
    if (r.gone) { delete subs[id]; await putSubs(env, subs); }
    return r.ok ? json(req, 200, { ok: true }) : fail(req, 502, `The push service answered ${r.status}${r.gone ? ' — turn reminders on again' : ''}`);
  }
  return fail(req, 404, 'Not found');
}


// Existing 15-minute cron: one reminder per UTC hour per subscribed device.
// Reuse existing subscriptions and VAPID keys; never read the private record state.
async function runReminders(env, now) {
  const out = { sent: 0, failed: 0 };
  const subs = await getSubs(env);
  const hour = Math.floor(now.getTime() / 3600000);
  let dropped = false;
  for (const rec of Object.values(subs)) {
    const mark = `sent:${rec.id}:google-it:${hour}`;
    if (await env.SCOTT_KV.get(mark)) continue;
    await env.SCOTT_KV.put(mark, '1', { expirationTtl: 172800 });
    const result = await sendPush(env, rec.subscription, {
      title: 'Google it.', body: 'Google it.', data: { tag: `google-it-${hour}` },
    }).catch(() => ({ ok: false }));
    if (result.ok) out.sent++; else out.failed++;
    if (result.gone) { delete subs[rec.id]; dropped = true; }
  }
  if (dropped) await putSubs(env, subs);
  return out;
}
export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
    if (path === '/health' || path === '/') return json(req, 200, { ok: true, version: VERSION });
    // Old app versions cannot read or modify records, even with a valid access code.
    if (!path.startsWith('/push/')) return json(req, 410, { message: 'Google it.' });
    if (!env.SCOTT_KV || !env.ADMIN_CODE || !env.MEMBER_CODE) return fail(req, 500, 'Service unavailable');
    const role = roleOf(req, env);
    if (!role) return fail(req, 401, 'Bad access code');
    try { return await handlePush(req, env, role, path); }
    catch { return fail(req, 500, 'Service unavailable'); }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReminders(env, new Date(event.scheduledTime ?? Date.now())));
  },
};
export { runReminders };
