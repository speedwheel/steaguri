# Steaguri, Atlas, Matematică & Logică — games for kids

Four small browser games, built for a 7-year-old on an older Android tablet.
No framework, no build step at runtime, works offline once loaded, Romanian
and English. The app opens on a menu where you pick the game:

- **Steaguri** — country flags (the original game, below).
- **Atlas** — a world map game: countries, provinces, mountains, rivers, seas.
  The harder of the two.
- **Matematică** — maths for ages 7–9 (clasa I–III): sums, the times table,
  numbers, the clock and money.
- **Logică** — logic for ages 7–10: patterns, the odd one out, grids and
  sudoku, a robot to program, mirrors and cubes, detective puzzles.

## Steaguri: game modes

| Mode | What you do |
|---|---|
| **Ce steag e? / Which flag?** | See a flag, pick the country |
| **Găsește steagul / Find the flag** | See a country, pick its flag from a grid |
| **Ce țară e? / Which country?** | Guess the country from its outline |
| **Desenează / Draw it** | Paint the flag freehand, with a faint guide to trace |
| **Construiește / Build it** | Stack stripes, crosses, discs, stars — scored against the real flag |
| **Provocare / Challenge** | Endless, 3 lives, mixed question types, ramps a level every 5 questions |

## How a run works

The three quiz modes are **one run through the whole world**, not a series of
rounds:

- Every run starts from the easiest flag. **Three mistakes and it is over** —
  the next run starts from the beginning again.
- A clean run keeps going until all **197 countries** (167 in shape mode) have
  been answered. Finishing is winning.
- Difficulty is tied to how far the run has got, so a single run climbs the
  whole ladder from level 1 to level 30.
- The only thing kept between sessions is the **best run** — the high score.
  There is no lifetime XP or account level to grind.

| Point in the run | Countries being asked | Answers | Timer |
|---|---|---|---|
| start | the 24 most famous | 3 | — |
| ~25% | still widely known | 4–5 | — |
| ~50% | into the unfamiliar | 6 | 14s |
| ~75% | obscure | 7 | 8s |
| finish | the hardest flags in the world | 8 | 5s |

The header carries the whole state at a glance: lives left, a bar filling
towards 197, the country count, the current streak and level. Crossing a level
shows a card over the board for two seconds listing what just got harder, then
play continues — the run is never interrupted by a results screen.

Wrong answers are pulled from look-alike flag groups first (Romania/Chad/
Moldova, Indonesia/Monaco, Ireland/Ivory Coast, the Nordic crosses, the pan-Arab
bands), then from neighbours on the difficulty ranking, so they are always
plausible. A missed country is not banked and comes back later in the run.

The countdown can be switched off in Settings. The two drawing modes are short,
never timed and never fail you — they always pay, with stars for accuracy — and
they draw from their own pool of paintable flags.

## Atlas

A real, zoomable world map. Pinch or use the + / − buttons to zoom, drag to
pan, and the target button goes back to where the question started.

| Mode | What you find |
|---|---|
| **Țări / Countries** | All 250 countries *and* territories — Greenland, Svalbard, Western Sahara, Somaliland, Bouvet Island… |
| **Provincii / Provinces** | 349 regions in 48 countries, weird ones included: Kaliningrad, Transnistria, Nakhchivan, Cabinda, Ceuta, Mount Athos, Bir Tawil, Baikonur, the Jewish Autonomous Oblast… plus Romania's counties |
| **Munți / Mountains** | 66 ranges and 63 peaks, from the Alps to the Chersky Range, from Everest to Moldoveanu |
| **Râuri / Rivers** | 73 rivers, Danube to Daugava |
| **Mări și lacuri / Seas & lakes** | 130 oceans, seas, gulfs, straits and lakes |
| **Provocare / Challenge** | All of the above mixed, endless, 3 lives |

Every question is one of two kinds:

- **pick** — the thing is painted yellow; choose its name from the list.
- **find** — the name is given; tap it on the map yourself.

A run works like the flag game's (three mistakes and it is over, easiest
first, 30 levels across the whole list), but climbing also changes the kind of
question: early levels are all "pick", later ones are mostly "find". From level
7 the wrong answers are the target's neighbours (which of these *Russian*
regions is it?), and late "find" questions start zoomed further out.

A miss shows what you tapped in coral, the answer in mint, and how far off you
were in kilometres. Tiny countries get a ring on the map so there is always
something to tap.

Colours mean the same thing everywhere: yellow is the thing being asked, mint
is "here it is", coral is "you picked this".

## Matematică

Five topics and a challenge, each one the same kind of run as the other two
games: three mistakes and it is over, a clean run is **100 problems**, and the
30 levels are spread across them, so the first problems are `2 + 3` and the
last are three-digit sums with carrying.

| Mode | From level 1 … to level 28 |
|---|---|
| **Adunări și scăderi / Plus and minus** | adding to 10 with counters in ten-frames → inside 20 → crossing ten (8 + 2 + 3) → the missing number → whole tens → to 100 → carrying and borrowing → three numbers → to 1000 → carrying with hundreds → `? + 248 = 600` |
| **Înmulțiri și împărțiri / Times and divide** | ×2 and ×10 with dot arrays → ×5 → ×3, ×4 → dividing → ×6, ×7 → ×8, ×9 → the whole table, missing factors → *dublul, triplul, jumătatea*, *cu 3 mai mult* vs *de 3 ori mai mult* → tens and hundreds → two-digit numbers → order of operations → remainders |
| **Numere / Numbers** | <, >, = and neighbours → tens and ones with base-ten blocks → number patterns → even/odd → comparing sums → hundreds, tens, ones → fractions (pies and bars) → rounding on a number line → Roman numerals → harder patterns → to 1000 → fractions of numbers → to 10 000 → Roman numerals to C |
| **Ceasul / The clock** | o'clock → half past → quarters → days, months, 1 h = 60 min → five minutes → the time in words (*8 fără un sfert*) → every minute → the 24-hour clock → what time will it be in 30 minutes → how long does it last |
| **Bani / Money** | counting lei notes → up to 100 lei → shopping with price tags → change → bani coins → lei and bani → buying several → big notes → two-step problems → change with bani |
| **Provocare / Challenge** | all five mixed, endless, 3 lives |

How a question is answered changes as the run climbs:

- **pick** — choose from 3, then 4, then 6 answers.
- **type** — write the number on a big keypad (from level 5 in the sum modes).
  More and more questions are typed, so multiple choice never becomes the
  whole skill. A physical keyboard works too.
- **set** — drag the hands of the clock to the time asked (from level 10).
  The minute hand carries the hour hand round like real gearing.

The wrong answers are the mistakes children actually make, not random
numbers: the carry forgotten (47 + 38 → 75), the smaller digit taken from the
bigger (62 − 29 → 47), the zero dropped (5 sute 0 zeci 3 unități → 53), the
clock hands read the wrong way round (three o'clock → 12:15), the hour read
off the next number (7:45 → 8:45), 7:50 + 20 minutes → 7:70, 9:00 − 8:15 → 85
minutes, 100 − 37 → 73 lei. An equal fraction (1/2 when the answer is 2/4) is
never offered as a wrong answer.

After a miss the board shows the answer written in and, where it helps, the
working: `8 + 2 + 3 = 13`, `3 × 4 = 12, 2 + 12 = 14`, `600 − 248 = 352`. The
small facts (tables, sums inside 20) are remembered between sessions, and the
ones missed before come back more often. The result screen lists what was
missed, solved.

Each new level card names what just opened ("Trecerea peste 10", "Înmulțirea
cu 6 și cu 7", "Scrii singur răspunsul"). The countdown starts at level 12,
is generous, and is longer for story problems and for setting the clock.

The money is Romanian lei: notes in roughly their real colours (1 leu green,
5 violet, 10 pink, 50 yellow, 100 blue), coins of 1, 5, 10 and 50 bani.

## Logică

Puzzles of the kind found in the Cangurul and Comper contests, for ages 7–10.
Five topics and a challenge, each the same kind of run as the other games:
three mistakes and it is over, a clean run is **60 puzzles**, and the 30
levels are spread across them, so the first puzzle is red, blue, red, blue, ?
and the last ones are four-person logic grids and lines that cancel out.

| Mode | From level 1 … to level 29 |
|---|---|
| **Șiruri / Patterns** | two colours → repeating shapes → groups of three → a gap in the middle → growing groups → turning arrows → two rules at once (shapes every 3, colours every 2) → a ball walking round a frame → a turning four-colour square → two sequences woven together → two rules on one thing, gap anywhere |
| **Intrusul / Odd one out** | another shape → another colour → words (fruit among clothes) → size, with everything else changing → what do they share? → numbers (even, tens, 11 22 33) → close groups (fruit or vegetable, wild or farm, days or months) → how many in each group → the mirrored piece → sums that make the same number → number of sides |
| **Careuri / Grids** | matching rows → each colour once per row and column → each shape once → analogies (A is to B as C is to ?) → rows and columns → 4 × 4 number sudoku → growing tables → two changes at once → shape sudoku → find the rule in a number grid → lines drawn on top of each other → hard sudoku → lines that cancel out |
| **Robotul și formele / Robot and shapes** | where does the robot stop? (tap the square) → count the squares and triangles → longer routes → the mirror → which piece is the same, only turned → towers of cubes → bigger figures → pick the code that reaches the star → hidden cubes → folded paper with a hole punched → harder mirrors → a robot that turns on the spot → turned pictures → big buildings |
| **Detectiv / Detective** | who is taller (always asked the other way round from the clue) → three children in order → balance scales → places in a queue → legs and wheels → who has which pet, who plays which instrument → balanced scales (how many ● weigh as much as ■) → yesterday, today, tomorrow → ages → marbles in the dark → cuts and fence posts → four children → logic grids with only "not" clues → chains of scales → handshakes |
| **Provocare / Challenge** | all five mixed, endless, 3 lives |

Two ways of answering:

- **pick** — choose from 3, then 4, then 6 answers: shapes, pictures, codes,
  names or numbers.
- **tap** — the board is the answer: tap the odd one out, tap the square the
  robot stops on.

The puzzles are generated, and each generator guarantees one right answer:
the odd one out is the only item that breaks a pattern (every other property
is either shared by all or different for all, and number boards are checked
against every rule), detective clues are added until exactly one arrangement
fits, sudoku cells are always decidable from their row, column and box, and
towers of cubes never grow towards the viewer, so no tower hides another.

After a miss the board shows the answer and why: the repeating piece drawn
out, the sudoku's row, column and box lit up, the robot's route, the chain of
weights, `3 + 2 + 1 = 6` triangles, "Fără Andrei: 6 − 1 = 5". The result
screen lists what was missed, with its answer and the name of its stage.

Romanian sentences agree with the child in them (*Ana e mai înaltă*, *Dan e mai
înalt*, *a 3-a* / *al 3-lea*, *în fața Anei* / *în fața lui Dan*), and numbers
in the word problems stay under 20 where a noun follows, so the "20 **de**
copii" rule never comes up.

The countdown starts at level 15, at 50 seconds, longer for word problems.

## Running it

Any static file server:

```sh
python3 -m http.server 8777      # then open http://localhost:8777
```

## Regenerating the data

`js/data.js`, `js/shapes.js`, `js/atlas/data-*.js`, `js/atlas/meta.js`,
`sw.js` and `assets/flags/**` are generated and committed. To rebuild them:

```sh
node tools/build-data.mjs                          # flags
(cd tools && npm install) && node tools/build-atlas.mjs   # atlas maps
node tools/build-sw.mjs                            # after editing any hand-written file
```

The service worker's cache name hashes file *contents*, so any edit followed by
`build-sw.mjs` reaches an installed tablet on its next launch. (It used to hash
only the file list, which meant edited code was never picked up.)

Nobody has to force a refresh after a deploy. The new worker downloads every
file past the HTTP cache (GitHub Pages lets browsers keep files for 10
minutes), then moves every open page onto the new version: a page on a menu
reloads at once, a page in the middle of a game waits until the player is
back on a menu, and a page from before this mechanism is reloaded by the
worker itself. The app also checks for a new version each time it comes back
to the foreground, since a tablet app is resumed far more often than reopened.

It fetches country metadata, Romanian/English names, ~400 flag PNGs and the
country outlines, then writes everything into the repo. Downloads are cached in
`tools/.cache/` and existing flag files are skipped, so re-runs are cheap.

The atlas generator is the only part with build-time dependencies
(`topojson-server`, `-simplify`, `-client`, in `tools/package.json`): they
simplify every map with shared borders kept intact, so neighbouring countries
never drift apart into slivers. Natural Earth downloads are cached in
`tools/.cache/ne/`. What gets asked, its Romanian name and its difficulty tier
all live in `tools/atlas-curated.mjs`.

Natural Earth's default data puts Crimea in Russia; the atlas uses its
Ukrainian point-of-view layer, so Crimea is drawn and asked as part of Ukraine.

Sources: [Natural Earth](https://www.naturalearthdata.com) (all atlas maps,
public domain), [flagcdn](https://flagcdn.com) (flags, English names),
[i18n-iso-countries](https://www.npmjs.com/package/i18n-iso-countries) (Romanian
names), [world-countries](https://www.npmjs.com/package/world-countries)
(codes, region, area, population),
[world-atlas](https://www.npmjs.com/package/world-atlas) (outlines, from Natural
Earth).

## Layout

```
index.html            all screens in one page (hub, home, play, result, gallery)
css/style.css         one stylesheet
js/icons.js           inline SVG icons (emoji can be missing on old Android)
js/data.js            GENERATED  countries + names + difficulty tier
js/shapes.js          GENERATED  167 country outlines as SVG paths
js/lookalikes.js      hand-written confusable-flag groups
js/modes/quiz-kit.js  shared answer boards: locking, feedback, timeout path
js/i18n.js            UI strings, ro + en
js/store.js           localStorage profile, XP, per-country mastery, gallery
js/fx.js              sound, confetti, performance tier
js/app.js             router, round loop, scoring, question generation
js/modes/*.js         one file per game mode
js/atlas/meta.js      GENERATED  mode counts + the hub's world silhouette
js/atlas/data-*.js    GENERATED  world, regions, nature (~1.2 MB, loaded on
                                 first visit to the Atlas, not at startup)
js/atlas/geo.js       path decoding, hit tests, distances
js/atlas/map.js       the pan/zoom SVG map
js/atlas/game.js      atlas questions, judging, feedback, the six modes
js/math/questions.js  the maths curriculum: stages per level, wrong answers
js/math/pictures.js   ten-frames, arrays, blocks, pies, clock, lei, shop items
js/math/game.js       the notebook board, keypad, clock setting, six modes
js/logic/questions.js the logic curriculum: stages per level, unique answers
js/logic/pictures.js  shapes, robot, scales, cubes, folded paper, figures
js/logic/game.js      the puzzle board, tap boards, explanations, six modes
tools/build-data.mjs  the flag generator
tools/build-atlas.mjs the atlas generator (+ atlas-geo.mjs, atlas-curated.mjs)
tools/build-sw.mjs    writes sw.js
sw.js                 GENERATED  offline precache
```

## Notes on the old tablet

- The map never redraws while a finger is moving: a pinch or drag only changes
  a CSS transform on the already-drawn SVG, and the vector paths are drawn once,
  crisp, when the gesture ends. The SVG is rendered with a margin around the
  visible area so short pans never reveal a blank edge.
- Countries come at two levels of detail (13k points for the whole world, 80k
  once zoomed in) and the map swaps between them as you zoom.

- Plain ES5-era JavaScript, no bundler, no dependencies at runtime.
- Only `transform` and `opacity` animate per frame.
- `fx.js` samples real frame times at boot and drops to a lighter effect tier if
  the device struggles. Settings has a manual override (Maxim / Auto / Rapid).
- Flags are small PNGs (~1.6 MB for all 394 files) rather than SVG, because
  rasterising complex flag SVGs is slow on weak hardware.
- Sounds are generated with WebAudio and unlocked on first tap, so there are no
  audio files and no autoplay blocking.
