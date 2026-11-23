#!/usr/bin/env node
"use strict";
/* The Forever Almanac - source change detection.
 *
 *   node watch.js --probe      only fetch and report status codes, write nothing
 *   node watch.js --dry-run    fetch, compare, report, write nothing
 *   node watch.js              fetch, compare, update sources/, write a report
 *
 * What this does NOT do is edit content/ or data/. It tells you a page moved
 * and which of your files cite it; deciding what that means is a judgement
 * call, and the house rule is that judgement calls are not made unattended.
 *
 * What it stores depends on what each site's terms allow, which is recorded
 * per source in data/sources.json:
 *
 *   watch: "text"   keep a normalized text snapshot, so changes show as a diff
 *   watch: "hash"   keep only a hash and a few structural counts - no copy of
 *                   their text ever lands in this repo
 *   watch: "never"  do not fetch at all; the report lists it for a human
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const args = process.argv.slice(2);
const has = (f) => args.includes("--" + f);
const PROBE = has("probe");
const DRY = has("dry-run") || PROBE;
const UA = "forever-almanac/1.0 (personal change detector; one request per source per day)";
/* Some sites answer a residential IP and refuse a datacenter one. Those are
 * marked fetch: "local" and are checked when you run this yourself, not by CI,
 * rather than failing the job every morning. */
const IN_CI = !!(process.env.CI || process.env.GITHUB_ACTIONS);
const PAUSE_MS = 1000;

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const sources = read("data/sources.json");
const citations = fs.existsSync(path.join(ROOT, "sources/citations.json")) ? read("sources/citations.json") : {};
const hashPath = path.join(ROOT, "sources", "hashes.json");
const hashes = fs.existsSync(hashPath) ? JSON.parse(fs.readFileSync(hashPath, "utf8")) : {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------- normalizing */

/* Reduce a page to the text that would change if its advice changed. Scripts,
 * styles, nav and footers move for reasons that have nothing to do with the
 * guide, and would otherwise cry wolf every day. */
function normalize(html) {
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<(script|style|svg|noscript)\b[\s\S]*?<\/\1>/gi, " ");
  const main = s.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main) s = main[1];
  s = s.replace(/<(nav|footer|header|aside)\b[\s\S]*?<\/\1>/gi, " ");
  const rows = (s.match(/<tr\b/gi) || []).length;
  const text = s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { text, rows, words: text ? text.split(" ").length : 0 };
}

/* The numbers on a page are what this project actually cites, so a digest of
 * them tells you whether anything citable moved, without storing their prose. */
function numberDigest(text) {
  const nums = text.match(/\d+/g) || [];
  return { count: nums.length, digest: crypto.createHash("sha256").update(nums.join(",")).digest("hex").slice(0, 16) };
}

/* ---------------------------------------------------------------- fetch */

async function grab(url) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
  });
  const body = await res.text();
  return { status: res.status, bytes: body.length, body, url: res.url };
}

/* ------------------------------------------------------------------ run */

(async () => {
  const changed = [];
  const failed = [];
  const manual = [];
  const local = [];
  const probe = [];
  let checked = 0;

  const ids = Object.keys(sources).sort();
  for (const id of ids) {
    const s = sources[id];
    if (s.watch === "never") {
      manual.push({ id, site: s.site, url: s.url, why: s.watchWhy || "not fetched" });
      continue;
    }
    if (s.fetch === "local" && IN_CI) {
      local.push({ id, site: s.site, url: s.url, why: s.fetchWhy || "cannot be fetched from CI" });
      continue;
    }
    await sleep(PAUSE_MS);
    let got;
    try {
      got = await grab(s.url);
    } catch (err) {
      failed.push({ id, url: s.url, why: err.message });
      continue;
    }
    probe.push({ id, status: got.status, bytes: got.bytes, url: s.url });
    if (got.status !== 200) {
      failed.push({ id, url: s.url, why: `HTTP ${got.status}` });
      continue;
    }
    checked++;
    if (PROBE) continue;

    const norm = normalize(got.body);
    const digest = numberDigest(norm.text);
    const hash = crypto.createHash("sha256").update(norm.text).digest("hex");
    const before = hashes[id];
    const now = {
      hash,
      rows: norm.rows,
      words: norm.words,
      numbers: digest.count,
      numbersDigest: digest.digest,
      seen: new Date().toISOString().slice(0, 10),
    };

    if (!before) {
      changed.push({ id, s, now, before: null, first: true, text: norm.text });
    } else if (before.hash !== hash) {
      changed.push({ id, s, now, before, first: false, text: norm.text });
    }
    hashes[id] = Object.assign({}, now, before ? { firstSeen: before.firstSeen || before.seen } : { firstSeen: now.seen });
  }

  if (PROBE) {
    console.log("source                                   status   bytes");
    for (const p of probe) console.log(`${p.id.padEnd(40)} ${String(p.status).padEnd(7)} ${p.bytes}`);
    for (const f of failed) console.log(`${f.id.padEnd(40)} FAILED  ${f.why}`);
    console.log(
      `\n${checked} of ${probe.length} fetched cleanly; ` +
        `${local.length} skipped as unreachable from CI; ${manual.length} never fetched by policy.`
    );
    return;
  }

  /* ------------------------------------------------------- the report */

  const lines = [];
  const real = changed.filter((c) => !c.first);
  lines.push(real.length ? `${real.length} source${real.length === 1 ? " has" : "s have"} changed.` : "No watched source changed.");
  lines.push("");

  for (const c of real) {
    lines.push(`### ${c.s.site}`);
    lines.push(`<${c.s.url}>`);
    const d = [];
    if (c.before.rows !== c.now.rows) d.push(`table rows ${c.before.rows} to ${c.now.rows}`);
    if (c.before.words !== c.now.words) d.push(`words ${c.before.words} to ${c.now.words}`);
    if (c.before.numbersDigest !== c.now.numbersDigest) {
      d.push(`the numbers on the page changed (${c.before.numbers} to ${c.now.numbers} of them)`);
    }
    lines.push("");
    lines.push(d.length ? d.join("; ") : "the text changed but no structural signal did");
    if (c.s.watch === "hash") {
      lines.push("");
      lines.push(`_Hash only - ${c.s.watchWhy || "this site's terms do not allow keeping a copy"}. Open the page to see what moved._`);
    }
    const cites = citations[c.id] || [];
    lines.push("");
    if (cites.length) {
      lines.push("Cited by:");
      for (const f of cites) lines.push(`- \`${f}\``);
    } else {
      lines.push("Nothing in this repo cites it yet.");
    }
    lines.push("");
  }

  if (local.length) {
    lines.push("### Not reachable from CI, run `node watch.js` locally to cover these");
    lines.push("");
    for (const m of local) lines.push(`- [${m.site}](${m.url}) - ${m.why}`);
    lines.push("");
  }
  if (manual.length) {
    lines.push("### Not fetched, check by hand");
    lines.push("");
    for (const m of manual) lines.push(`- [${m.site}](${m.url}) - ${m.why}`);
    lines.push("");
  }
  if (failed.length) {
    lines.push("### Did not answer");
    lines.push("");
    for (const f of failed) lines.push(`- \`${f.id}\` - ${f.why}`);
    lines.push("");
  }
  if (real.length) {
    lines.push("### Before merging");
    lines.push("");
    lines.push("- [ ] read each changed page");
    lines.push("- [ ] check the claims the cited files make against it");
    lines.push("- [ ] where the sources now disagree, print both and say which said what");
    lines.push("- [ ] `node build.js --base=/ && node validate.js`");
    lines.push("");
    lines.push("This branch changes only `sources/`. The content edit is a separate, deliberate commit.");
  }

  const report = lines.join("\n");
  console.log(report);

  if (!DRY) {
    fs.mkdirSync(path.join(ROOT, "sources", "snapshots"), { recursive: true });
    fs.writeFileSync(hashPath, JSON.stringify(hashes, null, 2) + "\n");
    for (const c of changed) {
      if (c.s.watch === "text") {
        fs.writeFileSync(path.join(ROOT, "sources", "snapshots", `${c.id}.txt`), c.text.replace(/(.{100}) /g, "$1\n") + "\n");
      }
    }
    fs.writeFileSync(path.join(ROOT, "sources", "REPORT.md"), report + "\n");
  }

  /* exit 10 means "there is something to open a PR about" */
  if (real.length) process.exitCode = 10;
})();
