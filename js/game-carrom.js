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

/* Carrom – white against the computer or a friend (black). Drag the striker along your line, pull back to aim, release to shoot. */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;
  var S = 600, M = 40, IN = S - 2 * M, PR = 30, CR = 13, SR = 17, FR = .985, MINV = .05, LINE = S - M - 62, CPU_LINE = M + 62;
  var POCKETS = [[M + 12, M + 12], [S - M - 12, M + 12], [M + 12, S - M - 12], [S - M - 12, S - M - 12]];

  VX.tool("carrom", {
    html: '<div class="gopt"><div id="omd" role="group" aria-label="Opponent"></div><div id="odf" role="group" aria-label="Computer level"></div></div>' +
      G.hud([["ps", "White", 0], ["cs", "Black", 0], ["qn", "Queen", "–"]]) +
      '<div class="gwrap"><div class="gstage" style="--gw:520px"><canvas class="gcanvas swipe" id="cv" width="600" height="600" style="width:100%" aria-label="Carrom board"></canvas></div>' +
      '<div class="gmsg" id="msg" aria-live="polite" style="min-height:52px;display:flex;align-items:center"></div>' +
      '<div class="gbar"><button class="btn ghost sm" id="nw" type="button">New game</button><button class="btn ghost sm" id="sn" type="button"></button></div>' +
      '<p class="gnote">You are white. Drag the striker left or right on your line, then drag back from the striker to aim and set power. Release to shoot. Pocket the red queen and then one of your coins in the same turn to keep her.</p></div>',
    init: function (r) {
      var cv = $("#cv", r), x = G.canvas(cv, S, S), stage = $(".gstage", r), msg = $("#msg", r);
      var mode = ls.get("cr_m", "cpu"), fx = G.fx(stage), boardImg = null, sinks = [], diff = ls.get("cr_d", "normal"), pieces, striker, turn, moving, drag, score, queen, queenPending, pocketedThisShot, over, raf, foul;
      function say(t) { msg.textContent = t; }
      function nm(c) { return mode === "cpu" ? (c === "w" ? "You" : "Computer") : (c === "w" ? "White" : "Black"); }
      function human(c) { return c === "w" || mode !== "cpu"; }
      function lineOf(c) { return c === "w" ? LINE : CPU_LINE; }
      function setup() {
        pieces = []; var c = S / 2, d = 2 * CR + 1.5;
        pieces.push({ x: c, y: c, col: "q" });
        for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; pieces.push({ x: c + Math.cos(a) * d, y: c + Math.sin(a) * d, col: i % 2 ? "w" : "b" }); }
        for (var j = 0; j < 12; j++) { var a2 = j * Math.PI / 6 + Math.PI / 12, dd = d * 1.95; pieces.push({ x: c + Math.cos(a2) * dd, y: c + Math.sin(a2) * dd, col: j % 2 ? "b" : "w" }); }
        pieces.forEach(function (p) { p.vx = 0; p.vy = 0; p.r = CR; p.in = true; });
        striker = { x: S / 2, y: LINE, vx: 0, vy: 0, r: SR, col: "s", in: true };
      }
      function newGame() {
        setup(); turn = "w"; moving = false; drag = null; score = { w: 0, b: 0 }; queen = null; queenPending = null; over = false; foul = false;
        G.closeOverlay(stage); upd(); say(mode === "cpu" ? "Your turn: drag the striker, pull back and release." : "White's turn: drag the striker, pull back and release."); loop();
        $("#odf", r).hidden = mode !== "cpu";
      }
      function upd() { G.set(r, "ps", score.w); G.set(r, "cs", score.b); G.set(r, "qn", queen ? nm(queen) : queenPending ? "Cover it!" : "–"); }
      function all() { return pieces.filter(function (p) { return p.in; }).concat(striker.in ? [striker] : []); }
      function physics() { var any = false; for (var k = 0; k < 3; k++) any = physStep() || any; return any; }
      function wallHit(v) { if (Math.abs(v) > 1.5) G.sfx.knock(Math.abs(v) / 2); }
      function physStep() {
        var ps = all(), any = false, fr = Math.pow(FR, 1 / 3);
        ps.forEach(function (p) {
          p.x += p.vx / 3; p.y += p.vy / 3; p.vx *= fr; p.vy *= fr;
          if (Math.abs(p.vx) < MINV && Math.abs(p.vy) < MINV) { p.vx = 0; p.vy = 0; } else any = true;
          if (p.x < M + p.r) { p.x = M + p.r; wallHit(p.vx); p.vx = -p.vx * .78; } if (p.x > S - M - p.r) { p.x = S - M - p.r; wallHit(p.vx); p.vx = -p.vx * .78; }
          if (p.y < M + p.r) { p.y = M + p.r; wallHit(p.vy); p.vy = -p.vy * .78; } if (p.y > S - M - p.r) { p.y = S - M - p.r; wallHit(p.vy); p.vy = -p.vy * .78; }
          for (var k = 0; k < 4; k++) if (Math.pow(p.x - POCKETS[k][0], 2) + Math.pow(p.y - POCKETS[k][1], 2) < PR * PR) { pocket(p); }
        });
        for (var i = 0; i < ps.length; i++) for (var j = i + 1; j < ps.length; j++) {
          var a = ps[i], b = ps[j]; if (!a.in || !b.in) continue;
          var dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy), md = a.r + b.r;
          if (d < md && d > 0) {
            var nx = dx / d, ny = dy / d, ov = (md - d) / 2; a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
            var ma = a.col === "s" ? 1.6 : 1, mb = b.col === "s" ? 1.6 : 1, va = a.vx * nx + a.vy * ny, vb = b.vx * nx + b.vy * ny;
            if (va - vb > 0) {
              var na = (va * (ma - mb) + 2 * mb * vb) / (ma + mb), nb = (vb * (mb - ma) + 2 * ma * va) / (ma + mb);
              a.vx += (na - va) * nx; a.vy += (na - va) * ny; b.vx += (nb - vb) * nx; b.vy += (nb - vb) * ny;
              if (Math.abs(va - vb) > 1.2) G.sfx.knock(Math.abs(va - vb));
            }
          }
        }
        return any;
      }
      function pocket(p) {
        var pk = POCKETS.reduce(function (a, q) { return Math.pow(p.x - q[0], 2) + Math.pow(p.y - q[1], 2) < Math.pow(p.x - a[0], 2) + Math.pow(p.y - a[1], 2) ? q : a; });
        sinks.push({ col: p.col, r: p.r, x: p.x, y: p.y, px: pk[0], py: pk[1], t: performance.now() });
        p.in = false; p.vx = p.vy = 0;
        if (p.col === "s") { foul = true; G.sfx.bad(); G.buzz(80); fx.text(pk[0] / S, pk[1] / S, "Foul!", "#FCA5A5", 24); return; }
        pocketedThisShot.push(p); G.sfx.coin(); G.buzz(20);
        fx.burst(pk[0] / S, pk[1] / S, p.col === "q" ? ["#EF4444", "#FDE047", "#fff"] : p.col === "w" ? ["#FEF3C7", "#fff", "#FDE047"] : ["#78716C", "#D6D3D1", "#FDE047"], 16, 4);
        fx.text(G.clamp(pk[0] / S, .14, .86), G.clamp(pk[1] / S, .12, .88), p.col === "q" ? "Queen!" : (p.col === turn ? "+1" : "+1 " + nm(p.col)), p.col === "q" ? "#FCA5A5" : "#FDE047", 22);
      }
      function returnCoin(col) {
        var c = pieces.filter(function (p) { return !p.in && p.col === col; })[0]; if (!c) return false;
        c.in = true; c.x = S / 2 + (Math.random() - .5) * 30; c.y = S / 2 + (Math.random() - .5) * 30; c.vx = c.vy = 0; return true;
      }
      function shoot(vx, vy) { striker.vx = vx; striker.vy = vy; moving = true; pocketedThisShot = []; foul = false; G.sfx.pop(); }
      function endShot() {
        moving = false; var me = turn, own = 0, other = 0, q = false;
        pocketedThisShot.forEach(function (p) { if (p.col === "q") q = true; else if (p.col === me) own++; else other++; });
        if (q) { if (own) { queen = me; score[me] += 3; } else queenPending = me; }
        else if (queenPending === me && own) { queen = me; score[me] += 3; queenPending = null; }
        if (own) score[me] += own;
        if (other) { score[me === "w" ? "b" : "w"] += other; }
        if (queenPending === me && !own && !q) { var qp = pieces.filter(function (p) { return p.col === "q"; })[0]; qp.in = true; qp.x = S / 2; qp.y = S / 2; qp.vx = qp.vy = 0; queenPending = null; say(nm(me) + " could not cover the queen. She returns to the centre."); }
        var keep = own > 0 || q;
        if (foul) { keep = false; if (returnCoin(me)) { score[me] = Math.max(0, score[me] - 1); say(nm(me) + " pocketed the striker: one coin goes back."); } else say("Striker pocketed: foul."); }
        var left = { w: 0, b: 0 }; pieces.forEach(function (p) { if (p.in && p.col !== "q") left[p.col]++; });
        if (!left.w || !left.b) {
          over = true; var winner = !left.w ? "w" : "b"; if (queenPending) { var qp2 = pieces.filter(function (p) { return p.col === "q"; })[0]; qp2.in = true; qp2.x = qp2.y = S / 2; queenPending = null; }
          upd(); say("Game over."); G.sfx.win(); var youWin = mode !== "cpu" || winner === "w";
          return setTimeout(function () { G.overlay(stage, { win: youWin, lose: !youWin, icon: youWin ? "🏆" : "🤖", title: mode === "cpu" ? (winner === "w" ? "You win!" : "Computer wins") : nm(winner) + " wins!", text: nm("w") + " " + score.w + " · " + nm("b") + " " + score.b + (queen ? " · queen: " + nm(queen) : ""), buttons: [{ label: "Play again", fn: newGame }] }); }, 400);
        }
        if (!keep) turn = me === "w" ? "b" : "w";
        striker.in = true; striker.vx = striker.vy = 0; striker.x = S / 2; striker.y = lineOf(turn); upd();
        if (!human(turn)) { say("Computer is aiming…"); setTimeout(cpuShot, 900); }
        else say(keep ? (mode === "cpu" ? "Nice! Shoot again." : nm(turn) + " shoots again.") : (mode === "cpu" ? "Your turn." : nm(turn) + "'s turn."));
      }
      /* ---------- computer ---------- */
      function clear(ax, ay, bx, by, skip) {
        var dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy); if (!L) return true;
        return all().every(function (p) { if (skip.indexOf(p) >= 0 || !p.in) return true; var t = ((p.x - ax) * dx + (p.y - ay) * dy) / (L * L); if (t < 0 || t > 1) return true; var px = ax + dx * t, py = ay + dy * t; return Math.pow(p.x - px, 2) + Math.pow(p.y - py, 2) > Math.pow(p.r + SR + 1, 2); });
      }
      function cpuShot() {
        if (over) return; var best = null, bs = -1;
        var targets = pieces.filter(function (p) { return p.in && (p.col === "b" || (p.col === "q" && queen == null && !queenPending)); });
        targets.forEach(function (t) {
          POCKETS.forEach(function (pk) {
            var dx = pk[0] - t.x, dy = pk[1] - t.y, L = Math.sqrt(dx * dx + dy * dy); if (!L) return;
            var gx = t.x - dx / L * (t.r + SR), gy = t.y - dy / L * (t.r + SR); // ghost ball position
            if (gy < CPU_LINE + 2) return;
            for (var sx = M + 70; sx <= S - M - 70; sx += 18) {
              var sdx = gx - sx, sdy = gy - CPU_LINE, sl = Math.sqrt(sdx * sdx + sdy * sdy);
              var cosA = (sdx * dx + sdy * dy) / (sl * L); if (cosA < .3) continue;
              if (!clear(sx, CPU_LINE, gx, gy, [t, striker]) || !clear(t.x, t.y, pk[0], pk[1], [t, striker])) continue;
              var sc = cosA * 2 - L / 900 - sl / 1500 + (t.col === "q" ? .3 : 0) + Math.random() * (diff === "easy" ? .8 : diff === "hard" ? .05 : .3);
              if (sc > bs) { bs = sc; best = { sx: sx, ang: Math.atan2(sdy, sdx), pow: Math.min(16, 6 + (sl + L) / 40) }; }
            }
          });
        });
        if (!best) { best = { sx: M + 100 + G.rand(IN - 200), ang: Math.PI / 2 + (Math.random() - .5) * 1.2, pow: 8 + Math.random() * 5 }; }
        var err = diff === "easy" ? .09 : diff === "hard" ? .012 : .04; best.ang += (Math.random() - .5) * err;
        striker.x = best.sx; striker.y = CPU_LINE; draw();
        setTimeout(function () { shoot(Math.cos(best.ang) * best.pow, Math.sin(best.ang) * best.pow); }, 450);
      }
      /* ---------- drawing ---------- */
      function buildBoard() {
        var dpr = Math.min(2, window.devicePixelRatio || 1), o = document.createElement("canvas"); o.width = S * dpr; o.height = S * dpr;
        var c = o.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
        // wooden frame with grain
        var fg = c.createLinearGradient(0, 0, S, S); fg.addColorStop(0, "#6b3f1d"); fg.addColorStop(.5, "#4a2a12"); fg.addColorStop(1, "#2e190a"); c.fillStyle = fg; c.fillRect(0, 0, S, S);
        c.globalAlpha = .12; for (var i = 0; i < 60; i++) { c.strokeStyle = i % 2 ? "#000" : "#e0a96d"; c.lineWidth = 1 + (i % 3); c.beginPath(); var yy = i * 10 + Math.sin(i) * 4; c.moveTo(0, yy); c.bezierCurveTo(S * .3, yy + 6, S * .6, yy - 6, S, yy + 3); c.stroke(); } c.globalAlpha = 1;
        c.strokeStyle = "rgba(255,220,170,.25)"; c.lineWidth = 2; c.strokeRect(M - 6, M - 6, IN + 12, IN + 12);
        // playing surface: light maple with vignette
        var pg = c.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, IN * .75); pg.addColorStop(0, "#f8e7c2"); pg.addColorStop(.7, "#ecd3a0"); pg.addColorStop(1, "#d9b77c"); c.fillStyle = pg; c.fillRect(M, M, IN, IN);
        c.globalAlpha = .06; for (var j = 0; j < 40; j++) { c.strokeStyle = "#7c4a1e"; c.lineWidth = 1; c.beginPath(); var y2 = M + j * (IN / 40); c.moveTo(M, y2); c.bezierCurveTo(S * .4, y2 + 3, S * .6, y2 - 3, S - M, y2 + 1); c.stroke(); } c.globalAlpha = 1;
        c.shadowColor = "rgba(0,0,0,.35)"; c.shadowBlur = 10; c.strokeStyle = "#2e190a"; c.lineWidth = 3; c.strokeRect(M, M, IN, IN); c.shadowBlur = 0;
        // lines
        c.strokeStyle = "#1f2937"; c.lineWidth = 1.6;
        function base(horiz, k) {
          var a = M + 60, b = S - M - 60;
          if (horiz) { c.beginPath(); c.moveTo(a, k - 12); c.lineTo(b, k - 12); c.moveTo(a, k + 12); c.lineTo(b, k + 12); c.stroke(); [a, b].forEach(function (q) { c.fillStyle = "#b91c1c"; c.beginPath(); c.arc(q, k, 12, 0, 7); c.fill(); c.stroke(); c.fillStyle = "#fde68a"; c.beginPath(); c.arc(q, k, 4, 0, 7); c.fill(); }); }
          else { c.beginPath(); c.moveTo(k - 12, a); c.lineTo(k - 12, b); c.moveTo(k + 12, a); c.lineTo(k + 12, b); c.stroke(); [a, b].forEach(function (q) { c.fillStyle = "#b91c1c"; c.beginPath(); c.arc(k, q, 12, 0, 7); c.fill(); c.stroke(); c.fillStyle = "#fde68a"; c.beginPath(); c.arc(k, q, 4, 0, 7); c.fill(); }); }
        }
        base(true, LINE); base(true, CPU_LINE); base(false, M + 62); base(false, S - M - 62);
        // corner arrows
        c.strokeStyle = "#1f2937"; c.lineWidth = 1.6;
        [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (d) { var sx = d[0] > 0 ? M + 50 : S - M - 50, sy = d[1] > 0 ? M + 50 : S - M - 50; c.beginPath(); c.moveTo(sx + d[0] * 18, sy + d[1] * 18); c.lineTo(sx + d[0] * 120, sy + d[1] * 120); c.stroke(); c.beginPath(); c.arc(sx + d[0] * 106, sy + d[1] * 106, 12, Math.atan2(-d[1], -d[0]) - 1.2, Math.atan2(-d[1], -d[0]) + 1.2); c.stroke(); });
        // centre rosette
        c.beginPath(); c.arc(S / 2, S / 2, 62, 0, 7); c.stroke(); c.beginPath(); c.arc(S / 2, S / 2, 56, 0, 7); c.stroke();
        c.fillStyle = "#b91c1c"; c.beginPath(); for (var k = 0; k < 16; k++) { var an = k * Math.PI / 8, rr2 = k % 2 ? 18 : 46; c.lineTo(S / 2 + Math.cos(an) * rr2, S / 2 + Math.sin(an) * rr2); } c.closePath(); c.globalAlpha = .85; c.fill(); c.globalAlpha = 1;
        c.fillStyle = "#fde68a"; c.beginPath(); c.arc(S / 2, S / 2, 12, 0, 7); c.fill(); c.strokeStyle = "#1f2937"; c.stroke();
        // pockets with depth
        POCKETS.forEach(function (p) {
          var g = c.createRadialGradient(p[0] - 4, p[1] - 4, 2, p[0], p[1], PR + 2); g.addColorStop(0, "#000"); g.addColorStop(.75, "#111"); g.addColorStop(1, "#3b2a1a");
          c.fillStyle = g; c.beginPath(); c.arc(p[0], p[1], PR, 0, 7); c.fill(); c.strokeStyle = "rgba(255,220,170,.4)"; c.lineWidth = 2; c.stroke();
        });
        return o;
      }
      var COINC = { w: ["#fffaf0", "#f1e4c3", "#b8a47a"], b: ["#57534e", "#292524", "#0c0a09"], q: ["#fca5a5", "#dc2626", "#7f1d1d"], s: ["#ffffff", "#e0e7ff", "#6366f1"] };
      function coin(p, rad, alpha) {
        var c = COINC[p.col], R = rad || p.r;
        x.globalAlpha = alpha == null ? 1 : alpha;
        x.fillStyle = "rgba(0,0,0,.35)"; x.beginPath(); x.arc(p.x + 2.5, p.y + 3.5, R, 0, 7); x.fill();
        x.fillStyle = c[2]; x.beginPath(); x.arc(p.x, p.y + 1.5, R, 0, 7); x.fill();
        var g = x.createRadialGradient(p.x - R * .4, p.y - R * .45, R * .1, p.x, p.y, R); g.addColorStop(0, c[0]); g.addColorStop(.6, c[1]); g.addColorStop(1, c[2]);
        x.fillStyle = g; x.beginPath(); x.arc(p.x, p.y, R, 0, 7); x.fill();
        x.strokeStyle = p.col === "b" ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)"; x.lineWidth = 1.2;
        x.beginPath(); x.arc(p.x, p.y, R * .72, 0, 7); x.stroke(); x.beginPath(); x.arc(p.x, p.y, R * .42, 0, 7); x.stroke();
        if (p.col === "s") { x.strokeStyle = "#4f46e5"; x.lineWidth = 2.5; x.beginPath(); x.arc(p.x, p.y, R * .82, 0, 7); x.stroke(); x.fillStyle = "#4f46e5"; x.beginPath(); x.arc(p.x, p.y, R * .22, 0, 7); x.fill(); }
        x.fillStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.ellipse(p.x - R * .3, p.y - R * .38, R * .38, R * .2, -.5, 0, 7); x.fill();
        x.globalAlpha = 1; x.lineWidth = 1;
      }
      function aimGuide(a, L) {
        // ray from striker; stop at first coin (ghost) or bounce once off a wall
        var ox = striker.x, oy = striker.y, dx = Math.cos(a), dy = Math.sin(a), pts = [[ox, oy]], ghost = null, tgt = null;
        for (var seg = 0; seg < 2 && !ghost; seg++) {
          var best = 1e9;
          pieces.forEach(function (p) { if (!p.in) return; var fx2 = p.x - ox, fy2 = p.y - oy, tca = fx2 * dx + fy2 * dy; if (tca < 0) return; var d2 = fx2 * fx2 + fy2 * fy2 - tca * tca, rr2 = Math.pow(p.r + SR, 2); if (d2 > rr2) return; var t = tca - Math.sqrt(rr2 - d2); if (t < best) { best = t; tgt = p; } });
          var tw = 1e9, nx = 0, ny = 0;
          if (dx > 0) { var t1 = (S - M - SR - ox) / dx; if (t1 < tw) { tw = t1; nx = -1; ny = 0; } } if (dx < 0) { var t2 = (M + SR - ox) / dx; if (t2 < tw) { tw = t2; nx = 1; ny = 0; } }
          if (dy > 0) { var t3 = (S - M - SR - oy) / dy; if (t3 < tw) { tw = t3; nx = 0; ny = -1; } } if (dy < 0) { var t4 = (M + SR - oy) / dy; if (t4 < tw) { tw = t4; nx = 0; ny = 1; } }
          if (best < tw) { ghost = [ox + dx * best, oy + dy * best]; pts.push(ghost); break; }
          ox += dx * tw; oy += dy * tw; pts.push([ox, oy]); if (nx) dx = -dx; else dy = -dy; tgt = null;
        }
        // green dotted aim path with a dark outline so it shows on the light board
        var acc = 0; for (var i = 1; i < pts.length; i++) { var A = pts[i - 1], B = pts[i], LL = Math.hypot(B[0] - A[0], B[1] - A[1]), t = acc; while (t < LL) { var kk = t / LL, px = A[0] + (B[0] - A[0]) * kk, py = A[1] + (B[1] - A[1]) * kk; x.fillStyle = "rgba(0,0,0,.6)"; x.beginPath(); x.arc(px, py, 5.2, 0, 7); x.fill(); x.fillStyle = "#22C55E"; x.beginPath(); x.arc(px, py, 3.6, 0, 7); x.fill(); t += 15; } acc = t - LL; }
        x.lineCap = "round";
        if (ghost) {
          x.strokeStyle = "rgba(0,0,0,.6)"; x.lineWidth = 5; x.beginPath(); x.arc(ghost[0], ghost[1], SR, 0, 7); x.stroke(); x.strokeStyle = "#22C55E"; x.lineWidth = 2.5; x.beginPath(); x.arc(ghost[0], ghost[1], SR, 0, 7); x.stroke();
          if (tgt) { var gx = tgt.x - ghost[0], gy = tgt.y - ghost[1], gl = Math.sqrt(gx * gx + gy * gy) || 1; x.strokeStyle = "#16A34A"; x.lineWidth = 3; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(tgt.x, tgt.y); x.lineTo(tgt.x + gx / gl * 90, tgt.y + gy / gl * 90); x.stroke(); x.setLineDash([]); }
        }
        // power meter beside the striker
        var k = L / 150, bx = striker.x + (striker.x > S / 2 ? -48 : 32), by = striker.y - 50;
        x.fillStyle = "rgba(0,0,0,.45)"; x.fillRect(bx, by, 14, 100); var pg2 = x.createLinearGradient(0, by + 100, 0, by); pg2.addColorStop(0, "#22C55E"); pg2.addColorStop(.6, "#FACC15"); pg2.addColorStop(1, "#EF4444");
        x.fillStyle = pg2; x.fillRect(bx + 2, by + 2 + 96 * (1 - k), 10, 96 * k); x.strokeStyle = "#fff"; x.lineWidth = 1.5; x.strokeRect(bx, by, 14, 100);
        // pull-back band
        x.strokeStyle = "rgba(239,68,68,.9)"; x.lineWidth = 4; x.beginPath(); x.moveTo(striker.x, striker.y); x.lineTo(striker.x - Math.cos(a) * L, striker.y - Math.sin(a) * L); x.stroke(); x.lineWidth = 1; x.lineCap = "butt";
      }
      function draw() {
        if (!boardImg) boardImg = buildBoard();
        x.drawImage(boardImg, 0, 0, S, S);
        var now = performance.now();
        // turn highlight on the shooter's baseline
        if (!moving && !over) { var ly = lineOf(turn), pu = .4 + .3 * Math.sin(now / 250); x.fillStyle = "rgba(124,58,237," + pu * .35 + ")"; x.fillRect(M + 60, ly - 12, IN - 120, 24); }
        sinks = sinks.filter(function (k) { var t = (now - k.t) / 260; if (t >= 1) return false; coin({ col: k.col, x: k.x + (k.px - k.x) * t, y: k.y + (k.py - k.y) * t }, k.r * (1 - t * .7), 1 - t); return true; });
        pieces.forEach(function (p) { if (p.in) coin(p); });
        if (striker.in) {
          if (!moving && !over && human(turn) && !drag) { var pu2 = .5 + .5 * Math.sin(now / 200); x.strokeStyle = "rgba(255,255,255," + (.4 + pu2 * .5) + ")"; x.lineWidth = 2; x.beginPath(); x.arc(striker.x, striker.y, SR + 5 + pu2 * 3, 0, 7); x.stroke(); x.lineWidth = 1; }
          coin(striker);
        }
        if (drag && drag.aim) {
          var dx = striker.x - drag.x, dy = striker.y - drag.y, L = Math.min(150, Math.sqrt(dx * dx + dy * dy));
          if (L > 8) aimGuide(Math.atan2(dy, dx), L);
        }
        // pocketed coins on the frame
        var pw = pieces.filter(function (p) { return !p.in && p.col === "w"; }).length, pb = pieces.filter(function (p) { return !p.in && p.col === "b"; }).length;
        for (var i = 0; i < pw; i++) coin({ col: "w", x: M + 30 + i * 18, y: S - 20 }, 7);
        for (var j = 0; j < pb; j++) coin({ col: "b", x: S - M - 30 - j * 18, y: 20 }, 7);
      }
      function loop() { cancelAnimationFrame(raf); (function f() { if (moving) { var any = physics(); if (!any) endShot(); } draw(); raf = requestAnimationFrame(f); })(); }
      function pos(e) { var b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) * S / b.width, y: (e.clientY - b.top) * S / b.height }; }
      cv.addEventListener("pointerdown", function (e) {
        e.preventDefault(); if (moving || over || !human(turn)) return; var q = pos(e);
        var d = Math.sqrt(Math.pow(q.x - striker.x, 2) + Math.pow(q.y - striker.y, 2));
        if (d < SR * 2.2) drag = { aim: true, x: q.x, y: q.y }; else if (Math.abs(q.y - lineOf(turn)) < 60) { striker.x = G.clamp(q.x, M + 72, S - M - 72); drag = { aim: false, x: q.x, y: q.y }; }
        try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      });
      cv.addEventListener("pointermove", function (e) { if (!drag) return; var q = pos(e); if (drag.aim) { drag.x = q.x; drag.y = q.y; } else striker.x = G.clamp(q.x, M + 72, S - M - 72); });
      cv.addEventListener("pointerup", function (e) {
        if (!drag) return; var q = pos(e), d = drag; drag = null;
        if (!d.aim) return;
        var dx = striker.x - q.x, dy = striker.y - q.y, L = Math.min(150, Math.sqrt(dx * dx + dy * dy));
        if (L < 10) return; var a = Math.atan2(dy, dx), pw = 4 + L / 150 * 14;
        shoot(Math.cos(a) * pw, Math.sin(a) * pw);
      });
      cv.addEventListener("pointercancel", function () { drag = null; });
      G.seg($("#omd", r), [["cpu", "vs Computer"], ["two", "2 players"]], mode, function (v) { mode = v; ls.set("cr_m", v); newGame(); });
      G.seg($("#odf", r), [["easy", "Easy"], ["normal", "Normal"], ["hard", "Hard"]], diff, function (v) { diff = v; ls.set("cr_d", v); newGame(); });
      $("#nw", r).addEventListener("click", newGame); G.soundBtn($("#sn", r));
      newGame();
    }
  });
})();
