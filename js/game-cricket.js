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

/* Cricket Batting – tap at the right moment to hit. Perfect timing is a six, late or early is a dot ball or a wicket. */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;
  var W = 440, H = 560, ZC = .7;
  var PITCH = 11 * Math.PI / 180, CHh = 3.1, CZ = -6.5, F = 560, CX = W / 2, CY = H * .43, CP = Math.cos(PITCH), SP = Math.sin(PITCH);
  function proj(X, Y, Z) { var y = Y - CHh, z = Z - CZ, zc = z * CP - y * SP, yc = z * SP + y * CP; if (zc < .2) zc = .2; return { x: CX + F * X / zc, y: CY - F * yc / zc, s: F / zc }; }

  VX.tool("cricket", {
    html: '<div class="gopt"><div id="omd" role="group" aria-label="Match"></div><div id="odf" role="group" aria-label="Bowling"></div></div>' +
      G.hud([["sc", "Score", "0/0"], ["ov", "Overs", "0.0"], ["tg", "Target", "–"], ["bs", "Best", 0]]) +
      '<div class="gwrap"><div class="gstage" style="--gw:440px"><canvas class="gcanvas swipe" id="cv" width="440" height="560" style="width:100%" aria-label="Cricket pitch"></canvas></div>' +
      '<div class="gmsg" id="msg" aria-live="polite" style="min-height:52px;display:flex;align-items:center"></div>' +
      '<div class="gbar"><button class="btn" id="hit" type="button" style="min-width:200px">🏏 Hit</button></div>' +
      '<div class="gbar" style="margin-top:14px"><button class="btn ghost sm" id="nw" type="button">New match</button><button class="btn ghost sm" id="sn" type="button"></button></div>' +
      '<p class="gnote">Tap Hit (or the pitch, or press Space) when the ball reaches the bat. Perfect timing is a 6, good is a 4, early or late can get you out.</p></div>',
    init: function (r) {
      var cv = $("#cv", r), x = G.canvas(cv, W, H), stage = $(".gstage", r), msg = $("#msg", r), hitBtn = $("#hit", r);
      var mode = ls.get("ck_m", "2"), diff = ls.get("ck_d", "normal"), runs, wk, balls, target, over, ball, swing, fx, raf, lastRes, streak, commentary, pfx = G.fx(stage), bg = null, runup = 0, stumps = null, last = performance.now();
      var BALLS = { "2": 12, "5": 30, "chase": 12 };
      function bestKey() { return "ck_best_" + mode + diff; }
      function say(t) { msg.textContent = t; }
      cv._st = function () { return ball ? { u: ball.u, T: ball.T, hit: ball.hit } : null; };
      function newGame() {
        runs = 0; wk = 0; balls = 0; over = false; ball = null; swing = 0; fx = []; lastRes = ""; streak = 0; runup = 0; stumps = null;
        target = mode === "chase" ? 18 + G.rand(20) + (diff === "hard" ? 8 : 0) : null;
        G.closeOverlay(stage); upd(); say(mode === "chase" ? "Chase " + target + " in 2 overs with 3 wickets. Tap Hit to start." : "Tap Hit when the ball reaches the bat. Tap to bowl."); hitBtn.disabled = false; loop();
      }
      function upd() { G.set(r, "sc", runs + "/" + wk); G.set(r, "ov", Math.floor(balls / 6) + "." + (balls % 6)); G.set(r, "tg", target ? target : "–"); G.set(r, "bs", ls.get(bestKey(), 0)); }
      function bowl() {
        if (ball || over || runup) return;
        runup = .01; say(""); stumps = null;
      }
      function release() {
        var T = (diff === "easy" ? 1.55 : diff === "hard" ? 1.0 : 1.25) + (Math.random() - .5) * (diff === "hard" ? .35 : .25);
        ball = { u: 0, T: T, line: (Math.random() - .5) * .7, swingX: (Math.random() - .5) * .5, ub: .58 + Math.random() * .12, hit: false, x: 0, y: 2.2, z: 19.5, vx: 0, vy: 0, vz: 0 };
        G.sfx.whoosh();
      }
      function ballAt(u) { // delivery path
        var z = 19.5 - (19.5 - ZC) * u, xx = ball.line * (1 - u) + ball.swingX * u * u, y;
        if (u < ball.ub) { var k = u / ball.ub; y = 2.2 * (1 - k) + .9 * Math.sin(k * Math.PI) * .25; } else { var k2 = (u - ball.ub) / (1 - ball.ub); y = Math.sin(Math.min(1, k2) * Math.PI * .5) * .85; }
        return { x: xx, y: Math.max(.08, y), z: z };
      }
      function hit() {
        if (over) return; if (!ball && !runup) return bowl(); if (!ball || ball.hit || swing > 0) return;
        swing = 1; var dtms = (1 - ball.u) * ball.T * 1000, res, rn = 0; // dtms > 0: early
        var win = diff === "easy" ? 1.4 : diff === "hard" ? .8 : 1, a = Math.abs(dtms);
        if (a < 45 * win) { res = "SIX!"; rn = 6; } else if (a < 100 * win) { res = "FOUR!"; rn = 4; } else if (a < 160 * win) { res = dtms > 0 ? "Two runs" : "Single"; rn = dtms > 0 ? 2 : 1; }
        else if (a < 250 * win) { res = dtms > 0 ? "Too early, dot ball" : "Late, dot ball"; rn = 0; } else { res = dtms > 0 ? "Caught! Too early" : "Bowled! Too late"; rn = -1; }
        if (rn === -1 && dtms > 0 && ball.u < .45) return (swing = 1, void 0); // swinging long before the ball arrives just misses the air
        ball.hit = true; ball.res = rn; var side = (Math.random() - .5);
        if (rn === 6) { ball.vx = side * 14; ball.vy = 13; ball.vz = 26; G.sfx.win(); G.buzz(40); }
        else if (rn === 4) { ball.vx = side * 22; ball.vy = 3; ball.vz = 22; G.sfx.good(); }
        else if (rn > 0) { ball.vx = side * 10; ball.vy = 2; ball.vz = 8; G.sfx.good(); }
        else if (rn === 0) { ball.vx = side * 3; ball.vy = 1; ball.vz = 2; G.sfx.knock(2); }
        else if (dtms > 0) { ball.vx = side * 4; ball.vy = 12; ball.vz = 7; G.sfx.knock(3); }
        else { ball.hit = false; ball.res = -1; }
        if (rn !== -1 || dtms > 0) setTimeout(function () { score(rn, res); }, rn >= 4 ? 1100 : 700);
      }
      function missed() { ball.hit = true; ball.res = -1; ball.vz = -4; ball.vy = 0; ball.vx = 0; G.sfx.bad(); G.buzz(60); G.shake(stage); stumps = { t: performance.now() }; setTimeout(function () { score(-1, "Bowled! You missed"); }, 900); }
      function score(rn, res) {
        if (over) return; balls++;
        if (rn < 0) { wk++; streak = 0; } else { runs += rn; if (rn >= 4) streak++; else streak = 0; }
        if (streak >= 3) res += " · " + streak + " in a row!";
        say(res); var lbl = rn === 6 ? "SIX!" : rn === 4 ? "FOUR!" : rn > 0 ? "+" + rn : rn === 0 ? "Dot ball" : (res.indexOf("Caught") === 0 ? "CAUGHT!" : "BOWLED!");
        pfx.text(.5, .3, lbl, rn < 0 ? "#FCA5A5" : rn >= 4 ? "#FDE047" : "#fff", rn >= 4 || rn < 0 ? 46 : 30);
        if (rn === 6) pfx.confetti(); else if (rn === 4) pfx.burst(.5, .3, ["#FDE047", "#22D3EE", "#fff"], 26, 6);
        if (runs > ls.get(bestKey(), 0)) ls.set(bestKey(), runs); upd(); ball = null; runup = 0;
        var max = BALLS[mode], done = false, title = "", text = "";
        if (target && runs >= target) { done = true; title = "You won!"; text = "Target " + target + " chased with " + (max - balls) + " balls and " + (3 - wk) + " wickets left."; }
        else if (wk >= 3) { done = true; title = target ? "All out, you lost" : "All out!"; text = "You scored <b>" + runs + "</b> in " + Math.floor(balls / 6) + "." + (balls % 6) + " overs."; }
        else if (balls >= max) { done = true; title = target ? (runs >= target ? "You won!" : "Lost by " + (target - runs) + " runs") : "Innings over"; text = "Final score <b>" + runs + "/" + wk + "</b>" + (runs >= ls.get(bestKey(), 0) && runs > 0 ? " · best!" : ""); }
        if (done) { over = true; hitBtn.disabled = true; if (title.indexOf("won") >= 0 || (!target && runs >= 20)) G.sfx.win(); setTimeout(function () { G.overlay(stage, { win: title.indexOf("won") >= 0 || (!target && runs >= 20), lose: title.indexOf("lost") >= 0 || title.indexOf("Lost") >= 0, icon: title.indexOf("won") >= 0 ? "🏆" : "🏏", title: title, text: text, buttons: [{ label: "Play again", fn: newGame }] }); }, 1200); }
      }
      function poly(pts, fill) { x.beginPath(); x.moveTo(pts[0].x, pts[0].y); for (var i = 1; i < pts.length; i++) x.lineTo(pts[i].x, pts[i].y); x.closePath(); x.fillStyle = fill; x.fill(); }
      function buildBg() {
        var dpr = Math.min(2, window.devicePixelRatio || 1), o = document.createElement("canvas"); o.width = W * dpr; o.height = H * dpr;
        var c = o.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
        var hz = proj(0, 0, 120).y;
        var sky = c.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, "#1e3a8a"); sky.addColorStop(1, "#60a5fa"); c.fillStyle = sky; c.fillRect(0, 0, W, hz);
        // stands with crowd
        var sh = 46; c.fillStyle = "#1f2937"; c.fillRect(0, hz - sh, W, sh);
        var cols = ["#f87171", "#fbbf24", "#60a5fa", "#34d399", "#f472b6", "#e5e7eb", "#a78bfa"];
        for (var i = 0; i < 700; i++) { c.fillStyle = cols[i % cols.length]; c.globalAlpha = .75; c.fillRect(Math.random() * W, hz - sh + 4 + Math.random() * (sh - 10), 2.2, 2.2); } c.globalAlpha = 1;
        c.fillStyle = "#0f172a"; c.fillRect(0, hz - sh - 6, W, 6);
        [W * .12, W * .88].forEach(function (lx) { c.fillStyle = "#94a3b8"; c.fillRect(lx - 1.5, hz - sh - 70, 3, 64); c.fillStyle = "#fef9c3"; c.shadowColor = "#fde047"; c.shadowBlur = 16; c.fillRect(lx - 14, hz - sh - 82, 28, 14); c.shadowBlur = 0; });
        // field with mowing stripes
        c.fillStyle = "#15803d"; c.fillRect(0, hz, W, H - hz);
        for (var z = -6; z < 120; z += 4) { var a = proj(-80, 0, z), b = proj(80, 0, z), a2 = proj(-80, 0, z + 2), b2 = proj(80, 0, z + 2); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(b2.x, b2.y); c.lineTo(a2.x, a2.y); c.closePath(); c.fillStyle = "#16a34a"; c.fill(); }
        // boundary rope
        c.strokeStyle = "rgba(255,255,255,.85)"; c.lineWidth = 2; c.beginPath();
        for (var t = 0; t <= 64; t++) { var an = t / 64 * Math.PI * 2, px = Math.cos(an) * 46, pz = 12 + Math.sin(an) * 52; if (pz < -5) continue; var q = proj(px, 0, pz); t === 0 ? c.moveTo(q.x, q.y) : c.lineTo(q.x, q.y); } c.stroke();
        // 30-yard circle
        c.setLineDash([4, 6]); c.strokeStyle = "rgba(255,255,255,.4)"; c.beginPath(); for (var t2 = 0; t2 <= 64; t2++) { var an2 = t2 / 64 * Math.PI * 2, q2 = proj(Math.cos(an2) * 20, 0, 10 + Math.sin(an2) * 22); t2 === 0 ? c.moveTo(q2.x, q2.y) : c.lineTo(q2.x, q2.y); } c.stroke(); c.setLineDash([]);
        // pitch
        var pa = proj(-1.6, 0, 22), pb = proj(1.6, 0, 22), pc = proj(1.6, 0, -2.5), pd = proj(-1.6, 0, -2.5);
        var pg = c.createLinearGradient(0, pa.y, 0, pd.y); pg.addColorStop(0, "#c9a86a"); pg.addColorStop(1, "#e3c78f");
        c.beginPath(); c.moveTo(pa.x, pa.y); c.lineTo(pb.x, pb.y); c.lineTo(pc.x, pc.y); c.lineTo(pd.x, pd.y); c.closePath(); c.fillStyle = pg; c.fill();
        // creases
        c.strokeStyle = "#fff"; c.lineWidth = 2;
        [[0, 1.6], [20, 1.6], [-1.2, 1.3], [21.2, 1.3]].forEach(function (k) { var l = proj(-k[1], 0, k[0]), rr = proj(k[1], 0, k[0]); c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(rr.x, rr.y); c.stroke(); });
        [-1.3, 1.3].forEach(function (xx) { var l = proj(xx, 0, -1.4), rr = proj(xx, 0, 1.2), l2 = proj(xx, 0, 19), r2 = proj(xx, 0, 21.4); c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(rr.x, rr.y); c.moveTo(l2.x, l2.y); c.lineTo(r2.x, r2.y); c.stroke(); });
        return o;
      }
      function stumpSet(z, fly) {
        [-.12, 0, .12].forEach(function (dx, i) {
          var off = fly ? { x: (i - 1) * fly * .8, y: fly * .3, rot: (i - 1) * fly } : { x: 0, y: 0, rot: 0 };
          var b = proj(dx + off.x, 0, z), t = proj(dx + off.x + off.rot * .3, .72 + off.y, z), w = Math.max(1.5, .05 * b.s);
          x.strokeStyle = "#f5deb3"; x.lineWidth = w; x.beginPath(); x.moveTo(b.x, b.y); x.lineTo(t.x, t.y); x.stroke();
        });
        if (!fly) { var l = proj(-.13, .74, z), rr = proj(.13, .74, z); x.strokeStyle = "#d97706"; x.lineWidth = Math.max(1.5, .04 * l.s); x.beginPath(); x.moveTo(l.x, l.y); x.lineTo(rr.x, rr.y); x.stroke(); }
        x.lineWidth = 1;
      }
      function figure(X, Z, shirt, facing, swingK, armK) {
        var feet = proj(X, 0, Z), hip = proj(X, .95, Z), sh = proj(X, 1.45, Z), head = proj(X, 1.7, Z), s0 = feet.s;
        x.fillStyle = "rgba(0,0,0,.25)"; x.beginPath(); x.ellipse(feet.x, feet.y, .35 * s0, .1 * s0, 0, 0, 7); x.fill();
        x.strokeStyle = "#f1f5f9"; x.lineWidth = .13 * s0; x.lineCap = "round"; x.beginPath(); x.moveTo(hip.x - .1 * s0, hip.y); x.lineTo(feet.x - .16 * s0, feet.y); x.moveTo(hip.x + .1 * s0, hip.y); x.lineTo(feet.x + .16 * s0, feet.y); x.stroke();
        x.fillStyle = shirt; x.beginPath(); x.roundRect ? x.roundRect(hip.x - .2 * s0, sh.y, .4 * s0, hip.y - sh.y + .05 * s0, .08 * s0) : x.rect(hip.x - .2 * s0, sh.y, .4 * s0, hip.y - sh.y); x.fill();
        x.fillStyle = facing ? "#1e3a8a" : "#fcd9b6"; x.beginPath(); x.arc(head.x, head.y, .14 * s0, 0, 7); x.fill();
        if (facing) { x.fillStyle = "#1e40af"; x.fillRect(head.x - .16 * s0, head.y - .02 * s0, .32 * s0, .05 * s0); }
        if (armK != null) { var a = armK * Math.PI * 2, ax = sh.x + Math.cos(a) * .45 * s0, ay = sh.y - Math.sin(a) * .45 * s0; x.strokeStyle = "#fcd9b6"; x.lineWidth = .08 * s0; x.beginPath(); x.moveTo(sh.x, sh.y); x.lineTo(ax, ay); x.stroke(); }
        if (swingK != null) { // bat
          var ang = swingK > 0 ? (-2.2 + swingK * 3.6) : -2.4, hx = hip.x - .18 * s0, hy = hip.y - .05 * s0, L = .95 * s0;
          x.save(); x.translate(hx, hy); x.rotate(ang); x.fillStyle = "#e7c48a"; x.fillRect(-.05 * s0, 0, .1 * s0, L * .25); x.fillStyle = "#f3d9a4"; x.beginPath(); x.roundRect ? x.roundRect(-.08 * s0, L * .25, .16 * s0, L * .75, .04 * s0) : x.rect(-.08 * s0, L * .25, .16 * s0, L * .75); x.fill(); x.restore();
        }
        x.lineCap = "butt"; x.lineWidth = 1;
      }
      function drawBall() {
        if (!ball) return; var p = proj(ball.x, ball.y, ball.z), sh = proj(ball.x, 0, ball.z), rr = Math.max(2.2, .09 * p.s);
        x.fillStyle = "rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(sh.x, sh.y, rr, rr * .4, 0, 0, 7); x.fill();
        var g = x.createRadialGradient(p.x - rr * .3, p.y - rr * .3, rr * .1, p.x, p.y, rr); g.addColorStop(0, "#fecaca"); g.addColorStop(.4, "#dc2626"); g.addColorStop(1, "#7f1d1d");
        x.fillStyle = g; x.beginPath(); x.arc(p.x, p.y, rr, 0, 7); x.fill(); x.strokeStyle = "rgba(255,255,255,.8)"; x.lineWidth = Math.max(.6, rr * .15); x.beginPath(); x.arc(p.x, p.y, rr * .7, -.6, .6); x.stroke(); x.lineWidth = 1;
      }
      function draw() {
        if (!bg) bg = buildBg();
        x.drawImage(bg, 0, 0, W, H);
        // timing zone glow on the pitch
        var zp = .5 + .5 * Math.sin(performance.now() / 180), za = proj(-.9, .01, ZC + .45), zb = proj(.9, .01, ZC + .45), zc2 = proj(.9, .01, ZC - .45), zd = proj(-.9, .01, ZC - .45);
        poly([za, zb, zc2, zd], "rgba(250,204,21," + (ball && !ball.hit ? .22 + zp * .2 : .12) + ")");
        // far end: stumps + bowler
        stumpSet(20.6);
        var bz = runup ? 26 - runup * 6 : (ball && ball.u < .2 ? 20 : 26), arm = runup ? runup * 1.5 : null;
        figure(-.35, Math.max(20.2, bz), "#991b1b", false, null, arm);
        if (ball && ball.z > 6) drawBall();
        // near end: stumps behind the batter, then batter
        var fly = stumps ? Math.min(1.6, (performance.now() - stumps.t) / 250) : 0;
        figure(.55, -.1, "#1d4ed8", true, swing > 0 ? swing : 0, null);
        stumpSet(-.7, fly || null);
        if (ball && ball.z <= 6) drawBall();
        if (!ball && !runup && !over) { x.font = "800 18px Inter,system-ui"; x.textAlign = "center"; x.lineWidth = 4; x.strokeStyle = "rgba(0,0,0,.4)"; x.strokeText("Tap to bowl", W / 2, H * .62); x.fillStyle = "#fff"; x.fillText("Tap to bowl", W / 2, H * .62); }
      }
      function step(dt) {
        if (swing > 0) { swing += dt * 5; if (swing > 1) swing = 0; }
        if (runup) { runup += dt / .7; if (runup >= 1) { runup = 0; release(); } }
        if (!ball) return;
        if (!ball.hit) {
          ball.u += dt / ball.T; var q = ballAt(ball.u); ball.x = q.x; ball.y = q.y; ball.z = q.z;
          if (ball.u >= 1) { var extra = (ball.u - 1) * ball.T * 9; ball.z = ZC - extra; ball.y = .85; }
          if (ball.z < -1.1) missed();
        } else {
          ball.vy -= 22 * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
          if (ball.y < .08) { ball.y = .08; ball.vy = -ball.vy * .45; ball.vx *= .8; ball.vz *= .8; }
        }
      }
      function loop() { cancelAnimationFrame(raf); (function f(t) { var dt = Math.min(.05, ((t || performance.now()) - last) / 1000); last = t || performance.now(); step(dt); draw(); raf = requestAnimationFrame(f); })(); }
      cv.addEventListener("pointerdown", function (e) { e.preventDefault(); hit(); });
      hitBtn.addEventListener("click", hit);
      G.keys(function (e) { if (e.key === " " || e.key === "Enter") { hit(); e.preventDefault(); } });
      G.seg($("#omd", r), [["2", "2 overs"], ["5", "5 overs"], ["chase", "Chase"]], mode, function (v) { mode = v; ls.set("ck_m", v); newGame(); });
      G.seg($("#odf", r), [["easy", "Easy"], ["normal", "Normal"], ["hard", "Hard"]], diff, function (v) { diff = v; ls.set("ck_d", v); newGame(); });
      $("#nw", r).addEventListener("click", newGame); G.soundBtn($("#sn", r));
      newGame();
    }
  });
})();
