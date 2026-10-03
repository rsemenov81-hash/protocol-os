var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js — protocol-sync (Cloudflare Worker + KV): /sync API for the app, /mcp tools for Claude.
// v1.4.0: schedule rules (every-other-day, start/end dates, dated plan revisions) — see SCHED below.
// v1.5.0: skips are not doses (skipped rows reported separately, never counted as taken); one shared
//         record (?profile=all → KV protocol:all, tools filter by profile, per-profile keys stay as the
//         fallback); daily snapshots (protocol:<key>:snap:YYYY-MM-DD, 30-day TTL, list/fetch via /sync);
//         Bearer header preferred over ?token; CORS echoes only known origins; Cache-Control: no-store;
//         DST-safe adherence window (calendar stepping on the day key, not Date.now() − n·86400000).
var VERSION = "1.5.0";
var TZ = "America/New_York";
var DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
var ALL_KEY = "protocol:all";
var SNAP_TTL_SECONDS = 30 * 86400;
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
function localParts(instant) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(instant);
  return { date: ymd, dow: DOW[wd] };
}
__name(localParts, "localParts");
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
  { name: "get_protocol", description: "Get the current active protocol — every compound with dose, units, schedule (which days / every other day), timing, plus any end date or upcoming dated plan change. The plan, not the completion record. Also reports workerVersion and which record answered (source: 'all' = shared record, 'profile' = legacy per-profile key).", inputSchema: { type: "object", properties: {}, required: [] } }
];
async function callTool(name, args, env, profile) {
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
async function listSnapshots(env, key) {
  const prefix = `${key}:snap:`;
  const out = [];
  let cursor;
  for (let i = 0; i < 20; i++) {
    const page = await env.PROTOCOL_KV.list({ prefix, cursor });
    for (const k of page && page.keys || []) out.push(String(k.name).slice(prefix.length));
    if (!page || page.list_complete !== false || !page.cursor) break;
    cursor = page.cursor;
  }
  return out.filter((d) => DK_RE.test(d)).sort().reverse();
}
__name(listSnapshots, "listSnapshots");
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
        if (!stored) return json({ _empty: true, profile, protocols: [], logs: [], vials: [], storage: [] });
        const rev = (() => {
          try {
            return JSON.parse(stored)._rev || 0;
          } catch {
            return 0;
          }
        })();
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
  }
};
export {
  worker_default as default
};
