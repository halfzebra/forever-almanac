"use strict";
/* The Forever Almanac - client script.
 *
 * Nothing here names a class, a spec or a profession. Every character, ladder
 * and route arrives as JSON the build inlined; every table says for itself
 * what it highlights against, via data-drive-by / data-drive-key.
 *
 * State lives in localStorage, one record per character, and survives a
 * republish. It never leaves the browser except through the sync link, which
 * the reader copies deliberately. Every read and write is wrapped, because a
 * private window can throw on the accessor itself.
 */
(function () {
  var NS = "forever-almanac:";
  var ACTIVE = NS + "active";

  /* ------------------------------------------------------------- storage */

  function load(slug) {
    var blank = { lvl: null, skills: {}, done: {} };
    try {
      var raw = localStorage.getItem(NS + slug);
      if (!raw) return blank;
      var d = JSON.parse(raw);
      return {
        lvl: typeof d.lvl === "number" ? d.lvl : null,
        skills: d.skills && typeof d.skills === "object" ? d.skills : {},
        done: d.done && typeof d.done === "object" ? d.done : {},
      };
    } catch (err) {
      return blank;
    }
  }

  function save(slug, state) {
    try {
      localStorage.setItem(NS + slug, JSON.stringify(state));
    } catch (err) {
      /* private window, or storage full - the page still works */
    }
  }

  function getActive() {
    try {
      return localStorage.getItem(ACTIVE);
    } catch (err) {
      return null;
    }
  }

  function setActive(slug) {
    try {
      localStorage.setItem(ACTIVE, slug);
    } catch (err) {
      /* nothing to do */
    }
  }

  var clamp = function (v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  };

  function num(el, max) {
    var v = parseInt(el.value, 10);
    if (isNaN(v)) return null;
    return clamp(v, 1, max);
  }

  /* -------------------------------------------------------- derivations */

  /* One point a level from 10, so the points a ladder has spent by level L is
     the number of ladder levels at or below L. */
  function pointsSpent(ladder, lvl) {
    var n = 0;
    for (var i = 0; i < ladder.rows.length; i++) {
      var r = ladder.rows[i];
      if (r.min > lvl) continue;
      n += Math.min(r.max, lvl) - r.min + 1;
    }
    return n;
  }

  function rowAt(rows, lvl) {
    for (var i = 0; i < rows.length; i++) {
      if (lvl >= rows[i].min && lvl <= rows[i].max) return rows[i];
    }
    return null;
  }

  function rowAfter(rows, lvl) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].min > lvl) return rows[i];
    }
    return null;
  }

  function nextCraft(route, skill) {
    if (skill == null || !route.rows) return null;
    for (var i = 0; i < route.rows.length; i++) {
      var r = route.rows[i];
      if (skill < r.max) return r;
    }
    return null;
  }

  /* Which rank a profession needs next.
   *
   * The rank you own is the one whose cap is the lowest at or above your
   * current skill: at 118 you must already hold Journeyman, because 75 is
   * where Apprentice stops. You are blocked only once your skill reaches that
   * cap, so this says nothing at all until it is worth saying.
   */
  function gateFor(gates, lvl, skill) {
    if (skill == null || !gates.length) return null;
    var ownedIdx = -1;
    for (var i = 0; i < gates.length; i++) {
      if (gates[i].caps >= skill) {
        ownedIdx = i;
        break;
      }
    }
    if (ownedIdx === -1) return null; /* already at 300 */
    var owned = gates[ownedIdx];
    var next = gates[ownedIdx + 1];
    if (!next) return null; /* Artisan, nothing left to buy */

    var room = owned.caps - skill;
    if (room > 10) return null; /* not close enough to the cap to matter */

    var needLvl = next.lvl && lvl < next.lvl ? next.lvl : null;
    var needSkill = next.skill && skill < next.skill ? next.skill : null;
    return {
      rank: next.rank,
      blocked: room <= 0,
      room: room,
      needLvl: needLvl,
      needSkill: needSkill,
      stuckAt: owned.caps,
      unlocks: next.caps,
    };
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* Values the build inlined come out of data/ and are authored HTML, the same
     as the table cells: they carry entities and the odd <em>. Escaping them
     would print "&ndash;" at the reader. Anything NOT from the payload - a
     slug, a stored key - still goes through esc(). */
  function raw(v) {
    return v == null ? "" : String(v);
  }

  function line(k, v) {
    return '<li><span class="k">' + esc(k) + '</span><span class="v">' + v + "</span></li>";
  }

  /* What a character should do next, from the payload the build inlined. */
  function renderNext(card, payload, state) {
    var host = card.querySelector("[data-next]");
    if (!host) return;
    var lvl = state.lvl;
    var out = [];

    if (lvl == null) {
      host.innerHTML = line("What now", "<span>Type a level to see it.</span>");
      return;
    }

    var available = lvl - 9;
    for (var i = 0; i < payload.ladders.length; i++) {
      var lad = payload.ladders[i];
      var now = rowAt(lad.rows, lvl);
      var soon = rowAfter(lad.rows, lvl);
      var spent = pointsSpent(lad, lvl);
      var txt = now
        ? "<b>" + raw(now.talent) + "</b> <span>" + raw(now.rank) + "</span>"
        : soon
          ? "<span>nothing until level " + soon.min + "</span>"
          : "<span>finished</span>";
      if (soon && now) txt += '<br><span>then ' + raw(soon.talent) + " at " + soon.min + "</span>";
      if (available > 0 && spent !== Math.min(available, pointsSpent(lad, 60))) {
        txt += '<br><em>' + spent + " of " + available + " points placed</em>";
      }
      out.push(line(payload.ladders.length > 1 ? lad.name : "Talent", txt));
    }

    var noRoute = [];
    for (var j = 0; j < payload.routes.length; j++) {
      var route = payload.routes[j];
      var skill = state.skills[route.prof];
      if (!route.rows) {
        noRoute.push(route.name);
        continue;
      }
      if (skill == null) {
        out.push(line(route.name, "<span>type a skill level</span>"));
        continue;
      }
      var craft = nextCraft(route, skill);
      out.push(
        line(
          route.name,
          craft
            ? "<b>" + raw(craft.craft) + "</b>" + (craft.each ? ' <span>&middot; ' + raw(craft.each) + "</span>" : "") +
                ' <span>to ' + craft.max + "</span>"
            : "<span>route finished</span>"
        )
      );
    }

    if (noRoute.length) {
      out.push(
        '<li class="gap"><span class="k">No route yet</span><span class="v">' +
          raw(noRoute.join(", ")) +
          "</span></li>"
      );
    }

    for (var g = 0; g < payload.routes.length; g++) {
      var gp = payload.routes[g];
      var gate = gateFor(payload.gates || [], lvl, state.skills[gp.prof]);
      if (!gate) continue;
      var txt;
      if (gate.needLvl) {
        txt = "<em>" + raw(gp.name) + " is capped</em><span> until level " + gate.needLvl +
          ", when you can buy " + raw(gate.rank) + "</span>";
      } else if (gate.needSkill) {
        txt = "<span>" + raw(gate.rank) + " needs " + gate.needSkill + " skill</span>";
      } else if (gate.blocked) {
        txt = "<b>" + raw(gate.rank) + " " + raw(gp.name) + "</b> <span>is open, go buy it. You are stuck at " +
          gate.stuckAt + " until you do, and it lifts you to " + gate.unlocks + ".</span>";
      } else {
        txt = "<span>" + gate.room + " from the cap. " + raw(gate.rank) + " is ready when you get there.</span>";
      }
      out.push(line("Next rank", txt));
    }

    host.innerHTML = out.join("");
  }

  /* --------------------------------------------------- table highlighting */

  function markTables(root, state) {
    var tables = root.querySelectorAll("table[data-drive-by]");
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i];
      var by = t.getAttribute("data-drive-by");
      var key = t.getAttribute("data-drive-key");
      var inclusive = t.getAttribute("data-drive-bound") !== "exclusive";
      var value = by === "level" ? state.lvl : by === "skill" ? state.skills[key] : null;
      var rows = t.querySelectorAll("tbody tr");

      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        if (by === "gate") {
          var need = parseInt(row.getAttribute("data-lvl"), 10);
          var open = state.lvl != null && !isNaN(need) && state.lvl >= need;
          row.classList.toggle("open", open);
          row.classList.toggle("locked", state.lvl != null && !open);
          continue;
        }
        var min = parseInt(row.getAttribute("data-min"), 10);
        var max = parseInt(row.getAttribute("data-max"), 10);
        if (isNaN(min)) continue;
        var here = value != null && value >= min && (inclusive ? value <= max : value < max);
        row.classList.toggle("here", here);
        row.classList.toggle("past", value != null && !here && value >= (inclusive ? max + 1 : max));
      }
    }

    var bands = root.querySelectorAll(".band[data-from]");
    for (var b = 0; b < bands.length; b++) {
      var from = parseInt(bands[b].getAttribute("data-from"), 10);
      var to = parseInt(bands[b].getAttribute("data-to"), 10);
      bands[b].classList.toggle("now", state.lvl != null && state.lvl >= from && state.lvl <= to);
      bands[b].classList.toggle("past", state.lvl != null && state.lvl > to);
    }
  }

  /* ---------------------------------------------------------- sync link */

  function encode(slug, state) {
    var parts = [];
    if (state.lvl != null) parts.push("l" + state.lvl);
    for (var key in state.skills) {
      if (Object.prototype.hasOwnProperty.call(state.skills, key) && state.skills[key] != null) {
        parts.push(key + state.skills[key]);
      }
    }
    var q = "?c=" + encodeURIComponent(slug) + "&p=" + parts.join(".");
    var done = Object.keys(state.done).filter(function (k) {
      return state.done[k];
    });
    if (done.length) q += "&done=" + done.map(encodeURIComponent).join(",");
    return location.origin + location.pathname + q;
  }

  function decode() {
    if (!location.search) return null;
    var p = new URLSearchParams(location.search);
    var slug = p.get("c");
    if (!slug) return null;
    var state = { lvl: null, skills: {}, done: {} };
    var packed = p.get("p") || "";
    packed.split(".").forEach(function (chunk) {
      var m = chunk.match(/^([a-z-]+?)(\d+)$/);
      if (!m) return;
      if (m[1] === "l") state.lvl = clamp(parseInt(m[2], 10), 1, 60);
      else state.skills[m[1]] = clamp(parseInt(m[2], 10), 1, 300);
    });
    (p.get("done") || "").split(",").forEach(function (id) {
      if (id) state.done[id] = true;
    });
    return { slug: slug, state: state };
  }

  /* ---------------------------------------------------------------- wire */

  var cards = Array.prototype.slice.call(document.querySelectorAll("[data-character]"));
  var states = {};
  var payloads = {};

  cards.forEach(function (card) {
    var slug = card.getAttribute("data-character");
    var holder = card.querySelector("script.chardata");
    try {
      payloads[slug] = JSON.parse(holder.textContent);
    } catch (err) {
      return;
    }
    states[slug] = load(slug);
  });

  /* a sync link in the URL wins, once, then the URL is cleaned */
  var incoming = decode();
  if (incoming && payloads[incoming.slug]) {
    states[incoming.slug] = incoming.state;
    save(incoming.slug, incoming.state);
    setActive(incoming.slug);
    try {
      history.replaceState(null, "", location.pathname);
    } catch (err) {
      /* nothing to do */
    }
  }

  function paint(slug) {
    var card = document.querySelector('[data-character="' + slug + '"]');
    if (!card) return;
    var state = states[slug];
    var lvlInput = card.querySelector("[data-level]");
    if (lvlInput) lvlInput.value = state.lvl == null ? "" : state.lvl;
    var skillInputs = card.querySelectorAll("[data-skill]");
    for (var i = 0; i < skillInputs.length; i++) {
      var k = skillInputs[i].getAttribute("data-skill");
      skillInputs[i].value = state.skills[k] == null ? "" : state.skills[k];
    }
    renderNext(card, payloads[slug], state);
    markTables(document, state);
  }

  cards.forEach(function (card) {
    var slug = card.getAttribute("data-character");
    if (!states[slug]) return;

    card.addEventListener("input", function (ev) {
      var el = ev.target;
      if (el.hasAttribute("data-level")) {
        states[slug].lvl = num(el, 60);
      } else if (el.hasAttribute("data-skill")) {
        states[slug].skills[el.getAttribute("data-skill")] = num(el, 300);
      } else if (el.type === "checkbox" && el.id) {
        states[slug].done[el.id] = el.checked;
      } else {
        return;
      }
      save(slug, states[slug]);
      setActive(slug);
      renderNext(card, payloads[slug], states[slug]);
      markTables(document, states[slug]);
    });

    paint(slug);
  });

  /* a sync button per card, added only when there is state worth carrying */
  cards.forEach(function (card) {
    var slug = card.getAttribute("data-character");
    if (!states[slug]) return;
    var head = card.querySelector(".cardfoot") || card.querySelector(".chead");
    if (!head) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ghost";
    btn.textContent = "Copy sync link";
    btn.addEventListener("click", function () {
      var link = encode(slug, states[slug]);
      var done = function (ok) {
        btn.textContent = ok ? "Copied" : "Press to copy, then copy the URL";
        setTimeout(function () {
          btn.textContent = "Copy sync link";
        }, 2500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(
          function () {
            done(true);
          },
          function () {
            done(false);
          }
        );
      } else {
        done(false);
      }
    });
    head.appendChild(btn);
  });

  /* ---- reference pages: drive their tables from whichever character is active */

  if (!cards.length && document.querySelector("table[data-drive-by], .band[data-from]")) {
    buildContextBar();
  }

  function buildContextBar() {
    /* Which characters exist is not known on a reference page, so read the
       keys we wrote. A page with no stored characters gets no bar at all. */
    var slugs = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(NS) === 0 && k !== ACTIVE) slugs.push(k.slice(NS.length));
      }
    } catch (err) {
      return;
    }
    if (!slugs.length) return;

    var active = getActive();
    if (slugs.indexOf(active) === -1) active = slugs[0];

    var drives = {};
    var tables = document.querySelectorAll("table[data-drive-by]");
    for (var t = 0; t < tables.length; t++) {
      var by = tables[t].getAttribute("data-drive-by");
      var key = tables[t].getAttribute("data-drive-key");
      if (by === "skill" && key) drives[key] = true;
      if (by === "level" || by === "gate") drives.__level = true;
    }

    var bar = document.createElement("div");
    bar.className = "status";
    var html = '<div class="field"><label for="ctx-lvl">Level</label>' +
      '<input id="ctx-lvl" data-ctx="level" type="number" inputmode="numeric" min="1" max="60"></div>';
    for (var key2 in drives) {
      if (key2 === "__level" || !Object.prototype.hasOwnProperty.call(drives, key2)) continue;
      html +=
        '<div class="field" data-token="' + key2 + '"><label for="ctx-' + key2 + '">' +
        key2.replace(/-/g, " ") + " skill</label>" +
        '<input id="ctx-' + key2 + '" data-ctx="skill" data-skill="' + key2 +
        '" type="number" inputmode="numeric" min="1" max="300"></div>';
    }
    var who = slugs.length > 1
      ? '<select id="ctx-who" aria-label="Which character">' +
          slugs.map(function (s) {
            return '<option value="' + s + '"' + (s === active ? " selected" : "") + ">" + esc(s) + "</option>";
          }).join("") +
        "</select>"
      : esc(active);
    html += '<div class="synced">Showing for ' + who + "</div>";
    bar.innerHTML = html;

    var hero = document.querySelector(".hero");
    if (hero && hero.parentNode) hero.parentNode.insertBefore(bar, hero.nextSibling);

    function repaint() {
      var state = load(active);
      var l = bar.querySelector('[data-ctx="level"]');
      if (l) l.value = state.lvl == null ? "" : state.lvl;
      var ins = bar.querySelectorAll('[data-ctx="skill"]');
      for (var i = 0; i < ins.length; i++) {
        var k = ins[i].getAttribute("data-skill");
        ins[i].value = state.skills[k] == null ? "" : state.skills[k];
      }
      markTables(document, state);
    }

    bar.addEventListener("input", function (ev) {
      var el = ev.target;
      var state = load(active);
      if (el.getAttribute("data-ctx") === "level") state.lvl = num(el, 60);
      else if (el.getAttribute("data-ctx") === "skill") state.skills[el.getAttribute("data-skill")] = num(el, 300);
      else return;
      save(active, state);
      markTables(document, state);
    });

    var sel = bar.querySelector("#ctx-who");
    if (sel) {
      sel.addEventListener("change", function () {
        active = sel.value;
        setActive(active);
        repaint();
      });
    }

    repaint();
  }

  /* ---- per-viewer tab state, never shared, never in the character record */

  var toggles = document.querySelectorAll(".spectoggle");
  for (var g = 0; g < toggles.length; g++) {
    (function (group) {
      var buttons = Array.prototype.slice.call(group.querySelectorAll("button[data-pane]"));
      if (!buttons.length) return;
      var name = group.getAttribute("data-group") || "panes";
      function show(which) {
        buttons.forEach(function (b) {
          var id = b.getAttribute("data-pane");
          var pane = document.getElementById(id);
          var on = id === which;
          b.classList.toggle("on", on);
          b.setAttribute("aria-pressed", String(on));
          if (pane) pane.hidden = !on;
        });
        try {
          localStorage.setItem(NS + "pane:" + name, which);
        } catch (err) {
          /* nothing to do */
        }
      }
      buttons.forEach(function (b) {
        b.addEventListener("click", function () {
          show(b.getAttribute("data-pane"));
        });
      });
      var saved = null;
      try {
        saved = localStorage.getItem(NS + "pane:" + name);
      } catch (err) {
        saved = null;
      }
      var ids = buttons.map(function (b) {
        return b.getAttribute("data-pane");
      });
      show(ids.indexOf(saved) === -1 ? ids[0] : saved);
    })(toggles[g]);
  }
})();
