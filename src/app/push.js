// Web Push client for Protocol OS — the browser side of the sync Worker's /push/* endpoints.
//
// Plain ES module, no top-level side effects: main.jsx imports what it needs and wires it into the UI.
// Every exported async function resolves to { ok, status, error? } (plus extras noted per function)
// and never throws: network failures, a missing service worker, a browser without PushManager and a
// refused permission all come back as a result. `status` is always one of the pushStatus() values.
//
// Worker contract (v1.6.0), all with `Authorization: Bearer <token>` and JSON bodies:
//   GET    {syncUrl}/push/config                 → { publicKey (base64url P-256), enabled }
//   POST   {syncUrl}/push/subscribe              { profile, subscription, settings, tz, device } → { ok, id }
//   DELETE {syncUrl}/push/subscribe              { endpoint }
//   GET    {syncUrl}/push/subscriptions?profile= → list of this profile's devices
//   POST   {syncUrl}/push/test                   { profile }
// The service worker (sw.js) shows the notification and, on tap, posts { type: 'open-block', data }
// to the open app, which listenForOpenBlock() turns into a callback.

export const PUSH_STORAGE_KEY = 'protocol_os_push';
export const PUSH_STATUSES = ['unsupported', 'needs-install', 'denied', 'subscribed', 'off'];
const SW_URL = './sw.js';
const REQUEST_TIMEOUT_MS = 15000;
const SW_READY_TIMEOUT_MS = 10000;

// ── Settings ─────────────────────────────────────────────────────────────────────────────────────

/** The reminder settings a new subscription starts with: all three blocks on, default times, a 30-minute nudge. */
export function defaultReminderSettings() {
  return { blocks: { am: true, pre: true, pm: true }, times: { am: '08:00', pre: '06:00', pm: '19:00' }, nudgeMinutes: 30 };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Coerces any partial/odd settings object into the exact shape the Worker expects (fills gaps from the defaults). */
export function normalizeReminderSettings(s) {
  const d = defaultReminderSettings();
  const src = s && typeof s === 'object' ? s : {};
  const blocks = {}, times = {};
  for (const k of ['am', 'pre', 'pm']) {
    blocks[k] = src.blocks && k in src.blocks ? !!src.blocks[k] : d.blocks[k];
    const t = src.times && typeof src.times[k] === 'string' ? src.times[k].trim() : '';
    times[k] = TIME_RE.test(t) ? t : d.times[k];
  }
  const n = Number(src.nudgeMinutes);
  const nudgeMinutes = Number.isFinite(n) && n >= 0 ? Math.round(n) : d.nudgeMinutes;
  return { blocks, times, nudgeMinutes };
}

// ── Encoding ─────────────────────────────────────────────────────────────────────────────────────

/** base64url (the VAPID public key as the Worker serves it) → Uint8Array, as pushManager.subscribe() wants it. */
export function urlBase64ToUint8Array(s) {
  const str = String(s == null ? '' : s).trim().replace(/=+$/, ''); // re-pad below; strict atob rejects over-padding
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Inverse of urlBase64ToUint8Array (no padding), for comparing keys and for tests. */
export function uint8ArrayToUrlBase64(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
  let bin = '';
  for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Environment ──────────────────────────────────────────────────────────────────────────────────

const nav = () => (typeof navigator !== 'undefined' ? navigator : undefined);
const ua = () => { const n = nav(); return (n && n.userAgent) || ''; };

/** True on iPhone/iPad/iPod (including iPadOS, which reports a Macintosh UA with touch). */
export function isIOS() {
  const n = nav();
  return /iP(hone|ad|od)/.test(ua()) || (/Macintosh/.test(ua()) && !!n && (n.maxTouchPoints || 0) > 1);
}

/** True when the page runs as an installed app (home-screen / standalone window). */
export function isStandalone() {
  try {
    const n = nav();
    if (n && n.standalone === true) return true;
    if (typeof matchMedia === 'function') { const m = matchMedia('(display-mode: standalone)'); if (m && m.matches) return true; }
  } catch (e) { /* ignore */ }
  return false;
}

/** iOS only exposes Web Push to home-screen apps: true when the user still has to Add to Home Screen. */
export function needsInstall() { return isIOS() && !isStandalone(); }

/** Service worker + PushManager + Notification all present in this browser context. */
export function isPushSupported() {
  try {
    const n = nav();
    return !!(n && n.serviceWorker && typeof PushManager !== 'undefined' && typeof Notification !== 'undefined');
  } catch (e) { return false; }
}

function permission() {
  try { return (typeof Notification !== 'undefined' && Notification.permission) || 'default'; } catch (e) { return 'default'; }
}

function requestPermission() {
  return new Promise(resolve => {
    try {
      const p = Notification.requestPermission(r => resolve(r || permission())); // legacy callback form (old Safari)
      if (p && typeof p.then === 'function') p.then(r => resolve(r || permission()), () => resolve(permission()));
    } catch (e) { resolve(permission()); }
  });
}

// ── Local record ─────────────────────────────────────────────────────────────────────────────────

/** The local copy of this device's subscription: { endpoint, profile, settings, at, id? } or null. */
export function getSavedReminders() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(PUSH_STORAGE_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === 'object' ? v : null;
  } catch (e) { return null; }
}
function saveLocal(rec) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(PUSH_STORAGE_KEY, JSON.stringify(rec)); } catch (e) { /* storage full or blocked: the Worker still has it */ } }
function clearLocal() { try { if (typeof localStorage !== 'undefined') localStorage.removeItem(PUSH_STORAGE_KEY); } catch (e) { /* ignore */ } }

// ── Service worker access ────────────────────────────────────────────────────────────────────────

async function getRegistration() {
  const n = nav();
  if (!n || !n.serviceWorker) return null;
  try {
    const sw = n.serviceWorker;
    return (typeof sw.getRegistration === 'function' ? await sw.getRegistration() : null) || null;
  } catch (e) { return null; }
}

// Registration with an active worker, registering ./sw.js if the load-time registration has not happened.
async function readyRegistration() {
  const n = nav();
  if (!n || !n.serviceWorker) return null;
  const sw = n.serviceWorker;
  let reg = await getRegistration();
  if (!reg && typeof sw.register === 'function') { try { reg = await sw.register(SW_URL); } catch (e) { return null; } }
  if (!reg) return null;
  if (!reg.active && sw.ready && typeof sw.ready.then === 'function') {
    const ready = await Promise.race([sw.ready.catch(() => null), new Promise(res => setTimeout(() => res(null), SW_READY_TIMEOUT_MS))]);
    if (ready) reg = ready;
  }
  return reg;
}

async function currentSubscription(reg) {
  try { return reg && reg.pushManager ? (await reg.pushManager.getSubscription()) || null : null; } catch (e) { return null; }
}

function subscriptionJSON(sub) {
  if (sub && typeof sub.toJSON === 'function') return sub.toJSON();
  return { endpoint: sub && sub.endpoint, expirationTime: (sub && sub.expirationTime) || null, keys: (sub && sub.keys) || {} };
}

function sameKey(sub, keyBytes) {
  try {
    const cur = sub && sub.options && sub.options.applicationServerKey;
    if (!cur) return true; // browser does not expose it: assume unchanged
    const a = new Uint8Array(cur instanceof ArrayBuffer ? cur : cur.buffer ? cur.buffer.slice(cur.byteOffset, cur.byteOffset + cur.byteLength) : cur);
    if (a.length !== keyBytes.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== keyBytes[i]) return false;
    return true;
  } catch (e) { return true; }
}

// ── Worker API ───────────────────────────────────────────────────────────────────────────────────

async function api(syncUrl, token, method, path, body) {
  const base = String(syncUrl || '').trim().replace(/\/+$/, '');
  if (!base || !token) return { ok: false, httpStatus: 0, error: 'Cloud sync is not set up (URL and token)', data: null };
  const init = { method, headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } };
  if (body !== undefined) init.body = JSON.stringify(body);
  try { if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') init.signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS); } catch (e) { /* ignore */ }
  try {
    const res = await fetch(base + path, init);
    let data = null;
    try { const text = await res.text(); data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (!res.ok) return { ok: false, httpStatus: res.status, error: (data && (data.error || data.message)) || ('HTTP ' + res.status), data };
    return { ok: true, httpStatus: res.status, error: undefined, data };
  } catch (e) {
    return { ok: false, httpStatus: 0, error: (e && e.name === 'TimeoutError') ? 'Request timed out' : ((e && e.message) || String(e)), data: null };
  }
}

function timeZone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } }

/** A short human label for this device, stored with the subscription so the user can tell devices apart. */
export function describeDevice() {
  const u = ua();
  const n = nav();
  const os = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) || (/Macintosh/.test(u) && n && (n.maxTouchPoints || 0) > 1) ? 'iPad'
    : /Android/.test(u) ? 'Android' : /Macintosh/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : /Linux/.test(u) ? 'Linux' : 'Device';
  const browser = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'browser';
  return `${os} · ${browser}${isStandalone() ? ' (app)' : ''}`;
}

function subscribeBody(profile, sub, settings) {
  return { profile: String(profile || ''), subscription: subscriptionJSON(sub), settings: normalizeReminderSettings(settings), tz: timeZone(), device: describeDevice() };
}

// ── Public API ───────────────────────────────────────────────────────────────────────────────────

/**
 * Where reminders stand on this device:
 *   'needs-install' iOS Safari outside a home-screen app (push is only available once installed)
 *   'unsupported'   no service worker / PushManager / Notification in this browser
 *   'denied'        notification permission was refused (only the browser settings can undo that)
 *   'subscribed'    a push subscription exists for this origin
 *   'off'           supported but not subscribed
 */
export async function pushStatus() {
  if (needsInstall()) return 'needs-install';
  if (!isPushSupported()) return 'unsupported';
  if (permission() === 'denied') return 'denied';
  const reg = await getRegistration();
  if (!reg) return 'off';
  return (await currentSubscription(reg)) ? 'subscribed' : 'off';
}

/**
 * Turn reminders on for this device: asks for permission (call from a tap — iOS requires a user gesture),
 * reads the Worker's VAPID key, subscribes and registers the subscription with the Worker.
 * → { ok, status, error?, id? }. On a Worker failure the fresh browser subscription is dropped again so
 * pushStatus() stays truthful.
 */
export async function enableReminders({ syncUrl, token, profile, settings } = {}) {
  if (needsInstall()) return { ok: false, status: 'needs-install', error: 'Add Protocol OS to your Home Screen first (Share → Add to Home Screen), then turn reminders on from the app icon.' };
  if (!isPushSupported()) return { ok: false, status: 'unsupported', error: 'This browser cannot receive push notifications.' };
  if (!profile) return { ok: false, status: await pushStatus(), error: 'No profile selected.' };

  // Permission first, while the tap's user activation is still fresh (the config round-trip can outlive it on iOS).
  let perm = permission();
  if (perm === 'default') perm = await requestPermission();
  if (perm !== 'granted') return { ok: false, status: perm === 'denied' ? 'denied' : 'off', error: perm === 'denied' ? 'Notifications are blocked for Protocol OS in this browser.' : 'Notification permission was not granted.' };

  const cfg = await api(syncUrl, token, 'GET', '/push/config');
  if (!cfg.ok) return { ok: false, status: await pushStatus(), error: 'Could not reach the sync Worker: ' + cfg.error };
  const publicKey = cfg.data && cfg.data.publicKey;
  if (!publicKey || cfg.data.enabled === false) return { ok: false, status: await pushStatus(), error: 'Reminders are not enabled on the sync Worker (no VAPID key).' };
  let keyBytes;
  try { keyBytes = urlBase64ToUint8Array(publicKey); } catch (e) { keyBytes = null; }
  if (!keyBytes || keyBytes.length !== 65) return { ok: false, status: await pushStatus(), error: 'The Worker returned an invalid push key.' };

  const reg = await readyRegistration();
  if (!reg || !reg.pushManager) return { ok: false, status: 'unsupported', error: 'The service worker is not running; reload the app and try again.' };

  let sub = await currentSubscription(reg);
  let fresh = false;
  if (sub && !sameKey(sub, keyBytes)) { try { await sub.unsubscribe(); } catch (e) { /* ignore */ } sub = null; } // key rotated on the Worker
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
      fresh = true;
    } catch (e) {
      const denied = e && (e.name === 'NotAllowedError' || permission() === 'denied');
      return { ok: false, status: denied ? 'denied' : 'off', error: 'Could not subscribe: ' + ((e && e.message) || String(e)) };
    }
  }

  const res = await api(syncUrl, token, 'POST', '/push/subscribe', subscribeBody(profile, sub, settings));
  if (!res.ok) {
    if (fresh) { try { await sub.unsubscribe(); } catch (e) { /* ignore */ } }
    clearLocal();
    return { ok: false, status: fresh ? 'off' : await pushStatus(), error: 'The sync Worker refused the subscription: ' + res.error };
  }
  const id = res.data && res.data.id;
  saveLocal({ endpoint: sub.endpoint, profile, settings: normalizeReminderSettings(settings), at: new Date().toISOString(), id });
  return { ok: true, status: 'subscribed', id };
}

/**
 * Re-send this device's existing subscription with new settings (times, blocks, nudge) or a new profile.
 * Does not prompt for permission; when the device is not subscribed it returns { ok:false, status:'off' }
 * and the caller should use enableReminders(). → { ok, status, error?, id? }
 */
export async function updateReminders({ syncUrl, token, profile, settings } = {}) {
  if (!isPushSupported()) return { ok: false, status: await pushStatus(), error: 'This browser cannot receive push notifications.' };
  const reg = await getRegistration();
  const sub = await currentSubscription(reg);
  if (!sub) { clearLocal(); return { ok: false, status: await pushStatus(), error: 'Reminders are off on this device; turn them on first.' }; }
  const saved = getSavedReminders();
  const who = profile || (saved && saved.profile);
  if (!who) return { ok: false, status: 'subscribed', error: 'No profile selected.' };
  const res = await api(syncUrl, token, 'POST', '/push/subscribe', subscribeBody(who, sub, settings));
  if (!res.ok) return { ok: false, status: 'subscribed', error: 'The sync Worker refused the update: ' + res.error };
  const id = (res.data && res.data.id) || (saved && saved.id);
  saveLocal({ endpoint: sub.endpoint, profile: who, settings: normalizeReminderSettings(settings), at: new Date().toISOString(), id });
  return { ok: true, status: 'subscribed', id };
}

/**
 * Turn reminders off on this device: unsubscribe in the browser, tell the Worker (DELETE by endpoint) and
 * forget the local copy. → { ok, status:'off', error?, warning? } — `warning` is set when the device is
 * unsubscribed but the Worker could not be told (it prunes the dead endpoint on its next send).
 */
export async function disableReminders({ syncUrl, token } = {}) {
  const saved = getSavedReminders();
  const reg = await getRegistration();
  const sub = await currentSubscription(reg);
  const endpoint = (sub && sub.endpoint) || (saved && saved.endpoint) || null;
  let unsubError = null;
  if (sub) { try { await sub.unsubscribe(); } catch (e) { unsubError = (e && e.message) || String(e); } }
  let warning;
  if (endpoint) {
    const res = await api(syncUrl, token, 'DELETE', '/push/subscribe', { endpoint });
    if (!res.ok) warning = 'The sync Worker could not be told: ' + res.error;
  }
  clearLocal();
  if (unsubError) return { ok: false, status: await pushStatus(), error: 'Could not unsubscribe this browser: ' + unsubError, warning };
  const out = { ok: true, status: 'off' };
  if (warning) out.warning = warning;
  return out;
}

/** Ask the Worker to send a test reminder to every device subscribed for `profile`. → { ok, status, error?, result? } */
export async function sendTestReminder({ syncUrl, token, profile } = {}) {
  if (!profile) return { ok: false, status: await pushStatus(), error: 'No profile selected.' };
  const res = await api(syncUrl, token, 'POST', '/push/test', { profile });
  const status = await pushStatus();
  if (!res.ok) return { ok: false, status, error: 'Test reminder failed: ' + res.error };
  return { ok: true, status, result: res.data };
}

/** The Worker's list of devices subscribed for `profile` (GET /push/subscriptions). → { ok, status, error?, subscriptions: [] } */
export async function listReminderSubscriptions({ syncUrl, token, profile } = {}) {
  const res = await api(syncUrl, token, 'GET', '/push/subscriptions?profile=' + encodeURIComponent(profile || ''));
  const status = await pushStatus();
  if (!res.ok) return { ok: false, status, error: res.error, subscriptions: [] };
  const d = res.data;
  const list = Array.isArray(d) ? d : (d && (Array.isArray(d.subscriptions) ? d.subscriptions : Array.isArray(d.items) ? d.items : [])) || [];
  return { ok: true, status, subscriptions: list };
}

/**
 * Calls handler({ profile, block, date, url }) when the user taps a reminder while the app is open (the
 * service worker posts { type:'open-block' }). If the app was launched from a reminder instead (sw.js
 * opens data.url when no window is open), a `block` query parameter in the launch URL is handed to the
 * handler once and removed from the address bar. Returns an unsubscribe function for useEffect cleanup.
 */
export function listenForOpenBlock(handler) {
  if (typeof handler !== 'function') return () => {};
  const n = nav();
  const sw = n && n.serviceWorker;
  let onMsg = null;
  if (sw && typeof sw.addEventListener === 'function') {
    onMsg = (e) => { const m = e && e.data; if (m && m.type === 'open-block') handler(m.data || {}, e); };
    sw.addEventListener('message', onMsg);
  }
  try {
    if (typeof location !== 'undefined' && location.search) {
      const q = new URLSearchParams(location.search);
      if (q.has('block')) {
        const data = { profile: q.get('profile') || undefined, block: q.get('block'), date: q.get('date') || undefined, url: location.href, launched: true };
        if (typeof history !== 'undefined' && typeof history.replaceState === 'function') { try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* ignore */ } }
        Promise.resolve().then(() => handler(data, null));
      }
    }
  } catch (e) { /* ignore */ }
  return () => { if (onMsg && sw && typeof sw.removeEventListener === 'function') sw.removeEventListener('message', onMsg); };
}
