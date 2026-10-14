// Read-only views of the private state. These helpers never fetch, store, or send data.
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const itemKind = compound => compound?.stack ? 'stack' : compound?.kind || (/oral/i.test(compound?.category || '') ? 'oral' : 'injection');
const numeric = value => (typeof value === 'number' || typeof value === 'string') && text(value).trim() !== '' && Number.isFinite(Number(value));

function recordedDose(log, compound) {
  const value = log.doseMcg ?? '';
  // An absent compound has no trustworthy unit metadata. Keep its raw value in exports.
  const unit = value === '' ? '' : compound ? (compound.unit === 'IU' ? 'IU' : 'mcg') : '';
  let label = value === '' ? 'Taken' : unit ? `${text(value)} ${unit}` : 'Dose recorded · item unavailable';
  if (numeric(value) && unit === 'mcg' && Number(value) >= 1000) label = `${Number(value) / 1000} mg`;
  return { recordedDose: value, recordedUnit: unit, doseText: label };
}

/** Newest recorded entries first. Dates are the recorded calendar date, inclusive. */
export function activityRows(data = {}, { query = '', from = '', to = '' } = {}) {
  if ((from && !validDate(from)) || (to && !validDate(to)) || (from && to && from > to)) return [];
  const compounds = new Map(list(data.compounds).filter(Boolean).map(c => [c.id, c]));
  const terms = text(query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return list(data.logs).filter(log => log && typeof log === 'object').map(log => {
    const compound = compounds.get(log.compoundId);
    const datetime = text(log.datetime);
    const date = validDate(datetime.slice(0, 10)) ? datetime.slice(0, 10) : '';
    return {
      id: text(log.id), compoundId: text(log.compoundId),
      name: text(compound?.name) || 'Item no longer available',
      kind: compound ? itemKind(compound) : 'unknown', datetime, date,
      ...recordedDose(log, compound),
      syringeUnits: log.units ?? '', by: text(log.by),
    };
  }).filter(row => {
    if (from && (!row.date || row.date < from)) return false;
    if (to && (!row.date || row.date > to)) return false;
    const haystack = [row.name, row.kind, row.date, row.datetime, row.doseText, row.by].join(' ').toLocaleLowerCase();
    return terms.every(term => haystack.includes(term));
  }).sort((a, b) => {
    const ta = a.date ? Date.parse(a.datetime) : NaN;
    const tb = b.date ? Date.parse(b.datetime) : NaN;
    return (Number.isFinite(tb) ? tb : -Infinity) - (Number.isFinite(ta) ? ta : -Infinity) || b.datetime.localeCompare(a.datetime) || a.id.localeCompare(b.id);
  });
}

const csvCell = value => {
  let cell = text(value);
  // Quoting alone does not stop spreadsheet formulas. Keep legitimate numeric values numeric.
  if (typeof value !== 'number' && /^[\s\u0000-\u001f\u007f]*[=+\-@]/.test(cell)) cell = "'" + cell;
  return '"' + cell.replace(/"/g, '""') + '"';
};
const csv = rows => '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function scheduleText(compound, stacks) {
  if (compound.stack) {
    const stack = stacks.get(compound.stack);
    return stack ? `Daily at ${text(stack.time)} · one stack reminder` : 'In stack';
  }
  const days = compound.schedule?.days;
  if (!Array.isArray(days)) return 'Daily';
  if (!days.length) return 'As needed';
  return [...new Set(days)].filter(d => Number.isInteger(d) && d >= 0 && d <= 6).sort().map(d => weekdays[d]).join(', ');
}

const scanFields = [
  ['weightLb', 'Weight', 'lb'], ['smmLb', 'Skeletal muscle mass', 'lb'],
  ['slmLb', 'Soft lean mass', 'lb'], ['pbfPct', 'Body fat', '%'],
  ['bfmLb', 'Body fat mass', 'lb'], ['vfl', 'Visceral fat level', 'level'],
  ['tbwLb', 'Total body water', 'lb'], ['bmrKcal', 'Basal metabolic rate', 'kcal'],
];

/** CSV content only: explicit allowlists exclude access codes, tokens and private document URLs. */
export function exportCSV(data = {}, type) {
  const stacks = new Map(list(data.stacks).filter(Boolean).map(stack => [stack.id, stack]));
  if (type === 'protocol') return csv([
    ['Name', 'Type', 'Active', 'Stack', 'Scheduled dose', 'Dose unit', 'Directions / serving', 'Schedule', 'Timing', 'Ingredients'],
    ...list(data.compounds).filter(Boolean).map(c => [
      c.name, itemKind(c), c.active !== false ? 'Yes' : 'No', stacks.get(c.stack)?.name || c.stack || '',
      c.doseMcg ?? '', c.doseMcg != null ? (c.unit === 'IU' ? 'IU' : 'mcg') : '', c.serving || c.dose || '',
      scheduleText(c, stacks), c.timing || '',
      list(c.ingredients).filter(Boolean).map(i => [text(i.name), text(i.amount)].filter(Boolean).join(': ')).join('; '),
    ]),
  ]);
  if (type === 'history') return csv([
    ['Entry ID', 'Recorded date/time', 'Name', 'Type', 'Recorded dose', 'Dose unit', 'Syringe units', 'Logged by'],
    ...activityRows(data).map(row => [row.id, row.datetime, row.name, row.kind, row.recordedDose, row.recordedUnit, row.syringeUnits, row.by]),
  ]);
  if (type === 'labs') return csv([
    ['Collection date', 'Marker', 'Value', 'Unit', 'Reference', 'Reference low', 'Reference high', 'Reported flag', 'Note', 'Source reports'],
    ...list(data.labs).filter(Boolean).flatMap(panel => list(panel.markers).filter(Boolean).map(marker => [
      panel.date, marker.name, marker.value, marker.unit, marker.reference || marker.ref || '', marker.lo, marker.hi,
      marker.flag || '', marker.note || '', list(panel.sources).filter(Boolean).map(source => text(source.name)).filter(Boolean).join('; '),
    ])),
  ]);
  if (type === 'scans') return csv([
    ['Measurement ID', 'Date', 'Measured at', 'Metric', 'Value', 'Unit', 'Source'],
    ...list(data.scans).filter(Boolean).flatMap(scan => {
      const imported = list(scan.metrics).filter(metric => metric && metric.name && metric.value != null);
      const metrics = imported.length ? imported : scanFields.filter(([key]) => scan[key] != null && scan[key] !== '').map(([key, name, unit]) => ({name, value: scan[key], unit}));
      return metrics.map(metric => [scan.id, scan.date, scan.measuredAt || '', metric.name, metric.value, metric.unit || /\(([^()]*)\)\s*$/.exec(text(metric.name))?.[1] || '', scan.source?.name || '']);
    }),
  ]);
  throw new RangeError('Unknown export type');
}

/** Next scheduled stack in this device's local time; this is not push-delivery status. */
export function nextStack(stacks, now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return null;
  const upcoming = list(stacks).filter(stack => stack && stack.active !== false && stack.enabled !== false).flatMap(stack => {
    const match = /^(\d{2}):(\d{2})$/.exec(text(stack.time));
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return [];
    const dueAt = new Date(now.getTime());
    dueAt.setHours(Number(match[1]), Number(match[2]), 0, 0);
    let dayOffset = 0;
    if (dueAt < now) { dueAt.setDate(dueAt.getDate() + 1); dayOffset = 1; }
    return [{ id: text(stack.id), name: text(stack.name), time: text(stack.time), dueAt, date: localDate(dueAt), dayOffset, minutesUntil: Math.ceil((dueAt - now) / 60000) }];
  });
  return upcoming.sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id))[0] || null;
}

if (typeof window !== 'undefined') window.JamalInsights = Object.freeze({ activityRows, exportCSV, nextStack });
