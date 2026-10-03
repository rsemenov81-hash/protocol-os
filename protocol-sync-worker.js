var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js — protocol-sync (Cloudflare Worker + KV): /sync API for the app, /mcp tools for Claude.
// v1.4.0: schedule rules (every-other-day, start/end dates, dated plan revisions) — see SCHED below.
// v1.5.0: skips are not doses (skipped rows reported separately, never counted as taken); one shared
//         record (?profile=all → KV protocol:all, tools filter by profile, per-profile keys stay as the
//         fallback); daily snapshots (protocol:<key>:snap:YYYY-MM-DD, 30-day TTL, list/fetch via /sync);
//         Bearer header preferred over ?token; CORS echoes only known origins; Cache-Control: no-store;
//         DST-safe adherence window (calendar stepping on the day key, not Date.now() − n·86400000).
// v1.6.0: Web Push reminders (/push/*, a Cron Trigger `*/15 * * * *` running `scheduled`, VAPID +
//         RFC 8291 aes128gcm done with crypto.subtle only — see PUSH below) and the Claude proposal
//         inbox (MCP tools propose_change / get_proposals, HTTP /proposals, `_proposalsPending` on
//         every GET /sync). Secrets stay in the dashboard: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//         VAPID_SUBJECT next to SYNC_TOKEN / READ_TOKEN.
var VERSION = "1.6.0";
var TZ = "America/New_York";
var DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
var ALL_KEY = "protocol:all";
var SNAP_TTL_SECONDS = 30 * 86400;
// Web Push: one KV record per browser subscription, one short-lived marker per reminder sent.
var PUSH_PREFIX = "push:";
var PUSHSENT_PREFIX = "pushsent:";
var PUSH_SENT_TTL_SECONDS = 2 * 86400;
var PUSH_WINDOW_SECONDS = 15 * 60;
var PUSH_BLOCKS = ["am", "pre", "pm"];
var PUSH_TITLES = { am: "Morning doses", pre: "Pre-workout doses", pm: "Evening doses" };
var PUSH_DEFAULT_SETTINGS = { blocks: { am: true, pre: false, pm: true }, times: { am: "08:00", pre: "06:00", pm: "19:00" }, nudgeMinutes: 0 };
var PUSH_DEFAULT_SUBJECT = "mailto:protocol-os@example.com";
var HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
// Proposal inbox: proposals:<profile> holds an array, newest first, capped.
var PROPOSALS_PREFIX = "proposals:";
var PROPOSALS_CAP = 20;
var PROPOSAL_STATUSES = ["pending", "approved", "dismissed"];
var DOSE_UNITS = ["mcg", "mg", "IU", "g"];
// Origins that may call /sync and /mcp from a browser: the GitHub Pages app and local dev servers
// (any port). Anything else — and any request without an Origin header (MCP, curl) — gets no CORS
// headers at all.
var ALLOWED_ORIGIN = /^(https:\/\/rsemenov81-hash\.github\.io|http:\/\/(localhost|127\.0\.0\.1):\d+)$/;
var CORS_METHODS = "GET, POST, OPTIONS, DELETE";
var CORS_HEADERS = "Content-Type, Authorization, If-Match, Mcp-Session-Id, Accept";
var CORS_EXPOSE = "Mcp-Session-Id, ETag";
var MCP_VERSION = "2024-11-05";
function corsFor(request) {
  const origin = request.headers.get("Origin");
  if (!origin || !ALLOWED_ORIGIN.test(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": CORS_METHODS,
    "Access-Control-Allow-Headers": CORS_HEADERS,
    "Access-Control-Expose-Headers": CORS_EXPOSE
  };
}
__name(corsFor, "corsFor");
// Per-request responders: every response carries the request's CORS headers (if any) and
// Cache-Control: no-store, so a token-bearing /sync or /mcp body is never cached anywhere.
function makeReply(request) {
  const base = { ...corsFor(request), "Cache-Control": "no-store" };
  const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
    status,
    headers: { ...base, "Content-Type": "application/json", ...extra }
  });
  const raw = (body, status = 200, extra = {}) => new Response(body, { status, headers: { ...base, ...extra } });
  return { base, json, raw };
}
__name(makeReply, "makeReply");
// Token candidates in order of preference: Authorization: Bearer <token> first, then ?token=.
// The header wins whenever it carries a valid token; ?token= keeps working for clients that can
// only put the token in the URL (the Claude MCP connector).
function tokenCandidates(request, url) {
  const out = [];
  const h = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (h) out.push(h);
  const q = url.searchParams.get("token");
  if (q) out.push(q);
  return out;
}
__name(tokenCandidates, "tokenCandidates");
function getToken(request, url) {
  return tokenCandidates(request, url)[0] || "";
}
__name(getToken, "getToken");
// "full" (SYNC_TOKEN), "read" (READ_TOKEN) or null — the first candidate that matches decides.
function authLevel(request, url, env) {
  for (const t of tokenCandidates(request, url)) {
    if (env.SYNC_TOKEN && t === env.SYNC_TOKEN) return "full";
    if (env.READ_TOKEN && t === env.READ_TOKEN) return "read";
  }
  return null;
}
__name(authLevel, "authLevel");
// Local calendar + clock of `instant` in `tz` (default America/New_York): {date 'YYYY-MM-DD', dow 0-6,
// hour 0-23, minute, second}. One formatToParts call; hourCycle h23 so midnight is 00, never 24.
function localParts(instant, tz = TZ) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(instant);
  const g = {};
  for (const p of parts) g[p.type] = p.value;
  return { date: `${g.year}-${g.month}-${g.day}`, dow: DOW[g.weekday], hour: Number(g.hour) % 24, minute: Number(g.minute), second: Number(g.second) };
}
__name(localParts, "localParts");
function validTz(tz) {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
__name(validTz, "validTz");
function cleanProfile(v) {
  return String(v == null ? "" : v).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
}
__name(cleanProfile, "cleanProfile");
// Which reminder block a protocol belongs to — the app's blockOf (src/app/main.jsx) verbatim:
// PRN (empty days) → 'prn'; timeOfDay matching pre/work → 'pre'; eve/night/bed/pm → 'pm'; else 'am'.
function blockOf(p) {
  const sched = p && p.schedule || {};
  const tod = String(sched.timeOfDay || "").toLowerCase();
  if (Array.isArray(sched.days) && sched.days.length === 0) return "prn";
  if (/pre|work/.test(tod)) return "pre";
  if (/eve|night|bed|pm/.test(tod)) return "pm";
  return "am";
}
__name(blockOf, "blockOf");
function logLocalDate(l) {
  const s = String(l.datetime || l.createdAt || "");
  return s.slice(0, 10);
}
__name(logLocalDate, "logLocalDate");
// Skips are not doses. The app writes a skip as {doseMcg: 0, skipped: true} and filters with
// `!l.skipped` everywhere (hasLogToday, History). A non-skip row with doseMcg === 0 is malformed and
// ignored. IU doses carry the IU number in doseMcg (> 0), so only `skipped` is the signal here.
function isSkip(l) {
  return !!(l && l.skipped);
}
__name(isSkip, "isSkip");
function isDose(l) {
  return !!l && !l.skipped && l.doseMcg !== 0;
}
__name(isDose, "isDose");
function skipEntry(l) {
  return { compound: l.peptide || l.peptideName || l.peptideId, time: l.datetime, ...l.notes ? { notes: l.notes } : {} };
}
__name(skipEntry, "skipEntry");
async function readBlob(env, key) {
  const stored = await env.PROTOCOL_KV.get(key);
  if (!stored) return null;
  try {
    return canonicalizeState(JSON.parse(stored));
  } catch {
    return { _corrupt: true };
  }
}
__name(readBlob, "readBlob");
// The shared record holds all profiles. Slice it down to one: protocols by p.profile (app rule:
// `p.profile === activeProfile`), logs by l.profile — a log without one inherits its protocol's
// profile, and if that is unknown too it is visible to every profile (app rule:
// `(l.profile || activeProfile) === activeProfile`) — vials by inventoryProfile (only Tim's are
// tagged; untagged vials are shared). meta and the record's own _rev/_syncedAt pass through.
function sliceForProfile(state, profile) {
  if (!state || typeof state !== "object" || profile === "all") return state;
  const protocols = Array.isArray(state.protocols) ? state.protocols : [];
  const logs = Array.isArray(state.logs) ? state.logs : [];
  const vials = Array.isArray(state.vials) ? state.vials : [];
  const ownerOf = new Map();
  for (const p of protocols) if (p && p.id != null) ownerOf.set(p.id, p.profile);
  return {
    ...state,
    protocols: protocols.filter((p) => p && p.profile === profile),
    logs: logs.filter((l) => { if (!l) return false; const lp = l.profile || ownerOf.get(l.protocolId); return !lp || lp === profile; }),
    vials: vials.filter((v) => { if (!v) return false; const vp = v.inventoryProfile || v.profile; return !vp || vp === profile; })
  };
}
__name(sliceForProfile, "sliceForProfile");
// Read what the tools should see for `profile`: the shared record (protocol:all) sliced down when it
// exists, else the legacy per-profile key (protocol:<profile>) so the old app keeps working until the
// new one has pushed once. _source says which one answered.
async function loadState(env, profile) {
  const all = await readBlob(env, ALL_KEY);
  if (all && !all._corrupt) return { ...sliceForProfile(all, profile), _source: "all" };
  const own = await readBlob(env, `protocol:${profile}`);
  if (!own) return { _empty: true, _source: "profile", protocols: [], logs: [], vials: [], storage: [] };
  if (own._corrupt) return { _empty: true, _corrupt: true, _source: "profile", protocols: [], logs: [], vials: [], storage: [] };
  return { ...own, _source: "profile" };
}
__name(loadState, "loadState");
function round2(n) {
  return Math.round(n * 100) / 100;
}
__name(round2, "round2");
function fmtDose(mcg, doseValue, doseUnit) {
  if (doseUnit && doseValue != null) return `${round2(Number(doseValue))} ${doseUnit}`;
  if (mcg == null || isNaN(mcg)) return "?";
  return mcg >= 1e3 ? `${round2(mcg / 1e3)}mg` : `${round2(mcg)}mcg`;
}
__name(fmtDose, "fmtDose");
function canonicalizeDose(o) {
  if (!o || typeof o !== "object") return o;
  const m = Number(o.doseMcg);
  const tagged = o.doseUnit != null || o.doseValue != null;
  if (!Number.isFinite(m) || m <= 0) return tagged ? { ...o, doseUnit: null, doseValue: null } : o;
  let dv;
  if (o.doseUnit === "mg") dv = m / 1e3;
  else if (o.doseUnit === "g") dv = m / 1e6;
  else if (o.doseUnit === "IU") dv = m;
  else return tagged ? { ...o, doseUnit: null, doseValue: null } : o;
  return o.doseValue === dv ? o : { ...o, doseValue: dv };
}
__name(canonicalizeDose, "canonicalizeDose");
function canonicalizeState(state) {
  if (!state || typeof state !== "object") return state;
  const out = { ...state };
  if (Array.isArray(state.protocols)) out.protocols = state.protocols.map(canonicalizeDose);
  if (Array.isArray(state.logs)) out.logs = state.logs.map(canonicalizeDose);
  return out;
}
__name(canonicalizeState, "canonicalizeState");
function scheduleDays(p) {
  const d = p.schedule && p.schedule.days;
  if (d === void 0 || d === null) return { days: [0, 1, 2, 3, 4, 5, 6], prn: false };
  if (Array.isArray(d) && d.length === 0) return { days: [], prn: true };
  return { days: d, prn: false };
}
__name(scheduleDays, "scheduleDays");
var normName = /* @__PURE__ */ __name((s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, ""), "normName");
function keyOf(o) {
  const pid = o && o.peptideId;
  if (pid && pid !== "__custom__" && pid !== "") return "id:" + pid;
  return "nm:" + normName(o && (o.peptideName || o.peptide || o.customName));
}
__name(keyOf, "keyOf");

// ===== SCHEDULE-RULES-BEGIN =====
// Mirrors the app's schedule engine (index.html, SCHEDULE-ENGINE block) so Claude's tools agree
// with the app on WHEN a compound is due:
//   schedule.every>1 + schedule.anchor  → interval schedule ("every other day" = 2)
//   startDate / endDate                 → the compound exists only inside that range (Finish cycle)
//   timeline[{from, schedule, doseMcg}] → dated plan revisions; base fields mirror TODAY's entry
// Day keys are 'YYYY-MM-DD' (America/New_York local days, via localParts). Day arithmetic runs at
// UTC noon so DST can never shift a day. Everything lives on ONE name (SCHED).
var SCHED = (() => {
  const DAY_MS = 864e5;
  const dkParse = (dk) => { if (!dk || typeof dk !== "string") return NaN; const p = dk.slice(0, 10).split("-"); if (p.length < 3) return NaN; return Date.UTC(+p[0], +p[1] - 1, +p[2], 12); };
  const dkFromUTC = (t) => new Date(t).toISOString().slice(0, 10);
  const dkAdd = (dk, n) => { const t = dkParse(dk); return isNaN(t) ? dk : dkFromUTC(t + n * DAY_MS); };
  const dkDiff = (a, b) => Math.round((dkParse(a) - dkParse(b)) / DAY_MS);
  const dkDow = (dk) => new Date(dkParse(dk)).getUTCDay();
  const dkOf = (v) => (v == null ? null : String(v).slice(0, 10));
  // The protocol as it stands on day dk (dated plan revisions applied).
  const protoAt = (p, dk) => {
    if (!p || !Array.isArray(p.timeline) || !p.timeline.length) return p;
    const tl = p.timeline.slice().sort((a, b) => (a.from == null ? -1 : b.from == null ? 1 : a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
    let pick = null; for (const e of tl) { if (e.from == null || e.from <= dk) pick = e; else break; }
    if (!pick) pick = tl[0];
    const out = { ...p }; for (const k of ["schedule", "doseMcg", "doseUnit", "doseValue"]) if (pick[k] !== undefined) out[k] = pick[k];
    return canonicalizeDose(out);
  };
  const isPrnSched = (s) => { const d = s && s.days; return !(s && +s.every > 1) && Array.isArray(d) && d.length === 0; };
  // Due on dk? (pass the protoAt-resolved protocol)
  const dueOn = (p, dk) => {
    const s = (p && p.schedule) || {};
    if (+s.every > 1) { const a = dkOf(s.anchor) || dkOf(p.startDate); if (isNaN(dkParse(a))) return true; const n = +s.every, diff = dkDiff(dk, a); return ((diff % n) + n) % n === 0; }
    const days = s.days || [0, 1, 2, 3, 4, 5, 6]; if (!days.length) return false; return days.includes(dkDow(dk));
  };
  // On the calendar on dk? Archived (active:false, no endDate) is hidden everywhere; a finished
  // cycle stays visible inside its date range.
  const activeOn = (p, dk) => {
    if (!p) return false;
    const e = dkOf(p.endDate), s = dkOf(p.startDate);
    if (p.active === false && isNaN(dkParse(e))) return false;
    if (!isNaN(dkParse(s)) && dk < s) return false;
    if (!isNaN(dkParse(e)) && dk > e) return false;
    return true;
  };
  // Scheduled (non-PRN, due) on dk, resolved — the one call the tools need.
  const scheduledOn = (protocols, dk) => (protocols || []).filter((p) => activeOn(p, dk)).map((p) => protoAt(p, dk)).filter((p) => !isPrnSched(p.schedule) && dueOn(p, dk));
  const schedLabel = (s) => {
    s = s || {};
    if (+s.every > 1) return +s.every === 2 ? "Every other day" : `Every ${s.every} days`;
    const d = s.days || [0, 1, 2, 3, 4, 5, 6]; if (d.length === 7) return "Daily"; if (!d.length) return "PRN";
    const dn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; return d.map((x) => dn[x]).join("/");
  };
  return { dkParse, dkFromUTC, dkAdd, dkDiff, dkDow, dkOf, protoAt, isPrnSched, dueOn, activeOn, scheduledOn, schedLabel };
})();
// ===== SCHEDULE-RULES-END =====

var TOOLS = [
  { name: "get_adherence", description: "Get protocol adherence over the last N days: per-compound EXPECTED (from each compound's schedule on each day — every-other-day, dated plan changes and finished cycles respected) vs LOGGED, with missed/extra/skipped counts and an adherence %, plus a per-day breakdown. Skipped doses are NOT taken: they are reported under `skipped` and count as missed. Dates are America/New_York local. PRN/unscheduled compounds are reported separately (not scored).", inputSchema: { type: "object", properties: { days: { type: "number", description: "How many days back (default 7)" } }, required: [] } },
  { name: "get_today", description: "Get what is scheduled for today (America/New_York), what has actually been logged so far today, what was explicitly skipped today (`skipped`, not counted as taken) and what is still due.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "get_logs_for_date", description: "Get all administration logs for a specific date (YYYY-MM-DD, local). Each compound dosed, dose amount, time, injection site. Explicit skips are listed separately under `skipped` (compound + time), never as doses.", inputSchema: { type: "object", properties: { date: { type: "string", description: "Date in YYYY-MM-DD" } }, required: ["date"] } },
  { name: "get_protocol", description: "Get the current active protocol — every compound with dose, units, schedule (which days / every other day), timing, plus any end date or upcoming dated plan change. The plan, not the completion record. Also reports workerVersion and which record answered (source: 'all' = shared record, 'profile' = legacy per-profile key).", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "propose_change", description: "Propose a protocol change for the owner to review in the app (Data & sync → Claude proposals). Nothing changes until it is approved there — a proposal is inert. Give the profile, the compound (protocolId, or peptideName matched case-insensitively against that profile's protocols), the change (any of doseMcg [in mcg; the IU number for IU doses] + doseUnit, schedule {days 0-6 / timeOfDay / every}, endDate, note) and a short rationale. effectiveFrom defaults to today (America/New_York). Returns the proposal id and a one-line summary.", inputSchema: { type: "object", properties: { profile: { type: "string", description: "Profile the change is for (Roman, Scott, Jamal, Tim)" }, protocolId: { type: "string", description: "The protocol's id (from the app)" }, peptideName: { type: "string", description: "Compound name as shown by get_protocol (case-insensitive)" }, change: { type: "object", description: "What to change (at least one field)", properties: { doseMcg: { type: "number", description: "New dose in mcg (the IU number for IU doses); must be > 0" }, doseUnit: { type: "string", enum: DOSE_UNITS }, schedule: { type: "object", properties: { days: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 }, description: "Weekdays 0=Sun … 6=Sat; [] = PRN" }, timeOfDay: { type: "string", description: "morning | pre-workout | evening | bedtime …" }, every: { type: "integer", minimum: 1, description: "Every N days (2 = every other day)" } } }, endDate: { type: "string", description: "YYYY-MM-DD, last day of the cycle" }, note: { type: "string" } } }, rationale: { type: "string", description: "Why, in one or two sentences" }, effectiveFrom: { type: "string", description: "YYYY-MM-DD (default: today)" } }, required: ["profile", "change", "rationale"] } },
  { name: "get_proposals", description: "List the protocol-change proposals for a profile with their status (pending until the owner approves or dismisses them in the app). status: pending | approved | dismissed | all (default all). Pending first, then newest first.", inputSchema: { type: "object", properties: { profile: { type: "string" }, status: { type: "string", enum: ["pending", "approved", "dismissed", "all"] } }, required: ["profile"] } }
];
async function callTool(name, args, env, profile) {
  if (name === "propose_change") return proposeChange(env, args || {});
  if (name === "get_proposals") return getProposals(env, args || {}, profile);
  const state = await loadState(env, profile);
  const logs = state.logs || [];
  const allProtocols = state.protocols || [];
  const { date: todayDk } = localParts(/* @__PURE__ */ new Date());
  // On the calendar today (start/end dates and Finish cycle respected), resolved to the plan
  // revision in force today.
  const protocols = allProtocols.filter((p) => SCHED.activeOn(p, todayDk)).map((p) => SCHED.protoAt(p, todayDk));
  if (name === "get_protocol") {
    const list = protocols.map((p) => {
      const next = Array.isArray(p.timeline) ? p.timeline.filter((e) => e.from && e.from > todayDk).sort((a, b) => a.from < b.from ? -1 : 1)[0] : null;
      return {
        name: p.peptideName,
        dose: fmtDose(p.doseMcg, p.doseValue, p.doseUnit),
        days: SCHED.schedLabel(p.schedule),
        timing: p.schedule && p.schedule.timeOfDay || "",
        ...p.endDate ? { endsOn: SCHED.dkOf(p.endDate) } : {},
        ...next ? { nextChange: { from: next.from, days: SCHED.schedLabel(next.schedule), dose: fmtDose(next.doseMcg, next.doseValue, next.doseUnit) } } : {}
      };
    });
    return { activeCount: protocols.length, lastSynced: state._syncedAt || null, rev: state._rev || 0, scheduleRules: "v1", workerVersion: VERSION, source: state._source || "profile", profile, protocols: list };
  }
  if (name === "get_logs_for_date") {
    const date = args.date;
    const day = logs.filter((l) => logLocalDate(l) === date);
    const doses = day.filter(isDose), skips = day.filter(isSkip);
    return {
      date,
      count: doses.length,
      logs: doses.map((l) => ({ compound: l.peptide || l.peptideName || l.peptideId, dose: fmtDose(l.doseMcg, l.doseValue, l.doseUnit), doseMl: l.doseMl, time: l.datetime, site: l.site || null, ...l.backfilled ? { backdated: true } : {} })),
      skippedCount: skips.length,
      skipped: skips.map(skipEntry)
    };
  }
  if (name === "get_today") {
    const today = todayDk;
    const due = SCHED.scheduledOn(allProtocols, today);
    const scheduled = due.map((p) => ({ name: p.peptideName, dose: fmtDose(p.doseMcg, p.doseValue, p.doseUnit), timing: p.schedule && p.schedule.timeOfDay || "" }));
    const todayLogs = logs.filter((l) => logLocalDate(l) === today);
    const doses = todayLogs.filter(isDose), skips = todayLogs.filter(isSkip);
    const taken = doses.map((l) => ({ compound: l.peptide || l.peptideName || l.peptideId, dose: fmtDose(l.doseMcg, l.doseValue, l.doseUnit), time: l.datetime }));
    const skipped = skips.map(skipEntry);
    const takenKeys = new Set(doses.map(keyOf));
    const skipKeys = new Set(skips.map(keyOf));
    // Still due = scheduled, not taken and not explicitly skipped (a skip is a decision, not a gap).
    const stillDue = due.filter((p) => !takenKeys.has(keyOf(p)) && !skipKeys.has(keyOf(p))).map((p) => p.peptideName);
    return { date: today, tz: TZ, scheduledCount: scheduled.length, scheduled, loggedCount: taken.length, logged: taken, skippedCount: skipped.length, skipped, stillDue };
  }
  if (name === "get_adherence") {
    const days = args.days || 7;
    // Calendar stepping on the day key (UTC-noon arithmetic in SCHED.dkAdd): today's local date,
    // then one key per day back. Date.now() − i·86400000 is NOT used — around the DST change that
    // skips or duplicates a local day.
    const windowDates = [];
    for (let i = 0; i < days; i++) { const d = SCHED.dkAdd(todayDk, -i); windowDates.push({ date: d, dow: SCHED.dkDow(d) }); }
    const windowSet = new Set(windowDates.map((w) => w.date));
    const inWindow = logs.filter((l) => windowSet.has(logLocalDate(l)));
    const recent = inWindow.filter(isDose), recentSkips = inWindow.filter(isSkip);
    const loggedByComp = {}, byDay = {};
    const nameOfLog = (l) => l.peptide || l.peptideName || l.customName || l.peptideId || "?";
    const bump = (l, field) => {
      const k = keyOf(l);
      if (!loggedByComp[k]) loggedByComp[k] = { name: nameOfLog(l), logged: 0, skipped: 0 };
      loggedByComp[k][field]++;
      const d = logLocalDate(l);
      if (!byDay[d]) byDay[d] = { doses: 0, skipped: 0 };
      byDay[d][field === "logged" ? "doses" : "skipped"]++;
    };
    for (const l of recent) bump(l, "logged");
    for (const l of recentSkips) bump(l, "skipped");
    const scored = [], prnOrUnscheduled = [];
    for (const p of allProtocols) {
      // Expected is counted DAY BY DAY: a cycle finished mid-window still counts up to its end
      // date, an every-other-day compound counts only its due days, and a dated plan change
      // applies from its date.
      const activeDays = windowDates.filter((w) => SCHED.activeOn(p, w.date));
      if (!activeDays.length) continue;
      const k = keyOf(p);
      const logged = loggedByComp[k] && loggedByComp[k].logged || 0;
      const skipped = loggedByComp[k] && loggedByComp[k].skipped || 0;
      if (loggedByComp[k]) loggedByComp[k]._matched = true;
      const prnAll = activeDays.every((w) => SCHED.isPrnSched(SCHED.protoAt(p, w.date).schedule));
      if (prnAll) {
        prnOrUnscheduled.push({ name: p.peptideName, logged, skipped });
        continue;
      }
      const expected = activeDays.filter((w) => { const pr = SCHED.protoAt(p, w.date); return !SCHED.isPrnSched(pr.schedule) && SCHED.dueOn(pr, w.date); }).length;
      // missed = expected − logged: a skipped day is a missed day, not a taken one.
      scored.push({ name: p.peptideName, expected, logged, skipped, missed: Math.max(0, expected - logged), extra: Math.max(0, logged - expected), adherencePct: expected ? Math.round(Math.min(logged, expected) / expected * 100) : null });
    }
    const unmatched = Object.values(loggedByComp).filter((v) => !v._matched).map((v) => ({ name: v.name, logged: v.logged, skipped: v.skipped }));
    return {
      windowDays: days,
      from: windowDates[windowDates.length - 1].date,
      to: todayDk,
      tz: TZ,
      totalDoses: recent.length,
      totalSkipped: recentSkips.length,
      activeProtocols: protocols.length,
      lastSynced: state._syncedAt || null,
      scheduled: scored.sort((a, b) => b.missed - a.missed),
      prnOrUnscheduled,
      unmatchedLogged: unmatched,
      byDay: Object.keys(byDay).sort().map((d) => ({ date: d, doses: byDay[d].doses, skipped: byDay[d].skipped }))
    };
  }
  throw new Error(`Unknown tool: ${name}`);
}
__name(callTool, "callTool");
async function handleRpc(body, env, profile) {
  const { id, method, params } = body;
  if (id === void 0 || id === null) return null;
  let result, error;
  try {
    switch (method) {
      case "initialize":
        result = { protocolVersion: MCP_VERSION, capabilities: { tools: {} }, serverInfo: { name: "protocol-os-sync", version: VERSION } };
        break;
      case "ping":
        result = {};
        break;
      case "tools/list":
        result = { tools: TOOLS };
        break;
      case "tools/call": {
        const out = await callTool(params.name, params.arguments || {}, env, profile);
        result = { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], isError: false };
        break;
      }
      case "resources/list":
        result = { resources: [] };
        break;
      case "prompts/list":
        result = { prompts: [] };
        break;
      default:
        error = { code: -32601, message: `Method not found: ${method}` };
    }
  } catch (e) {
    error = { code: -32e3, message: String(e.message || e) };
  }
  return { jsonrpc: "2.0", id, ...error ? { error } : { result } };
}
__name(handleRpc, "handleRpc");
function validateState(obj) {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return "body must be a JSON object";
  for (const k of ["protocols", "logs", "vials", "storage"]) {
    if (obj[k] !== void 0 && !Array.isArray(obj[k])) return `"${k}" must be an array`;
  }
  return null;
}
__name(validateState, "validateState");
var DK_RE = /^\d{4}-\d{2}-\d{2}$/;
// Daily snapshot: the first accepted POST of each America/New_York day freezes the NEW blob under
// protocol:<key>:snap:YYYY-MM-DD for 30 days. Never throws — a snapshot failure must not fail the POST.
async function writeDailySnapshot(env, key, blob, dk) {
  try {
    const snapKey = `${key}:snap:${dk}`;
    const exists = await env.PROTOCOL_KV.get(snapKey);
    if (exists) return false;
    await env.PROTOCOL_KV.put(snapKey, blob, { expirationTtl: SNAP_TTL_SECONDS });
    return true;
  } catch {
    return false;
  }
}
__name(writeDailySnapshot, "writeDailySnapshot");
// Page through a KV prefix (bounded) and return the key names.
async function listKeys(env, prefix) {
  const out = [];
  let cursor;
  for (let i = 0; i < 20; i++) {
    const page = await env.PROTOCOL_KV.list({ prefix, cursor });
    for (const k of page && page.keys || []) out.push(String(k.name));
    if (!page || page.list_complete !== false || !page.cursor) break;
    cursor = page.cursor;
  }
  return out;
}
__name(listKeys, "listKeys");
async function listSnapshots(env, key) {
  const prefix = `${key}:snap:`;
  const names = await listKeys(env, prefix);
  return names.map((n) => n.slice(prefix.length)).filter((d) => DK_RE.test(d)).sort().reverse();
}
__name(listSnapshots, "listSnapshots");
async function readJsonBody(request) {
  try {
    const t = await request.text();
    return t ? JSON.parse(t) : {};
  } catch {
    return void 0;
  }
}
__name(readJsonBody, "readJsonBody");

// ===== PROPOSALS-BEGIN =====
// Claude's suggested protocol changes. A proposal is inert: it changes nothing until the owner approves
// it in the app (the app then edits the protocol itself and pushes through /sync as usual).
// proposals:<profile> = JSON array, newest first, at most PROPOSALS_CAP entries.
async function readProposals(env, profile) {
  const s = await env.PROTOCOL_KV.get(`${PROPOSALS_PREFIX}${profile}`);
  if (!s) return [];
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) ? a.filter((p) => p && typeof p === "object" && p.id) : [];
  } catch {
    return [];
  }
}
__name(readProposals, "readProposals");
async function writeProposals(env, profile, list) {
  await env.PROTOCOL_KV.put(`${PROPOSALS_PREFIX}${profile}`, JSON.stringify(list.slice(0, PROPOSALS_CAP)));
}
__name(writeProposals, "writeProposals");
async function proposalProfiles(env) {
  return (await listKeys(env, PROPOSALS_PREFIX)).map((n) => n.slice(PROPOSALS_PREFIX.length)).filter(Boolean);
}
__name(proposalProfiles, "proposalProfiles");
async function readAllProposals(env) {
  const out = [];
  for (const prof of await proposalProfiles(env)) out.push(...await readProposals(env, prof));
  return out;
}
__name(readAllProposals, "readAllProposals");
var isPending = /* @__PURE__ */ __name((p) => !!p && p.status === "pending", "isPending");
// Pending count for one profile, or across every profile for "all". Never throws (0 on any failure).
async function pendingProposalCount(env, profile) {
  try {
    const list = profile === "all" ? await readAllProposals(env) : await readProposals(env, profile);
    return list.filter(isPending).length;
  } catch {
    return 0;
  }
}
__name(pendingProposalCount, "pendingProposalCount");
// Pending first, then newest first.
function sortProposals(list) {
  return list.slice().sort((a, b) => (isPending(a) === isPending(b) ? 0 : isPending(a) ? -1 : 1) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}
__name(sortProposals, "sortProposals");
function shortDate(dk) {
  const t = SCHED.dkParse(dk);
  if (isNaN(t)) return String(dk);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(t));
}
__name(shortDate, "shortDate");
// 'Proposed for Roman: Testosterone 25 mg daily from Oct 5'
function proposalSummary(pr, unitFallback) {
  const c = pr.change || {};
  const bits = [];
  if (c.doseMcg != null) {
    const d = canonicalizeDose({ doseMcg: c.doseMcg, doseUnit: c.doseUnit || unitFallback || null });
    bits.push(fmtDose(d.doseMcg, d.doseValue, d.doseUnit));
  } else if (c.doseUnit) bits.push(`in ${c.doseUnit}`);
  if (c.schedule) {
    const l = SCHED.schedLabel(c.schedule);
    bits.push(l.includes("/") ? l : l.toLowerCase());
  }
  if (c.endDate) bits.push(`ends ${shortDate(c.endDate)}`);
  else if (c.endDate === null) bits.push("no end date");
  if (c.note && !bits.length) bits.push("(note)");
  return `Proposed for ${pr.profile}: ${pr.peptideName}${bits.length ? " " + bits.join(" ") : ""} from ${shortDate(pr.effectiveFrom)}`;
}
__name(proposalSummary, "proposalSummary");
var CHANGE_FIELDS = ["doseMcg", "doseUnit", "schedule", "endDate", "note"];
function validateChange(change) {
  if (!change || typeof change !== "object" || Array.isArray(change)) return { error: "change must be an object with at least one of doseMcg, doseUnit, schedule, endDate, note" };
  const unknown = Object.keys(change).filter((k) => !CHANGE_FIELDS.includes(k));
  if (unknown.length) return { error: `unknown change field(s): ${unknown.join(", ")} (allowed: ${CHANGE_FIELDS.join(", ")})` };
  const out = {};
  if (change.doseMcg !== void 0) {
    const n = Number(change.doseMcg);
    if (!Number.isFinite(n) || n <= 0) return { error: "change.doseMcg must be a number > 0 (mcg; for IU doses the IU number)" };
    out.doseMcg = n;
  }
  if (change.doseUnit !== void 0) {
    if (!DOSE_UNITS.includes(change.doseUnit)) return { error: `change.doseUnit must be one of ${DOSE_UNITS.join(" | ")}` };
    out.doseUnit = change.doseUnit;
  }
  if (change.schedule !== void 0) {
    const s = change.schedule;
    if (!s || typeof s !== "object" || Array.isArray(s)) return { error: "change.schedule must be an object {days?, timeOfDay?, every?}" };
    const sc = {};
    if (s.days !== void 0) {
      if (!Array.isArray(s.days) || !s.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) return { error: "change.schedule.days must be an array of integers 0 (Sun) – 6 (Sat)" };
      sc.days = [...new Set(s.days)].sort((a, b) => a - b);
    }
    if (s.timeOfDay !== void 0) {
      if (typeof s.timeOfDay !== "string" || s.timeOfDay.length > 40) return { error: "change.schedule.timeOfDay must be a short string" };
      sc.timeOfDay = s.timeOfDay;
    }
    if (s.every !== void 0) {
      if (!Number.isInteger(s.every) || s.every < 1 || s.every > 60) return { error: "change.schedule.every must be an integer between 1 and 60" };
      sc.every = s.every;
    }
    if (s.anchor !== void 0) {
      if (!DK_RE.test(String(s.anchor))) return { error: "change.schedule.anchor must be YYYY-MM-DD" };
      sc.anchor = String(s.anchor);
    }
    if (!Object.keys(sc).length) return { error: "change.schedule is empty" };
    out.schedule = sc;
  }
  if (change.endDate !== void 0) {
    if (change.endDate !== null && !DK_RE.test(String(change.endDate))) return { error: "change.endDate must be YYYY-MM-DD (or null to remove the end date)" };
    out.endDate = change.endDate;
  }
  if (change.note !== void 0) {
    if (typeof change.note !== "string") return { error: "change.note must be a string" };
    out.note = change.note.slice(0, 1e3);
  }
  if (!Object.keys(out).length) return { error: "change must contain at least one of doseMcg, doseUnit, schedule, endDate, note" };
  return { change: out };
}
__name(validateChange, "validateChange");
// protocolId wins; else peptideName (also matched against peptideId / customName), case-insensitive.
// Several matches → the one on the calendar today.
function findProtocol(protocols, { protocolId, peptideName }, todayDk) {
  let cands = [];
  if (protocolId != null && protocolId !== "") cands = protocols.filter((p) => p && String(p.id) === String(protocolId));
  else if (peptideName) {
    const want = normName(peptideName);
    cands = protocols.filter((p) => p && want && (normName(p.peptideName) === want || normName(p.peptideId) === want || normName(p.customName) === want));
  }
  if (!cands.length) return null;
  return cands.find((p) => SCHED.activeOn(p, todayDk)) || cands[0];
}
__name(findProtocol, "findProtocol");
async function proposeChange(env, args) {
  const profile = cleanProfile(args.profile);
  if (!profile) throw new Error("profile is required");
  const hasId = args.protocolId != null && args.protocolId !== "";
  const hasName = typeof args.peptideName === "string" && args.peptideName.trim() !== "";
  if (!hasId && !hasName) throw new Error("protocolId or peptideName is required");
  const rationale = typeof args.rationale === "string" ? args.rationale.trim() : "";
  if (!rationale) throw new Error("rationale is required");
  const { error, change } = validateChange(args.change);
  if (error) throw new Error(error);
  const todayDk = localParts(/* @__PURE__ */ new Date()).date;
  let effectiveFrom = todayDk;
  if (args.effectiveFrom !== void 0 && args.effectiveFrom !== null && args.effectiveFrom !== "") {
    if (!DK_RE.test(String(args.effectiveFrom))) throw new Error("effectiveFrom must be YYYY-MM-DD");
    effectiveFrom = String(args.effectiveFrom);
  }
  const state = await loadState(env, profile);
  const protocols = state.protocols || [];
  const proto = findProtocol(protocols, args, todayDk);
  if (!proto) {
    const known = protocols.map((p) => p && p.peptideName).filter(Boolean).join(", ") || "none";
    throw new Error(hasId ? `No protocol with id "${args.protocolId}" for ${profile}` : `No protocol named "${args.peptideName}" for ${profile} (known: ${known})`);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const pr = {
    id: "pr_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12),
    profile,
    protocolId: proto.id,
    peptideName: proto.peptideName || proto.customName || String(proto.peptideId || ""),
    change,
    rationale: rationale.slice(0, 2e3),
    effectiveFrom,
    status: "pending",
    createdAt: now,
    createdBy: "mcp",
    resolvedAt: null,
    resolution: null
  };
  pr.summary = proposalSummary(pr, proto.doseUnit);
  const list = await readProposals(env, profile);
  await writeProposals(env, profile, [pr, ...list.filter((p) => p.id !== pr.id)]);
  return { ok: true, id: pr.id, summary: pr.summary, proposal: pr };
}
__name(proposeChange, "proposeChange");
async function getProposals(env, args, fallbackProfile) {
  const profile = cleanProfile(args.profile) || fallbackProfile;
  const status = args.status || "all";
  if (status !== "all" && !PROPOSAL_STATUSES.includes(status)) throw new Error("status must be pending | approved | dismissed | all");
  const list = profile === "all" ? await readAllProposals(env) : await readProposals(env, profile);
  const filtered = sortProposals(status === "all" ? list : list.filter((p) => p.status === status));
  return { profile, status, count: filtered.length, pendingCount: list.filter(isPending).length, proposals: filtered };
}
__name(getProposals, "getProposals");
async function resolveProposal(env, id, status, note) {
  for (const prof of await proposalProfiles(env)) {
    const list = await readProposals(env, prof);
    const i = list.findIndex((p) => p.id === id);
    if (i < 0) continue;
    const updated = { ...list[i], status, resolvedAt: (/* @__PURE__ */ new Date()).toISOString(), resolution: note ? String(note).slice(0, 1e3) : null, resolvedBy: "app" };
    list[i] = updated;
    await writeProposals(env, prof, list);
    return updated;
  }
  return null;
}
__name(resolveProposal, "resolveProposal");
async function handleProposals(request, url, env, { isFull, profile, json }) {
  if (!isFull) return json({ error: "Read-only token cannot use the proposal inbox over HTTP. Use SYNC_TOKEN." }, 403);
  if (url.pathname === "/proposals") {
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
    const status = url.searchParams.get("status") || "all";
    if (status !== "all" && !PROPOSAL_STATUSES.includes(status)) return json({ error: "status must be pending | approved | dismissed | all" }, 400);
    const list = profile === "all" ? await readAllProposals(env) : await readProposals(env, profile);
    const filtered = sortProposals(status === "all" ? list : list.filter((p) => p.status === status));
    return json({ profile, status, pendingCount: list.filter(isPending).length, proposals: filtered });
  }
  const id = decodeURIComponent(url.pathname.slice("/proposals/".length));
  if (!/^pr_[A-Za-z0-9]{4,32}$/.test(id)) return json({ error: "Not found" }, 404);
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readJsonBody(request);
  if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);
  if (body.status !== "approved" && body.status !== "dismissed") return json({ error: "status must be approved or dismissed" }, 400);
  if (body.note !== void 0 && body.note !== null && typeof body.note !== "string") return json({ error: "note must be a string" }, 400);
  const updated = await resolveProposal(env, id, body.status, body.note);
  if (!updated) return json({ error: `No proposal ${id}` }, 404);
  return json({ ok: true, proposal: updated });
}
__name(handleProposals, "handleProposals");
// ===== PROPOSALS-END =====

// ===== PUSH-BEGIN =====
// Web Push from the worker with crypto.subtle only (no library):
//  - VAPID (RFC 8292): ES256 JWT {aud: push-service origin, exp: now+12h, sub: VAPID_SUBJECT}, signed
//    with the private scalar in VAPID_PRIVATE_KEY (JWK built from the 65-byte public point + d);
//    header `Authorization: vapid t=<jwt>, k=<VAPID_PUBLIC_KEY>`.
//  - Payload (RFC 8291 + RFC 8188 aes128gcm): ephemeral ECDH P-256 against the subscription's p256dh,
//    IKM = HKDF(salt=auth, ikm=shared, "WebPush: info\0" ‖ ua_public ‖ as_public, 32),
//    CEK = HKDF(salt, IKM, "Content-Encoding: aes128gcm\0", 16), NONCE = HKDF(salt, IKM,
//    "Content-Encoding: nonce\0", 12), AES-128-GCM over plaintext ‖ 0x02,
//    body = salt(16) ‖ rs(4 = 4096) ‖ idlen(1 = 65) ‖ as_public(65) ‖ ciphertext.
// The pure helpers live on PUSH (like SCHED) so tests can call them directly.
var PUSH = (() => {
  const te = new TextEncoder();
  const b64uEncode = (bytes) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const b64uDecode = (str) => { const s = String(str || "").trim().replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, ""); const bin = atob(s + "=".repeat((4 - s.length % 4) % 4)); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
  const b64uNorm = (str) => b64uEncode(b64uDecode(str));
  const concat = (...arrs) => { const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0)); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out; };
  const hkdf = async (salt, ikm, info, length) => { const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]); return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8)); };
  const sha256hex = async (str) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", te.encode(String(str))))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const subscriptionId = async (endpoint) => (await sha256hex(endpoint)).slice(0, 24);
  const configured = (env) => !!(env && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
  const importVapidKey = async (publicKey, privateKey) => {
    const pub = b64uDecode(publicKey), d = b64uDecode(privateKey);
    if (pub.length !== 65 || pub[0] !== 4) throw new Error("VAPID_PUBLIC_KEY must be the base64url 65-byte uncompressed P-256 point");
    if (d.length !== 32) throw new Error("VAPID_PRIVATE_KEY must be the base64url 32-byte private scalar");
    const jwk = { kty: "EC", crv: "P-256", x: b64uEncode(pub.slice(1, 33)), y: b64uEncode(pub.slice(33, 65)), d: b64uEncode(d) };
    return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  };
  let keyCache = null;
  const vapidKey = async (env) => {
    if (!keyCache || keyCache.pub !== env.VAPID_PUBLIC_KEY || keyCache.priv !== env.VAPID_PRIVATE_KEY) keyCache = { pub: env.VAPID_PUBLIC_KEY, priv: env.VAPID_PRIVATE_KEY, key: await importVapidKey(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY) };
    return keyCache.key;
  };
  const vapidJwt = async (aud, sub, key, nowSec = Math.floor(Date.now() / 1e3), ttlSec = 12 * 3600) => {
    const enc = (o) => b64uEncode(te.encode(JSON.stringify(o)));
    const unsigned = `${enc({ typ: "JWT", alg: "ES256" })}.${enc({ aud, exp: nowSec + ttlSec, sub })}`;
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(unsigned));
    return `${unsigned}.${b64uEncode(new Uint8Array(sig))}`;
  };
  const vapidHeaders = async (endpoint, env) => {
    const key = await vapidKey(env);
    const jwt = await vapidJwt(new URL(endpoint).origin, env.VAPID_SUBJECT || PUSH_DEFAULT_SUBJECT, key);
    return { Authorization: `vapid t=${jwt}, k=${b64uNorm(env.VAPID_PUBLIC_KEY)}` };
  };
  const encrypt = async (plaintext, p256dh, auth) => {
    const uaPublic = b64uDecode(p256dh), authSecret = b64uDecode(auth);
    if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error("subscription p256dh must be a 65-byte uncompressed P-256 point");
    if (authSecret.length < 16) throw new Error("subscription auth secret must be 16 bytes");
    const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const ikm = await hkdf(authSecret, shared, concat(te.encode("WebPush: info\0"), uaPublic, asPublic), 32);
    const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
    const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
    const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
    const record = concat(plaintext instanceof Uint8Array ? plaintext : te.encode(String(plaintext)), new Uint8Array([2]));
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, record));
    const header = concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPublic.length]), asPublic);
    return concat(header, ciphertext);
  };
  // POST one encrypted payload to a subscription → {status, ok, gone}; gone = 404/410 (unsubscribed).
  const send = async (subscription, payload, env, { ttl = 3600, urgency = "high" } = {}) => {
    const { endpoint, keys } = subscription || {};
    if (!endpoint || !keys) throw new Error("subscription must have endpoint and keys");
    const body = await encrypt(te.encode(JSON.stringify(payload)), keys.p256dh, keys.auth);
    const headers = { ...await vapidHeaders(endpoint, env), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", "TTL": String(ttl), "Urgency": urgency };
    const res = await fetch(endpoint, { method: "POST", headers, body });
    return { status: res.status, ok: res.ok, gone: res.status === 404 || res.status === 410 };
  };
  return { b64uEncode, b64uDecode, concat, hkdf, sha256hex, subscriptionId, configured, importVapidKey, vapidJwt, vapidHeaders, encrypt, send };
})();
// --- subscription records (push:<id>) ---
// strict=true → an invalid time/nudge is an error (POST /push/subscribe); false → fall back to defaults.
function normalizeSettings(s, strict) {
  s = s && typeof s === "object" && !Array.isArray(s) ? s : {};
  const blocks = {}, times = {};
  for (const b of PUSH_BLOCKS) {
    const bv = s.blocks && typeof s.blocks === "object" ? s.blocks[b] : void 0;
    blocks[b] = bv === void 0 ? PUSH_DEFAULT_SETTINGS.blocks[b] : !!bv;
    const t = s.times && typeof s.times === "object" ? s.times[b] : void 0;
    if (t === void 0 || t === null || t === "") times[b] = PUSH_DEFAULT_SETTINGS.times[b];
    else if (typeof t === "string" && HM_RE.test(t)) times[b] = t;
    else if (strict) return { error: `settings.times.${b} must be HH:MM (24h)` };
    else times[b] = PUSH_DEFAULT_SETTINGS.times[b];
  }
  let n = s.nudgeMinutes === void 0 || s.nudgeMinutes === null ? 0 : Number(s.nudgeMinutes);
  if (!Number.isFinite(n) || n < 0 || n > 720) {
    if (strict) return { error: "settings.nudgeMinutes must be a number between 0 and 720" };
    n = 0;
  }
  return { settings: { blocks, times, nudgeMinutes: Math.round(n) } };
}
__name(normalizeSettings, "normalizeSettings");
function validateSubscription(sub) {
  if (!sub || typeof sub !== "object") return "subscription must be an object {endpoint, keys: {p256dh, auth}}";
  let u;
  try {
    u = new URL(String(sub.endpoint));
  } catch {
    return "subscription.endpoint must be an https URL";
  }
  if (u.protocol !== "https:") return "subscription.endpoint must be an https URL";
  const k = sub.keys;
  if (!k || typeof k !== "object" || typeof k.p256dh !== "string" || !k.p256dh || typeof k.auth !== "string" || !k.auth) return "subscription.keys.p256dh and subscription.keys.auth are required";
  try {
    if (PUSH.b64uDecode(k.p256dh).length !== 65) return "subscription.keys.p256dh must decode to 65 bytes";
    if (PUSH.b64uDecode(k.auth).length < 16) return "subscription.keys.auth must decode to 16 bytes";
  } catch {
    return "subscription keys must be base64url";
  }
  return null;
}
__name(validateSubscription, "validateSubscription");
async function readPushRecord(env, name) {
  const s = await env.PROTOCOL_KV.get(name);
  if (!s) return null;
  try {
    const r = JSON.parse(s);
    return r && r.id && r.subscription && r.subscription.endpoint ? r : null;
  } catch {
    return null;
  }
}
__name(readPushRecord, "readPushRecord");
async function listPushRecords(env, profile) {
  const out = [];
  for (const name of await listKeys(env, PUSH_PREFIX)) {
    const r = await readPushRecord(env, name);
    if (r && (!profile || profile === "all" || r.profile === profile)) out.push(r);
  }
  return out;
}
__name(listPushRecords, "listPushRecords");
// What the app may see: never the keys, never the full endpoint.
function publicPushRecord(r) {
  let host = "";
  try {
    host = new URL(r.subscription.endpoint).host;
  } catch {
  }
  return { id: r.id, profile: r.profile, settings: r.settings, tz: r.tz, device: r.device || null, createdAt: r.createdAt, updatedAt: r.updatedAt, endpointHost: host };
}
__name(publicPushRecord, "publicPushRecord");
// Send one payload to one stored subscription. A 404/410 from the push service deletes the record.
async function deliverPush(env, rec, payload) {
  try {
    const r = await PUSH.send(rec.subscription, payload, env);
    if (r.gone) {
      try {
        await env.PROTOCOL_KV.delete(`${PUSH_PREFIX}${rec.id}`);
      } catch {
      }
    }
    return { id: rec.id, status: r.status, ok: r.ok, gone: r.gone };
  } catch (e) {
    return { id: rec.id, status: 0, ok: false, gone: false, error: String(e && e.message || e) };
  }
}
__name(deliverPush, "deliverPush");
// --- the reminder pass behind the Cron Trigger ---
var hmToSec = /* @__PURE__ */ __name((hm) => typeof hm === "string" && HM_RE.test(hm) ? Number(hm.slice(0, 2)) * 3600 + Number(hm.slice(3, 5)) * 60 : null, "hmToSec");
// Did clock time tSec (seconds since local midnight) fall inside the last PUSH_WINDOW_SECONDS ending at
// nowSec (inclusive of now, so 08:00 fires on the 08:00 cron run)? → day offset of that time: 0 =
// today, -1 = it was just before midnight; null = not in the window.
function windowHit(tSec, nowSec) {
  const d = nowSec - tSec;
  if (d >= 0 && d < PUSH_WINDOW_SECONDS) return 0;
  if (d + 86400 >= 0 && d + 86400 < PUSH_WINDOW_SECONDS) return -1;
  return null;
}
__name(windowHit, "windowHit");
// Protocols of `block` scheduled on dk (same rules as get_today, PRN excluded) with neither a dose nor
// a skip logged that day — a skip is a decision, so it is never reminded about.
function dueForBlock(state, dk, block) {
  const due = SCHED.scheduledOn(state.protocols || [], dk).filter((p) => blockOf(p) === block);
  if (!due.length) return [];
  const handled = (state.logs || []).filter((l) => logLocalDate(l) === dk && (isDose(l) || isSkip(l)));
  const keys = new Set(handled.map(keyOf));
  const ids = new Set(handled.map((l) => l.protocolId).filter((x) => x != null));
  return due.filter((p) => !keys.has(keyOf(p)) && !ids.has(p.id));
}
__name(dueForBlock, "dueForBlock");
function reminderPayload(profile, block, dk, due, nudge) {
  const n = due.length;
  const list = due.map((p) => `${p.peptideName || p.customName || p.peptideId} ${fmtDose(p.doseMcg, p.doseValue, p.doseUnit)}`).join(", ");
  const title = nudge ? `Still due: ${PUSH_TITLES[block]}` : PUSH_TITLES[block];
  const body = `${n} dose${n === 1 ? "" : "s"} ${nudge ? "still " : ""}due: ${list}. Tap to open and log.`;
  return { title, body, data: { profile, block, date: dk, url: "./index.html#today", ...nudge ? { nudge: true } : {} } };
}
__name(reminderPayload, "reminderPayload");
// One pass: for every subscription, every enabled block whose time (and time + nudge) fell inside the
// last 15 minutes in the subscription's own time zone; one push per (subscription, day, block[, nudge]),
// deduped through pushsent:<id>:<dk>:<block>[:nudge] (2-day TTL). Never throws — errors are collected.
async function runReminders(env, now) {
  const summary = { at: now.toISOString(), subscriptions: 0, windows: 0, sent: 0, failed: 0, deduped: 0, errors: [] };
  try {
    if (!env || !env.PROTOCOL_KV) {
      summary.errors.push("KV namespace PROTOCOL_KV not bound");
      return summary;
    }
    if (!PUSH.configured(env)) {
      summary.errors.push("VAPID keys not configured (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)");
      return summary;
    }
    const names = await listKeys(env, PUSH_PREFIX);
    const states = /* @__PURE__ */ new Map();
    const stateFor = async (profile) => {
      if (!states.has(profile)) states.set(profile, await loadState(env, profile));
      return states.get(profile);
    };
    for (const name of names) {
      try {
        const rec = await readPushRecord(env, name);
        if (!rec) continue;
        summary.subscriptions++;
        const tz = validTz(rec.tz) ? rec.tz : TZ;
        const lp = localParts(now, tz);
        const nowSec = lp.hour * 3600 + lp.minute * 60 + lp.second;
        const { settings } = normalizeSettings(rec.settings, false);
        let gone = false;
        for (const block of PUSH_BLOCKS) {
          if (gone || !settings.blocks[block]) continue;
          const tSec = hmToSec(settings.times[block]);
          if (tSec == null) continue;
          const checks = [{ at: tSec, nudge: false }];
          if (settings.nudgeMinutes > 0) checks.push({ at: (tSec + settings.nudgeMinutes * 60) % 86400, nudge: true });
          for (const c of checks) {
            if (gone) break;
            const off = windowHit(c.at, nowSec);
            if (off === null) continue;
            summary.windows++;
            const dk = off ? SCHED.dkAdd(lp.date, off) : lp.date;
            const sentKey = `${PUSHSENT_PREFIX}${rec.id}:${dk}:${block}${c.nudge ? ":nudge" : ""}`;
            if (await env.PROTOCOL_KV.get(sentKey)) {
              summary.deduped++;
              continue;
            }
            const due = dueForBlock(await stateFor(rec.profile), dk, block);
            if (!due.length) continue;
            await env.PROTOCOL_KV.put(sentKey, now.toISOString(), { expirationTtl: PUSH_SENT_TTL_SECONDS });
            const r = await deliverPush(env, rec, reminderPayload(rec.profile, block, dk, due, c.nudge));
            if (r.ok) summary.sent++;
            else {
              summary.failed++;
              summary.errors.push(`${rec.id} ${block}${c.nudge ? " nudge" : ""}: ${r.error || "HTTP " + r.status}${r.gone ? " (subscription removed)" : ""}`);
            }
            if (r.gone) gone = true;
          }
        }
      } catch (e) {
        summary.errors.push(`${name}: ${String(e && e.message || e)}`);
      }
    }
  } catch (e) {
    summary.errors.push(String(e && e.message || e));
  }
  return summary;
}
__name(runReminders, "runReminders");
async function handlePush(request, url, env, { isFull, profile, json }) {
  if (!isFull) return json({ error: "Read-only token cannot manage push reminders. Use SYNC_TOKEN." }, 403);
  const path = url.pathname;
  if (path === "/push/config") {
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
    return json({ publicKey: env.VAPID_PUBLIC_KEY || null, enabled: PUSH.configured(env), subject: env.VAPID_SUBJECT || null, version: VERSION });
  }
  if (path === "/push/subscribe") {
    if (request.method === "POST") {
      const body = await readJsonBody(request);
      if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);
      const verr = validateSubscription(body.subscription);
      if (verr) return json({ error: verr }, 400);
      const prof = typeof body.profile === "string" ? cleanProfile(body.profile) : "";
      if (!prof) return json({ error: "profile is required" }, 400);
      if (prof === "all") return json({ error: "profile must be one person (reminders are per profile)" }, 400);
      const ns = normalizeSettings(body.settings, true);
      if (ns.error) return json({ error: ns.error }, 400);
      if (body.tz !== void 0 && body.tz !== null && body.tz !== "" && !validTz(body.tz)) return json({ error: "tz must be an IANA time zone (e.g. America/New_York)" }, 400);
      const endpoint = String(body.subscription.endpoint);
      const id = await PUSH.subscriptionId(endpoint);
      const key = `${PUSH_PREFIX}${id}`;
      const existing = await readPushRecord(env, key);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const rec = {
        id,
        profile: prof,
        subscription: { endpoint, keys: { p256dh: body.subscription.keys.p256dh, auth: body.subscription.keys.auth }, ...body.subscription.expirationTime != null ? { expirationTime: body.subscription.expirationTime } : {} },
        settings: ns.settings,
        tz: body.tz || existing && existing.tz || TZ,
        device: typeof body.device === "string" && body.device ? body.device.slice(0, 80) : existing && existing.device || null,
        createdAt: existing && existing.createdAt || now,
        updatedAt: now
      };
      await env.PROTOCOL_KV.put(key, JSON.stringify(rec));
      return json({ ok: true, id, updated: !!existing, subscription: publicPushRecord(rec) });
    }
    if (request.method === "DELETE") {
      const body = await readJsonBody(request);
      if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);
      let id = typeof body.id === "string" && /^[0-9a-f]{24}$/.test(body.id) ? body.id : null;
      if (!id && typeof body.endpoint === "string" && body.endpoint) id = await PUSH.subscriptionId(body.endpoint);
      if (!id) return json({ error: "endpoint (or id) is required" }, 400);
      const key = `${PUSH_PREFIX}${id}`;
      const existed = !!await env.PROTOCOL_KV.get(key);
      await env.PROTOCOL_KV.delete(key);
      return json({ ok: true, id, removed: existed });
    }
    return json({ error: "Method not allowed" }, 405);
  }
  if (path === "/push/subscriptions") {
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
    const recs = await listPushRecords(env, profile);
    return json({ profile, subscriptions: recs.map(publicPushRecord) });
  }
  if (path === "/push/test") {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!PUSH.configured(env)) return json({ error: "Push is not configured: add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT under Workers → Settings → Variables and Secrets." }, 503);
    const body = await readJsonBody(request) || {};
    const prof = typeof body.profile === "string" && cleanProfile(body.profile) || profile;
    const recs = await listPushRecords(env, prof);
    const payload = { title: "Protocol OS reminders", body: `Test notification for ${prof}. Reminders are set up on this device.`, data: { profile: prof, block: "test", date: localParts(/* @__PURE__ */ new Date()).date, url: "./index.html#today" } };
    const results = [];
    for (const rec of recs) results.push(await deliverPush(env, rec, payload));
    return json({ profile: prof, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results: results.map((r) => ({ id: r.id, status: r.status, ...r.error ? { error: r.error } : {}, ...r.gone ? { removed: true } : {} })) });
  }
  if (path === "/push/run") {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    return json(await runReminders(env, /* @__PURE__ */ new Date()));
  }
  return json({ error: "Not found" }, 404);
}
__name(handlePush, "handlePush");
// ===== PUSH-END =====
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { base, json, raw } = makeReply(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...corsFor(request), "Access-Control-Max-Age": "86400" } });
    if (url.pathname === "/health" || url.pathname === "/") return json({ status: "ok", server: "protocol-sync", version: VERSION });
    if (url.pathname.startsWith("/.well-known/") || url.pathname === "/register" || url.pathname === "/authorize" || url.pathname === "/token") {
      return json({ error: "not found — this server uses token-in-URL auth, not OAuth" }, 404);
    }
    const level = authLevel(request, url, env);
    const isFull = level === "full";
    const isRead = level === "read";
    if (!isFull && !isRead) return json({ error: "Unauthorized" }, 401);
    if (!env.PROTOCOL_KV) return json({ error: "KV namespace PROTOCOL_KV not bound" }, 500);
    const profileRaw = url.searchParams.get("profile") || "Roman";
    const profile = profileRaw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || "Roman";
    const key = `protocol:${profile}`;
    if (url.pathname === "/mcp") {
      if (request.method !== "POST") return raw("Method not allowed", 405);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
      }
      if (Array.isArray(body)) {
        const res2 = (await Promise.all(body.map((b) => handleRpc(b, env, profile)))).filter(Boolean);
        return json(res2);
      }
      const res = await handleRpc(body, env, profile);
      if (!res) return raw(null, 202);
      return json(res);
    }
    if (url.pathname.startsWith("/push/")) return handlePush(request, url, env, { isFull, profile, json });
    if (url.pathname === "/proposals" || url.pathname.startsWith("/proposals/")) return handleProposals(request, url, env, { isFull, profile, json });
    if (url.pathname === "/sync") {
      if (request.method === "GET") {
        // Snapshots (list + fetch) need the write token, like a POST.
        if (url.searchParams.get("snapshots")) {
          if (!isFull) return json({ error: "Read-only token cannot list snapshots. Use SYNC_TOKEN." }, 403);
          return json({ profile, snapshots: await listSnapshots(env, key) });
        }
        const snapDate = url.searchParams.get("snapshot");
        if (snapDate) {
          if (!isFull) return json({ error: "Read-only token cannot read snapshots. Use SYNC_TOKEN." }, 403);
          if (!DK_RE.test(snapDate)) return json({ error: "snapshot must be YYYY-MM-DD" }, 400);
          const snap = await env.PROTOCOL_KV.get(`${key}:snap:${snapDate}`);
          if (!snap) return json({ error: `No snapshot for ${snapDate}`, profile, snapshot: snapDate }, 404);
          return raw(snap, 200, { "Content-Type": "application/json", "X-Snapshot-Date": snapDate });
        }
        const k = url.searchParams.get("prev") ? `${key}:prev` : key;
        const stored = await env.PROTOCOL_KV.get(k);
        // _proposalsPending rides on every GET so the app learns about new proposals on its normal
        // pull: all profiles for ?profile=all, that profile's own count otherwise.
        const pending = await pendingProposalCount(env, profile);
        if (!stored) return json({ _empty: true, profile, protocols: [], logs: [], vials: [], storage: [], _proposalsPending: pending });
        let parsed = null;
        try {
          parsed = JSON.parse(stored);
        } catch {
        }
        const rev = parsed && parsed._rev || 0;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return json({ ...parsed, _proposalsPending: pending }, 200, { ETag: `"${rev}"` });
        return raw(stored, 200, { "Content-Type": "application/json", ETag: `"${rev}"` });
      }
      if (request.method === "POST") {
        if (!isFull) return json({ error: "Read-only token cannot write. Use SYNC_TOKEN for /sync writes." }, 403);
        let raw0, incoming;
        try {
          raw0 = await request.text();
          incoming = JSON.parse(raw0);
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
        const verr = validateState(incoming);
        if (verr) return json({ error: verr }, 400);
        incoming = canonicalizeState(incoming);
        delete incoming._proposalsPending;
        const prevRaw = await env.PROTOCOL_KV.get(key);
        const curRev = (() => {
          try {
            return prevRaw ? JSON.parse(prevRaw)._rev || 0 : 0;
          } catch {
            return 0;
          }
        })();
        const ifMatch = (request.headers.get("If-Match") || "").replace(/"/g, "");
        if (ifMatch && ifMatch !== String(curRev)) {
          return json({ error: "Stale write — protocol changed since you loaded it. Re-fetch (GET /sync) and retry.", currentRev: curRev }, 409);
        }
        if (prevRaw) await env.PROTOCOL_KV.put(`${key}:prev`, prevRaw);
        const nextRev = curRev + 1;
        const now = /* @__PURE__ */ new Date();
        const syncedAt = now.toISOString();
        const blob = JSON.stringify({ ...incoming, _rev: nextRev, _syncedAt: syncedAt, profile });
        await env.PROTOCOL_KV.put(key, blob);
        // Daily snapshot of the new blob; off the critical path when the runtime allows it.
        const snap = writeDailySnapshot(env, key, blob, localParts(now).date);
        if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(snap);
        else await snap;
        return json({ ok: true, profile, rev: nextRev, syncedAt }, 200, { ETag: `"${nextRev}"` });
      }
      return json({ error: "Method not allowed" }, 405);
    }
    return json({ error: "Not found" }, 404);
  },
  // Cron Trigger (`*/15 * * * *`, Workers → Settings → Triggers): send the reminders whose time fell in
  // the last 15 minutes. Never throws; the pass runs under ctx.waitUntil and its summary is returned.
  async scheduled(event, env, ctx) {
    const run = runReminders(env, /* @__PURE__ */ new Date()).catch((e) => ({ errors: [String(e && e.message || e)] }));
    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(run);
    return run;
  }
};
export {
  PUSH,
  SCHED,
  worker_default as default
};
