// Icon set. Everything a child must press is a picture, never a word.
// All icons use viewBox 0 0 100 100 and currentColor.

const svg = (body) =>
  `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const icons = {
  home: svg('<path d="M14 50 L50 18 L86 50"/><path d="M26 42 V84 H74 V42"/><path d="M43 84 V62 H57 V84"/>'),
  play: svg('<path d="M34 20 L80 50 L34 80 Z" fill="currentColor"/>'),
  next: svg('<path d="M18 50 H80"/><path d="M56 26 L80 50 L56 74"/>'),
  check: svg('<path d="M18 52 L40 74 L84 28"/>'),
  replay: svg('<path d="M78 50 A28 28 0 1 1 64 26"/><path d="M58 12 L68 27 L52 34"/>'),
  mic: svg('<rect x="36" y="12" width="28" height="48" rx="14" fill="currentColor" stroke="none"/><path d="M24 48 A26 26 0 0 0 76 48"/><path d="M50 74 V88"/><path d="M36 88 H64"/>'),
  stop: svg('<rect x="28" y="28" width="44" height="44" rx="8" fill="currentColor" stroke="none"/>'),
  listen: svg('<path d="M16 40 H32 L52 22 V78 L32 60 H16 Z" fill="currentColor" stroke-width="5"/><path d="M64 36 A18 18 0 0 1 64 64"/><path d="M74 26 A32 32 0 0 1 74 74"/>'),
  // gear: Feather Icons "settings" (MIT, © 2013-2017 Cole Bemis)
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  bulb: svg('<path d="M50 12 A26 26 0 0 0 34 58 C38 62 38 66 38 72 H62 C62 66 62 62 66 58 A26 26 0 0 0 50 12 Z"/><path d="M40 84 H60"/><path d="M44 94 H56"/>'),
  hand4: svg('<circle cx="22" cy="50" r="10" fill="currentColor"/><circle cx="41" cy="50" r="10" fill="currentColor"/><circle cx="60" cy="50" r="10" fill="currentColor"/><circle cx="79" cy="50" r="10" fill="currentColor"/><path d="M14 74 H86" stroke-width="6"/>'),
};

export function button(icon, cls = '', label = '') {
  const b = document.createElement('button');
  b.className = `btn ${cls}`.trim();
  b.innerHTML = icons[icon] || icon;
  if (label) b.setAttribute('aria-label', label);
  return b;
}

// Tiny DOM builder for the grown-ups' screens: h('button', { class: 'x', onclick }, 'text', child…)
export const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat().filter((k) => k != null));
  return e;
};
