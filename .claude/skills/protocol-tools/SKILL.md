---
name: protocol-tools
description: Deterministic dose math and hard-stop/interaction checks for the Protocol-OS health repo. Use whenever a turn involves reconstitution/units math (mg/IU → syringe units, diluent volume) or proposing/adding/changing a compound. ALWAYS run these tools instead of hand-computing arithmetic or recalling hard stops from memory.
---

# protocol-tools — dose math + interaction linter (deterministic)

This repo holds a real health protocol. Two classes of work must be **computed,
not reasoned**, because model arithmetic and model recall both drift:

1. **Dose / reconstitution math** → `engine/dose.js`
2. **Hard-stop / interaction checks** → `engine/lint.js`

`STATE_Roman.md` is the authoritative live state. These tools are the authoritative
*computation* over it.

## When to use

- Any "X mg from a Y-mg vial + Z mL = ? units", "what diluent for a clean draw",
  or "how many doses per vial" → **dose.js**. Never hand-compute units.
- Any time a new compound is proposed, added, swapped, or a dose/route changes,
  or before endorsing anything that touches the HARD STOPS → **lint.js** first.

## Dose math — `engine/dose.js`

```bash
node engine/dose.js units --mg 30 --ml 2 --dose 2000     # mg+mL → units/dose, mcg/unit, doses/vial
node engine/dose.js dose  --mg 30 --ml 2 --units 13      # inverse: units → dose
node engine/dose.js solve --mg 30 --dose 2000 --units 20 # diluent mL that lands the dose on N units
```
Unit-agnostic: pass IU the same way as mcg as long as vial amount and dose share a
base unit (e.g. HCG 5000 IU vial → `--mg 5`, 250 IU dose → `--dose 250`). Add
`--json` for raw numbers. `vialMath()` is ported verbatim from the app, so CLI and
app always agree.

## Interaction linter — `engine/lint.js`

```bash
node engine/lint.js "Dihexa"        # 🛑 if a hard stop fires; ⚠️ avoid/contraindication; ℹ️ synergy
node engine/lint.js "9-Me-BC" --json
```
Checks the proposal against: machine-readable hard stops (`data/hard_stops.json`),
the compound knowledge base (`data/compounds.json` — avoid / contraindications /
synergy), and the current stack's avoid lists (`data/stack.json`). On any 🛑
**stop and surface both the rule and the conflict — do not endorse the change.**

## Keeping data current

- `data/compounds.json` is generated from the app: `node tools/extract-compounds.js`
  (re-run after editing `PEPTIDE_DB`). **Never read the app HTML into context** —
  it is ~967K tokens.
- `data/hard_stops.json` and `data/stack.json` mirror `STATE_Roman.md`. STATE is
  authoritative; update these when the protocol or hard stops change.

## Reporting

Lead with the computed result or any 🛑 hard stop. For high-stakes/irreversible
calls, this deterministic check pairs with the `/gemini-verify` second opinion —
run the math here first, then cross-check judgment there.
