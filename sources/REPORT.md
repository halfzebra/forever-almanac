6 sources have changed.

### Method, Tailoring 1-300
<https://www.method.gg/wow-forever/tailoring-in-wow-forever-1-300-leveling-guide-and-trainers>

words 1151 to 1153

Cited by:
- `content/professions/tailoring.html`
- `data/routes/tailoring.json`

### Timesaver, Priest weapons 1-60
<https://timesaver.gg/blog/wow-forever-priest-leveling-weapons>

words 3284 to 3281; the numbers on the page changed (486 to 482 of them)

Cited by:
- `data/quest-rewards/priest-wands.json`

### Timesaver, Rogue weapons 1-60
<https://timesaver.gg/blog/wow-forever-rogue-leveling-weapons>

words 3229 to 3226; the numbers on the page changed (523 to 519 of them)

Cited by:
- `content/classes/rogue.html`

### Timesaver, Tailoring
<https://timesaver.gg/tools/wow-forever/professions/tailoring>

words 18975 to 18993; the numbers on the page changed (5811 to 5816 of them)

Cited by:
- `data/routes/tailoring.json`

### WoW-Professions, Leatherworking 1-300
<https://www.wow-professions.com/forever/leatherworking-leveling-guide>

words 2211 to 2318; the numbers on the page changed (318 to 324 of them)

Cited by:
- `content/professions/leatherworking.html`
- `data/routes/leatherworking.json`
- `data/trainers/leatherworking.json`

### WoW-Professions, Tailoring 1-300
<https://www.wow-professions.com/forever/tailoring-leveling-guide>

the text changed but no structural signal did

Cited by:
- `data/gates.json`
- `data/routes/tailoring.json`

### Not reachable from CI, run `node watch.js` locally to cover these

- [Zockify, Enchanting](https://www.zockify.com/forever/professions/enchanting/) - returns 403 to GitHub runner IPs but 200 from a residential one, same user agent, as of 2026-11-23
- [Zockify, Leatherworking](https://www.zockify.com/forever/professions/leatherworking/) - returns 403 to GitHub runner IPs but 200 from a residential one, same user agent, as of 2026-11-23
- [Zockify, Skinning 1-300](https://www.zockify.com/forever/professions/skinning/) - returns 403 to GitHub runner IPs but 200 from a residential one, same user agent, as of 2026-11-23
- [Zockify, Tailoring](https://www.zockify.com/forever/professions/tailoring/) - returns 403 to GitHub runner IPs but 200 from a residential one, same user agent, as of 2026-11-23
- [Zockify, Tailoring trainers](https://www.zockify.com/forever/professions/tailoring/trainers/) - returns 403 to GitHub runner IPs but 200 from a residential one, same user agent, as of 2026-11-23

### Not fetched, check by hand

- [conquestcapped, class quests](https://conquestcapped.com/guides/wow-forever/wow-forever-class-quests/) - returns a Cloudflare challenge to any automated client as of 2026-11-23, so it cannot be fetched at all. Read by hand.
- [Maxroll, Priest leveling](https://maxroll.gg/wow-forever/class-guides/priest-leveling-guide) - Ziff Davis states in robots.txt that automated retrieval is prohibited without written permission, naming RAG and AI databases. Read by hand only.
- [Maxroll, Rogue leveling](https://maxroll.gg/wow-forever/class-guides/rogue-leveling-guide) - Ziff Davis states in robots.txt that automated retrieval is prohibited without written permission, naming RAG and AI databases. Read by hand.

### Before merging

- [ ] read each changed page
- [ ] check the claims the cited files make against it
- [ ] where the sources now disagree, print both and say which said what
- [ ] `node build.js --base=/ && node validate.js`

This branch changes only `sources/`. The content edit is a separate, deliberate commit.
