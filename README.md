# The Forever Almanac

Reference notes for **World of Warcraft: Forever**, Blizzard's Classic+ title (launched
2026-11-04, level cap 60). Talent ladders, profession routes 1-300, trainer locations and
the Forever-specific mechanics, organised by topic, with a per-character view on top that
works out what to do next.

Built as a static site. No framework, no dependencies, no build tooling beyond Node itself.

## Running it

```sh
node build.js --base=/      # content/ + data/ -> docs/
node validate.js            # the checks below, against the built HTML
python3 -m http.server -d docs 8099
```

`docs/` is build output and is not committed. `--base=/forever-almanac/` is what CI passes,
because a GitHub Pages project site is served from a subpath.

## How it is put together

| | |
|---|---|
| `content/<section>/<slug>.html` | prose only, as HTML fragments, with a JSON `meta` block |
| `data/**/*.json` | every table, every record - routes, ladders, trainers, characters, sources |
| `templates/page.html` | the one page shell |
| `assets/site.css`, `assets/site.js` | shared, and deliberately generic |
| `build.js` | resolves placeholders, writes `docs/`, emits `sources/citations.json` |
| `validate.js` | parses the built HTML back out and checks it |

Prose uses four placeholders, which the build replaces:

```html
<x-table src="routes/tailoring" id="troute"></x-table>
<x-trainers src="trainers/tailoring"></x-trainers>
<x-cite src="method-tailoring"></x-cite>
<x-confidence></x-confidence>
```

### Nothing is hardcoded

`build.js`, `validate.js` and the two asset files never name a class, a spec or a
profession - a rule enforced by a grep in CI. Everything comes from `data/`:

- **Add a character**: one file in `data/characters/`. The home page gains a card and
  `/me/<slug>/` is generated. Anything it refers to that does not exist yet renders as a
  stated gap, never as a guess.
- **Add a class**: `data/classes/<class>.json` with its trees, then ladders and tooltips
  under `data/ladders/` and `data/tooltips/` as they get researched, then prose in
  `content/classes/<class>.html`.
- **Add a profession**: `data/professions/<slug>.json`, a route in `data/routes/`,
  trainers in `data/trainers/`, prose in `content/professions/`. A colour goes in
  `data/tokens.json`; without one the build says so.

### What a character page derives rather than repeats

Next talent, points placed against points available, next craft and its materials, which
rank to buy next, and which camp object to place. The last one is the interesting case:
camp buffs do not stack with the equivalent class buff, and an object only dies once the
character actually learns the buff that clashes with it. That is computed from
`data/camp/objects.json` against the character's own `classBuffs`, so a new character gets
the right answer without anyone writing it down.

## The checks

`validate.js` runs against `docs/`, not against the drafts, because the point is to catch an
edit that broke a table after the arithmetic was done.

1. Every tag balanced, `<section>` counts matching.
2. Route and ladder rows contiguous - no gap, no overlap. Route bounds are exclusive (a
   row's max is the skill it carries you *to*); ladder bounds are inclusive (its max is the
   last level you spend on). The data says which.
3. Ladders cover their whole level range, ending at 60.
4. Points placed never exceed `level - 9`.
5. A talent's point is never spent before its tree holds `5 x (row - 1)` points.
6. The finished ladder matches the spread the source publishes for level 60.
7. Every CSS class used in the HTML exists in the stylesheets.
8. Every placeholder `src` resolves and every cited source id exists.
9. Every page carries a confidence section and at least one citation.
10. Every character's class, specs, professions and class buffs resolve.

Checks 2 to 6 are what make the derived per-level talent ladders trustworthy: the sources
publish ten-level bands, the split into single levels is ours, and these prove the split is
faithful to the band it came from.

## House rule: show the disagreement

The game is weeks old and the guides contradict each other, badly above 225 skill. Every
page ends with a confidence section splitting its claims into solid / check in game / still
provisional, generated from the claims the page and its data files declare.

- Never resolve a source conflict silently. Give both numbers and name who said what.
- Never fill a gap with vanilla or TBC knowledge. Say the gap exists.
- Repeat a source's own admission that it is untested rather than laundering it into
  confidence. Method says exactly that about tailoring beyond 225.
- A source contradicting itself is worth printing too.

## Sources, and which may be fetched automatically

`data/sources.json` is the registry: each entry carries its URL, the date it was last
checked, and a `watch` value of `text`, `hash` or `never` taken from that site's own terms.
Two of them say no to automated fetching, which is why the value exists:

- **maxroll.gg** states in robots.txt that automated retrieval is prohibited without
  written permission, naming RAG and AI databases. `watch: never` - read by hand.
- **wowhead.com** names about forty AI crawlers in robots.txt and disallows each one.
  `watch: hash` - we keep a hash and never a copy of the text.
- **classicwowforever.com** and **warcraft.wiki.gg** send
  `Content-Signal: ai-train=no, use=reference`. Also `hash`.
- **zockify.com**, **wow-professions.com**, **talentsforever.com**, **method.gg** and
  **timesaver.gg** allow it; timesaver says `ai-input=yes` outright. These keep a
  normalized text snapshot so a change can be shown as a diff.

Agent instructions, including which sources are reliable for what, are in
[AGENTS.md](AGENTS.md).

## History

There is no version table here. Artifacts have no diffs, which is why the old one existed;
`git log` replaces it, and every built page carries the date it last changed plus the dates
its sources were checked.

The two original artifact pages stay published and keep their URLs, frozen at priest v6 and
rogue v4.

## Still to move onto the site

Facts that were in this README and do not have a page yet. Phase 2 empties this list; until
then it is the only copy outside git history.

- **The rogue's level 20 Poisons chain is a hard gate.** Mathias and the Defias into
  Klaven's Tower. No poisons at all until it is done.
- **The priest's Night Elf racial chain locks the spell until it is finished.** Stars of
  Elune at 10, Elune's Grace at 20.
- **Annora, the Artisan enchanter, is inside Uldaman.** Only trainer for either faction,
  only spawns once her area is cleared, and the 230-250 formulas exist nowhere else. Buy
  everything in one visit.
- **Buy rods before you need them.** Silver at 109, Golden at 150, Truesilver at 200. They
  are blacksmithing items and nobody in the group is a blacksmith.
- **Enchanting crafts wands**, which is the real partner to Wand Specialization. Nobody
  publishes DPS for any of them, so compare tooltips in game.
- **The rogue's weapon is a talent decision.** Hack and Slash is five points and does
  something different per weapon type: axe or sword gives an extra attack chance, dagger or
  fist gives crit, mace ignores armour. Pick swords or axes and stay there. Aggression also
  stopped covering Backstab on 2 Nov.
- **Shank, at level 24,** is a new rogue ability that three talents key off - Flash of
  Steel, Venom and Boot Knife. Five points of the Combat build exist to feed it.
- **Blackout is taken by no leveling route on any site.**
- **Shield yourself before pulling, not just when hurt.** It "prevents spell-pushback and
  the loss of Inner Fire charges while active".
