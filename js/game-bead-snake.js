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

/* Bead Snake – a 3D runner: steer a snake of beads, collect bead bundles, smash numbered blocks.
   Each block costs as many beads as its number. Run out of beads and the game is over. */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;
  var W = 440, H = 720, LANES = 5, TW = 5, HEADZ = 9, NEAR = 0.2, FAR = 31, SPACING = .62, BR = .3;
  // camera
  var PITCH = 30 * Math.PI / 180, CH = 16, CZ = -20, F = 2100, CX = W / 2, CY = H * .60, CP = Math.cos(PITCH), SP = Math.sin(PITCH);
  function proj(X, Y, Z) {
    var y = Y - CH, z = Z - CZ, zc = z * CP - y * SP, yc = z * SP + y * CP;
    if (zc < .1) zc = .1;
    return { x: CX + F * X / zc, y: CY - F * yc / zc, s: F / zc };
  }
  var BCOL = [["#4ADE80", "#16A34A", "#166534"], ["#A3E635", "#65A30D", "#3F6212"], ["#FDE047", "#EAB308", "#A16207"], ["#FDBA74", "#F97316", "#9A3412"], ["#F87171", "#DC2626", "#7F1D1D"]];

  VX.tool("bead-snake", {
    html: '<div class="gopt"><div id="osp" role="group" aria-label="Speed"></div></div>' +
      G.hud([["sc", "Score", 0], ["lv", "Level", 1], ["bs", "Best", 0]]) +
      '<div class="gwrap"><div class="gstage" style="--gw:440px"><canvas class="gcanvas swipe" id="cv" width="440" height="720" style="width:100%" aria-label="Bead Snake 3D track"></canvas></div>' +
      '<div class="gbar"><button class="btn ghost sm" id="nw" type="button">New game</button><button class="btn ghost sm" id="sn" type="button"></button></div>' +
      '<p class="gnote">Drag left or right (or use the arrow keys) to steer. Pick up white bead bundles to grow. A block takes as many beads as its number, so pick the smallest ones. Walls cannot be crossed.</p></div>',
    init: function (r) {
      var cv = $("#cv", r), x = G.canvas(cv, W, H), stage = $(".gstage", r), fx = G.fx(stage);
      var spd = ls.get("bd_s", "normal"), reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      var st, raf, last = 0, keys = { l: 0, r: 0 };
      function baseSpeed() { return spd === "slow" ? 7 : spd === "fast" ? 11.5 : 9; }
      function reset() {
        st = { rows: 0, hx: 0, tx: 0, len: 6, dist: 0, trail: [], objs: [], score: 0, level: 1, nextLevel: 140, speed: baseSpeed(), hit: null, hitT: 0, over: false, started: false, nextRow: 22, shards: [], pops: [], scroll: 0 };
        for (var i = 0; i < 400; i++) st.trail.push({ d: -i * .1, x: 0 });
        while (st.nextRow < FAR + 20) spawn();
        G.set(r, "sc", 0); G.set(r, "lv", 1); G.set(r, "bs", ls.get("bd_best", 0));
        G.closeOverlay(stage);
        G.overlay(stage, { icon: "🐍", title: "Bead Snake", text: "Drag to steer. Collect beads, smash the smallest blocks.", buttons: [{ label: "Play", fn: function () { st.started = true; last = performance.now(); } }] });
      }
      function rnd(a, b) { return a + Math.random() * (b - a); }
      function spawn() {
        var z = st.nextRow, len = Math.max(1, st.len), lvl = st.level, maxV = Math.max(3, Math.round(len * (1.1 + lvl * .12)) + lvl);
        var kind = st.rows++ < 3 ? .9 : Math.random();
        if (kind < .45) { // full wall of blocks: at least one cheap block
          var cheap = G.rand(LANES);
          for (var l = 0; l < LANES; l++) st.objs.push({ t: "b", lane: l, z: z, v: l === cheap ? Math.max(1, Math.round(rnd(1, Math.max(1, len * .5)))) : Math.max(1, Math.round(rnd(len * .4, maxV))) });
        } else { // a few blocks
          var lanes = G.shuffle([0, 1, 2, 3, 4]).slice(0, 1 + G.rand(3));
          var early = st.rows <= 3; lanes.forEach(function (l) { st.objs.push({ t: "b", lane: l, z: z, v: Math.max(1, Math.round(rnd(1, early ? Math.max(2, len * .5) : maxV))) }); });
        }
        // walls between lanes after the row
        if (Math.random() < .55) { var wl = 1 + G.rand(LANES - 1), wlen = rnd(3, 9); st.objs.push({ t: "w", x: wl - TW / 2, z0: z + .6, z1: z + .6 + wlen }); }
        if (Math.random() < .35) { var wl2 = 1 + G.rand(LANES - 1), wlen2 = rnd(2, 6); st.objs.push({ t: "w", x: wl2 - TW / 2, z0: z + 4, z1: z + 4 + wlen2 }); }
        // bead bundles
        var nb = 1 + G.rand(3);
        for (var i = 0; i < nb; i++) st.objs.push({ t: "p", x: (G.rand(LANES) - 2) * 1 + rnd(-.15, .15), z: z + rnd(3, 9), v: 1 + G.rand(Math.min(6, 2 + lvl)) });
        st.nextRow += rnd(10, 14) - Math.min(3, lvl * .3);
      }
      function laneX(l) { return l - (LANES - 1) / 2; }
      function trailX(back) { // x of the snake at `back` units behind the head
        var d = st.dist - back, tr = st.trail;
        for (var i = 0; i < tr.length - 1; i++) { if (tr[i + 1].d <= d) { var a = tr[i], b = tr[i + 1], k = (d - b.d) / Math.max(1e-6, a.d - b.d); return b.x + (a.x - b.x) * k; } }
        return tr[tr.length - 1].x;
      }
      function wallBlocks(fromX, toX) {
        var lo = Math.min(fromX, toX) - BR, hi = Math.max(fromX, toX) + BR, res = toX;
        st.objs.forEach(function (o) {
          if (o.t === "w" && HEADZ + BR > o.z0 && HEADZ - BR < o.z1 && o.x > lo && o.x < hi) res = toX > fromX ? Math.min(res, o.x - BR - .02) : Math.max(res, o.x + BR + .02);
          if (o.t === "b" && o.v > 0 && Math.abs(o.z - HEADZ) < .5 + BR * .6) { var bx = laneX(o.lane); if (bx - .5 > lo - .1 && bx - .5 < hi && toX > fromX && fromX <= bx - .5 - BR + .05) res = Math.min(res, bx - .5 - BR); if (bx + .5 < hi + .1 && bx + .5 > lo && toX < fromX && fromX >= bx + .5 + BR - .05) res = Math.max(res, bx + .5 + BR); }
        });
        return res;
      }
      function step(dt) {
        if (!st.started || st.over) return;
        // steering
        var want = st.tx + (keys.r - keys.l) * 7 * dt; st.tx = G.clamp(want, -TW / 2 + BR, TW / 2 - BR);
        var nx = st.hx + (st.tx - st.hx) * Math.min(1, dt * 16); nx = G.clamp(nx, -TW / 2 + BR, TW / 2 - BR);
        nx = wallBlocks(st.hx, nx); st.hx = nx; if (Math.abs(st.tx - st.hx) > .6) st.tx = st.hx + Math.sign(st.tx - st.hx) * .6;
        // block contact
        if (st.hit) {
          st.hitT -= dt;
          while (st.hitT <= 0 && st.hit) {
            st.hitT += .075; st.hit.v--; st.len--; st.score++; G.set(r, "sc", st.score);
            var p = proj(laneX(st.hit.lane), .5, st.hit.z - .5); fx.burst(p.x / W, p.y / H, [BCOL[colIdx(st.hit.v + 1)][0], "#fff"], 5, 3);
            G.sfx.knock(2);
            if (st.hit.v <= 0) { breakBlock(st.hit); st.hit = null; }
            if (st.len <= 0) return die();
          }
          if (st.hit && Math.abs(laneX(st.hit.lane) - st.hx) > .5 + BR * .5) st.hit = null; // slid off
          if (st.hit) return;
        }
        var mv = st.speed * dt;
        st.dist += mv; st.scroll += mv;
        st.trail.unshift({ d: st.dist, x: st.hx }); if (st.trail.length > 700) st.trail.pop();
        st.objs.forEach(function (o) { if (o.t === "w") { o.z0 -= mv; o.z1 -= mv; } else o.z -= mv; });
        st.nextRow -= mv;
        while (st.nextRow < FAR + 20) spawn();
        // collisions
        for (var i = 0; i < st.objs.length; i++) {
          var o = st.objs[i];
          if (o.t === "b" && o.v > 0 && o.z - .5 <= HEADZ + BR && o.z + .5 > HEADZ - BR && Math.abs(laneX(o.lane) - st.hx) < .5 + BR * .4) {
            var back = (HEADZ + BR) - (o.z - .5); o.z += back; // push back to touch
            st.objs.forEach(function (q) { if (q !== o) { if (q.t === "w") { q.z0 += back; q.z1 += back; } else q.z += back; } }); st.nextRow += back;
            st.hit = o; st.hitT = 0; break;
          }
          if (o.t === "p" && !o.got && Math.abs(o.z - HEADZ) < .6 && Math.abs(o.x - st.hx) < .6) {
            o.got = true; st.len += o.v; G.sfx.coin(); var pp = proj(o.x, .6, o.z); fx.text(pp.x / W, pp.y / H, "+" + o.v, "#fff", 24);
          }
        }
        st.objs = st.objs.filter(function (o) { return !o.got && (o.t === "w" ? o.z1 > NEAR - 2 : o.z > NEAR - 2) && !(o.t === "b" && o.v <= 0); });
        // levels
        if (st.dist >= st.nextLevel) { st.level++; st.nextLevel += 140 + st.level * 20; st.speed = baseSpeed() + st.level * .45; G.set(r, "lv", st.level); fx.text(.5, .3, "Level " + st.level + "!", "#FDE047", 34); G.sfx.win(); }
      }
      function colIdx(v) { var rel = v / Math.max(1, st.len); return rel < .25 ? 0 : rel < .5 ? 1 : rel < .8 ? 2 : rel < 1.05 ? 3 : 4; }
      function breakBlock(o) {
        G.sfx.pop(); G.buzz(25);
        var c = BCOL[colIdx(1)];
        if (!reduce) for (var i = 0; i < 14; i++) st.shards.push({ x: laneX(o.lane) + rnd(-.4, .4), y: rnd(.1, .8), z: o.z + rnd(-.4, .4), vx: rnd(-3, 3), vy: rnd(2, 6), vz: rnd(-1, 4), s: rnd(.12, .26), c: c, life: 1 });
      }
      function die() {
        st.over = true; G.sfx.lose(); G.shake(stage);
        var best = ls.get("bd_best", 0), nb = st.score > best && best > 0; if (st.score > best) ls.set("bd_best", st.score); G.set(r, "bs", Math.max(best, st.score));
        setTimeout(function () { G.overlay(stage, { lose: !nb, win: nb, icon: nb ? "🏆" : "💥", title: nb ? "New best!" : "Out of beads", text: "Score <b>" + st.score + "</b> · level " + st.level, buttons: [{ label: "Play again", fn: function () { reset(); st.started = true; G.closeOverlay(stage); last = performance.now(); } }] }); }, 500);
      }
      /* ---------- 3D drawing ---------- */
      function poly(pts, fill) { x.beginPath(); x.moveTo(pts[0].x, pts[0].y); for (var i = 1; i < pts.length; i++) x.lineTo(pts[i].x, pts[i].y); x.closePath(); x.fillStyle = fill; x.fill(); }
      function cube(cx, z, w, h, cols, label, d) {
        var x0 = cx - w / 2, x1 = cx + w / 2, z0 = z - d / 2, z1 = z + d / 2;
        var A = proj(x0, 0, z0), B = proj(x1, 0, z0), Cc = proj(x1, h, z0), D = proj(x0, h, z0), E = proj(x0, h, z1), Fp = proj(x1, h, z1), Gp = proj(x1, 0, z1), Hh = proj(x0, 0, z1);
        // shadow
        var s0 = proj(x0 + .12, 0, z0 - .12), s1 = proj(x1 + .12, 0, z0 - .12), s2 = proj(x1 + .12, 0, z1 - .12), s3 = proj(x0 + .12, 0, z1 - .12);
        poly([s0, s1, s2, s3], "rgba(0,0,0,.28)");
        if (cx > 0) poly([A, D, E, Hh], cols[2]); else poly([B, Gp, Fp, Cc], cols[2]);
        var gf = x.createLinearGradient(0, D.y, 0, A.y); gf.addColorStop(0, cols[0]); gf.addColorStop(1, cols[1]);
        poly([A, B, Cc, D], gf);
        poly([D, Cc, Fp, E], cols[0]);
        x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 1; x.beginPath(); x.moveTo(D.x, D.y); x.lineTo(Cc.x, Cc.y); x.stroke();
        if (label != null) {
          var m = proj(cx, h * .5, z0); x.font = "800 " + Math.max(9, m.s * .44) + "px Inter,system-ui,sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
          x.fillStyle = "rgba(0,0,0,.25)"; x.fillText(label, m.x + 1, m.y + 2); x.fillStyle = "#fff"; x.fillText(label, m.x, m.y);
        }
      }
      function sphere(X, Y, Z, rad, c1, c2) {
        var p = proj(X, Y, Z), sh = proj(X + .08, 0, Z - .05), rr = rad * p.s;
        x.fillStyle = "rgba(0,0,0,.28)"; x.beginPath(); x.ellipse(sh.x, sh.y, rr * 1.05, rr * .5, 0, 0, 7); x.fill();
        var g = x.createRadialGradient(p.x - rr * .35, p.y - rr * .4, rr * .1, p.x, p.y, rr); g.addColorStop(0, "#fff"); g.addColorStop(.35, c1); g.addColorStop(1, c2);
        x.fillStyle = g; x.beginPath(); x.arc(p.x, p.y, rr, 0, 7); x.fill();
        return p;
      }
      function draw() {
        var bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1c1f3a"); bg.addColorStop(1, "#0b0d1e"); x.fillStyle = bg; x.fillRect(0, 0, W, H);
        // track slab
        var tl = proj(-TW / 2 - .3, 0, FAR), tr = proj(TW / 2 + .3, 0, FAR), br = proj(TW / 2 + .3, 0, NEAR - 3), bl = proj(-TW / 2 - .3, 0, NEAR - 3);
        var tg = x.createLinearGradient(0, tl.y, 0, bl.y); tg.addColorStop(0, "#2f3352"); tg.addColorStop(1, "#4b5075"); poly([tl, tr, br, bl], tg);
        // side rails
        [-1, 1].forEach(function (sgn) { var a = proj(sgn * (TW / 2 + .3), 0, FAR), b = proj(sgn * (TW / 2 + .3), 0, NEAR - 3), a2 = proj(sgn * (TW / 2 + .3), .25, FAR), b2 = proj(sgn * (TW / 2 + .3), .25, NEAR - 3); poly([a, b, b2, a2], sgn < 0 ? "#6d28d9" : "#4338ca"); });
        // moving stripes
        x.strokeStyle = "rgba(255,255,255,.06)"; x.lineWidth = 2;
        for (var zz = -(st.scroll % 3); zz < FAR; zz += 3) { if (zz < NEAR - 3) continue; var a = proj(-TW / 2, 0, zz), b = proj(TW / 2, 0, zz); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); }
        for (var l = 1; l < LANES; l++) { var a2 = proj(l - TW / 2, 0, FAR), b2 = proj(l - TW / 2, 0, NEAR - 3); x.strokeStyle = "rgba(255,255,255,.05)"; x.beginPath(); x.moveTo(a2.x, a2.y); x.lineTo(b2.x, b2.y); x.stroke(); }
        // collect drawables, far to near
        var items = [];
        st.objs.forEach(function (o) {
          if (o.t === "b" && o.z < FAR && o.z > NEAR - 1) items.push({ z: o.z + .5, f: function () { cube(laneX(o.lane), o.z, .9, .82, BCOL[colIdx(o.v)], String(o.v), .9); } });
          if (o.t === "w" && o.z0 < FAR) items.push({ z: Math.min(FAR, o.z1), f: function () { var z1 = Math.min(FAR, o.z1), z0 = Math.max(NEAR - 2, o.z0); if (z1 <= z0) return; var cz = (z0 + z1) / 2; cube(o.x, cz, .12, .55, ["#e2e8f0", "#cbd5e1", "#94a3b8"], null, z1 - z0); } });
          if (o.t === "p" && o.z < FAR && o.z > NEAR) items.push({ z: o.z, f: function () {
            var t = performance.now() / 300, n = Math.min(o.v, 6);
            for (var i = 0; i < n; i++) { var a = i / n * 6.283 + t, rx = n > 1 ? .2 : 0; sphere(o.x + Math.cos(a) * rx, .3 + Math.abs(Math.sin(t + i)) * .08, o.z + Math.sin(a) * rx * .6, .17, "#f8fafc", "#94a3b8"); }
            var lp = proj(o.x, 1.05, o.z); x.font = "800 " + Math.max(10, lp.s * .4) + "px Inter,system-ui"; x.textAlign = "center"; x.fillStyle = "#E0F2FE"; x.fillText(String(o.v), lp.x, lp.y);
          } });
        });
        // snake beads
        var n = Math.max(0, st.len);
        for (var i = Math.min(n, 60) - 1; i >= 0; i--) {
          (function (i) {
            var zb = HEADZ - i * SPACING; if (zb < NEAR - 1.5) return;
            items.push({ z: zb, f: function () { var bx = i === 0 ? st.hx : trailX(i * SPACING); sphere(bx, BR, zb, BR * (i === 0 ? 1.08 : 1), i === 0 ? "#fde68a" : "#e0f2fe", i === 0 ? "#d97706" : "#6366f1"); } });
          })(i);
        }
        items.sort(function (a, b) { return b.z - a.z; });
        items.forEach(function (it) { it.f(); });
        // shards
        st.shards = st.shards.filter(function (s) {
          s.vy -= 14 * (1 / 60); s.x += s.vx / 60; s.y += s.vy / 60; s.z += s.vz / 60; s.life -= .025; if (s.life <= 0 || s.y < -1) return false;
          var p = proj(s.x, Math.max(0, s.y), s.z); x.globalAlpha = Math.max(0, s.life); x.fillStyle = s.c[1]; var q = s.s * p.s; x.fillRect(p.x - q / 2, p.y - q / 2, q, q); x.globalAlpha = 1; return true;
        });
        // length label above head
        if (!st.over) { var hp = proj(st.hx, 1.15, HEADZ); x.font = "900 26px Inter,system-ui,sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 5; x.strokeStyle = "rgba(0,0,0,.45)"; x.strokeText(String(st.len), hp.x, hp.y); x.fillStyle = "#fff"; x.fillText(String(st.len), hp.x, hp.y); }
        // level progress bar
        var prev = st.nextLevel - (140 + st.level * 20), k = G.clamp((st.dist - (st.level === 1 ? 0 : prev)) / (st.nextLevel - (st.level === 1 ? 0 : prev)), 0, 1);
        x.fillStyle = "rgba(255,255,255,.18)"; x.fillRect(60, 18, W - 120, 8); var pg = x.createLinearGradient(60, 0, W - 60, 0); pg.addColorStop(0, "#22D3EE"); pg.addColorStop(1, "#A855F7"); x.fillStyle = pg; x.fillRect(60, 18, (W - 120) * k, 8);
        x.font = "800 13px Inter,system-ui"; x.fillStyle = "#fff"; x.textAlign = "right"; x.fillText(String(st.level), 52, 26); x.textAlign = "left"; x.fillText(String(st.level + 1), W - 52, 26);
      }
      function loop() {
        cancelAnimationFrame(raf);
        (function f(t) { var dt = Math.min(.05, (t - last) / 1000 || 0); last = t; if (!document.hidden) { step(dt); draw(); } raf = requestAnimationFrame(f); })(performance.now());
      }
      // controls: relative drag anywhere on the canvas
      var drag = null;
      cv.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, tx: st.tx }; try { cv.setPointerCapture(e.pointerId); } catch (er) {} e.preventDefault(); });
      cv.addEventListener("pointermove", function (e) { if (!drag) return; var b = cv.getBoundingClientRect(); st.tx = G.clamp(drag.tx + (e.clientX - drag.x) / b.width * TW * 1.25, -TW / 2 + BR, TW / 2 - BR); });
      cv.addEventListener("pointerup", function () { drag = null; }); cv.addEventListener("pointercancel", function () { drag = null; });
      document.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft" || e.key === "a") { keys.l = 1; e.preventDefault(); } if (e.key === "ArrowRight" || e.key === "d") { keys.r = 1; e.preventDefault(); } });
      document.addEventListener("keyup", function (e) { if (e.key === "ArrowLeft" || e.key === "a") keys.l = 0; if (e.key === "ArrowRight" || e.key === "d") keys.r = 0; });
      G.seg($("#osp", r), [["slow", "Slow"], ["normal", "Normal"], ["fast", "Fast"]], spd, function (v) { spd = v; ls.set("bd_s", v); reset(); });
      $("#nw", r).addEventListener("click", function () { reset(); });
      G.soundBtn($("#sn", r));
      cv._ai = function () { var best = 0, bc = 1e9; for (var l = 0; l < LANES; l++) { var c = 0; st.objs.forEach(function (o) { if (o.t === "b" && o.lane === l && o.z > HEADZ - .5 && o.z < HEADZ + 9) c += o.v; if (o.t === "p" && Math.abs(o.x - laneX(l)) < .5 && o.z > HEADZ && o.z < HEADZ + 9) c -= o.v * .8; }); c += Math.abs(laneX(l) - st.hx) * .3; if (c < bc) { bc = c; best = l; } } st.tx = laneX(best); };
      cv._st = function () { return JSON.stringify({ len: st.len, score: st.score, level: st.level, over: st.over, started: st.started, dist: Math.round(st.dist) }); };
      reset(); loop();
    }
  });
})();
