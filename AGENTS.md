# The Forever Almanac

Reference notes for **World of Warcraft: Forever**, Blizzard's Classic+ title (launched
2026-11-04, level cap 60). This is a static site built from data files. [README.md](README.md)
covers how to run and extend it; this file is about how to work on it well.

## The characters

| Character | Professions | Page |
|---|---|---|
| Night Elf Priest, Alliance, duos with a warrior friend | Tailoring + Enchanting (the focus), plus Cooking, Fishing, First Aid | `/me/priest/` |
| Night Elf Rogue | Leatherworking + Skinning | `/me/rogue/` |

Levels and skills are typed into the page and live in that browser's `localStorage`. They are
not in the repo and not in any database, so **never hardcode a level or a skill number into
the content.** Anything that depends on where a character currently is must be derived at
runtime from the data, the way `assets/site.js` already derives the next talent, the next
craft, the next rank and which camp object to place.

The two original Claude Artifacts stay published and keep their URLs, frozen at priest v6 and
rogue v4. They are history now, not the deliverable. Do not edit them.

## Before you change anything

```sh
node build.js --base=/ && node validate.js    # must end "no problems"
```

`validate.js` runs against the built HTML in `docs/`, not the drafts, which is the point:
it catches an edit that broke a table after the arithmetic was done. The ten checks are
listed in the README. CI runs the same two commands, plus a grep that fails the build if
`build.js`, `validate.js`, `assets/` or `templates/` names a class, a spec or a profession.
Keep that true: everything specific belongs in `data/`.

## Forever is not vanilla. Never answer from memory.

Mechanics differ from Classic 1.12 and TBC in ways that change the advice. The site's
[What Forever changed](content/mechanics/whats-new.html) page carries the current list.
The ones that most often catch people out:

- First Aid crafts healing potions now (moved off Alchemy, which gets a worse version).
- No confirmed Tailoring specializations. Mooncloth and Shadoweave survive only as bag and
  Craftsman's Writ names. Leatherworking does keep Dragonscale / Elemental / Tribal.
- A Camping system, which `data/camp/` models. The useful half is the no-stacking rule:
  an object dies only once the character learns the class buff that clashes with it, which
  is why the verdict is computed per character and never written into the prose.
- **Talent trees are reworked**, not vanilla or TBC. Names like Efficient Strikes, Coup de
  Grace, Power in Light, Twilight Focus, Dark Inspiration, Boot Knife and Death Mark are new;
  some TBC/Wrath talents (Penance, Divine Aegis, Renewed Hope) were imported; Holy Precision
  sits in Discipline despite the name. Rank counts changed too - Wand Specialization is 2
  ranks for the full +25%, Dual Wield Specialization 2 ranks for +50%. Never name a talent
  from memory.
- New core abilities exist outside the trees. **Shank** (rogue, level 24) has three talents
  keyed to it, so five points of a Combat build serve an ability the talent guides barely
  mention. Check for this pattern on other classes before writing a build up.
- **Talent arithmetic, which settles arguments.** Points available = level - 9, and 51 at 60.
  A tree's row N opens at 5x(N-1) points *in that tree*. Do that subtraction against a
  reported sheet before advising a respec.
- **Trace talent prerequisites before repeating a source's suggested swap.** Sources name the
  prereq but not its consequence. classicwowforever offers "Renewed Hope instead of Penance
  at 30" without mentioning that it closes off the row 7 capstone for good.
- **Check whether a build actually reaches the talent you are recommending gear for.**
  Spiritual Guidance is Holy row 5, and the Discipline build's 13 Holy points open rows 1
  and 2. Neither priest build reaches it.
- Dual spec opens at **level 40**: Blizzard's own words, quoted by Zockify. The caveat that
  belongs in any write-up: that article is the **Mage and Shaman** deep dive, and nobody has
  read it directly rather than Zockify's quote.
- Profession ranks are unchanged, and live in `data/gates.json`. The level half of each gate
  is what sets the schedule.

## Sources

`data/sources.json` is the registry. Every entry carries a URL, the date it was last checked
and a `watch` value. **The `watch` value is a terms decision, not a technical one** - read
the site's robots.txt before adding a source, and record the reason in `watchWhy`:

| Value | Means | Who |
|---|---|---|
| `text` | keep a normalized snapshot, so changes show as a diff | zockify, wow-professions, talentsforever, method, timesaver, wowhandbook |
| `hash` | keep a hash and structural counts only; never store their text | wowhead (disallows ~40 named AI crawlers), classicwowforever and warcraft.wiki.gg (`ai-train=no, use=reference`) |
| `never` | do not fetch at all | maxroll (Ziff Davis prohibits automated retrieval in prose), conquestcapped (Cloudflare challenge since 2026-11-23) |

URL patterns that work, verified 2026-11-23:

- `wowhead.com/forever/profession-leveling-guides/<prof>` - **crafting professions only.**
  There is no skinning, mining, herbalism or fishing guide; the index lists eight.
- `zockify.com/forever/professions/<prof>/`, plus `/trainers/` and `/leveling/`.
- `wow-professions.com/forever/<prof>-leveling-guide` and `-trainers`.
- `method.gg/wow-forever/<prof>-in-wow-forever-leveling-guide-and-trainers` - the slug varies
  ("1-300" appears in some), so take the link from `/wow-forever/professions`. Reliable, and
  states plainly where it is untested.
- `timesaver.gg/tools/wow-forever/professions/<prof>` and
  `timesaver.gg/blog/wow-forever-<class>-leveling-weapons`. A boosting seller; ignore its
  sales content. Its robots.txt says `ai-input=yes` outright.
- `classicwowforever.com/talents/<class>` and `/weapons/<class>` - full tree contents and
  every tooltip, with rows inferred from point gates. Best talent source found. One flaw: its
  leveling table assigns several talents to more than one tree, so take tree placement from
  its reference section.
- `maxroll.gg/wow-forever/class-guides/<class>-leveling-guide` - the only source with leveling
  rotations, and it does not label which spec each block belongs to. **Read by hand only.**
- `wowhandbook.com/classes/<class>/leveling/` - the only exact per-level point order anywhere.
  Contradicts itself in places; check for that.
- `talentsforever.com/<class>/leveling` - what players actually pick, across tens of thousands
  of builds. Popularity, not recommendation; label it that way.

All three talent sites print the client build they were checked against, which is how you tell
whether one is stale. `ai-exodus.com` is behind - do not use it for rank counts.

These refuse automated reads with 403: mobalytics.gg, overgear.com, icy-veins.com. Wowhead
`/guide/...` pages return boilerplate even at HTTP 200, including all of
`/forever/guide/classes/...`; there is no working Wowhead path for class guides.
`warcrafttavern.com/forever/guides/profession-trainers/` truncates near 40k of 80k, so ask for
specific professions.

## House rule: show the disagreement

The game is weeks old and the guides contradict each other, badly above 225 skill. Every page
ends with a confidence section, generated from the `confidence` blocks the page and its data
files declare. Keep that, and:

- Never resolve a source conflict silently. Give both numbers and say which source said what.
- Never fill a gap with vanilla or TBC knowledge. Say the gap exists. A missing page renders
  as a stated gap in the library, which is the correct outcome, not a bug to paper over.
- Repeat a source's own admission that it is untested rather than laundering it into
  confidence. Method says exactly this about tailoring 225+, in those words.
- A source contradicting *itself* is worth printing too. wowhandbook's prose disagrees with
  its own talent table twice; Method says Combat should avoid daggers and then offers a dagger
  swap.
- When you correct something previously published, say so plainly in the reply.

## Deriving a per-level ladder

Talent sources publish **ten-level bands as running totals**, not one point per level.
Splitting a band into single levels is fine and useful, but:

- Say on the page that the bands, tree rows and gates are sourced and the per-level split is
  derived. The ladder data carries `"derived": true` and a `note` that says so.
- **Verify it, don't eyeball it.** Every ladder row carries `tree` and `row`, which reach the
  HTML as `data-tree` and `data-row`, and `validate.js` re-derives all of it from the shipped
  page: row gates satisfied at the level each point is spent, running total never above
  `level - 9`, and the finished build matching `publishedSpread`. That last check is what
  proves the division is faithful to the band.
- A check that cannot run is worse than no check. `validate.js` fails a ladder row that is
  missing `data-tree` or `data-row` rather than skipping it - that bug was real once.

## Conventions worth keeping

- **Content is prose; data is everything in a table.** `content/**.html` holds HTML fragments
  with a JSON `meta` block; every table, trainer list and record is a typed envelope in
  `data/`. Route rows give materials **per craft** - sources publish route totals, so divide,
  and say the per-craft figure is derived.
- **Bounds are explicit.** A route row's `max` is the skill it carries you *to* (exclusive);
  a ladder row's `max` is the last level you spend on (inclusive). `drive.bound` says which,
  and the contiguity check uses it.
- **Two crafts covering the same band are alternatives**, marked `"alt": true`, not an error.
  The enchanting route has a pair.
- Shared look: Spectral for display, Inter for body, IBM Plex Mono for numbers and
  coordinates. Colour comes from `data-token="<slug>"` plus `data/tokens.json`; never add a
  profession-specific CSS class.
- Long reference material goes in `<details class="ref">`, collapsed, each table in its own
  `.tscroll`. Anything progressively enhanced must render usefully with scripting off - the
  spec toggle ships both panes visible and lets JS hide one.
- **State belongs in one of two places, deliberately.** Anything the reader should see on both
  phone and desktop goes in `localStorage` under `forever-almanac:<character>` and travels by
  sync link. Per-viewer UI state, such as which spec tab is open, goes under
  `forever-almanac:pane:*` and never mixes with a character's record. Wrap every access in
  try/catch.
- **No version table.** `git log` is the record, and each page prints the date it last changed
  plus the dates its sources were checked. Write commit messages that say what changed and
  why, because that is now the only place the reason lives.
