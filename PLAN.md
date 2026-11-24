# Plan

Future improvements for the Almanac: better UX, a real phone experience, icons, more classes
and professions, and tooling that keeps cyclomatic complexity down. This is a roadmap, not a
record of what has shipped; `git log` is that. Each phase is picked up deliberately, and a
phase can be reordered or dropped by editing this file.

Decisions already made:

| Question | Decision | Why |
|---|---|---|
| Build system | Keep the custom static build | See below |
| Icon set | [game-icons.net](https://game-icons.net), CC BY 3.0, stored in the repo | Recolourable SVG, works in dark mode, no hotlinking, no Blizzard art |
| First content | Warrior, then Cooking, First Aid, Fishing | Warrior is the priest's duo partner; the secondaries are already on the priest's sheet as gaps |

## Keep the custom static build

Don't move to Astro, 11ty or another framework. The site's value is in `data/`, in the
"nothing hardcoded outside data/" rule, and in `validate.js` checking the built HTML. A
framework fixes none of the actual gaps: mobile is CSS plus a little JS, icons are a build
step, and content is research.

What *is* missing is checking that `validate.js` can't do: layout and code complexity. So the
only new dependencies are **dev-only**: ESLint (with `eslint-plugin-sonarjs`) and Playwright,
in a new private `package.json`. The shipped site stays dependency-free, and `node build.js`
still runs with no `npm install`.

## Phase 0: land the in-flight wizard

- Finish and commit the home-page wizard work (`renderCharacterSteps`,
  `content/characters/*-talents.html`).
- Gate: `node build.js --base=/ && node validate.js` ends "no problems".

## Phase 1: quality tooling

This comes first so every later phase is measured.

### Cyclomatic and cognitive complexity

- `package.json` (private, devDependencies only) and `eslint.config.js` (flat config) over
  `build.js`, `validate.js`, `watch.js`, `scripts/` and `assets/site.js`.
- Rules: `complexity: ["error", 10]`, `sonarjs/cognitive-complexity: ["error", 15]`,
  `max-depth: 4`, `max-lines-per-function: 80`, `max-params: 4`, `max-nested-callbacks: 3`.
- **Ratchet instead of fixing everything at once.** Run `eslint --suppress-all` once to write
  `eslint-suppressions.json` (bulk suppressions, ESLint 9.24 or later). That file is the debt
  list.
  - Any violation that isn't in the file fails CI, so new code has to pass the rules.
  - When a violation is fixed, its entry goes stale and CI fails until someone runs
    `eslint --prune-suppressions`. So the file can only shrink.
- First refactor targets, the largest functions today:
  - `renderCharacterSteps`, `renderTable` and `expand` in `build.js`
  - `renderNext` and `buildContextBar` in `assets/site.js`

  The pattern for all five: split each into small named renderers (one per step or pane), and
  turn `switch`/`if` chains on `kind` or `drive.by` into lookup tables keyed by data.
- Optional: a small script that reads `eslint --format json` and prints the ten most complex
  functions, so the trend shows up in PR comments.

### Layout and E2E checks (Playwright)

- `tests/e2e/*.spec.js` serve `docs/` and visit every built page at 375x812, 768 and 1280
  widths, in light and dark.
- Each page must pass these checks:
  - no horizontal page overflow (`scrollWidth <= innerWidth`)
  - tap targets of at least 44px
  - no console errors
  - still useful with scripting off (spec panes both visible)
- One end-to-end test walks the wizard flow and the sync link round trip.
- Screenshots are taken on failure and kept as CI artifacts.

### CI

Add `npm ci`, `npx eslint .` and `npx playwright test` to `.github/workflows/ci.yml`
after the validate step. The hardcoded-name grep stays as it is.

## Phase 2: icons

- Store the chosen SVGs in `data/icons/<name>.svg`. They go under `data/` because they are
  content-specific, which keeps the CI grep honest. Add `data/icons/LICENSE.md` crediting each
  author (Lorc, Delapouite and others).
- Each record gains an `"icon"` field: `data/classes/*.json` (the class and each tree),
  `data/professions/*.json`, and the sections in `data/site.json`. A missing icon falls back to
  a neutral glyph, and the build reports it as a note, the same way it handles a missing
  token.
- `build.js` combines every referenced icon into one sprite of `<symbol>`s, written to
  `docs/assets/icons.svg`. Pages use `<svg class="ico"><use href="…#name"/></svg>`.
  Icons are drawn with `fill: currentColor`, so `data-token` accent colours and dark mode
  apply with no new CSS per profession.
- UI icons (menu, copy, check, chevron, theme) come from the same set and go in the same
  sprite.
- Icons appear in the nav, library chips, index-page cards, character cards, spec toggle
  buttons, `.tree` labels, profession skill fields, the favicon and the PWA icon.
- The footer carries the credit line ("Icons: game-icons.net, CC BY 3.0"), from
  `data/site.json`.
- `validate.js` gains check 11: every `<use href>` resolves to a symbol in the sprite.

## Phase 3: mobile

Start with an audit. Run the Phase 1 Playwright suite at 375px, record every overflow and
cramped spot with a screenshot, and fix from that list rather than guessing. The work this is
expected to turn up:

- **Tables become stacked cards under 560px.** `renderTable` emits `data-label` on each `td`
  from the column label, and CSS reflows each row into label/value pairs. Wide reference
  tables (tooltips, trainers) keep `.tscroll`, with a sticky first column and sticky `thead`.
- **A bottom tab bar on phones** (Home / Classes / Professions / Me), fixed in place and
  padded with `env(safe-area-inset-bottom)`. The top masthead becomes compact. The tabs come
  from the sections in `data/site.json` plus the active character.
- **A sticky context bar.** The level and skill `.status` bar stays under the masthead while
  you scroll a route or ladder, with a "Jump to my row" button that scrolls to `tr.here`.
- **An "On this page" table of contents**, built at build time from each page's `h2`s. On
  screens 1100px and wider it is a sticky sidebar; on phones it is a collapsible `<details>`.
- **Inputs**: `font-size` of at least 16px (which stops iOS zooming in), 44px tap targets,
  and `enterkeyhint`.
- **Installable and offline (PWA).** Add `manifest.webmanifest` (using the Phase 2 icons) and
  a small service worker that precaches the built pages. Its cache name is keyed to the build
  hash, so each deploy invalidates the old cache. This matters because the phone is the second
  screen while playing. The site must still work fully without the worker.

## Phase 4: UX

- **Index pages become icon grids**, with a status badge on each entry: researched, partial or
  gap. The badge is derived from which data files exist, never written by hand.
- **A theme toggle.** The CSS already supports `data-theme`. The choice is stored under
  `forever-almanac:pane:theme`, following the state rule in AGENTS.md.
- **Quick-jump search.** `build.js` emits `search.json` (page titles, `h2`s, talent and craft
  names), and pressing `/` opens a filter dialog. It works without a server.
- **Talent tooltips in place.** Tapping a talent name in a ladder row opens its tooltip as a
  `<details>` or popover, instead of sending you to the collapsed reference table.
- **A character switcher in the masthead**, replacing the `select` buried in the context bar.
- **Confidence at a glance.** A small meter at the top of each page counts the solid, check
  and provisional claims and links to the full section at the bottom.

## Phase 5: content

The house rules in AGENTS.md apply throughout: never answer from memory, show the
disagreement, and treat a stated gap as the correct outcome.

**A class is done** when it has:

- `data/classes/<class>.json` with trees, token and icon
- ladders for at least the two most-played leveling specs (sources: classicwowforever,
  wowhandbook, talentsforever)
- `data/tooltips/<class>-<tree>.json` for every tree
- `data/quest-rewards/<class>.json`
- prose in `content/classes/<class>.html` that checks for new core abilities with talents keyed
  to them (the Shank pattern)
- a token in `data/tokens.json`
- source entries whose `watch` value is taken from each site's robots.txt

**A profession is done** when it has:

- `data/professions/<slug>.json`
- `data/routes/<slug>.json`, with materials per craft and flagged as derived
- `data/trainers/<slug>.json`
- prose, a token, an icon and sources

Gathering professions have no Wowhead guide, so use Zockify, wow-professions and Method.

Order:

1. **Warrior**, the priest's duo partner. Optionally add a character file for the friend,
   which gives them their own `/me/` page.
2. **Cooking, First Aid, Fishing**, already on the priest's sheet as gaps. First Aid needs
   particular care, because it crafts healing potions in Forever.
3. **Mining, Herbalism**, the gathering pair. Quick to research.
4. **Alchemy, Blacksmithing, Engineering**, which completes the nine primary professions.
5. **The remaining classes.** Check the roster against the sources rather than assuming it.

Each one goes in as its own PR, so the source watcher and review stay readable.

## Verification, for every phase

- `node build.js --base=/ && node validate.js` ends "no problems".
- `npx eslint .` passes, and `eslint-suppressions.json` did not grow.
- `npx playwright test` passes at all three widths in both themes.
- A look on a real phone through the sync link, checking for pixel problems.
