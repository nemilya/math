// Spoken lines live in content/<namespace>/lines.<lang>.js.
// A line is addressed as "namespace:key". A value may be a string or an array of
// variants — Lumo picks one at random so he does not sound like a recording.

export const LANGS = [
  { id: 'ru', name: 'Русский', bcp: 'ru-RU' },
  { id: 'en', name: 'English', bcp: 'en-US' },
];

const FALLBACK = ['en', 'ru'];

export function detectLang() {
  const supported = LANGS.map((l) => l.id);
  for (const l of navigator.languages || [navigator.language || '']) {
    const id = l.slice(0, 2).toLowerCase();
    if (supported.includes(id)) return id;
  }
  return 'ru';
}

export class I18n {
  constructor() {
    this.lang = 'ru';
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

  line(full) {
    const i = full.indexOf(':');
    const ns = full.slice(0, i);
    const key = full.slice(i + 1);
    for (const lang of this.chain()) {
      const v = this.tables[lang]?.[ns]?.[key];
      if (v == null) continue;
      if (lang !== this.lang) console.warn(`[i18n] ${full} missing in "${this.lang}", using "${lang}"`);
      if (!Array.isArray(v)) return { text: v, id: full };
      let idx = Math.floor(Math.random() * v.length);
      if (v.length > 1 && idx === this.lastPick[full]) idx = (idx + 1) % v.length;
      this.lastPick[full] = idx;
      return { text: v[idx], id: `${full}.${idx}` };
    }
    console.warn(`[i18n] unknown line ${full}`);
    return { text: '', id: full };
  }
}
