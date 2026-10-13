// What the child has explored. Lives only in this browser.
// There are deliberately no scores, grades, streaks or timers here.

const KEY = 'lumo.v1';

const blank = () => ({
  lang: null,
  // settings for grown-ups
  age: 'middle', // 'small' 4–6, 'middle' 7–9, 'big' 10–12 — changes Lumo's words
  hints: true, // Lumo offers a hint (once) when the child is quiet for a while
  mic: true, // invite the child to explain out loud
  cc: false, // subtitles
  setupDone: false, // the first-launch screen (language, age, subtitles) has been shown
  greeted: false,
  lit: {}, // star id -> timestamp when first lit
  unlocked: {}, // question id -> true
  mem: {}, // small per-adventure memories ("your guess was...")
  mine: [], // the child's own questions: [{id, at: [x, y]}]
});

function load() {
  try {
    return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return blank();
  }
}

const data = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* private mode — progress just won't survive a reload */
  }
}

export const store = {
  data,
  save,
  set(k, v) {
    data[k] = v;
    save();
  },
  isLit: (id) => !!data.lit[id],
  light(id) {
    if (data.lit[id]) return false;
    data.lit[id] = Date.now();
    save();
    return true;
  },
  isUnlocked: (id) => !!data.unlocked[id],
  unlock(id) {
    data.unlocked[id] = true;
    save();
  },
  remember(k, v) {
    data.mem[k] = v;
    save();
  },
  recall: (k) => data.mem[k],
  addMine(star) {
    data.mine.push(star);
    save();
  },
  // Forget progress (stars, guesses, own questions) but keep the grown-ups' settings.
  resetProgress() {
    Object.assign(data, { greeted: false, lit: {}, unlocked: {}, mem: {}, mine: [] });
    save();
  },
};
