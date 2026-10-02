/**
 * Protocol-OS Cloud Sync + MCP Worker — Cloudflare Worker + KV
 *
 * TWO jobs in one worker:
 *  1. Sync API (the app uses this):   GET/POST /sync   — store/fetch protocol+logs
 *  2. MCP server (Claude chat uses):  POST /mcp        — adherence/protocol tools
 *
 * Setup (Cloudflare dashboard):
 *   1. Workers & Pages → your "protocol-sync" worker → Edit code → paste this → Deploy
 *   2. (already done) KV namespace bound as PROTOCOL_KV
 *   3. (already done) Secret SYNC_TOKEN set
 *
 * Add to Claude chat (web + iPhone):
 *   claude.ai → Settings → Connectors → Add custom connector
 *   URL:  https://protocol-sync.<you>.workers.dev/mcp?token=<SYNC_TOKEN>
 *   (token in the URL authenticates; profile defaults to Roman, or add &profile=X)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Accept",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};
const MCP_VERSION = "2024-11-05";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function getToken(request, url) {
  const q = url.searchParams.get("token");
  if (q) return q;
  const h = request.headers.get("Authorization") || "";
  return h.replace(/^Bearer\s+/i, "");
}

// ── data helpers ──────────────────────────────────────────────────────────────
async function loadState(env, profile) {
  const stored = await env.PROTOCOL_KV.get(`protocol:${profile}`);
  if (!stored) return { _empty: true, protocols: [], logs: [], vials: [], storage: [] };
  return JSON.parse(stored);
}
function fmtDose(mcg) {
  if (mcg == null) return "?";
  return mcg >= 1000 ? `${(mcg / 1000).toString()}mg` : `${mcg}mcg`;
}
function dayStr(d) {
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10);
}

// ===== SCHEDULE-RULES-BEGIN (portable — paste this whole block into the deployed worker too) =====
// Mirrors the app's schedule engine (index.html, SCHEDULE-ENGINE block) so Claude's tools agree
// with the app on WHEN a compound is due:
//   schedule.every>1 + schedule.anchor  → interval schedule ("every other day" = 2)
//   startDate / endDate                 → the compound exists only inside that range (Finish cycle)
//   timeline[{from, schedule, doseMcg}] → dated plan revisions; base fields mirror TODAY's entry
// Day keys are 'YYYY-MM-DD'. Arithmetic at UTC noon so DST can never shift a day.
// Everything lives on ONE name (SCHED) so the block can be dropped into any worker without
// colliding with its existing helpers.
const SCHED = (() => {
  const DAY_MS = 86400000;
  const dkParse = (dk) => { if (!dk || typeof dk !== "string") return NaN; const p = dk.slice(0, 10).split("-"); if (p.length < 3) return NaN; return Date.UTC(+p[0], +p[1] - 1, +p[2], 12); };
  const dkDiff = (a, b) => Math.round((dkParse(a) - dkParse(b)) / DAY_MS);
  const dkDow = (dk) => new Date(dkParse(dk)).getUTCDay();
  const dkOf = (v) => (v == null ? null : String(v).slice(0, 10));
  // Local calendar day in an IANA zone (e.g. "America/New_York"); falls back to UTC.
  const todayIn = (tz, at) => { try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(at || new Date()); } catch (e) { return new Date(at || Date.now()).toISOString().slice(0, 10); } };
  // The protocol as it stands on day dk (dated plan revisions applied).
  const protoAt = (p, dk) => {
    if (!p || !Array.isArray(p.timeline) || !p.timeline.length) return p;
    const tl = p.timeline.slice().sort((a, b) => (a.from == null ? -1 : b.from == null ? 1 : a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
    let pick = null; for (const e of tl) { if (e.from == null || e.from <= dk) pick = e; else break; }
    if (!pick) pick = tl[0];
    const out = { ...p }; for (const k of ["schedule", "doseMcg", "doseUnit", "doseValue"]) if (pick[k] !== undefined) out[k] = pick[k];
    return out;
  };
  const isPrnSched = (s) => { const d = s && s.days; return !(s && +s.every > 1) && Array.isArray(d) && d.length === 0; };
  // Due on dk? (pass the protoAt-resolved protocol)
  const dueOn = (p, dk) => {
    const s = (p && p.schedule) || {};
    if (+s.every > 1) { const a = dkOf(s.anchor) || dkOf(p.startDate); if (isNaN(dkParse(a))) return true; const n = +s.every, diff = dkDiff(dk, a); return ((diff % n) + n) % n === 0; }
    const days = s.days || [0,1,2,3,4,5,6]; if (!days.length) return false; return days.includes(dkDow(dk));
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
  const scheduledOn = (protocols, dk) => (protocols || []).filter(p => activeOn(p, dk)).map(p => protoAt(p, dk)).filter(p => !isPrnSched(p.schedule) && dueOn(p, dk));
  const schedLabel = (s) => {
    s = s || {};
    if (+s.every > 1) return +s.every === 2 ? "Every other day" : `Every ${s.every} days`;
    const d = s.days || [0,1,2,3,4,5,6]; if (d.length === 7) return "Daily"; if (!d.length) return "PRN";
    const dn = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]; return d.map(x => dn[x]).join("/");
  };
  return { dkParse, dkDiff, dkDow, dkOf, todayIn, protoAt, isPrnSched, dueOn, activeOn, scheduledOn, schedLabel };
})();
// ===== SCHEDULE-RULES-END =====

// ── MCP tools ─────────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "get_adherence",
    description: "Get protocol adherence (what compounds were actually administered/logged) over the last N days. Returns per-compound dose counts and a per-day breakdown. Use to assess compliance, streaks, and missed doses against the planned protocol.",
    inputSchema: { type: "object", properties: { days: { type: "number", description: "How many days back (default 7)" } }, required: [] },
  },
  {
    name: "get_today",
    description: "Get what is scheduled for today and what has actually been logged/administered so far today.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_logs_for_date",
    description: "Get all administration logs for a specific date (YYYY-MM-DD). Returns each compound dosed, dose amount, time, and injection site.",
    inputSchema: { type: "object", properties: { date: { type: "string", description: "Date in YYYY-MM-DD" } }, required: ["date"] },
  },
  {
    name: "get_protocol",
    description: "Get the current active protocol — every compound with dose, units, schedule (which days), and timing. The plan, not the completion record.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

async function callTool(name, args, env, profile) {
  const state = await loadState(env, profile);
  const logs = state.logs || [];
  const todayDk = SCHED.todayIn("UTC");
  // "Active" = on the calendar today (respects start/end dates and Finish cycle), resolved to the
  // plan revision in force today.
  const protocols = (state.protocols || []).filter(p => SCHED.activeOn(p, todayDk)).map(p => SCHED.protoAt(p, todayDk));

  if (name === "get_protocol") {
    const list = protocols.map(p => {
      const next = Array.isArray(p.timeline) ? p.timeline.filter(e => e.from && e.from > todayDk).sort((a, b) => a.from < b.from ? -1 : 1)[0] : null;
      return { name: p.peptideName, dose: fmtDose(p.doseMcg), days: SCHED.schedLabel(p.schedule), timing: (p.schedule&&p.schedule.timeOfDay)||"",
        ...(p.endDate ? { endsOn: SCHED.dkOf(p.endDate) } : {}),
        ...(next ? { nextChange: { from: next.from, days: SCHED.schedLabel(next.schedule), dose: fmtDose(next.doseMcg) } } : {}) };
    });
    return { activeCount: protocols.length, lastSynced: state._syncedAt || null, protocols: list };
  }

  if (name === "get_logs_for_date") {
    const date = args.date;
    const day = logs.filter(l => String(l.datetime || "").startsWith(date));
    return {
      date, count: day.length,
      logs: day.map(l => ({ compound: l.peptide || l.peptideName || l.peptideId, dose: fmtDose(l.doseMcg), doseMl: l.doseMl, time: l.datetime, site: l.site || null })),
    };
  }

  if (name === "get_today") {
    const today = todayDk;
    const scheduled = SCHED.scheduledOn(state.protocols || [], today)
      .map(p => ({ name: p.peptideName, dose: fmtDose(p.doseMcg) }));
    const taken = logs.filter(l => String(l.datetime || "").startsWith(today))
      .map(l => ({ compound: l.peptide || l.peptideName || l.peptideId, dose: fmtDose(l.doseMcg), time: l.datetime }));
    return { date: today, scheduledCount: scheduled.length, scheduled, loggedCount: taken.length, logged: taken };
  }

  if (name === "get_adherence") {
    const days = args.days || 7;
    const cutoff = Date.now() - days * 86400000;
    const recent = logs.filter(l => {
      const t = Date.parse((l.datetime || l.createdAt || "") + (String(l.datetime||"").length === 16 ? ":00" : ""));
      return !isNaN(t) && t >= cutoff;
    });
    const byComp = {}, byDay = {};
    for (const l of recent) {
      const n = l.peptide || l.peptideName || l.peptideId || "?";
      byComp[n] = (byComp[n] || 0) + 1;
      const d = dayStr(l.datetime || l.createdAt);
      byDay[d] = (byDay[d] || 0) + 1;
    }
    return {
      windowDays: days, totalDoses: recent.length, activeProtocols: protocols.length,
      lastSynced: state._syncedAt || null,
      byCompound: Object.entries(byComp).sort((a,b)=>b[1]-a[1]).map(([name,n])=>({name,doses:n})),
      byDay: Object.keys(byDay).sort().map(d=>({date:d,doses:byDay[d]})),
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ── MCP JSON-RPC ────────────────────────────────────────────────────────────────
async function handleRpc(body, env, profile) {
  const { id, method, params } = body;
  if (id === undefined || id === null) return null; // notification
  let result, error;
  try {
    switch (method) {
      case "initialize":
        result = { protocolVersion: MCP_VERSION, capabilities: { tools: {} }, serverInfo: { name: "protocol-os-sync", version: "1.0.0" } };
        break;
      case "ping": result = {}; break;
      case "tools/list": result = { tools: TOOLS }; break;
      case "tools/call": {
        const out = await callTool(params.name, params.arguments || {}, env, profile);
        result = { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], isError: false };
        break;
      }
      case "resources/list": result = { resources: [] }; break;
      case "prompts/list": result = { prompts: [] }; break;
      default: error = { code: -32601, message: `Method not found: ${method}` };
    }
  } catch (e) { error = { code: -32000, message: String(e.message || e) }; }
  return { jsonrpc: "2.0", id, ...(error ? { error } : { result }) };
}

// ── entry ─────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === "/health" || url.pathname === "/")
      return json({ status: "ok", server: "protocol-sync", version: "1.0.0" });

    if (!env.SYNC_TOKEN || getToken(request, url) !== env.SYNC_TOKEN) return json({ error: "Unauthorized" }, 401);
    if (!env.PROTOCOL_KV) return json({ error: "KV namespace PROTOCOL_KV not bound" }, 500);

    const profile = url.searchParams.get("profile") || "Roman";

    // MCP endpoint
    if (url.pathname === "/mcp") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });
      let body;
      try { body = await request.json(); }
      catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }
      if (Array.isArray(body)) {
        const res = (await Promise.all(body.map(b => handleRpc(b, env, profile)))).filter(Boolean);
        return json(res);
      }
      const res = await handleRpc(body, env, profile);
      if (!res) return new Response(null, { status: 202, headers: CORS });
      return json(res);
    }

    // Sync API
    if (url.pathname === "/sync") {
      const key = `protocol:${profile}`;
      if (request.method === "GET") {
        const stored = await env.PROTOCOL_KV.get(key);
        if (!stored) return json({ _empty: true, profile, protocols: [], logs: [], vials: [], storage: [] });
        return new Response(stored, { headers: { ...CORS, "Content-Type": "application/json" } });
      }
      if (request.method === "POST") {
        let body;
        try { body = await request.text(); JSON.parse(body); }
        catch { return json({ error: "Invalid JSON body" }, 400); }
        await env.PROTOCOL_KV.put(key, JSON.stringify({ ...JSON.parse(body), _syncedAt: new Date().toISOString(), profile }));
        return json({ ok: true, profile, syncedAt: new Date().toISOString() });
      }
      return json({ error: "Method not allowed" }, 405);
    }

    return json({ error: "Not found" }, 404);
  },
};
