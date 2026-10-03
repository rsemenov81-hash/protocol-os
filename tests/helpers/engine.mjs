// Loads the schedule engine straight out of the app source, at test time.
//
// The engine is the block of src/app/main.jsx between the comments
//   // ===== SCHEDULE-ENGINE-BEGIN … =====   and   // ===== SCHEDULE-ENGINE-END =====
// It is written as plain ES5-ish functions with no React/DOM dependency precisely so it can be
// evaluated here with `new Function` and exercised without a browser.
//
// The one-time data migrations (MIGRATIONS + runMigrations) sit just after the END marker; they
// are pure functions of the same engine and the engine tests cover them too, so they are pulled in
// as a second slice: explicit MIGRATIONS-BEGIN / MIGRATIONS-END markers when present, otherwise the
// section headed `// ── One-time data migrations` up to the next `// ── ` section header.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MAIN_JSX = join(ROOT, 'src', 'app', 'main.jsx');

const ENGINE_BEGIN = 'SCHEDULE-ENGINE-BEGIN';
const ENGINE_END = 'SCHEDULE-ENGINE-END';
const MIG_BEGIN = 'MIGRATIONS-BEGIN';
const MIG_END = 'MIGRATIONS-END';
const MIG_HEADER = '// ── One-time data migrations';
const MIG_FN = '\nfunction runMigrations(';
const SECTION = '\n// ── ';

// Everything the tests (and any other Node consumer) may call. Add here when the engine grows.
export const ENGINE_API = [
  'dkAdd', 'dkDiff', 'dkDow', 'normSched', 'schedEq', 'isPrnSched', 'freqPerWeek', 'schedLabel',
  'protoAt', 'nextRevision', 'dueOn', 'inRange', 'activeOn', 'materializeProto', 'materializeAll',
  'applyRevision', 'removeRevision', 'finishProto', 'resumeProto', 'buildBackfillLogs',
  'timelineSorted', 'runMigrations',
];

// Text from the line after `beginIdx`'s line to the line before `endIdx`'s line.
const sliceBetween = (src, beginIdx, endIdx) => src.slice(src.indexOf('\n', beginIdx) + 1, src.lastIndexOf('\n', endIdx));

export function extractEngineSource(file = MAIN_JSX) {
  const rel = relative(ROOT, file) || file;
  const src = readFileSync(file, 'utf8');

  const b = src.indexOf(ENGINE_BEGIN);
  const e = b < 0 ? -1 : src.indexOf(ENGINE_END, b);
  if (b < 0 || e < 0) {
    throw new Error(
      `Schedule engine markers not found in ${rel}: expected a comment containing "${ENGINE_BEGIN}" ` +
      `followed by one containing "${ENGINE_END}" (found BEGIN=${b >= 0}, END=${e >= 0}). ` +
      `The engine tests evaluate the code between those two comments, so keep them around the engine.`);
  }
  const engine = sliceBetween(src, b, e);

  let migrations;
  const mb = src.indexOf(MIG_BEGIN, e);
  const me = mb < 0 ? -1 : src.indexOf(MIG_END, mb);
  if (mb >= 0 && me >= 0) {
    migrations = sliceBetween(src, mb, me);
  } else {
    const h = src.indexOf(MIG_HEADER, e);
    const fn = h < 0 ? -1 : src.indexOf(MIG_FN, h);
    const next = fn < 0 ? -1 : src.indexOf(SECTION, fn);
    if (h < 0 || fn < 0 || next < 0) {
      throw new Error(
        `Migration code not found in ${rel}: after "${ENGINE_END}" expected the section headed ` +
        `"${MIG_HEADER}" containing "function runMigrations(" and ending at the next "// ── " header ` +
        `(found header=${h >= 0}, runMigrations=${fn >= 0}, next section=${next >= 0}). ` +
        `Either keep that layout or wrap the block in // ${MIG_BEGIN} … // ${MIG_END} comments.`);
    }
    migrations = src.slice(h, next);
  }
  return { engine, migrations, file };
}

// Evaluates the engine and returns its functions keyed by name. `console.log` inside the engine
// (the "[migration] applied …" notice) is silenced; errors still reach the real console.
export function loadEngine({ file = MAIN_JSX, console: con } = {}) {
  const { engine, migrations } = extractEngineSource(file);
  const quiet = con || { ...console, log() {}, info() {}, debug() {} };
  const collect = ENGINE_API.map((n) => `['${n}', typeof ${n} === 'function' ? ${n} : null]`).join(',\n  ');
  let pairs;
  try {
    pairs = new Function('console', `${engine}\n${migrations}\n;return [\n  ${collect}\n];`)(quiet);
  } catch (err) {
    throw new Error(`The engine extracted from ${relative(ROOT, file)} did not evaluate: ${err && err.message}`, { cause: err });
  }
  const api = Object.fromEntries(pairs);
  const missing = ENGINE_API.filter((n) => !api[n]);
  if (missing.length) {
    throw new Error(`Engine extracted from ${relative(ROOT, file)} is missing: ${missing.join(', ')} ` +
      `(renamed or moved outside the markers? update tests/helpers/engine.mjs ENGINE_API if intentional)`);
  }
  return api;
}
