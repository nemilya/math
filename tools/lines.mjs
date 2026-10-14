#!/usr/bin/env node
// Lumo's spoken lines.
//
//   node tools/lines.mjs check          every language has every line (and every age version);
//                                       scripts only use lines that exist
//   node tools/lines.mjs export ru      all Russian lines as JSON [{id, text}]
//
// Voicing them: node tools/voice.mjs (make voice).

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WEB, CONTENT, AGES, loadAll, expand, isAged } from './lib/lines.mjs';

const BASE = 'en'; // the project's main language: every other language must match it

const literals = (src) =>
  [...src.replace(/[=!]==\s*'[^']*'/g, '').matchAll(/'([^'\\]+)'/g)].map((m) => m[1]);

function usedKeys(src, ns) {
  const keys = new Set();
  for (const m of src.matchAll(/\b(?:say|sayWhile|talk)\(([^)]*)\)/g)) literals(m[1]).forEach((k) => keys.add(k));
  for (const m of src.matchAll(/hints:\s*\[([^\]]*)\]/g)) literals(m[1]).forEach((k) => keys.add(k));
  for (const m of src.matchAll(/prompt:\s*'([^']+)'/g)) keys.add(m[1]);
  return [...keys].map((k) => (k.includes(':') ? k : `${ns}:${k}`));
}

async function check() {
  const all = await loadAll();
  let problems = 0;
  const report = (msg) => (problems++, console.log('  ✗ ' + msg));

  for (const [ns, langs] of Object.entries(all)) {
    const base = langs[BASE] || {};
    for (const [lang, table] of Object.entries(langs)) {
      for (const [k, v] of Object.entries(table)) {
        if (isAged(v)) for (const a of Object.keys(v)) if (!AGES.includes(a)) report(`${ns}:${k} — unknown age "${a}" in "${lang}"`);
      }
      if (lang === BASE) continue;
      for (const k of Object.keys(base)) {
        if (!(k in table)) report(`${ns}:${k} — missing in "${lang}"`);
        else if (isAged(base[k]) || isAged(table[k])) {
          const ages = (v) => (isAged(v) ? Object.keys(v).sort().join(',') : '-');
          if (ages(base[k]) !== ages(table[k])) report(`${ns}:${k} — age versions differ: ${BASE} [${ages(base[k])}] vs ${lang} [${ages(table[k])}]`);
        }
      }
      for (const k of Object.keys(table)) if (!(k in base)) report(`${ns}:${k} — in "${lang}" but not in "${BASE}"`);
    }
  }

  const sources = [
    ...Object.keys(all)
      .filter((ns) => existsSync(join(CONTENT, ns, 'script.js')))
      .map((ns) => [join(CONTENT, ns, 'script.js'), ns]),
    [join(WEB, 'src', 'sky.js'), 'sky'],
    [join(WEB, 'src', 'scene.js'), 'common'],
  ];
  for (const [file, ns] of sources) {
    const src = (await readFile(file, 'utf8')).replace(/^\s*\/\/.*$/gm, ''); // skip comments
    for (const full of usedKeys(src, ns)) {
      const [n, k] = [full.slice(0, full.indexOf(':')), full.slice(full.indexOf(':') + 1)];
      if (!all[n]?.[BASE] || !(k in all[n][BASE])) report(`${relative(WEB, file)} uses unknown line ${full}`);
    }
  }

  // The opening lines an adventure fetches ahead (`first` in stars.js) must exist.
  const { STARS } = await import(pathToFileURL(join(CONTENT, 'stars.js')).href);
  for (const st of STARS) {
    for (const k of st.first || []) if (!all[st.id]?.[BASE] || !(k in all[st.id][BASE])) report(`stars.js: ${st.id} first: unknown line ${st.id}:${k}`);
  }

  const langs = [...new Set(Object.values(all).flatMap((l) => Object.keys(l)))];
  const counts = langs.map((l) => `${l}: ${expand(all, l).length}`).join(', ');
  console.log(`${Object.keys(all).length} namespaces; spoken clips per language — ${counts}`);
  if (problems) {
    console.log(`${problems} problem(s)`);
    process.exit(1);
  }
  console.log('all good');
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'check') await check();
else if (cmd === 'export' && arg) console.log(JSON.stringify(expand(await loadAll(), arg), null, 2));
else console.log('usage: node tools/lines.mjs check | export <lang>');
