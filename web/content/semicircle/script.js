// "The corner in a semicircle" — from the second half of Lockhart's essay.
//
// Wherever the tip of a triangle sits on a semicircle, the corner there is a right
// angle. School hands this over as "Theorem 9.5" with a two-column proof. Here the
// child discovers it by playing, checks it with a paper corner, and then sees the
// idea of one of Lockhart's seventh-graders: spin the triangle half a turn — you get
// a box whose diagonals are equal, so it must be a rectangle.

import { pts, clamp, set, rotate, angleAt, dist } from '../../src/svg.js';
import { sfx } from '../../src/sfx.js';

const unit = (to, from) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
};
const along = (p, u, k) => ({ x: p.x + u.x * k, y: p.y + u.y * k });

export default async function semicircle(s) {
  const st = { O: { x: 500, y: 420 }, R: 230, th: 0.64 * Math.PI, free: null, phi: 0, skew: 46 };
  const g = s.layer();
  const arcTop = s.el('path', { class: 'line' }, g);
  const arcBot = s.el('path', { class: 'line faint dashed' }, g);
  const diam = s.el('line', { class: 'line' }, g);
  const quad = s.el('polygon', { class: 'shape mint' }, g);
  const copy = s.el('polygon', { class: 'shape ghost' }, g);
  const tri = s.el('polygon', { class: 'shape warm' }, g);
  const wedge = s.el('path', { class: 'wedge right' }, g);
  const paper = s.el('polygon', { class: 'paper' }, g);
  const diagA = s.el('line', { class: 'diag-a' }, g);
  const diagB = s.el('line', { class: 'diag-b' }, g);
  const diagCopy = s.el('line', { class: 'diag-b' }, g);
  const center = s.el('circle', { r: 6, class: 'dot' }, g);
  const inset = s.el('g', {}, g);
  const insetBox = s.el('polygon', { class: 'shape cool' }, inset);
  const insetA = s.el('line', { class: 'diag-a' }, inset);
  const insetB = s.el('line', { class: 'diag-b' }, inset);
  const handle = s.handle(g);
  const spin = s.handle(g);

  const show = (e, on = true) => (e.style.display = on ? '' : 'none');
  for (const e of [arcBot, quad, copy, wedge, paper, diagA, diagB, diagCopy, center, inset, handle, spin]) show(e, false);

  const A = () => ({ x: st.O.x - st.R, y: st.O.y });
  const C = () => ({ x: st.O.x + st.R, y: st.O.y });
  const Bt = () => st.free || { x: st.O.x + st.R * Math.cos(st.th), y: st.O.y - st.R * Math.sin(st.th) };
  const opposite = (b) => ({ x: 2 * st.O.x - b.x, y: 2 * st.O.y - b.y });

  const render = () => {
    const { O, R } = st;
    const a = A();
    const c = C();
    const b = Bt();
    set(arcTop, { d: `M${a.x} ${a.y} A${R} ${R} 0 0 1 ${c.x} ${c.y}` });
    set(arcBot, { d: `M${c.x} ${c.y} A${R} ${R} 0 0 1 ${a.x} ${a.y}` });
    set(diam, { x1: a.x, y1: a.y, x2: c.x, y2: c.y });
    set(center, { cx: O.x, cy: O.y });
    tri.setAttribute('points', pts([a, b, c]));
    handle.moveTo(b.x, b.y);

    const u = unit(a, b);
    const v = unit(c, b);
    const r = 42;
    const p1 = along(b, u, r);
    const p2 = along(b, v, r);
    const sweep = u.x * v.y - u.y * v.x > 0 ? 1 : 0;
    set(wedge, { d: `M${b.x} ${b.y} L${p1.x} ${p1.y} A${r} ${r} 0 0 ${sweep} ${p2.x} ${p2.y} Z` });
    const ang = angleAt(a, b, c);
    wedge.setAttribute('class', `wedge ${Math.abs(ang - 90) < 2 ? 'right' : ang > 90 ? 'wide' : 'narrow'}`);

    const q = 46;
    paper.setAttribute('points', pts([b, along(b, u, q), along(along(b, u, q), v, q), along(b, v, q)]));

    const ra = rotate(a, O, st.phi);
    const rb = rotate(b, O, st.phi);
    const rc = rotate(c, O, st.phi);
    copy.setAttribute('points', pts([ra, rb, rc]));
    spin.moveTo(rb.x, rb.y);
    const b2 = opposite(b);
    quad.setAttribute('points', pts([a, b, c, b2]));
    set(diagA, { x1: a.x, y1: a.y, x2: c.x, y2: c.y });
    set(diagB, { x1: b.x, y1: b.y, x2: b2.x, y2: b2.y });

    // A little "slanted box" on the side, to compare diagonals.
    const x0 = 800;
    const y0 = 110;
    const w = 110;
    const h = 80;
    const k = st.skew;
    const P = [
      { x: x0 + k, y: y0 },
      { x: x0 + w + k, y: y0 },
      { x: x0 + w, y: y0 + h },
      { x: x0, y: y0 + h },
    ];
    insetBox.setAttribute('points', pts(P));
    set(insetA, { x1: P[0].x, y1: P[0].y, x2: P[2].x, y2: P[2].y });
    set(insetB, { x1: P[1].x, y1: P[1].y, x2: P[3].x, y2: P[3].y });
  };
  render();

  // 1. A semicircle and a triangle standing in it.
  await s.say('look');
  await s.draw(arcTop, 1200);
  await s.draw(diam, 600);
  await s.say('tri');
  tri.style.fillOpacity = 0;
  await s.draw(tri, 1000);
  await s.animate(tri, 'fillOpacity', 0, 1, 400);
  await s.say('corner');
  show(wedge);
  await s.fadeIn(wedge, 400);

  // 2. Move the tip along the arc. The corner... doesn't change?
  let travel = 0;
  const onArc = s.drag(handle, {
    move: (p) => {
      let th = Math.atan2(st.O.y - p.y, p.x - st.O.x);
      if (th < 0) th = p.x < st.O.x ? Math.PI : 0;
      th = clamp(th, 0.14, Math.PI - 0.14);
      travel += Math.abs(th - st.th);
      st.th = th;
      render();
    },
  });
  show(handle);
  await s.say('drag');
  await s.until(() => travel > 2.2, { hints: ['drag.hint'] });
  await s.until(() => !onArc.active);
  s.mood('thinking');
  await s.say('same');
  s.mood(null);

  // 3. Check it with the corner of a sheet of paper.
  show(paper);
  await s.tween(900, (k) => paper.setAttribute('transform', `translate(${(1 - k) * 330} ${(1 - k) * -170})`));
  paper.removeAttribute('transform');
  sfx.pop();
  s.celebrate();
  travel = 0;
  await s.say('fits');
  await s.say('check');
  await s.until(() => travel > 2.2, { hints: ['drag.hint'] });
  await s.until(() => !onArc.active);
  onArc.stop();
  show(handle, false);
  await s.say('always');
  await s.say('why');

  // 4. The child's own idea first — then one student's idea.
  await s.say('offer');
  const choice = await s.choose(
    [
      { id: 'mic', icon: 'mic', cls: 'big rec' },
      { id: 'bulb', icon: 'bulb', cls: 'big go' },
    ],
    { hints: ['offer.hint'] },
  );
  if (choice === 'mic') {
    await s.record('semicircle', { prompt: null });
    await s.say('idea.thanks');
  }

  await s.say('circle');
  const y0 = st.O.y;
  await s.tween(900, (k) => {
    st.O.y = y0 - 120 * k;
    render();
  });
  show(arcBot);
  await s.draw(arcBot, 1000);
  show(center);
  show(copy);
  let prev = 0;
  const angle = (p) => Math.atan2(p.y - st.O.y, p.x - st.O.x);
  const rot = s.drag(spin, {
    start: (p) => (prev = angle(p)),
    move: (p) => {
      const a = angle(p);
      let d = a - prev;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      prev = a;
      st.phi = clamp(st.phi + (d * 180) / Math.PI, -180, 180);
      render();
    },
  });
  show(spin);
  await s.say('rotate');
  await s.until(() => Math.abs(st.phi) > 170, { hints: ['rotate.hint'] });
  rot.stop();
  show(spin, false);
  const phi0 = st.phi;
  const target = 180 * Math.sign(phi0);
  await s.tween(300, (k) => {
    st.phi = phi0 + (target - phi0) * k;
    render();
  });
  sfx.pop();

  // 5. A box appears. Is it slanted — or a true rectangle?
  show(quad);
  await s.fadeIn(quad, 500);
  show(copy, false);
  await s.say('box');
  await s.say('parallel');
  show(inset);
  await s.fadeIn(inset, 500);
  await s.say('skew');
  await s.say('diag');
  show(diagA);
  show(diagB);
  await s.draw(diagA, 500);
  await s.draw(diagB, 500);
  await s.say('diag.both');

  const b = Bt();
  const b2 = opposite(b);
  let turn = (Math.atan2(b2.y - b.y, b2.x - b.x) * 180) / Math.PI;
  turn = -turn;
  if (turn > 90) turn -= 180;
  if (turn < -90) turn += 180;
  show(diagCopy);
  await s.tween(1300, (k) => {
    const p = rotate(b, st.O, turn * k);
    const q = rotate(b2, st.O, turn * k);
    set(diagCopy, { x1: p.x, y1: p.y, x2: q.x, y2: q.y });
  });
  sfx.pop();
  await s.say('diag.same');
  await s.fadeOut(diagCopy, 400);
  show(diagCopy, false);

  await Promise.all([
    s.say('rect'),
    s.tween(1600, (k) => {
      st.skew = 46 * (1 - k);
      render();
    }),
  ]);
  s.celebrate(b.x, b.y);
  await s.say('aha');
  s.complete();

  // 6. Free play: leave the circle. Where else is the corner a right angle?
  for (const e of [quad, diagA, diagB, inset, paper]) show(e, false);
  st.free = Bt();
  render();
  let zone = 'on';
  const free = s.drag(handle, {
    move: (p) => {
      let q = { x: clamp(p.x, 40, 960), y: clamp(p.y, 20, st.O.y - 18) };
      const d = dist(q, st.O);
      if (Math.abs(d - st.R) < 10) {
        q = { x: st.O.x + ((q.x - st.O.x) * st.R) / d, y: st.O.y + ((q.y - st.O.y) * st.R) / d };
        zone = 'on';
      } else {
        zone = d < st.R ? 'in' : 'out';
      }
      st.free = q;
      show(paper, zone === 'on');
      render();
    },
  });
  show(handle);
  await s.say('free');
  const seen = { in: false, out: false };
  while (!seen.in || !seen.out) {
    await s.until(() => (zone === 'in' && !seen.in) || (zone === 'out' && !seen.out), { hints: ['free.hint'] });
    seen[zone] = true;
    await s.say(zone === 'in' ? 'inside' : 'outside');
  }
  await s.say('find');
  await s.until(() => zone === 'on' && !free.active, { hints: ['find.hint'] });
  free.stop();
  s.celebrate(st.free.x, st.free.y);
  await s.say('oncircle');
  await s.say('home');
  s.unlock('corners-in-space');
  await s.say('space');

  await s.record('semicircle', { prompt: 'explain' });
  await s.say('bye');
}
