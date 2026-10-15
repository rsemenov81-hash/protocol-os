// Read-only, dose-equivalent decay model. This deliberately does NOT produce blood concentrations.
export const HOUR = 3600000;
export const LEVEL_MODELS_KEY = 'protocol_os_levels_models_v1';
const model = (id, compound, name, routes, hours, label, source, note, extra = {}) =>
  ({ id, compound, name, routes, hours, label, source, note, unit: 'mass', ...extra });
export const LEVEL_MODELS = [
  model('cyp-im', 'testosterone-cypionate', 'Testosterone cypionate', ['im'], 192, 'IM · 8 days',
    'https://www.accessdata.fda.gov/drugsatfda_docs/label/2022/216318s000lbl.pdf',
    'FDA label, section 12.3: approximate half-life after intramuscular injection. Models the logged ester dose; does not predict serum testosterone, free testosterone, or endogenous production.'),
  model('deca-im', 'deca', 'Nandrolone decanoate', ['im'], 144, 'IM depot · 6 days',
    'https://pubmed.ncbi.nlm.nih.gov/3865478/',
    'Human IM study: 6-day release half-life from the injection depot. This estimates ester remaining in the depot, not circulating nandrolone (which has different kinetics).', { kind: 'depot' }),
  model('tirz-sc', 'tirzepatide', 'Tirzepatide', ['sc'], 120, 'Subcutaneous · 5 days',
    'https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/215866s041lbl.pdf',
    'Mounjaro label, section 12.3: population mean elimination half-life about 5 days after subcutaneous administration. Absorption and product differences are not modeled.'),
  model('reta-sc', 'retatrutide', 'Retatrutide', ['sc'], 144, 'Subcutaneous · 6 days',
    'https://pubmed.ncbi.nlm.nih.gov/36354040/',
    'Urva et al., 2022 phase 1b human trial: approximately 6 days after subcutaneous administration of the study product. This does not establish equivalence of other preparations.'),
  model('cagri-sc', 'cagrilintide', 'Cagrilintide', ['sc'], 177, 'Subcutaneous · 159–195 hours',
    'https://pubmed.ncbi.nlm.nih.gov/33894838/',
    'Enebo et al., 2021 phase 1b trial with semaglutide: 159–195 hours. The line uses the midpoint (177 hours); shading shows both endpoints, not a statistical confidence interval.', { range: [159,195] }),
  model('hcg-inj', 'hcg', 'HCG', ['sc','im'], 33, 'Urinary hCG · SC / IM · 33 hours',
    'https://assets.hpra.ie/products/Human/23292/LicenseSPC_PA0964-005-001_08052015164049.pdf',
    'Pregnyl product information, section 5.2: apparent elimination half-life approximately 33 hours after SC / IM dosing. Urinary hCG reference only; not a testosterone-response model.', { unit: 'IU' }),
  model('anavar-oral', 'anavar', 'Oxandrolone (Anavar)', ['oral'], 10.4, 'Oral · 10.4 hours',
    'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=f622616e-4c11-4149-bf00-5ea5ce97800b',
    'Historical Oxandrin label: mean 10.4 hours in younger volunteers; 13.3 hours in elderly subjects. Duration of effects is not determined by this curve.'),
  model('tadalafil-oral', 'tadalafil', 'Tadalafil', ['oral'], 17.5, 'Oral tablet · 17.5 hours',
    'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=13e72ff9-29bd-4aa4-ba24-0aafa7dacd7e',
    'Oral tablet label: mean terminal half-life in healthy subjects. Not validated for sublingual preparations.'),
  model('finasteride-oral', 'finasteride', 'Finasteride', ['oral'], 6, 'Oral · 6 hours',
    'https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=5e69ea84-dc5a-4aac-9353-4920c6f7b3aa',
    'Label: mean plasma half-life about 6 hours in healthy young subjects, with substantial variability. DHT suppression can persist beyond plasma elimination.'),
];

export function compoundId(log) {
  const id = String(log.peptideId || '').toLowerCase();
  if (id === 'testosterone' && /\bcyp(?:ionate)?\b/i.test(log.peptide || log.peptideName || '')) return 'testosterone-cypionate';
  return ({'test-cyp':'testosterone-cypionate', oxandrolone:'anavar', 'nandrolone-decanoate':'deca', 'ss-31':'ss31', 'ta-1':'thymosin-a1'})[id] || id;
}

// Only the dose record and its label establish historical route; today's plan cannot rewrite it.
export function recordedRoute(log) {
  const exact = String(log.route || '').toLowerCase();
  const route = ({im:'im',intramuscular:'im',sc:'sc',sq:'sc',subq:'sc',subcutaneous:'sc',oral:'oral',sl:'sl',sublingual:'sl',nasal:'nasal',intranasal:'nasal',iv:'iv',intravenous:'iv',inj:'inj',pen:'inj'})[exact];
  if (route && route !== 'inj') return route;
  const label = String(log.peptide || log.peptideName || '');
  if (/\b(SL|sublingual)\b/i.test(label)) return 'sl';
  if (/\b(intranasal|nasal)\b/i.test(label)) return 'nasal';
  if (/\b(oral|tablet)\b/i.test(label)) return 'oral';
  if (/\b(subq|subcutaneous|SC)\b/i.test(label)) return 'sc';
  if (/\b(intramuscular|IM)\b/i.test(label)) return 'im';
  if (/\b(intravenous|IV)\b/i.test(label)) return 'iv';
  return route || 'unknown';
}

export function parseDoseTime(value) {
  if (typeof value !== 'string') return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > new Date(Date.UTC(+m[1], +m[2], 0)).getUTCDate() || +m[4] > 23 || +m[5] > 59 || +(m[6] || 0) > 59) return NaN;
  const t = Date.parse(value);
  // datetime-local values have no zone. Reject nonexistent local times at the DST spring jump.
  if (Number.isFinite(t) && !m[7]) { const d = new Date(t); if (d.getHours() !== +m[4] || d.getMinutes() !== +m[5]) return NaN; }
  return t;
}

export function remainingAt(entries, time, halfLifeHours) {
  if (!Number.isFinite(time) || !(halfLifeHours > 0) || !Number.isFinite(halfLifeHours)) return null;
  return entries.reduce((sum, e) => e.at <= time ? sum + e.amount * 2 ** (-(time - e.at) / HOUR / halfLifeHours) : sum, 0);
}

export function compatibleModels(group) {
  if (group.blend || group.unit === 'unknown') return [];
  return LEVEL_MODELS.filter(m => m.compound === group.compound && m.unit === group.unit &&
    (group.route === 'unknown' || (group.route === 'inj' && m.routes.some(r => r === 'sc' || r === 'im')) || m.routes.includes(group.route)));
}

export function resolveModel(group, selections = {}) {
  const available = compatibleModels(group);
  if (Object.hasOwn(selections, group.key)) return available.find(m => m.id === selections[group.key]) || null;
  // Explicit historical route can auto-match. Otherwise the user selects a reference assumption.
  return group.route !== 'unknown' && group.route !== 'inj' && available.length === 1 ? available[0] : null;
}

export function buildLevels({logs = [], protocols = [], profile, now = Date.now(), selections = {}}) {
  const owners = new Map(protocols.map(p => [p.id,p.profile]));
  const unique = new Map(); const ignored = { skipped:0, future:0, invalid:0, duplicate:0, unassigned:0 };
  for (const l of logs) {
    if (!l || typeof l !== 'object') continue;
    const owner = l.profile || owners.get(l.protocolId);
    if (!owner) { ignored.unassigned++; continue; }
    if (owner !== profile) continue;
    const key = l.id == null ? Symbol() : String(l.id);
    const prior = unique.get(key);
    if (prior) { ignored.duplicate++; if ((Date.parse(l.updatedAt) || 0) <= (Date.parse(prior.updatedAt) || 0)) continue; }
    unique.set(key, l);
  }
  const groups = new Map();
  for (const l of unique.values()) {
    if (l.skipped) { ignored.skipped++; continue; }
    const at = parseDoseTime(l.datetime), amount = typeof l.doseMcg === 'number' || (typeof l.doseMcg === 'string' && l.doseMcg.trim()) ? Number(l.doseMcg) : NaN;
    if (!Number.isFinite(at) || !Number.isFinite(amount) || amount <= 0) { ignored.invalid++; continue; }
    if (at > now) { ignored.future++; continue; }
    const compound = compoundId(l), name = l.peptide || l.peptideName || compound || 'Unnamed compound';
    const route = recordedRoute(l);
    const tag = l.doseUnit;
    // The legacy field stores mass as mcg but IU as a raw proxy. Never convert IU into mass.
    const unit = tag === 'IU' ? 'IU' : (compound === 'hcg' || (tag && !['mcg','mg','g'].includes(tag))) ? 'unknown' : 'mass';
    const blend = compound === '__pen__' || /^blend_/.test(compound) || /\+|\b(blend|mix|pen|neurolux|coremend|klow|glow)\b/i.test(name);
    const identity = compound === '__pen__' || !compound ? (l.protocolId || name) : compound;
    const key = JSON.stringify([profile, identity, route, unit]);
    let g = groups.get(key);
    if (!g) { g = {key, compound, name, route, unit, blend, entries:[], localTimes:0, backfilled:0, review:0}; groups.set(key,g); }
    g.entries.push({at, amount, id:l.id, datetime:l.datetime});
    if (!/(Z|[+-]\d{2}:\d{2})$/.test(l.datetime)) g.localTimes++;
    if (l.backfilled) g.backfilled++;
    if (l.needsReview) g.review++;
  }
  const result = [...groups.values()].map(g => {
    g.entries.sort((a,b) => b.at - a.at); g.last = g.entries[0];
    g.model = resolveModel(g, selections); g.models = compatibleModels(g);
    g.remaining = g.model ? remainingAt(g.entries, now, g.model.hours) : null;
    return g;
  }).sort((a,b) => b.last.at - a.last.at);
  return {groups:result, ignored};
}

// Single forward pass: O(logs + samples), with exact vertical dose steps included in the chart.
export function levelSeries(entries, now, hours, days = 7) {
  const start = now - days * 24 * HOUR;
  const times = new Set(Array.from({length:121},(_,i) => start + (now-start)*i/120));
  const sorted = entries.filter(e => e.at <= now).slice().sort((a,b)=>a.at-b.at);
  sorted.forEach(e => { if (e.at >= start) times.add(e.at); });
  let amount = 0, cursor = 0, lastTime = start;
  while (cursor < sorted.length && sorted[cursor].at < start) { const e=sorted[cursor++]; amount += e.amount * 2 ** (-(start-e.at)/HOUR/hours); }
  const points = [];
  for (const time of [...times].sort((a,b)=>a-b)) {
    amount *= 2 ** (-(time-lastTime)/HOUR/hours);
    if (cursor < sorted.length && sorted[cursor].at === time) points.push({time,amount});
    while (cursor < sorted.length && sorted[cursor].at <= time) amount += sorted[cursor++].amount;
    points.push({time,amount}); lastTime=time;
  }
  return points;
}

export function formatLevel(amount, unit) {
  if (amount == null || !Number.isFinite(amount) || unit === 'unknown') return '—';
  const u = unit === 'IU' ? 'IU' : amount >= 1000 ? 'mg' : 'mcg';
  const n = u === 'mg' ? amount/1000 : amount;
  if (n < 0.01) return `<0.01 ${u}`;
  return `${new Intl.NumberFormat('en-US',{maximumSignificantDigits:3}).format(n)} ${u}`;
}
