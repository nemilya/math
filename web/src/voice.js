// Lumo's voice. Three layers, best first:
//   1. a recorded / generated file: audio/<lang>/manifest.json maps line id → file (make voice)
//   2. the browser's own speech synthesis (Web Speech API)
//   3. silence + subtitles (no voice for this language on this device)
// Scripts never care which layer is used — they just await speak().

import { LANGS } from './i18n.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The shortest silent WAV: played inside the first tap, it unlocks <audio> for later playback
// on browsers (iOS Safari) that only let a gesture start sound.
const SILENCE = 'data:audio/wav;base64,UklGRiUAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAACA';

// How long a line waits for its clip still being fetched into memory before streaming it instead
// (only for a fetch that seems stuck: a second request would compete with the first).
const CLIP_WAIT = 8000;

// Below this (kbit/s, as measured on the clips) a pause before a line is likely and real —
// Lumo may show that he is thinking. Above it, a pause is rare and short: better none at all.
const SLOW_KBPS = 1500;

export class Voice {
  constructor({ speed = 1, silent = false } = {}) {
    this.silent = silent;
    this.synth = !silent && 'speechSynthesis' in window ? window.speechSynthesis : null;
    this.speed = speed;
    this.lang = 'ru';
    this.voice = null;
    this.manifest = {}; // line id → file, for manifestLang
    this.manifestLang = null;
    this.audio = new Audio();
    this.gen = 0;
    this.speaking = false; // a line is being said (from speak() until it ends)
    this.audible = false; // ...and its sound is actually playing now: the mouth moves only then
    this.current = '';
    this.last = null;
    this.lastEndAt = 0;
    this.rate = 0.95;
    this.pitch = 1.08;
    this.listeners = new Set();
    this._interrupt = null;
    this._idleWaiters = [];
    this._startWaiters = [];
    this.clips = new Map(); // clip url → Promise<blob: url | null>, clips held in memory (prepare)
    this._loading = new AbortController(); // fetches for the current language
    this._queue = []; // clips to fetch in the background (preload)
    this._workers = 0;
    this.kbps = 0; // measured download speed of the clips (0 — not measured yet)
    this._urgent = 0; // fetches someone is waiting for (prepare, a line streaming now)
    this._calmWaiters = [];
  }

  // Urgent fetches go first: background preloading starts nothing new while any is running
  // (also usable from outside — e.g. an adventure's code the child is about to need).
  urgent(p) {
    this._urgent++;
    const done = () => {
      if (--this._urgent) return;
      const w = this._calmWaiters;
      this._calmWaiters = [];
      w.forEach((r) => r());
    };
    p.then(done, done);
    return p;
  }

  _calm() {
    return this._urgent ? new Promise((r) => this._calmWaiters.push(r)) : Promise.resolve();
  }

  on(fn) {
    this.listeners.add(fn);
  }

  _emit() {
    for (const fn of this.listeners) fn(this.speaking, this.current, this.audible);
  }

  _setAudible(on) {
    if (this.audible === on) return;
    this.audible = on;
    this._emit();
    if (on) this._flushStart();
  }

  // Resolves when the current line is actually heard (or ends unheard) — a clip may still be loading.
  started() {
    if (this.audible || !this.speaking) return Promise.resolve();
    return new Promise((r) => this._startWaiters.push(r));
  }

  _flushStart() {
    const w = this._startWaiters;
    this._startWaiters = [];
    w.forEach((r) => r());
  }

  // Call inside the first tap: lets later lines play on browsers that demand a gesture,
  // even when the line itself starts a moment later (its clip still loading).
  unlock() {
    if (this.silent || this.speaking) return;
    this.audio.src = SILENCE;
    this.audio.play().catch(() => {});
  }

  async setLang(lang) {
    this.lang = lang;
    // Stop loading the old language's clips: on a slow first visit they'd delay the new ones.
    this._loading.abort();
    this._loading = new AbortController();
    this._queue = [];
    // Drop the old language's clips right away: until the new manifest arrives Lumo uses the
    // browser voice, never an old-language file (or a wrong folder).
    this.manifest = {};
    this.manifestLang = null;
    const [voice, manifest] = await Promise.all([
      this._pickVoice(lang),
      fetch(`audio/${lang}/manifest.json`, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({})), // no recorded audio for this language yet
    ]);
    if (this.lang !== lang) return; // another language was chosen meanwhile
    this.voice = voice;
    this.manifest = Array.isArray(manifest) ? {} : manifest;
    this.manifestLang = lang;
  }

  // Is there any real voice (recorded or synthesized) for the current language?
  hasVoice() {
    return !!this.voice || Object.keys(this.manifest).length > 0;
  }

  // Clip urls of the lines matching `keep(id)` — with `age`, only what a child of that age hears:
  // their own version of a line, or `middle` where the line has none for them (as i18n picks).
  _urls(keep, age) {
    const ids = Object.keys(this.manifest);
    const aged = (id) => id.match(/^([^~]+)~([a-z]+)/); // [, line, its age] for an age version
    const hasOwn = new Set(ids.map(aged).filter((m) => m?.[2] === age).map((m) => m[1]));
    const forAge = (id) => {
      const m = aged(id);
      return !age || !m || m[2] === age || (m[2] === 'middle' && !hasOwn.has(m[1]));
    };
    return ids.filter((id) => keep(id) && forAge(id)).map((id) => `audio/${this.manifestLang}/${this.manifest[id]}`);
  }

  // Fetch the very first lines into memory (all variants of each key), so they play the instant
  // they are needed. On a first visit the network is still busy, and a line that waits for its
  // file would start in silence.
  // In the order of `keys`, two at a time: on a slow line the first words aren't held back by
  // the later ones. Resolves when they are all here (or failed).
  prepare(keys, { age } = {}) {
    const urls = keys.flatMap((k) => this._urls((id) => id === k || id.startsWith(`${k}.`) || id.startsWith(`${k}~`), age));
    let i = 0;
    const lane = async () => {
      while (i < urls.length) await this._clip(urls[i++]);
    };
    return Promise.all([lane(), lane()]);
  }

  // A clip into memory (a blob: url). `urgent` — someone is waiting for it (background
  // preloading gives way); otherwise it is the background preloading itself.
  _clip(url, { urgent = true } = {}) {
    let p = this.clips.get(url);
    if (!p) {
      const t0 = performance.now();
      p = fetch(url, { signal: this._loading.signal })
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => b && (this._measure(b.size, performance.now() - t0), URL.createObjectURL(b)))
        .catch(() => null);
      p.then((u) => u || this.clips.delete(url)); // a failed or cancelled one may be tried again
      this.clips.set(url, p);
    }
    if (urgent) this.urgent(p);
    return p;
  }

  // The connection's speed, from the clips themselves (a smoothed average, kbit/s).
  _measure(bytes, ms) {
    if (bytes < 8000 || ms <= 0) return; // too small to tell anything but latency
    const kbps = (bytes * 8) / ms;
    this.kbps = this.kbps ? this.kbps * 0.7 + kbps * 0.3 : kbps;
  }

  // Is the connection slow enough for a pause to be expected (and worth showing)? Measured from
  // the clips; before any is measured — the browser's own estimate, where it gives one.
  slow() {
    if (this.kbps) return this.kbps < SLOW_KBPS;
    const c = navigator.connection;
    return !!c && (/2g|3g/.test(c.effectiveType || '') || (c.downlink > 0 && c.downlink * 1000 < SLOW_KBPS));
  }

  // Warm the browser cache with every clip of a namespace (for this age), so Lumo answers
  // without a pause. `order` — the keys in the order they are said (the lines file follows the
  // script): what comes next is fetched first, not what is first in the alphabet.
  // One queue, two at a time, behind anything urgent; the newest request goes first (an
  // adventure just opened needs its clips before the rest of the sky).
  preload(ns, { age, order = [] } = {}) {
    const rank = (id) => {
      const k = id.slice(ns.length + 1).replace(/~[a-z]+/, ''); // 'guess.half', 'hello2.1', 'left.10'
      const i = order.indexOf(k);
      return i >= 0 ? i : order.includes(k.replace(/\.\d+$/, '')) ? order.indexOf(k.replace(/\.\d+$/, '')) : order.length;
    };
    const ids = Object.keys(this.manifest).filter((id) => id.startsWith(`${ns}:`));
    ids.sort((a, b) => rank(a) - rank(b)); // stable: variants keep their order
    const want = new Set(this._urls((id) => id.startsWith(`${ns}:`), age));
    const files = [...new Set(ids.map((id) => `audio/${this.manifestLang}/${this.manifest[id]}`))].filter(
      (u) => want.has(u) && !this.clips.has(u),
    );
    const fresh = new Set(files);
    this._queue = [...files, ...this._queue.filter((u) => !fresh.has(u))];
    while (this._workers < 2) {
      this._workers++;
      this._work().finally(() => this._workers--);
    }
  }

  async _work() {
    while (this._queue.length) {
      await this._calm();
      const u = this._queue.shift();
      if (u && !this.clips.has(u)) await this._clip(u, { urgent: false });
    }
  }

  async _pickVoice(lang) {
    if (!this.synth) return null;
    let list = this.synth.getVoices();
    if (!list.length) {
      await new Promise((r) => {
        const t = setTimeout(r, 1500);
        this.synth.addEventListener('voiceschanged', () => (clearTimeout(t), r()), { once: true });
      });
      list = this.synth.getVoices();
    }
    const bcp = LANGS.find((l) => l.id === lang)?.bcp || lang;
    const score = (v) =>
      (v.lang.replace('_', '-') === bcp ? 2 : 0) +
      (/natural|neural|premium|enhanced|online/i.test(v.name) ? 4 : 0) +
      (/google/i.test(v.name) ? 2 : 0) +
      (v.localService ? 0 : 1);
    const ok = list.filter((v) => v.lang.toLowerCase().startsWith(lang));
    ok.sort((a, b) => score(b) - score(a));
    return ok[0] || null;
  }

  idle() {
    if (!this.speaking) return Promise.resolve();
    return new Promise((r) => this._idleWaiters.push(r));
  }

  stop() {
    this.gen++;
    const hadSpeech = this.speaking;
    if (this._interrupt) this._interrupt();
    this._interrupt = null;
    if (this.synth) this.synth.cancel();
    this.audio.pause();
    if (hadSpeech) this._finish();
  }

  _finish() {
    this.speaking = false;
    this.audible = false;
    this.current = '';
    this.lastEndAt = performance.now();
    this._emit();
    this._flushStart();
    const w = this._idleWaiters;
    this._idleWaiters = [];
    w.forEach((r) => r());
  }

  repeat() {
    if (this.last) return this.speak(this.last.text, { id: this.last.id });
    return Promise.resolve();
  }

  async speak(text, { id } = {}) {
    const wasSpeaking = this.speaking;
    this.stop();
    if (!text) return;
    const gen = this.gen;
    this.speaking = true;
    this.current = text;
    this.last = { text, id };
    this._emit();
    try {
      if (wasSpeaking && this.synth) await sleep(60); // Chrome drops speak() issued right after cancel()
      if (!this.silent && id && this.manifest[id] && (await this._file(this.manifest[id], gen))) return;
      if (gen !== this.gen) return;
      if (this.voice) await this._tts(text, gen);
      else await this._silent(text, gen);
    } finally {
      if (gen === this.gen) this._finish();
    }
  }

  _file(file, gen) {
    return new Promise((resolve) => {
      const a = this.audio;
      const url = `audio/${this.manifestLang}/${file}`;
      let over = false;
      const done = (ok) => {
        if (over) return;
        over = true;
        a.onended = a.onerror = a.onplaying = a.onwaiting = null;
        resolve(ok);
      };
      this._interrupt = () => done(true);
      // A clip being fetched into memory: wait for it (a second request would only compete with
      // it) — and it is urgent now, even if it began as background preloading.
      const clip = this.clips.get(url);
      if (clip) this.urgent(clip);
      Promise.race([clip, sleep(CLIP_WAIT)]).then((blob) => {
        if (over) return;
        a.onended = () => done(true);
        a.onerror = () => done(false);
        // The mouth follows the sound, not the call: still while the file is loading.
        a.onplaying = () => this._setAudible(true);
        a.onwaiting = () => this._setAudible(false);
        // A line streamed from the network is urgent too, until it starts (or ends).
        if (!blob) {
          this.urgent(
            new Promise((r) => {
              a.addEventListener('playing', r, { once: true });
              setTimeout(r, CLIP_WAIT);
            }),
          );
        }
        a.src = blob || url;
        a.playbackRate = 1;
        a.play().catch(() => done(gen !== this.gen));
      });
    });
  }

  async _tts(text, gen) {
    // Speak sentence by sentence: Chrome cuts long utterances, and short ones sound calmer.
    const parts = text.match(/[^.!?…]+[.!?…]*\s*/g) || [text];
    for (const part of parts) {
      if (gen !== this.gen) return;
      const s = part.trim();
      if (!s) continue;
      await new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(s);
        u.voice = this.voice;
        u.lang = this.voice.lang;
        u.rate = this.rate;
        u.pitch = this.pitch;
        // Watchdog: some engines forget to fire onend.
        const wd = setTimeout(resolve, 2500 + (s.length * 95) / this.rate);
        const end = () => (clearTimeout(wd), resolve());
        u.onend = end;
        u.onerror = end;
        this._interrupt = end;
        this._utterance = u; // keep a reference, or Chrome may garbage-collect it mid-speech
        this.synth.speak(u);
        this._setAudible(true);
      });
    }
  }

  _silent(text, gen) {
    this._setAudible(true); // subtitles only: the mouth moves while the words are on screen
    return new Promise((resolve) => {
      const t = setTimeout(resolve, (700 + text.length * 60) / this.speed);
      this._interrupt = () => (clearTimeout(t), resolve());
      if (gen !== this.gen) this._interrupt();
    });
  }
}
