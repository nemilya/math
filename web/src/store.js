// What the child has explored. Lives only in this browser.
// There are deliberately no scores, grades, streaks or timers here.

const KEY = 'lumo.v1';

const blank = () => ({
  lang: null,
  cc: false,
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
};
