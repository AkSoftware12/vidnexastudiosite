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

/* Snake – three modes, three speeds, golden stars, pause, swipe */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;

  VX.tool("snake", {
    html: '<div class="gopt"><div id="om" role="group" aria-label="Mode"></div><div id="os" role="group" aria-label="Speed"></div></div>' +
      G.hud([["sc", "Score", 0], ["bs", "Best", 0], ["ln", "Length", 3]]) +
      '<div class="gwrap"><div class="gstage" style="--gw:440px"><canvas id="cv" class="gcanvas swipe" style="width:100%" aria-label="Snake game board"></canvas></div>' +
      '<div class="pad"><button class="up" data-d="u" aria-label="Up">▲</button><button class="l" data-d="l" aria-label="Left">◀</button><button class="d" data-d="d" aria-label="Down">▼</button><button class="r" data-d="r" aria-label="Right">▶</button></div>' +
      '<div class="gbar"><button class="btn ghost sm" id="ps" type="button">Pause</button><button class="btn ghost sm" id="rs" type="button">Restart</button><button class="btn ghost sm" id="sn" type="button"></button></div>' +
      '<p class="gnote">Arrow keys or WASD to steer, Space to pause. On a phone, swipe on the board. Golden stars give 3 points but vanish fast.</p></div>',
    init: function (r) {
      var cv = $("#cv", r), stage = $(".gstage", r), N = 20, S = 22, W = N * S, x = G.canvas(cv, W, W);
      var MODES = [["classic", "Classic"], ["wrap", "Wrap-around"], ["rocks", "Rocks"]], SPEEDS = [["slow", "Slow"], ["normal", "Normal"], ["fast", "Fast"]];
      var BASE = { slow: 270, normal: 200, fast: 140 }, FLOOR = { slow: 210, normal: 150, fast: 100 };
      var mode = ls.get("sn_mode", "classic"), spd = ls.get("sn_spd", "normal"); if (!BASE[spd]) spd = "normal";
      var DX = { l: -1, r: 1, u: 0, d: 0 }, DY = { l: 0, r: 0, u: -1, d: 1 }, OPP = { l: "r", r: "l", u: "d", d: "u" };
      var snake, dir, q, food, gold, rocks, score, iv, acc, last, state = "idle", eaten, parts = [], shake = 0;
      var bestKey = function () { return "sn_best_" + mode + "_" + spd; };

      function free(x0, y0) {
        if (x0 < 0 || y0 < 0 || x0 >= N || y0 >= N) return false;
        return !snake.some(function (s) { return s.x === x0 && s.y === y0; }) && !rocks.some(function (s) { return s.x === x0 && s.y === y0; }) &&
          !(food && food.x === x0 && food.y === y0) && !(gold && gold.x === x0 && gold.y === y0);
      }
      function spot(avoidHead) {
        for (var i = 0; i < 400; i++) {
          var p = { x: G.rand(N), y: G.rand(N) };
          if (!free(p.x, p.y)) continue;
          if (avoidHead && Math.abs(p.x - snake[0].x) + Math.abs(p.y - snake[0].y) < 4) continue;
          return p;
        }
        return null;
      }
      function reset() {
        snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]; dir = "r"; q = []; food = null; gold = null; rocks = []; score = 0; eaten = 0;
        iv = BASE[spd]; acc = 0; parts = []; food = spot(); updHud();
      }
      function updHud() { G.set(r, "sc", score); G.set(r, "bs", ls.get(bestKey(), 0)); G.set(r, "ln", snake.length); }
      function burst(px, py, c, n) { for (var i = 0; i < n; i++) { var a = Math.random() * 6.28, s = 1 + Math.random() * 2.2; parts.push({ x: (px + .5) * S, y: (py + .5) * S, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 1, c: c }); } }

      function start() { G.closeOverlay(stage); reset(); state = "play"; last = performance.now(); $("#ps", r).textContent = "Pause"; }
      function die() {
        state = "over"; shake = 10; G.sfx.lose();
        var b = ls.get(bestKey(), 0), nb = score > b; if (nb) ls.set(bestKey(), score); updHud();
        G.overlay(stage, { title: nb && score > 0 ? "New best! 🎉" : "Game over", text: "You scored <b>" + score + "</b>" + (nb ? "" : " · best " + b) + ".", buttons: [{ label: "Play again", fn: start }] });
      }
      function step() {
        if (q.length) dir = q.shift();
        var h = { x: snake[0].x + DX[dir], y: snake[0].y + DY[dir] };
        if (mode === "wrap") { h.x = (h.x + N) % N; h.y = (h.y + N) % N; }
        else if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N) return die();
        var eatF = food && h.x === food.x && h.y === food.y, eatG = gold && h.x === gold.x && h.y === gold.y;
        var body = snake.slice(0, eatF || eatG ? snake.length : snake.length - 1);
        if (body.some(function (s) { return s.x === h.x && s.y === h.y; }) || rocks.some(function (s) { return s.x === h.x && s.y === h.y; })) return die();
        snake.unshift(h);
        if (eatF) {
          score++; eaten++; G.sfx.pop(); burst(h.x, h.y, "#F87171", 10); food = spot();
          if (eaten % 5 === 0) iv = Math.max(FLOOR[spd], iv - 4);
          if (mode === "rocks" && eaten % 3 === 0) { var rk = spot(true); if (rk) rocks.push(rk); }
          if (!gold && Math.random() < .2) { var g = spot(); if (g) { g.t = performance.now() + 6500; gold = g; } }
        } else if (eatG) {
          score += 3; G.sfx.good(); burst(h.x, h.y, "#FDE047", 16); gold = null;
        } else snake.pop();
        updHud();
      }
      function turn(d) {
        if (state === "idle" || state === "over") return;
        if (state === "pause") { resume(); }
        var lastD = q.length ? q[q.length - 1] : dir; if (d === lastD || d === OPP[lastD]) return; if (q.length < 2) q.push(d);
      }
      function pause() { if (state !== "play") return; state = "pause"; $("#ps", r).textContent = "Resume"; G.overlay(stage, { title: "Paused", buttons: [{ label: "Resume", fn: resume }] }); }
      function resume() { if (state !== "pause") return; G.closeOverlay(stage); state = "play"; last = performance.now(); $("#ps", r).textContent = "Pause"; }

      function rr(px, py, w, h, rad) { x.beginPath(); if (x.roundRect) x.roundRect(px, py, w, h, rad); else x.rect(px, py, w, h); x.fill(); }
      function draw(t) {
        var ox = 0, oy = 0; if (shake > 0) { ox = (Math.random() - .5) * shake; oy = (Math.random() - .5) * shake; shake *= .85; if (shake < .5) shake = 0; }
        x.save(); x.translate(ox, oy);
        x.fillStyle = "#0A0818"; x.fillRect(-10, -10, W + 20, W + 20);
        for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) if ((i + j) % 2) { x.fillStyle = "rgba(124,58,237,.07)"; x.fillRect(i * S, j * S, S, S); }
        rocks.forEach(function (k) { x.fillStyle = "#64748B"; rr(k.x * S + 2, k.y * S + 2, S - 4, S - 4, 6); x.fillStyle = "#94A3B8"; rr(k.x * S + 5, k.y * S + 5, 6, 4, 2); });
        if (food) { var pu = 1 + Math.sin(t / 180) * .06; x.fillStyle = "#EF4444"; x.beginPath(); x.arc((food.x + .5) * S, (food.y + .5) * S + 1, S * .38 * pu, 0, 7); x.fill(); x.fillStyle = "#22C55E"; rr((food.x + .5) * S - 1, food.y * S + 1, 3, 6, 2); x.fillStyle = "rgba(255,255,255,.4)"; x.beginPath(); x.arc((food.x + .5) * S - 3, (food.y + .5) * S - 2, 2.2, 0, 7); x.fill(); }
        if (gold) {
          var left = gold.t - performance.now(); if (left <= 0) gold = null;
          else if (left > 1800 || Math.floor(t / 130) % 2) { x.fillStyle = "#FDE047"; x.shadowColor = "#FACC15"; x.shadowBlur = 12; x.beginPath(); for (var k = 0; k < 10; k++) { var rad = k % 2 ? S * .2 : S * .46, a = -1.57 + k * .628; x.lineTo((gold.x + .5) * S + Math.cos(a) * rad, (gold.y + .5) * S + Math.sin(a) * rad); } x.closePath(); x.fill(); x.shadowBlur = 0; }
        }
        snake.forEach(function (s, idx) {
          var f = 1 - idx / (snake.length + 6); x.fillStyle = idx === 0 ? "#DDD6FE" : "rgb(" + Math.round(90 + 60 * f) + "," + Math.round(50 + 40 * f) + "," + Math.round(200 + 40 * f) + ")";
          rr(s.x * S + 1.5, s.y * S + 1.5, S - 3, S - 3, idx === 0 ? 8 : 6);
        });
        var hd = snake[0]; if (hd) {
          var ex = DX[dir] * 3, ey = DY[dir] * 3, px = (hd.x + .5) * S, py = (hd.y + .5) * S, sx = DX[dir] ? 0 : 4, sy = DX[dir] ? 4 : 0;
          x.fillStyle = "#1E1B4B"; x.beginPath(); x.arc(px + ex + sx, py + ey + sy, 2.2, 0, 7); x.arc(px + ex - sx, py + ey - sy, 2.2, 0, 7); x.fill();
        }
        parts = parts.filter(function (p) { return p.l > 0; });
        parts.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.l -= .04; x.globalAlpha = Math.max(0, p.l); x.fillStyle = p.c; x.fillRect(p.x - 2, p.y - 2, 4, 4); }); x.globalAlpha = 1;
        if (mode !== "wrap") { x.strokeStyle = "#7C3AED"; x.lineWidth = 3; x.strokeRect(1.5, 1.5, W - 3, W - 3); } else { x.strokeStyle = "rgba(167,139,250,.5)"; x.setLineDash([6, 6]); x.lineWidth = 2; x.strokeRect(1, 1, W - 2, W - 2); x.setLineDash([]); }
        x.restore();
      }
      function frame(t) {
        requestAnimationFrame(frame);
        if (state === "play") { acc += Math.min(100, t - last); while (acc >= iv && state === "play") { acc -= iv; step(); } }
        last = t; draw(t);
      }

      function menu() {
        reset(); state = "idle";
        G.overlay(stage, { title: "Snake", text: "Eat apples, don't hit walls or yourself.<br><b>" + (MODES.filter(function (m) { return m[0] === mode; })[0][1]) + " · " + (SPEEDS.filter(function (m) { return m[0] === spd; })[0][1]) + "</b><br>Change mode or speed above any time.", buttons: [{ label: "Play", fn: start }] });
      }
      G.seg($("#om", r), MODES, mode, function (v) { mode = v; ls.set("sn_mode", v); menu(); });
      G.seg($("#os", r), SPEEDS, spd, function (v) { spd = v; ls.set("sn_spd", v); menu(); });
      G.soundBtn($("#sn", r));
      $("#ps", r).addEventListener("click", function () { state === "pause" ? resume() : pause(); });
      $("#rs", r).addEventListener("click", start);
      Array.prototype.forEach.call(r.querySelectorAll("[data-d]"), function (b) { b.addEventListener("click", function () { turn(b.getAttribute("data-d")); }); });
      G.swipe(cv, turn);
      G.keys(function (e) {
        var m = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d", a: "l", d: "r", w: "u", s: "d", A: "l", D: "r", W: "u", S: "d" }[e.key];
        if (m) { if (state === "play" || state === "pause") e.preventDefault(); turn(m); }
        else if (e.key === " " && (state === "play" || state === "pause")) { e.preventDefault(); state === "pause" ? resume() : pause(); }
      });
      G.blur(pause);
      menu(); requestAnimationFrame(frame);
    }
  });
})();
