#!/usr/bin/env node
// Dev tool: list UI strings that are not translated.
//
// The skin calls t('English phrase') everywhere; translations live in
// src/i18n/de1-translations.csv (column 0 = the English key, one column per
// language). A phrase shows up in English in another language when either
//   (1) the English key is missing from the CSV entirely, or
//   (2) the key is in the CSV but that language's cell is empty.
//
// This scans the source for literal t('...') / t("...") keys and cross-checks
// them against the CSV, for the languages the skin actually offers (i18n.js
// LANGUAGES). Dynamic keys (t(someVar), template literals) can't be checked
// statically and are ignored — grep for them separately if needed.
//
// Usage:
//   node tools/list-untranslated.mjs            # summary + missing-from-CSV list
//   node tools/list-untranslated.mjs --lang fr  # also dump every untranslated key for fr
//   node tools/list-untranslated.mjs --all      # dump untranslated keys for every offered language

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const CSV = join(SRC, 'i18n', 'de1-translations.csv');

// Languages the user can actually pick (mirror of i18n.js LANGUAGES codes).
const OFFERED = ['fr', 'es', 'de', 'de-ch', 'it', 'ca', 'kr', 'zh-hans', 'zh-hant', 'jp', 'pt', 'nl', 'ru', 'ar'];

// ---- collect every .js under src/ ----
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

// ---- extract literal t('...') / t("...") / t2('...') keys ----
const KEY_RE = /\bt2?\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)/g;
function unescape(s, q) { return s.replace(new RegExp('\\\\' + q, 'g'), q).replace(/\\\\/g, '\\'); }

// Vendored / minified files define their own `t(...)` helpers — skip them or we
// pick up library internals ("texttemplate", "contours.showlabels", …).
const SKIP = [/\/i18n\.js$/, /plotly-.*\.min\.js$/, /reconnecting-websocket\.js$/];
const usedKeys = new Set();
for (const file of walk(SRC)) {
  if (SKIP.some((re) => re.test(file))) continue;
  const text = readFileSync(file, 'utf8');
  let m;
  while ((m = KEY_RE.exec(text))) { const k = unescape(m[2], m[1]); if (k) usedKeys.add(k); }
}

// ---- parse the CSV (quoted fields with embedded commas) ----
const raw = readFileSync(CSV, 'utf8').replace(/^﻿/, '');
const lines = raw.trim().split(/\r?\n/);
const headers = lines[0].split(',').map((h) => h.trim());
const splitRe = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
const table = {};                                        // key -> { lang: value }
for (let i = 1; i < lines.length; i++) {
  if (!lines[i]) continue;
  const vals = lines[i].split(splitRe).map((v) => {
    v = v.trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/""/g, '"');
    return v;
  });
  const key = vals[0];
  if (!key) continue;
  const row = {};
  headers.forEach((lang, idx) => { if (vals[idx] !== undefined && vals[idx] !== '') row[lang] = vals[idx]; });
  table[key] = row;
}

// ---- report ----
const args = process.argv.slice(2);
const missingFromCsv = [...usedKeys].filter((k) => !(k in table)).sort();

console.log(`Scanned ${usedKeys.size} distinct t() keys in src/ against ${Object.keys(table).length} CSV rows.\n`);

console.log(`== ${missingFromCsv.length} key(s) used in code but ABSENT from the CSV (English in ALL languages) ==`);
missingFromCsv.forEach((k) => console.log('  ' + JSON.stringify(k)));

console.log('\n== per-language coverage (of the ' + usedKeys.size + ' used keys) ==');
const perLang = {};
for (const lang of OFFERED) {
  const missing = [...usedKeys].filter((k) => !(table[k] && table[k][lang])).sort();
  perLang[lang] = missing;
  const done = usedKeys.size - missing.length;
  console.log(`  ${lang.padEnd(8)} ${done}/${usedKeys.size} translated, ${missing.length} missing`);
}

const langArg = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : null;
const dumpLangs = args.includes('--all') ? OFFERED : (langArg ? [langArg] : []);
for (const lang of dumpLangs) {
  console.log(`\n== ${perLang[lang] ? perLang[lang].length : 0} untranslated key(s) for '${lang}' ==`);
  (perLang[lang] || []).forEach((k) => console.log('  ' + JSON.stringify(k)));
}
