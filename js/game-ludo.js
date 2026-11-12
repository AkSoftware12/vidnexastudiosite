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

/* Ludo – 2 or 4 players, against the computer or pass-and-play.
   3D-style pawns, a real 3D dice, hopping moves. Rules: roll a 6 to come out, safe squares, captures, exact roll to finish. */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;
  var S = 600, C = S / 15, NAMES = ["Red", "Green", "Yellow", "Blue"];
  var COL = ["#EF4444", "#22C55E", "#FACC15", "#3B82F6"], LIGHT = ["#FCA5A5", "#86EFAC", "#FEF08A", "#93C5FD"], DARK = ["#991B1B", "#166534", "#A16207", "#1E40AF"], DEEP = ["#7F1D1D", "#14532D", "#713F12", "#1E3A8A"];
  var LOOP = [];
  (function () {
    var i; for (i = 1; i <= 5; i++) LOOP.push([6, i]); for (i = 5; i >= 0; i--) LOOP.push([i, 6]); LOOP.push([0, 7]); for (i = 0; i <= 5; i++) LOOP.push([i, 8]);
    for (i = 9; i <= 14; i++) LOOP.push([6, i]); LOOP.push([7, 14]); for (i = 14; i >= 9; i--) LOOP.push([8, i]); for (i = 9; i <= 14; i++) LOOP.push([i, 8]);
    LOOP.push([14, 7]); for (i = 14; i >= 9; i--) LOOP.push([i, 6]); for (i = 5; i >= 0; i--) LOOP.push([8, i]); LOOP.push([7, 0]); LOOP.push([6, 0]);
  })();
  var HOME = [[[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]]];
  var BASE = [[0, 0], [0, 9], [9, 9], [9, 0]], SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
  var FINISH = [[7.5, 6.55], [6.55, 7.5], [7.5, 8.45], [8.45, 7.5]]; // where finished pawns sit (row, col) in each colour's triangle
  function cellOf(p, pos) { if (pos <= 50) return LOOP[(pos + 13 * p) % 52]; if (pos <= 55) return HOME[p][pos - 51]; return null; }
  function loopIdx(p, pos) { return pos >= 0 && pos <= 50 ? (pos + 13 * p) % 52 : -1; }
  function baseSpot(p, k) { var b = BASE[p], off = [[1.75, 1.75], [1.75, 4.25], [4.25, 1.75], [4.25, 4.25]][k]; return { x: (b[1] + off[1]) * C, y: (b[0] + off[0]) * C }; }
  function spot(p, k, pos) {
    if (pos < 0) return baseSpot(p, k);
    if (pos === 56) { var f = FINISH[p], al = (k - 1.5) * .34; return p % 2 ? { x: (f[1] + al) * C, y: f[0] * C } : { x: f[1] * C, y: (f[0] + al) * C }; }
    var c = cellOf(p, pos); return { x: c[1] * C + C / 2, y: c[0] * C + C / 2 };
  }
  var FACE_ROT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
  var PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  function diceHTML() {
    var f = "";
    for (var n = 1; n <= 6; n++) { var g = ""; for (var c = 1; c <= 9; c++) g += "<i" + (PIPS[n].indexOf(c) >= 0 ? ' class="on"' : "") + "></i>"; f += '<div class="df f' + n + '">' + g + "</div>"; }
    return '<div class="dice3d" aria-hidden="true"><div class="cube">' + f + "</div></div>";
  }
  function panel(p) { return '<div class="ld-pl" data-p="' + p + '"><span class="av"></span><span class="nm"><b></b><small></small></span><button class="dslot" type="button" aria-label="Roll the dice"></button></div>'; }

  VX.tool("ludo", {
    html: '<div class="gopt"><div id="onp" role="group" aria-label="Players"></div><div id="ovs" role="group" aria-label="Opponent"></div></div>' +
      '<div class="gwrap ld"><div class="ld-row">' + panel(0) + panel(1) + '</div>' +
      '<div class="gstage" style="--gw:560px"><canvas class="gcanvas swipe" id="cv" width="600" height="600" style="width:100%" aria-label="Ludo board"></canvas></div>' +
      '<div class="ld-row">' + panel(3) + panel(2) + '</div>' +
      '<div class="gmsg" id="msg" aria-live="polite" style="min-height:44px;display:flex;align-items:center"></div>' +
      '<div class="gbar"><button class="btn big" id="roll" type="button" style="min-width:200px">🎲 Roll</button></div>' +
      '<div class="gbar" style="margin-top:6px"><button class="btn ghost sm" id="nw" type="button">New game</button><button class="btn ghost sm" id="sn" type="button"></button></div>' +
      '<p class="gnote">Tap the dice or Roll. A 6 brings a pawn out and gives another roll. Land on an opponent to send it home, but not on a star or start square. You need the exact number to reach the centre.</p></div>',
    init: function (r) {
      var cv = $("#cv", r), x = G.canvas(cv, S, S), stage = $(".gstage", r), msg = $("#msg", r), rollBtn = $("#roll", r), fx = G.fx(stage);
      var np = ls.get("ld_np", 2), vs = ls.get("ld_vs", "cpu"), P, turn, dice, rolled, sixes, movable, busy, over, raf, boardImg = null, t0 = performance.now();
      var diceEl = (function () { var d = document.createElement("div"); d.innerHTML = diceHTML(); return d.firstChild; })(), cube = diceEl.firstChild, spins = 0;
      var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      function active() { return np === 2 ? [0, 2] : [0, 1, 2, 3]; }
      function isCpu(p) { return vs === "cpu" && p !== 0; }
      function who(p) { return vs === "cpu" ? (p === 0 ? "You" : "Computer") : "Player " + (active().indexOf(p) + 1); }
      function panels() {
        Array.prototype.forEach.call(r.querySelectorAll(".ld-pl"), function (el) {
          var p = +el.getAttribute("data-p"), on = active().indexOf(p) >= 0;
          el.style.setProperty("--pc", COL[p]); el.style.setProperty("--pd", DARK[p]);
          el.classList.toggle("off", !on); el.classList.toggle("cur", on && p === turn && !over);
          el.querySelector(".av").textContent = !on ? "" : vs === "cpu" ? (p === 0 ? "🙂" : "🤖") : String(active().indexOf(p) + 1);
          el.querySelector("b").textContent = on ? (vs === "cpu" ? (p === 0 ? "You" : "CPU") : "P" + (active().indexOf(p) + 1)) : NAMES[p];
          el.querySelector("small").textContent = on ? NAMES[p] + " · 🏠 " + (P ? P[p].tok.filter(function (t) { return t === 56; }).length : 0) + "/4" : "";
          var slot = el.querySelector(".dslot"); slot.disabled = !(on && p === turn && !isCpu(p) && !rolled && !busy && !over);
          if (on && p === turn && diceEl.parentNode !== slot) slot.appendChild(diceEl);
        });
        diceEl.style.setProperty("--pc", COL[turn]);
      }
      function newGame() {
        P = [0, 1, 2, 3].map(function () { return { tok: [-1, -1, -1, -1], done: false, anim: [null, null, null, null] }; });
        turn = 0; dice = 0; rolled = false; sixes = 0; movable = []; busy = false; over = false; boardImg = null;
        G.closeOverlay(stage); say(who(0) + ": roll the dice"); rollBtn.disabled = false; panels(); loop();
      }
      function say(t) { msg.textContent = t; msg.style.color = LIGHT[turn]; }
      function nextTurn(extra) {
        if (over) return;
        if (!extra) { var a = active(), i = a.indexOf(turn); do { turn = a[(i + 1) % a.length]; i = a.indexOf(turn); } while (P[turn].done); sixes = 0; }
        rolled = false; dice = 0; movable = []; panels();
        if (isCpu(turn)) { rollBtn.disabled = true; say(who(turn) + " is rolling…"); setTimeout(roll, 600); }
        else { rollBtn.disabled = false; say(who(turn) + ": " + (extra ? "roll again!" : "roll the dice")); }
      }
      function canMove(p, k, d) { var pos = P[p].tok[k]; if (pos === 56) return false; if (pos < 0) return d === 6; return pos + d <= 56; }
      function showDice(n, done) {
        spins++; var f = FACE_ROT[n], sx = 360 * (spins % 2 ? 2 : 3), sy = 360 * 2;
        if (reduce) { cube.style.transition = "none"; cube.style.transform = "rotateX(" + f[0] + "deg) rotateY(" + f[1] + "deg)"; return done(); }
        cube.style.transition = "none"; cube.style.transform = "rotateX(" + (f[0] - sx) + "deg) rotateY(" + (f[1] - sy) + "deg) rotateZ(" + (Math.random() * 40 - 20) + "deg)";
        void cube.offsetWidth; cube.style.transition = "transform .75s cubic-bezier(.2,.9,.25,1.12)";
        cube.style.transform = "rotateX(" + f[0] + "deg) rotateY(" + f[1] + "deg)";
        diceEl.classList.remove("hop"); void diceEl.offsetWidth; diceEl.classList.add("hop");
        G.sfx.roll(); setTimeout(done, 780);
      }
      function roll() {
        if (rolled || busy || over) return;
        rolled = true; busy = true; rollBtn.disabled = true; panels();
        var n = 1 + G.rand(6);
        showDice(n, function () {
          busy = false; dice = n;
          if (dice === 6) sixes++; else sixes = 0;
          if (sixes === 3) { say(who(turn) + " rolled three 6s, turn lost"); G.sfx.bad(); return setTimeout(function () { nextTurn(false); }, 900); }
          movable = []; for (var k = 0; k < 4; k++) if (canMove(turn, k, dice)) movable.push(k);
          panels();
          if (!movable.length) { say(who(turn) + " rolled " + dice + ", no move"); return setTimeout(function () { nextTurn(false); }, 900); }
          if (isCpu(turn)) return setTimeout(function () { move(turn, cpuPick()); }, 450);
          say(who(turn) + " rolled " + dice + (movable.length > 1 ? ", tap a token" : ""));
          if (movable.length === 1) setTimeout(function () { move(turn, movable[0]); }, 380);
        });
      }
      function cpuPick() {
        var best = movable[0], bs = -1e9;
        movable.forEach(function (k) {
          var pos = P[turn].tok[k], to = pos < 0 ? 0 : pos + dice, sc = 0;
          if (to === 56) sc += 100; if (pos < 0) sc += 40;
          var li = loopIdx(turn, to); if (li >= 0) {
            active().forEach(function (q) { if (q === turn) return; P[q].tok.forEach(function (t) { if (loopIdx(q, t) === li && SAFE.indexOf(li) < 0) sc += 60; }); });
            if (SAFE.indexOf(li) >= 0) sc += 15;
            active().forEach(function (q) { if (q === turn) return; P[q].tok.forEach(function (t) { var qi = loopIdx(q, t); if (qi < 0) return; var d = (li - qi + 52) % 52; if (d >= 1 && d <= 6 && SAFE.indexOf(li) < 0) sc -= 25; }); });
          }
          var cur = loopIdx(turn, pos); if (cur >= 0 && SAFE.indexOf(cur) < 0) active().forEach(function (q) { if (q === turn) return; P[q].tok.forEach(function (t) { var qi = loopIdx(q, t); if (qi < 0) return; var d = (cur - qi + 52) % 52; if (d >= 1 && d <= 6) sc += 18; }); });
          sc += to * .5 + Math.random();
          if (sc > bs) { bs = sc; best = k; }
        });
        return best;
      }
      /* animate along a list of positions, one hop per square */
      function move(p, k) {
        if (busy || over) return; busy = true; movable = []; panels();
        var pos = P[p].tok[k], to = pos < 0 ? 0 : pos + dice, steps = [];
        if (pos < 0) steps.push(0); else for (var i = pos + 1; i <= to; i++) steps.push(i);
        var n = 0;
        (function hop() {
          if (!steps.length) return land(p, k, to);
          var from = spot(p, k, P[p].tok[k]), nxt = steps.shift(), dst = spot(p, k, nxt);
          P[p].anim[k] = { fx: from.x, fy: from.y, tx: dst.x, ty: dst.y, t: performance.now(), d: reduce ? 1 : (pos < 0 ? 260 : 150), h: C * (pos < 0 ? .9 : .55) };
          G.sfx.hop(n++);
          setTimeout(function () { P[p].tok[k] = nxt; P[p].anim[k] = null; hop(); }, reduce ? 0 : (pos < 0 ? 270 : 160));
        })();
      }
      function land(p, k, to) {
        var extra = dice === 6, li = loopIdx(p, to), captured = 0, at = spot(p, k, to);
        if (li >= 0 && SAFE.indexOf(li) < 0) active().forEach(function (q) {
          if (q === p) return;
          P[q].tok.forEach(function (t, j) {
            if (loopIdx(q, t) === li) {
              var from = spot(q, j, t), home = baseSpot(q, j);
              P[q].tok[j] = -1; P[q].anim[j] = { fx: from.x, fy: from.y, tx: home.x, ty: home.y, t: performance.now(), d: reduce ? 1 : 520, h: C * 2.4, spin: 1 };
              setTimeout(function () { P[q].anim[j] = null; }, reduce ? 0 : 530); captured++;
            }
          });
        });
        if (captured) {
          extra = true; G.sfx.capture(); G.buzz(60); G.shake(stage);
          fx.burst(at.x / S, at.y / S, [COL[p], "#fff", LIGHT[p]], 26, 6); fx.text(at.x / S, at.y / S - .04, "Capture!", LIGHT[p], 26);
          say(who(p) + " captured a token!");
        }
        if (to === 56) {
          extra = true; G.sfx.coin(); fx.burst(.5, .5, [COL[p], "#FDE047", "#fff"], 30, 5); fx.text(.5, .44, "Home!", "#FDE047", 26);
          if (P[p].tok.every(function (t) { return t === 56; })) P[p].done = true;
        } else if (li >= 0 && SAFE.indexOf(li) >= 0 && !captured) { fx.burst(at.x / S, at.y / S, ["#fff", LIGHT[p]], 8, 2.5); }
        busy = false; panels();
        if (P[p].done) {
          over = true; G.sfx.win(); rollBtn.disabled = true; panels();
          var you = vs === "cpu" && p === 0;
          return setTimeout(function () {
            G.overlay(stage, { win: you || vs !== "cpu", lose: vs === "cpu" && !you, icon: you || vs !== "cpu" ? "🏆" : "🤖", title: you ? "You win!" : vs === "cpu" ? "Computer wins" : who(p) + " wins!", text: you ? "All four pawns are home." : vs === "cpu" ? "The computer got all four pawns home first. Try again!" : "All four " + NAMES[p].toLowerCase() + " pawns reached the centre.", buttons: [{ label: "Play again", fn: newGame }] });
          }, 500);
        }
        setTimeout(function () { nextTurn(extra); }, captured ? 650 : 220);
      }
      /* ---------- drawing ---------- */
      function rr(c, ax, ay, w, h, rad) { c.beginPath(); c.moveTo(ax + rad, ay); c.arcTo(ax + w, ay, ax + w, ay + h, rad); c.arcTo(ax + w, ay + h, ax, ay + h, rad); c.arcTo(ax, ay + h, ax, ay, rad); c.arcTo(ax, ay, ax + w, ay, rad); c.closePath(); }
      function star(c, cx, cy, rad) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? rad * .45 : rad; c.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } c.closePath(); }
      function buildBoard() {
        var dpr = Math.min(2, window.devicePixelRatio || 1), o = document.createElement("canvas"); o.width = S * dpr; o.height = S * dpr;
        var c = o.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
        var g = c.createLinearGradient(0, 0, S, S); g.addColorStop(0, "#fffdf6"); g.addColorStop(1, "#efe6d2"); c.fillStyle = g; c.fillRect(0, 0, S, S);
        function cell(rw, cl, fill, top) {
          var X = cl * C, Y = rw * C;
          c.fillStyle = fill; c.fillRect(X + 1, Y + 1, C - 2, C - 2);
          var h = c.createLinearGradient(X, Y, X, Y + C); h.addColorStop(0, "rgba(255,255,255," + (top || .55) + ")"); h.addColorStop(.5, "rgba(255,255,255,0)"); h.addColorStop(1, "rgba(0,0,0,.10)");
          c.fillStyle = h; c.fillRect(X + 1, Y + 1, C - 2, C - 2);
          c.strokeStyle = "rgba(60,40,20,.18)"; c.lineWidth = 1; c.strokeRect(X + 1.5, Y + 1.5, C - 3, C - 3);
        }
        for (var rw = 0; rw < 15; rw++) for (var cl = 0; cl < 15; cl++) if ((rw >= 6 && rw <= 8) || (cl >= 6 && cl <= 8)) if (!(rw >= 6 && rw <= 8 && cl >= 6 && cl <= 8)) cell(rw, cl, "#ffffff");
        [0, 1, 2, 3].forEach(function (p) {
          var b = BASE[p], on = true, col = COL[p], dk = DARK[p];
          var X = b[1] * C, Y = b[0] * C, W = 6 * C;
          var bg = c.createLinearGradient(X, Y, X + W, Y + W); bg.addColorStop(0, on ? LIGHT[p] : "#e2e8f0"); bg.addColorStop(.35, col); bg.addColorStop(1, dk);
          c.fillStyle = bg; rr(c, X + 3, Y + 3, W - 6, W - 6, 18); c.fill();
          c.fillStyle = "rgba(0,0,0,.18)"; rr(c, X + C * .85, Y + C * .95, W - C * 1.7, W - C * 1.7, 22); c.fill();
          var ig = c.createLinearGradient(X, Y + C, X, Y + W - C); ig.addColorStop(0, "#ffffff"); ig.addColorStop(1, "#f1ece0");
          c.fillStyle = ig; rr(c, X + C * .8, Y + C * .8, W - C * 1.6, W - C * 1.6, 22); c.fill();
          for (var k = 0; k < 4; k++) {
            var s = baseSpot(p, k);
            var wg = c.createRadialGradient(s.x - 4, s.y - 6, 2, s.x, s.y, C * .62); wg.addColorStop(0, on ? LIGHT[p] : "#e2e8f0"); wg.addColorStop(1, col);
            c.fillStyle = "rgba(0,0,0,.18)"; c.beginPath(); c.arc(s.x, s.y + 3, C * .62, 0, 7); c.fill();
            c.fillStyle = wg; c.beginPath(); c.arc(s.x, s.y, C * .62, 0, 7); c.fill();
            c.fillStyle = "rgba(0,0,0,.16)"; c.beginPath(); c.arc(s.x, s.y + 2, C * .4, 0, 7); c.fill();
            c.fillStyle = "#fff"; c.beginPath(); c.arc(s.x, s.y, C * .38, 0, 7); c.fill();
          }
          HOME[p].forEach(function (h) { cell(h[0], h[1], col, .45); });
          var st = LOOP[13 * p]; cell(st[0], st[1], col, .45);
          var sx = st[1] * C + C / 2, sy = st[0] * C + C / 2; c.fillStyle = "rgba(255,255,255,.9)"; star(c, sx, sy, C * .3); c.fill();
        });
        SAFE.forEach(function (i) { if (i % 13 === 0) return; var q = LOOP[i], sx = q[1] * C + C / 2, sy = q[0] * C + C / 2; var sg = c.createLinearGradient(sx, sy - 12, sx, sy + 12); sg.addColorStop(0, "#cbd5e1"); sg.addColorStop(1, "#64748b"); c.fillStyle = sg; star(c, sx, sy, C * .34); c.fill(); });
        // centre: four glossy triangles
        var m = 7.5 * C, tris = [[[6, 6], [6, 9], 1], [[6, 9], [9, 9], 2], [[9, 9], [9, 6], 3], [[9, 6], [6, 6], 0]];
        tris.forEach(function (t) {
          var p = t[2], on = true, a = t[0], b2 = t[1];
          var tg = c.createLinearGradient(a[1] * C, a[0] * C, m, m); tg.addColorStop(0, on ? DARK[p] : "#94a3b8"); tg.addColorStop(1, on ? LIGHT[p] : "#e2e8f0");
          c.fillStyle = tg; c.beginPath(); c.moveTo(a[1] * C, a[0] * C); c.lineTo(b2[1] * C, b2[0] * C); c.lineTo(m, m); c.closePath(); c.fill();
          c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 1.5; c.stroke();
        });
        // arrows into home columns
        c.fillStyle = "rgba(0,0,0,.18)";
        // outer frame
        c.lineWidth = 6; c.strokeStyle = "#5b3a1a"; rr(c, 3, 3, S - 6, S - 6, 14); c.stroke();
        c.lineWidth = 2; c.strokeStyle = "rgba(255,255,255,.5)"; rr(c, 7, 7, S - 14, S - 14, 11); c.stroke();
        return o;
      }
      function pawn(px, py, p, sc, lift, glow, tnow) {
        var w = C * .36 * sc, h = C * .95 * sc, by = py + C * .18 * sc - lift;
        // shadow (stays on the board)
        x.fillStyle = "rgba(0,0,0," + (.32 - Math.min(.2, lift / 120)) + ")"; x.beginPath(); x.ellipse(px, py + C * .2 * sc, w * (1.15 - Math.min(.4, lift / 90)), w * .45, 0, 0, 7); x.fill();
        if (glow) {
          var pulse = .5 + .5 * Math.sin(tnow / 160);
          x.strokeStyle = "rgba(255,255,255," + (.55 + .45 * pulse) + ")"; x.lineWidth = 3; x.beginPath(); x.ellipse(px, py + C * .2 * sc, w * 1.55 + pulse * 3, w * .62 + pulse * 1.5, 0, 0, 7); x.stroke();
        }
        // base disc
        var bg = x.createLinearGradient(px - w, 0, px + w, 0); bg.addColorStop(0, DARK[p]); bg.addColorStop(.45, COL[p]); bg.addColorStop(1, DEEP[p]);
        x.fillStyle = DEEP[p]; x.beginPath(); x.ellipse(px, by + 3, w * 1.05, w * .42, 0, 0, 7); x.fill();
        x.fillStyle = bg; x.beginPath(); x.ellipse(px, by, w * 1.05, w * .42, 0, 0, 7); x.fill();
        // body (tapered)
        var top = by - h * .62;
        var body = x.createLinearGradient(px - w, 0, px + w, 0); body.addColorStop(0, DARK[p]); body.addColorStop(.35, LIGHT[p]); body.addColorStop(.6, COL[p]); body.addColorStop(1, DEEP[p]);
        x.fillStyle = body; x.beginPath(); x.moveTo(px - w * .92, by); x.bezierCurveTo(px - w * .9, by - h * .25, px - w * .32, by - h * .35, px - w * .3, top); x.lineTo(px + w * .3, top); x.bezierCurveTo(px + w * .32, by - h * .35, px + w * .9, by - h * .25, px + w * .92, by); x.closePath(); x.fill();
        // collar
        x.fillStyle = "#fff"; x.beginPath(); x.ellipse(px, top + 1, w * .5, w * .17, 0, 0, 7); x.fill();
        // head sphere
        var hr = w * .62, hy = top - hr * .75;
        var hg = x.createRadialGradient(px - hr * .4, hy - hr * .45, hr * .1, px, hy, hr * 1.05); hg.addColorStop(0, "#fff"); hg.addColorStop(.25, LIGHT[p]); hg.addColorStop(.7, COL[p]); hg.addColorStop(1, DEEP[p]);
        x.fillStyle = hg; x.beginPath(); x.arc(px, hy, hr, 0, 7); x.fill();
        x.strokeStyle = "rgba(0,0,0,.25)"; x.lineWidth = 1; x.stroke();
      }
      function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
      function draw() {
        var now = performance.now();
        if (!boardImg) boardImg = buildBoard();
        x.clearRect(0, 0, S, S); x.drawImage(boardImg, 0, 0, S, S);
        // turn glow over the active base
        if (!over) { var b = BASE[turn], pu = .5 + .5 * Math.sin(now / 300); x.strokeStyle = "rgba(255,255,255," + (.35 + pu * .5) + ")"; x.lineWidth = 4; rr(x, b[1] * C + 6, b[0] * C + 6, 6 * C - 12, 6 * C - 12, 16); x.stroke(); }
        var list = [], groups = {};
        active().forEach(function (p) {
          P[p].tok.forEach(function (t, k) {
            var a = P[p].anim[k], pt, lift = 0, sc = 1;
            if (a) { var q = Math.min(1, (now - a.t) / a.d), e = ease(q); pt = { x: a.fx + (a.tx - a.fx) * e, y: a.fy + (a.ty - a.fy) * e }; lift = Math.sin(q * Math.PI) * a.h; sc = 1 + Math.sin(q * Math.PI) * .12; }
            else { pt = spot(p, k, t); }
            var key = a ? "a" + p + k : t < 0 ? "b" + p + k : t === 56 ? "f" + p + k : Math.round(pt.x) + "," + Math.round(pt.y);
            var it = { p: p, k: k, x: pt.x, y: pt.y, lift: lift, sc: t === 56 && !a ? .6 : t < 0 && !a ? 1.25 : sc, anim: !!a };
            (groups[key] = groups[key] || []).push(it); list.push(it);
          });
        });
        Object.keys(groups).forEach(function (key) { var g = groups[key]; if (g.length > 1) g.forEach(function (it, i) { var ang = i / g.length * Math.PI * 2 - Math.PI / 2; it.x += Math.cos(ang) * C * .2; it.y += Math.sin(ang) * C * .16; it.sc *= .78; }); });
        list.sort(function (a, b2) { return a.y - b2.y; });
        list.forEach(function (it) {
          var hot = !busy && it.p === turn && movable.indexOf(it.k) >= 0 && !isCpu(turn);
          var bob = hot && !reduce ? Math.abs(Math.sin(now / 220 + it.k)) * 5 : 0;
          it.dx = it.x; it.dy = it.y - it.lift - bob;
          pawn(it.x, it.y, it.p, it.sc, it.lift + bob, hot, now);
        });
        hit = list;
      }
      var hit = [];
      function loop() { cancelAnimationFrame(raf); (function f() { if (!document.hidden) draw(); raf = requestAnimationFrame(f); })(); }
      cv.addEventListener("pointerdown", function (e) {
        e.preventDefault(); if (busy || over || isCpu(turn)) return;
        var b = cv.getBoundingClientRect(), px = (e.clientX - b.left) * S / b.width, py = (e.clientY - b.top) * S / b.height;
        if (!rolled) return roll();
        var best = -1, bd = 1e9;
        hit.forEach(function (it) {
          if (it.p !== turn || movable.indexOf(it.k) < 0) return;
          var d = Math.pow(it.dx - px, 2) + Math.pow(it.dy - C * .25 - py, 2); if (d < bd) { bd = d; best = it.k; }
        });
        if (best >= 0 && bd < Math.pow(C * 1.25, 2)) move(turn, best);
      });
      rollBtn.addEventListener("click", roll);
      Array.prototype.forEach.call(r.querySelectorAll(".dslot"), function (s) { s.addEventListener("click", function () { if (!isCpu(turn)) roll(); }); });
      G.keys(function (e) { if (e.key === " " || e.key === "Enter") { if (!isCpu(turn) && document.activeElement && document.activeElement.tagName !== "BUTTON") { roll(); e.preventDefault(); } } });
      G.seg($("#onp", r), [[2, "2 players"], [4, "4 players"]], np, function (v) { np = v; ls.set("ld_np", v); newGame(); });
      G.seg($("#ovs", r), [["cpu", "vs Computer"], ["pass", "With friends"]], vs, function (v) { vs = v; ls.set("ld_vs", v); newGame(); });
      $("#nw", r).addEventListener("click", newGame); G.soundBtn($("#sn", r));
      cv._st = function () { return JSON.stringify({ P: P.map(function (q) { return { tok: q.tok, done: q.done }; }), turn: turn, dice: dice, rolled: rolled, movable: movable, busy: busy, over: over }); };
      cube.style.transform = "rotateX(-20deg) rotateY(25deg)";
      newGame();
    }
  });
})();
