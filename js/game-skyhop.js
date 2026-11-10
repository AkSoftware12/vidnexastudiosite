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
        setTimeout(function () { if (state === "dead") G.overlay(stage, { title: nb && score > 0 ? "New best! 🎉" : "Crashed!", text: "Score <b>" + score + "</b> · best " + ls.get(bestKey(), 0) + (medal ? "<br>" + medal + " medal" : "<br>Reach 10 for a bronze medal"), buttons: [{ label: "Play again", fn: again }] }); }, 650);
      }
      function again() { reset(); state = "ready"; G.overlay(stage, { title: "Ready?", text: "Tap to hop. Fly through the gaps.", buttons: [{ label: "Tap to start", fn: function () { hop(); } }] }); }
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
        x.fillStyle = "#2E1065"; x.beginPath(); x.moveTo(0, H - GROUND); for (var h = 0; h <= W; h += 40) x.lineTo(h, H - GROUND - 40 - Math.sin(h * .03) * 22); x.lineTo(W, H - GROUND); x.fill();
        pipes.forEach(function (p) { var top = p.cy - p.g / 2, bot = p.cy + p.g / 2; pillar(p.x, 0, top - 18, top - 18); pillar(p.x, bot + 18, H - GROUND - bot - 18, bot); });
        x.fillStyle = "#14532D"; x.fillRect(0, H - GROUND, W, GROUND); x.fillStyle = "#16A34A"; x.fillRect(0, H - GROUND, W, 10); x.fillStyle = "#15803D"; for (var g = -40; g < W + 40; g += 40) x.fillRect(g - off, H - GROUND + 10, 20, 8);
        var by = state === "ready" ? 250 + Math.sin(performance.now() / 260) * 8 : y, rot = state === "ready" ? 0 : G.clamp(vy * .07, -.5, 1.2);
        x.save(); x.translate(BX, by); x.rotate(rot);
        x.fillStyle = "#FDE68A"; x.beginPath(); x.arc(0, 0, BR + 1, 0, 7); x.fill(); x.fillStyle = "#FBBF24"; x.beginPath(); x.ellipse(-3, flap > 0 ? -4 : 3, 7, 4, flap > 0 ? -.5 : .4, 0, 7); x.fill();
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
      function pause() { if (state !== "play") return; state = "pause"; $("#ps", r).textContent = "Resume"; G.overlay(stage, { title: "Paused", buttons: [{ label: "Resume", fn: resume }] }); }
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
