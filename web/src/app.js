// Boot + screens: start (Lumo asleep) → sky → adventure → sky ...
//
// Dev URL params:  ?lang=en   force a language
//                  ?fast      no voice, everything 8× faster, subtitles on (for testing)
//                  ?reset     forget progress

import { I18n, AGES, LANGS, pickLang } from './i18n.js';
import { Voice } from './voice.js';
import { Scene } from './scene.js';
import { createKeeper } from './keeper.js';
import { createSettings } from './settings.js';
import { runSetup } from './setup.js';
import { runSky } from './sky.js';
import { store } from './store.js';
import { sfx } from './sfx.js';
import { icons } from './ui.js';
import { el, rng } from './svg.js';
import { STARS } from '../content/stars.js';

const params = new URLSearchParams(location.search);
const reset = params.has('reset');
if (reset) {
  localStorage.removeItem('lumo.v1');
  indexedDB.deleteDatabase?.('lumo');
  location.replace(location.pathname);
}
const fast = params.has('fast');
const speed = fast ? 8 : 1;

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const dock = $('dock');
const subtitle = $('subtitle');
const keeper = createKeeper($('keeper'));
const i18n = new I18n();
const voice = new Voice({ speed, silent: fast });

let ctl = null;
let screen = 'start';
let needSubtitles = false;
let langReady = Promise.resolve();

// ---------- chrome ----------

$('btn-home').innerHTML = icons.home;
$('btn-settings').innerHTML = icons.gear;

const subtitlesOn = () => store.data.cc || needSubtitles || fast;
const refreshCC = () => {
  subtitle.hidden = !(subtitlesOn() && voice.audible && voice.current);
};

// Mouth and subtitles follow the sound itself: if a clip is still loading, Lumo waits quietly.
voice.on((speaking, text, audible) => {
  keeper.setTalking(audible);
  subtitle.textContent = text;
  refreshCC();
});


$('btn-home').addEventListener('click', () => {
  sfx.tap();
  goSky();
});

// Settings: age, hints, subtitles, microphone, the album of recordings.
const settings = createSettings({
  host: $('settings'),
  i18n,
  store,
  async onChange(what) {
    if (what === 'age') {
      i18n.age = store.data.age;
      preloadSky();
    }
    if (what === 'cc') refreshCC();
    if (what === 'reset' || (what === 'mic' && screen === 'sky')) goSky();
  },
});
$('btn-settings').addEventListener('click', () => {
  sfx.tap();
  settings.open();
});

// Tap Lumo: hear the last thing again. (Nothing on screen needs reading — so
// "say it again" must always be one tap away.)
keeper.el.addEventListener('click', () => {
  if (screen === 'start') return;
  sfx.tap();
  if (voice.speaking) keeper.wiggle();
  else voice.repeat();
});

// The language switcher (EN / RU in the top bar), as in nemilya/education: the choice is
// remembered and put into the address, so a shared link opens in the same language.
function drawLangs() {
  const box = $('langs');
  box.replaceChildren(
    ...LANGS.map((l) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.lang = l.id;
      b.title = l.name;
      b.textContent = l.id.toUpperCase();
      b.setAttribute('aria-pressed', String(l.id === i18n.lang));
      return b;
    }),
  );
}
async function chooseLang(l) {
  store.set('lang', l);
  const u = new URL(location.href);
  u.searchParams.set('lang', l);
  history.replaceState(null, '', u);
  await setLang(l);
}
$('langs').addEventListener('click', async (e) => {
  const l = e.target.closest('button')?.dataset.lang;
  if (!l || l === i18n.lang) return;
  sfx.tap();
  await chooseLang(l);
  if (screen !== 'start') goSky();
});

function setLang(lang) {
  document.documentElement.lang = lang;
  i18n.lang = lang;
  drawLangs();
  langReady = (async () => {
    await Promise.all([i18n.load('common'), i18n.load('sky'), voice.setLang(lang)]);
    needSubtitles = !voice.hasVoice();
    refreshCC();
    // The first words come first — a new visitor's tap on the sleeping Lumo must be answered
    // at once; only then the rest of the sky's and the common lines.
    prepareFirstWords().then(() => i18n.lang === lang && preloadSky());
  })();
  return langReady;
}

// What Lumo says right after waking: "I dozed off... hi!", the sky's greeting, and the names of
// the adventures — what a child tapping the first stars hears.
const prepareFirstWords = () =>
  voice.prepare(
    [
      'common:wake',
      ...(store.data.greeted ? ['sky:back'] : ['sky:hello1', 'sky:hello2', 'sky:hello3']),
      ...STARS.filter((st) => st.kind === 'adventure').map((st) => `sky:${st.id}.name`),
    ],
    { age: i18n.age },
  );

const preloadSky = () => {
  voice.preload('common', { age: i18n.age });
  voice.preload('sky', { age: i18n.age });
};

function drawBackground() {
  const bg = $('bg');
  const r = rng(7);
  for (let i = 0; i < 140; i++) {
    const c = el('circle', { cx: r() * 1000, cy: r() * 600, r: 0.6 + r() * 1.6 }, bg);
    c.style.opacity = 0.25 + r() * 0.6;
    if (r() < 0.35) {
      c.classList.add('tw');
      c.style.animationDelay = `${(r() * 4).toFixed(2)}s`;
    }
  }
}

// ---------- screens ----------

function newScene(ns) {
  ctl?.abort();
  voice.stop();
  ctl = new AbortController();
  return new Scene({ ns, stage, dock, keeper, voice, i18n, store, speed, signal: ctl.signal, helpButton: $('btn-help') });
}

const isAbort = (e) => e?.name === 'AbortError';

async function goSky(justLit = null) {
  screen = 'sky';
  $('btn-home').hidden = true;
  const s = newScene('sky');
  try {
    const id = await runSky(s, { stars: STARS, justLit });
    goAdventure(id);
  } catch (e) {
    if (!isAbort(e)) console.error(e);
  }
}

async function goAdventure(id) {
  screen = 'adventure';
  $('btn-home').hidden = false;
  const star = STARS.find((st) => st.id === id);
  const wasLit = store.isLit(id);
  const s = newScene(id);
  try {
    // Usually already started by a tap on its star: the code, the lines, the opening words.
    const ready = s.prepareAdventure(star);
    ready.words.then(() => s.signal.aborted || voice.preload(id, { age: i18n.age })); // the rest after them
    const [mod] = await ready.code;
    s.check();
    await mod.default(s);
    store.light(id);
    goSky(wasLit ? null : id);
  } catch (e) {
    if (isAbort(e)) return;
    console.error(e);
    goSky();
  }
}

function watchOrientation() {
  const box = $('rotate');
  const q = matchMedia('(orientation: portrait) and (max-width: 820px)');
  let dismissed = false;
  const update = () => (box.hidden = dismissed || !q.matches);
  box.addEventListener('click', () => ((dismissed = true), update()));
  q.addEventListener?.('change', update);
  update();
}

async function start() {
  drawBackground();
  watchOrientation();
  i18n.age = AGES.includes(store.data.age) ? store.data.age : 'middle';
  await setLang(pickLang(params.get('lang'), store.data.lang));

  // The very first launch: pick language, age and subtitles (all preselected).
  if (!store.data.setupDone && !fast) {
    screen = 'setup';
    await runSetup({ host: $('setup'), i18n, store, onLang: chooseLang });
    i18n.age = store.data.age;
    refreshCC();
    // The language and the age may have just been chosen there (nothing to fetch if preselected).
    langReady.then(prepareFirstWords);
    screen = 'start';
  }
  const wake = async () => {
    if (screen !== 'start') return;
    screen = 'waking';
    sfx.unlock();
    voice.unlock();
    sfx.wake();
    keeper.sleep(false);
    keeper.glow();
    // The very first speech must happen inside a user gesture on some browsers — voice.unlock()
    // above lets it start a moment later, once the chosen language's voice is here.
    await langReady;
    const line = i18n.line('common:wake');
    const hello = voice.speak(line.text, { id: line.id });
    keeper.dock(true);
    await hello;
    goSky();
  };
  keeper.el.addEventListener('click', wake);
  stage.addEventListener('click', wake);
}

if (!reset) start();
