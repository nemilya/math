#!/usr/bin/env node
// Tools for Lumo's spoken lines.
//
//   node tools/lines.mjs check            every language has every line; scripts only use lines that exist
//   node tools/lines.mjs export ru        all Russian lines as JSON [{id, text}] — a script for a voice
//                                         actor or a TTS engine. Save each file as web/audio/ru/<ns>/<key>.mp3
//   node tools/lines.mjs manifest ru      list recorded files into web/audio/ru/manifest.json

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', 'web');
const CONTENT = join(WEB, 'content');
const BASE = 'ru';

async function loadAll() {
  const out = {}; // ns -> lang -> table
  for (const ns of await readdir(CONTENT, { withFileTypes: true })) {
    if (!ns.isDirectory()) continue;
    for (const f of await readdir(join(CONTENT, ns.name))) {
      const m = f.match(/^lines\.([a-z]{2})\.js$/);
      if (!m) continue;
      const mod = await import(pathToFileURL(join(CONTENT, ns.name, f)).href);
      ((out[ns.name] ??= {})[m[1]] = mod.default);
    }
  }
  return out;
}

const literals = (src) =>
  [...src.replace(/[=!]==\s*'[^']*'/g, '').matchAll(/'([^'\\]+)'/g)].map((m) => m[1]);

function usedKeys(src, ns) {
  const keys = new Set();
  for (const m of src.matchAll(/\b(?:say|talk)\(([^)]*)\)/g)) literals(m[1]).forEach((k) => keys.add(k));
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
      if (lang === BASE) continue;
      for (const k of Object.keys(base)) if (!(k in table)) report(`${ns}:${k} — missing in "${lang}"`);
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

  const langs = new Set(Object.values(all).flatMap((l) => Object.keys(l)));
  const count = Object.values(all).reduce((n, l) => n + Object.keys(l[BASE] || {}).length, 0);
  console.log(`${count} lines × ${langs.size} languages (${[...langs].join(', ')}) in ${Object.keys(all).length} namespaces`);
  if (problems) {
    console.log(`${problems} problem(s)`);
    process.exit(1);
  }
  console.log('all good');
}

async function exportLang(lang) {
  const all = await loadAll();
  const rows = [];
  for (const [ns, langs] of Object.entries(all)) {
    for (const [key, v] of Object.entries(langs[lang] || {})) {
      if (Array.isArray(v)) v.forEach((text, i) => rows.push({ id: `${ns}:${key}.${i}`, text }));
      else rows.push({ id: `${ns}:${key}`, text: v });
    }
  }
  console.log(JSON.stringify(rows, null, 2));
}

async function manifest(lang) {
  const root = join(WEB, 'audio', lang);
  const ids = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.isDirectory()) await walk(join(dir, e.name));
      else if (e.name.endsWith('.mp3')) {
        const rel = relative(root, join(dir, e.name)).replace(/\.mp3$/, '').split(/[\\/]/);
        ids.push(`${rel[0]}:${rel.slice(1).join('/')}`);
      }
    }
  };
  if (existsSync(root)) await walk(root);
  await writeFile(join(root, 'manifest.json'), JSON.stringify(ids.sort(), null, 1) + '\n');
  console.log(`${ids.length} recorded lines for "${lang}"`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'check') await check();
else if (cmd === 'export' && arg) await exportLang(arg);
else if (cmd === 'manifest' && arg) await manifest(arg);
else console.log('usage: node tools/lines.mjs check | export <lang> | manifest <lang>');
