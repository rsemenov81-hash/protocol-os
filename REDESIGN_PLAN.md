# Protocol-OS Redesign v3 — Build Plan

**Branch:** `redesign-v3` (do NOT merge to main until every phase verified in-browser).
**Golden rule:** Roman has said 3× — **keep functionality and synchronization intact.** The cloud sync (`/sync` POST/GET to protocol-sync worker) and the `protocol` CLI + MCP `get_adherence`/`get_logs_for_date` tools all read the **log shape**. Any change to logs MUST stay backward-compatible.

**File:** `Protocol-OS-v2.html` (~2100 lines, single-file React+Babel). `index.html` is the GitHub Pages deploy copy — sync them at the end.

**Verify after every phase:** serve locally (`python3 -m http.server PORT`), load in Chrome MCP, check `read_console_messages onlyErrors:true` = clean, AND confirm a test Administer still writes a log that `protocol adherence` (CLI) can read.

---

## Design direction (locked with Roman)
- **Theme:** Auto light/dark — follows device via `@media (prefers-color-scheme)`. Currently only dark (`:root` at ~line 428, `--bg:#000`). Add a light-mode block.
- **Accent:** Graphite + white (monochrome, quiet-luxury). Replace the electric-blue `--accent`/`--accent-2` (rgba(10,132,255,...)) with graphite/white system. Keep `--success`/`--warn`/`--danger` semantic colors.
- **Feel:** iOS-26/27 — frosted glass cards, hairline borders, soft depth, smooth cubic-bezier transitions, glass-like buttons. `.glass`/`.glass-strong` classes already exist (line 470-471) — extend, don't replace.

---

## DONE
- ✅ **#1 Default Administer time = now** (line ~1531, committed 43d75d9). Was hardcoded 8am; now uses current H:M, still editable via datetime-local + quick-time chips.

## REMAINING PHASES

### Phase 1 — IU units (ask #2)
**Goal:** MCG default everywhere; per-vial option to dose in IU (HCG is the case). 
**Infra that already exists:** vials can carry `unitLabel: 'IU'` (set at line ~124 during seed normalization). `fmtMcg` at line 726.
**Do:**
1. In Administer modal (`administer()` ~line 1526, the `Modal` component ~1533): when `targetVial.unitLabel === 'IU'`, relabel the "mcg" syringe input as "IU" and show IU in the deduct line. The underlying math (mcgPerMl) still works because IU vials store an IU↔volume mapping — but HCG has `mgPerVial:0`, so for IU vials compute concentration from an `iuPerVial` field instead. ADD `iuPerVial` to the vial/storage schema + the AddVial form (~line 1142 has the Form select).
2. **Log shape (SYNC-CRITICAL):** keep `doseMcg` for mcg compounds. For IU, add `doseValue` + `doseUnit:'IU'` to the log, AND still set `doseMcg` to the IU number (so existing readers don't break) OR set `doseMcg:null` and update the worker. SAFER: add `doseValue`/`doseUnit` as NEW optional fields, leave `doseMcg` populated. Then update worker `fmtDose()` + CLI `fmt_dose()` to prefer `doseValue`+`doseUnit` when present.
3. Default unit selector = MCG. Only show IU toggle when vial supports it.
**Verify:** log an HCG dose in IU → `protocol logs` (CLI) shows it correctly; mcg compounds unaffected.

### Phase 2 — Shot-centric Administer + blend breakdown (ask #3)
**Goal:** Lead with **syringe units** (what you draw), then show "what's inside" — for blends, how much of EACH component.
**Infra:** `describeCompound()` (line 755) already computes blend % from `p.ingredients`. The seed blends (KLOW, Neurolux, Calm Mix, Coremend) have ingredient ratios in PEPTIDE_DB. The Administer modal already shows mL/Units/mcg (line ~1600).
**Do:**
1. Make **Units** the visually primary field (bigger, top).
2. Below the draw, add a "In this shot" panel: for a blend vial, for each component compute `componentMcg = volPerDose × (componentMg×1000 / diluentMl)` and list it (the AddVial reconstitution modal already does this exact calc at line ~2036-2039 — reuse that logic).
3. Numbers driven by the vial's actual reconstitution (mgPerVial + diluentMl).

### Phase 3 — Per-vial reconstitution memory (ask #4)
**Goal:** If a vial's reconstitution is unknown when administering, ASK once, store on the vial, remember. Allow editing later.
**Infra:** vials already have `diluentMl`, `mcgPerMl`, `reconstitutedAt`. Reconstitution is set when activating from inventory (line ~1167 `newVial`).
**Do:**
1. In `administer()`, if `targetVial` exists but `!targetVial.mcgPerMl` (or no diluentMl), show a reconstitution sub-prompt FIRST (BAC mL + confirm), write it to the vial via setVials, THEN continue to dose entry.
2. Add an "Edit reconstitution" affordance on the vial (InventoryView ~line 1694, and/or a pencil in the Administer modal) that lets diluentMl change later and recomputes mcgPerMl/unitsPerDose.
3. Persist → auto-syncs (vials are in the synced payload already).

### Phase 4 — Compact 2-per-row layout (ask #5)
**Goal:** Two compounds side by side per line to shorten the long list.
**Infra:** DoseCard rendered in ProtocolView blocks (~line 1512-1522 build byBlock; cards render below). Currently full-width.
**Do:** Wrap each block's cards in a `display:grid; grid-template-columns:1fr 1fr; gap` (responsive: 1 col on very narrow). Shrink DoseCard padding/font to fit. The Administer button (line ~1039) becomes a compact icon or smaller pill. Keep the logged/skipped/future states.

### Phase 5 — iOS glass visual redesign (ask #6) — DO LAST, riskiest
**Goal:** Modern, professional, "expensive", iOS-27, smooth transitions, glass buttons, auto light/dark, graphite+white.
**Do:**
1. CSS variables (`:root` ~line 428): introduce light + dark via `@media (prefers-color-scheme: light)`. Define graphite/white accent set.
2. Buttons → glass treatment (backdrop-filter, subtle border, inset highlight). `.btn`, `.btn-ghost`, `.btn-primary`.
3. Transitions: cubic-bezier(0.16,1,0.3,1) on cards/modals/nav (some already there).
4. Pill-nav, modals, cards: refine blur/saturation/shadow for depth.
5. Keep ALL functional classes/handlers — only restyle.
**Verify:** toggle device appearance → both themes legible; all 4 tabs render; Administer modal usable.

---

## Final merge checklist
- [ ] All phases verified in-browser, console clean
- [ ] Test Administer (mcg AND IU) → `protocol adherence` CLI reads both
- [ ] Cloud sync round-trips (Export→KV→reload pulls same)
- [ ] `cp Protocol-OS-v2.html index.html`
- [ ] Commit, `git checkout main && git merge redesign-v3`, push
- [ ] Hard-refresh iPhone, confirm live

## Worker/CLI files that may need parallel edits (Phase 1)
- `/Users/romansemenov/Desktop/ClaudeCode/protocol-sync/worker.js` — `fmtDose()` (~line 49) + paste into Cloudflare protocol-sync worker after editing
- `/Users/romansemenov/.local/bin/protocol` — `fmt_dose()` (~line 60)
