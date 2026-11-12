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

/* Sky Hop – one-button flyer: smooth fixed-step physics, 3 difficulties, moving pillars, medals */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;
  var W = 360, H = 540, GROUND = 70, BX = 96, BR = 12;
  var MODE = { chill: { gap: 172, min: 148, move: 0, at: 0, spd: 1.9 }, normal: { gap: 148, min: 116, move: 26, at: 12, spd: 2.15 }, hard: { gap: 132, min: 104, move: 40, at: 6, spd: 2.35 } };

  VX.tool("sky-hop", {
    html: '<div class="gopt"><div id="om" role="group" aria-label="Difficulty"></div></div>' +
      G.hud([["sc", "Score", 0], ["bs", "Best", 0]]) +
      '<div class="gwrap"><div class="gstage" style="--gw:380px"><canvas id="cv" class="gcanvas" style="width:100%;touch-action:none" aria-label="Sky Hop game. Tap, click or press Space to hop."></canvas></div>' +
      '<div class="gbar"><button class="btn ghost sm" id="ps" type="button">Pause</button><button class="btn ghost sm" id="sn" type="button"></button></div>' +
      '<p class="gnote">Tap the screen, click, or press Space / ↑ to hop. Fly through the gaps. In Normal and Hard the pillars start to move.</p></div>',
    init: function (r) {
      var cv = $("#cv", r), stage = $(".gstage", r), x = G.canvas(cv, W, H), mode = ls.get("sh_mode", "normal"), M = MODE[mode];
      var state = "ready", y, vy, pipes, score, off = 0, acc = 0, last = 0, clouds = [], flash = 0, t = 0, flap = 0;
      for (var i = 0; i < 6; i++) clouds.push({ x: Math.random() * W, y: 40 + Math.random() * 220, s: .4 + Math.random() * .7 });
      function bestKey() { return "sh_best_" + mode; }
      function reset() { M = MODE[mode]; y = 250; vy = 0; pipes = []; score = 0; off = 0; acc = 0; flash = 0; G.set(r, "sc", 0); G.set(r, "bs", ls.get(bestKey(), 0)); }
      function gapNow() { return Math.max(M.min, M.gap - score * 1.1); }
      function speedNow() { return M.spd + Math.min(score * .022, 1.0); }
      function addPipe() { var g = gapNow(), cy = 130 + Math.random() * (H - GROUND - 260); pipes.push({ x: W + 20, cy: cy, base: cy, g: g, ph: Math.random() * 6.28, passed: false }); }
      function hop() {
        if (state === "ready") { state = "play"; last = performance.now(); G.closeOverlay(stage); }
        if (state !== "play") return; vy = -6.1; flap = 8; G.tone(480, .07, "triangle", .04, 720);
      }
      function die() {
        if (state === "dead") return; state = "dead"; flash = 1; G.sfx.lose(); var b = ls.get(bestKey(), 0), nb = score > b; if (nb) ls.set(bestKey(), score); G.set(r, "bs", ls.get(bestKey(), 0));
        var medal = score >= 60 ? "🏆 Platinum" : score >= 40 ? "🥇 Gold" : score >= 25 ? "🥈 Silver" : score >= 10 ? "🥉 Bronze" : "";
        setTimeout(function () { if (state === "dead") G.overlay(stage, { win: nb && score > 0, lose: !(nb && score > 0), title: nb && score > 0 ? "New best!" : "Crashed!", text: "Score <b>" + score + "</b> · best " + ls.get(bestKey(), 0) + (medal ? "<br>" + medal + " medal" : "<br>Reach 10 for a bronze medal"), buttons: [{ label: "Play again", fn: again }] }); }, 650);
      }
      function again() { reset(); state = "ready"; G.overlay(stage, { icon: "🐦", title: "Ready?", text: "Tap to hop. Fly through the gaps.", buttons: [{ label: "Tap to start", fn: function () { hop(); } }] }); }
      function logic() {
        vy += .36; if (vy > 9) vy = 9; y += vy; off = (off + speedNow()) % 40; if (flap > 0) flap--; t++;
        var sp = speedNow(); if (!pipes.length || pipes[pipes.length - 1].x < W - 205) addPipe();
        pipes.forEach(function (p) {
          p.x -= sp; if (M.move && score >= M.at) { var amp = Math.min(M.move, (score - M.at + 1) * 5); p.cy = G.clamp(p.base + Math.sin(t / 38 + p.ph) * amp, p.g / 2 + 36, H - GROUND - p.g / 2 - 36); }
          if (!p.passed && p.x + 54 < BX - BR) { p.passed = true; score++; G.set(r, "sc", score); G.tone(740, .08, "sine", .05); }
          if (BX + BR - 3 > p.x && BX - BR + 3 < p.x + 54 && (y - BR + 3 < p.cy - p.g / 2 || y + BR - 3 > p.cy + p.g / 2)) die();
        });
        pipes = pipes.filter(function (p) { return p.x > -70; });
        if (y + BR > H - GROUND) { y = H - GROUND - BR; die(); } if (y - BR < -20) { y = -8; vy = 0; }
      }
      function pillar(px, top, h, cap) {
        var g = x.createLinearGradient(px, 0, px + 54, 0); g.addColorStop(0, "#6D28D9"); g.addColorStop(.5, "#8B5CF6"); g.addColorStop(1, "#5B21B6"); x.fillStyle = g; x.fillRect(px, top, 54, h);
        x.fillStyle = "#A78BFA"; x.fillRect(px - 4, cap, 62, 18); x.fillStyle = "rgba(255,255,255,.18)"; x.fillRect(px + 6, top, 5, h);
      }
      function draw() {
        var sky = x.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#1E1B4B"); sky.addColorStop(.6, "#4C1D95"); sky.addColorStop(1, "#7C3AED"); x.fillStyle = sky; x.fillRect(0, 0, W, H);
        x.fillStyle = "rgba(255,255,255,.5)"; for (var s = 0; s < 18; s++) x.fillRect((s * 97) % W, (s * 53) % 200, 2, 2);
        clouds.forEach(function (c) { if (state === "play") c.x -= c.s * .35; if (c.x < -80) c.x = W + 40; x.fillStyle = "rgba(255,255,255,.14)"; x.beginPath(); x.arc(c.x, c.y, 18 * c.s + 8, 0, 7); x.arc(c.x + 22 * c.s + 8, c.y + 4, 14 * c.s + 8, 0, 7); x.arc(c.x - 22 * c.s - 8, c.y + 5, 13 * c.s + 8, 0, 7); x.fill(); });
        x.fillStyle = "#2E1065"; x.beginPath(); x.moveTo(0, H - GROUND); for (var h = 0; h <= W; h += 40) x.lineTo(h, H - GROUND - 40 - Math.sin(h * .03) * 22); x.lineTo(W, H - GROUND); x.fill(); var cityOff = (performance.now() / (state === "play" ? 40 : 200)) % 60; x.fillStyle = "rgba(30,16,80,.9)"; for (var bi = -1; bi < W / 30 + 2; bi++) { var bh = 30 + ((bi * 37) % 50), bxp = bi * 30 - cityOff * .5; x.fillRect(bxp, H - GROUND - bh, 26, bh); x.fillStyle = "rgba(253,224,71,.5)"; for (var wy = H - GROUND - bh + 6; wy < H - GROUND - 6; wy += 9) if ((bi + wy) % 3) x.fillRect(bxp + 6, wy, 3, 4); x.fillStyle = "rgba(30,16,80,.9)"; }
        pipes.forEach(function (p) { var top = p.cy - p.g / 2, bot = p.cy + p.g / 2; pillar(p.x, 0, top - 18, top - 18); pillar(p.x, bot + 18, H - GROUND - bot - 18, bot); });
        x.fillStyle = "#14532D"; x.fillRect(0, H - GROUND, W, GROUND); x.fillStyle = "#16A34A"; x.fillRect(0, H - GROUND, W, 10); x.fillStyle = "#15803D"; for (var g = -40; g < W + 40; g += 40) x.fillRect(g - off, H - GROUND + 10, 20, 8);
        var by = state === "ready" ? 250 + Math.sin(performance.now() / 260) * 8 : y, rot = state === "ready" ? 0 : G.clamp(vy * .07, -.5, 1.2);
        x.save(); x.translate(BX, by); x.rotate(rot);
        var bgd = x.createRadialGradient(-4, -5, 2, 0, 0, BR + 2); bgd.addColorStop(0, "#FFFBEB"); bgd.addColorStop(.5, "#FDE047"); bgd.addColorStop(1, "#D97706"); x.fillStyle = bgd; x.beginPath(); x.arc(0, 0, BR + 1, 0, 7); x.fill(); x.strokeStyle = "rgba(120,53,15,.5)"; x.lineWidth = 1.5; x.stroke(); x.fillStyle = "#FBBF24"; x.beginPath(); x.ellipse(-3, flap > 0 ? -4 : 3, 7, 4, flap > 0 ? -.5 : .4, 0, 7); x.fill();
        x.fillStyle = "#fff"; x.beginPath(); x.arc(5, -4, 4, 0, 7); x.fill(); x.fillStyle = "#1E1B4B"; x.beginPath(); x.arc(6.5, -4, 2, 0, 7); x.fill(); x.fillStyle = "#F97316"; x.beginPath(); x.moveTo(11, -1); x.lineTo(19, 2); x.lineTo(11, 5); x.fill(); x.restore();
        x.fillStyle = "#fff"; x.font = "800 40px Inter,system-ui,sans-serif"; x.textAlign = "center"; x.lineWidth = 5; x.strokeStyle = "rgba(10,8,24,.55)"; if (state !== "ready") { x.strokeText(score, W / 2, 80); x.fillText(score, W / 2, 80); }
        if (flash > 0) { x.fillStyle = "rgba(255,255,255," + flash * .6 + ")"; x.fillRect(0, 0, W, H); flash -= .08; }
      }
      function frame(now) {
        requestAnimationFrame(frame);
        if (state === "play") { acc += Math.min(60, now - last); while (acc >= 16.667 && state === "play") { acc -= 16.667; logic(); } }
        else if (state === "dead" && y + BR < H - GROUND) { vy += .5; y += vy; if (y + BR > H - GROUND) y = H - GROUND - BR; }
        last = now; draw();
      }
      function pause() { if (state !== "play") return; state = "pause"; $("#ps", r).textContent = "Resume"; G.overlay(stage, { icon: "⏸️", title: "Paused", buttons: [{ label: "Resume", fn: resume }] }); }
      function resume() { if (state !== "pause") return; state = "play"; last = performance.now(); acc = 0; $("#ps", r).textContent = "Pause"; }
      cv.addEventListener("pointerdown", function (e) { e.preventDefault(); if (state === "pause") { G.closeOverlay(stage); resume(); } else hop(); });
      G.keys(function (e) { if (e.code === "Space" || e.key === "ArrowUp") { if (state !== "dead") { e.preventDefault(); if (state === "pause") { G.closeOverlay(stage); resume(); } else hop(); } } else if (e.key === "p" || e.key === "P") { state === "pause" ? (G.closeOverlay(stage), resume()) : pause(); } });
      $("#ps", r).addEventListener("click", function () { if (state === "pause") { G.closeOverlay(stage); resume(); } else pause(); });
      G.seg($("#om", r), [["chill", "Chill"], ["normal", "Normal"], ["hard", "Hard"]], mode, function (v) { mode = v; ls.set("sh_mode", v); again(); });
      G.soundBtn($("#sn", r)); G.blur(pause);
      reset(); again(); requestAnimationFrame(frame);
    }
  });
})();
