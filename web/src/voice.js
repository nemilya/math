// Lumo's voice. Three layers, best first:
//   1. a recorded / pre-generated file  audio/<lang>/<ns>/<key>.mp3 (listed in audio/<lang>/manifest.json)
//   2. the browser's own speech synthesis (Web Speech API)
//   3. silence + subtitles (no voice for this language on this device)
// Scripts never care which layer is used — they just await speak().

import { LANGS } from './i18n.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Voice {
  constructor({ speed = 1, silent = false } = {}) {
    this.synth = !silent && 'speechSynthesis' in window ? window.speechSynthesis : null;
    this.speed = speed;
    this.lang = 'ru';
    this.voice = null;
    this.manifest = new Set();
    this.audio = new Audio();
    this.gen = 0;
    this.speaking = false;
    this.current = '';
    this.last = null;
    this.lastEndAt = 0;
    this.rate = 0.95;
    this.pitch = 1.08;
    this.listeners = new Set();
    this._interrupt = null;
    this._idleWaiters = [];
  }

  on(fn) {
    this.listeners.add(fn);
  }

  _emit() {
    for (const fn of this.listeners) fn(this.speaking, this.current);
  }

  async setLang(lang) {
    this.lang = lang;
    this.voice = await this._pickVoice(lang);
    this.manifest = new Set();
    try {
      const r = await fetch(`audio/${lang}/manifest.json`, { cache: 'no-cache' });
      if (r.ok) this.manifest = new Set(await r.json());
    } catch {
      /* no recorded audio for this language yet */
    }
  }

  // Is there any real voice (recorded or synthesized) for the current language?
  hasVoice() {
    return !!this.voice || this.manifest.size > 0;
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
    this.current = '';
    this.lastEndAt = performance.now();
    this._emit();
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
      if (id && this.manifest.has(id) && (await this._file(id, gen))) return;
      if (gen !== this.gen) return;
      if (this.voice) await this._tts(text, gen);
      else await this._silent(text, gen);
    } finally {
      if (gen === this.gen) this._finish();
    }
  }

  _file(id, gen) {
    const [ns, key] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)];
    return new Promise((resolve) => {
      const a = this.audio;
      const done = (ok) => {
        a.onended = a.onerror = null;
        resolve(ok);
      };
      this._interrupt = () => done(true);
      a.onended = () => done(true);
      a.onerror = () => done(false);
      a.src = `audio/${this.lang}/${ns}/${key}.mp3`;
      a.playbackRate = 1;
      a.play().catch(() => done(gen !== this.gen));
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
      });
    }
  }

  _silent(text, gen) {
    return new Promise((resolve) => {
      const t = setTimeout(resolve, (700 + text.length * 60) / this.speed);
      this._interrupt = () => (clearTimeout(t), resolve());
      if (gen !== this.gen) this._interrupt();
    });
  }
}
