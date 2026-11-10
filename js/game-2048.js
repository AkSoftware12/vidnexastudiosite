/* Vidnexa Studio games – shared helpers (storage, sound, overlays, controls). No dependencies. */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, $$ = VX.$$;
  var G = VX.G = {};

  var ls = G.ls = {
    get: function (k, d) { try { var v = localStorage.getItem("vx_" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("vx_" + k, JSON.stringify(v)); } catch (e) {} }
  };
  G.rand = function (n) { return Math.floor(Math.random() * n); };
  G.shuffle = function (a) { for (var i = a.length - 1; i > 0; i--) { var j = G.rand(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  G.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  G.time = function (s) { s = Math.floor(s); var m = Math.floor(s / 60); return m + ":" + ("0" + (s % 60)).slice(-2); };
  G.hud = function (items) {
    return '<div class="ghud">' + items.map(function (i) { return '<div class="stat"><b id="' + i[0] + '">' + i[2] + "</b><span>" + i[1] + "</span></div>"; }).join("") + "</div>";
  };
  G.set = function (r, id, v) { var e = $("#" + id, r); if (e) e.textContent = v; };

  /* ---- sound (only starts after the player taps; can be muted) ---- */
  var ac = null; G.sound = ls.get("snd", true);
  function actx() {
    if (!ac) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ac = new C(); }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  G.tone = function (f, d, type, v, to) {
    if (!G.sound) return;
    try {
      var a = actx(); if (!a) return; d = d || .12; v = v || .07;
      var o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
      o.type = type || "sine"; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + .02);
    } catch (e) {}
  };
  G.sfx = {
    tap: function () { G.tone(520, .06, "triangle", .05); },
    pop: function () { G.tone(420, .07, "square", .03, 760); },
    good: function () { G.tone(660, .09, "sine"); setTimeout(function () { G.tone(880, .12, "sine"); }, 80); },
    bad: function () { G.tone(190, .25, "sawtooth", .05, 90); },
    lose: function () { G.tone(320, .35, "sawtooth", .05, 110); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { G.tone(f, .18, "triangle", .07); }, i * 110); }); }
  };
  G.soundBtn = function (btn) {
    function paint() { btn.textContent = G.sound ? "🔊 Sound on" : "🔇 Sound off"; btn.setAttribute("aria-pressed", String(G.sound)); }
    btn.addEventListener("click", function () { G.sound = !G.sound; ls.set("snd", G.sound); paint(); if (G.sound) G.sfx.tap(); });
    paint();
  };

  /* ---- overlay card inside the game area (not a popup) ---- */
  G.closeOverlay = function (stage) { $$(".govl", stage).forEach(function (e) { e.remove(); }); };
  G.overlay = function (stage, o) {
    G.closeOverlay(stage);
    var d = document.createElement("div"); d.className = "govl"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", o.title);
    d.innerHTML = "<h3>" + o.title + "</h3>" +
      (o.stars != null ? '<div class="stars" role="img" aria-label="' + o.stars + ' of 3 stars">' + "★".repeat(o.stars) + '<span style="opacity:.28">' + "★".repeat(3 - o.stars) + "</span></div>" : "") +
      (o.text ? "<p>" + o.text + "</p>" : "") + (o.html || "") + '<div class="btns"></div>';
    var bx = $(".btns", d);
    (o.buttons || []).forEach(function (b) {
      var e = document.createElement("button"); e.type = "button"; e.className = "btn" + (b.ghost ? " ghost" : ""); e.textContent = b.label;
      e.addEventListener("click", function () { G.closeOverlay(stage); if (b.fn) b.fn(); }); bx.appendChild(e);
    });
    stage.appendChild(d);
    var f = $("button", d); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
    return d;
  };

  /* ---- segmented option buttons ---- */
  G.seg = function (el, opts, cur, fn) {
    el.classList.add("seg"); el.innerHTML = "";
    var bs = opts.map(function (p) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = p[1]; b.setAttribute("aria-pressed", String(p[0] === cur));
      b.addEventListener("click", function () { bs.forEach(function (x) { x.setAttribute("aria-pressed", "false"); }); b.setAttribute("aria-pressed", "true"); fn(p[0]); });
      el.appendChild(b); return b;
    });
  };

  /* ---- swipe on an element (pointer events) ---- */
  G.swipe = function (el, cb, min) {
    min = min || 22; var sx, sy, on = false;
    el.addEventListener("pointerdown", function (e) { sx = e.clientX; sy = e.clientY; on = true; });
    el.addEventListener("pointerup", function (e) {
      if (!on) return; on = false; var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
      cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : (dy > 0 ? "d" : "u"));
    });
    el.addEventListener("pointercancel", function () { on = false; });
  };

  /* ---- keyboard: ignore when typing in a field ---- */
  G.keys = function (fn) {
    document.addEventListener("keydown", function (e) {
      var t = e.target && e.target.tagName; if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; fn(e);
    });
  };
  G.blur = function (fn) { document.addEventListener("visibilitychange", function () { if (document.hidden) fn(); }); };

  /* canvas with sharp pixels on high-DPI screens */
  G.canvas = function (cv, w, h) {
    var dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = w * dpr; cv.height = h * dpr;
    var x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); return x;
  };
})();

/* 2048 – animated tiles, 3×3 / 4×4 / 5×5, limited undo */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;

  VX.tool("2048", {
    html: '<div class="gopt"><div id="osz" role="group" aria-label="Board size"></div></div>' +
      G.hud([["sc", "Score", 0], ["bs", "Best", 0], ["hi", "Top tile", 2]]) +
      '<div class="gwrap"><div class="gstage" style="--gw:440px"><div class="b2048 swipe" id="bd" tabindex="0" aria-label="2048 board"></div></div>' +
      '<div class="gbar"><button class="btn sm" id="nw" type="button">New game</button><button class="btn ghost sm" id="un" type="button">Undo (3)</button><button class="btn ghost sm" id="sn" type="button"></button></div>' +
      '<p class="gnote" id="msg" aria-live="polite">Arrow keys, WASD or swipe. Equal tiles merge. Reach 2048, then keep going for a higher score.</p></div>',
    init: function (r) {
      var stage = $(".gstage", r), board = $("#bd", r), n = ls.get("g_n", 4), layer, tiles, grid, score, over, won, undos, hist, uid;
      var gap = 2.4, cell;
      function bestKey() { return "g2048_best_" + n; }
      function build() {
        cell = (100 - (n + 1) * gap) / n; board.style.setProperty("--n", n);
        var bg = ""; for (var i = 0; i < n * n; i++) bg += "<i></i>";
        board.innerHTML = '<div class="gbg" style="grid-template-columns:repeat(' + n + ',1fr);gap:' + gap + '%;padding:' + gap + '%">' + bg + '</div><div class="gly"></div>';
        layer = $(".gly", board);
      }
      function place(el, rw, cl) { el.style.width = cell + "%"; el.style.height = cell + "%"; el.style.left = (gap + cl * (cell + gap)) + "%"; el.style.top = (gap + rw * (cell + gap)) + "%"; }
      function label(t) { t.el.textContent = t.v; t.el.setAttribute("data-v", t.v > 2048 ? "big" : t.v); t.el.setAttribute("data-d", String(t.v).length); }
      function mk(v, rw, cl, cls) {
        var el = document.createElement("div"); el.className = "tile" + (cls ? " " + cls : ""); var t = { id: ++uid, v: v, r: rw, c: cl, el: el };
        label(t); place(el, rw, cl); layer.appendChild(el); tiles.push(t); grid[rw][cl] = t; return t;
      }
      function empties() { var e = []; for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) if (!grid[i][j]) e.push([i, j]); return e; }
      function spawn() { var e = empties(); if (!e.length) return; var p = e[G.rand(e.length)]; mk(Math.random() < .9 ? 2 : 4, p[0], p[1], "new"); }
      function snapshot() { return { s: score, g: grid.map(function (row) { return row.map(function (t) { return t ? t.v : 0; }); }) }; }
      function restore(h) {
        layer.innerHTML = ""; tiles = []; grid = []; for (var i = 0; i < n; i++) { grid.push(new Array(n).fill(null)); }
        for (i = 0; i < n; i++) for (var j = 0; j < n; j++) if (h.g[i][j]) mk(h.g[i][j], i, j);
        score = h.s; updHud();
      }
      function top() { var m = 0; tiles.forEach(function (t) { if (!t.dead && t.v > m) m = t.v; }); return m; }
      function updHud() {
        var b = ls.get(bestKey(), 0); if (score > b) { b = score; ls.set(bestKey(), b); }
        G.set(r, "sc", score); G.set(r, "bs", b); G.set(r, "hi", top() || 2); $("#un", r).textContent = "Undo (" + undos + ")"; $("#un", r).disabled = undos <= 0 || !hist.length;
      }
      function init() {
        build(); tiles = []; grid = []; for (var i = 0; i < n; i++) grid.push(new Array(n).fill(null));
        score = 0; over = false; won = false; undos = 3; hist = []; uid = 0; G.closeOverlay(stage);
        spawn(); spawn(); updHud(); $("#msg", r).textContent = "Arrow keys, WASD or swipe. Equal tiles merge. Reach 2048, then keep going for a higher score.";
      }
      function inside(a, b) { return a >= 0 && b >= 0 && a < n && b < n; }
      function move(dir) {
        if (over) return;
        var v = { l: [0, -1], r: [0, 1], u: [-1, 0], d: [1, 0] }[dir], dr = v[0], dc = v[1], moved = false, merges = [], snap = snapshot();
        tiles.forEach(function (t) { t.merged = false; });
        var rows = [], cols = []; for (var i = 0; i < n; i++) { rows.push(i); cols.push(i); } if (dr === 1) rows.reverse(); if (dc === 1) cols.reverse();
        rows.forEach(function (rw) {
          cols.forEach(function (cl) {
            var t = grid[rw][cl]; if (!t) return;
            var nr = rw, nc = cl;
            while (inside(nr + dr, nc + dc) && !grid[nr + dr][nc + dc]) { nr += dr; nc += dc; }
            var nx = inside(nr + dr, nc + dc) ? grid[nr + dr][nc + dc] : null;
            if (nx && nx.v === t.v && !nx.merged) {
              grid[rw][cl] = null; t.r = nr + dr; t.c = nc + dc; place(t.el, t.r, t.c); t.dead = true; nx.merged = true; nx.v *= 2; score += nx.v; merges.push([t, nx]); moved = true;
            } else if (nr !== rw || nc !== cl) { grid[rw][cl] = null; grid[nr][nc] = t; t.r = nr; t.c = nc; place(t.el, nr, nc); moved = true; }
          });
        });
        if (!moved) return;
        hist.push(snap); if (hist.length > 3) hist.shift();
        merges.length ? G.sfx.pop() : G.sfx.tap();
        setTimeout(function () {
          merges.forEach(function (m) { m[0].el.remove(); label(m[1]); m[1].el.classList.remove("mrg"); void m[1].el.offsetWidth; m[1].el.classList.add("mrg"); });
          tiles = tiles.filter(function (t) { return !t.dead; });
        }, 115);
        spawn(); updHud();
        if (!won && top() >= 2048) { won = true; G.sfx.win(); G.overlay(stage, { title: "You made 2048! 🎉", text: "Score " + score + ". Keep going to beat your best?", buttons: [{ label: "Keep going" }, { label: "New game", ghost: true, fn: init }] }); }
        else if (!canMove()) { over = true; G.sfx.lose(); G.overlay(stage, { title: "No more moves", text: "Final score <b>" + score + "</b> · best " + ls.get(bestKey(), 0), buttons: [{ label: "Try again", fn: init }, { label: "Undo", ghost: true, fn: undo }] }); }
      }
      function canMove() {
        if (empties().length) return true;
        for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) { var t = grid[i][j]; if ((j + 1 < n && grid[i][j + 1].v === t.v) || (i + 1 < n && grid[i + 1][j].v === t.v)) return true; }
        return false;
      }
      function undo() { if (undos <= 0 || !hist.length) return; var h = hist.pop(); undos--; over = false; restore(h); $("#un", r).textContent = "Undo (" + undos + ")"; updHud(); G.sfx.tap(); }
      G.seg($("#osz", r), [[3, "3×3 (hard)"], [4, "4×4"], [5, "5×5 (relaxed)"]], n, function (v) { n = v; ls.set("g_n", v); init(); });
      $("#nw", r).addEventListener("click", init); $("#un", r).addEventListener("click", undo); G.soundBtn($("#sn", r));
      G.swipe(board, move, 20);
      G.keys(function (e) { var m = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d", a: "l", d: "r", w: "u", s: "d" }[e.key]; if (m) { e.preventDefault(); move(m); } else if (e.key === "z" || e.key === "Z") undo(); });
      init();
    }
  });
})();
