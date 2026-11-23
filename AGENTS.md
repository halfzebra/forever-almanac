# wow-forever

Personal reference notes for **World of Warcraft: Forever**, Blizzard's Classic+ title (launched 2026-11-04, level cap 60).

This is not a codebase. There is no build, no tests, and the directory is intentionally near-empty. The deliverables are **published Claude Artifacts**, not files here.

## The characters

| Character | Professions | Page |
|---|---|---|
| Night Elf Priest, Alliance, duos with a warrior friend | Tailoring + Enchanting (the focus), plus Cooking, Fishing, First Aid | https://claude.ai/artifact/TSWk4hvFmorBqpAGjTfbqt |
| Night Elf Rogue | Leatherworking + Skinning | https://claude.ai/artifact/ScKais2PSaovFHEcMgbDv7 |

Do not hardcode levels or skill numbers into advice. They go stale within days. Each page keeps live state in its own artifact database at `tracker/progress`, so read it first:

```
ArtifactData  action: "get"  url: <page url>  collection: "tracker"  doc_id: "progress"
```

Fields are `lvl`, `done`, and two skill keys: `tl`/`en` on the priest page, `lw`/`sk` on the rogue page.

## Forever is not vanilla. Never answer from memory.

Mechanics differ from Classic 1.12 and TBC in ways that change the advice:

- First Aid crafts healing potions now (moved off Alchemy, which gets a worse version).
- No confirmed Tailoring specializations. Mooncloth and Shadoweave survive only as bag and Craftsman's Writ names. Leatherworking does keep Dragonscale / Elemental / Tribal.
- A Camping system. Each profession grants three camp objects, the first around 20 skill, upgrades from dungeon blueprints. Buffs last an hour, share a one-hour cooldown, do not stack with equivalent class buffs. Three objects per basic campfire (Cooking 90/200 blueprints raise this to 5/10), one contribution per player. The no-stacking rule is the useful half: work out which of a character's own objects their class already buffs, and say which one to actually place. A priest's First Aid Kit is permanently dead to Power Word: Fortitude; the Tailoring Faction Banner dies at 30 to Divine Spirit.
- **Talent trees are reworked**, not vanilla or TBC. Names like Efficient Strikes, Coup de Grace, Power in Light, Twilight Focus, Dark Inspiration, Boot Knife and Death Mark are new; some TBC/Wrath talents (Penance, Divine Aegis, Renewed Hope) were imported; Holy Precision sits in Discipline despite the name. Rank counts changed too - Wand Specialization is 2 ranks for the full +25%, Dual Wield Specialization 2 ranks for +50%. Never name a talent from memory.
- New core abilities exist outside the trees. **Shank** (rogue, level 24: 5 Energy, returns 15, cannot miss, 10 sec cooldown) has three talents keyed to it - Flash of Steel, Venom, Boot Knife - so five points of a Combat build serve an ability the talent guides barely mention. Check for this pattern on other classes before writing a build up.
- **Talent arithmetic, which settles arguments.** First point at level 10, one per level after, so **points available = level - 9**, and 51 at level 60. A tree's **row N opens at 5x(N-1) points in that tree** (row 1 free, row 5 needs 20, row 7 needs 30). Use this to check a character's reported sheet: the priest's "2 wand, 3 focus, 5 blackout, 2 SW:P" was 12 points at level 23, which grants 14, so two were unaccounted for. Always do that subtraction before advising a respec.
- **Trace talent prerequisites before repeating a source's suggested swap.** Sources name the prereq but not its consequence. Priest Discipline: Improved Power Word: Shield -> Soul Warding -> Renewed Hope, and Penance -> Power Infusion. classicwowforever offers "Renewed Hope instead of Penance at 30" as a fair swap without mentioning that it closes off the row 7 capstone for good. Shadowform likewise needs Vampiric Embrace at full rank, not just 30 points.
- **Check whether a build actually reaches the talent you are recommending gear for.** Spiritual Guidance converts up to 25% of Spirit into healing power, which looks like the obvious partner to Spirit-heavy Tailoring cloth - but it is Holy row 5, and the Discipline build's 13 Holy points only open rows 1 and 2. Neither priest build on the page reaches it.
- Dual spec opens at **level 40**: Blizzard's own words, "Dual Specialization also becomes available at level 40", quoted by Zockify from `news.blizzard.com/en-us/article/24302097`. Caveat that belongs in any write-up: that article is the **Mage and Shaman** deep dive, and nobody has read it directly rather than Zockify's quote. Nobody publishes what a class respec costs; only the Legacy respec tiers are datamined, and Zockify says those need live confirmation too.
- Merchant's Favor, earned from loot crates, buys many recipes outright rather than training them.
- New content: Dalaran (in Alterac Mountains), Riverglades, Zephras Isle, the Skyborne race.
- Profession ranks are unchanged: Apprentice (no requirement, cap 75), Journeyman (50 skill, level 10, cap 150), Expert (125, level 20, cap 225), Artisan (200, level 35, cap 300). The level half of each gate is what sets the schedule.

Research every mechanics question against Forever-specific pages before answering.

## Sources: what works

These load and are dated:

- `wowhead.com/forever/profession-leveling-guides/<prof>` - route tables with per-craft materials.
- `zockify.com/forever/professions/<prof>/`, plus its `/trainers/` and `/leveling/` subpages - trainers and Forever change lists.
- `warcraft.wiki.gg/wiki/Forever_<topic>` - recipe lists flagged new vs old.
- `wow-professions.com/forever/<prof>-leveling-guide` and `-trainers`.
- `timesaver.gg/tools/wow-forever/professions/<prof>` - routes with auction-house prices. It is a boosting seller; ignore its sales content.
- `method.gg` - reliable, and states plainly where it is untested.

For talents and class data, Wowhead is useless (see the traps below). Use instead:

- `classicwowforever.com/talents/<class>` - full tree contents and **every tooltip**, with rows inferred from point gates, plus per-spec level bands and a dated list of Blizzard's talent changes. Best talent source found. One flaw: its leveling table assigns several talents to more than one tree, so take tree placement from its reference section instead.
- `maxroll.gg/wow-forever/class-guides/<class>-leveling-guide` - the only source found with **leveling rotations** (openers and loops per level band) and with spec pros/cons. It does not label which spec each rotation block belongs to, so say so when using them.
- `wowhandbook.com/classes/<class>/leveling/` - the only exact per-level point order anywhere. Contradicts itself in places; check for that.
- `talentsforever.com/<class>/leveling` - what players actually pick, counted across tens of thousands of builds. Popularity, not recommendation; label it that way.
- `classicwowforever.com/weapons/<class>` and `timesaver.gg/blog/wow-forever-<class>-leveling-weapons` - quest rewards and drops by level.
- `conquestcapped.com/guides/wow-forever/wow-forever-class-quests/` - class quest IDs and chains. Truncates near 40k of 82k.

All three talent sites print the client build they were checked against, which is how you tell whether one is stale. `ai-exodus.com` is behind - it missed Penance and Dark Inspiration and still listed the removed Shadow Affinity - so do not use it for rank counts.

These refuse automated reads with 403. Do not retry them: mobalytics.gg, overgear.com, icy-veins.com.

Three traps. Wowhead `/guide/...` pages return only boilerplate even at HTTP 200: this hits both `/guide/.../overview` for professions (use `profession-leveling-guides` instead) and **all of `/forever/guide/classes/...`**, for which there is no working Wowhead path - `/forever/guide/classes/rogue/leveling-guide` also 404s. And `warcrafttavern.com/forever/guides/profession-trainers/` is around 80k characters and truncates near 40k, so ask for specific professions rather than the whole page.

## House rule: show the disagreement

The game is weeks old and the guides contradict each other, badly above 225 skill. Every page here ends with a confidence section splitting claims into solid / check in game / still provisional. Keep that, and:

- Never resolve a source conflict silently. Give both numbers and say which source said what.
- Never fill a gap with vanilla or TBC knowledge. Say the gap exists.
- Repeat a source's own admission that it is untested, rather than laundering it into confidence. Method says this about tailoring 225+; Zockify says it about the leatherworking specialization steps.
- A source contradicting *itself* is worth printing too. wowhandbook's prose disagrees with its own talent table twice; classicwowforever's leveling table assigns five rogue talents to more than one tree; Method says Combat should avoid daggers and then offers a dagger swap. Show the contradiction rather than silently picking one side.
- When you correct something you previously published, say so plainly in the reply. Two from this project: dual spec was described as single-sourced when it is a direct Blizzard quote, and the rogue's Flash of Steel shipped with no idea it was Shank support.

### Deriving a per-level ladder

Talent sources publish **ten-level bands as running totals**, not one point per level. Splitting a band into single levels is fine and useful, but:

- Say on the page that the bands, tree rows and gates are sourced and the per-level split is derived.
- **Verify it, don't eyeball it.** Three checks, all cheap to script: every row gate is satisfied at the level its point is spent; the running total never exceeds `level - 9`; and the finished build matches the source's own published "points at 60" spread. All three ladders on these pages pass, and the final-spread check is what proves the division is faithful to the band.
- Re-run the check against the **shipped HTML**, not your draft, by parsing the published tables back out. That catches an edit that broke a row after the maths was done.

## Artifact conventions

- One page per character, private, updated in place. Keep the URL: republish the same `file_path`, or pass `url` from a later session. Never publish a second artifact for a character that already has one.
- **After every publish, log the new version in `README.md`.** This is the rule, not a nicety: the Page versions table there is the only record of what each version contains, because the artifact history shows numbers and not reasons. Add a row with the version number, the date, and one line on what changed - in the same response as the publish, while you still know. The artifact URL is stable across versions and there is no per-version public link, so link the page URL and record the number beside it. Never invent a versioned URL.
- The HTML lives in the session scratchpad, which gets cleared. A later session must `Artifact action: "read"` the published page and build from what comes back, rather than expecting the local file to still be there. Reading a page back also requires reading the whole saved file before republishing, so budget for that.
- Shared look across pages: Spectral for display, Inter for body, IBM Plex Mono for numbers and map coordinates; one colour token per profession and one per spec; a level-ladder timeline, then reference route tables whose rows carry `data-min` / `data-max` and highlight against the typed skill; confidence section last; footer cross-links the other character's page.
- Talent ladders use the same `data-min` / `data-max` rows, but pass `lvl` to `markRoute` instead of a skill. Reuse that function rather than writing a second one.
- **State belongs in one of two places, deliberately.** Anything the user should see on both phone and desktop - levels, skills, ticked checkboxes - goes in the `db` capability at `tracker/progress`. Per-viewer UI state that nobody needs to survive a device change, such as which spec tab is open, goes in `localStorage`, wrapped in try/catch, and never in the `db`. Do not change the `db` schema to store a UI preference.
- Long reference material goes in `<details class="ref">`, collapsed by default, with each table inside its own `.tscroll`. That is what keeps the tooltip tables from burying the ladders. Anything progressively enhanced must render usefully with scripting off - the priest's spec toggle ships both panes visible and lets JS hide one.
- **Validate before publishing.** Parse the file: tags balanced, `<section>` count matching `</section>`, ladder rows contiguous with no gap or overlap, every new CSS class actually defined (`.note.good` was used on one page before it existed in that page's CSS). Splicing big blocks in with a script reliably leaves one stray closing tag; the check finds it in seconds.
- Route tables give materials **per craft**. Sources usually publish route totals instead, so divide, and say that the per-craft figure is derived.
