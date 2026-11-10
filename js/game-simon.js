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

/* Glow Chain – Easy (3 lives), Normal, Hard (6 pads, faster) */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;
  var COL = ["#22C55E", "#EF4444", "#EAB308", "#3B82F6", "#A855F7", "#F97316"], NAME = ["Green", "Red", "Yellow", "Blue", "Purple", "Orange"];
  var F4 = [262, 330, 392, 523], F6 = [262, 294, 330, 392, 440, 523];

  VX.tool("glow-chain", {
    html: '<div class="gopt"><div id="om" role="group" aria-label="Difficulty"></div></div>' +
      G.hud([["lv", "Round", 0], ["bs", "Best", 0], ["lf", "Lives", "–"]]) +
      '<div class="gwrap"><div class="gstage" style="--gw:360px"><div class="simon" id="pads"></div></div><p class="gnote" id="msg" aria-live="polite"></p>' +
      '<div class="gbar"><button class="btn" id="st" type="button">Start</button><button class="btn ghost sm" id="sn" type="button"></button></div></div>',
    init: function (r) {
      var stage = $(".gstage", r), pads = $("#pads", r), mode = ls.get("si_mode", "normal"), seq = [], pos = 0, accept = false, token = 0, lives = 1, np = 4, btns = [];
      var M = { easy: { p: 4, lives: 3, step: 700 }, normal: { p: 4, lives: 1, step: 600 }, hard: { p: 6, lives: 1, step: 480 } };
      function best() { return ls.get("si_best_" + mode, 0); }
      function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
      function say(t) { $("#msg", r).textContent = t; }
      function freq(i) { return (np === 6 ? F6 : F4)[i]; }
      function build() {
        np = M[mode].p; pads.style.gridTemplateColumns = "repeat(" + (np === 6 ? 3 : 2) + ",1fr)"; stage.style.setProperty("--gw", np === 6 ? "480px" : "360px"); pads.innerHTML = ""; btns = [];
        for (var i = 0; i < np; i++) (function (i) {
          var d = document.createElement("button"); d.type = "button"; d.style.background = COL[i]; d.style.color = COL[i]; d.setAttribute("aria-label", NAME[i] + " pad, key " + (i + 1));
          d.addEventListener("pointerdown", function (e) { e.preventDefault(); press(i); }); d.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); press(i); } });
          pads.appendChild(d); btns.push(d);
        })(i);
        G.set(r, "bs", best());
      }
      function lit(i, ms) { btns[i].classList.add("lit"); G.tone(freq(i), ms / 1000, "sine", .09); return sleep(ms).then(function () { btns[i].classList.remove("lit"); }); }
      function stepMs() { var lvl = seq.length, s = M[mode].step; if (lvl >= 13) s *= .6; else if (lvl >= 9) s *= .72; else if (lvl >= 5) s *= .86; return s; }
      async function show() {
        var my = ++token; accept = false; pos = 0; say("Watch the pattern…"); await sleep(600);
        var s = stepMs();
        for (var i = 0; i < seq.length; i++) { if (my !== token) return; await lit(seq[i], s * .6); await sleep(s * .4); }
        if (my !== token) return; accept = true; say("Your turn! (" + seq.length + " step" + (seq.length > 1 ? "s" : "") + ")");
      }
      function next() { seq.push(G.rand(np)); G.set(r, "lv", seq.length); show(); }
      function start() {
        G.closeOverlay(stage); build(); seq = []; lives = M[mode].lives; G.set(r, "lf", mode === "easy" ? lives : "–"); G.set(r, "lv", 0); $("#st", r).textContent = "Restart"; next();
      }
      async function press(i) {
        if (!accept) return; lit(i, 220);
        if (i !== seq[pos]) {
          accept = false; G.sfx.bad();
          if (mode === "easy" && --lives > 0) { G.set(r, "lf", lives); say("Oops! " + lives + " " + (lives === 1 ? "life" : "lives") + " left. Watch again…"); await sleep(900); show(); return; }
          var lvl = seq.length - 1, b = best(), nb = lvl > b; if (nb) ls.set("si_best_" + mode, lvl); G.set(r, "bs", best()); G.set(r, "lf", 0);
          G.overlay(stage, { title: nb && lvl > 0 ? "New best! 🎉" : "Wrong pad", text: "You completed <b>" + Math.max(lvl, 0) + "</b> round" + (lvl === 1 ? "" : "s") + ".", buttons: [{ label: "Play again", fn: start }] });
          $("#st", r).textContent = "Start"; return;
        }
        if (++pos === seq.length) { accept = false; G.sfx.good(); say("Great!"); await sleep(750); next(); }
      }
      G.seg($("#om", r), [["easy", "Easy · 3 lives"], ["normal", "Normal"], ["hard", "Hard · 6 pads"]], mode, function (v) { mode = v; ls.set("si_mode", v); token++; accept = false; seq = []; build(); G.set(r, "lv", 0); G.set(r, "lf", "–"); say("Press Start. Sound plays only after you start."); });
      $("#st", r).addEventListener("click", start); G.soundBtn($("#sn", r));
      G.keys(function (e) { var i = "123456".indexOf(e.key); if (i < 0) i = { q: 0, w: 1, a: 2, s: 3 }[e.key.toLowerCase()] ; if (i != null && i >= 0 && i < np) press(i); });
      build(); say("Press Start. Sound plays only after you start.");
    }
  });
})();
