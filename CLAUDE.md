# Protocol-OS — working notes for Claude

A single-file PWA for tracking a personal peptide/hormone/longevity protocol, plus
a small toolchain for doing the *analysis* around it accurately and cheaply.

## ⛔ Never load the app HTML into context

`index.html` and `Protocol-OS-v2.html` are each **~967K tokens** (~half a context
window). **Never `Read` them whole.** They are an intentional source→deploy pair:

- `Protocol-OS-v2.html` — the **source** (single-file React+Babel; see `REDESIGN_PLAN.md`).
- `index.html` — the **GitHub Pages deploy copy**. Sync via `cp Protocol-OS-v2.html index.html`.

They are byte-identical when in sync. Do not delete either — both are needed.
If you need data or logic from them, use the extracted artifacts below, or read a
**narrow line range** with `Read` offset/limit (never the whole file).

## Where each fact lives (one source per fact)

| Need | Source |
|---|---|
| Current live protocol, hard stops, labs, watch-list | `STATE_Roman.md` (authoritative; loads every turn — answer the *delta*, don't reprint tables) |
| Settled/stored inventory + full rationale | `STATE_archive.md` |
| Compound facts (purpose/dose/recon/synergy/avoid/contraindications) | `data/compounds.json` (generated from app `PEPTIDE_DB`) |
| Dose / reconstitution arithmetic | `engine/dose.js` (verbatim port of app `vialMath`) |
| Hard-stop / interaction checks | `engine/lint.js` + `data/hard_stops.json` + `data/stack.json` |
| Deep reasoning log / mechanistic reference | `Clinical_Case_Summary` (external attachment) |

## Compute, don't reason (accuracy)

- **Dose math** → `node engine/dose.js …`. Never hand-compute syringe units.
- **Hard stops / interactions** → `node engine/lint.js "<compound>"` **before**
  endorsing any new compound, dose, or route change. On 🛑, stop and surface it.
- See the `protocol-tools` skill for usage. High-stakes calls also get
  `/gemini-verify` (independent second opinion).

## Regenerating artifacts

```bash
node tools/extract-compounds.js   # data/compounds.json  ← PEPTIDE_DB in the app
```
`data/hard_stops.json` and `data/stack.json` are hand-curated mirrors of
`STATE_Roman.md`; update them when the protocol or hard stops change.

## Token discipline

- Keep `STATE_Roman.md` lean — it loads every turn. Settled `STORED` decisions live
  in `STATE_archive.md`; a one-line roster stays in STATE so stored compounds aren't
  accidentally re-recommended.
- Load `data/compounds.json` only when a compound lookup/lint actually runs.
- Don't load the app HTML (see top).

## This is a health protocol, not a toy

Treat changes to `STATE_Roman.md`, `data/hard_stops.json`, and `data/stack.json` as
edits to a medical source of truth: move/flag, don't silently drop; flag every
reversal; never override a hard stop without explicit re-discussion.
