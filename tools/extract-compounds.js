#!/usr/bin/env node
'use strict';
/*
 * Regenerate data/compounds.json from the app's PEPTIDE_DB.
 *
 * The compound knowledge base (purpose / protocol / reconstitution / synergy /
 * avoid / contraindications) lives inside the ~967K-token app HTML, which must
 * never be loaded into an LLM context. This script extracts just the PEPTIDE_DB
 * array into a small JSON file that *can* be loaded on demand.
 *
 * Re-run after changing PEPTIDE_DB in the app:  node tools/extract-compounds.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = ['Protocol-OS-v2.html', 'index.html']
  .map((f) => path.join(ROOT, f))
  .find(fs.existsSync);

if (!SRC) { console.error('No source HTML (Protocol-OS-v2.html / index.html) found.'); process.exit(1); }

const html = fs.readFileSync(SRC, 'utf8');
const start = html.indexOf('const PEPTIDE_DB');
if (start < 0) { console.error('PEPTIDE_DB declaration not found in ' + path.basename(SRC)); process.exit(1); }
const end = html.indexOf('const CATEGORIES', start);
if (end < 0) { console.error('end marker (const CATEGORIES) not found after PEPTIDE_DB'); process.exit(1); }

const slice = html.slice(start, end).trim(); // "const PEPTIDE_DB = [ ... ];"
let db;
try {
  db = new Function(slice + '\nreturn PEPTIDE_DB;')(); // pure data literal — safe to evaluate
} catch (e) {
  console.error('Failed to evaluate PEPTIDE_DB literal: ' + e.message);
  process.exit(1);
}

const out = path.join(ROOT, 'data', 'compounds.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(db, null, 2) + '\n');
console.log(`Extracted ${db.length} compounds from ${path.basename(SRC)} -> data/compounds.json`);
