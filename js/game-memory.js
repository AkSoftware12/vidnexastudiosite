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

/* Memory Match – 12 levels, stars, move limits on the last three */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;
  var LV = [[2, 2], [3, 2], [4, 2], [4, 3], [4, 4], [5, 4], [6, 4], [6, 5], [6, 6], [6, 6, 2.5], [6, 6, 2.1], [6, 6, 1.8]];
  var EM = ["🍎", "🚗", "⭐", "🎈", "🐶", "🎲", "🌙", "🍕", "🐱", "🌸", "⚽", "🎧", "🍉", "🚀", "🦋", "🍩", "🔔", "🌈", "🍇", "🐢", "🎸", "🍓"];

  VX.tool("memory-match", {
    html: G.hud([["lv", "Level", "–"], ["mv", "Moves", 0], ["tm", "Time", "0:00"]]) +
      '<div class="gwrap"><div class="gstage" id="stage" style="--gw:520px"><div id="view"></div></div>' +
      '<div class="gbar"><button class="btn ghost sm" id="mn" type="button">All levels</button><button class="btn ghost sm" id="rp" type="button">Restart level</button><button class="btn ghost sm" id="sn" type="button"></button></div>' +
      '<p class="gnote" id="msg" aria-live="polite">Pick a level. Finish a level to unlock the next. Levels 10 to 12 have a move limit.</p></div>',
    init: function (r) {
      var stage = $("#stage", r), view = $("#view", r), prog = ls.get("mem_p", []), cur = 0, cards, open, moves, found, pairs, limit, lock, t0, tmr, playing = false;
      function stars(i) { return prog[i] || 0; }
      function menu() {
        playing = false; clearInterval(tmr); G.closeOverlay(stage); G.set(r, "lv", "–"); G.set(r, "mv", 0); G.set(r, "tm", "0:00");
        var h = '<div class="lvgrid">';
        LV.forEach(function (l, i) {
          var ok = i === 0 || stars(i - 1) > 0, s = stars(i);
          h += '<button type="button" class="lvb" data-i="' + i + '"' + (ok ? "" : " disabled") + ' aria-label="Level ' + (i + 1) + (ok ? ", " + s + " stars" : ", locked") + '"><b>' + (ok ? i + 1 : "🔒") + '</b><span>' + (ok ? "★".repeat(s) + "☆".repeat(3 - s) : "") + "</span></button>";
        });
        view.innerHTML = h + "</div>";
        Array.prototype.forEach.call(view.querySelectorAll(".lvb"), function (b) { b.addEventListener("click", function () { play(+b.getAttribute("data-i")); }); });
        $("#msg", r).textContent = "Pick a level. Finish a level to unlock the next. Levels 10 to 12 have a move limit.";
      }
      function play(i) {
        cur = i; var l = LV[i], cols = l[0], rows = l[1]; pairs = cols * rows / 2; limit = l[2] ? Math.ceil(pairs * l[2]) : 0;
        var faces = G.shuffle(EM.slice()).slice(0, pairs); cards = G.shuffle(faces.concat(faces)); open = []; moves = 0; found = 0; lock = false; t0 = 0; playing = true; clearInterval(tmr); G.closeOverlay(stage);
        G.set(r, "lv", i + 1); G.set(r, "mv", limit ? "0/" + limit : 0); G.set(r, "tm", "0:00");
        var h = '<div class="mgrid" style="grid-template-columns:repeat(' + cols + ',1fr);font-size:' + (cols >= 6 ? "clamp(18px,6vw,32px)" : cols === 5 ? "clamp(22px,7vw,38px)" : "clamp(26px,8vw,44px)") + '">';
        cards.forEach(function (c, k) { h += '<button type="button" class="mc" data-k="' + k + '" data-face="' + c + '" aria-label="Card ' + (k + 1) + ', face down"><i class="f">✦</i><i class="b">' + c + "</i></button>"; });
        view.innerHTML = h + "</div>";
        Array.prototype.forEach.call(view.querySelectorAll(".mc"), function (b) { b.addEventListener("click", function () { flip(b); }); });
        $("#msg", r).textContent = "Level " + (i + 1) + ": find all " + pairs + " pairs" + (limit ? " in " + limit + " moves or fewer." : ".");
      }
      function flip(b) {
        if (!playing || lock || b.classList.contains("up") || b.classList.contains("done")) return;
        if (!t0) { t0 = Date.now(); tmr = setInterval(function () { G.set(r, "tm", G.time((Date.now() - t0) / 1000)); }, 500); }
        b.classList.add("up"); b.setAttribute("aria-label", "Card showing " + b.getAttribute("data-face")); G.sfx.tap(); open.push(b);
        if (open.length < 2) return;
        moves++; G.set(r, "mv", limit ? moves + "/" + limit : moves);
        var a = open[0], c = open[1]; open = [];
        if (a.getAttribute("data-face") === c.getAttribute("data-face")) {
          a.classList.add("done"); c.classList.add("done"); found++; setTimeout(G.sfx.good, 150);
          if (found === pairs) return win();
        } else { lock = true; G.sfx.bad && setTimeout(function () { G.tone(260, .12, "triangle", .04); }, 200); setTimeout(function () { [a, c].forEach(function (z) { z.classList.remove("up"); z.setAttribute("aria-label", "Card face down"); }); lock = false; }, 800); }
        if (limit && moves >= limit && found < pairs) { lose(); }
      }
      function win() {
        playing = false; clearInterval(tmr); var secs = (Date.now() - t0) / 1000;
        var s = moves <= Math.ceil(pairs * 1.5) ? 3 : moves <= Math.ceil(pairs * 2.2) ? 2 : 1;
        if (s > stars(cur)) { prog[cur] = s; ls.set("mem_p", prog); }
        G.sfx.win();
        setTimeout(function () {
          G.overlay(stage, { win: true, title: "Level " + (cur + 1) + " cleared!", stars: s, text: moves + " moves · " + G.time(secs), buttons: cur + 1 < LV.length ? [{ label: "Next level", fn: function () { play(cur + 1); } }, { label: "Replay", ghost: true, fn: function () { play(cur); } }, { label: "All levels", ghost: true, fn: menu }] : [{ label: "Replay", fn: function () { play(cur); } }, { label: "All levels", ghost: true, fn: menu }] });
        }, 500);
      }
      function lose() {
        playing = false; clearInterval(tmr); G.sfx.lose();
        setTimeout(function () { G.overlay(stage, { lose: true, icon: "🧠", title: "Out of moves", text: "You used all " + limit + " moves. Try again!", buttons: [{ label: "Retry", fn: function () { play(cur); } }, { label: "All levels", ghost: true, fn: menu }] }); }, 700);
      }
      $("#mn", r).addEventListener("click", menu); $("#rp", r).addEventListener("click", function () { if (playing || cards) play(cur); });
      G.soundBtn($("#sn", r));
      G.blur(function () {});
      menu();
    }
  });
})();
