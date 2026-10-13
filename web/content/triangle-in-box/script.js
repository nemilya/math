// "Triangle in a box" — the very first example in Lockhart's "A Mathematician's Lament".
//
// How much of the box does the triangle take up? The child guesses, plays with the
// triangle, looks for the one cut that makes the answer obvious, and then finds a
// case where the trick breaks — an open question that goes up into the sky.

import { pts, clamp, set } from '../../src/svg.js';
import { sfx } from '../../src/sfx.js';

const L = 200;
const R = 800;
const T = 110;
const B = 470;

// Picture-buttons for the guess: a box filled to some level.
const level = (k) =>
  `<svg viewBox="0 0 100 100"><rect x="14" y="20" width="72" height="60" rx="4" fill="none" stroke="currentColor" stroke-width="6"/><rect x="17" y="${(77 - 54 * k).toFixed(1)}" width="66" height="${(54 * k).toFixed(1)}" fill="#ffc457"/></svg>`;

export default async function triangleInBox(s) {
  const g = s.layer();
  const tip = { x: L + (R - L) * 0.3, y: T };
  let lo = L;
  let hi = R;
  let showPieces = false;

  const box = s.el('rect', { class: 'line' }, g);
  const pieces = s.el('g', {}, g);
  const inL = s.el('polygon', { class: 'piece warm' }, pieces);
  const inR = s.el('polygon', { class: 'piece warm' }, pieces);
  const outL = s.el('polygon', { class: 'piece cool' }, pieces);
  const outR = s.el('polygon', { class: 'piece cool' }, pieces);
  const tri = s.el('polygon', { class: 'shape warm' }, g);
  const cut = s.el('line', { class: 'cut' }, g);
  const flips = s.el('g', {}, g);
  const handle = s.handle(g);
  pieces.style.opacity = 0;
  cut.style.display = 'none';
  handle.show(false);

  const render = () => {
    const x0 = Math.min(L, tip.x);
    const x1 = Math.max(R, tip.x);
    set(box, { x: x0, y: T, width: x1 - x0, height: B - T });
    tri.setAttribute('points', pts([{ x: L, y: B }, tip, { x: R, y: B }]));
    handle.moveTo(tip.x, tip.y);
    set(cut, { x1: tip.x, y1: T, x2: tip.x, y2: B });
    const inside = tip.x >= L && tip.x <= R;
    pieces.style.display = showPieces && inside ? '' : 'none';
    if (showPieces && inside) {
      inL.setAttribute('points', pts([tip, { x: L, y: B }, { x: tip.x, y: B }]));
      outL.setAttribute('points', pts([{ x: L, y: T }, tip, { x: L, y: B }]));
      inR.setAttribute('points', pts([tip, { x: tip.x, y: B }, { x: R, y: B }]));
      outR.setAttribute('points', pts([tip, { x: R, y: T }, { x: R, y: B }]));
    }
  };

  let travel = 0;
  const dragTip = () =>
    s.drag(handle, {
      move: (p) => {
        const x = clamp(p.x, lo, hi);
        travel += Math.abs(x - tip.x);
        tip.x = x;
        render();
      },
    });

  render();

  // 1. A box, a triangle, a question.
  await s.say('look');
  await s.draw(box, 1100);
  await s.say('triangle');
  tri.style.fillOpacity = 0;
  await s.draw(tri, 1200);
  await s.animate(tri, 'fillOpacity', 0, 1, 500);

  await s.say('question');
  const guess = await s.choose(
    [
      { id: 'less', svg: level(0.3) },
      { id: 'half', svg: level(0.5) },
      { id: 'more', svg: level(0.75) },
    ],
    { hints: ['choose.hint'] },
  );
  s.remember('guess', guess);
  await s.say(`guess.${guess}`);

  // 2. Play: it is *our* imaginary triangle — we can move it.
  await s.say('imaginary');
  travel = 0;
  let d = dragTip(); // draggable the moment it glows — children grab right away
  handle.show(true);
  await s.say('drag');
  await s.until(() => travel > 500, { hints: ['drag.hint1', 'drag.hint2'] });
  await s.until(() => !d.active);
  d.stop();
  handle.show(false);
  await s.say('dragged');

  // 3. Look for the one cut that makes everything visible.
  await s.say('scissors');
  const area = s.el('rect', { x: L, y: T, width: R - L, height: B - T, class: 'hit-area' }, g);
  g.insertBefore(area, handle);
  for (let misses = 0; ; misses++) {
    const p = await s.tapPoint(area, { hints: [misses >= 2 ? 'miss.hint' : 'scissors.hint'] });
    const hit = Math.abs(p.x - tip.x) < 45;
    const x = hit ? tip.x : clamp(p.x, L + 8, R - 8);
    set(cut, { x1: x, x2: x });
    cut.style.display = '';
    sfx.snip();
    await s.draw(cut, 450);
    if (hit) break;
    if (misses >= 3) {
      await s.say('auto');
      set(cut, { x1: tip.x, x2: tip.x });
      await s.draw(cut, 600);
      break;
    }
    await s.say(misses >= 1 ? 'miss.hint' : 'miss');
    cut.style.display = 'none';
    if (misses >= 1) {
      handle.show(true); // light up the tip as a clue (taps go through it to the box)
      handle.style.pointerEvents = 'none';
    }
  }
  area.remove();
  handle.show(false);
  handle.style.pointerEvents = '';
  showPieces = true;
  render();

  // 4. The "aha": each half of the box is cut in half by a side of the triangle.
  await s.say('cut');
  await Promise.all([s.fadeIn(pieces, 600), s.animate(tri, 'fillOpacity', 1, 0, 600)]);
  await s.say('halves');
  await s.say('inout');
  await s.say('flip');
  const flip = async (piece, cx) => {
    const ghost = piece.cloneNode();
    flips.appendChild(ghost);
    await s.tween(1300, (k) => ghost.setAttribute('transform', `rotate(${180 * k} ${cx} ${(T + B) / 2})`));
    sfx.pop();
  };
  await flip(outL, (L + tip.x) / 2);
  await flip(outR, (tip.x + R) / 2);
  s.celebrate(500, 290);
  await s.say('fits');
  await s.say('half');
  await s.say('formula'); // only older children hear where the school formula comes from
  await s.fadeOut(flips, 500);
  flips.innerHTML = '';
  flips.style.opacity = '';
  await s.say(guess === 'half' ? 'guess.was.half' : 'guess.was.other');
  s.complete();

  // 5. Does the trick always work? Move the tip again — the cut follows.
  travel = 0;
  d = dragTip();
  handle.show(true);
  await s.say('again');
  await s.until(() => travel > 500, { hints: ['drag.hint1'] });
  await s.until(() => !d.active);
  s.celebrate();
  await s.say('always');

  // 6. ...and then it breaks. A real open question.
  lo = 40;
  hi = 960;
  await s.say('twist');
  await s.until(() => tip.x < L - 60 || tip.x > R + 60, { hints: ['twist.hint'] });
  await s.until(() => !d.active);
  d.stop();
  s.mood('thinking');
  await s.say('broken');
  await s.say('newidea');
  s.mood(null);
  s.unlock('slanted-triangle');
  await s.say('sky');
  s.unlock('pyramid-in-cube');
  await s.say('pyramid');

  // 7. The child's own explanation — the real "product" of a math lesson.
  await s.record('triangle-in-box', { prompt: 'explain' });
  await s.say('bye');
}
