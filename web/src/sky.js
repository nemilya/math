// The sky of questions: the home screen. Resolves with the id of the adventure the child picks.

import { starPath } from './svg.js';
import { voices } from './recorder.js';
import { sfx } from './sfx.js';

const isVisible = (st, store) =>
  (st.kind === 'adventure' && !st.from) || st.far || store.isLit(st.from) || store.isUnlocked(st.id);

export async function runSky(s, { stars, justLit }) {
  const { store } = s;
  const g = s.layer();
  const nebulae = s.el('g', {}, g);
  const links = s.el('g', { class: 'constellation' }, g);
  const starsG = s.el('g', {}, g);
  const byId = Object.fromEntries(stars.map((st) => [st.id, st]));
  const nodes = new Map(); // id -> { g, star }

  const fresh = justLit ? stars.filter((st) => st.from === justLit && !st.far) : [];

  const draw = (st) => {
    const [x, y] = st.at;
    const cls =
      st.kind === 'mine'
        ? 'mine'
        : st.kind === 'adventure'
          ? store.isLit(st.id) && st.id !== justLit ? 'lit' : 'fresh'
          : `question${st.far ? ' far' : ''}`;
    const big = st.kind === 'adventure';
    const n = s.el('g', { class: `star ${cls}`, transform: `translate(${x} ${y})` }, starsG);
    s.el('circle', { r: big ? 48 : 30, class: 'halo' }, n);
    s.el('circle', { r: big ? 38 : 25, class: 'select-ring' }, n);
    const body = big
      ? starPath(0, 0, 25, 10.5)
      : st.kind === 'mine'
        ? starPath(0, 0, 14, 6, 6)
        : starPath(0, 0, st.far ? 11 : 16, st.far ? 4 : 5, 4);
    s.el('path', { d: body, class: 'body' }, n);
    s.el('circle', { r: 44, class: 'hit' }, n);
    nodes.set(st.id, { g: n, star: st });
    voices.list(st.id).then((r) => r.length && n.classList.add('has-ideas'));
    return n;
  };

  for (const st of stars.filter((x) => x.far)) {
    s.el('circle', { cx: st.at[0], cy: st.at[1], r: 95, fill: 'url(#nebula)' }, nebulae);
  }
  for (const st of stars) {
    if (!isVisible(st, store) || !st.from) continue;
    const a = byId[st.from].at;
    const line = s.el('line', { x1: a[0], y1: a[1], x2: st.at[0], y2: st.at[1] }, links);
    if (fresh.includes(st)) line.style.opacity = 0;
  }
  for (const st of stars) if (isVisible(st, store)) draw(st);
  for (const m of store.data.mine) draw({ ...m, kind: 'mine' });

  // "Ask your own question" — the child's questions become stars too (needs the microphone).
  const canRecord = s.micAvailable();
  const plus = s.el('g', { class: 'plus', transform: 'translate(62 62)' }, g);
  s.el('circle', { r: 32, class: 'ring' }, plus);
  s.el('path', { d: starPath(0, 0, 20, 5, 4), class: 'body' }, plus);
  s.el('circle', { r: 44, fill: 'transparent' }, plus);
  plus.style.display = canRecord ? '' : 'none';

  // ----- greeting -----
  if (justLit) {
    for (const st of fresh) nodes.get(st.id).g.style.opacity = 0;
    await s.wait(500);
    const lit = nodes.get(justLit);
    lit.g.classList.replace('fresh', 'lit');
    s.celebrate(...byId[justLit].at);
    await s.say('lit');
    if (fresh.length) {
      for (const line of links.children) line.style.opacity = '';
      for (const st of fresh) {
        sfx.pop();
        await s.fadeIn(nodes.get(st.id).g, 450);
      }
      s.talk('lit.new');
    }
  } else if (!store.data.greeted) {
    store.set('greeted', true);
    s.talk(['hello1', 'hello2', 'hello3']);
  } else {
    s.talk('back');
  }

  // ----- the main loop: tap a star, hear its question, act -----
  let sel = null;
  const select = (id) => {
    for (const n of nodes.values()) n.g.classList.remove('selected');
    sel = id ? nodes.get(id) : null;
    sel?.g.classList.add('selected');
  };
  const say = (st) =>
    st.kind === 'adventure'
      ? [`${st.id}.name`]
      : [`${st.id}.ask`, st.far ? 'far.note' : s.micAvailable() ? 'question.invite' : 'question.think'];

  for (;;) {
    const targets = new Map();
    for (const [id, n] of nodes) targets.set(n.g, { type: 'star', id });
    if (canRecord) targets.set(plus, { type: 'plus' });

    const acts = [];
    if (sel) {
      const hasIdeas = sel.g.classList.contains('has-ideas');
      if (sel.star.kind === 'adventure') acts.push({ id: 'play', icon: 'play', cls: 'big go' });
      else if (sel.star.kind === 'question' && s.micAvailable()) acts.push({ id: 'mic', icon: 'mic', cls: 'big rec' });
      if (hasIdeas) acts.push({ id: 'listen', icon: 'listen' });
    }
    for (const [b, id] of s.buttons(acts)) targets.set(b, { type: 'act', id });

    const hint = sel?.star.kind === 'adventure' ? 'play.hint' : sel ? 'idea.hint' : 'hint';
    const hit = await s.tap(targets, { hints: [hint] });

    if (hit.type === 'star') {
      select(hit.id);
      sfx.pop();
      const st = nodes.get(hit.id).star;
      // It starts loading now, while Lumo says its name and the child finds "play".
      if (st.kind === 'adventure') s.prepareAdventure(st);
      if (st.kind === 'mine') {
        s.clearDock();
        s.hush();
        await s.say('mine.play');
        await s.listen(st.id);
      } else {
        s.talk(say(st));
      }
      continue;
    }

    s.clearDock();
    s.hush();

    if (hit.type === 'plus') {
      select(null);
      const id = `mine-${Date.now()}`;
      await s.say('mine.prompt');
      if (await s.record(id, { prompt: null })) {
        const star = { id, kind: 'mine', at: freeSpot([...nodes.values()].map((n) => n.star.at)) };
        store.addMine({ id, at: star.at });
        const n = draw(star);
        n.classList.add('has-ideas');
        s.sparkle(...star.at);
        await s.fadeIn(n, 600);
        await s.say('mine.added');
      }
      continue;
    }

    if (hit.id === 'play') return sel.star.id;
    if (hit.id === 'listen') await s.listen(sel.star.id);
    if (hit.id === 'mic' && (await s.record(sel.star.id, { prompt: 'idea.prompt' }))) {
      sel.g.classList.add('has-ideas');
    }
  }
}

function freeSpot(taken) {
  for (let i = 0; i < 200; i++) {
    const at = [130 + Math.random() * 760, 70 + Math.random() * 440];
    const blocked =
      (at[0] < 220 && at[1] > 400) || // Lumo lives in the corner
      (at[0] > 360 && at[0] < 640 && at[1] > 440) || // buttons
      (at[0] < 130 && at[1] < 130) || // the "+" star
      taken.some((t) => Math.hypot(t[0] - at[0], t[1] - at[1]) < 85);
    if (!blocked) return at;
  }
  return [500, 80];
}
