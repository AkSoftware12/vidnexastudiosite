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

/* Sliding Puzzle – 3×3, 4×4, 5×5 with numbers or a picture; slides whole rows; best moves and time */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;
  var PAL = [["#1E1B4B", "#F472B6", "#FDBA74", "#7C3AED"], ["#0C4A6E", "#38BDF8", "#FDE68A", "#0F766E"], ["#14532D", "#86EFAC", "#FDE047", "#065F46"], ["#581C87", "#F0ABFC", "#FCA5A5", "#4338CA"]];
  function art(size) {
    var c = document.createElement("canvas"); c.width = c.height = size; var x = c.getContext("2d"), p = PAL[G.rand(PAL.length)], s = size;
    var g = x.createLinearGradient(0, 0, s, s); g.addColorStop(0, p[0]); g.addColorStop(.55, p[1]); g.addColorStop(1, p[2]); x.fillStyle = g; x.fillRect(0, 0, s, s);
    for (var i = 0; i < 40; i++) { x.fillStyle = "rgba(255,255,255," + (.05 + Math.random() * .18) + ")"; x.beginPath(); x.arc(Math.random() * s, Math.random() * s * .6, 2 + Math.random() * 7, 0, 7); x.fill(); }
    x.fillStyle = p[2]; x.shadowColor = p[2]; x.shadowBlur = s * .08; x.beginPath(); x.arc(s * (.25 + Math.random() * .5), s * (.2 + Math.random() * .15), s * .11, 0, 7); x.fill(); x.shadowBlur = 0;
    [[.62, p[3], .55], [.74, p[0], .8], [.86, "#0A0818", 1]].forEach(function (L) {
      x.fillStyle = L[1]; x.globalAlpha = L[2]; x.beginPath(); x.moveTo(0, s); for (var k = 0; k <= 8; k++) x.lineTo(k * s / 8, s * L[0] - Math.random() * s * .16 - (k % 2) * s * .06); x.lineTo(s, s); x.closePath(); x.fill();
    }); x.globalAlpha = 1;
    x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = s * .012; x.beginPath(); x.moveTo(0, s * .5); x.bezierCurveTo(s * .3, s * .35, s * .6, s * .65, s, s * .45); x.stroke();
    return c.toDataURL("image/jpeg", .85);
  }

  VX.tool("sliding-puzzle", {
    html: '<div class="gopt"><div id="osz" role="group" aria-label="Size"></div><div id="omd" role="group" aria-label="Style"></div></div>' +
      G.hud([["mv", "Moves", 0], ["tm", "Time", "0:00"], ["bs", "Best moves", "–"]]) +
      '<div class="gwrap"><div class="gstage" style="--gw:440px"><div class="slb swipe" id="bd" aria-label="Sliding puzzle board"></div></div>' +
      '<div class="gbar"><button class="btn sm" id="nw" type="button">Shuffle</button><button class="btn ghost sm" id="pk" type="button">Hold to peek</button><button class="btn ghost sm" id="sn" type="button"></button></div>' +
      '<p class="gnote" id="msg" aria-live="polite">Tap a tile in the same row or column as the gap to slide it. Arrow keys also work.</p></div>',
    init: function (r) {
      var stage = $(".gstage", r), bd = $("#bd", r), n = ls.get("sl_n", 4), mode = ls.get("sl_m", "num"), arr, moves, t0, tmr, won, img, els, peek = false;
      function bestKey() { return "sl_best_" + n + mode; }
      function bestShow() { var b = ls.get(bestKey(), 0); G.set(r, "bs", b ? b : "–"); }
      function build() {
        bd.innerHTML = ""; els = []; var tot = n * n;
        for (var id = 0; id < tot - 1; id++) (function (id) {
          var w = document.createElement("div"); w.className = "slt"; w.style.width = w.style.height = 100 / n + "%";
          var b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-label", "Tile " + (id + 1));
          if (mode === "pic") { b.style.backgroundImage = "url(" + img + ")"; b.style.backgroundSize = n * 100 + "% " + n * 100 + "%"; var tr = Math.floor(id / n), tc = id % n; b.style.backgroundPosition = (n > 1 ? tc * 100 / (n - 1) : 0) + "% " + (n > 1 ? tr * 100 / (n - 1) : 0) + "%"; b.innerHTML = "<small>" + (id + 1) + "</small>"; b.className = "pic"; }
          else { b.textContent = id + 1; b.style.fontSize = n === 3 ? "clamp(26px,9vw,44px)" : n === 4 ? "clamp(22px,7vw,36px)" : "clamp(18px,5.5vw,28px)"; }
          b.addEventListener("click", function () { tap(arr.indexOf(id)); });
          w.appendChild(b); bd.appendChild(w); els[id] = w;
        })(id);
        layout();
      }
      function layout() { arr.forEach(function (id, i) { if (id === n * n - 1) return; var e = els[id]; e.style.left = (i % n) * 100 / n + "%"; e.style.top = Math.floor(i / n) * 100 / n + "%"; }); }
      function solved() { return arr.every(function (v, i) { return v === i; }); }
      function shuffle() {
        var tot = n * n, steps = n === 3 ? 70 : n === 4 ? 180 : 320, prev = -1; arr = []; for (var i = 0; i < tot; i++) arr.push(i);
        var blank = tot - 1;
        for (var s = 0; s < steps || solved(); s++) {
          var x = blank % n, y = Math.floor(blank / n), opts = []; if (x > 0) opts.push(blank - 1); if (x < n - 1) opts.push(blank + 1); if (y > 0) opts.push(blank - n); if (y < n - 1) opts.push(blank + n);
          opts = opts.filter(function (o) { return o !== prev; }); var m = opts[G.rand(opts.length)];
          arr[blank] = arr[m]; arr[m] = tot - 1; prev = blank; blank = m;
        }
      }
      function newGame() {
        clearInterval(tmr); t0 = 0; moves = 0; won = false; G.closeOverlay(stage); G.set(r, "mv", 0); G.set(r, "tm", "0:00"); bestShow();
        if (mode === "pic") img = art(600); shuffle(); build(); $("#msg", r).textContent = "Tap a tile in the same row or column as the gap to slide it. Arrow keys also work.";
      }
      function tap(i) {
        if (won || i < 0) return; var blank = arr.indexOf(n * n - 1), bx = blank % n, by = Math.floor(blank / n), x = i % n, y = Math.floor(i / n);
        if (x !== bx && y !== by) return; if (i === blank) return;
        var dx = Math.sign(bx - x), dy = Math.sign(by - y), cur = blank;
        while (cur !== i) { var from = cur - dx - dy * n; arr[cur] = arr[from]; cur = from; } arr[i] = n * n - 1;
        moveDone();
      }
      function key(dir) {
        var blank = arr.indexOf(n * n - 1), bx = blank % n, by = Math.floor(blank / n), tx = bx, ty = by;
        if (dir === "l") tx = bx + 1; if (dir === "r") tx = bx - 1; if (dir === "u") ty = by + 1; if (dir === "d") ty = by - 1;
        if (tx < 0 || ty < 0 || tx >= n || ty >= n) return; tap(ty * n + tx);
      }
      function moveDone() {
        if (!t0) { t0 = Date.now(); tmr = setInterval(function () { G.set(r, "tm", G.time((Date.now() - t0) / 1000)); }, 500); }
        moves++; G.set(r, "mv", moves); G.sfx.tap(); layout();
        if (solved()) {
          won = true; clearInterval(tmr); var secs = (Date.now() - t0) / 1000, b = ls.get(bestKey(), 0), nb = !b || moves < b; if (nb) ls.set(bestKey(), moves); bestShow(); G.sfx.win();
          setTimeout(function () { G.overlay(stage, { win: true, title: "Solved!", text: "<b>" + moves + "</b> moves in " + G.time(secs) + (nb ? " · new best!" : ""), buttons: [{ label: "Play again", fn: newGame }] }); }, 350);
        }
      }
      function setPeek(on) {
        if (won) return;
        var ex = $(".slpeek", stage); if (!on) { if (ex) ex.remove(); return; } if (ex) return;
        var d = document.createElement("div"); d.className = "slpeek"; d.setAttribute("aria-hidden", "true");
        if (mode === "pic") d.style.backgroundImage = "url(" + img + ")"; else d.innerHTML = "<span>1 2 3 … " + (n * n - 1) + "<br>in order, gap bottom-right</span>"; stage.appendChild(d);
      }
      G.seg($("#osz", r), [[3, "3×3"], [4, "4×4"], [5, "5×5"]], n, function (v) { n = v; ls.set("sl_n", v); newGame(); });
      G.seg($("#omd", r), [["num", "Numbers"], ["pic", "Picture"]], mode, function (v) { mode = v; ls.set("sl_m", v); newGame(); });
      $("#nw", r).addEventListener("click", newGame); G.soundBtn($("#sn", r));
      var pk = $("#pk", r); ["pointerdown"].forEach(function (e) { pk.addEventListener(e, function (ev) { ev.preventDefault(); setPeek(true); }); }); ["pointerup", "pointerleave", "pointercancel", "blur"].forEach(function (e) { pk.addEventListener(e, function () { setPeek(false); }); });
      G.keys(function (e) { var m = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d" }[e.key]; if (m) { e.preventDefault(); key(m); } });
      newGame();
    }
  });
})();
