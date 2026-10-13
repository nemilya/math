// The sky of questions — the map of the whole portal.
//
// It is a map, not a ladder: stars are linked by "this question leads to that one",
// never by "you must pass this first". There are no levels and no locks on adventures.
//
//   adventure — an interactive journey with Lumo (content/<id>/script.js)
//   question  — an open question. No answer is given; the child can record ideas.
//               `from` makes it appear after that adventure (Lumo "hangs it in the sky").
//   far       — questions from the edge of the sky: adventures still to be built.
//
// To add a star: add it here and give it spoken lines in content/sky/lines.<lang>.js.

export const STARS = [
  {
    id: 'triangle-in-box',
    kind: 'adventure',
    at: [270, 300],
    load: () => import('./triangle-in-box/script.js'),
  },
  { id: 'slanted-triangle', kind: 'question', at: [150, 180], from: 'triangle-in-box' },
  { id: 'pyramid-in-cube', kind: 'question', at: [345, 150], from: 'triangle-in-box' },

  {
    id: 'semicircle',
    kind: 'adventure',
    at: [530, 320],
    load: () => import('./semicircle/script.js'),
  },
  { id: 'corners-in-space', kind: 'question', at: [585, 170], from: 'semicircle' },

  {
    id: 'last-pebble',
    kind: 'adventure',
    at: [790, 290],
    load: () => import('./last-pebble/script.js'),
  },
  { id: 'pebble-misere', kind: 'question', at: [880, 150], from: 'last-pebble' },

  { id: 'cube-diagonal', kind: 'question', far: true, at: [330, 470] },
  { id: 'primes-forever', kind: 'question', far: true, at: [690, 480] },
  { id: 'infinity', kind: 'question', far: true, at: [910, 440] },
  { id: 'sphere-triangle', kind: 'question', far: true, at: [105, 330] },
];
