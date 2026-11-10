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

/* Tic Tac Toe – 3×3, 4×4, 5×5; Easy / Medium / Hard computer (alpha-beta search) or a friend */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G;

  VX.tool("tic-tac-toe", {
    html: '<div class="gopt"><div id="ob" role="group" aria-label="Board"></div><div id="oo" role="group" aria-label="Opponent"></div><div id="ol" role="group" aria-label="Level"></div><div id="of" role="group" aria-label="Who starts"></div></div>' +
      G.hud([["a", "You (X)", 0], ["d", "Draws", 0], ["b", "Computer (O)", 0]]) +
      '<div class="gwrap"><div class="gstage" style="--gw:440px"><div class="ttt" id="bd"></div></div><p class="gnote" id="msg" aria-live="polite"></p><div class="gbar"><button class="btn sm" id="nw" type="button">New round</button><button class="btn ghost sm" id="sn" type="button"></button></div></div>',
    init: function (r) {
      var n = 3, vs = "cpu", lvl = "hard", first = "you", b, over, turn, lines, k, sc = { a: 0, d: 0, b: 0 }, busy = false, cells;
      var HUM = "X", AI = "O";
      function mkLines() {
        k = n === 3 ? 3 : 4; lines = [];
        var D = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) D.forEach(function (d) {
          var ex = x + d[0] * (k - 1), ey = y + d[1] * (k - 1); if (ex < 0 || ey < 0 || ex >= n || ey >= n) return;
          var L = []; for (var i = 0; i < k; i++) L.push((y + d[1] * i) * n + x + d[0] * i); lines.push(L);
        });
      }
      function winner(bd) {
        for (var i = 0; i < lines.length; i++) { var L = lines[i], v = bd[L[0]]; if (v && L.every(function (z) { return bd[z] === v; })) return { s: v, L: L }; }
        return null;
      }
      var W = [0, 1, 12, 150, 20000];
      function evalB(bd) {
        var s = 0;
        for (var i = 0; i < lines.length; i++) {
          var L = lines[i], x = 0, o = 0; for (var j = 0; j < L.length; j++) { var v = bd[L[j]]; if (v === HUM) x++; else if (v === AI) o++; }
          if (x && o) continue; if (o) s += W[o]; else if (x) s -= W[x] * 1.15;
        }
        return s;
      }
      function cands(bd) {
        var e = [], any = false; for (var i = 0; i < bd.length; i++) if (bd[i]) any = true;
        var c = (n - 1) / 2;
        for (i = 0; i < bd.length; i++) {
          if (bd[i]) continue;
          if (n > 3 && any) { var y = Math.floor(i / n), x = i % n, near = false; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var yy = y + dy, xx = x + dx; if (yy >= 0 && xx >= 0 && yy < n && xx < n && bd[yy * n + xx]) near = true; } if (!near) continue; }
          e.push(i);
        }
        e.sort(function (a, z) { return (Math.abs(Math.floor(a / n) - c) + Math.abs(a % n - c)) - (Math.abs(Math.floor(z / n) - c) + Math.abs(z % n - c)); });
        return e;
      }
      function search(bd, depth, al, be, maxi) {
        var w = winner(bd); if (w) return w.s === AI ? 100000 + depth : -100000 - depth;
        var cs = cands(bd); if (!cs.length) return 0; if (depth === 0) return evalB(bd);
        var best = maxi ? -Infinity : Infinity;
        for (var i = 0; i < cs.length; i++) {
          bd[cs[i]] = maxi ? AI : HUM; var v = search(bd, depth - 1, al, be, !maxi); bd[cs[i]] = "";
          if (maxi) { if (v > best) best = v; if (best > al) al = best; } else { if (v < best) best = v; if (best < be) be = best; }
          if (be <= al) break;
        }
        return best;
      }
      function pickAI() {
        var cs = cands(b), i;
        if (lvl === "easy") {
          for (i = 0; i < cs.length; i++) { b[cs[i]] = AI; var w = winner(b); b[cs[i]] = ""; if (w && Math.random() < .5) return cs[i]; }
          return cs[G.rand(cs.length)];
        }
        var depth = lvl === "hard" ? (n === 3 ? 9 : n === 4 ? 4 : 3) : (n === 3 ? 2 : 1);
        if (lvl === "medium" && n === 3 && Math.random() < .3) return cs[G.rand(cs.length)];
        var best = -Infinity, pool = [];
        cs.forEach(function (c) { b[c] = AI; var v = search(b, depth - 1, -Infinity, Infinity, false); b[c] = ""; if (v > best) { best = v; pool = [c]; } else if (v === best) pool.push(c); });
        return pool[G.rand(pool.length)];
      }
      function paint() {
        cells.forEach(function (c, i) { c.textContent = b[i]; c.className = "cell" + (b[i] ? " p" + b[i] : ""); c.setAttribute("aria-label", "Square " + (Math.floor(i / n) + 1) + "," + (i % n + 1) + (b[i] ? ", " + b[i] : ", empty")); });
      }
      function labels() {
        $("#a", r).parentNode.querySelector("span").textContent = vs === "cpu" ? "You (X)" : "Player X";
        $("#b", r).parentNode.querySelector("span").textContent = vs === "cpu" ? "Computer (O)" : "Player O";
        G.set(r, "a", sc.a); G.set(r, "d", sc.d); G.set(r, "b", sc.b);
      }
      function say(t) { $("#msg", r).textContent = t; }
      function finish() {
        var w = winner(b); if (!w && b.some(function (v) { return !v; })) return false;
        over = true;
        if (w) { w.L.forEach(function (i) { cells[i].classList.add("win"); }); if (w.s === HUM) { sc.a++; say(vs === "cpu" ? "You win! 🎉" : "X wins!"); G.sfx.win(); } else { sc.b++; say(vs === "cpu" ? "Computer wins. Try again!" : "O wins!"); vs === "cpu" ? G.sfx.lose() : G.sfx.win(); } }
        else { sc.d++; say("It's a draw."); G.sfx.tap(); }
        labels(); return true;
      }
      function aiMove() {
        busy = true; say("Computer is thinking…");
        setTimeout(function () { var m = pickAI(); b[m] = AI; turn = HUM; G.sfx.tap(); paint(); busy = false; if (!finish()) say("Your turn."); }, 260);
      }
      function click(i) {
        if (over || busy || b[i]) return;
        if (vs === "cpu") { b[i] = HUM; G.sfx.pop(); paint(); if (!finish()) aiMove(); }
        else { b[i] = turn; turn === "X" ? G.sfx.pop() : G.sfx.tap(); turn = turn === "X" ? "O" : "X"; paint(); if (!finish()) say(turn + "'s turn."); }
      }
      function round() {
        mkLines(); b = new Array(n * n).fill(""); over = false; busy = false; turn = "X";
        var bd = $("#bd", r); bd.style.gridTemplateColumns = "repeat(" + n + ",1fr)"; bd.style.fontSize = n === 3 ? "clamp(34px,11vw,64px)" : n === 4 ? "clamp(28px,9vw,50px)" : "clamp(22px,7vw,40px)"; bd.innerHTML = "";
        cells = []; for (var i = 0; i < n * n; i++) (function (i) { var c = document.createElement("button"); c.type = "button"; c.className = "cell"; c.addEventListener("click", function () { click(i); }); bd.appendChild(c); cells.push(c); })(i);
        paint(); labels();
        if (vs === "cpu" && first === "cpu") { say("Computer starts…"); aiMove(); } else say(vs === "cpu" ? "Your turn – you are X. " + (n > 3 ? "Get " + k + " in a row." : "Get 3 in a row.") : "X starts. Get " + k + " in a row.");
      }
      function reset() { sc = { a: 0, d: 0, b: 0 }; round(); }
      G.seg($("#ob", r), [[3, "3×3"], [4, "4×4"], [5, "5×5"]], n, function (v) { n = v; reset(); });
      G.seg($("#oo", r), [["cpu", "vs Computer"], ["friend", "2 Players"]], vs, function (v) { vs = v; $("#ol", r).hidden = $("#of", r).hidden = v !== "cpu"; reset(); });
      G.seg($("#ol", r), [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]], lvl, function (v) { lvl = v; reset(); });
      G.seg($("#of", r), [["you", "I start"], ["cpu", "Computer starts"]], first, function (v) { first = v; reset(); });
      $("#nw", r).addEventListener("click", round); G.soundBtn($("#sn", r));
      reset();
    }
  });
})();
