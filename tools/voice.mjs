#!/usr/bin/env node
/* Lumo's voice: every line in web/content/<ns>/lines.<lang>.js → Gemini TTS (via OpenRouter)
 * → web/audio/<lang>/<hash>.mp3 + web/audio/<lang>/manifest.json (line id → file).
 * Same approach as nemilya/infographics and nemilya/education (scripts/video-voice.mjs).
 *
 *   make voice                                   # all languages (or: node tools/voice.mjs)
 *   node tools/voice.mjs ru                      # one language
 *   node tools/voice.mjs en --redo "magic"       # re-synthesise lines containing this text
 *   node tools/voice.mjs --dry                   # only list what would be synthesised
 *
 * Voice, model and manner — voice.config.json. The file name is a hash of (model, voice,
 * manner, text): only new or changed lines are synthesised, unused files are deleted.
 * Every new clip is transcribed back and compared with the text (lost words → synthesise again).
 * Key: OPENROUTER_API_KEY from the environment, or a line OPENROUTER_API_KEY = … in local.mk (not in git). */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { WEB, loadAll, expand } from './lib/lines.mjs';

const ROOT = resolve(WEB, '..');
const CFG = JSON.parse(readFileSync(join(ROOT, 'voice.config.json'), 'utf8'));

// local.mk → environment (as in education: OPENROUTER_API_KEY = …, OPENROUTER_PROXY = …)
if (existsSync(join(ROOT, 'local.mk'))) {
  for (const line of readFileSync(join(ROOT, 'local.mk'), 'utf8').split('\n')) {
    const m = line.match(/^\s*(OPENROUTER_[A-Z_]+)\s*[:?]?=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const { post } = await import('./lib/openrouter.mjs'); // after local.mk: the module reads the proxy on load

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : null);
const LANGS = args.filter((a, i) => /^[a-z]{2}$/.test(a) && !['--redo'].includes(args[i - 1]));
const DRY = flag('--dry');
const REDO = opt('--redo');
const VERIFY = { ...CFG.verify, enabled: CFG.verify?.enabled && !flag('--no-verify') };
const PARALLEL = 4;

const ff = (...a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a]);

async function tts(text, V, out) {
  const res = await post(
    '/audio/speech',
    { model: CFG.model, input: text, voice: V.voice, response_format: 'pcm', instructions: V.instructions, speed: CFG.speed },
    { endpoint: CFG.endpoint },
  );
  const raw = `${out}.raw`;
  writeFileSync(raw, res.body);
  const rate = Number(/rate=(\d+)/.exec(res.type)?.[1]) || 24000;
  const input = /pcm/.test(res.type) || !res.type ? ['-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', raw] : ['-i', raw];
  try {
    ff(
      ...input,
      '-af',
      'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,' +
        `apad=pad_dur=0.12,loudnorm=I=${CFG.loudness}:TP=-1.5`,
      '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-q:a', '5', out,
    );
  } finally {
    rmSync(raw, { force: true });
  }
}

// ---- check: transcribe and compare (as in education/scripts/video-voice.mjs)
const norm = (s) => s.toLowerCase().replace(/ё/g, 'е').replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function lev(x, y) {
  const dp = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (x[i - 1] === y[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return 1 - dp[y.length] / Math.max(x.length, y.length, 1);
}
const NUMERAL = /^(один|одна|два|две|три|четыр|пят|шест|сем|восем|девят|десят|двенадцат|сто|сорок|девяност|тысяч|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|hundred|thousand|ninety)/;
const near = (w, words) => words.some((g) => lev(w, g) >= 0.6);
async function verify(file, text, lang) {
  const res = await post('/audio/transcriptions', null, {
    form: { model: VERIFY.model, language: lang, file: { file } },
    endpoint: CFG.endpoint,
  });
  const transcript = JSON.parse(res.body.toString('utf8')).text?.trim() ?? '';
  const skip = new Set(VERIFY.skip ?? []); // interjections the recogniser leaves out
  const want = norm(text).split(' ').filter((w) => w.length > 1 && !NUMERAL.test(w) && !skip.has(w));
  const got = norm(transcript).split(' ').filter((w) => !/\d/.test(w));
  const score = Math.round((want.filter((w) => near(w, got)).length / Math.max(want.length, 1)) * 100) / 100;
  const tail = !want.length || near(want.at(-1), got.slice(-3));
  return { transcript, score, ok: score >= VERIFY.minScore && tail };
}

// ---- one language
async function voiceLang(lang, all) {
  const V = CFG.langs[lang];
  if (!V) throw new Error(`no voice settings for "${lang}" in voice.config.json (langs.${lang})`);
  const dir = join(WEB, 'audio', lang);
  mkdirSync(dir, { recursive: true });
  const rows = expand(all, lang);
  const manifest = {};
  const todo = [];
  for (const { id, text } of rows) {
    const hash = createHash('sha256').update(JSON.stringify([CFG.model, V.voice, V.instructions, CFG.speed, CFG.loudness, text])).digest('hex').slice(0, 12);
    const name = `${hash}.mp3`;
    manifest[id] = name;
    if (REDO && text.includes(REDO)) rmSync(join(dir, name), { force: true });
    if (!existsSync(join(dir, name)) && !todo.some((t) => t.name === name)) todo.push({ id, text, name });
  }
  console.log(`${lang}: ${rows.length} lines, to synthesise: ${todo.length}`);
  if (DRY) return todo.forEach((t) => console.log(`  ${t.id}: ${t.text}`));

  let done = 0;
  const work = async ({ id, text, name }) => {
    const file = join(dir, name);
    for (let attempt = 1; ; attempt++) {
      await tts(text, V, file);
      if (!VERIFY.enabled) break;
      const v = await verify(file, text, lang);
      if (v.ok) break;
      console.warn(`  ⚠ ${id}: heard "${v.transcript}" (match ${v.score})`);
      if (attempt >= VERIFY.retries) {
        console.warn(`  ⚠ ${id}: keeping the last attempt — please listen to it`);
        break;
      }
    }
    console.log(`  [${++done}/${todo.length}] ${id}`);
  };
  const queue = [...todo];
  const failed = [];
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      for (let t; (t = queue.shift()); ) {
        try {
          await work(t);
        } catch (e) {
          failed.push(t.id);
          rmSync(join(dir, t.name), { force: true });
          console.error(`  ✗ ${t.id}: ${e.message}`);
        }
      }
    }),
  );

  // manifest: only lines that have a file; unused files go
  const ready = Object.fromEntries(Object.entries(manifest).filter(([, f]) => existsSync(join(dir, f))).sort());
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(ready, null, 1) + '\n');
  const used = new Set(Object.values(ready));
  for (const f of readdirSync(dir)) if (f.endsWith('.mp3') && !used.has(f)) rmSync(join(dir, f));
  console.log(`${lang}: ready ${Object.keys(ready).length} of ${rows.length}${failed.length ? `, failed: ${failed.length} (run again)` : ''}`);
  if (failed.length) process.exitCode = 1;
}

if (!DRY && !process.env.OPENROUTER_API_KEY) {
  console.error('No OPENROUTER_API_KEY. Locally: export OPENROUTER_API_KEY=… or put the line\nOPENROUTER_API_KEY = … into local.mk at the project root (not in git).');
  process.exit(1);
}
const all = await loadAll();
for (const lang of LANGS.length ? LANGS : Object.keys(CFG.langs)) await voiceLang(lang, all);
