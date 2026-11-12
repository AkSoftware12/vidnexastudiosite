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
  G.set = function (r, id, v) {
    var e = $("#" + id, r); if (!e) return; var old = e.textContent; e.textContent = v;
    if (old !== String(v) && e.closest && e.closest(".ghud")) { e.classList.remove("bump"); void e.offsetWidth; e.classList.add("bump"); }
  };

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
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { G.tone(f, .18, "triangle", .07); }, i * 110); }); },
    roll: function () { for (var i = 0; i < 7; i++) (function (i) { setTimeout(function () { G.tone(260 + Math.random() * 240, .035, "square", .025); }, i * 55); })(i); },
    hop: function (k) { G.tone(480 + (k || 0) * 40, .06, "triangle", .045, 720 + (k || 0) * 40); },
    coin: function () { G.tone(988, .07, "square", .03); setTimeout(function () { G.tone(1319, .14, "square", .03); }, 70); },
    knock: function (v) { G.tone(160 + Math.random() * 60, .05, "triangle", Math.min(.09, .02 + (v || 1) * .01)); },
    whoosh: function () { G.tone(900, .22, "sine", .03, 180); },
    capture: function () { G.tone(700, .08, "sawtooth", .05, 300); setTimeout(function () { G.tone(240, .22, "triangle", .06, 90); }, 90); }
  };
  G.buzz = function (ms) { try { if (G.sound && navigator.vibrate) navigator.vibrate(ms || 30); } catch (e) {} };
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- particle effects layer over a game stage ---- */
  G.fx = function (stage) {
    if (stage._fx) return stage._fx;
    var c = document.createElement("canvas"); c.className = "gfx"; c.setAttribute("aria-hidden", "true"); stage.appendChild(c);
    var x = c.getContext("2d"), parts = [], texts = [], raf = 0, W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    function size() { var b = stage.getBoundingClientRect(); W = b.width; H = b.height; c.width = W * dpr; c.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function loop() {
      x.clearRect(0, 0, W, H);
      parts = parts.filter(function (p) {
        p.vy += p.g; p.vx *= p.drag; p.vy *= p.drag; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= p.decay;
        if (p.life <= 0) return false;
        x.save(); x.globalAlpha = Math.min(1, p.life * 1.5); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c;
        if (p.shape === "rect") x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); else { x.beginPath(); x.arc(0, 0, p.s / 2, 0, 7); x.fill(); }
        x.restore(); return true;
      });
      texts = texts.filter(function (t) {
        t.life -= .018; if (t.life <= 0) return false;
        var k = 1 - t.life; x.save(); x.globalAlpha = Math.min(1, t.life * 2); x.font = "900 " + t.size * (1 + Math.min(.25, k * 2)) + "px Inter,system-ui,sans-serif";
        x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 5; x.strokeStyle = "rgba(10,8,30,.75)"; x.strokeText(t.s, t.x, t.y - k * 46);
        x.fillStyle = t.c; x.fillText(t.s, t.x, t.y - k * 46); x.restore(); return true;
      });
      if (parts.length || texts.length) raf = requestAnimationFrame(loop); else { raf = 0; x.clearRect(0, 0, W, H); }
    }
    function kick() { if (!raf) { size(); raf = requestAnimationFrame(loop); } }
    var api = {
      /* fx, fy are 0..1 fractions of the stage */
      burst: function (fx, fy, cols, n, speed) {
        if (reduceMotion) return; kick(); cols = cols || ["#FDE047", "#F472B6", "#60A5FA", "#34D399"]; n = n || 18; speed = speed || 5;
        for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, v = speed * (.4 + Math.random()); parts.push({ x: fx * W, y: fy * H, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: .12, drag: .96, r: 0, vr: .2, s: 4 + Math.random() * 5, c: cols[i % cols.length], life: 1, decay: .022 + Math.random() * .02, shape: "dot" }); }
      },
      confetti: function () {
        if (reduceMotion) return; kick(); var cols = ["#F43F5E", "#FACC15", "#22D3EE", "#A855F7", "#34D399", "#FB923C", "#fff"];
        for (var i = 0; i < 140; i++) parts.push({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .45, vx: (Math.random() - .5) * 15, vy: -6 - Math.random() * 9, g: .22, drag: .985, r: Math.random() * 6, vr: (Math.random() - .5) * .4, s: 7 + Math.random() * 7, c: cols[i % cols.length], life: 1.4, decay: .007 + Math.random() * .006, shape: "rect" });
      },
      text: function (fx, fy, s, c, size) { kick(); texts.push({ x: fx * W, y: fy * H, s: s, c: c || "#FDE047", size: size || 28, life: 1 }); }
    };
    stage._fx = api; return api;
  };
  G.shake = function (el) { if (reduceMotion || !el) return; el.classList.remove("gshake"); void el.offsetWidth; el.classList.add("gshake"); };
  G.soundBtn = function (btn) {
    function paint() { btn.textContent = G.sound ? "🔊 Sound on" : "🔇 Sound off"; btn.setAttribute("aria-pressed", String(G.sound)); }
    btn.addEventListener("click", function () { G.sound = !G.sound; ls.set("snd", G.sound); paint(); if (G.sound) G.sfx.tap(); });
    paint();
  };

  /* ---- overlay card inside the game area (not a popup) ---- */
  G.closeOverlay = function (stage) { $$(".govl", stage).forEach(function (e) { e.remove(); }); };
  G.overlay = function (stage, o) {
    G.closeOverlay(stage);
    var d = document.createElement("div"); d.className = "govl" + (o.win ? " win" : "") + (o.lose ? " lose" : ""); d.setAttribute("role", "dialog"); d.setAttribute("aria-label", o.title.replace(/<[^>]+>/g, ""));
    var ico = o.icon || (o.win ? "🏆" : o.lose ? "💥" : "");
    d.innerHTML = '<div class="govc">' + (ico ? '<div class="gico" aria-hidden="true">' + ico + "</div>" : "") + "<h3>" + o.title + "</h3>" +
      (o.stars != null ? '<div class="stars" role="img" aria-label="' + o.stars + ' of 3 stars">' + "★".repeat(o.stars) + '<span style="opacity:.28">' + "★".repeat(3 - o.stars) + "</span></div>" : "") +
      (o.text ? "<p>" + o.text + "</p>" : "") + (o.html || "") + '<div class="btns"></div></div>';
    var bx = $(".btns", d);
    (o.buttons || []).forEach(function (b) {
      var e = document.createElement("button"); e.type = "button"; e.className = "btn" + (b.ghost ? " ghost" : ""); e.textContent = b.label;
      e.addEventListener("click", function () { G.closeOverlay(stage); if (b.fn) b.fn(); }); bx.appendChild(e);
    });
    stage.appendChild(d);
    if (o.win) { try { G.fx(stage).confetti(); } catch (e) {} }
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
          merges.forEach(function (m) { m[0].el.remove(); label(m[1]); m[1].el.classList.remove("mrg"); void m[1].el.offsetWidth; m[1].el.classList.add("mrg"); if (m[1].v >= 64) { try { G.fx(stage).burst((m[1].c + .5) / n, (m[1].r + .5) / n, ["#FDE047", "#F472B6", "#fff"], 10, 3); } catch (e) {} } });
          tiles = tiles.filter(function (t) { return !t.dead; });
        }, 115);
        spawn(); updHud();
        if (!won && top() >= 2048) { won = true; G.sfx.win(); G.overlay(stage, { win: true, title: "You made 2048!", text: "Score " + score + ". Keep going to beat your best?", buttons: [{ label: "Keep going" }, { label: "New game", ghost: true, fn: init }] }); }
        else if (!canMove()) { over = true; G.sfx.lose(); G.overlay(stage, { lose: true, title: "No more moves", text: "Final score <b>" + score + "</b> · best " + ls.get(bestKey(), 0), buttons: [{ label: "Try again", fn: init }, { label: "Undo", ghost: true, fn: undo }] }); }
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
