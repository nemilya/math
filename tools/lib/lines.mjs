// Shared by tools: load every content/<ns>/lines.<lang>.js and expand lines into
// voice ids — exactly the ids web/src/i18n.js asks the voice for.
//
//   'key': 'text'                          → ns:key
//   'key': ['a', 'b']                      → ns:key.0, ns:key.1          (variants)
//   'key': { small: 'a', big: ['b', 'c'] } → ns:key~small, ns:key~big.0 … (age versions)

import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web');
export const CONTENT = join(WEB, 'content');
export const AGES = ['small', 'middle', 'big'];

export async function loadAll() {
  const out = {}; // ns -> lang -> table
  for (const ns of await readdir(CONTENT, { withFileTypes: true })) {
    if (!ns.isDirectory()) continue;
    for (const f of await readdir(join(CONTENT, ns.name))) {
      const m = f.match(/^lines\.([a-z]{2})\.js$/);
      if (!m) continue;
      const mod = await import(pathToFileURL(join(CONTENT, ns.name, f)).href);
      (out[ns.name] ??= {})[m[1]] = mod.default;
    }
  }
  return out;
}

export const isAged = (v) => v && typeof v === 'object' && !Array.isArray(v);

// All spoken lines of one language: [{ id, text }]
export function expand(all, lang) {
  const rows = [];
  const push = (id, v) => {
    if (Array.isArray(v)) v.forEach((text, i) => rows.push({ id: `${id}.${i}`, text }));
    else rows.push({ id, text: v });
  };
  for (const [ns, langs] of Object.entries(all)) {
    for (const [key, v] of Object.entries(langs[lang] || {})) {
      if (isAged(v)) for (const age of AGES) v[age] != null && push(`${ns}:${key}~${age}`, v[age]);
      else push(`${ns}:${key}`, v);
    }
  }
  return rows.filter((r) => r.text);
}
