// The grown-ups' panel (the gear button). This is the only place in the portal with
// words to read: the child never needs it.

import { AGES } from './i18n.js';
import { voices } from './recorder.js';
import { h } from './ui.js';

const T = {
  ru: {
    title: 'Для взрослых',
    close: 'Закрыть',
    age: 'Возраст ребёнка',
    ages: { small: '4–6 лет', middle: '7–9 лет', big: '10–12 лет' },
    ageNote:
      'Лумо подбирает слова под возраст: малышам — проще и короче, старшим — настоящие названия (диагональ, прямой угол, параллельные) и немного истории.',
    hints: 'Подсказки',
    hintsNote: 'Если ребёнок долго ничего не делает, Лумо мягко подсказывает. Каждая подсказка звучит один раз.',
    cc: 'Субтитры',
    ccNote: 'Показывать текст того, что говорит Лумо.',
    mic: 'Рассказать своими словами',
    micNote:
      'В конце приключения Лумо предлагает объяснить идею вслух. Ребёнок слышит свою запись, а вы можете послушать её в альбоме.',
    album: 'Альбом открытий',
    albumNote:
      'Объяснения, идеи и вопросы ребёнка. Хранятся только в этом браузере: никуда не отправляются и ничем не анализируются. Их слушаете вы — и это лучший повод поговорить.',
    empty: 'Пока пусто. Записи появятся, когда ребёнок что-нибудь расскажет Лумо.',
    mine: 'Свой вопрос',
    play: 'Слушать',
    stop: 'Стоп',
    del: 'Удалить',
    reset: 'Начать сначала',
    resetNote: 'Звёзды погаснут, свои вопросы ребёнка исчезнут с неба. Записи в альбоме останутся.',
    resetYes: 'Да, начать сначала',
  },
  en: {
    title: 'For grown-ups',
    close: 'Close',
    age: "Child's age",
    ages: { small: '4–6 years', middle: '7–9 years', big: '10–12 years' },
    ageNote:
      'Lumo picks words to suit the age: simpler and shorter for little ones, real names (diagonal, right angle, parallel) and a bit of history for older children.',
    hints: 'Hints',
    hintsNote: 'If the child does nothing for a while, Lumo gives a gentle hint. Each hint is said only once.',
    cc: 'Subtitles',
    ccNote: 'Show the text of what Lumo says.',
    mic: 'Explain in their own words',
    micNote:
      'At the end of an adventure Lumo invites the child to explain the idea out loud. The child hears the recording back, and you can listen to it in the album.',
    album: 'Discovery album',
    albumNote:
      "The child's explanations, ideas and questions. They stay in this browser only: never uploaded, never analysed. They are for you to hear — and a great reason to talk.",
    empty: 'Empty for now. Recordings appear when the child tells Lumo something.',
    mine: 'Own question',
    play: 'Listen',
    stop: 'Stop',
    del: 'Delete',
    reset: 'Start over',
    resetNote: "Stars go dark and the child's own questions leave the sky. Album recordings stay.",
    resetYes: 'Yes, start over',
  },
};


export function createSettings({ host, i18n, store, onChange }) {
  let player = null;
  const t = () => T[i18n.lang] || T.en;

  const stopPlayer = () => {
    player?.audio.pause();
    player?.button && (player.button.textContent = t().play);
    if (player) URL.revokeObjectURL(player.url);
    player = null;
  };

  const close = () => {
    stopPlayer();
    host.hidden = true;
    document.body.classList.remove('settings-open');
  };

  const segmented = (items, current, pick) =>
    h(
      'div',
      { class: 'seg', role: 'group' },
      items.map(([id, label]) =>
        h('button', { class: id === current ? 'on' : '', 'aria-pressed': String(id === current), onclick: () => pick(id) }, label),
      ),
    );

  const toggle = (id, title, note, key) =>
    h(
      'label',
      { class: 'row toggle', for: id },
      h('span', { class: 'txt' }, h('b', {}, title), h('small', {}, note)),
      h('input', {
        type: 'checkbox',
        id,
        checked: store.data[key] !== false,
        onchange: (e) => {
          store.set(key, e.target.checked);
          onChange(key);
        },
      }),
    );

  const starName = (id) => {
    if (id.startsWith('mine-')) return t().mine;
    const name = i18n.line(`sky:${id}.name`).text || i18n.line(`sky:${id}.ask`).text;
    return name.split(/[.?!]/)[0];
  };

  async function album() {
    const list = h('div', { class: 'album' });
    const recs = (await voices.all()).reverse();
    if (!recs.length) list.append(h('p', { class: 'muted' }, t().empty));
    const fmt = new Intl.DateTimeFormat(i18n.lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    for (const r of recs) {
      const play = h('button', {
        class: 'small-btn',
        onclick: () => {
          const same = player?.id === r.id;
          stopPlayer();
          if (same) return;
          const url = URL.createObjectURL(r.blob);
          const audio = new Audio(url);
          player = { id: r.id, audio, url, button: play };
          play.textContent = t().stop;
          audio.onended = stopPlayer;
          audio.play().catch(stopPlayer);
        },
      }, t().play);
      const del = h('button', {
        class: 'small-btn quiet',
        onclick: async () => {
          if (player?.id === r.id) stopPlayer();
          await voices.remove(r.id);
          item.remove();
          onChange('album');
        },
      }, t().del);
      const item = h('div', { class: 'rec' }, h('span', { class: 'txt' }, h('b', {}, starName(r.star)), h('small', {}, fmt.format(r.at))), play, del);
      list.append(item);
    }
    return list;
  }

  async function render() {
    const L = t();
    const resetBox = h('div', { class: 'reset' });
    const askReset = () => {
      resetBox.replaceChildren(
        h('p', { class: 'muted' }, L.resetNote),
        h('button', { class: 'danger', onclick: () => (store.resetProgress(), close(), onChange('reset')) }, L.resetYes),
      );
    };
    resetBox.append(h('button', { class: 'quiet', onclick: askReset }, L.reset));

    const panel = h(
      'div',
      { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': L.title },
      h('header', {}, h('h2', {}, L.title), h('button', { class: 'close', 'aria-label': L.close, onclick: close }, '×')),
      h('section', {}, h('h3', {}, L.age), segmented(AGES.map((a) => [a, L.ages[a]]), store.data.age, (a) => {
        store.set('age', a);
        onChange('age');
        render();
      }), h('p', { class: 'muted' }, L.ageNote)),
      h('section', {}, toggle('set-hints', L.hints, L.hintsNote, 'hints'), toggle('set-cc', L.cc, L.ccNote, 'cc'), toggle('set-mic', L.mic, L.micNote, 'mic')),
      h('section', {}, h('h3', {}, L.album), h('p', { class: 'muted' }, L.albumNote), await album()),
      h('section', {}, resetBox),
    );
    host.replaceChildren(panel);
    host.classList.add('sheet');
  }

  host.addEventListener('click', (e) => e.target === host && close());
  window.addEventListener('keydown', (e) => e.key === 'Escape' && !host.hidden && close());

  return {
    async open() {
      await render();
      host.hidden = false;
      document.body.classList.add('settings-open');
    },
    close,
  };
}
