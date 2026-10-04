// kris-protocol — Cloudflare Worker + KV behind the Kris Protocol app (kris/index.html).
//
// The API the app calls (same contract as the Trey and Jamal apps):
//   GET  /state   → { role, compounds, logs, labs, scans, _rev }
//   POST /admin   → { baseRev, compounds?, labs?, scans? }   admin only; 409 when baseRev is stale
//   POST /log     → { log: {id, compoundId, datetime, doseMcg, units} } upserts a dose
//                   { deleteId } removes one (Kris can only remove his own)
//   GET  /health  → { ok, version }   (no code needed)
//
// Two access codes, both stored as worker secrets (never in this file):
//   ADMIN_CODE  — Roman: edits compounds, blood panels and InBody scans, and can log or remove any dose.
//   MEMBER_CODE — Kris: logs his own doses only.
// The dose gate is enforced here too, not only in the app: a log at 5× or more of the set dose is refused.
//
// KV binding: KRIS_KV. One key, "state", holds the whole record. When it is empty the worker starts
// from SEED below (Kris's protocol as of 2026-10-04), so the app opens with the protocol already built.

const VERSION = '1.0.0';
const STATE_KEY = 'state';
const ALLOWED_ORIGINS = ['https://rsemenov81-hash.github.io'];
const MAX_LOGS = 5000;

// Kris's protocol. Days: 0 = Sun … 6 = Sat. Doses are in mcg (mg × 1000) except HCG, which is in IU.
// vialAmount + bacMl give the syringe-unit strength the app draws with (U-100: 100 units = 1 mL).
const SEED = {
  _rev: 1,
  compounds: [
    {
      id: 'c_reta', name: 'Retatrutide', category: 'Weight Loss', timing: 'Morning', active: true,
      unit: 'mcg', doseMcg: 2000, vialAmount: 10, bacMl: 2, mcgPerUnit: 50, ingredients: [],
      schedule: { days: [6] },
      purpose: 'The strongest of the new weight-loss injections. It works on three hunger and metabolism pathways at once. One shot every Saturday. A 10 mg vial in 2 mL makes 2 mg = 40 units, and the vial lasts five weeks.',
      benefits: ['Steady fat loss', 'Appetite control', 'Better blood sugar'],
    },
    {
      id: 'c_hcg', name: 'HCG', category: 'Hormone', timing: 'Morning', active: true,
      unit: 'IU', doseMcg: 250, vialAmount: 10000, bacMl: 2, mcgPerUnit: 50, ingredients: [],
      schedule: { days: [2, 6] },
      purpose: 'Signals the testes to keep working while on testosterone. Preserves their size, natural function and fertility. Taken Tuesday and Saturday. A 10,000 IU vial in 2 mL makes 250 IU = 5 units.',
      benefits: ['Preserves fertility', 'Keeps natural production going', 'Supports testicular size'],
    },
    {
      id: 'c_klow', name: 'KLOW', category: 'Healing', timing: 'Evening', active: true,
      unit: 'mcg', doseMcg: 2400, vialAmount: 80, bacMl: 3, mcgPerUnit: 266.67,
      ingredients: [{ name: 'GHK-Cu', mg: 50 }, { name: 'BPC-157', mg: 10 }, { name: 'TB-500', mg: 10 }, { name: 'KPV', mg: 10 }],
      schedule: { days: [0, 1, 2, 3, 4, 5, 6] },
      purpose: 'A four-peptide repair blend (GHK-Cu, KPV, BPC-157 and TB-500) for skin, gut and tissue repair. Daily from a pen with a 3 mL cartridge holding 80 mg: 2.4 mg = 9 units.',
      benefits: ['Skin and hair quality', 'Gut repair', 'Tissue and joint healing'],
    },
    {
      id: 'c_nand', name: 'Nandrolone', category: 'Hormone', timing: 'Morning', active: true,
      unit: 'mcg', doseMcg: 100000, vialAmount: 0, bacMl: 0, mcgPerUnit: 3000, ingredients: [],
      schedule: { days: [6] },
      purpose: 'An anabolic hormone injected once a week, on Saturday. Supports muscle, joint comfort and recovery from training. Long-acting, so the level stays steady between shots. At 300 mg/mL, 100 mg is 33.3 units (0.33 mL).',
      benefits: ['Joint comfort', 'Muscle and strength', 'Recovery between sessions'],
    },
    {
      id: 'c_test', name: 'Testosterone Cypionate', category: 'Hormone', timing: 'Morning', active: true,
      // an oil, not reconstituted: a 10 mL vial at 250 mg/mL (2,500 mg) = 2.5 mg per unit
      unit: 'mcg', doseMcg: 75000, vialAmount: 2500, bacMl: 10, mcgPerUnit: 2500, ingredients: [],
      schedule: { days: [2, 6] },
      purpose: 'The primary male hormone in a long-acting oil. Taken Tuesday and Saturday. At 250 mg/mL, 0.3 mL = 30 units = 75 mg, so 150 mg a week.',
      benefits: ['Energy and drive', 'Keeps muscle', 'Mood and recovery'],
    },
  ],
  logs: [],
  labs: [],
  scans: [],
};

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
  const raw = await env.KRIS_KV.get(STATE_KEY);
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
const save = (env, s) => env.KRIS_KV.put(STATE_KEY, JSON.stringify(s));

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
  const dose = Number(log.doseMcg);
  if (!Number.isFinite(dose) || dose <= 0) return fail(req, 400, 'Dose must be above zero');
  if (typeof log.datetime !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(log.datetime)) return fail(req, 400, 'Bad date/time');
  const rec = Number(c.doseMcg) || 0;
  if (rec > 0 && dose / rec >= 5) return fail(req, 422, `Blocked by the dose gate: ${(dose / rec).toFixed(1)}× the set dose`);

  const id = typeof log.id === 'string' && log.id ? log.id.slice(0, 64) : Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const existing = s.logs.find(l => l.id === id);
  if (existing && role !== 'admin' && existing.by && existing.by !== role) return fail(req, 403, 'Logged by Roman — ask him to change it');
  const units = Number(log.units);
  const entry = {
    id, compoundId: c.id, datetime: log.datetime.slice(0, 16), doseMcg: Math.round(dose),
    units: Number.isFinite(units) ? Math.round(units * 10) / 10 : null,
    by: existing && role === 'admin' && existing.by ? existing.by : role,
  };
  s.logs = [entry, ...s.logs.filter(l => l.id !== id)].slice(0, MAX_LOGS);
  await save(env, s);
  return json(req, 200, { ok: true, log: entry });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
    if (url.pathname === '/health' || url.pathname === '/') return json(req, 200, { ok: true, version: VERSION });
    if (!env.KRIS_KV) return fail(req, 500, 'KV binding KRIS_KV is missing');
    if (!env.ADMIN_CODE || !env.MEMBER_CODE) return fail(req, 500, 'Access codes are not set');

    const role = roleOf(req, env);
    if (!role) return fail(req, 401, 'Bad access code');

    try {
      if (url.pathname === '/state' && req.method === 'GET') {
        const s = await load(env);
        return json(req, 200, { role, ...s });
      }
      if (url.pathname === '/admin' && req.method === 'POST') return await handleAdmin(req, env, role);
      if (url.pathname === '/log' && req.method === 'POST') return await handleLog(req, env, role);
      return fail(req, 404, 'Not found');
    } catch (e) {
      return fail(req, 500, 'Server error: ' + (e && e.message || e));
    }
  },
};
