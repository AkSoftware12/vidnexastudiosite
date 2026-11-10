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

/* Mine Radar – safe first tap, chording, long-press flags, best times */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;
  var LV = { easy: [8, 8, 10, "Easy 8×8"], medium: [12, 12, 25, "Medium 12×12"], hard: [16, 16, 55, "Hard 16×16"] };
  var COLS = ["", "#60A5FA", "#34D399", "#F87171", "#C084FC", "#FBBF24", "#22D3EE", "#F9FAFB", "#9CA3AF"];

  VX.tool("mine-radar", {
    html: '<div class="gopt"><div id="ol" role="group" aria-label="Level"></div><div id="om" role="group" aria-label="Tap mode"></div></div>' +
      G.hud([["mn", "Mines left", 10], ["tm", "Time", "0:00"], ["bt", "Best time", "–"]]) +
      '<div class="gwrap"><div class="gstage" style="--gw:560px"><div class="ms swipe-none" id="bd"></div></div>' +
      '<div class="gbar"><button class="btn sm" id="nw" type="button">🙂 New game</button><button class="btn ghost sm" id="sn" type="button"></button></div>' +
      '<p class="gnote" id="msg" aria-live="polite">Tap to dig. Press and hold (or use Flag mode) to place a flag. Tap a number to open its neighbours once you have flagged enough mines.</p></div>',
    init: function (r) {
      var stage = $(".gstage", r), lvl = ls.get("ms_l", "easy"), mode = "dig", W, H, M, cells, first, over, secs, tmr, flags, opened, lp = null, longDone = false;
      function nb(i) { var o = [], x = i % W, y = Math.floor(i / W); for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; var a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < W && b < H) o.push(b * W + a); } return o; }
      function bestKey() { return "ms_best_" + lvl; }
      function init() {
        var c = LV[lvl]; W = c[0]; H = c[1]; M = c[2]; clearInterval(tmr); secs = 0; first = true; over = false; flags = 0; opened = 0; G.closeOverlay(stage);
        cells = []; for (var i = 0; i < W * H; i++) cells.push({ m: false, o: false, f: false, n: 0 });
        var bd = $("#bd", r); bd.style.gridTemplateColumns = "repeat(" + W + ",1fr)"; stage.style.setProperty("--gw", (W * 34) + "px"); bd.innerHTML = "";
        cells.forEach(function (c0, i) {
          var b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-label", "Square " + (Math.floor(i / W) + 1) + "," + (i % W + 1) + ", hidden");
          b.addEventListener("click", function () { if (longDone) { longDone = false; return; } act(i, mode === "flag" ? "flag" : "dig"); });
          b.addEventListener("contextmenu", function (e) { e.preventDefault(); act(i, "flag"); });
          b.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") return; longDone = false; clearTimeout(lp); lp = setTimeout(function () { longDone = true; act(i, "flag"); if (navigator.vibrate) try { navigator.vibrate(18); } catch (er) {} }, 420); });
          ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { b.addEventListener(ev, function () { clearTimeout(lp); }); });
          bd.appendChild(b);
        });
        G.set(r, "mn", M); G.set(r, "tm", "0:00"); var bt = ls.get(bestKey(), 0); G.set(r, "bt", bt ? G.time(bt) : "–"); $("#nw", r).textContent = "🙂 New game";
      }
      function seed(safe) {
        var ban = nb(safe).concat([safe]), pool = []; for (var i = 0; i < W * H; i++) if (ban.indexOf(i) < 0) pool.push(i);
        G.shuffle(pool).slice(0, M).forEach(function (i) { cells[i].m = true; });
        cells.forEach(function (c, i) { c.n = nb(i).filter(function (j) { return cells[j].m; }).length; });
      }
      function paint() {
        var bt = $("#bd", r).children;
        cells.forEach(function (c, i) {
          var b = bt[i]; b.className = c.o ? "open" + (c.m ? " mine" : "") : c.f ? "flag" : ""; b.style.color = "";
          b.textContent = c.o ? (c.m ? "💣" : c.n || "") : c.f ? "🚩" : "";
          if (c.o && c.n && !c.m) b.style.color = COLS[c.n];
          b.setAttribute("aria-label", "Square " + (Math.floor(i / W) + 1) + "," + (i % W + 1) + ", " + (c.o ? (c.m ? "mine" : c.n + " nearby") : c.f ? "flagged" : "hidden"));
        });
        G.set(r, "mn", M - flags);
      }
      function flood(i) {
        var q = [i];
        while (q.length) { var k = q.pop(), c = cells[k]; if (c.o || c.f) continue; c.o = true; opened++; if (!c.n) nb(k).forEach(function (j) { if (!cells[j].o) q.push(j); }); }
      }
      function lose(hit) {
        over = true; clearInterval(tmr); cells.forEach(function (c) { if (c.m) c.o = true; }); paint(); $("#bd", r).children[hit].style.background = "#7f1d1d"; $("#nw", r).textContent = "😵 New game"; G.sfx.lose();
        G.overlay(stage, { title: "Boom! 💥", text: "You hit a mine after " + G.time(secs) + ".", buttons: [{ label: "Try again", fn: init }] });
      }
      function win() {
        over = true; clearInterval(tmr); cells.forEach(function (c) { if (c.m && !c.f) { c.f = true; flags++; } }); paint(); $("#nw", r).textContent = "😎 New game";
        var bs = ls.get(bestKey(), 0), nb2 = !bs || secs < bs; if (nb2) { ls.set(bestKey(), secs); G.set(r, "bt", G.time(secs)); } G.sfx.win();
        G.overlay(stage, { title: "Field cleared! 🎉", text: "Time <b>" + G.time(secs) + "</b>" + (nb2 ? " · new best!" : " · best " + G.time(bs)), buttons: [{ label: "Play again", fn: init }] });
      }
      function reveal(i) {
        var c = cells[i]; if (c.f || c.o) return false;
        if (c.m) { lose(i); return true; }
        flood(i); return false;
      }
      function act(i, what) {
        if (over) return; var c = cells[i];
        if (what === "flag") { if (c.o) return; c.f = !c.f; flags += c.f ? 1 : -1; G.sfx.tap(); paint(); return; }
        if (first) { first = false; seed(i); tmr = setInterval(function () { secs++; G.set(r, "tm", G.time(secs)); }, 1000); }
        if (c.o) {
          if (!c.n) return; var ns = nb(i), fl = ns.filter(function (j) { return cells[j].f; }).length; if (fl !== c.n) return;
          for (var k = 0; k < ns.length; k++) if (reveal(ns[k])) return; paint(); if (opened === W * H - M) win(); return;
        }
        if (c.f) return;
        if (reveal(i)) return; G.sfx.pop(); paint(); if (opened === W * H - M) win();
      }
      G.seg($("#ol", r), Object.keys(LV).map(function (k) { return [k, LV[k][3]]; }), lvl, function (v) { lvl = v; ls.set("ms_l", v); init(); });
      G.seg($("#om", r), [["dig", "⛏ Dig"], ["flag", "🚩 Flag"]], mode, function (v) { mode = v; });
      $("#nw", r).addEventListener("click", init); G.soundBtn($("#sn", r)); init();
    }
  });
})();
