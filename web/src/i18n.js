// Spoken lines live in content/<namespace>/lines.<lang>.js.
// A line is addressed as "namespace:key". A value may be:
//   'text'                         — the same for everyone
//   ['a', 'b']                     — variants: Lumo picks one, so he doesn't sound like a recording
//   { small, middle, big }         — versions for the child's age (4–6, 7–9, 10–12); a missing age
//                                    falls back to `middle`, and a line with no version for this age
//                                    and no `middle` is simply not said (e.g. a bit of history only for big kids)
// Voice ids (audio files) follow the same shape: ns:key, ns:key.1, ns:key~big, ns:key~big.1.

export const LANGS = [
  { id: 'en', name: 'English', bcp: 'en-US' },
  { id: 'ru', name: 'Русский', bcp: 'ru-RU' },
];

export const DEFAULT_LANG = 'en';

const FALLBACK = ['en', 'ru'];

export const AGES = ['small', 'middle', 'big'];

// Language, as in nemilya/education: ?lang= → the last choice → the browser's language → English.
export function pickLang(fromUrl, saved) {
  const supported = LANGS.map((l) => l.id);
  const browser = (navigator.languages || [navigator.language || '']).map((l) => l.slice(0, 2).toLowerCase());
  return [fromUrl, saved, ...browser].find((l) => supported.includes(l)) || DEFAULT_LANG;
}

export class I18n {
  constructor() {
    this.lang = 'ru';
    this.age = 'middle';
    this.tables = {}; // lang -> ns -> {key: text}
    this.lastPick = {};
  }

  chain() {
    return [...new Set([this.lang, ...FALLBACK])];
  }

  async load(ns) {
    await Promise.all(
      this.chain().map(async (lang) => {
        const t = (this.tables[lang] ??= {});
        if (t[ns]) return;
        try {
          t[ns] = (await import(`../content/${ns}/lines.${lang}.js`)).default;
        } catch {
          t[ns] = {};
        }
      }),
    );
  }

  // A namespace's keys in the order of its lines file (≈ the order the script says them).
  keys(ns) {
    return Object.keys(this.tables[this.lang]?.[ns] || {});
  }

  line(full) {
    const i = full.indexOf(':');
    const ns = full.slice(0, i);
    const key = full.slice(i + 1);
    for (const lang of this.chain()) {
      let v = this.tables[lang]?.[ns]?.[key];
      if (v == null) continue;
      if (lang !== this.lang) console.warn(`[i18n] ${full} missing in "${this.lang}", using "${lang}"`);
      let id = full;
      if (typeof v === 'object' && !Array.isArray(v)) {
        const age = v[this.age] != null ? this.age : v.middle != null ? 'middle' : null;
        if (!age) return { text: '', id };
        v = v[age];
        id += `~${age}`;
      }
      if (!Array.isArray(v)) return { text: v, id };
      let idx = Math.floor(Math.random() * v.length);
      if (v.length > 1 && idx === this.lastPick[id]) idx = (idx + 1) % v.length;
      this.lastPick[id] = idx;
      return { text: v[idx], id: `${id}.${idx}` };
    }
    console.warn(`[i18n] unknown line ${full}`);
    return { text: '', id: full };
  }
}
