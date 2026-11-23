#!/usr/bin/env node
"use strict";
/* The Forever Almanac - validate the built site.
 *
 *   node validate.js [--out=docs]
 *
 * Everything here runs against the SHIPPED HTML in docs/, not against the
 * drafts it was built from. That is deliberate: the point is to catch an edit
 * that broke a table after the arithmetic was done, which a check against the
 * source data would happily miss.
 *
 * Exit code 1 if anything fails. CI runs build then this.
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const args = process.argv.slice(2);
const argOf = (n, d) => {
  const hit = args.find((a) => a.startsWith("--" + n + "="));
  return hit ? hit.slice(n.length + 3) : d;
};
const OUT = path.resolve(ROOT, argOf("out", "docs"));

const fails = [];
const fail = (where, msg) => fails.push(`${where}: ${msg}`);
let checks = 0;
const ran = () => checks++;

function walk(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

const pages = walk(OUT, ".html");
if (!pages.length) {
  console.error("nothing to validate - run build.js first");
  process.exit(1);
}

const VOID = new Set(["meta", "link", "br", "hr", "img", "input", "source", "col", "area", "base", "embed", "param", "track", "wbr"]);

/* ---------------------------------------------- 1. every tag is balanced */

function checkTags(file, html) {
  ran();
  /* comments, and the contents of script/style, are not markup */
  let s = html.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2>)/gi, (m, open, tag, body, close) =>
    open + body.replace(/[<>]/g, " ") + close
  );

  const stack = [];
  const lineOf = (idx) => s.slice(0, idx).split("\n").length;

  for (const m of s.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g)) {
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const selfClosed = /\/\s*$/.test(m[3]);
    if (VOID.has(tag) || selfClosed) continue;
    if (!closing) {
      stack.push({ tag, line: lineOf(m.index) });
    } else {
      const top = stack.pop();
      if (!top) {
        fail(file, `line ${lineOf(m.index)}: </${tag}> with nothing open`);
        return;
      }
      if (top.tag !== tag) {
        fail(file, `line ${lineOf(m.index)}: </${tag}> closes <${top.tag}> opened on line ${top.line}`);
        return;
      }
    }
  }
  if (stack.length) {
    const t = stack[stack.length - 1];
    fail(file, `<${t.tag}> opened on line ${t.line} is never closed`);
  }
}

/* -------------------------------- 2. section open/close counts agree too */

function checkSectionCount(file, html) {
  ran();
  const open = (html.match(/<section\b/g) || []).length;
  const close = (html.match(/<\/section>/g) || []).length;
  if (open !== close) fail(file, `${open} <section> against ${close} </section>`);
}

/* ------------------------------------------------- table row extraction */

function tablesOf(html) {
  const out = [];
  for (const m of html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/g)) {
    const attrs = {};
    for (const a of m[1].matchAll(/([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attrs[a[1]] = a[2] !== undefined ? a[2] : a[3];
    }
    const body = (m[2].match(/<tbody>([\s\S]*?)<\/tbody>/) || [, m[2]])[1];
    const rows = [];
    for (const r of body.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g)) {
      const rattrs = {};
      for (const a of r[1].matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) rattrs[a[1]] = a[2];
      const cells = [...r[2].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) =>
        c[1].replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, " ").trim()
      );
      rows.push({ attrs: rattrs, cells });
    }
    out.push({ attrs, rows });
  }
  return out;
}

/* ------------------- 3. route and ladder rows are contiguous, no gaps */

function checkContiguity(file, html) {
  for (const t of tablesOf(html)) {
    const by = t.attrs["data-drive-by"];
    if (by !== "skill" && by !== "level") continue;
    ran();
    const id = t.attrs.id || by;
    const inclusive = t.attrs["data-drive-bound"] !== "exclusive";
    const rows = t.rows.filter((r) => r.attrs["data-min"] != null);
    if (!rows.length) {
      fail(file, `table #${id} drives on ${by} but has no rows with data-min`);
      continue;
    }
    for (let i = 1; i < rows.length; i++) {
      const prevMax = Number(rows[i - 1].attrs["data-max"]);
      const min = Number(rows[i].attrs["data-min"]);
      const want = inclusive ? prevMax + 1 : prevMax;
      if (min !== want) {
        fail(
          file,
          `table #${id} row ${i + 1}: starts at ${min}, but the row before ends at ${prevMax} ` +
            `(${inclusive ? "inclusive" : "exclusive"} bounds want ${want}) - ` +
            (min > want ? "that is a gap" : "that is an overlap")
        );
      }
    }
    for (const r of rows) {
      const lo = Number(r.attrs["data-min"]);
      const hi = Number(r.attrs["data-max"]);
      if (!(hi >= lo)) fail(file, `table #${id}: a row runs ${lo} to ${hi}, backwards`);
    }
  }
}

/* ------------- 4-7. the talent arithmetic, re-derived from the shipped page */

const TREE_GATE = (row) => 5 * (row - 1);

function checkLadders(file, html) {
  for (const t of tablesOf(html)) {
    if (t.attrs["data-drive-by"] !== "level") continue;
    const id = t.attrs.id || "ladder";
    const rows = t.rows.filter((r) => r.attrs["data-min"] != null);
    if (!rows.length) continue;

    const start = Number(t.attrs["data-start-level"] || 10);
    const first = Number(rows[0].attrs["data-min"]);
    const last = Number(rows[rows.length - 1].attrs["data-max"]);

    /* 4. the ladder covers its whole level range exactly once */
    ran();
    if (first !== start) fail(file, `ladder #${id} starts at level ${first}, expected ${start}`);
    if (last !== 60) fail(file, `ladder #${id} ends at level ${last}, expected 60`);

    /* 5. points placed never exceed points available, which is level - 9 */
    ran();
    let spent = 0;
    const perTree = {};
    for (const r of rows) {
      const lo = Number(r.attrs["data-min"]);
      const hi = Number(r.attrs["data-max"]);
      const tree = r.attrs["data-tree"];
      const rowNum = r.attrs["data-row"] ? Number(r.attrs["data-row"]) : null;
      if (!tree || !rowNum) {
        /* Without these the row-gate check cannot run at all, and a check that
           silently does nothing is worse than no check. */
        fail(file, `ladder #${id}: row "${r.cells[1] || "?"}" is missing data-tree or data-row`);
        continue;
      }

      /* 6. a row's first point cannot be spent before that tree has paid for
         the row it sits in. Checked once per ladder row, not once per level,
         because one misplaced talent is one problem. */
      const need = TREE_GATE(rowNum);
      const have = perTree[tree] || 0;
      if (have < need) {
        fail(
          file,
          `ladder #${id}: "${r.cells[1] || "?"}" sits in ${tree} row ${rowNum}, which needs ` +
            `${need} points in ${tree}, but only ${have} are placed there by level ${lo}`
        );
      }

      for (let lvl = lo; lvl <= hi; lvl++) {
        spent += 1;
        perTree[tree] = (perTree[tree] || 0) + 1;
        const available = lvl - 9;
        if (spent > available) {
          fail(file, `ladder #${id}: ${spent} points placed by level ${lvl}, which only grants ${available}`);
        }
      }
    }

    /* 7. the finished build matches the spread the source published */
    const spreadRaw = t.attrs["data-published-spread"];
    if (spreadRaw) {
      ran();
      let want;
      try {
        want = JSON.parse(spreadRaw);
      } catch (err) {
        fail(file, `ladder #${id}: data-published-spread is not valid JSON`);
        want = null;
      }
      if (want) {
        for (const [tree, n] of Object.entries(want)) {
          const got = perTree[tree] || 0;
          if (got !== n) {
            fail(
              file,
              `ladder #${id}: ${got} points land in ${tree}, but the source publishes ${n} at level 60`
            );
          }
        }
        const total = Object.values(want).reduce((a, b) => a + b, 0);
        if (total !== 51) fail(file, `ladder #${id}: the published spread totals ${total}, not 51`);
      }
    }
  }
}

/* ------------------- 8. every class used in the HTML exists in the CSS */

const cssText = ["site.css", "tokens.css"]
  .map((f) => path.join(OUT, "assets", f))
  .filter(fs.existsSync)
  .map((p) => fs.readFileSync(p, "utf8"))
  .join("\n");
const cssClasses = new Set([...cssText.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
/* classes the script adds at runtime still have to be defined, so they are not
   exempt. These are the ones that carry no styling by design. */
const UNSTYLED_BY_DESIGN = new Set(["wrap", "chardata", "fields", "chead", "who2"]);

function checkClasses(file, html) {
  ran();
  const used = new Set();
  for (const m of html.matchAll(/\sclass="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) used.add(c);
  }
  for (const c of used) {
    if (!cssClasses.has(c) && !UNSTYLED_BY_DESIGN.has(c)) {
      fail(file, `class "${c}" is used but defined nowhere in the stylesheets`);
    }
  }
}

/* ------- 9-10. the data behind the site hangs together (checked once) */

function checkData() {
  const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
  const has = (p) => fs.existsSync(path.join(ROOT, p));

  ran();
  const sources = has("data/sources.json") ? read("data/sources.json") : {};
  for (const [id, s] of Object.entries(sources)) {
    if (!s.url) fail("data/sources.json", `"${id}" has no url`);
    if (!["text", "hash", "never"].includes(s.watch)) {
      fail("data/sources.json", `"${id}" has watch "${s.watch}", which is not text, hash or never`);
    }
    if (s.watch === "never" && !s.watchWhy) {
      fail("data/sources.json", `"${id}" is never watched but does not say why`);
    }
  }

  ran();
  const tokens = has("data/tokens.json") ? read("data/tokens.json") : {};
  for (const [slug, t] of Object.entries(tokens)) {
    for (const k of ["light", "lightSoft", "dark", "darkSoft"]) {
      if (!t[k]) fail("data/tokens.json", `"${slug}" has no ${k}`);
    }
  }

  /* 10. a character's class, specs and professions all resolve */
  for (const f of walk(path.join(ROOT, "data", "characters"), ".json")) {
    ran();
    const rel = path.relative(ROOT, f);
    const rec = JSON.parse(fs.readFileSync(f, "utf8"));
    if (!rec.slug || !rec.name || !rec.class) {
      fail(rel, "needs at least slug, name and class");
      continue;
    }
    if (!has(`data/classes/${rec.class}.json`)) fail(rel, `class "${rec.class}" has no record in data/classes/`);
    const cls = has(`data/classes/${rec.class}.json`) ? read(`data/classes/${rec.class}.json`) : { trees: [] };
    for (const spec of rec.specs || []) {
      if (!(cls.trees || []).some((t) => t.slug === spec)) {
        fail(rel, `spec "${spec}" is not one of ${rec.class}'s trees`);
      }
    }
    for (const prof of rec.professions || []) {
      if (!has(`data/professions/${prof}.json`)) fail(rel, `profession "${prof}" has no record in data/professions/`);
    }
    const buffs = has("data/camp/class-buffs.json") ? read("data/camp/class-buffs.json").buffs || {} : {};
    for (const b of rec.classBuffs || []) {
      if (!buffs[b]) fail(rel, `class buff "${b}" is not in data/camp/class-buffs.json`);
    }
  }

  /* every camp object names a profession and buffs that exist */
  if (has("data/camp/objects.json")) {
    ran();
    const buffs = has("data/camp/class-buffs.json") ? read("data/camp/class-buffs.json").buffs || {} : {};
    for (const o of read("data/camp/objects.json").objects || []) {
      if (!has(`data/professions/${o.profession}.json`)) {
        fail("data/camp/objects.json", `"${o.name}" names profession "${o.profession}", which has no record`);
      }
      for (const b of o.clashesWith || []) {
        if (!buffs[b]) fail("data/camp/objects.json", `"${o.name}" clashes with "${b}", which is not a known buff`);
      }
    }
  }
}

/* ------------------------------------------------------------------ run */

for (const p of pages) {
  const file = path.relative(ROOT, p);
  const html = fs.readFileSync(p, "utf8");
  checkTags(file, html);
  checkSectionCount(file, html);
  checkContiguity(file, html);
  checkLadders(file, html);
  checkClasses(file, html);
}
checkData();

console.log(`${checks} checks over ${pages.length} pages`);
if (fails.length) {
  console.log(`\n${fails.length} failure${fails.length === 1 ? "" : "s"}:`);
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("no problems");
