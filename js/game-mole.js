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

/* Mole Mallet – 10 levels with targets, golden moles, bombs and combos */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;
  var TIME = 30;
  function conf(l) {
    return { holes: l < 5 ? 9 : 12, cols: l < 5 ? 3 : 4, dur: Math.max(520, 1250 - l * 75), gap: Math.max(360, 880 - l * 48), simul: l < 3 ? 1 : l < 6 ? 2 : 3, gold: l >= 2 ? .09 : 0, bomb: l >= 3 ? .1 + l * .008 : 0, target: Math.round(8 + l * 4.5) };
  }

  VX.tool("mole-mallet", {
    html: G.hud([["lv", "Level", "–"], ["sc", "Score", 0], ["tm", "Time", TIME], ["cb", "Combo", "x1"]]) +
      '<div class="gwrap"><div class="gstage" id="stage" style="--gw:480px"><div id="view"></div></div>' +
      '<div class="gbar"><button class="btn ghost sm" id="mn" type="button">All levels</button><button class="btn ghost sm" id="sn" type="button"></button></div>' +
      '<p class="gnote" id="msg" aria-live="polite">Tap the moles. Golden moles give 3 points. Never tap a bomb. A streak of hits builds a combo multiplier.</p></div>',
    init: function (r) {
      var stage = $("#stage", r), view = $("#view", r), prog = ls.get("mole_p", []), cur = 0, holes = [], score, combo, end, on = false, loop, tick, C, hits;
      function menu() {
        on = false; clearTimeout(loop); clearInterval(tick); G.closeOverlay(stage); G.set(r, "lv", "–"); G.set(r, "sc", 0); G.set(r, "tm", TIME); G.set(r, "cb", "x1");
        var h = '<div class="lvgrid">';
        for (var i = 0; i < 10; i++) { var ok = i === 0 || (prog[i - 1] || 0) > 0, s = prog[i] || 0; h += '<button type="button" class="lvb" data-i="' + i + '"' + (ok ? "" : " disabled") + ' aria-label="Level ' + (i + 1) + (ok ? ", " + s + " stars, target " + conf(i + 1).target : ", locked") + '"><b>' + (ok ? i + 1 : "🔒") + "</b><span>" + (ok ? "★".repeat(s) + "☆".repeat(3 - s) : "") + "</span></button>"; }
        view.innerHTML = h + "</div>";
        Array.prototype.forEach.call(view.querySelectorAll(".lvb"), function (b) { b.addEventListener("click", function () { play(+b.getAttribute("data-i")); }); });
      }
      function mult() { return Math.min(3, 1 + Math.floor(combo / 5)); }
      function hud() { G.set(r, "sc", score); G.set(r, "cb", "x" + mult()); }
      function play(i) {
        cur = i; C = conf(i + 1); stage.style.setProperty('--gw', (C.cols === 4 ? 480 : 400) + 'px'); score = 0; combo = 0; hits = 0; on = false; G.closeOverlay(stage);
        var h = '<div class="moles" style="grid-template-columns:repeat(' + C.cols + ',1fr)">'; for (var k = 0; k < C.holes; k++) h += '<button type="button" class="hole" data-k="' + k + '" aria-label="Hole ' + (k + 1) + '"><span class="mole"></span></button>';
        view.innerHTML = h + "</div>"; holes = Array.prototype.map.call(view.querySelectorAll(".hole"), function (el) { return { el: el, m: el.firstChild, up: false, type: "", to: 0 }; });
        holes.forEach(function (o, k) { o.el.addEventListener("pointerdown", function (e) { e.preventDefault(); whack(k); }); });
        G.set(r, "lv", i + 1); G.set(r, "tm", TIME); hud();
        $("#msg", r).textContent = "Level " + (i + 1) + ": score " + C.target + " points to pass.";
        G.overlay(stage, { title: "Level " + (i + 1), text: "Target: <b>" + C.target + "</b> points in " + TIME + " seconds.", buttons: [{ label: "Start", fn: go }, { label: "All levels", ghost: true, fn: menu }] });
      }
      function go() { on = true; end = Date.now() + TIME * 1000; G.set(r, "tm", TIME); spawn(); tick = setInterval(function () { var left = Math.ceil((end - Date.now()) / 1000); G.set(r, "tm", Math.max(0, left)); if (left <= 0) finish(); }, 200); }
      function hide(o, missed) { clearTimeout(o.to); if (!o.up) return; o.up = false; o.el.classList.remove("up", "gold", "bomb", "hit"); o.m.textContent = ""; if (missed && o.type !== "bomb") { combo = 0; hud(); } }
      function spawn() {
        if (!on) return;
        var upN = holes.filter(function (o) { return o.up; }).length;
        if (upN < C.simul) {
          var fr = holes.filter(function (o) { return !o.up; }), o = fr[G.rand(fr.length)], p = Math.random();
          o.type = p < C.bomb ? "bomb" : p < C.bomb + C.gold ? "gold" : "mole"; o.up = true; o.el.classList.add("up"); if (o.type !== "mole") o.el.classList.add(o.type);
          o.m.textContent = o.type === "bomb" ? "💣" : "🐹"; var d = o.type === "gold" ? C.dur * .7 : C.dur;
          o.to = setTimeout(function () { hide(o, true); }, d);
        }
        loop = setTimeout(spawn, C.gap * (.7 + Math.random() * .6));
      }
      function whack(k) {
        if (!on) return; var o = holes[k];
        if (!o.up) { combo = 0; hud(); return; }
        var t = o.type; clearTimeout(o.to);
        if (t === "bomb") { score = Math.max(0, score - 3); combo = 0; G.sfx.bad(); o.m.textContent = "💥"; }
        else { var pts = (t === "gold" ? 3 : 1) * mult(); combo++; score += pts; hits++; t === "gold" ? G.sfx.good() : G.sfx.pop(); o.m.textContent = "+" + pts; }
        o.el.classList.add("hit"); o.up = false; setTimeout(function () { o.el.classList.remove("up", "gold", "bomb", "hit"); o.m.textContent = ""; }, 260); hud();
      }
      function finish() {
        on = false; clearTimeout(loop); clearInterval(tick); holes.forEach(function (o) { hide(o, false); });
        var s = score >= C.target * 1.6 ? 3 : score >= C.target * 1.3 ? 2 : score >= C.target ? 1 : 0, bestKey = "mole_best_" + (cur + 1), bs = ls.get(bestKey, 0), nb = score > bs; if (nb) ls.set(bestKey, score);
        if (s > (prog[cur] || 0)) { prog[cur] = s; ls.set("mole_p", prog); }
        if (s > 0) { G.sfx.win(); G.overlay(stage, { title: "Level " + (cur + 1) + " passed!", stars: s, text: "Score <b>" + score + "</b> / target " + C.target + (nb ? " · new best!" : ""), buttons: cur < 9 ? [{ label: "Next level", fn: function () { play(cur + 1); } }, { label: "Replay", ghost: true, fn: function () { play(cur); } }, { label: "All levels", ghost: true, fn: menu }] : [{ label: "Replay", fn: function () { play(cur); } }, { label: "All levels", ghost: true, fn: menu }] }); }
        else { G.sfx.lose(); G.overlay(stage, { title: "So close!", text: "Score <b>" + score + "</b>, you needed " + C.target + ".", buttons: [{ label: "Try again", fn: function () { play(cur); } }, { label: "All levels", ghost: true, fn: menu }] }); }
      }
      $("#mn", r).addEventListener("click", menu); G.soundBtn($("#sn", r)); G.blur(function () { if (on) { on = false; clearTimeout(loop); clearInterval(tick); holes.forEach(function (o) { hide(o, false); }); G.overlay(stage, { title: "Paused", text: "Level " + (cur + 1) + " will restart.", buttons: [{ label: "Restart level", fn: function () { play(cur); } }, { label: "All levels", ghost: true, fn: menu }] }); } });
      menu();
    }
  });
})();
