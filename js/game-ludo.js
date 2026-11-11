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

/* Ludo – 2 or 4 players, against the computer or pass-and-play. Roll a 6 to come out, safe squares, captures, exact roll to finish. */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;
  var S = 600, C = S / 15, NAMES = ["Red", "Green", "Yellow", "Blue"], COL = ["#EF4444", "#22C55E", "#FACC15", "#3B82F6"], DARK = ["#7F1D1D", "#14532D", "#713F12", "#1E3A8A"];
  // 52-cell loop starting at Red's start, clockwise. Each player's path = loop[(i + 13 * p) % 52] for i = 0..50, then 5 home cells, then centre (56).
  var LOOP = [];
  (function () {
    var i; for (i = 1; i <= 5; i++) LOOP.push([6, i]); for (i = 5; i >= 0; i--) LOOP.push([i, 6]); LOOP.push([0, 7]); for (i = 0; i <= 5; i++) LOOP.push([i, 8]);
    for (i = 9; i <= 14; i++) LOOP.push([6, i]); LOOP.push([7, 14]); for (i = 14; i >= 9; i--) LOOP.push([8, i]); for (i = 9; i <= 14; i++) LOOP.push([i, 8]);
    LOOP.push([14, 7]); for (i = 14; i >= 9; i--) LOOP.push([i, 6]); for (i = 5; i >= 0; i--) LOOP.push([8, i]); LOOP.push([7, 0]); LOOP.push([6, 0]);
  })();
  var HOME = [[[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]]];
  var BASE = [[0, 0], [0, 9], [9, 9], [9, 0]], SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
  function cellOf(p, pos) { if (pos < 0) return null; if (pos <= 50) return LOOP[(pos + 13 * p) % 52]; if (pos <= 55) return HOME[p][pos - 51]; return [7, 7]; }
  function loopIdx(p, pos) { return pos >= 0 && pos <= 50 ? (pos + 13 * p) % 52 : -1; }
  function baseSpot(p, k) { var b = BASE[p]; var off = [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]][k]; return [(b[0] + off[0] + .5) * C, (b[1] + off[1] + .5) * C]; }

  VX.tool("ludo", {
    html: '<div class="gopt"><div id="onp" role="group" aria-label="Players"></div><div id="ovs" role="group" aria-label="Opponent"></div></div>' +
      '<div class="gwrap"><div class="gstage" style="--gw:520px"><canvas class="gcanvas swipe" id="cv" width="600" height="600" style="width:100%" aria-label="Ludo board"></canvas></div>' +
      '<div class="gmsg" id="msg" aria-live="polite" style="min-height:52px;display:flex;align-items:center"></div>' +
      '<div class="gbar"><button class="btn" id="roll" type="button" style="min-width:200px">🎲 Roll</button></div>' +
      '<div class="gbar" style="margin-top:14px"><button class="btn ghost sm" id="nw" type="button">New game</button><button class="btn ghost sm" id="sn" type="button"></button></div>' +
      '<p class="gnote">Roll a 6 to bring a token out. Land on an opponent to send it home. Stars and start squares are safe. You need the exact number to reach the centre.</p></div>',
    init: function (r) {
      var cv = $("#cv", r), x = G.canvas(cv, S, S), stage = $(".gstage", r), msg = $("#msg", r), rollBtn = $("#roll", r);
      var np = ls.get("ld_np", 2), vs = ls.get("ld_vs", "cpu"), P, turn, dice, rolled, sixes, movable, busy, over, anim = null, raf;
      function active() { return np === 2 ? [0, 2] : [0, 1, 2, 3]; }
      function isCpu(p) { return vs === "cpu" && p !== 0; }
      function newGame() {
        P = [0, 1, 2, 3].map(function (p) { return { tok: [-1, -1, -1, -1], done: false }; }); turn = 0; dice = 0; rolled = false; sixes = 0; movable = []; busy = false; over = false; anim = null;
        G.closeOverlay(stage); say(NAMES[0] + ": roll the dice"); draw(); rollBtn.disabled = false;
      }
      function say(t) { msg.textContent = t; msg.style.color = COL[turn]; }
      function nextTurn(extra) {
        if (over) return;
        if (!extra) { var a = active(), i = a.indexOf(turn); do { turn = a[(i + 1) % a.length]; i = a.indexOf(turn); } while (P[turn].done); sixes = 0; }
        rolled = false; dice = 0; movable = []; draw();
        if (isCpu(turn)) { rollBtn.disabled = true; say(NAMES[turn] + " is thinking…"); setTimeout(roll, 650); }
        else { rollBtn.disabled = false; say(NAMES[turn] + ": roll the dice"); }
      }
      function canMove(p, k, d) {
        var pos = P[p].tok[k]; if (pos === 56) return false; if (pos < 0) return d === 6; return pos + d <= 56;
      }
      function roll() {
        if (rolled || busy || over) return;
        dice = 1 + G.rand(6); rolled = true; G.sfx.tap();
        if (dice === 6) sixes++; else sixes = 0;
        if (sixes === 3) { say(NAMES[turn] + " rolled three 6s, turn lost"); draw(); return setTimeout(function () { nextTurn(false); }, 900); }
        movable = []; for (var k = 0; k < 4; k++) if (canMove(turn, k, dice)) movable.push(k);
        draw();
        if (!movable.length) { say(NAMES[turn] + " rolled " + dice + ", no move"); return setTimeout(function () { nextTurn(false); }, 900); }
        if (isCpu(turn)) return setTimeout(function () { move(turn, cpuPick()); }, 550);
        say(NAMES[turn] + " rolled " + dice + (movable.length > 1 ? ", tap a token" : ""));
        if (movable.length === 1) setTimeout(function () { move(turn, movable[0]); }, 350);
      }
      function cpuPick() {
        var best = movable[0], bs = -1e9;
        movable.forEach(function (k) {
          var pos = P[turn].tok[k], to = pos < 0 ? 0 : pos + dice, sc = 0;
          if (to === 56) sc += 100; if (pos < 0) sc += 40;
          var li = loopIdx(turn, to); if (li >= 0) {
            active().forEach(function (q) { if (q === turn) return; P[q].tok.forEach(function (t) { if (loopIdx(q, t) === li && SAFE.indexOf(li) < 0) sc += 60; }); });
            if (SAFE.indexOf(li) >= 0) sc += 15;
            // danger: opponent within 1..6 behind the target square
            active().forEach(function (q) { if (q === turn) return; P[q].tok.forEach(function (t) { var qi = loopIdx(q, t); if (qi < 0) return; var d = (li - qi + 52) % 52; if (d >= 1 && d <= 6 && SAFE.indexOf(li) < 0) sc -= 25; }); });
          }
          sc += to * .5 + Math.random();
          if (sc > bs) { bs = sc; best = k; }
        });
        return best;
      }
      function move(p, k) {
        if (busy || over) return; busy = true; movable = [];
        var pos = P[p].tok[k], to = pos < 0 ? 0 : pos + dice, steps = pos < 0 ? [0] : [], i;
        for (i = pos + 1; i <= to && pos >= 0; i++) steps.push(i);
        (function stepAnim() {
          if (!steps.length) return land(p, k, to);
          P[p].tok[k] = steps.shift(); G.sfx.pop(); draw(); setTimeout(stepAnim, 110);
        })();
      }
      function land(p, k, to) {
        var extra = dice === 6, li = loopIdx(p, to), captured = false;
        if (li >= 0 && SAFE.indexOf(li) < 0) active().forEach(function (q) { if (q === p) return; P[q].tok.forEach(function (t, j) { if (loopIdx(q, t) === li) { P[q].tok[j] = -1; captured = true; } }); });
        if (captured) { extra = true; G.sfx.bad(); say(NAMES[p] + " captured a token!"); }
        if (to === 56) { extra = true; G.sfx.good(); if (P[p].tok.every(function (t) { return t === 56; })) { P[p].done = true; } }
        busy = false; draw();
        if (P[p].done) {
          over = true; G.sfx.win(); rollBtn.disabled = true;
          var you = vs === "cpu" && p === 0;
          return setTimeout(function () { G.overlay(stage, { title: (you ? "You win! 🎉" : NAMES[p] + " wins!"), text: vs === "cpu" ? (you ? "All four tokens are home." : "The computer got all four tokens home first.") : "All four " + NAMES[p].toLowerCase() + " tokens reached the centre.", buttons: [{ label: "Play again", fn: newGame }] }); }, 400);
        }
        setTimeout(function () { nextTurn(extra); }, captured ? 700 : 250);
      }
      /* ---------- drawing ---------- */
      function sq(rr, cc, col) { x.fillStyle = col; x.fillRect(cc * C, rr * C, C, C); x.strokeStyle = "rgba(0,0,0,.25)"; x.strokeRect(cc * C + .5, rr * C + .5, C - 1, C - 1); }
      function star(cx, cy, rad) { x.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? rad * .45 : rad; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); }
      function draw() {
        x.fillStyle = "#fdf6e3"; x.fillRect(0, 0, S, S);
        for (var rr = 0; rr < 15; rr++) for (var cc = 0; cc < 15; cc++) if ((rr >= 6 && rr <= 8) || (cc >= 6 && cc <= 8)) sq(rr, cc, "#fff");
        [0, 1, 2, 3].forEach(function (p) {
          var b = BASE[p], on = active().indexOf(p) >= 0;
          x.fillStyle = on ? COL[p] : "#d6d3d1"; x.fillRect(b[1] * C, b[0] * C, 6 * C, 6 * C);
          x.fillStyle = "#fdf6e3"; x.fillRect((b[1] + 1) * C, (b[0] + 1) * C, 4 * C, 4 * C);
          HOME[p].forEach(function (c) { sq(c[0], c[1], on ? COL[p] : "#d6d3d1"); });
          var st = LOOP[13 * p]; sq(st[0], st[1], on ? COL[p] : "#d6d3d1");
          for (var k = 0; k < 4; k++) { var s = baseSpot(p, k); x.fillStyle = "rgba(0,0,0,.08)"; x.beginPath(); x.arc(s[1], s[0], C * .42, 0, 7); x.fill(); }
        });
        // centre triangles
        var m = 7.5 * C; [[6, 6, 6, 9, 1], [6, 9, 9, 9, 2], [9, 9, 9, 6, 3], [9, 6, 6, 6, 0]].forEach(function (t) { x.fillStyle = COL[t[4]]; x.beginPath(); x.moveTo(t[1] * C, t[0] * C); x.lineTo(t[3] * C, t[2] * C); x.lineTo(m, m); x.closePath(); x.fill(); });
        SAFE.forEach(function (i) { if (i % 13 === 0) return; var c = LOOP[i]; x.fillStyle = "#78716c"; star(c[1] * C + C / 2, c[0] * C + C / 2, C * .36); x.fill(); });
        // tokens
        var at = {};
        active().forEach(function (p) { P[p].tok.forEach(function (t, k) { var key, pt; if (t === 56) { var hp = [[7.5, 6.35], [6.35, 7.5], [7.5, 8.65], [8.65, 7.5]][p], along = (k - 1.5) * .32; pt = p % 2 ? [hp[0] * C, (hp[1] + along) * C] : [(hp[0] + along) * C, hp[1] * C]; x.fillStyle = "#fff"; x.beginPath(); x.arc(pt[1], pt[0], C * .16, 0, 7); x.fill(); x.lineWidth = 3; x.strokeStyle = DARK[p]; x.stroke(); x.lineWidth = 1; return; } if (t < 0) { pt = baseSpot(p, k); key = "b" + p + k; } else { var c = cellOf(p, t); key = c[0] + "," + c[1]; pt = [c[0] * C + C / 2, c[1] * C + C / 2]; } (at[key] = at[key] || { pt: pt, list: [] }).list.push([p, k]); }); });
        Object.keys(at).forEach(function (key) {
          var e = at[key], n = e.list.length;
          e.list.forEach(function (tk, i) {
            var p = tk[0], k = tk[1], off = n > 1 ? [(i % 2) * 2 - 1, (i < 2 ? -1 : 1)] : [0, 0], rad = n > 1 ? C * .28 : C * .4, cx = e.pt[1] + off[0] * C * .2, cy = e.pt[0] + off[1] * C * .2;
            var hot = !busy && p === turn && movable.indexOf(k) >= 0 && !isCpu(turn);
            x.fillStyle = "rgba(0,0,0,.3)"; x.beginPath(); x.arc(cx + 2, cy + 3, rad, 0, 7); x.fill();
            x.fillStyle = COL[p]; x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.fill();
            x.lineWidth = hot ? 4 : 2; x.strokeStyle = hot ? "#fff" : DARK[p]; x.stroke(); x.lineWidth = 1;
            x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.arc(cx - rad * .3, cy - rad * .3, rad * .3, 0, 7); x.fill();
            if (hot) { x.strokeStyle = "#fff"; x.setLineDash([3, 4]); x.beginPath(); x.arc(cx, cy, rad + 5, 0, 7); x.stroke(); x.setLineDash([]); }
          });
        });
        // dice
        var D = 1.5 * C, dx = 7.5 * C - D / 2, dy = 7.5 * C - D / 2;
        x.fillStyle = "#fff"; x.strokeStyle = COL[turn]; x.lineWidth = 4; x.beginPath(); x.roundRect ? x.roundRect(dx, dy, D, D, 10) : x.rect(dx, dy, D, D); x.fill(); x.stroke(); x.lineWidth = 1;
        if (dice) { var pips = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [0, 2], [2, 0], [2, 2]], 5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]], 6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]] }[dice]; x.fillStyle = "#1c1917"; pips.forEach(function (q) { x.beginPath(); x.arc(dx + D * .25 + q[0] * D * .25, dy + D * .25 + q[1] * D * .25, D * .09, 0, 7); x.fill(); }); }
        else { x.fillStyle = COL[turn]; x.font = "bold " + D * .55 + "px system-ui"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("?", dx + D / 2, dy + D / 2 + 2); }
      }
      cv.addEventListener("pointerdown", function (e) {
        e.preventDefault(); if (busy || over || isCpu(turn)) return;
        var b = cv.getBoundingClientRect(), px = (e.clientX - b.left) * S / b.width, py = (e.clientY - b.top) * S / b.height;
        if (!rolled) { return roll(); }
        var best = -1, bd = 1e9;
        movable.forEach(function (k) { var t = P[turn].tok[k], pt = t < 0 ? baseSpot(turn, k) : (function () { var c = cellOf(turn, t); return [c[0] * C + C / 2, c[1] * C + C / 2]; })(); var d = Math.pow(pt[1] - px, 2) + Math.pow(pt[0] - py, 2); if (d < bd) { bd = d; best = k; } });
        if (best >= 0 && bd < Math.pow(C * 1.2, 2)) move(turn, best);
      });
      rollBtn.addEventListener("click", roll);
      G.keys(function (e) { if (e.key === " " || e.key === "Enter") { if (!isCpu(turn)) { roll(); e.preventDefault(); } } });
      G.seg($("#onp", r), [[2, "2 players"], [4, "4 players"]], np, function (v) { np = v; ls.set("ld_np", v); newGame(); });
      G.seg($("#ovs", r), [["cpu", "vs Computer"], ["pass", "With friends"]], vs, function (v) { vs = v; ls.set("ld_vs", v); newGame(); });
      $("#nw", r).addEventListener("click", newGame); G.soundBtn($("#sn", r));
      newGame();
    }
  });
})();
