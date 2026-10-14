// "A pyramid in a cube" — where Lockhart's essay ends: "Well, I think I have an idea about a
// pyramid inside a cube..."
//
// A triangle takes up half of its box. What about a pyramid inside a cube? The child turns
// the glass cube, moves the pyramid's tip along the lid, puts it into a corner — and two
// more identical pyramids fly in and fill the cube: each one is a third. Then the pyramid
// is sliced into layers like a stack of cards: moving the tip only slides the layers, their
// size never changes — so it is always a third (Cavalieri's idea, by hand).

import { clamp } from '../../src/svg.js';
import { sfx } from '../../src/sfx.js';
import { camera, polygons, cubeFaces, pyramidFaces, boxFaces, lerp3, add3 } from '../../src/space.js';

const LAYERS = 8;
const BASE = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 0, 1],
  [0, 0, 1],
];

// Picture-buttons for the guess: a box filled to some level.
const level = (k) =>
  `<svg viewBox="0 0 100 100"><rect x="14" y="20" width="72" height="60" rx="4" fill="none" stroke="currentColor" stroke-width="6"/><rect x="17" y="${(77 - 54 * k).toFixed(1)}" width="66" height="${(54 * k).toFixed(1)}" fill="#ffc457"/></svg>`;

const scale3 = (v, k) => v.map((x) => x * k);

// Three pyramids with a common apex in the corner c of the lid; their bases are the three
// faces of the cube that do not touch c — together they fill the cube exactly.
function trio(c) {
  const X = 1 - c[0];
  const Z = 1 - c[2];
  return [
    { cls: 'a', apex: c, base: BASE, normal: [0, -1, 0], k: 1 },
    { cls: 'b', apex: c, base: [[X, 0, 0], [X, 1, 0], [X, 1, 1], [X, 0, 1]], normal: [X ? 1 : -1, 0, 0], k: 0 },
    { cls: 'c', apex: c, base: [[0, 0, Z], [1, 0, Z], [1, 1, Z], [0, 1, Z]], normal: [0, 0, Z ? 1 : -1], k: 0 },
  ];
}

export default async function pyramidInCube(s) {
  const g = s.layer();
  const cam = camera({ cy: 290, scale: 205 });
  const sky = s.el('rect', { x: -500, y: -300, width: 2000, height: 1200, class: 'hit-area spin' }, g);
  const scene = polygons(g);
  const handle = s.handle(g);
  handle.show(false);

  const st = { mode: 'cube', apex: [0.5, 0, 0.5], spread: 0, three: null };

  const render = () => {
    const list = cubeFaces().map((f) => ({ pts: f, cls: 'glass', bias: -0.01 }));
    if (st.mode === 'one') {
      pyramidFaces(BASE, st.apex).forEach((f) => list.push({ pts: f, cls: 'pyr a', shade: true }));
    }
    if (st.mode === 'three') {
      for (const p of st.three) {
        if (p.k <= 0) continue;
        const off = add3(scale3(p.normal, 1.8 * (1 - p.k)), scale3(p.normal, 0.45 * st.spread));
        pyramidFaces(p.base, p.apex).forEach((f) => list.push({ pts: f.map((v) => add3(v, off)), cls: `pyr ${p.cls}`, shade: true }));
      }
    }
    if (st.mode === 'layers') {
      for (let i = 0; i < LAYERS; i++) {
        const y0 = i / LAYERS;
        const sq = BASE.map((b) => lerp3(b, st.apex, y0)); // the slice of the pyramid at this height
        const xs = sq.map((p) => p[0]);
        const zs = sq.map((p) => p[2]);
        boxFaces([Math.min(...xs), y0, Math.min(...zs)], [Math.max(...xs), y0 + 1 / LAYERS, Math.max(...zs)]).forEach((f) =>
          list.push({ pts: f, cls: `slab ${i % 2 ? 'b' : 'a'}`, shade: true }),
        );
      }
    }
    scene.draw(cam, list);
    const a = cam.project(st.apex);
    handle.moveTo(a.x, a.y);
  };

  // Turning the cube: drag anywhere on the sky around it.
  let spun = 0;
  let last = null;
  s.drag(sky, {
    start: (p) => (last = p),
    move: (p) => {
      if (!last) return (last = p);
      cam.yaw += (p.x - last.x) * 0.008;
      cam.pitch = clamp(cam.pitch + (p.y - last.y) * 0.006, 0.2, 1.15);
      spun += Math.abs(p.x - last.x) + Math.abs(p.y - last.y);
      last = p;
      render();
    },
  });

  // Moving the tip along the lid of the cube (optionally snapping into a corner).
  let travel = 0;
  let snap = false;
  let inCorner = false;
  const dragApex = () => {
    let prev = null;
    return s.drag(handle, {
      start: (p) => (prev = p),
      move: (p) => {
        if (!prev) return (prev = p);
        const [da, db] = cam.unproject(st.apex, [1, 0, 0], [0, 0, 1], p.x - prev.x, p.y - prev.y);
        prev = p;
        let x = clamp(st.apex[0] + da, 0, 1);
        let z = clamp(st.apex[2] + db, 0, 1);
        const was = inCorner;
        inCorner = false;
        if (snap) {
          const cx = Math.round(x);
          const cz = Math.round(z);
          if (Math.hypot(x - cx, z - cz) < 0.18) {
            if (!was) sfx.tap(); // a little click as it snaps into the corner
            [x, z, inCorner] = [cx, cz, true];
          }
        }
        travel += Math.hypot(x - st.apex[0], z - st.apex[2]);
        st.apex = [x, 1, z];
        render();
      },
    });
  };

  render();

  // 1. A real box this time: a glass cube you can turn.
  scene.g.style.opacity = 0;
  await s.say('look');
  await s.fadeIn(scene.g, 900);
  await s.say('spin');
  await s.until(() => spun > 300, { hints: ['spin.hint'] }); // turning it before Lumo asks counts too
  await s.say('spun');

  // 2. A pyramid grows inside: base = the bottom of the cube, tip on the lid.
  await s.say('pyramid');
  st.mode = 'one';
  await s.tween(1500, (k) => {
    st.apex = [0.5, k, 0.5];
    render();
  });
  await s.say('question');
  const guess = await s.choose(
    [
      { id: 'less', svg: level(0.3) },
      { id: 'half', svg: level(0.5) },
      { id: 'more', svg: level(0.75) },
    ],
    { hints: ['choose.hint'], reply: (id) => `guess.${id}` },
  );
  s.remember('guess', guess);
  await s.say(`guess.${guess}`);

  // 3. Play: the tip rides anywhere on the lid.
  travel = 0;
  let d = dragApex();
  handle.show(true);
  await s.say('drag');
  await s.until(() => travel > 1.2, { hints: ['drag.hint'] });
  await s.until(() => !d.active);
  await s.say('dragged');

  // 4. Into a corner...
  snap = true;
  await s.say('corner');
  await s.until(() => inCorner && !d.active, { hints: ['corner.hint'] });
  d.stop();
  handle.show(false);
  snap = false;
  sfx.pop();

  // ...and two more pyramids just like it fly in and fill the cube.
  const corner = [...st.apex];
  st.three = trio(corner);
  st.mode = 'three';
  render();
  await s.say('three');
  for (const p of st.three.slice(1)) {
    await s.tween(1400, (k) => {
      p.k = k;
      render();
    });
    sfx.pop();
  }
  s.celebrate(500, 290);
  await s.say('fill');
  await Promise.all([
    s.say('same'),
    s.tween(1000, (k) => {
      st.spread = k;
      render();
    }),
  ]);
  await s.wait(1200);
  await s.tween(1000, (k) => {
    st.spread = 1 - k;
    render();
  });
  s.celebrate(500, 290);
  await s.say('third');
  await s.say('formula'); // only older children hear where the school formula comes from
  await s.say(`guess.was.${guess}`);
  s.complete();

  // 5. But the tip was in a corner. Elsewhere? Slice the pyramid like a stack of cards.
  await s.say('but');
  st.mode = 'layers';
  render();
  await s.say('layers');
  travel = 0;
  d = dragApex();
  handle.show(true);
  await s.say('slide');
  await s.until(() => travel > 1.2, { hints: ['drag.hint'] });
  await s.until(() => !d.active);
  s.celebrate();
  await s.say('same.amount');
  d.stop();
  handle.show(false);

  // 6. A new question for the sky, and the child's own explanation.
  s.unlock('cone-in-cylinder');
  await s.say('cone');
  await s.record('pyramid-in-cube', { prompt: 'explain' });
  await s.say('bye');
}
