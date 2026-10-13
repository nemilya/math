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
  const rules = s.el('g', { transform: 'translate(500 70)' }, g);
  const row = s.el('g', {}, g);
  let pebbles = [];
  let max = 3;
  const heaps = { kid: { x: 760, y: 515, n: 0 }, lumo: { x: 250, y: 515, n: 0 } };

  const left = () => pebbles.filter((p) => !p.taken).length;

  const drawRules = () => {
    rules.innerHTML = '';
    for (let i = 0; i < max; i++) {
      s.el('circle', { cx: (i - (max - 1) / 2) * 40, cy: 0, r: 14, class: 'rule-slot' }, rules);
    }
  };

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
    [...rules.children].forEach((c, i) => c.classList.toggle('filled', i < n));
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
    for (const c of rules.children) c.classList.remove('filled');
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
  await s.say('rules1');
  await s.say('rules2');

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
    }
  }
}
