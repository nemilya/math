# Writing a new adventure

*Русская версия: [ru/AUTHORING.md](ru/AUTHORING.md)*

An adventure is one beautiful idea that the child finds by themselves, with their hands,
together with Lumo. 5–10 minutes. Read [VISION.md](VISION.md) and [KEEPER.md](KEEPER.md)
first — they hold the spirit of the project and the character's voice.

## 1. Start with a question, not a topic

Bad: "Topic: area of a triangle".
Good: "How much of the box does the triangle take up?"

A good question:

* makes sense to a five-year-old without a single term;
* has an answer that is *not* obvious (or obvious, but not why);
* has a beautiful "why" — one idea, one line, one turn;
* leads to the next question, one we don't have an answer to.

Sources: Lockhart's essay (problems straight from the text — see the idea bank in
[ROADMAP.md](ROADMAP.md)), the history of mathematics, games, patterns in nature.

## 2. Sketch the dramaturgy

Almost every adventure goes through these steps:

1. **The world.** Lumo draws a simple picture with light. ("Here is a box. A triangle lives in it.")
2. **Question and guess.** The child picks a picture-guess. Every guess is "interesting".
3. **Play.** The child moves something and notices a pattern.
4. **Stuck, and hints.** Lumo gives time to think; hints come one at a time, only on silence.
5. **The idea ("aha!").** One move makes everything obvious. Lumo flashes.
6. **Why.** A short explanation in Lumo's words; Lumo remembers the child's guess.
7. **Testing by freedom.** "Move it however you like — does the trick always work?"
8. **The crack.** A case where the idea breaks → a new question for the sky (`s.unlock`).
9. **The child's explanation.** `s.record(...)` — "tell it in your own words".

## 3. Files

```
web/content/my-adventure/
  script.js        the script
  lines.en.js      lines (English is the main language)
  lines.ru.js      lines in another language
```

A star in `web/content/stars.js`:

```js
{ id: 'my-adventure', kind: 'adventure', at: [x, y], first: ['hello', 'look'], load: () => import('./my-adventure/script.js') },
{ id: 'my-open-question', kind: 'question', at: [x, y], from: 'my-adventure' },
```

`first` — the keys of the adventure's opening lines (2–3, in the order they are said): they are
fetched as soon as the child taps the star, so after "play" Lumo speaks at once. `make check`
verifies they exist.

A name and a question in `web/content/sky/lines.<lang>.js`:

```js
'my-adventure.name': 'A short name. And the question in one sentence?',
'my-open-question.ask': 'An open question that appears after the adventure.',
```

Then `make check` and `make voice`.

## 4. Script template

```js
export default async function myAdventure(s) {
  const g = s.layer();
  const shape = s.el('circle', { cx: 500, cy: 300, r: 120, class: 'line' }, g);
  shape.style.display = 'none';     // not on screen before Lumo talks about it

  // "Here is a circle." — the circle is drawn while he says it, not after
  await s.sayWhile('hello', async () => {
    shape.style.display = '';
    await s.draw(shape, 1000);
  });

  const handle = s.handle(g);
  handle.moveTo(620, 300);
  let moved = 0;
  // make it draggable *before* Lumo says "pull it" — children grab straight away
  const d = s.drag(handle, { move: (p) => { moved++; handle.moveTo(p.x, p.y); } });
  await s.say('pull');
  await s.until(() => moved > 30, { hints: ['pull.hint'] });
  d.stop();

  s.celebrate(500, 300);
  await s.say('aha');
  s.complete();                     // the star lights up
  s.unlock('my-open-question');     // a new question in the sky
  await s.record('my-adventure', { prompt: 'explain' });
}
```

**Show what Lumo says, as he says it.** A picture already on screen while Lumo announces it
("let's put a point…" over a finished triangle), or drawn only after he has finished, feels
off. Keep the parts hidden until their line, and draw them inside `sayWhile`; for a long line,
place the parts with `s.wait()` at the words they belong to (the pauses in the clip:
`ffmpeg -i clip.mp3 -af silencedetect=n=-35dB:d=0.12 -f null -`) — a middle ground for
all languages.

### Scene vocabulary

| Method | What it does |
|---|---|
| `say(key)` | Lumo says a line; waits until it ends. An empty line (no version for this age) is skipped |
| `sayWhile(key, async () => …)` | Lumo says a line **and shows what it says**: the function starts with the sound itself (not while the clip is loading), so `s.wait(ms)` inside counts from the first word. Waits for both |
| `talk([keys])` | speaks "in the background"; the next `talk` or a tap interrupts |
| `layer()`, `el(tag, attrs, parent)` | SVG layers and elements (coordinates 1000×600) |
| `draw(el, ms)` | draw a line "by hand" |
| `animate(el, prop, from, to, ms)`, `fadeIn`, `fadeOut`, `tween(ms, fn)` | animations |
| `handle(parent)` | a glowing point that can be dragged (`moveTo`, `show`) |
| `drag(el, { start, move, end })` | dragging; returns `{ active, stop() }` |
| `tap(targets)`, `tapPoint(area)` | wait for a tap (on an element / at a point) |
| `choose([{ id, icon \| svg }], { reply })` | picture buttons at the bottom; returns `id`. `reply: (id) => \`guess.${id}\`` — the line Lumo answers with: all of them are fetched while the child decides |
| `until(pred, { hints })` | wait until a condition holds |
| `wait(ms)` | pause |
| `celebrate(x, y)`, `sparkle(x, y)`, `mood('thinking')` | Lumo's emotions |
| `record(starId, { prompt })` | the child records an explanation (skipped if the microphone is off/unavailable) |
| `help(fn)` | a "?" button in the top-left corner for this scene — e.g. show the rules of a game again, with pictures |
| `micAvailable()` | can the child record here? — to show or hide a microphone button |
| `complete()`, `unlock(id)` | light the star, open a question |
| `remember(k, v)`, `recall(k)` | remember something about the child (e.g. their guess) |
| `age` | `'small' \| 'middle' \| 'big'` |

Style classes: `line`, `shape warm|cool|mint|ghost`, `piece warm|cool`, `cut`,
`wedge right|wide|narrow`, `paper`, `diag-a|diag-b`, `dot` — see `style.css`.

## 5. Lines

* One sentence — one thought. A long line = several short ones.
* No terms until they are needed. No "right/wrong".
* **No grammatical gender for the child** (see [KEEPER.md](KEEPER.md#grammar-important-for-russian)).
* Repeated situations — an array of variants.
* Each hint is a step, not the answer: first "where to look", then "what to try".
* **Age versions** where the words should differ:

```js
halves: {
  small: 'The triangle cuts each part slantwise — exactly in half.',
  middle: 'In each part, a side of the triangle runs slantwise, corner to corner. It cuts that part exactly in half.',
  big: 'Now each side of the triangle is a diagonal of a small rectangle. And a diagonal cuts a rectangle exactly in half.',
},
formula: { big: "By the way, that's where the famous rule comes from..." },   // only for 10–12
```

  Little ones: shorter, simpler, a bit of magic. Older ones: the real names and a bit of
  history. The *idea* and the order stay the same.

Check: `make check`. Voice: `make voice`.

## 6. "Spirit of the book" checklist

- [ ] The child can go through it all without being able to read.
- [ ] The question is asked before the answer is given; there is room for a guess.
- [ ] The child makes the key move themselves (not watches Lumo make it).
- [ ] There is a "why", not only a "what".
- [ ] No "wrong", no points, no timer anywhere.
- [ ] At the end — a new open question and an invitation to explain in one's own words.
- [ ] If a person or history is mentioned, it's a living story, not a date.
- [ ] It works with a finger on a tablet.
- [ ] Lines exist for every language; age versions read naturally for 5 and for 11.
