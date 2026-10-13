// "The last pebble" — a Nim-like game. Lockhart: "Play games! Teach them Chess and Go,
// Hex and Backgammon, Sprouts and Nim... Expose them to situations where deductive
// reasoning is necessary."
//
// Take 1, 2 or 3 pebbles; whoever takes the last one wins. Lumo plays — and soon
// starts winning every time. Why? The child hunts for his secret (leave four!),
// then tests the idea on a new rule (take up to four → the trap is five).

import { set } from '../../src/svg.js';
import { sfx } from '../../src/sfx.js';

const ROW_Y = 300;
const GAP = 64;

export default async function lastPebble(s) {
  const g = s.layer();
  // Dashed slots at the top: "how many may I take" — they fill up as pebbles are picked.
  const rules = s.el('g', { transform: 'translate(500 70)' }, g);
  const row = s.el('g', {}, g);
  let pebbles = [];
  let max = 3;
  const heaps = { kid: { x: 760, y: 515, n: 0 }, lumo: { x: 250, y: 515, n: 0 } };

  const left = () => pebbles.filter((p) => !p.taken).length;

  const slots = rules;
  const drawRules = () => {
    rules.innerHTML = '';
    for (let i = 0; i < max; i++) {
      s.el('circle', { cx: (i - (max - 1) / 2) * 40, cy: 0, r: 14, class: 'rule-slot' }, slots);
    }
  };

  // ----- the rules, told with pictures (at the start, after a new rule, and on "?") -----
  // 1. we take turns: a pebble hops between the child and Lumo;
  // 2. you may take 1…max: little piles with a tick, and one too many with a cross;
  // 3. whoever takes the last pebbles (one or several at once, so that none are left) wins:
  //    the last two fly to the child together, an empty spot remains, the child gets a crown.
  const face = (parent, x, y, who) => {
    const t = s.el('g', { transform: `translate(${x} ${y})` }, parent);
    if (who === 'lumo') s.el('path', { d: 'M4 -30 C 4 -42, 12 -48, 18 -52', class: 'antenna' }, t);
    s.el('circle', { r: 32, class: `token ${who}` }, t);
    s.el('circle', { cx: -10, cy: -4, r: 4.5, class: 'eye' }, t);
    s.el('circle', { cx: 10, cy: -4, r: 4.5, class: 'eye' }, t);
    s.el('path', { d: 'M-10 10 Q0 19 10 10', class: 'smile' }, t);
    return t;
  };
  const stone = (parent, x, y, r = 13) => s.el('ellipse', { cx: x, cy: y, rx: r, ry: r * 0.82, class: 'stone' }, parent);
  const popIn = (parent, x, y) => {
    const outer = s.el('g', { transform: `translate(${x} ${y})` }, parent);
    return s.el('g', { class: 'pop' }, outer);
  };

  let showing = null;
  const showRules = () =>
    (showing ??= (async () => {
      const board = s.el('g', { class: 'rules-board' }, g); // last in the layer → on top of the game
      const back = s.el('rect', { x: -400, y: -200, width: 1800, height: 1000, class: 'board-back' }, board);
      let closed = false;
      back.addEventListener('click', () => {
        closed = true;
        s.hush();
      });
      try {
        board.style.opacity = 0;
        row.style.visibility = 'hidden'; // the game's own pebbles would show through
        await s.fadeIn(board, 250);

        // 1. turns
        face(popIn(board, 0, 0), 390, 190, 'kid');
        face(popIn(board, 0, 0), 610, 190, 'lumo');
        const ball = stone(board, 440, 190, 14);
        await Promise.all([
          s.say('rules.turns'),
          s.tween(2400, (k) => {
            const hop = (k * 3) % 1; // three hops: you → Lumo → you → Lumo
            const dir = Math.floor(k * 3) % 2 ? -1 : 1;
            const x = dir > 0 ? 440 + 120 * hop : 560 - 120 * hop;
            set(ball, { cx: x, cy: 190 - 55 * Math.sin(Math.PI * hop) });
          }),
        ]);
        if (closed) return;

        // 2. how many: 1…max ✓, max+1 ✗
        const n = max + 1;
        const gap = n === 4 ? 175 : 150;
        const take = s.say(`rules.take.${max}`);
        take.catch(() => {}); // the scene may close mid-way
        for (let i = 1; i <= n; i++) {
          const ok = i <= max;
          const grp = popIn(board, 500 + (i - (n + 1) / 2) * gap, 335);
          grp.classList.add('group', ok ? 'ok' : 'no');
          for (let j = 0; j < i; j++) stone(grp, (j - (i - 1) / 2) * 27, 0);
          s.el('path', { d: ok ? 'M-16 52 L-4 64 L18 40' : 'M-14 40 L14 66 M14 40 L-14 66', class: `mark ${ok ? 'ok' : 'no'}` }, grp);
          sfx.pebble();
          await s.wait(ok ? 650 : 900);
          if (closed) return;
        }
        await take;
        if (closed) return;

        // 3. whoever takes the last pebbles wins — even two or three at once
        const spot = s.el('circle', { cx: 500, cy: 505, r: 34, class: 'empty-spot' }, board);
        spot.style.opacity = 0;
        const last = [stone(board, 482, 505, 17), stone(board, 518, 505, 17)];
        const said = s.say('rules.win');
        said.catch(() => {});
        await s.wait(700);
        if (closed) return;
        await s.tween(900, (k) => {
          last.forEach((e, i) => {
            set(e, { cx: (i ? 518 : 482) + (390 - (i ? 518 : 482) + (i ? 12 : -12)) * k, cy: 505 + (235 - 505) * k });
            e.style.opacity = 1 - 0.7 * k;
          });
        });
        last.forEach((e) => e.remove());
        sfx.pebble();
        await s.fadeIn(spot, 300); // nothing left for the other player
        const crown = popIn(board, 390, 182);
        s.el('path', { d: 'M-24 -24 L-24 -52 L-12 -38 L0 -58 L12 -38 L24 -52 L24 -24 Z', class: 'crown' }, crown);
        sfx.chime();
        s.sparkle(390, 140);
        await said;
        if (!closed) await s.wait(900);
      } finally {
        await s.fadeOut(board, 300).catch(() => {});
        board.remove();
        row.style.visibility = '';
        showing = null;
      }
    })());
  s.help(() => showRules().catch(() => {}));

  const setup = async (n) => {
    row.innerHTML = '';
    heaps.kid.n = 0;
    heaps.lumo.n = 0;
    pebbles = Array.from({ length: n }, (_, i) => {
      const x = 500 + (i - (n - 1) / 2) * GAP;
      const pg = s.el('g', { class: 'pebble', transform: `translate(${x} ${ROW_Y})` }, row);
      const lift = s.el('g', { class: 'lift' }, pg);
      const rot = (Math.random() * 40 - 20).toFixed(0);
      s.el('ellipse', { rx: 24 + Math.random() * 4, ry: 19 + Math.random() * 3, class: 'stone', transform: `rotate(${rot})` }, lift);
      s.el('circle', { r: 31, class: 'sel' }, lift);
      s.el('circle', { r: 34, fill: 'transparent' }, pg);
      pg.style.opacity = 0;
      return { g: pg, x, y: ROW_Y, taken: false, sel: false };
    });
    for (const p of pebbles) {
      sfx.pebble();
      await s.animate(p.g, 'opacity', 0, 1, 90);
    }
  };

  // The dashed slots at the top show "how many may I take" — and fill up as pebbles are picked.
  const mark = (p, on) => {
    p.sel = on;
    p.g.classList.toggle('selected', on);
    const n = pebbles.filter((q) => q.sel && !q.taken).length;
    [...slots.children].forEach((c, i) => c.classList.toggle('filled', i < n));
  };

  const take = async (list, who) => {
    const h = heaps[who];
    await Promise.all(
      list.map(async (p, i) => {
        p.taken = true;
        p.sel = false;
        const slot = h.n++;
        const tx = h.x + ((slot % 7) - 3) * 26;
        const ty = h.y - Math.floor(slot / 7) * 22;
        p.g.classList.remove('selected', 'tappable');
        await s.wait(i * 90);
        await s.tween(550, (k) => {
          const sc = 1 - 0.45 * k;
          set(p.g, { transform: `translate(${p.x + (tx - p.x) * k} ${p.y + (ty - p.y) * k}) scale(${sc})` });
        });
        sfx.pebble();
      }),
    );
    for (const c of slots.children) c.classList.remove('filled');
  };

  const kidTurn = async () => {
    const chosen = new Set();
    for (;;) {
      const targets = new Map();
      for (const p of pebbles) if (!p.taken) targets.set(p.g, p);
      if (chosen.size) for (const [b, id] of s.buttons([{ id: 'ok', icon: 'check', cls: 'big go' }])) targets.set(b, id);
      else s.clearDock();
      const hit = await s.tap(targets, { hints: [chosen.size ? 'confirm.hint' : 'tap.hint'] });
      if (hit === 'ok') break;
      if (hit.sel) {
        mark(hit, false);
        chosen.delete(hit);
      } else if (chosen.size >= max) {
        s.talk(`toomany.${max}`);
      } else {
        mark(hit, true);
        chosen.add(hit);
        sfx.pebble();
        if (chosen.size === Math.min(max, left())) {
          await s.wait(450);
          break;
        }
      }
    }
    s.clearDock();
    s.hush();
    await take([...chosen], 'kid');
  };

  const lumoTurn = async (smart) => {
    s.mood('thinking');
    if (Math.random() < 0.4) await s.say('think');
    else await s.wait(700);
    await s.wait(400);
    s.mood(null);
    const rem = left();
    let k;
    if (rem <= max) k = rem;
    else if (smart && rem % (max + 1)) k = rem % (max + 1);
    else k = 1 + Math.floor(Math.random() * max);
    const picks = pebbles.filter((p) => !p.taken).slice(-k);
    for (const p of picks) {
      mark(p, true);
      sfx.pebble();
      await s.wait(280);
    }
    await s.say(`take.${k}`);
    await take(picks, 'lumo');
  };

  // One game. Returns who won, and whether the child ever left Lumo exactly in the trap.
  const game = async (n, smart, first, countAloud) => {
    await setup(n);
    let trapped = false;
    await s.say(first ? 'start.first' : 'yourturn');
    for (;;) {
      await kidTurn();
      if (!left()) return { winner: 'kid', trapped };
      if (left() === max + 1) {
        trapped = true;
        await s.say(`trapped.${max + 1}`);
      }
      await lumoTurn(smart);
      if (!left()) return { winner: 'lumo', trapped };
      if (countAloud) await s.say(`left.${left()}`);
      await s.say('yourturn');
    }
  };

  // ----- the session -----
  drawRules();
  await s.say('hello');
  await setup(s.age === 'small' ? 7 : 10);
  await showRules();
  await s.say('rules.where');

  // Little ones get shorter games. (Never a multiple of the trap: the child, moving first, can always win.)
  const sizes = s.age === 'small' ? { 3: [7, 6, 9, 7], 4: [8, 7, 9] } : { 3: [10, 11, 9, 13, 10, 11], 4: [13, 12, 11, 14] };
  const found = { 3: false, 4: false };
  let gameNo = 0;
  let lumoWins = 0;
  let countAloud = false;
  let firstGame = true;

  for (;;) {
    const smart = gameNo > 0 || max === 4;
    const n = sizes[max][gameNo % sizes[max].length];
    gameNo++;
    const { winner, trapped } = await game(n, smart, firstGame, countAloud);
    s.complete();
    firstGame = false;

    if (winner === 'kid') {
      s.celebrate(heaps.kid.x, heaps.kid.y - 40);
      await s.say('win.kid');
      if (smart && trapped && !found[max]) {
        found[max] = true;
        await s.say(`secret.${max + 1}`);
        if (max === 3) {
          await s.say('eight');
          s.unlock('pebble-misere');
          await s.record('last-pebble', { prompt: 'explain' });
        }
      }
    } else {
      await s.say('win.lumo');
      if (smart && !found[max]) {
        lumoWins++;
        if (lumoWins === 2) {
          countAloud = true;
          await s.say('hint1');
        } else if (lumoWins === 3) {
          await s.say(`hint2.${max + 1}`);
        }
      }
    }

    const opts = [{ id: 'again', icon: 'replay', cls: 'big go' }];
    if (found[3] && max === 3) opts.push({ id: 'rule4', icon: 'hand4', cls: 'big' });
    opts.push({ id: 'home', icon: 'home' });
    await s.say(found[3] && max === 3 ? 'again.or.new' : 'again');
    const c = await s.choose(opts, { hints: ['menu.hint'] });
    if (c === 'home') return;
    if (c === 'rule4') {
      max = 4;
      gameNo = 0;
      lumoWins = 0;
      countAloud = false;
      drawRules();
      await s.say('newrule');
      await showRules();
    }
  }
}
