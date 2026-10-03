# Tests

Protocol OS ships as one built file, `index.html`, compiled from `src/` by `tools/build.mjs`.
The harness has two layers: unit tests that run the schedule engine straight from the source, and a
headless end-to-end walkthrough of the built page. CI (`.github/workflows/ci.yml`) runs both, after
checking that the committed `index.html` is exactly what the build produces.

## Commands

| Command | What it does |
|---|---|
| `npm ci` | Install esbuild and the pinned Playwright package (no browsers are downloaded). |
| `npm run build` | Compile `src/` into `index.html`. Commit the result together with the source change. |
| `npm run check` | Exit 1 if `index.html` is stale relative to `src/`. First step in CI. |
| `npm test` | Unit tests: every `tests/**/*.test.mjs` under `node --test`. No build, no browser. |
| `npm run e2e` | End-to-end walkthrough of the built `index.html` in headless Chromium. Needs `npm run build` first. |
| `npm run ci` | `check`, then `test`, then `e2e`, the same order as CI. |

Node 22. One file at a time: `node --test tests/engine.test.mjs`, `node tests/e2e.mjs`.

### Chromium for the e2e

Playwright is pinned in `devDependencies` (`playwright@1.56.1`) and only installs the library. On a
fresh machine or in CI, add the browser once:

```sh
npx playwright install --with-deps chromium
```

In the development containers Playwright and Chromium are preinstalled machine-wide
(`/opt/node22/lib/node_modules/playwright`, browsers in `$PLAYWRIGHT_BROWSERS_PATH`);
`tests/helpers/playwright.mjs` falls back to that install when the package is not in `node_modules`,
and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` is set there, so never run `playwright install` in them.

## What is covered

### `tests/engine.test.mjs` — schedule engine (65 assertions)

Runs against the engine extracted from `src/app/main.jsx` at test time, so a source edit is tested
without rebuilding. `tests/helpers/engine.mjs` slices the text between the comments
`SCHEDULE-ENGINE-BEGIN` and `SCHEDULE-ENGINE-END`, plus the one-time migrations block that follows
(`// ── One-time data migrations` up to the next `// ── ` header, or explicit
`MIGRATIONS-BEGIN` / `MIGRATIONS-END` markers if someone adds them), evaluates it with `new Function`,
and fails with a pointed message if the markers or `runMigrations` cannot be found. Keep the markers
around the engine when editing `main.jsx`.

Suites, with `TODAY` pinned to `2026-10-02` so nothing depends on the clock:

- **date keys** — `dkAdd` across month roll and DST, `dkDiff`, `dkDow`.
- **schedules** — interval (`every`/`anchor`) due pattern including days before the anchor, q3d,
  labels (long and short), weekday/letter labels, `freqPerWeek`, PRN detection, `normSched` coercion
  and sorting.
- **timeline revisions** — `applyRevision` creates a baseline snapshot, `protoAt` picks the entry in
  force, a future revision leaves the base alone until its day, `materializeProto` is identity when
  nothing changes, same-date replacement, `removeRevision` collapsing the timeline.
- **interval mirroring** — every-other-day mirrored into legacy `days` for today..+6 and shifting
  with the window.
- **range, finish, resume** — `finishProto`, `activeOn`, archived vs finished, finishing today stays
  active until tomorrow, `resumeProto`.
- **back-dated entries** — `buildBackfillLogs` skips logged and skipped days, log shape, scheduled vs
  every-day mode.
- **migration m1** — the Roman daily-testosterone + Anavar migration against a live-shaped blob:
  timeline entry, back-fill through yesterday only, vial attribution, 38 Anavar days, marker written,
  re-runs are no-ops with or without the marker, other profiles untouched.

### `tests/e2e.mjs` — built app walkthrough (38 checks)

Serves the repo root from its own `node:http` server on a free port (`tests/helpers/static-server.mjs`),
opens `index.html` in Chromium at 390×844 (iPhone-ish, DPR 2), `America/New_York`, `en-US`, with service
workers blocked, and seeds `localStorage` before the app boots (`tests/helpers/fixture.mjs`: keys
`protocol_os_protocols` / `_logs` / `_vials` / `_meta`, `protocol_os_loaded_v4='true'`,
`protocol_os_active_profile='Roman'`). The fixture is Roman's live blob shape anchored on today's date.
Each check prints one `PASS`/`FAIL` line; the exit code is 1 when any check failed and 2 when the run
crashed. Screenshots (`shot-1-today.png` … `shot-6-edit-dose.png`, `crash.png` on a crash) and the
downloaded `history.csv` land in `.playwright/` (git-ignored; override with `E2E_OUT`).

Groups, in order:

1. **migration** — the m1 migration ran locally: 38 Anavar entries, daily testosterone revision from
   Aug 22, base mirrors daily 20 mg, back-fill through yesterday but not today, marker, Anavar finished.
2. **today** — testosterone card shows "Daily" and 10u; Anavar is not on today.
3. **sheet** — the Plan card reads "Daily · 20 mg · since Aug 22", offers Finish cycle and Change from
   today, and The Draw is shown. The Plan card sits behind a collapsed disclosure on a today sheet; the
   script expands it (`openPlan`) before asserting.
4. **finish / resume** — Finish cycle sets `endDate` to today while staying active; the sheet offers
   Resume and says "ends"; Resume clears `endDate`.
5. **edit** — plan history lists Original + Since Aug 22; "Change from tomorrow" to MWF adds a dated
   revision while the base stays daily; the card footer hints the upcoming plan.
6. **future day** — tomorrow shows testosterone only if MWF says so, cards render in the future state,
   and the sheet is plan-only (no Log button).
7. **past days** — Sep 10 shows Anavar logged 50 mg and a back-filled testosterone log; Aug 21 (before
   the revision, a Friday) shows neither.
8. **add protocol** — NPP every-other-day: 14-day preview strip, oil-vial labels, saved with `every`,
   `anchor` and mirrored legacy days, card reads EOD.
9. **history** — Anavar listed, compound filter, 38-dose stat tile, bulk delete offer, CSV download
   (BOM + header + 38 rows), row sheet → Edit Dose hand-off, back-dated entries preview and HCG entries
   written with the IU tag.
10. **no console/page errors** across the whole run.

Calendar navigation goes through `pickDate(dk)`, which reads the month heading and walks to the
target month, so the fixed-date checks (Sep 10, Aug 21) keep working as the calendar moves on.

Environment knobs: `E2E_HEADED=1` (watch it), `E2E_SLOWMO=250` (ms per action), `E2E_VERBOSE=1`
(detail on PASS lines too), `E2E_TZ`, `E2E_OUT`.

### `tests/worker.test.mjs`

Unit tests for the sync worker (`protocol-sync-worker.js`); see the header of that file. It is picked
up by `npm test` like any other `*.test.mjs`.

## Adding a test

**Unit test.** Create `tests/<area>.test.mjs` (the `.test.mjs` suffix is what `npm test` globs; a
helper that is not a test goes under `tests/helpers/`). Use `node:test` and `node:assert/strict`:

```js
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine } from './helpers/engine.mjs';

const m = loadEngine();
describe('dueOn', () => {
  test('weekday schedule', () => assert.equal(m.dueOn({ schedule: { days: [1] } }, '2026-10-05'), true));
});
```

If you add an engine function that tests should see, add its name to `ENGINE_API` in
`tests/helpers/engine.mjs` (the loader fails loudly when a listed name is missing, which also catches
accidental renames). Pin dates explicitly; never derive expectations from `new Date()`.

**E2E check.** Add a `check('area: what it proves', condition, detail)` line in `tests/e2e.mjs` at the
point in the walkthrough where the state exists; keep names unique and prefixed by the group so the
PASS/FAIL log reads as a story. Prefer role/text locators (`getByRole('button', { name })`), pass
`exact: true` where a label is a prefix of another ("Finish cycle" vs "Finish cycle · …"), and read
persisted state through `ls('protocol_os_…')` rather than scraping. If the check needs more seed data,
extend `romanFixture()` in `tests/helpers/fixture.mjs` rather than editing localStorage mid-run. Run
with `E2E_HEADED=1 E2E_SLOWMO=200 node tests/e2e.mjs` while developing, then `npm run ci` before
pushing.
