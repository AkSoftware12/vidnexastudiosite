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

/* Block Puzzle – drag the three pieces onto the 8×8 board, fill a full row or column to clear it. No time limit. */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;
  var N = 8, W = 440, CELL = 50, PAD = 20, GRID_Y = 16, TRAY_Y = GRID_Y + N * CELL + 26, TRAY_H = 120, H = TRAY_Y + TRAY_H;
  var COLS = ["#F472B6", "#60A5FA", "#FBBF24", "#34D399", "#A78BFA", "#FB923C", "#F87171", "#2DD4BF"];
  var SHAPES = [
    [[0, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
    [[0, 0], [0, 1], [1, 0], [1, 1]], [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
    [[0, 0], [1, 0], [1, 1]], [[0, 1], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 0]], [[0, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 1], [1, 1], [2, 1], [2, 0]], [[0, 0], [0, 1], [1, 0], [2, 0]], [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 1]], [[1, 0], [1, 1], [1, 2], [0, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 1], [1, 1], [2, 1], [1, 0]],
    [[0, 0], [0, 1], [1, 1], [1, 2]], [[0, 1], [0, 2], [1, 0], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]], [[0, 1], [1, 0], [1, 1], [2, 0]],
    [[0, 0], [0, 1], [1, 0], [1, 1], [0, 2], [1, 2]], [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], [[0, 2], [1, 2], [2, 2], [2, 1], [2, 0]]
  ];
  function norm(s) { var mr = 0, mc = 0; s.forEach(function (p) { mr = Math.max(mr, p[0]); mc = Math.max(mc, p[1]); }); return { cells: s, h: mr + 1, w: mc + 1 }; }

  VX.tool("block-puzzle", {
    html: G.hud([["sc", "Score", 0], ["ln", "Lines", 0], ["bs", "Best", 0]]) +
      '<div class="gwrap"><div class="gstage" style="--gw:440px"><canvas class="gcanvas swipe" id="cv" width="440" height="' + H + '" style="width:100%" aria-label="Block puzzle board"></canvas></div>' +
      '<div class="gbar"><button class="btn sm" id="nw" type="button">New game</button><button class="btn ghost sm" id="sn" type="button"></button></div>' +
      '<p class="gnote" id="msg" aria-live="polite">Drag a piece from the tray onto the board. Fill a whole row or column to clear it. The game ends when no piece fits.</p></div>',
    init: function (r) {
      var cv = $("#cv", r), x = G.canvas(cv, W, H), stage = $(".gstage", r), fx = G.fx(stage);
      var grid, tray, score, lines, over, drag = null, flash = [], combo = 0;
      function bestShow() { G.set(r, "bs", ls.get("bp_best", 0)); }
      function newPiece() { var s = norm(SHAPES[G.rand(SHAPES.length)]); s.col = COLS[G.rand(COLS.length)]; return s; }
      function refill() { tray = [newPiece(), newPiece(), newPiece()]; }
      function newGame() {
        grid = []; for (var i = 0; i < N * N; i++) grid.push(0); score = 0; lines = 0; over = false; combo = 0; refill(); G.closeOverlay(stage); upd(); draw();
        $("#msg", r).textContent = "Drag a piece from the tray onto the board. Fill a whole row or column to clear it. The game ends when no piece fits.";
      }
      function upd() { G.set(r, "sc", score); G.set(r, "ln", lines); bestShow(); }
      function fits(p, row, col) {
        for (var i = 0; i < p.cells.length; i++) { var rr = row + p.cells[i][0], cc = col + p.cells[i][1]; if (rr < 0 || cc < 0 || rr >= N || cc >= N || grid[rr * N + cc]) return false; } return true;
      }
      function anyFits() {
        for (var t = 0; t < 3; t++) { var p = tray[t]; if (!p) continue; for (var rr = 0; rr <= N - p.h; rr++) for (var cc = 0; cc <= N - p.w; cc++) if (fits(p, rr, cc)) return true; } return false;
      }
      function place(p, row, col) {
        p.cells.forEach(function (c) { grid[(row + c[0]) * N + col + c[1]] = p.col; });
        var full = [];
        for (var rr = 0; rr < N; rr++) { var ok = true; for (var cc = 0; cc < N; cc++) if (!grid[rr * N + cc]) { ok = false; break; } if (ok) full.push(["r", rr]); }
        for (var c2 = 0; c2 < N; c2++) { var ok2 = true; for (var r2 = 0; r2 < N; r2++) if (!grid[r2 * N + c2]) { ok2 = false; break; } if (ok2) full.push(["c", c2]); }
        score += p.cells.length;
        if (full.length) {
          combo++; flash = [];
          full.forEach(function (f) { for (var k = 0; k < N; k++) { var idx = f[0] === "r" ? f[1] * N + k : k * N + f[1]; flash.push(idx); grid[idx] = 0; } });
          lines += full.length; score += full.length * 10 * full.length + (combo > 1 ? combo * 5 : 0); G.sfx.good(); try { full.forEach(function (f) { var fxx = f[0] === "r" ? .5 : (PAD + (f[1] + .5) * CELL) / W, fyy = f[0] === "r" ? (GRID_Y + (f[1] + .5) * CELL) / H : (GRID_Y + N * CELL / 2) / H; fx.burst(fxx, fyy, ["#FDE047", "#F472B6", "#60A5FA", "#fff"], 22, 5); }); fx.text(.5, (GRID_Y + N * CELL / 2) / H, full.length > 1 ? full.length + " lines!" : (combo > 1 ? "Combo x" + combo : "+" + (full.length * 10)), "#FDE047", full.length > 1 ? 34 : 26); G.buzz(25); } catch (e) {}
          $("#msg", r).textContent = (full.length > 1 ? full.length + " lines! " : "Line cleared! ") + (combo > 1 ? "Combo ×" + combo : "");
          setTimeout(function () { flash = []; draw(); }, 220);
        } else { combo = 0; G.sfx.tap(); }
        if (score > ls.get("bp_best", 0)) ls.set("bp_best", score);
        if (!tray[0] && !tray[1] && !tray[2]) refill();
        upd();
        if (!anyFits()) {
          over = true; G.sfx.lose();
          setTimeout(function () { G.overlay(stage, { lose: true, icon: "🧱", title: "No moves left", text: "Score <b>" + score + "</b> · " + lines + " lines" + (score >= ls.get("bp_best", 0) && score > 0 ? " · best!" : ""), buttons: [{ label: "Play again", fn: newGame }] }); }, 300);
        }
      }
      function cellAt(px, py) { return { row: Math.floor((py - GRID_Y) / CELL), col: Math.floor((px - PAD) / CELL) }; }
      function trayBox(t) { var sw = (W - 2 * PAD) / 3; return { x: PAD + t * sw, y: TRAY_Y, w: sw, h: TRAY_H }; }
      function trayScale(p) { return Math.min(0.5, 90 / Math.max(p.w, p.h) / CELL); }
      function drawPiece(p, px, py, s, alpha) {
        x.globalAlpha = alpha == null ? 1 : alpha;
        p.cells.forEach(function (c) { box(px + c[1] * CELL * s, py + c[0] * CELL * s, CELL * s, p.col); });
        x.globalAlpha = 1;
      }
      function box(bx, by, sz, col) {
        var g = sz * .08; x.fillStyle = col; rr(bx + g, by + g, sz - 2 * g, sz - 2 * g, sz * .18); x.fill();
        x.fillStyle = "rgba(255,255,255,.28)"; rr(bx + g * 2, by + g * 2, sz - 4 * g, (sz - 4 * g) * .4, sz * .14); x.fill();
      }
      function rr(ax, ay, w, h, rad) { x.beginPath(); x.moveTo(ax + rad, ay); x.arcTo(ax + w, ay, ax + w, ay + h, rad); x.arcTo(ax + w, ay + h, ax, ay + h, rad); x.arcTo(ax, ay + h, ax, ay, rad); x.arcTo(ax, ay, ax + w, ay, rad); x.closePath(); }
      function draw() {
        x.fillStyle = "#0A0818"; x.fillRect(0, 0, W, H);
        x.fillStyle = "#1b1540"; rr(PAD - 6, GRID_Y - 6, N * CELL + 12, N * CELL + 12, 16); x.fill();
        var ghost = null;
        if (drag && drag.on) { var c = cellAt(drag.px - drag.offx, drag.py - drag.offy); var row = Math.round((drag.py - drag.offy - GRID_Y) / CELL), col = Math.round((drag.px - drag.offx - PAD) / CELL); if (fits(drag.p, row, col)) ghost = { row: row, col: col }; }
        for (var i = 0; i < N * N; i++) {
          var bx = PAD + (i % N) * CELL, by = GRID_Y + Math.floor(i / N) * CELL;
          if (grid[i]) box(bx, by, CELL, flash.indexOf(i) >= 0 ? "#fff" : grid[i]);
          else { x.fillStyle = "#2a2060"; rr(bx + 3, by + 3, CELL - 6, CELL - 6, 8); x.fill(); }
        }
        if (ghost) drawPiece(drag.p, PAD + ghost.col * CELL, GRID_Y + ghost.row * CELL, 1, .45);
        for (var t = 0; t < 3; t++) {
          var p = tray[t]; if (!p || (drag && drag.t === t)) continue; var b = trayBox(t), s = trayScale(p);
          drawPiece(p, b.x + (b.w - p.w * CELL * s) / 2, b.y + (b.h - p.h * CELL * s) / 2, s);
        }
        if (drag && drag.on) drawPiece(drag.p, drag.px - drag.offx, drag.py - drag.offy, 1, .9);
      }
      function pos(e) { var b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) * W / b.width, y: (e.clientY - b.top) * H / b.height }; }
      cv.addEventListener("pointerdown", function (e) {
        if (over) return; var q = pos(e);
        for (var t = 0; t < 3; t++) {
          var p = tray[t]; if (!p) continue; var b = trayBox(t);
          if (q.x >= b.x && q.x < b.x + b.w && q.y >= b.y && q.y < b.y + b.h) {
            var lift = e.pointerType === "mouse" ? 0 : 70;
            drag = { t: t, p: p, on: true, px: q.x, py: q.y, offx: p.w * CELL / 2, offy: p.h * CELL + lift - CELL / 2 };
            try { cv.setPointerCapture(e.pointerId); } catch (er) {}
            e.preventDefault(); draw(); return;
          }
        }
      });
      cv.addEventListener("pointermove", function (e) { if (!drag) return; var q = pos(e); drag.px = q.x; drag.py = q.y; draw(); });
      function drop(e) {
        if (!drag) return; var row = Math.round((drag.py - drag.offy - GRID_Y) / CELL), col = Math.round((drag.px - drag.offx - PAD) / CELL), p = drag.p, t = drag.t; drag = null;
        if (fits(p, row, col)) { tray[t] = null; place(p, row, col); } else G.sfx.pop();
        draw();
      }
      cv.addEventListener("pointerup", drop); cv.addEventListener("pointercancel", function () { drag = null; draw(); });
      $("#nw", r).addEventListener("click", newGame); G.soundBtn($("#sn", r));
      newGame();
    }
  });
})();
