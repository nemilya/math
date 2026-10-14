// Little synthesized sounds (no audio files needed).

let ctx = null;
let muted = false;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

function tone(freq, dur, { type = 'sine', gain = 0.12, when = 0, slide = 0 } = {}) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  unlock() {
    const c = ac();
    if (c && c.state === 'suspended') c.resume();
  },
  mute(on) {
    muted = on;
  },
  tap: () => tone(660, 0.08, { type: 'triangle', gain: 0.06 }),
  pop: () => tone(520, 0.12, { type: 'sine', gain: 0.1, slide: 1.6 }),
  pebble: () => tone(190, 0.09, { type: 'triangle', gain: 0.12, slide: 0.7 }),
  snip: () => tone(1400, 0.07, { type: 'square', gain: 0.03, slide: 0.5 }),
  chime() {
    [784, 988, 1319, 1568].forEach((f, i) => tone(f, 0.6, { when: i * 0.08, gain: 0.07 }));
  },
  wake() {
    [392, 523, 659].forEach((f, i) => tone(f, 0.35, { when: i * 0.12, gain: 0.08, type: 'triangle' }));
  },
};
