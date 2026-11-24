#!/usr/bin/env node
"use strict";
/* The Forever Almanac - build.
 *
 *   node build.js [--base=/] [--out=docs]
 *
 * Reads content/ (prose fragments), data/ (every table, every record) and
 * templates/, and writes a static site to docs/.
 *
 * The rule this file lives by: it never names a class, a spec or a profession.
 * Pages, nav, tokens, tables and character cards are all discovered by
 * scanning data/ and content/, so adding a character or a class is adding a
 * file, never an edit here.
 *
 * Field values out of data/ are written into the HTML raw, on purpose - they
 * carry our own markup (links, <em>, coordinates). Attribute values are
 * sanitised, because they come from the same files and a stray quote would
 * break the document silently.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = __dirname;
const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const hit = args.find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = (() => {
  let b = argOf("base", "/");
  if (!b.startsWith("/")) b = "/" + b;
  if (!b.endsWith("/")) b += "/";
  return b;
})();
const OUT = path.resolve(ROOT, argOf("out", "docs"));

/* ---------------------------------------------------------------- helpers */

const read = (p) => fs.readFileSync(p, "utf8");
const exists = (p) => fs.existsSync(p);
const attr = (v) => String(v == null ? "" : v).replace(/[<>"']/g, "");
const esc = (v) =>
  String(v == null ? "" : v).replace(/&(?![a-zA-Z#][a-zA-Z0-9]*;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const url = (p) => BASE + String(p).replace(/^\/+/, "");
const DASH = "&ndash;";
const problems = [];
const notes = [];
const warn = (msg) => problems.push(msg);
const note = (msg) => notes.push(msg);

function walk(dir, ext, out = []) {
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

function writeFile(rel, body) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

/* Last touched, for the "checked" line. Git if we have it, mtime otherwise. */
const gitDates = new Map();
function lastTouched(relFile) {
  if (gitDates.has(relFile)) return gitDates.get(relFile);
  let date = null;
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", relFile], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (out) date = out;
  } catch (err) {
    /* not a repo yet, or never committed - fall through */
  }
  if (!date) {
    try {
      date = fs.statSync(path.join(ROOT, relFile)).mtime.toISOString().slice(0, 10);
    } catch (err) {
      date = null;
    }
  }
  gitDates.set(relFile, date);
  return date;
}

/* ------------------------------------------------------------------- data */

/* Every .json under data/ keyed by its path without the extension, so
   data/<folder>/<name>.json is addressed as "<folder>/<name>". */
const DATA = new Map();
for (const p of walk(path.join(ROOT, "data"), ".json")) {
  const key = path.relative(path.join(ROOT, "data"), p).replace(/\\/g, "/").replace(/\.json$/, "");
  try {
    DATA.set(key, JSON.parse(read(p)));
  } catch (err) {
    warn(`data/${key}.json is not valid JSON: ${err.message}`);
  }
}
const data = (key) => DATA.get(key);
const dataFile = (key) => `data/${key}.json`;
const groupOf = (prefix) =>
  [...DATA.keys()]
    .filter((k) => k.startsWith(prefix + "/"))
    .map((k) => ({ key: k, slug: k.slice(prefix.length + 1), rec: DATA.get(k) }));

const site = data("site") || { title: "Almanac", sections: [] };
const sources = data("sources") || {};
const tokens = data("tokens") || {};

/* source id -> files that cite it, for the watcher's PR body */
const citations = new Map();
function cite(id, file) {
  if (!sources[id]) warn(`${file} cites unknown source "${id}"`);
  if (!citations.has(id)) citations.set(id, new Set());
  citations.get(id).add(file);
}

/* ------------------------------------------------------- rendering: parts */

function tokenAttr(slug) {
  if (!slug) return "";
  if (!tokens[slug]) warn(`no colour token for "${slug}" in data/tokens.json`);
  return ` data-token="${attr(slug)}"`;
}

/* A table, straight out of a data envelope. Column order, field names, row
   classes and what the row highlights against all come from the file. */
function renderTable(key, opts = {}) {
  const d = data(key);
  if (!d) {
    warn(`${opts.from || "?"} wants table "${key}", which does not exist`);
    return `<p class="note"><strong>Missing table.</strong> ${esc(key)} has not been written yet.</p>`;
  }
  (d.sources || []).forEach((id) => cite(id, dataFile(key)));

  const cols = d.columns || [];
  const head = cols.map((c) => `<th${c.width ? ` style="width:${attr(c.width)}"` : ""}>${c.label}</th>`).join("");

  const body = (d.rows || [])
    .map((row) => {
      const a = [];
      if (d.kind === "gates") {
        if (row.lvl != null) a.push(`data-lvl="${attr(row.lvl)}"`);
      } else if (row.min != null) {
        a.push(`data-min="${attr(row.min)}"`, `data-max="${attr(row.max == null ? row.min : row.max)}"`);
      }
      if (row.class) a.push(`class="${attr(row.class)}"`);
      if (row.badge) a.push(`data-badge="${attr(row.badge)}"`);
      if (row.token) a.push(`data-token="${attr(row.token)}"`);
      /* A talent row's tree and tree-row travel into the HTML as attributes so
         the validator can re-derive the arithmetic without depending on which
         column happens to hold them. */
      /* An alternative to the row above it, covering the same band. It is not
         a step in the chain, so the contiguity check must skip it. */
      if (row.alt) a.push(`data-alt="true"`);
      if (row.tree) a.push(`data-tree="${attr(row.tree)}"`);
      if (row.row) a.push(`data-row="${attr(row.row)}"`);

      const cells = cols
        .map((c) => {
          const cls = c.class ? ` class="${attr(c.class)}"` : "";
          let v;
          if (c.field === "range") {
            const lo = row.min;
            const hi = row.max == null ? row.min : row.max;
            v = lo === hi || hi == null ? String(lo) : `${lo}${DASH}${hi}`;
          } else {
            v = row[c.field];
          }
          return `<td${cls}>${v == null ? "" : v}</td>`;
        })
        .join("");
      return `      <tr${a.length ? " " + a.join(" ") : ""}>${cells}</tr>`;
    })
    .join("\n");

  const tAttrs = [];
  if (opts.id) tAttrs.push(`id="${attr(opts.id)}"`);
  /* kind is metadata, not styling: a stylesheet hook that no rule uses would
     fail the class check, and rightly so. */
  if (d.kind) tAttrs.push(`data-kind="${attr(d.kind)}"`);
  if (d.drive && d.drive.by) {
    tAttrs.push(`data-drive-by="${attr(d.drive.by)}"`);
    if (d.drive.key) tAttrs.push(`data-drive-key="${attr(d.drive.key)}"`);
    /* A route row's max is the skill it carries you TO, so you leave the row
       when you reach it. A ladder row's max is the last level you spend on,
       so you are still on it at that level. The data says which. */
    const bound = d.drive.bound || (d.drive.by === "level" ? "inclusive" : "exclusive");
    tAttrs.push(`data-drive-bound="${attr(bound)}"`);
  }
  /* Carried into the shipped HTML so the validator can re-derive the talent
     arithmetic from the page itself rather than from the draft it came from. */
  if (d.publishedSpread) tAttrs.push(`data-published-spread='${JSON.stringify(d.publishedSpread)}'`);
  if (d.startLevel) tAttrs.push(`data-start-level="${attr(d.startLevel)}"`);
  if (d.derived) tAttrs.push(`data-derived="true"`);

  const note = d.note ? `\n<p class="tnote">${d.note}</p>` : "";
  return `<div class="tscroll">
  <table${tAttrs.length ? " " + tAttrs.join(" ") : ""}>
    <thead><tr>${head}</tr></thead>
    <tbody>
${body}
    </tbody>
  </table>
</div>${note}`;
}

/* Trainer cards: the .npc / .rank / .who / .where / .co markup, from data. */
function renderTrainers(key, opts = {}) {
  const d = data(key);
  if (!d) {
    warn(`${opts.from || "?"} wants trainers "${key}", which do not exist`);
    return "";
  }
  (d.sources || []).forEach((id) => cite(id, dataFile(key)));
  const groups = (d.groups || []).map((g) => {
    const npcs = (g.trainers || [])
      .map((n) => {
        const where = [n.where, (n.coords || []).map((c) => `<span class="co">${esc(c)}</span>`).join(" and "), n.note]
          .filter(Boolean)
          .join(" &middot; ");
        return `    <div class="npc"><span class="rank">${n.rank || ""}</span><span class="who">${n.who || ""}</span><span class="where">${where}</span></div>`;
      })
      .join("\n");
    return `  <div class="card"${tokenAttr(g.token || d.token)}>
    <h3>${g.label || ""}</h3>
${npcs}
  </div>`;
  });
  return `<div class="cols">\n${groups.join("\n")}\n</div>`;
}

function renderCite(id, file) {
  const s = sources[id];
  if (!s) {
    warn(`${file} cites unknown source "${id}"`);
    return "";
  }
  cite(id, file);
  return `<a class="cite" href="${attr(s.url)}" rel="nofollow noreferrer">${esc(s.site || id)}</a>`;
}

/* The confidence section, collected from the page's own meta plus the
   confidence declared by every data file the page pulled in. */
const CONF_BUCKETS = [
  { key: "solid", cls: "solid", label: "Solid" },
  { key: "check", cls: "mixed", label: "Check in game" },
  { key: "provisional", cls: "soft", label: "Still provisional" },
];
function renderConfidence(collected, file) {
  const merged = { solid: [], check: [], provisional: [] };
  for (const src of collected) {
    for (const b of CONF_BUCKETS) {
      for (const item of (src || {})[b.key] || []) merged[b.key].push(item);
    }
  }
  const total = CONF_BUCKETS.reduce((n, b) => n + merged[b.key].length, 0);
  if (!total) {
    warn(`${file} has an <x-confidence> but declares no confidence claims`);
    return "";
  }
  const cols = CONF_BUCKETS.filter((b) => merged[b.key].length)
    .map(
      (b) => `  <div class="${b.cls}">
    <h3>${b.label}</h3>
    <ul>${merged[b.key].map((i) => `<li>${i}</li>`).join("")}</ul>
  </div>`
    )
    .join("\n");
  return `<div class="conf">\n${cols}\n</div>`;
}

/* ------------------------------------------------- the library and indexes */

/* Every section's pages, discovered from content/ and ordered by the records
   in data/, so an unwritten page still shows as a gap rather than vanishing. */
function pagesIn(sectionSlug) {
  const dir = path.join(ROOT, "content", sectionSlug);
  const written = new Set(
    walk(dir, ".html")
      .map((p) => path.basename(p, ".html"))
      .filter((s) => s !== "index")
  );
  const records = groupOf(sectionSlug === "classes" ? "classes" : sectionSlug === "professions" ? "professions" : "__none");
  const out = [];
  if (records.length) {
    for (const r of records) {
      out.push({
        slug: r.slug,
        name: (r.rec && r.rec.name) || r.slug,
        token: (r.rec && r.rec.token) || r.slug,
        kind: (r.rec && r.rec.kind) || null,
        gap: !written.has(r.slug),
        gapNote: (r.rec && r.rec.gapNote) || "nothing researched yet",
      });
      written.delete(r.slug);
    }
  }
  /* pages with prose but no record of their own, e.g. a section's own index page */
  for (const slug of [...written].sort()) {
    const meta = pageMeta(sectionSlug, slug);
    out.push({ slug, name: (meta && meta.short) || (meta && meta.title) || slug, token: meta && meta.token, gap: false });
  }
  return out;
}

const metaCache = new Map();
function pageMeta(section, slug) {
  const k = `${section}/${slug}`;
  if (metaCache.has(k)) return metaCache.get(k);
  const p = path.join(ROOT, "content", section, slug + ".html");
  let meta = null;
  if (exists(p)) {
    const m = read(p).match(/<script type="application\/json" id="meta">([\s\S]*?)<\/script>/);
    if (m) {
      try {
        meta = JSON.parse(m[1]);
      } catch (err) {
        warn(`content/${k}.html has an unparseable meta block: ${err.message}`);
      }
    }
  }
  metaCache.set(k, meta);
  return meta;
}

function renderLibrary() {
  const groups = site.sections.map((s) => {
    const items = pagesIn(s.slug)
      .map((p) =>
        p.gap
          ? `<span title="${attr(p.gapNote)}">${esc(p.name)}</span>`
          : `<a href="${url(s.slug + "/" + p.slug + "/")}"${tokenAttr(p.token)}>${esc(p.name)}</a>`
      )
      .join("\n    ");
    return `  <div class="lib-group">
    <h3><a href="${url(s.slug + "/")}">${esc(s.label)}</a></h3>
    <div class="lib-list">
    ${items}
    </div>
  </div>`;
  });
  return `<div class="lib">\n${groups.join("\n")}\n</div>`;
}

function renderIndex(sectionSlug) {
  const s = site.sections.find((x) => x.slug === sectionSlug);
  const items = pagesIn(sectionSlug)
    .map((p) => {
      const meta = p.gap ? null : pageMeta(sectionSlug, p.slug);
      const lede = meta && meta.lede ? `<p>${meta.lede}</p>` : p.gap ? `<p>${esc(p.gapNote)}</p>` : "";
      const title = p.gap
        ? `<h3>${esc(p.name)}</h3>`
        : `<h3><a href="${url(sectionSlug + "/" + p.slug + "/")}">${esc(p.name)}</a></h3>`;
      return `  <div class="card"${tokenAttr(p.token)}>
    ${title}
    ${lede}
  </div>`;
    })
    .join("\n");
  return `<div class="cols">\n${items}\n</div>`;
}

/* ------------------------------------------------------- character cards */

/* What a character card needs in order to work out "what now" in the browser.
   Only the columns the derivations read, so the inlined JSON stays small. */
/* A character's colour: its own token, else the one its class declares, else
   its class slug. The middle step matters - a class record is where a colour
   belongs, and without it a new character silently has none. */
function characterToken(rec) {
  const cls = data(`classes/${rec.class}`);
  return rec.token || (cls && cls.token) || rec.class;
}

function characterPayload(rec) {
  const out = { slug: rec.slug, name: rec.name, lvl: rec.startLevel || 10, ladders: [], routes: [], gates: [] };

  for (const spec of rec.specs || []) {
    const l = data(`ladders/${rec.class}-${spec}`);
    if (!l) continue;
    out.ladders.push({
      spec,
      name: l.specName || spec,
      rows: (l.rows || []).map((r) => ({ min: r.min, max: r.max == null ? r.min : r.max, talent: r.talent, rank: r.rank, tree: r.tree })),
    });
  }
  for (const prof of rec.professions || []) {
    const r = data(`routes/${prof}`);
    const p = data(`professions/${prof}`);
    out.routes.push({
      prof,
      name: (p && p.name) || prof,
      token: (p && p.token) || prof,
      rows: r ? (r.rows || []).map((x) => ({ min: x.min, max: x.max, craft: x.craft || x.what, each: x.each })) : null,
    });
  }
  const gates = data("gates");
  if (gates) out.gates = (gates.rows || []).map((g) => ({ rank: g.rank, skill: g.skillNum, lvl: g.lvl, caps: g.capsNum }));

  return out;
}

/* The level field plus the inlined JSON payload every derivation in site.js
   reads from. Shared by the home-page wizard and the /me/<slug>/ page -
   both wrap this in a [data-character] element. */
function renderCharacterScaffold(rec) {
  const payload = characterPayload(rec);
  return `<script type="application/json" class="chardata">${JSON.stringify(payload)}</script>
    <div class="field">
      <label for="lvl-${attr(rec.slug)}">Level</label>
      <input id="lvl-${attr(rec.slug)}" data-level type="number" inputmode="numeric" min="1" max="60">
    </div>`;
}

/* A character's talent plan, profession pick and profession tutorial, as one
   block of steps. mode is "guided" (the home-page wizard, gated by JS until
   a level and a class are picked) or "direct" (/me/<slug>/, already unlocked
   because the URL already names the character) - the markup is identical
   either way, only the client-side gating differs. */
function renderCharacterSteps(rec, opts = {}) {
  const mode = opts.mode || "direct";
  const slug = rec.slug;

  const talentsFile = path.join(ROOT, "content", "characters", slug + "-talents.html");
  const talentsProse = exists(talentsFile) ? read(talentsFile) : "";

  const specs = (rec.specs || []).filter((spec) => data(`ladders/${rec.class}-${spec}`));
  const specPane = (spec, i, withToggle) => {
    const l = data(`ladders/${rec.class}-${spec}`);
    const tt = data(`tooltips/${rec.class}-${spec}`);
    const paneId = `talpane-${attr(slug)}-${attr(spec)}`;
    return `<div${withToggle ? ` id="${paneId}"${i === 0 ? "" : " hidden"}` : ""}>
        ${renderTable(`ladders/${rec.class}-${spec}`, { from: `me/${slug}` })}
        ${
          tt
            ? `<details class="ref">
          <summary>${esc(l.specName || spec)} talents, what each one does</summary>
          ${renderTable(`tooltips/${rec.class}-${spec}`, { from: `me/${slug}` })}
        </details>`
            : ""
        }
      </div>`;
  };
  let ladderHtml = "";
  if (specs.length > 1) {
    const buttons = specs
      .map((spec, i) => {
        const l = data(`ladders/${rec.class}-${spec}`);
        const paneId = `talpane-${attr(slug)}-${attr(spec)}`;
        return `<button type="button" data-pane="${paneId}"${i === 0 ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"'}>${esc(l.specName || spec)}</button>`;
      })
      .join("\n      ");
    ladderHtml = `<div class="spectoggle" data-group="wizard-talent-${attr(slug)}" role="group" aria-label="Which build to show">
      ${buttons}
    </div>
    <div class="wizard-ladders">
      ${specs.map((spec, i) => specPane(spec, i, true)).join("\n      ")}
    </div>`;
  } else if (specs.length === 1) {
    ladderHtml = `<div class="wizard-ladders">
      ${specPane(specs[0], 0, false)}
    </div>`;
  }

  const talentsStep = `<div class="step" data-step="talents">
    <div class="step-head"><span class="stepnum">3</span><h2>${esc(rec.name)}'s talent plan</h2></div>
    ${talentsProse}
    ${ladderHtml}
  </div>`;

  const profs = rec.professions || [];
  const withRoute = profs.filter(
    (p) => data(`routes/${p}`) && exists(path.join(ROOT, "content", "professions", p + ".html"))
  );
  const withoutRoute = profs.filter((p) => !withRoute.includes(p));

  const profButtons = withRoute
    .map((prof, i) => {
      const p = data(`professions/${prof}`);
      const name = (p && p.name) || prof;
      const paneId = `profpane-${attr(slug)}-${attr(prof)}`;
      return `<button type="button" data-pane="${paneId}"${i === 0 ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"'}${tokenAttr((p && p.token) || prof)}>${esc(name)}</button>`;
    })
    .join("\n      ");
  const profPicker =
    withRoute.length > 1
      ? `<div class="spectoggle" data-group="wizard-prof-${attr(slug)}" role="group" aria-label="Which profession to show">
      ${profButtons}
    </div>`
      : "";
  const gapNote = withoutRoute.length
    ? `<div class="lib-list">
      ${withoutRoute
        .map((prof) => {
          const p = data(`professions/${prof}`);
          const name = (p && p.name) || prof;
          const gapNoteText = (p && p.gapNote) || "nothing researched yet";
          return `<span title="${attr(gapNoteText)}">${esc(name)}</span>`;
        })
        .join("\n      ")}
    </div>`
    : "";

  const professionStep = `<div class="step" data-step="profession">
    <div class="step-head"><span class="stepnum">4</span><h2>Which profession right now?</h2></div>
    ${profPicker}
    ${gapNote}
  </div>`;

  const tutorialPanes = withRoute
    .map((prof, i) => {
      const p = data(`professions/${prof}`);
      const name = (p && p.name) || prof;
      const paneId = `profpane-${attr(slug)}-${attr(prof)}`;
      const trainersKey = `trainers/${prof}`;
      const hasTrainers = !!data(trainersKey);
      return `<div id="${paneId}"${withRoute.length > 1 && i !== 0 ? " hidden" : ""} class="wizard-prof" data-profession="${attr(prof)}">
    <div class="step" data-step="tutorial">
      <div class="step-head"><span class="stepnum">5</span><h2>Leveling ${esc(name)}</h2></div>
      <div class="field"${tokenAttr((p && p.token) || prof)}>
        <label for="sk-${attr(slug)}-${attr(prof)}">${esc(name)} skill</label>
        <input id="sk-${attr(slug)}-${attr(prof)}" data-skill="${attr(prof)}" type="number" inputmode="numeric" min="1" max="300">
      </div>
      <ol class="tutorial-steps" data-tutorial-host data-tutorial-prof="${attr(prof)}">
        <li class="tutorial-step"><span>Type a skill level to see your route.</span></li>
      </ol>
      ${hasTrainers ? renderTrainers(trainersKey, { from: `me/${slug}` }) : ""}
      ${renderTable(`routes/${prof}`, { from: `me/${slug}` })}
      ${renderTable("gates", { from: `me/${slug}` })}
    </div>
  </div>`;
    })
    .join("\n  ");

  const moreLink =
    mode === "guided"
      ? `<p class="wizard-more"><a href="${url("me/" + slug + "/")}">Open ${esc(rec.name)}'s full page</a> - the level-by-level schedule, what's worth crafting, and who it's all for.</p>`
      : "";

  return `<div class="wizard-char" data-wizard-mode="${attr(mode)}" data-character="${attr(slug)}"${tokenAttr(characterToken(rec))}>
    ${renderCharacterScaffold(rec)}
    ${talentsStep}
    ${professionStep}
    ${tutorialPanes}
    <div class="cardfoot"></div>
    ${moreLink}
  </div>`;
}

/* The home-page wizard: a level field, a picker between every character
   record, and one (initially hidden) block per character holding her steps. */
function renderWizard() {
  const recs = groupOf("characters")
    .map((c) => c.rec)
    .filter(Boolean)
    .sort((a, b) => (a.order || 99) - (b.order || 99) || String(a.name).localeCompare(String(b.name)));
  if (!recs.length) return `<p class="note"><strong>No characters yet.</strong> Add one to data/characters/.</p>`;

  const options = recs
    .map((rec) => {
      const who = [rec.race, rec.className || rec.class].filter(Boolean).join(" &middot; ");
      const profNames = (rec.professions || [])
        .map((p) => (data(`professions/${p}`) || {}).name || p)
        .join(" &amp; ");
      return `<button type="button" class="picker-opt" data-target="wizchar-${attr(rec.slug)}"${tokenAttr(characterToken(rec))}>
        <strong>${esc(rec.name)}</strong><span>${who}${profNames ? " &middot; " + profNames : ""}</span>
      </button>`;
    })
    .join("\n    ");

  const blocks = recs.map((rec) => renderCharacterSteps(rec, { mode: "guided" })).join("\n  ");

  return `<div class="wizard" data-wizard-mode="guided">
  <div class="step" data-step="level">
    <div class="step-head"><span class="stepnum">1</span><h2>What level are you?</h2></div>
    <div class="field">
      <label for="wiz-pending-lvl">Level</label>
      <input id="wiz-pending-lvl" data-wizard-pending-level type="number" inputmode="numeric" min="1" max="60">
    </div>
  </div>

  <div class="step" data-step="class">
    <div class="step-head"><span class="stepnum">2</span><h2>Which character?</h2></div>
    <div class="picker" data-group="wizard-class" role="group" aria-label="Pick a character">
    ${options}
    </div>
  </div>

  ${blocks}
</div>`;
}

/* --------------------------------------------------------- page assembly */

const TPL = read(path.join(ROOT, "templates", "page.html"));

function nav(currentSection) {
  return site.sections
    .map(
      (s) =>
        `<a href="${url(s.slug + "/")}"${s.slug === currentSection ? ' aria-current="page"' : ""}>${esc(s.label)}</a>`
    )
    .join("\n      ");
}

function citesBlock(ids, file) {
  const list = [...new Set(ids)].filter((id) => sources[id]);
  if (!list.length) return "";
  const items = list
    .map((id) => {
      const s = sources[id];
      return `    <li><a href="${attr(s.url)}" rel="nofollow noreferrer">${esc(s.site || id)}</a>${
        s.checked ? ` <span class="when">checked ${esc(s.checked)}</span>` : ""
      }${s.untested ? ` &middot; ${esc(s.untested)}` : ""}</li>`;
    })
    .join("\n");
  const touched = lastTouched(file);
  return `<section class="cites">
  <h2>Where this came from</h2>
  <ul>
${items}
  </ul>
  ${touched ? `<p>This page last changed ${esc(touched)}.</p>` : ""}
</section>`;
}

/* Resolve the <x-...> placeholders in a prose fragment. */
function expand(html, ctx) {
  const confSources = [ctx.meta.confidence];
  const cited = [...(ctx.meta.sources || [])];
  ctx.meta.sources && ctx.meta.sources.forEach((id) => cite(id, ctx.file));

  let out = html;

  out = out.replace(/<x-table\s+([^>]*?)\/?>(?:<\/x-table>)?/g, (m, raw) => {
    const a = parseAttrs(raw);
    const d = data(a.src);
    if (d) {
      confSources.push(d.confidence);
      (d.sources || []).forEach((id) => cited.push(id));
    }
    return renderTable(a.src, { id: a.id, from: ctx.file });
  });

  out = out.replace(/<x-trainers\s+([^>]*?)\/?>(?:<\/x-trainers>)?/g, (m, raw) => {
    const a = parseAttrs(raw);
    const d = data(a.src);
    if (d) {
      confSources.push(d.confidence);
      (d.sources || []).forEach((id) => cited.push(id));
    }
    return renderTrainers(a.src, { from: ctx.file });
  });

  out = out.replace(/<x-cite\s+([^>]*?)\/?>(?:<\/x-cite>)?/g, (m, raw) => {
    const a = parseAttrs(raw);
    cited.push(a.src);
    return renderCite(a.src, ctx.file);
  });

  out = out.replace(/<x-wizard\s*\/?>(?:<\/x-wizard>)?/g, () => renderWizard());
  out = out.replace(/<x-library\s*\/?>(?:<\/x-library>)?/g, () => renderLibrary());
  out = out.replace(/<x-index\s+([^>]*?)\/?>(?:<\/x-index>)?/g, (m, raw) => renderIndex(parseAttrs(raw).section));
  out = out.replace(/<x-confidence\s*\/?>(?:<\/x-confidence>)?/g, () => renderConfidence(confSources, ctx.file));

  const leftover = out.match(/<x-[a-z-]+/);
  if (leftover) warn(`${ctx.file} has an unresolved placeholder ${leftover[0]}>`);

  return { html: out, cited };
}

function parseAttrs(raw) {
  const out = {};
  for (const m of raw.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

function page({ file, section, slug, meta, bodyHtml, cited, depth }) {
  const sec = site.sections.find((s) => s.slug === section);
  const hero = `<header class="hero">
      ${sec || meta.eyebrow ? `<p class="eyebrow">${esc(meta.eyebrow || (sec && sec.label))}</p>` : ""}
      <h1>${meta.title}</h1>
      ${meta.lede ? `<p class="lede">${meta.lede}</p>` : ""}
    </header>`;

  const main = `${hero}\n    <main>\n${bodyHtml}\n${citesBlock(cited, file)}\n    </main>`;

  const out = TPL.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    switch (k) {
      case "lang":
        return "en";
      case "title":
        return esc(stripTags(meta.title)) + (slug === "home" ? "" : " &middot; " + esc(site.title));
      case "description":
        return attr(stripTags(meta.lede || site.tagline || ""));
      case "base":
        return BASE;
      case "brand":
        return esc(site.title);
      case "nav":
        return nav(section);
      case "main":
        return main;
      case "footer":
        return footer(section, slug);
      case "token":
        return meta.token ? ` data-token="${attr(meta.token)}"` : "";
      default:
        return "";
    }
  });
  return out;
}

const stripTags = (s) => String(s == null ? "" : s).replace(/<[^>]*>/g, "");

function footer(section, slug) {
  const links = site.sections
    .map((s) => `<a href="${url(s.slug + "/")}">${esc(s.label)}</a>`)
    .join("\n        ");
  return `<div class="links">
        <a href="${url("")}">Home</a>
        ${links}
        ${site.repo ? `<a href="${attr(site.repo)}">Source</a>` : ""}
      </div>
      <p>${site.footerNote || ""}</p>`;
}

/* --------------------------------------------------------------- the run */

fs.rmSync(OUT, { recursive: true, force: true });

/* every prose page under content/<section>/<slug>.html */
let built = 0;
for (const p of walk(path.join(ROOT, "content"), ".html")) {
  const rel = path.relative(path.join(ROOT, "content"), p).replace(/\\/g, "/");
  const parts = rel.replace(/\.html$/, "").split("/");
  const isHome = rel === "index.html";
  const section = isHome ? null : parts[0];
  const slug = isHome ? "home" : parts[parts.length - 1];
  if (section === "characters") continue; /* prose for a character, pulled in below */

  let raw = read(p);
  let meta = {};
  raw = raw.replace(/<script type="application\/json" id="meta">([\s\S]*?)<\/script>\s*/, (m, json) => {
    try {
      meta = JSON.parse(json);
    } catch (err) {
      warn(`content/${rel} has an unparseable meta block: ${err.message}`);
    }
    return "";
  });
  if (!meta.title) warn(`content/${rel} has no title in its meta block`);

  const file = `content/${rel}`;
  const { html, cited } = expand(raw, { meta, file });
  const outRel = isHome ? "index.html" : slug === "index" ? `${section}/index.html` : `${section}/${slug}/index.html`;
  writeFile(outRel, page({ file, section, slug, meta, bodyHtml: html, cited }));
  built++;
}

/* a page per character, generated from its record plus optional prose */
for (const { slug, rec } of groupOf("characters")) {
  if (!rec) continue;
  const proseFile = path.join(ROOT, "content", "characters", slug + ".html");
  let prose = "";
  let meta = {};
  if (exists(proseFile)) {
    let raw = read(proseFile);
    raw = raw.replace(/<script type="application\/json" id="meta">([\s\S]*?)<\/script>\s*/, (m, json) => {
      try {
        meta = JSON.parse(json);
      } catch (err) {
        warn(`content/characters/${slug}.html has an unparseable meta block: ${err.message}`);
      }
      return "";
    });
    prose = raw;
  }

  const refs = [];
  for (const spec of rec.specs || []) {
    if (data(`ladders/${rec.class}-${spec}`)) {
      refs.push(
        `<a href="${url("classes/" + rec.class + "/")}#${attr(spec)}">${esc(
          (data(`ladders/${rec.class}-${spec}`).specName || spec) + " ladder"
        )}</a>`
      );
    }
  }
  for (const prof of rec.professions || []) {
    const p = data(`professions/${prof}`);
    if (exists(path.join(ROOT, "content", "professions", prof + ".html"))) {
      refs.push(`<a href="${url("professions/" + prof + "/")}">${esc((p && p.name) || prof)}</a>`);
    }
  }

  const body = `${renderCharacterSteps(rec, { mode: "direct" })}
${prose}
<section>
  <div class="section-head">
    <h2>Her reference pages</h2>
    <p>The full ladders, routes and trainer lists live in the library, not here.</p>
  </div>
  <div class="lib-list">
    ${refs.join("\n    ")}
  </div>
</section>`;

  const file = `data/characters/${slug}.json`;
  const { html, cited } = expand(body + "\n" + (meta.confidence ? "<section><x-confidence></x-confidence></section>" : ""), {
    meta,
    file: `content/characters/${slug}.html`,
  });
  writeFile(
    `me/${slug}/index.html`,
    page({
      file,
      section: null,
      slug,
      meta: {
        title: meta.title || rec.name,
        lede: meta.lede || rec.lede || "",
        eyebrow: meta.eyebrow || "Character",
        token: characterToken(rec),
        sources: meta.sources || [],
      },
      bodyHtml: html,
      cited,
    })
  );
  built++;
}

/* tokens.css, the one generated stylesheet */
{
  const light = [];
  const dark = [];
  for (const [slug, t] of Object.entries(tokens)) {
    light.push(`[data-token="${slug}"]{--accent:${t.light};--accent-soft:${t.lightSoft}}`);
    dark.push(`[data-token="${slug}"]{--accent:${t.dark};--accent-soft:${t.darkSoft}}`);
  }
  const css = `/* generated by build.js from data/tokens.json - do not edit */
${light.join("\n")}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) ${dark.join("\n  :root:not([data-theme=\"light\"]) ")}
}
:root[data-theme="dark"] ${dark.join("\n:root[data-theme=\"dark\"] ")}
`;
  writeFile("assets/tokens.css", css);
}

/* static assets */
for (const f of fs.readdirSync(path.join(ROOT, "assets"))) {
  fs.copyFileSync(path.join(ROOT, "assets", f), path.join(OUT, "assets", f));
}

/* what cites what, for the watcher */
const citeOut = {};
for (const [id, files] of [...citations.entries()].sort()) citeOut[id] = [...files].sort();
fs.mkdirSync(path.join(ROOT, "sources"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "sources", "citations.json"), JSON.stringify(citeOut, null, 2) + "\n");

/* unused sources are worth knowing about too */
for (const id of Object.keys(sources)) {
  if (!citations.has(id)) note(`source "${id}" is watched but no page cites it yet`);
}

console.log(`built ${built} pages into ${path.relative(ROOT, OUT)}/ with base ${BASE}`);
if (notes.length) {
  console.log(`\n${notes.length} note${notes.length === 1 ? "" : "s"}:`);
  for (const n of notes) console.log(`  - ${n}`);
}
if (problems.length) {
  console.log(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exitCode = 1;
}
