// Scene: the small vocabulary every adventure is written in.
//
//   await s.say('hello')                      — Lumo speaks a line (in the child's language)
//   const id = await s.choose([...])          — picture buttons, no words
//   s.drag(handle, { move })                  — let the child move something
//   await s.until(() => cond, { hints })      — wait for a discovery; Lumo gently nudges if idle
//   await s.record('star-id')                 — the child explains in their own voice
//
// Every await is cancellable: when the child presses "home", the whole script
// stops cleanly (an AbortError unwinds it).

import { el, set, ease as easings } from './svg.js';
import { icons } from './ui.js';
import { sfx } from './sfx.js';
import { mic, voices, playBlob } from './recorder.js';

const abortError = () => new DOMException('scene closed', 'AbortError');

// Once the microphone turned out to be unavailable, don't keep offering it this session.
let micUnavailable = false;

export class Scene {
  constructor({ ns, stage, dock, keeper, voice, i18n, store, signal, speed = 1 }) {
    Object.assign(this, { ns, stage, dock, keeper, voice, i18n, store, signal, speed });
    this.root = el('g', { class: `scene scene-${ns}` }, stage);
    this.lastActivity = performance.now();
    this.cleanups = [];
    this._talkGen = 0;
    this._hintsSaid = new Set();
    this._act = () => (this.lastActivity = performance.now());
    stage.addEventListener('pointerdown', this._act);
    dock.addEventListener('pointerdown', this._act);
    signal.addEventListener('abort', () => this.dispose(), { once: true });
  }

  dispose() {
    this.stage.removeEventListener('pointerdown', this._act);
    this.dock.removeEventListener('pointerdown', this._act);
    for (const c of this.cleanups.splice(0)) c();
    this.root.remove();
    this.dock.innerHTML = '';
    this.keeper.mood(null);
  }

  check() {
    if (this.signal.aborted) throw abortError();
  }

  // A promise that rejects with AbortError when the scene closes, and runs cleanups either way.
  guard(fn) {
    return new Promise((resolve, reject) => {
      if (this.signal.aborted) return reject(abortError());
      const cleanups = [];
      const finish = () => {
        cleanups.forEach((c) => c());
        this.signal.removeEventListener('abort', onAbort);
      };
      const onAbort = () => (finish(), reject(abortError()));
      this.signal.addEventListener('abort', onAbort);
      fn(
        (v) => (finish(), resolve(v)),
        (e) => (finish(), reject(e)),
        (c) => cleanups.push(c),
      );
    });
  }

  // ---------- voice ----------

  key(k) {
    return k.includes(':') ? k : `${this.ns}:${k}`;
  }

  // The child's age band: 'small' (4–6), 'middle' (7–9) or 'big' (10–12).
  get age() {
    return this.i18n.age;
  }

  async say(k, { polite = false } = {}) {
    this.check();
    const line = this.i18n.line(this.key(k));
    if (!line.text) return; // e.g. a line that exists only for older children
    if (polite) await this.guard((res) => this.voice.idle().then(res));
    await this.voice.speak(line.text, { id: line.id });
    this.check();
  }

  // Fire-and-forget speech that a later talk() or tap can interrupt.
  talk(keys) {
    const gen = ++this._talkGen;
    (async () => {
      for (const k of [].concat(keys)) {
        if (gen !== this._talkGen) return;
        await this.say(k);
      }
    })().catch(() => {});
  }

  hush() {
    this._talkGen++;
    this.voice.stop();
  }

  // ---------- time ----------

  wait(ms) {
    return this.guard((resolve, _r, onClean) => {
      const id = setTimeout(resolve, ms / this.speed);
      onClean(() => clearTimeout(id));
    });
  }

  tween(ms, fn, ease = easings.inOut) {
    const dur = ms / this.speed;
    return this.guard((resolve, _r, onClean) => {
      const t0 = performance.now();
      let raf = 0;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        fn(ease(k));
        if (k < 1) raf = requestAnimationFrame(step);
        else resolve();
      };
      raf = requestAnimationFrame(step);
      onClean(() => cancelAnimationFrame(raf));
    });
  }

  // ---------- drawing ----------

  layer(parent = this.root) {
    return el('g', {}, parent);
  }

  el(tag, attrs = {}, parent = this.root) {
    return el(tag, attrs, parent);
  }

  set(e, attrs) {
    return set(e, attrs);
  }

  // Draw a line/shape as if by hand.
  async draw(e, ms = 1000) {
    const len = e.getTotalLength ? e.getTotalLength() : 1000;
    e.style.strokeDasharray = `${len} ${len}`;
    e.style.strokeDashoffset = len;
    try {
      await this.tween(ms, (k) => (e.style.strokeDashoffset = len * (1 - k)));
    } finally {
      e.style.strokeDasharray = '';
      e.style.strokeDashoffset = '';
    }
  }

  animate(e, prop, from, to, ms = 500) {
    return this.tween(ms, (k) => (e.style[prop] = from + (to - from) * k));
  }

  fadeIn(e, ms = 500) {
    return this.animate(e, 'opacity', 0, 1, ms);
  }

  fadeOut(e, ms = 500) {
    return this.animate(e, 'opacity', 1, 0, ms);
  }

  // A glowing draggable point.
  handle(parent = this.root, { r = 15 } = {}) {
    const g = el('g', { class: 'handle' }, parent);
    el('circle', { r: 42, class: 'hit' }, g);
    el('circle', { r: r + 10, class: 'ring' }, g);
    el('circle', { r, class: 'dot' }, g);
    g.moveTo = (x, y) => g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    g.show = (on) => (g.style.display = on ? '' : 'none');
    return g;
  }

  sparkle(x, y, n = 10) {
    const g = el('g', {}, this.root);
    const parts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      return { a, d: 60 + Math.random() * 50, e: el('circle', { r: 4 + Math.random() * 3, class: 'sparkle' }, g) };
    });
    this.tween(900, (k) => {
      for (const p of parts) {
        set(p.e, { cx: x + Math.cos(p.a) * p.d * k, cy: y + Math.sin(p.a) * p.d * k });
        p.e.style.opacity = 1 - k;
      }
    }, easings.out)
      .catch(() => {})
      .finally(() => g.remove());
  }

  celebrate(x, y) {
    this.keeper.glow();
    sfx.chime();
    if (x != null) this.sparkle(x, y);
  }

  mood(m) {
    this.keeper.mood(m);
  }

  // ---------- input ----------

  point(ev) {
    const p = this.stage.createSVGPoint();
    p.x = ev.clientX;
    p.y = ev.clientY;
    return p.matrixTransform(this.stage.getScreenCTM().inverse());
  }

  // Wait for a tap on one of the targets: an element, an array, or a Map(element -> value).
  tap(targets, { hints } = {}) {
    const list =
      targets instanceof Map ? [...targets] : [].concat(targets).map((e) => [e, e]);
    const p = this.guard((resolve, _r, onClean) => {
      for (const [e, v] of list) {
        const h = (ev) => {
          ev.stopPropagation();
          this._act();
          sfx.tap();
          resolve(v);
        };
        e.classList.add('tappable');
        e.addEventListener('click', h);
        onClean(() => {
          e.removeEventListener('click', h);
          e.classList.remove('tappable');
        });
      }
    });
    return this.withHints(p, hints);
  }

  // Wait for a tap on an area and return where (in stage coordinates).
  tapPoint(area, { hints } = {}) {
    const p = this.guard((resolve, _r, onClean) => {
      const h = (ev) => {
        this._act();
        resolve(this.point(ev));
      };
      area.addEventListener('click', h);
      onClean(() => area.removeEventListener('click', h));
    });
    return this.withHints(p, hints);
  }

  drag(handle, { move, start, end } = {}) {
    const ctl = { active: false, stop: null };
    let id = null;
    const down = (ev) => {
      ev.preventDefault();
      id = ev.pointerId;
      ctl.active = true;
      handle.setPointerCapture?.(id);
      this._act();
      start?.(this.point(ev));
      move?.(this.point(ev));
    };
    const mv = (ev) => {
      if (ev.pointerId !== id) return;
      this._act();
      move?.(this.point(ev));
    };
    const up = (ev) => {
      if (ev.pointerId !== id) return;
      id = null;
      ctl.active = false;
      end?.();
    };
    handle.classList.add('draggable');
    handle.addEventListener('pointerdown', down);
    handle.addEventListener('pointermove', mv);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
    ctl.stop = () => {
      handle.classList.remove('draggable');
      handle.removeEventListener('pointerdown', down);
      handle.removeEventListener('pointermove', mv);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      ctl.active = false;
    };
    this.cleanups.push(ctl.stop);
    return ctl;
  }

  until(pred, { hints } = {}) {
    const p = this.guard((resolve, _r, onClean) => {
      const id = setInterval(() => pred() && resolve(), 80);
      onClean(() => clearInterval(id));
    });
    return this.withHints(p, hints);
  }

  // If the child is quiet for a while, Lumo offers the next hint (never the answer first).
  // Each hint is said at most once per scene — then Lumo waits patiently. (Tapping Lumo
  // repeats the last line.) Parents can switch idle hints off altogether.
  withHints(p, hints, { first = 12000, every = 22000 } = {}) {
    const fresh = (hints || []).map((k) => this.key(k)).filter((k) => !this._hintsSaid.has(k));
    if (!fresh.length || this.store.data.hints === false) return p;
    let i = 0;
    this._act();
    const id = setInterval(() => {
      if (this.signal.aborted || this.voice.speaking) return;
      if (document.body.classList.contains('settings-open')) return this._act();
      const idle = (performance.now() - Math.max(this.lastActivity, this.voice.lastEndAt)) * this.speed;
      if (idle < (i === 0 ? first : every)) return;
      const k = fresh[i++];
      if (!this._hintsSaid.has(k)) {
        this._hintsSaid.add(k);
        this.say(k).catch(() => {});
      }
      if (i >= fresh.length) clearInterval(id);
    }, 400);
    return p.finally(() => clearInterval(id));
  }

  // ---------- dock (picture buttons at the bottom) ----------

  buttons(opts) {
    this.dock.innerHTML = '';
    const map = new Map();
    for (const o of opts) {
      const b = document.createElement('button');
      b.className = `btn ${o.cls || ''}`.trim();
      b.innerHTML = icons[o.icon] || o.svg || '';
      b.setAttribute('aria-label', o.id);
      this.dock.appendChild(b);
      map.set(b, o.id);
    }
    return map;
  }

  clearDock() {
    this.dock.innerHTML = '';
  }

  async choose(opts, { hints } = {}) {
    const map = this.buttons(opts);
    try {
      return await this.tap(map, { hints });
    } finally {
      for (const b of map.keys()) b.remove();
    }
  }

  // ---------- the child's voice ----------

  async play(blob) {
    this.check();
    this.mood('listening');
    try {
      await playBlob(blob, this.signal);
    } finally {
      this.mood(null);
    }
    this.check();
  }

  async listen(starId) {
    for (const r of await voices.list(starId)) await this.play(r.blob);
  }

  // Can the child record their voice here? (Parents may turn it off; some browsers can't.)
  micAvailable() {
    return this.store.data.mic !== false && !micUnavailable && mic.supported();
  }

  // Invite the child to explain something out loud. Nothing is analysed or sent anywhere:
  // the child hears their own explanation back, and it is kept on this device next to the
  // star — grown-ups can listen to it in the album (settings). Returns the recording or null.
  async record(starId, { prompt = 'common:record.prompt' } = {}) {
    if (this.store.data.mic === false || micUnavailable) return null;
    if (!mic.supported()) {
      micUnavailable = true;
      await this.say('common:record.nomic');
      return null;
    }
    if (prompt) await this.say(prompt);
    let saved = null;
    for (;;) {
      const opts = [{ id: 'mic', icon: 'mic', cls: 'big rec' }];
      if (saved) opts.push({ id: 'play', icon: 'listen' });
      opts.push(saved ? { id: 'done', icon: 'check', cls: 'go' } : { id: 'skip', icon: 'next' });
      const act = await this.choose(opts, { hints: saved ? [] : ['common:record.hint'] });
      if (act === 'skip' || act === 'done') return saved;
      if (act === 'play') {
        await this.play(saved.blob);
        continue;
      }
      try {
        this.hush();
        await mic.start();
      } catch {
        micUnavailable = true;
        await this.say('common:record.denied');
        return saved;
      }
      this.cleanups.push(() => mic.cancel());
      this.mood('listening');
      const stopped = this.choose([{ id: 'stop', icon: 'stop', cls: 'big recording' }]);
      const timeout = this.wait(120000);
      stopped.catch(() => {});
      timeout.catch(() => {});
      await Promise.race([stopped, timeout]);
      this.mood(null);
      this.clearDock();
      const blob = await mic.stop();
      if (blob && blob.size > 0) {
        saved = await voices.save(starId, blob);
        this.celebrate();
        await this.say('common:record.saved');
        await this.play(blob); // the child hears their own explanation — that is the point
        await this.say('common:record.after');
      }
    }
  }

  // ---------- progress ----------

  complete() {
    this.store.light(this.ns);
  }

  unlock(id) {
    this.store.unlock(id);
  }

  remember(k, v) {
    this.store.remember(`${this.ns}.${k}`, v);
  }

  recall(k) {
    return this.store.recall(`${this.ns}.${k}`);
  }
}
