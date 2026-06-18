#!/usr/bin/env node
'use strict';
/*
 * Canonical reconstitution / dosing engine for Protocol-OS.
 *
 * vialMath() is ported VERBATIM from the app (Protocol-OS-v2.html / index.html)
 * so that chat, CLI, and the app always agree. This file is the single source of
 * truth for dose arithmetic — do NOT hand-compute units in chat, call this.
 *
 * Unit-agnostic: works for mass (mg/mcg) OR activity (IU) as long as the vial
 * amount and the dose share a base unit. Conventions:
 *   - totalMg : amount in the vial, in "milli" units (mg, or thousands-of-IU)
 *   - totalMl : diluent volume added (mL)
 *   - doseMcg : dose, in "micro" units (mcg, or IU)   [1 milli = 1000 micro]
 *   - U-100 insulin syringe: 100 units = 1 mL
 *
 * Worked example (HCG): 5000 IU vial + 2 mL -> 2500 IU/mL; 250 IU dose = 10u.
 *   vialMath(5, 2, 250) -> unitsPerDose 10, totalDoses 20.
 */

// --- core (verbatim from app) -------------------------------------------------
function vialMath(totalMg, totalMl, doseMcg) {
  if (!totalMg || !totalMl) return null;
  const totalMcg = totalMg * 1000;
  const mcgPerMl = totalMcg / totalMl;
  const mcgPerUnit = mcgPerMl / 100;
  const volPerDose = doseMcg ? doseMcg / mcgPerMl : 0;
  const unitsPerDose = volPerDose * 100;
  const totalDoses = doseMcg ? Math.floor(totalMcg / doseMcg) : 0;
  return { totalMcg, mcgPerMl, mcgPerUnit, volPerDose, unitsPerDose, totalDoses };
}

// --- inverse: how much drug sits in N syringe units --------------------------
function unitsToDose(totalMg, totalMl, units) {
  if (!totalMg || !totalMl) return null;
  const mcgPerMl = (totalMg * 1000) / totalMl;
  const mcgPerUnit = mcgPerMl / 100;
  return { doseMcg: units * mcgPerUnit, mcgPerUnit, volMl: units / 100 };
}

// --- solver: diluent volume that lands a dose on a target unit mark ----------
// "cleaner draw" optimization, e.g. SS-31 30mg vial so 2mg lands on 20u.
// Derivation: unitsPerDose = doseMcg * totalMl / (totalMg * 10)
//          => totalMl      = targetUnits * totalMg * 10 / doseMcg
function solveDiluent(totalMg, doseMcg, targetUnits) {
  if (!totalMg || !doseMcg || !targetUnits) return null;
  const totalMl = (targetUnits * totalMg * 10) / doseMcg;
  return { totalMl, check: vialMath(totalMg, totalMl, doseMcg) };
}

module.exports = { vialMath, unitsToDose, solveDiluent };

// --- CLI ---------------------------------------------------------------------
if (require.main === module) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const json = argv.includes('--json');
  const flag = (name) => {
    const i = argv.indexOf('--' + name);
    return i >= 0 && argv[i + 1] != null ? Number(argv[i + 1]) : undefined;
  };
  const r = (n, d = 3) => (n == null ? n : Math.round(n * 10 ** d) / 10 ** d);
  const usage = `Protocol-OS dose engine
  node engine/dose.js units --mg <vialMg> --ml <diluentMl> --dose <doseMcg>
  node engine/dose.js dose  --mg <vialMg> --ml <diluentMl> --units <units>
  node engine/dose.js solve --mg <vialMg> --dose <doseMcg> --units <targetUnits>
  (add --json for raw output)`;

  let out;
  if (cmd === 'units') {
    out = vialMath(flag('mg'), flag('ml'), flag('dose'));
    if (out && !json) {
      console.log(`\n${flag('mg')}mg + ${flag('ml')}mL  →  ${r(out.mcgPerMl)} mcg/mL (${r(out.mcgPerUnit)} mcg/unit)`);
      console.log(`dose ${flag('dose')} mcg  →  ${r(out.unitsPerDose, 1)} units  (${r(out.volPerDose, 3)} mL)`);
      console.log(`doses per vial: ${out.totalDoses}\n`);
    }
  } else if (cmd === 'dose') {
    out = unitsToDose(flag('mg'), flag('ml'), flag('units'));
    if (out && !json) {
      console.log(`\n${flag('units')} units  →  ${r(out.doseMcg, 1)} mcg  (${r(out.volMl, 3)} mL, ${r(out.mcgPerUnit)} mcg/unit)\n`);
    }
  } else if (cmd === 'solve') {
    out = solveDiluent(flag('mg'), flag('dose'), flag('units'));
    if (out && !json) {
      console.log(`\nto land ${flag('dose')} mcg on ${flag('units')} units:`);
      console.log(`reconstitute ${flag('mg')}mg vial with  →  ${r(out.totalMl, 3)} mL`);
      console.log(`check: ${r(out.check.unitsPerDose, 1)}u/dose, ${out.check.totalDoses} doses/vial\n`);
    }
  } else {
    console.log(usage);
    process.exit(cmd ? 1 : 0);
  }
  if (out == null) { console.error('null result — check inputs.\n' + usage); process.exit(1); }
  if (json) console.log(JSON.stringify(out, null, 2));
}
