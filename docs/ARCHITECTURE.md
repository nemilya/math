# How it works

*Русская версия: [ru/ARCHITECTURE.md](ru/ARCHITECTURE.md)*

The portal is a static website with no build step and no runtime dependencies: plain HTML +
CSS + JavaScript modules + SVG. It runs from any static host (any subfolder) on any device
with a browser.

```
web/
  index.html            the stage (SVG 1000×600), button dock, Lumo, top bar
  style.css             all the visual style
  src/                  the engine (shared by all adventures)
    app.js              start-up and screens: start → sky → adventure → sky; language switcher
    scene.js            the "scene language" every adventure is written in
    sky.js              the sky of questions (home screen)
    keeper.js           Lumo: the SVG character and his states
    voice.js            voice: generated files → browser speech → silence + subtitles
    i18n.js             languages, age versions of lines
    settings.js         the grown-ups' panel (gear): age, hints, subtitles, microphone, album
    recorder.js         the child's voice: recording and storage (on this device only)
    store.js            what the child explored + settings (localStorage)
    sfx.js              little sounds synthesised on the fly (WebAudio)
    svg.js, ui.js       small helpers: geometry, icons
  content/              everything that grows
    stars.js            the sky map: which stars are where and what appears after what
    common/             shared lines (waking up, recording)
    sky/                sky lines + names and questions of every star
    <adventure>/
      script.js         the script
      lines.en.js       lines in English (the main language)
      lines.ru.js       lines in Russian
  audio/<lang>/         Lumo's voice: <hash>.mp3 + manifest.json (line id → file)
tools/
  serve.mjs             local server
  lines.mjs             check / export lines
  voice.mjs             voice all lines (Gemini TTS via OpenRouter)
  dist.mjs              build the hosting folder
  lib/                  shared by tools: lines, OpenRouter client
voice.config.json       Lumo's voice: model, voice, manner per language
Makefile                make serve | check | voice | dist
```

## The key idea: engine apart from content

The **engine** (`src/`) rarely changes. The **content** (`content/`) grows without limit:
a new adventure is a new folder plus one line in `stars.js`. A new language is new
`lines.<lang>.js` files; scripts stay untouched.

## The scene language

An adventure is an async function that reads like a play script:

```js
export default async function (s) {
  const box = s.el('rect', { x: 200, y: 110, width: 600, height: 360, class: 'line' });
  await s.say('look');                       // Lumo speaks (in the child's language and age)
  await s.draw(box, 1100);                   // the line is drawn with light
  const guess = await s.choose([...]);       // picture buttons
  const d = s.drag(handle, { move: (p) => { ... } });   // the child moves something
  await s.until(() => travel > 500, { hints: ['drag.hint1', 'drag.hint2'] });
  s.celebrate(x, y);                         // Lumo flashes + sparkles + chime
  s.unlock('pyramid-in-cube');               // hang a new question in the sky
  await s.record('triangle-in-box');         // the child explains in their own voice
}
```

Key properties:

* **Hints on silence, once each.** `until`, `tap` and `choose` take `hints`. If the child does
  nothing for ~12 seconds (and Lumo is quiet), the first hint plays; later the next one. Each
  hint key is said **at most once per scene**, after that Lumo waits. Grown-ups can switch
  idle hints off. Tapping Lumo always repeats the last line.
* **Everything is cancellable.** Press "home" — the script stops at any point (`AbortError`);
  all listeners and animations are removed.
* **Stage coordinates** are always 1000×600 on any screen; the stage scales itself.
* **Age.** `s.age` is `'small' | 'middle' | 'big'` — for the rare case where the *behaviour*
  should differ (e.g. shorter pebble games for little ones). Words differ through lines.

Full list — at the top of [`web/src/scene.js`](../web/src/scene.js) and in [AUTHORING.md](AUTHORING.md).

## Lines, languages and ages

* Lines: `content/<ns>/lines.<lang>.js` — an object `key → value`, where the value is
  * `'text'` — the same for everyone;
  * `['a', 'b']` — variants, Lumo picks one;
  * `{ small, middle, big }` — versions per age band. A missing band falls back to `middle`;
    a line with no `middle` and no version for this age is simply not said
    (e.g. `formula: { big: '...' }` — only older children hear where the formula comes from).
* **English is the main language.** `make check` verifies that every language has every line
  of the English files, with the same age versions, and that scripts use only existing lines.
* If a line is missing in the child's language, English is used, then Russian (with a warning).
* **Language** — as in `nemilya/education`: `?lang=` → the last choice → the browser language →
  English. The switcher (EN / RU) is in the top bar; the choice is remembered and written into
  the address, so a shared link opens in the same language.
* A new language: add it to `LANGS` in `src/i18n.js`, add `lines.<lang>.js` files, a voice in
  `voice.config.json`, then `make voice`.

## Voice

Three layers; the best available is used automatically:

1. **Generated files** `web/audio/<lang>/<hash>.mp3`, listed in `manifest.json` (line id → file).
   This is the normal case: every line, in every language and age band, is voiced in advance.
2. **The browser's speech synthesis** (Web Speech API) — a fallback for lines that have no
   file yet (e.g. while writing a new adventure). Quality depends on the device.
3. **Silence + subtitles** — if there is no voice at all, subtitles switch on by themselves.

Voice ids: `ns:key`, variants `ns:key.1`, age versions `ns:key~big`, `ns:key~big.1`.

Generating the voice (same approach as `nemilya/infographics` and `nemilya/education`):

```bash
make voice                 # or: node tools/voice.mjs [en ru] [--redo "text"] [--dry]
```

* Gemini TTS through OpenRouter (`/audio/speech`), voice and character brief — `voice.config.json`.
* The key: `OPENROUTER_API_KEY` in the environment or `OPENROUTER_API_KEY = …` in `local.mk`
  (not in git); proxy — `OPENROUTER_PROXY`.
* File name = hash of (model, voice, manner, text): only new or changed lines are
  synthesised, unused files are deleted. Change the voice or the manner — everything is redone.
* Every new clip is transcribed back (`/audio/transcriptions`) and compared with the text;
  lost words → synthesised again (up to 3 attempts).
* ffmpeg trims silence, normalises loudness and encodes mono MP3 (~40–60 KB per line).
* The adventure's clips are preloaded when it starts, so Lumo answers without a pause.

## The child's voice (microphone)

At the end of an adventure Lumo invites the child to explain the idea out loud. The recording
is played back to the child immediately and kept **only in this browser** (IndexedDB) next to
the star. Nothing is analysed or sent anywhere. The feedback is human: grown-ups listen in the
**discovery album** (settings) and talk with the child. If the browser has no microphone (or
the page is embedded somewhere that blocks it), Lumo says once "tell it to someone nearby" and
stops offering. Grown-ups can turn the invitation off.

Understanding the child's explanation (speech recognition + a reply from Lumo) is on the
roadmap: it needs a server and explicit parental consent.

## Data and privacy

* Progress (lit stars, guesses, own questions) and settings — `localStorage`.
* The child's voice — IndexedDB in the same browser. **Never uploaded.**
* No analytics, no external requests, no accounts.

## Hosting

```bash
make dist                  # → dist/ and dist.zip
```

Upload the contents of `dist/` to any subfolder of a static host: all paths are relative,
no server code or database. `.js` must be served as JavaScript and `.mp3` as audio (the
default for nginx and Apache).

## Dev modes

| URL | What it does |
|---|---|
| `?lang=en` | force a language |
| `?fast` | no voice, everything 8× faster, subtitles on — for automated tests |
| `?reset` | forget progress and recordings |

## Why this way (not React / Unity / video)

* **No build step** — any author can open a file, change a line and reload the page.
  The barrier for a teacher-author is as low as it gets.
* **SVG + code instead of video** — scenes scale to any screen, weigh kilobytes, are
  translated by swapping a lines file, and stay interactive. "Videos" in the project can be
  made with the same engine: an animated scene with Lumo's voice *is* a cartoon that exists in
  every language at once.
* **ES modules** work in every modern browser, including tablets — children's main device.

When the project grows, the engine can move to TypeScript with a build step — the script and
lines formats won't change.
