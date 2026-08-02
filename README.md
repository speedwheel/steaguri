# Steaguri! — a flag game for kids

A small browser game about country flags, built for a 7-year-old on an older
Android tablet. No framework, no build step at runtime, works offline once
loaded, Romanian and English.

## Game modes

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

## Running it

Any static file server:

```sh
python3 -m http.server 8777      # then open http://localhost:8777
```

## Regenerating the data

`js/data.js`, `js/shapes.js`, `sw.js` and `assets/flags/**` are generated and
committed. To rebuild them:

```sh
node tools/build-data.mjs
```

It fetches country metadata, Romanian/English names, ~400 flag PNGs and the
country outlines, then writes everything into the repo. Downloads are cached in
`tools/.cache/` and existing flag files are skipped, so re-runs are cheap.

Sources: [flagcdn](https://flagcdn.com) (flags, English names),
[i18n-iso-countries](https://www.npmjs.com/package/i18n-iso-countries) (Romanian
names), [world-countries](https://www.npmjs.com/package/world-countries)
(codes, region, area, population),
[world-atlas](https://www.npmjs.com/package/world-atlas) (outlines, from Natural
Earth).

## Layout

```
index.html            all screens in one page
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
tools/build-data.mjs  the generator
sw.js                 GENERATED  offline precache
```

## Notes on the old tablet

- Plain ES5-era JavaScript, no bundler, no dependencies at runtime.
- Only `transform` and `opacity` animate per frame.
- `fx.js` samples real frame times at boot and drops to a lighter effect tier if
  the device struggles. Settings has a manual override (Maxim / Auto / Rapid).
- Flags are small PNGs (~1.6 MB for all 394 files) rather than SVG, because
  rasterising complex flag SVGs is slow on weak hardware.
- Sounds are generated with WebAudio and unlocked on first tap, so there are no
  audio files and no autoplay blocking.
