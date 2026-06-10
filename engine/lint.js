#!/usr/bin/env node
'use strict';
/*
 * Hard-stop & interaction linter for Protocol-OS.
 *
 * Deterministic safety check: given a proposed compound, flag it against the
 * machine-readable hard stops (data/hard_stops.json), the compound knowledge
 * base avoid/contraindication lists (data/compounds.json), and the current
 * stack's avoid lists (data/stack.json). Run this BEFORE endorsing any addition
 * so a hard stop can never be missed by recall.
 *
 *   node engine/lint.js "Dihexa"
 *   node engine/lint.js "9-Me-BC" --json
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const load = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '');

const compounds = load('data/compounds.json');
const hardStops = load('data/hard_stops.json');
let stack = [];
try { stack = load('data/stack.json').active || []; } catch (e) { /* optional */ }

const byKey = {};
for (const c of compounds) { byKey[norm(c.id)] = c; byKey[norm(c.name)] = c; }

function findCompound(q) {
  const n = norm(q);
  if (byKey[n]) return byKey[n];
  return compounds.find((c) => {
    const ni = norm(c.id), nm = norm(c.name);
    return ni.includes(n) || nm.includes(n) || (n.length >= 4 && (n.includes(ni) || n.includes(nm)));
  }) || null;
}

function stackKeys() {
  const set = new Set();
  for (const s of stack) {
    set.add(norm(s.id)); set.add(norm(s.name));
    (s.aliases || []).forEach((a) => set.add(norm(a)));
  }
  return [...set].filter(Boolean);
}

function inStack(keys) {
  const sk = stackKeys();
  return keys.some((k) => { const nk = norm(k); return sk.some((x) => x.includes(nk) || nk.includes(x)); });
}

function matchAny(name, arr) {
  const n = norm(name);
  return (arr || []).some((a) => { const na = norm(a); return na && (n.includes(na) || na.includes(n)); });
}

function lint(query) {
  const findings = [];

  // 1) hard stops
  for (const r of hardStops.rules) {
    if (!matchAny(query, r.match && r.match.any)) continue;
    if (r.requiresInStack && !inStack(r.requiresInStack)) {
      findings.push({ severity: 'note', rule: r.id, msg: `${r.summary} — counterpart (${r.requiresInStack.join(', ')}) not currently in stack; becomes a HARD STOP if it is.` });
    } else {
      const sev = r.status === 'user-overridden' ? 'overridden' : (r.severity || 'caution');
      findings.push({ severity: sev, rule: r.id, msg: r.summary + (r.note ? ` — ${r.note}` : '') });
    }
  }

  // 2) compound DB avoid / contraindications / synergy
  const c = findCompound(query);
  if (c) {
    (c.avoid || []).forEach((a) => findings.push({ severity: 'caution', src: c.name, msg: `avoid: ${a}` }));
    (c.contraindications || []).forEach((a) => findings.push({ severity: 'caution', src: c.name, msg: `contraindication: ${a}` }));
    if (c.synergy && c.synergy.length) findings.push({ severity: 'info', src: c.name, msg: `synergy: ${c.synergy.join(', ')}` });
  } else {
    findings.push({ severity: 'info', msg: `"${query}" not in compounds.json — hard-stop check only (no DB avoid/contraindication data).` });
  }

  // 3) current-stack avoid lists that name the proposed compound
  for (const s of stack) {
    const sc = findCompound(s.id) || findCompound(s.name);
    if (sc && matchAny(query, sc.avoid)) {
      findings.push({ severity: 'caution', src: s.name || s.id, msg: `current-stack item "${sc.name}" lists an avoid matching "${query}"` });
    }
  }

  return { query, matched: c ? c.name : null, findings };
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const q = args.filter((a) => !a.startsWith('--')).join(' ').trim();
  if (!q) { console.error('usage: node engine/lint.js "<compound name>" [--json]'); process.exit(1); }

  const res = lint(q);
  if (json) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }

  const icon = { 'hard-stop': '🛑', overridden: '⚠️ ', caution: '⚠️ ', note: '🔵', info: 'ℹ️ ' };
  const order = ['hard-stop', 'overridden', 'caution', 'note', 'info'];
  const sorted = res.findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  console.log(`\nLINT: ${res.query}${res.matched ? `  (matched: ${res.matched})` : ''}`);
  if (!sorted.length) console.log('  ✅ no flags');
  for (const f of sorted) {
    const tag = f.rule ? `#${f.rule}` : (f.src || 'db');
    console.log(`  ${icon[f.severity] || f.severity} [${tag}] ${f.msg}`);
  }
  const stops = sorted.filter((f) => f.severity === 'hard-stop');
  console.log(stops.length
    ? `\n  → ${stops.length} HARD STOP(s). Do NOT proceed without explicit re-discussion.\n`
    : '\n  → no hard stops.\n');
}

module.exports = { lint };
