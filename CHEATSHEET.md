# Protocol-OS toolkit — cheatsheet

Everything we built to make protocol analysis **accurate, fast, and cheap on tokens**.
Rule of thumb: **compute, don't reason.** For dose math and hard stops, run the tool —
don't trust mental arithmetic or memory.

All commands run from the repo root (`/home/user/protocol-os`). Node 18+ (tested on v22).

---

## 1. Dose / reconstitution math — `engine/dose.js`

Canonical syringe-unit math, ported verbatim from the app so chat/CLI/app always agree.
Unit-agnostic: pass IU exactly like mcg (e.g. HCG 5000 IU vial → `--mg 5`, 250 IU → `--dose 250`).

| I want… | Command | Example |
|---|---|---|
| **units from a dose** (mg vial + mL diluent → units, mcg/unit, doses/vial) | `node engine/dose.js units --mg <vialMg> --ml <ml> --dose <doseMcg>` | `node engine/dose.js units --mg 30 --ml 2 --dose 2000` → 13.3u |
| **dose from units** (what's in N units on the syringe) | `node engine/dose.js dose --mg <vialMg> --ml <ml> --units <u>` | `node engine/dose.js dose --mg 30 --ml 2 --units 13` → 1950 mcg |
| **clean-draw diluent** (what mL lands a dose on a tidy unit mark) | `node engine/dose.js solve --mg <vialMg> --dose <doseMcg> --units <targetU>` | `node engine/dose.js solve --mg 30 --dose 2000 --units 20` → 3 mL |

- Add `--json` for raw numbers (scripting / piping).
- Doses are in **mcg**, vial amount in **mg** (or thousands-of-IU). 1 mL = 100 U on a U-100 syringe.
- Reference checks that should always hold: HCG `--mg 5 --ml 2 --dose 250` → 10u, 20 doses · reta `--mg 10 --ml 1 --dose 1000` → 10u.

---

## 2. Hard-stop / interaction check — `engine/lint.js`

**Run before endorsing or adding any compound, dose, or route change.** Deterministic —
checks the 13 hard stops, the compound's own avoid/contraindication list, and the current
stack's avoid lists. On 🛑 **stop and re-discuss; never override silently.**

```bash
node engine/lint.js "<compound name>"      # human-readable
node engine/lint.js "Dihexa" --json        # machine output
```

Output legend:
- 🛑 **hard-stop** — blocking. Do not proceed without explicit re-discussion.
- ⚠️ **caution** — an avoid / contraindication worth weighing (or a user-overridden stop).
- 🔵 **note** — conditional stop that is *not* active right now (counterpart not in stack), but would fire if it were.
- ℹ️ **info** — synergy, or "not in the compound DB" (hard-stop check still ran).

Conditional rules are stack-aware: e.g. **Dihexa** fires 🛑 only while IGF-1 is in
`data/stack.json`; remove IGF-1 and it downgrades to a 🔵 note.

---

## 3. Compound knowledge base — `data/compounds.json`

77 compounds (purpose / dose range / reconstitution / synergy / avoid / contraindications),
extracted from the app's `PEPTIDE_DB` so you can use it **without ever loading the
~967K-token app HTML**.

```bash
# look one up without burning context on the whole file
node -e "console.log(JSON.stringify(require('./data/compounds.json').find(c=>/bpc/i.test(c.name)),null,2))"

# regenerate after editing PEPTIDE_DB in the app
node tools/extract-compounds.js
```

---

## 4. The data files (edit these when the protocol changes)

| File | What it is | When to edit |
|---|---|---|
| `data/hard_stops.json` | The 13 hard stops as machine-checkable rules | When a hard stop is added/revised in `STATE_Roman.md` |
| `data/stack.json` | Current active stack + standing Rx (drives conditional rules) | When you start/stop a compound |
| `data/compounds.json` | Generated compound DB | Don't hand-edit — re-run `tools/extract-compounds.js` |

`STATE_Roman.md` stays **authoritative**; these JSON files are mirrors. Keep them in sync.

---

## 5. Skills (auto-invoked, or type the slash command)

| Skill | Use it for |
|---|---|
| `protocol-tools` | Auto-loads when a turn needs dose math or a compound check — tells me to run §1/§2 instead of guessing |
| `/gemini-verify <decision>` | High-stakes second opinion (Gemini 3.1 Pro deep-thinking) — dose math, interactions, hard stops |
| `/gemini-quick <question>` | Fast throwaway sanity check (Gemini 3.5 Flash) |
| `/deep-research <topic>` | Multi-source, fact-checked research report |

**Recommended workflow for a high-stakes change:** run `engine/lint.js` → run `engine/dose.js`
→ then `/gemini-verify` for an independent judgment cross-check. Math is settled by code;
Gemini is reserved for reasoning.

---

## Token hygiene (why this exists)

- **Never** open `index.html` / `Protocol-OS-v2.html` whole — each is ~967K tokens (~half a
  context window). Use the extracted artifacts above, or `Read` a narrow line range.
- `STATE_Roman.md` loads every turn — answer the *delta*, don't reprint it.
- Settled **STORED** items live in `STATE_archive.md`, loaded only when needed.
