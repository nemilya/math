#!/usr/bin/env node
/* Folder for hosting: node tools/dist.mjs [folder] (default dist/) + dist.zip — as in nemilya/education.
 * Copies only what the browser needs: the page, styles, engine, adventures, voice.
 * No build step — all paths are relative, so the folder can be uploaded to any subfolder of a
 * static host as is (e.g. example.org/lumo/).
 *
 * One change to the copies: a version stamp. Every link to code (index.html → app.js and
 * style.css, every relative import in the scripts) gets ?v=<hash of all the code>. Otherwise,
 * after an update, a browser may take some modules fresh and others from its cache — a new
 * adventure calling a scene method the cached scene.js doesn't have yet, and "play" does
 * nothing. With the stamp, new code is a new set of URLs, fetched together. (The voice needs
 * no stamp: clip names are hashes of their content, and the manifest is always revalidated.) */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const WEB = join(ROOT, 'web');
const OUT = resolve(ROOT, process.argv[2] || 'dist');
const KEEP = [
  /^index\.html$/,
  /^style\.css$/,
  /^src\/[^/]+\.js$/,
  /^content\/[^/]+\.js$/,
  /^content\/[^/]+\/[^/]+\.js$/,
  /^audio\/[a-z]{2}\/(manifest\.json|[0-9a-f]+\.mp3)$/,
];

const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [relative(WEB, p)];
  });

rmSync(OUT, { recursive: true, force: true });
let n = 0;
let bytes = 0;
for (const f of walk(WEB).filter((x) => KEEP.some((r) => r.test(x)))) {
  mkdirSync(dirname(join(OUT, f)), { recursive: true });
  cpSync(join(WEB, f), join(OUT, f));
  n += 1;
  bytes += statSync(join(WEB, f)).size;
}

// ----- the version stamp -----
const code = walk(OUT).filter((f) => /\.(js|css|html)$/.test(f)).sort();
const hash = createHash('sha1');
for (const f of code) hash.update(f).update(readFileSync(join(OUT, f)));
const V = hash.digest('hex').slice(0, 10);
const stamp = (f, re, to) => {
  const p = join(OUT, f);
  const before = readFileSync(p, 'utf8');
  const after = before.replace(re, to);
  if (after !== before) writeFileSync(p, after);
  return (after.match(new RegExp(`\\?v=${V}`, 'g')) || []).length;
};
// static `from './x.js'`, dynamic `import('./x.js')` and `import(`../content/${ns}/lines.${lang}.js`)`
const IMPORT = /(\bfrom\s*|\bimport\s*\(\s*)(['"`])(\.{1,2}\/[^'"`]*?\.js)\2/g;
let links = 0;
for (const f of code.filter((x) => x.endsWith('.js'))) links += stamp(f, IMPORT, `$1$2$3?v=${V}$2`);
links += stamp('index.html', /(src="src\/app\.js|href="style\.css)"/g, `$1?v=${V}"`);

cpSync(join(ROOT, 'LICENSE'), join(OUT, 'LICENSE'));
n += 1;
const zip = `${OUT}.zip`;
rmSync(zip, { force: true });
try {
  execFileSync('zip', ['-qr', zip, '.'], { cwd: OUT });
} catch {
  /* no zip — just the folder */
}
console.log(`version ${V}: ${links} links to code stamped`);
console.log(`${n} files, ${(bytes / 1048576).toFixed(1)} MB → ${relative(ROOT, OUT)}/${existsSync(zip) ? ` and ${relative(ROOT, zip)}` : ''}`);
