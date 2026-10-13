// First launch: one short screen for a grown-up — language, the child's age, subtitles.
// Everything is preselected (browser language, 7–9, no subtitles), so "Start" alone is fine.
// It never shows again; the same settings live behind the gear.

import { LANGS, AGES } from './i18n.js';
import { h } from './ui.js';

const T = {
  en: {
    title: 'Before we start',
    lead: 'Three quick choices for a grown-up. You can change them any time with the gear in the corner.',
    lang: 'Language',
    age: "Child's age",
    ages: {
      small: ['4–6', 'simple words, short games'],
      middle: ['7–9', 'plain words, a little wonder'],
      big: ['10–12', 'real terms and a bit of history'],
    },
    cc: 'Subtitles',
    ccNote: 'Show the text of what Lumo says. The child needs no reading — everything is spoken.',
    start: 'Start',
  },
  ru: {
    title: 'Перед началом',
    lead: 'Три коротких вопроса для взрослого. Всё можно поменять в любой момент шестерёнкой в углу.',
    lang: 'Язык',
    age: 'Возраст ребёнка',
    ages: {
      small: ['4–6', 'простые слова, короткие игры'],
      middle: ['7–9', 'понятные слова, немного удивления'],
      big: ['10–12', 'настоящие термины и немного истории'],
    },
    cc: 'Субтитры',
    ccNote: 'Показывать текст того, что говорит Лумо. Ребёнку читать не нужно — всё звучит голосом.',
    start: 'Начать',
  },
};

// Three little lights, one per age band — bigger and brighter as the child grows.
const glow = (n) =>
  `<svg viewBox="0 0 40 40" aria-hidden="true">${[0, 1, 2]
    .map((i) => `<circle cx="${8 + i * 12}" cy="22" r="${3 + i * 1.6}" fill="${i < n ? '#f0a93b' : '#e3dccb'}"/>`)
    .join('')}</svg>`;

export function runSetup({ host, i18n, store, onLang }) {
  return new Promise((resolve) => {
    const render = () => {
      const L = T[i18n.lang] || T.en;
      const pick = (items, current, choose, cls = 'seg') =>
        h(
          'div',
          { class: cls, role: 'group' },
          items.map(([id, ...label]) =>
            h(
              'button',
              { type: 'button', class: id === current ? 'on' : '', 'aria-pressed': String(id === current), onclick: () => choose(id) },
              ...label,
            ),
          ),
        );

      const ageButtons = h(
        'div',
        { class: 'ages', role: 'group' },
        AGES.map((a, i) => {
          const b = h(
            'button',
            { type: 'button', class: a === store.data.age ? 'on' : '', 'aria-pressed': String(a === store.data.age), onclick: () => (store.set('age', a), render()) },
            h('span', {}),
            h('b', {}, L.ages[a][0]),
            h('small', {}, L.ages[a][1]),
          );
          b.firstChild.innerHTML = glow(i + 1);
          return b;
        }),
      );

      host.replaceChildren(
        h(
          'div',
          { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': L.title },
          h('header', {}, h('h2', {}, L.title)),
          h('p', { class: 'lead' }, L.lead),
          h('section', {}, h('h3', {}, L.lang), pick(LANGS.map((l) => [l.id, l.name]), i18n.lang, async (id) => {
            const loading = onLang(id); // switches i18n.lang at once; voices load in the background
            render();
            await loading;
          })),
          h('section', {}, h('h3', {}, L.age), ageButtons),
          h(
            'section',
            {},
            h(
              'label',
              { class: 'row toggle', for: 'setup-cc' },
              h('span', { class: 'txt' }, h('b', {}, L.cc), h('small', {}, L.ccNote)),
              h('input', { type: 'checkbox', id: 'setup-cc', checked: !!store.data.cc, onchange: (e) => store.set('cc', e.target.checked) }),
            ),
          ),
          h('section', {}, h('button', { type: 'button', class: 'start', onclick: finish }, L.start)),
        ),
      );
    };

    const finish = () => {
      store.set('setupDone', true);
      host.hidden = true;
      resolve();
    };

    host.classList.add('sheet');
    host.hidden = false;
    render();
    host.querySelector('.start')?.focus({ preventScroll: true });
  });
}
