# Roadmap

*Русская версия: [ru/ROADMAP.md](ru/ROADMAP.md)*

The portal is meant to **keep growing**: the engine is stable, the sky keeps filling up.
The stages below are not "versions" but directions of growth; many can go in parallel.

## Stage 0 — prototype (done)

- [x] Concept, character, principles ([VISION](VISION.md), [KEEPER](KEEPER.md))
- [x] Scene engine: voice, hints on silence, dragging, cancellation, animations
- [x] Two languages (English is the main one, Russian), completeness check of all lines
- [x] Sky of questions: adventures, open questions, faraway stars, the child's own questions
- [x] Recording explanations and ideas in the child's voice (kept on the device only)
- [x] Three adventures straight from Lockhart's essay:
  - **Triangle in a box** — guess → play → "magic cut" → why half → the crack
  - **The corner in a semicircle** — the corner is always square → check with a paper corner →
    a student's idea (half a turn → rectangle) → free play off the circle
  - **The last pebble** — Nim, the secret "four is a trap", generalising to a new rule

## Stage 1 — a real voice and the first children

- [x] **Quality voice**: every line voiced with Gemini TTS via OpenRouter, checked by transcription (`make voice`)
- [x] **Three age bands** (4–6, 7–9, 10–12): Lumo's words change, the ideas stay
- [x] **Grown-ups' panel**: age, hints, subtitles, microphone, the discovery album, start over
- [x] **Calm hints**: each hint once, can be switched off
- [x] **Hosting folder**: `make dist` → `dist/` + `dist.zip`, works from any subfolder
- [ ] **Listen to the voice and tune it**: choose between voices, adjust the character brief, re-voice odd lines (`--redo`)
- [ ] **Tests with children.** 5–10 children aged 5–10, a grown-up nearby, we watch silently:
      where they get stuck, what they understand without words, where it's boring, where the "aha!" is.
      This is the main source of changes.
- [ ] **PWA**: install on a tablet, work offline.
- [ ] Accessibility: keyboard control, a large mode, speech speed.

## Stage 2 — the sky grows

Goal: 15–25 adventures woven into constellations. Idea bank below.

- [ ] Constellations by "flavour": **Shapes**, **Numbers and patterns**, **Games with a secret**,
      **Infinity**, **Stories of people**.
- [ ] Adventures answering the open questions already hanging in the sky.
- [ ] A richer discovery album for parents: the child's stars and voice explanations over time —
      without percentages or grades.

## Stage 3 — stories and "videos"

- [ ] **Stories of people**, told by Lumo: Babylonian tablets, Archimedes and the circle
      (method of exhaustion), Pythagoras and the diagonal of a square, young Gauss and the sum of
      numbers, Euler and the bridges of Königsberg. Not dates — dramas of ideas.
- [ ] Animated "cartoons" made with the same scene engine (voice + SVG animation, can be paused
      and interrupted) — in every language at once.
- [ ] A `s.video(src)` primitive for real footage: patterns in nature (honeycombs, sunflowers,
      snowflakes, shells), paper models.

## Stage 4 — Lumo listens

- [ ] Recognising the child's speech and Lumo replying to the *content* of an explanation: a
      follow-up question, "what if...?", delight at a good idea. Principle: Lumo doesn't grade,
      he continues the conversation.
- [ ] Strict privacy: explicit parental consent, processing on the device or without storage,
      no training on children's voices.

## Stage 5 — community

- [ ] An open adventure format, an author guide ([AUTHORING](AUTHORING.md)), reviews against
      the "spirit of the book" checklist.
- [ ] A visual scene editor for teachers.
- [ ] New languages by translators (lines files + voice).
- [ ] "Class sky": a teacher shows an adventure on a big screen, the class argues.

---

## Adventure idea bank

Sources: Lockhart himself (problems and examples from the essay), the history of mathematics, games.

### Straight from the essay
| Question | Idea / "aha" |
|---|---|
| A pyramid in a cube — how much space? (the end of the essay) | Cut the cube into 3 equal pyramids |
| A slanted triangle (the top vertex past the box) | Complete a big triangle and subtract the small one |
| I know the sum and the difference of two numbers. What are the numbers? (Babylonians) | Pebbles in two piles: "equal + the extra" |
| 5 groups of 7 — the same as 7 groups of 5? | Turn a rectangle of pebbles |
| A world where 1 + 1 = 0 (arithmetic mod 2) | Odd and even, a light switch |
| How to measure a circle? (Eudoxus, Archimedes) | Inscribed polygons that "eat up" the circle |
| How many ways to tile a plane symmetrically? | Tiles, mirrors and rotations |
| How long is the diagonal of a cube? | Diagonal of a square → diagonal of a cube |
| Do primes go on forever? | Pebbles that don't make a rectangle |
| Is infinity a number? | Hilbert's hotel, pairing children and chairs |
| A triangle on a ball: bigger angles? | A triangle with three right angles on a globe |
| Negative exponents (older children) | Continue the "divide by 2" pattern to the left |

### Games with a secret
Nim (several piles), Sprouts, Hex, "taking the last pebble loses", noughts and crosses (why a draw?),
"guess the number" (halving).

### Patterns around us
Why honeycombs are hexagons; sunflower spirals; snowflake symmetry; how many ways to fold a sheet
of paper; triangular and square numbers from pebbles (the sum of odd numbers is a square!).
