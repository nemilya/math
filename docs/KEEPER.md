# Lumo — the keeper of questions

*Русская версия: [ru/KEEPER.md](ru/KEEPER.md)*

![Lumo](img/lumo.png)

## Who he is

Lumo is a small warm light with a little spark on an antenna. He lives in the night sky and
**keeps questions** — the most interesting questions in the world. He doesn't keep answers:
he believes answers can't be handed out, only found.

The spark on his antenna is a **point** — where all geometry begins. And Lumo glows brightest
at the moment someone next to him *suddenly sees* an idea — as Lockhart puts it,
"I couldn't see, and then all of a sudden I could."

## Character

* **Curious.** His favourite words: "I wonder...", "hmm...", "what if...?"
* **Honest.** Calmly says "I don't have an answer yet" and "looks like we need a new idea".
  The open questions in the sky are his honesty.
* **Delighted by other people's ideas.** Every guess is "interesting", every attempt is a
  step. Someone else's idea (a student's, the child's) matters more to him than his own.
* **Not an examiner and not a teacher.** A companion who plays along. Sometimes he loses at
  pebbles, sometimes he plays a trick and then admits it.
* **Patient.** He offers a hint once and then waits. He never nags.
* **A little sleepy and warm.** The project begins with the child waking Lumo up.

## How he speaks

* Short sentences. One thought — one sentence. (This also matters for speech synthesis.)
* Lively spoken language, no terms until they are needed: "a corner like a page", "a little box",
  "from corner to corner".
* Variants: the same situations are voiced differently
  (`['Your turn.', 'Now you.', 'Over to you.']`), so he doesn't sound like an answering machine.
* Never: "wrong", "mistake", "well done, 5 points", "faster", "you're behind".
* Instead: "interesting guess", "can't see it yet — one more try?", "a brave idea", "wow!"

### Good / bad

| Not like this | Like this |
|---|---|
| "Incorrect. Try again." | "Hmm. Two pieces, but I still can't see the answer. Shall we try somewhere else?" |
| "The area of a triangle is half the base times the height." | "There is just as much outside as inside. So — exactly half!" (and for older children: "that's where the famous rule comes from") |
| "Theorem: an inscribed angle subtending a diameter is a right angle." | "It looks like the circle is the home of all the square corners above this line." |
| "Great! +10 points!" | (Lumo flashes with light and chimes) "There is our answer!" |

## Lumo grows with the child

Grown-ups choose the child's age in the settings (the gear button). Lumo's lines can have a
version for each age band:

| Age | How Lumo talks |
|---|---|
| 4–6 (`small`) | shorter, simpler, more "magic" ("a magic triangle", "a little house for square corners"); shorter games |
| 7–9 (`middle`) | the base version: plain words, a little wonder |
| 10–12 (`big`) | real names when they help (diagonal, parallelogram, right angle, multiples), a bit of history (Thales, Euclid, the seventh-grader who found the proof), where the school formula comes from |

The ideas and the order of the adventure stay the same — only the words change.

## Grammar (important for Russian)

* Lumo is **he** («я задремал», «сколько бы я ни взял»).
* We address the child **without grammatical gender**: present tense and impersonal forms.
  Not «ты угадал/угадала» but «твоя догадка была...»; not «ты победил» but «победа твоя!»;
  not «ты нашёл» but «нашлось!». This rule is for every author of lines.
* For other languages: likewise avoid forms that need the child's gender.

## States (animations)

| State | When | Looks like |
|---|---|---|
| asleep | start screen | eyes closed, "z-z-z", dim light |
| talking | while a line plays | the mouth moves |
| thinking | considering a move, "hmm..." | eyes up, the spark blinks fast |
| listening | the child is recording | pink spark, the light "breathes" |
| flash | the child saw an idea, a star lit up | a wave of light + a chime |
| watching | always | pupils follow the child's finger |

## Voice

Warm, unhurried, slightly above average pitch, with a smile — Gemini TTS voice "Puck" with
a written character brief (`voice.config.json`). Every line in every language and age band
is synthesised once and stored as a file (see [ARCHITECTURE.md](ARCHITECTURE.md#voice)).

## The world's look

A night sky, drawing **with light**: lines glow as if Lumo were drawing with them.
Warm yellow — "inside / found", cool blue — "outside / other", mint — "a square corner / yours".
No small details and no text on screen.
