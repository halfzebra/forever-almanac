# Instructions for GitHub Copilot's coding agent

This repo is a static site built from data files for *World of Warcraft: Forever*. The
full house rules live in [AGENTS.md](../AGENTS.md) - read it before editing anything.
If you were assigned an issue titled "Update content for changed source: ...", it was
filed automatically by `.github/workflows/watch-sources.yml` after `watch.js` detected
that a cited source page changed. The rules below are the ones that matter most for
that kind of task; they restate AGENTS.md, they don't replace it.

- **Content is prose, data is tables.** Edit `content/**.html` and `data/**.json` only.
  Never add a class, spec, or profession name to `build.js`, `validate.js`, `assets/`,
  or `templates/` - CI greps for this and fails the build on purpose.
- **Never resolve a source disagreement silently.** If the changed source now disagrees
  with another source already cited for the same claim, print both numbers and say
  which source said which. Do not just pick one.
- **Never fill a gap with vanilla or TBC knowledge.** If the source doesn't say, say
  that the gap exists. A stated gap is the correct outcome, not a bug.
- **If you split a reported ten-level band into per-level ladder rows**, mark that row
  `"derived": true` with a `note` saying so, and make sure it carries `tree` and `row`
  - `validate.js` re-derives the whole ladder from those fields and fails loudly if
    either is missing.
- Before opening a PR, run `node build.js --base=/ && node validate.js` and confirm it
  ends "no problems". Fix whatever it flags rather than working around it.
- **Open the PR as a draft, and do not merge it.** A human reviews sourcing judgment
  calls (disagreements, gaps, confidence) that CI cannot check.
