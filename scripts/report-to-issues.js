#!/usr/bin/env node
"use strict";
/* The Forever Almanac - turn a watch.js change report into draft work for
 * GitHub Copilot's coding agent.
 *
 * Run after `node watch.js` finds a change (exit code 10) and writes
 * sources/REPORT.md. For each changed source, files one GitHub issue naming
 * the source, what changed, and which content/data files cite it (so Copilot
 * doesn't have to go find that itself), then tries to assign it to Copilot so
 * the agent starts automatically. Requires `gh` on PATH and GH_TOKEN set.
 *
 * The exact login GitHub uses to assign its coding agent has moved around
 * over time, so this tries a short list of candidates and reports which one
 * (if any) worked - confirm it with one manual assignment via the GitHub UI
 * if none of them stick, and add the real login to CANDIDATE_ASSIGNEES.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const CANDIDATE_ASSIGNEES = ["copilot-swe-agent", "Copilot"];

const META_HEADINGS = new Set([
  "Not reachable from CI, run `node watch.js` locally to cover these",
  "Not fetched, check by hand",
  "Did not answer",
  "Before merging",
]);

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", cwd: ROOT });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
}

function parseChangedBlocks(report) {
  const chunks = ("\n" + report).split("\n### ").slice(1);
  const blocks = [];
  for (const chunk of chunks) {
    const nl = chunk.indexOf("\n");
    if (nl < 0) continue;
    const heading = chunk.slice(0, nl).trim();
    const body = chunk.slice(nl + 1).trim();
    if (META_HEADINGS.has(heading)) continue;
    const urlMatch = body.match(/<(https?:\/\/[^>]+)>/);
    if (!urlMatch) continue;
    blocks.push({ heading, url: urlMatch[1], body });
  }
  return blocks;
}

function findSourceId(sources, url) {
  return Object.keys(sources).find((id) => sources[id].url === url);
}

function fileIssue(id, block) {
  const bodyPath = path.join(ROOT, `.issue-body-${id}.md`);
  const body = [
    `Source changed: **${block.heading}**`,
    `<${block.url}>`,
    "",
    block.body,
    "",
    "---",
    "",
    "Follow `.github/copilot-instructions.md` and `AGENTS.md` for this repo's sourcing " +
      "and house rules before editing. Edit only `content/**` and `data/**`. Run " +
      "`node build.js --base=/ && node validate.js` and confirm it ends \"no problems\" " +
      "before opening the PR. Open the PR as a draft; do not merge it.",
  ].join("\n");
  fs.writeFileSync(bodyPath, body + "\n");

  let url;
  try {
    url = run("gh", [
      "issue",
      "create",
      "--title",
      `Update content for changed source: ${id}`,
      "--body-file",
      bodyPath,
      "--label",
      "sources",
    ]).trim();
  } finally {
    fs.unlinkSync(bodyPath);
  }

  const number = url.split("/").pop();
  console.log(`Filed issue #${number} for ${id}: ${url}`);

  for (const assignee of CANDIDATE_ASSIGNEES) {
    try {
      run("gh", ["issue", "edit", number, "--add-assignee", assignee]);
      console.log(`Assigned #${number} to "${assignee}".`);
      return;
    } catch (err) {
      console.warn(`Could not assign #${number} to "${assignee}": ${err.message.split("\n")[0]}`);
    }
  }
  console.warn(
    `Could not assign #${number} to any candidate in CANDIDATE_ASSIGNEES. ` +
      `Assign it to Copilot by hand via the GitHub UI, then fix CANDIDATE_ASSIGNEES ` +
      `in scripts/report-to-issues.js with the login that worked.`
  );
}

(function main() {
  const sources = readJSON("data/sources.json");
  const report = fs.readFileSync(path.join(ROOT, "sources/REPORT.md"), "utf8");
  const blocks = parseChangedBlocks(report);

  if (!blocks.length) {
    console.log("No changed-source blocks found in sources/REPORT.md - nothing to file.");
    return;
  }

  for (const block of blocks) {
    const id = findSourceId(sources, block.url);
    if (!id) {
      console.warn(`Skipping "${block.heading}" (${block.url}): no matching id in data/sources.json.`);
      continue;
    }
    fileIssue(id, block);
  }
})();
