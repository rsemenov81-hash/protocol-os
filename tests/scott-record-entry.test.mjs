// Validate record-entry behavior against the actual form handlers, with isolated writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../scott/index.html', import.meta.url), 'utf8');
const formSource = html.slice(html.indexOf('function labForm()'), html.indexOf('/* ════════ actions'));

function fixture(kind, { rows = [], values = {}, save = async () => true } = {}) {
  const nodes = new Map(), writes = [], messages = [];
  const node = value => ({ value, disabled: false, focused: false, focus() { this.focused = true; } });
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, node(values[id] ?? (id.endsWith('-date') ? '2026-10-14' : '')));
    return nodes.get(id);
  };
  const rowNodes = rows.map(row => row.map(node));
  const sheet = { querySelectorAll() { return rowNodes.map(fields => ({ querySelectorAll() { return fields; } })); } };
  let closed = false;
  const context = vm.createContext({
    $: get, todayKey: () => '2026-10-14', uid: () => 'fixture',
    S: { data: { labs: [], scans: [] } }, openSheet(_html, mount) { mount(sheet); },
    closeSheet() { closed = true; }, toast(message) { messages.push(message); },
    async adminWrite(patch) { writes.push(patch); return save(patch); },
  });
  vm.runInContext(formSource, context);
  vm.runInContext(kind === 'lab' ? 'labForm()' : 'scanForm()', context);
  return { nodes, writes, messages, rowNodes, get, closed: () => closed, submit: () => get(kind === 'lab' ? '#l-save' : '#s-save').onclick() };
}

for (const kind of ['lab', 'scan']) {
  test(`${kind} record requires a real calendar date before writing`, async () => {
    for (const date of ['', '2026-02-30', '2026-13-01', 'not-a-date']) {
      const f = fixture(kind, { rows: [['Example', '12', 'U', '', '']], values: { [kind === 'lab' ? '#l-date' : '#s-date']: date, '#s-weightLb': '180' } });
      await f.submit();
      assert.equal(f.writes.length, 0, date);
      assert.equal(f.get(kind === 'lab' ? '#l-save' : '#s-save').disabled, false);
      assert.match(f.messages[0], /valid .* date/);
    }
  });
}

test('lab entry preserves bounded and qualitative results, blank bounds, and numeric zero bounds', async () => {
  const f = fixture('lab', { rows: [['Hormone', '<0.7', 'mIU/mL', '0', '10'], ['Screen', 'Negative', '', '', ''], ['Decimal', '.5', 'U', '', ''], ['', '', '', '', '']] });
  await f.submit();
  assert.equal(f.writes.length, 1);
  assert.equal(f.closed(), true);
  const panel = f.writes[0].labs[0];
  assert.equal(panel.date, '2026-10-14');
  assert.equal(panel.markers.length, 3);
  assert.equal(panel.markers[0].value, '<0.7');
  assert.equal(panel.markers[0].lo, 0);
  assert.equal(panel.markers[1].value, 'Negative');
  assert.equal(panel.markers[1].lo, null);
  assert.equal(panel.markers[2].value, 0.5);
});

test('lab entry rejects incomplete rows instead of silently dropping entered data', async () => {
  for (const row of [['', '12', 'U', '', ''], ['Example', '', '', '', ''], ['', '', 'U', '', '']]) {
    const f = fixture('lab', { rows: [row] });
    await f.submit();
    assert.equal(f.writes.length, 0);
    assert.match(f.messages[0], /name and result/);
  }
});

test('lab reference ranges reject malformed or reversed bounds', async () => {
  for (const bounds of [['12junk', '20'], ['1', 'NaN'], ['20', '10'], ['Infinity', '']]) {
    const f = fixture('lab', { rows: [['Example', '12', 'U', ...bounds]] });
    await f.submit();
    assert.equal(f.writes.length, 0);
    assert.match(f.messages[0], /Reference limits|low reference limit/);
    assert.equal(f.get('#l-save').disabled, false);
  }
});

test('scan entry rejects numeric prefixes, negative values, zero weight, and percentages above 100', async () => {
  for (const [field, value] of [['#s-weightLb', '123garbage'], ['#s-smmLb', '-5'], ['#s-weightLb', '0'], ['#s-pbfPct', '101'], ['#s-bmrKcal', 'Infinity']]) {
    const f = fixture('scan', { values: { '#s-weightLb': '180', [field]: value } });
    await f.submit();
    assert.equal(f.writes.length, 0, `${field}=${value}`);
    assert.equal(f.get('#s-save').disabled, false);
    assert.equal(f.get(field).focused, true);
  }
});

test('scan entry preserves optional missing values and exact decimal measurements', async () => {
  const f = fixture('scan', { values: { '#s-weightLb': '147.3', '#s-pbfPct': '12.5' } });
  await f.submit();
  assert.equal(f.writes.length, 1);
  assert.equal(f.closed(), true);
  const scan = f.writes[0].scans[0];
  assert.equal(scan.weightLb, 147.3);
  assert.equal(scan.pbfPct, 12.5);
  assert.equal('smmLb' in scan, false, 'blank measurement remains absent');
});

for (const kind of ['lab', 'scan']) {
  test(`${kind} entry recovers after a failed save and suppresses concurrent double submit`, async () => {
    let resolve;
    const f = fixture(kind, { rows: [['Example', '12', 'U', '', '']], values: { '#s-weightLb': '180' }, save: () => new Promise(r => { resolve = r; }) });
    const pending = f.submit();
    await f.submit();
    assert.equal(f.writes.length, 1);
    resolve(false);
    await pending;
    assert.equal(f.get(kind === 'lab' ? '#l-save' : '#s-save').disabled, false);
    assert.equal(f.closed(), false);
  });
}
