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

/* Carrom – you (white) against the computer (black). Drag the striker along your line, pull back to aim, release to shoot. */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;
  var S = 600, M = 40, IN = S - 2 * M, PR = 30, CR = 13, SR = 17, FR = .985, MINV = .05, LINE = S - M - 62, CPU_LINE = M + 62;
  var POCKETS = [[M + 12, M + 12], [S - M - 12, M + 12], [M + 12, S - M - 12], [S - M - 12, S - M - 12]];

  VX.tool("carrom", {
    html: '<div class="gopt"><div id="odf" role="group" aria-label="Computer level"></div></div>' +
      G.hud([["ps", "You", 0], ["cs", "Computer", 0], ["qn", "Queen", "–"]]) +
      '<div class="gwrap"><div class="gstage" style="--gw:520px"><canvas class="gcanvas swipe" id="cv" width="600" height="600" style="width:100%" aria-label="Carrom board"></canvas></div>' +
      '<div class="gmsg" id="msg" aria-live="polite" style="min-height:52px;display:flex;align-items:center"></div>' +
      '<div class="gbar"><button class="btn ghost sm" id="nw" type="button">New game</button><button class="btn ghost sm" id="sn" type="button"></button></div>' +
      '<p class="gnote">You are white. Drag the striker left or right on your line, then drag back from the striker to aim and set power. Release to shoot. Pocket the red queen and then one of your coins in the same turn to keep her.</p></div>',
    init: function (r) {
      var cv = $("#cv", r), x = G.canvas(cv, S, S), stage = $(".gstage", r), msg = $("#msg", r);
      var diff = ls.get("cr_d", "normal"), pieces, striker, turn, moving, drag, score, queen, queenPending, pocketedThisShot, over, raf, foul;
      function say(t) { msg.textContent = t; }
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
        G.closeOverlay(stage); upd(); say("Your turn: drag the striker, pull back and release."); loop();
      }
      function upd() { G.set(r, "ps", score.w); G.set(r, "cs", score.b); G.set(r, "qn", queen === "w" ? "Yours" : queen === "b" ? "Computer" : queenPending ? "Cover it!" : "–"); }
      function all() { return pieces.filter(function (p) { return p.in; }).concat(striker.in ? [striker] : []); }
      function physics() {
        var ps = all(), any = false;
        ps.forEach(function (p) {
          p.x += p.vx; p.y += p.vy; p.vx *= FR; p.vy *= FR;
          if (Math.abs(p.vx) < MINV && Math.abs(p.vy) < MINV) { p.vx = 0; p.vy = 0; } else any = true;
          if (p.x < M + p.r) { p.x = M + p.r; p.vx = -p.vx * .8; } if (p.x > S - M - p.r) { p.x = S - M - p.r; p.vx = -p.vx * .8; }
          if (p.y < M + p.r) { p.y = M + p.r; p.vy = -p.vy * .8; } if (p.y > S - M - p.r) { p.y = S - M - p.r; p.vy = -p.vy * .8; }
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
              if (Math.abs(va - vb) > 1.2) G.tone(900 + Math.random() * 300, .04, "square", .02);
            }
          }
        }
        return any;
      }
      function pocket(p) {
        p.in = false; p.vx = p.vy = 0;
        if (p.col === "s") { foul = true; G.sfx.bad(); return; }
        pocketedThisShot.push(p); G.sfx.good();
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
        if (queenPending === me && !own && !q) { var qp = pieces.filter(function (p) { return p.col === "q"; })[0]; qp.in = true; qp.x = S / 2; qp.y = S / 2; qp.vx = qp.vy = 0; queenPending = null; say((me === "w" ? "You" : "Computer") + " could not cover the queen. She returns to the centre."); }
        var keep = own > 0 || q;
        if (foul) { keep = false; if (returnCoin(me)) { score[me] = Math.max(0, score[me] - 1); say((me === "w" ? "You" : "Computer") + " pocketed the striker: one coin goes back."); } else say("Striker pocketed: foul."); }
        var left = { w: 0, b: 0 }; pieces.forEach(function (p) { if (p.in && p.col !== "q") left[p.col]++; });
        if (!left.w || !left.b) {
          over = true; var winner = !left.w ? "w" : "b"; if (queenPending) { var qp2 = pieces.filter(function (p) { return p.col === "q"; })[0]; qp2.in = true; qp2.x = qp2.y = S / 2; queenPending = null; }
          upd(); say("Game over."); G.sfx.win(); return setTimeout(function () { G.overlay(stage, { title: winner === "w" ? "You win! 🎉" : "Computer wins", text: "You " + score.w + " · Computer " + score.b + (queen ? " · queen: " + (queen === "w" ? "yours" : "computer") : ""), buttons: [{ label: "Play again", fn: newGame }] }); }, 300);
        }
        if (!keep) turn = me === "w" ? "b" : "w";
        striker.in = true; striker.vx = striker.vy = 0; striker.x = S / 2; striker.y = turn === "w" ? LINE : CPU_LINE; upd();
        if (turn === "b") { say("Computer is aiming…"); setTimeout(cpuShot, 900); } else say(keep ? "Nice! Shoot again." : "Your turn.");
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
      function coin(p) {
        x.fillStyle = "rgba(0,0,0,.35)"; x.beginPath(); x.arc(p.x + 2, p.y + 3, p.r, 0, 7); x.fill();
        x.fillStyle = p.col === "w" ? "#f5f0e1" : p.col === "b" ? "#1f1b16" : p.col === "q" ? "#dc2626" : "#c7d2fe"; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill();
        x.strokeStyle = p.col === "w" ? "#a89f86" : p.col === "b" ? "#000" : p.col === "q" ? "#7f1d1d" : "#4f46e5"; x.lineWidth = 2; x.stroke(); x.lineWidth = 1;
        x.strokeStyle = "rgba(0,0,0,.25)"; x.beginPath(); x.arc(p.x, p.y, p.r * .55, 0, 7); x.stroke();
      }
      function draw() {
        x.fillStyle = "#3f2a14"; x.fillRect(0, 0, S, S);
        x.fillStyle = "#e9d8a6"; x.fillRect(M, M, IN, IN);
        x.strokeStyle = "#7c2d12"; x.lineWidth = 2;
        [LINE, CPU_LINE].forEach(function (ly) { x.beginPath(); x.moveTo(M + 60, ly - 12); x.lineTo(S - M - 60, ly - 12); x.moveTo(M + 60, ly + 12); x.lineTo(S - M - 60, ly + 12); x.stroke(); [M + 60, S - M - 60].forEach(function (lx) { x.beginPath(); x.arc(lx, ly, 12, 0, 7); x.stroke(); }); });
        [M + 60, S - M - 60].forEach(function (lx) { x.beginPath(); x.moveTo(lx - 12, M + 70); x.lineTo(lx - 12, S - M - 70); x.moveTo(lx + 12, M + 70); x.lineTo(lx + 12, S - M - 70); x.stroke(); [M + 60, S - M - 60].forEach(function (ly) { x.beginPath(); x.arc(lx, ly, 12, 0, 7); x.stroke(); }); });
        x.beginPath(); x.arc(S / 2, S / 2, 60, 0, 7); x.stroke(); x.beginPath(); x.arc(S / 2, S / 2, 14, 0, 7); x.fillStyle = "#7c2d12"; x.fill(); x.lineWidth = 1;
        POCKETS.forEach(function (p) { x.fillStyle = "#1c1917"; x.beginPath(); x.arc(p[0], p[1], PR, 0, 7); x.fill(); });
        pieces.forEach(function (p) { if (p.in) coin(p); });
        if (striker.in) coin(striker);
        if (drag && drag.aim) {
          var dx = striker.x - drag.x, dy = striker.y - drag.y, L = Math.min(150, Math.sqrt(dx * dx + dy * dy));
          if (L > 8) { var a = Math.atan2(dy, dx); x.strokeStyle = "rgba(255,255,255,.7)"; x.setLineDash([6, 6]); x.lineWidth = 2; x.beginPath(); x.moveTo(striker.x, striker.y); x.lineTo(striker.x + Math.cos(a) * 260, striker.y + Math.sin(a) * 260); x.stroke(); x.setLineDash([]); x.strokeStyle = "#dc2626"; x.beginPath(); x.moveTo(striker.x, striker.y); x.lineTo(striker.x - Math.cos(a) * L, striker.y - Math.sin(a) * L); x.stroke(); x.lineWidth = 1; }
        }
        // pocketed trays
        x.font = "13px system-ui"; x.fillStyle = "#fde68a"; x.textAlign = "left"; x.textBaseline = "middle";
        var pw = pieces.filter(function (p) { return !p.in && p.col === "w"; }).length, pb = pieces.filter(function (p) { return !p.in && p.col === "b"; }).length;
        x.fillText("White out: " + pw + "   Black out: " + pb + (turn === "w" ? "   ● Your turn" : "   ● Computer"), M, S - 18);
      }
      function loop() { cancelAnimationFrame(raf); (function f() { if (moving) { var any = physics(); if (!any) endShot(); } draw(); raf = requestAnimationFrame(f); })(); }
      function pos(e) { var b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) * S / b.width, y: (e.clientY - b.top) * S / b.height }; }
      cv.addEventListener("pointerdown", function (e) {
        e.preventDefault(); if (moving || over || turn !== "w") return; var q = pos(e);
        var d = Math.sqrt(Math.pow(q.x - striker.x, 2) + Math.pow(q.y - striker.y, 2));
        if (d < SR * 2.2) drag = { aim: true, x: q.x, y: q.y }; else if (Math.abs(q.y - LINE) < 60) { striker.x = G.clamp(q.x, M + 72, S - M - 72); drag = { aim: false, x: q.x, y: q.y }; }
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
      G.seg($("#odf", r), [["easy", "Easy"], ["normal", "Normal"], ["hard", "Hard"]], diff, function (v) { diff = v; ls.set("cr_d", v); newGame(); });
      $("#nw", r).addEventListener("click", newGame); G.soundBtn($("#sn", r));
      newGame();
    }
  });
})();
