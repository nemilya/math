// Boot + screens: start (Lumo asleep) → sky → adventure → sky ...
//
// Dev URL params:  ?lang=en   force a language
//                  ?fast      no voice, everything 8× faster, subtitles on (for testing)
//                  ?reset     forget progress

import { I18n, LANGS, detectLang } from './i18n.js';
import { Voice } from './voice.js';
import { Scene } from './scene.js';
import { createKeeper } from './keeper.js';
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

// ---------- chrome ----------

$('btn-home').innerHTML = icons.home;
$('btn-cc').innerHTML = icons.cc;

const subtitlesOn = () => store.data.cc || needSubtitles || fast;
const refreshCC = () => {
  $('btn-cc').classList.toggle('on', subtitlesOn());
  subtitle.hidden = !(subtitlesOn() && voice.speaking && voice.current);
};

voice.on((speaking, text) => {
  keeper.setTalking(speaking);
  subtitle.textContent = text;
  refreshCC();
});

$('btn-cc').addEventListener('click', () => {
  store.set('cc', !store.data.cc);
  refreshCC();
});

$('btn-home').addEventListener('click', () => {
  sfx.tap();
  goSky();
});

$('btn-lang').addEventListener('click', () => {
  const box = $('langs');
  box.hidden = !box.hidden;
  if (box.hidden) return;
  box.innerHTML = '';
  for (const l of LANGS) {
    const b = document.createElement('button');
    b.textContent = l.name;
    b.className = l.id === i18n.lang ? 'on' : '';
    b.addEventListener('click', async () => {
      box.hidden = true;
      store.set('lang', l.id);
      await setLang(l.id);
      if (screen !== 'start') goSky();
    });
    box.appendChild(b);
  }
});

// Tap Lumo: hear the last thing again. (Nothing on screen needs reading — so
// "say it again" must always be one tap away.)
keeper.el.addEventListener('click', () => {
  if (screen === 'start') return;
  sfx.tap();
  if (voice.speaking) keeper.wiggle();
  else voice.repeat();
});

async function setLang(lang) {
  document.documentElement.lang = lang;
  $('btn-lang').textContent = lang.toUpperCase();
  i18n.lang = lang;
  await Promise.all([i18n.load('common'), i18n.load('sky'), voice.setLang(lang)]);
  needSubtitles = !voice.hasVoice();
  refreshCC();
}

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
  return new Scene({ ns, stage, dock, keeper, voice, i18n, store, speed, signal: ctl.signal });
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
    const [mod] = await Promise.all([star.load(), i18n.load(id)]);
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
  await setLang(params.get('lang') || store.data.lang || detectLang());
  const wake = async () => {
    if (screen !== 'start') return;
    screen = 'waking';
    sfx.unlock();
    sfx.wake();
    keeper.sleep(false);
    keeper.glow();
    // The very first speech must happen inside a user gesture on some browsers.
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
