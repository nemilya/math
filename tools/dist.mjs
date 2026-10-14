#!/usr/bin/env node
/* Folder for hosting: node tools/dist.mjs [folder] (default dist/) + dist.zip — as in nemilya/education.
 * Copies only what the browser needs: the page, styles, engine, adventures, voice.
 * No build step and no file changes — all paths are relative, so the folder can be uploaded
 * to any subfolder of a static host as is (e.g. example.org/lumo/). */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
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
cpSync(join(ROOT, 'LICENSE'), join(OUT, 'LICENSE'));
n += 1;
const zip = `${OUT}.zip`;
rmSync(zip, { force: true });
try {
  execFileSync('zip', ['-qr', zip, '.'], { cwd: OUT });
} catch {
  /* no zip — just the folder */
}
console.log(`${n} files, ${(bytes / 1048576).toFixed(1)} MB → ${relative(ROOT, OUT)}/${existsSync(zip) ? ` and ${relative(ROOT, zip)}` : ''}`);
