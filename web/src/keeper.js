// Lumo — the keeper of questions. A small living light that glows brighter
// whenever someone suddenly *sees* an idea.

const SVG = `
<svg class="lumo" viewBox="0 0 200 230" aria-hidden="true">
  <defs>
    <radialGradient id="lumo-aura">
      <stop offset="0" stop-color="#ffd76a" stop-opacity=".55"/>
      <stop offset="1" stop-color="#ffd76a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="lumo-body" cx="40%" cy="35%" r="70%">
      <stop offset="0" stop-color="#fff7da"/>
      <stop offset=".55" stop-color="#ffd36b"/>
      <stop offset="1" stop-color="#f09a4c"/>
    </radialGradient>
  </defs>
  <circle class="aura" cx="100" cy="135" r="98" fill="url(#lumo-aura)"/>
  <g class="float">
    <path d="M100 74 C 98 54, 110 42, 121 32" fill="none" stroke="#ffd36b" stroke-width="5" stroke-linecap="round"/>
    <circle class="spark" cx="122" cy="29" r="9" fill="#fffbe8"/>
    <path d="M100 72 C 146 72, 168 106, 166 141 C 164 179, 136 202, 100 202 C 64 202, 36 179, 34 141 C 32 106, 54 72, 100 72 Z" fill="url(#lumo-body)"/>
    <g class="eye" transform="translate(77 130)">
      <g class="lid">
        <ellipse rx="14" ry="17" fill="#fff"/>
        <g class="pupil"><circle r="8" fill="#2b2140"/><circle cx="3" cy="-3" r="2.6" fill="#fff"/></g>
      </g>
    </g>
    <g class="eye" transform="translate(123 130)">
      <g class="lid">
        <ellipse rx="14" ry="17" fill="#fff"/>
        <g class="pupil"><circle r="8" fill="#2b2140"/><circle cx="3" cy="-3" r="2.6" fill="#fff"/></g>
      </g>
    </g>
    <path class="closed" d="M64 132 Q77 141 90 132 M110 132 Q123 141 136 132" stroke="#2b2140" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="60" cy="158" r="9" fill="#ff8a7a" opacity=".45"/>
    <circle cx="140" cy="158" r="9" fill="#ff8a7a" opacity=".45"/>
    <path class="smile" d="M87 162 Q100 176 113 162" stroke="#5a2b3a" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <ellipse class="mouth" cx="100" cy="167" rx="9" ry="5" fill="#5a2b3a"/>
    <g class="thought" aria-hidden="true">
      <circle cx="150" cy="60" r="3.5"/>
      <circle cx="161" cy="45" r="5.5"/>
      <ellipse cx="183" cy="22" rx="25" ry="16"/>
      <circle class="d" cx="172" cy="22" r="3.4"/>
      <circle class="d" cx="183" cy="22" r="3.4"/>
      <circle class="d" cx="194" cy="22" r="3.4"/>
    </g>
  </g>
  <g class="zzz" fill="#cfd6ff" font-family="system-ui" font-weight="700">
    <text x="150" y="80" font-size="22">z</text>
    <text x="162" y="62" font-size="26">z</text>
    <text x="176" y="42" font-size="30">z</text>
  </g>
</svg>`;

export function createKeeper(host) {
  host.innerHTML = SVG;
  const pupils = [...host.querySelectorAll('.pupil')];
  let lookOverride = null;
  let pondering = false;

  const look = (dx, dy) => {
    for (const p of pupils) p.setAttribute('transform', `translate(${dx.toFixed(1)} ${dy.toFixed(1)})`);
  };

  // Lumo's eyes follow the child's finger / mouse — a small thing that makes him feel alive.
  window.addEventListener('pointermove', (e) => {
    if (lookOverride || pondering) return;
    const r = host.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * 0.55;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 300) * 4.5;
    look((dx / d) * k, (dy / d) * k);
  });

  const flash = (cls, ms) => {
    host.classList.remove(cls);
    void host.offsetWidth; // restart the animation
    host.classList.add(cls);
    setTimeout(() => host.classList.remove(cls), ms);
  };

  return {
    el: host,
    setTalking: (on) => host.classList.toggle('talking', on),
    sleep: (on) => host.classList.toggle('asleep', on),
    dock: (on) => host.classList.toggle('center', !on),
    // "Hmm..." — a thought bubble and eyes up, while something he needs is still on its way.
    ponder(on) {
      pondering = on;
      host.classList.toggle('pondering', on);
      if (!lookOverride) look(on ? 2.5 : 0, on ? -5 : 0);
    },
    glow: () => flash('glow', 1300),
    wiggle: () => flash('wiggle', 520),
    mood(m) {
      host.classList.remove('thinking', 'listening');
      if (m) host.classList.add(m);
      lookOverride = m === 'thinking' ? [3, -5] : null;
      if (lookOverride) look(...lookOverride);
    },
  };
}
