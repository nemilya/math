// Tiny 3D for adventures in space (a cube, a pyramid, a sphere...): a camera that can be
// turned, perspective projection onto the 1000×600 stage, and polygons drawn back to front.
// World coordinates: x right, y up, z towards the viewer; the camera looks at `center`.

import { el, set, pts } from './svg.js';

export function camera({ cx = 500, cy = 300, scale = 220, dist = 4.5, yaw = -0.6, pitch = 0.45, center = [0.5, 0.5, 0.5] } = {}) {
  const cam = { cx, cy, scale, dist, yaw, pitch, center };

  // world → view (x right, y up, z towards the viewer)
  cam.view = (p) => {
    let x = p[0] - cam.center[0];
    let y = p[1] - cam.center[1];
    let z = p[2] - cam.center[2];
    const cy_ = Math.cos(cam.yaw);
    const sy_ = Math.sin(cam.yaw);
    [x, z] = [x * cy_ + z * sy_, -x * sy_ + z * cy_];
    const cp = Math.cos(cam.pitch);
    const sp = Math.sin(cam.pitch);
    [y, z] = [y * cp - z * sp, y * sp + z * cp];
    return [x, y, z];
  };

  // world → stage point (+ depth for sorting)
  cam.project = (p) => {
    const [x, y, z] = cam.view(p);
    const f = cam.dist / (cam.dist - z);
    return { x: cam.cx + cam.scale * x * f, y: cam.cy - cam.scale * y * f, z };
  };

  // How far does a point move on screen when it moves along the world axes a and b?
  // Used to turn a finger's movement into movement on a plane (e.g. along the top of a cube).
  cam.unproject = (p, a, b, dx, dy) => {
    const e = 0.01;
    const p0 = cam.project(p);
    const pa = cam.project(p.map((v, i) => v + a[i] * e));
    const pb = cam.project(p.map((v, i) => v + b[i] * e));
    const m = [(pa.x - p0.x) / e, (pb.x - p0.x) / e, (pa.y - p0.y) / e, (pb.y - p0.y) / e];
    const det = m[0] * m[3] - m[1] * m[2];
    if (Math.abs(det) < 1e-6) return [0, 0];
    return [(m[3] * dx - m[1] * dy) / det, (-m[2] * dx + m[0] * dy) / det];
  };

  return cam;
}

// A layer of polygons re-drawn every frame, sorted far → near (painter's algorithm).
// draw([{ pts: [[x,y,z], ...], cls: 'face a', shade: true }, ...]) — `shade` lights solid faces
// from the upper left, so a pyramid looks like a solid and not a flat sticker.
const LIGHT = (() => {
  const v = [-0.45, 0.75, 0.5];
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
})();

function brightness(v) {
  const a = v[1].map((x, i) => x - v[0][i]);
  const b = v[2].map((x, i) => x - v[0][i]);
  const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = Math.hypot(...n) || 1;
  return Math.abs((n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / len);
}
export function polygons(parent) {
  const g = el('g', {}, parent);
  const pool = [];
  return {
    g,
    draw(cam, list) {
      const shapes = list
        .map((p) => {
          const q = p.pts.map(cam.project);
          const light = p.shade ? 0.45 + 0.55 * brightness(p.pts.map(cam.view)) : null;
          return { q, cls: p.cls, light, z: q.reduce((s, v) => s + v.z, 0) / q.length + (p.bias || 0) };
        })
        .sort((a, b) => a.z - b.z);
      shapes.forEach((s, i) => {
        const e = pool[i] || (pool[i] = el('polygon', {}, g));
        set(e, { points: pts(s.q), class: s.cls });
        e.style.fillOpacity = s.light == null ? '' : s.light.toFixed(2);
        e.style.display = '';
      });
      for (let i = shapes.length; i < pool.length; i++) pool[i].style.display = 'none';
    },
  };
}

// --- shapes ---

export const lerp3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
export const add3 = (a, b) => a.map((v, i) => v + b[i]);

// The six faces of the unit cube [0,1]³, each as 4 corners.
export function cubeFaces() {
  const c = (x, y, z) => [x, y, z];
  return [
    [c(0, 0, 0), c(1, 0, 0), c(1, 0, 1), c(0, 0, 1)], // bottom  y=0
    [c(0, 1, 0), c(1, 1, 0), c(1, 1, 1), c(0, 1, 1)], // top     y=1
    [c(0, 0, 0), c(0, 1, 0), c(0, 1, 1), c(0, 0, 1)], // left    x=0
    [c(1, 0, 0), c(1, 1, 0), c(1, 1, 1), c(1, 0, 1)], // right   x=1
    [c(0, 0, 0), c(1, 0, 0), c(1, 1, 0), c(0, 1, 0)], // back    z=0
    [c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1)], // front   z=1
  ];
}

// A pyramid: a base polygon and an apex → base + triangular sides.
export function pyramidFaces(base, apex) {
  return [base, ...base.map((p, i) => [p, base[(i + 1) % base.length], apex])];
}

// A box from corner a to corner b (axis-aligned) → 6 faces.
export function boxFaces([x0, y0, z0], [x1, y1, z1]) {
  const c = (x, y, z) => [x, y, z];
  return [
    [c(x0, y0, z0), c(x1, y0, z0), c(x1, y0, z1), c(x0, y0, z1)],
    [c(x0, y1, z0), c(x1, y1, z0), c(x1, y1, z1), c(x0, y1, z1)],
    [c(x0, y0, z0), c(x0, y1, z0), c(x0, y1, z1), c(x0, y0, z1)],
    [c(x1, y0, z0), c(x1, y1, z0), c(x1, y1, z1), c(x1, y0, z1)],
    [c(x0, y0, z0), c(x1, y0, z0), c(x1, y1, z0), c(x0, y1, z0)],
    [c(x0, y0, z1), c(x1, y0, z1), c(x1, y1, z1), c(x0, y1, z1)],
  ];
}
