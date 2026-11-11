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

/* Bubble Shooter – aim, shoot, match 3 or more of a colour. Floating groups fall. New rows push down as you play. */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;
  var W = 440, H = 600, COLS = 11, R = W / COLS / 2, RH = R * 1.732, MAXROWS = Math.floor((H - 90) / RH);
  var PAL = ["#F43F5E", "#3B82F6", "#FACC15", "#22C55E", "#A855F7", "#FB923C"], SHOOT_Y = H - 46, SPEED = 14;

  VX.tool("bubble-shooter", {
    html: '<div class="gopt"><div id="odf" role="group" aria-label="Difficulty"></div></div>' +
      G.hud([["sc", "Score", 0], ["lv", "Level", 1], ["bs", "Best", 0]]) +
      '<div class="gwrap"><div class="gstage" style="--gw:440px"><canvas class="gcanvas swipe" id="cv" width="440" height="600" style="width:100%" aria-label="Bubble shooter board"></canvas></div>' +
      '<div class="gbar"><button class="btn sm" id="nw" type="button">New game</button><button class="btn ghost sm" id="sn" type="button"></button></div>' +
      '<p class="gnote" id="msg" aria-live="polite">Move your finger or mouse to aim, release or click to shoot. Match 3 of the same colour to pop them. Clear the board to finish the level.</p></div>',
    init: function (r) {
      var cv = $("#cv", r), x = G.canvas(cv, W, H), stage = $(".gstage", r);
      var par = 0, diff = ls.get("bb_d", "normal"), grid, cur, next, shot, score, level, shots, over, aim = -Math.PI / 2, raf, pops = [], falls = [], nc;
      function ncol() { return diff === "easy" ? 4 : diff === "hard" ? 6 : 5; }
      function startRows() { return diff === "easy" ? 4 : diff === "hard" ? 7 : 5; }
      function shotsPerRow() { return diff === "easy" ? 8 : diff === "hard" ? 5 : 6; }
      function odd(row) { return (row + par) % 2; }
      function rowCols(row) { return odd(row) ? COLS - 1 : COLS; }
      function cx(row, col) { return R + col * 2 * R + (odd(row) ? R : 0); }
      function cy(row) { return R + row * RH; }
      function onBoard() { var s = {}; grid.forEach(function (row) { row.forEach(function (c) { if (c) s[c] = 1; }); }); return Object.keys(s); }
      function pick() { var on = onBoard(); return on.length ? on[G.rand(on.length)] : PAL[G.rand(nc)]; }
      function newRow() { var n = []; for (var c = 0; c < COLS; c++) n.push(PAL[G.rand(nc)]); return n; }
      function newGame() {
        nc = ncol(); par = 0; grid = []; for (var i = 0; i < startRows(); i++) { var row = newRow(); row.length = rowCols(i); grid.push(row); }
        while (grid.length < MAXROWS + 2) grid.push(new Array(rowCols(grid.length)).fill(0));
        score = 0; level = 1; shots = 0; over = false; shot = null; cur = pick(); next = pick(); G.closeOverlay(stage); upd(); loop();
        $("#msg", r).textContent = "Move your finger or mouse to aim, release or click to shoot. Match 3 of the same colour to pop them. Clear the board to finish the level.";
      }
      function upd() { G.set(r, "sc", score); G.set(r, "lv", level); G.set(r, "bs", ls.get("bb_best", 0)); }
      function nbrs(row, col) {
        var o = odd(row) ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]], out = [];
        o.forEach(function (d) { var rr = row + d[0], cc = col + d[1]; if (rr >= 0 && rr < grid.length && cc >= 0 && cc < rowCols(rr)) out.push([rr, cc]); }); return out;
      }
      function cluster(row, col, same) {
        var col0 = grid[row][col], seen = {}, st = [[row, col]], out = [];
        while (st.length) { var p = st.pop(), k = p[0] + "," + p[1]; if (seen[k]) continue; seen[k] = 1; var v = grid[p[0]][p[1]]; if (!v || (same && v !== col0)) continue; out.push(p); nbrs(p[0], p[1]).forEach(function (q) { if (!seen[q[0] + "," + q[1]]) st.push(q); }); }
        return out;
      }
      function dropFloating() {
        var keep = {}, st = [];
        for (var c = 0; c < COLS; c++) if (grid[0][c]) st.push([0, c]);
        while (st.length) { var p = st.pop(), k = p[0] + "," + p[1]; if (keep[k]) continue; keep[k] = 1; nbrs(p[0], p[1]).forEach(function (q) { if (grid[q[0]][q[1]] && !keep[q[0] + "," + q[1]]) st.push(q); }); }
        var n = 0;
        grid.forEach(function (row, rr) { row.forEach(function (v, cc) { if (v && !keep[rr + "," + cc]) { falls.push({ x: cx(rr, cc), y: cy(rr), c: v, vy: 0 }); grid[rr][cc] = 0; n++; } }); });
        return n;
      }
      function place(row, col, c) {
        grid[row][col] = c; var cl = cluster(row, col, true);
        if (cl.length >= 3) {
          cl.forEach(function (p) { pops.push({ x: cx(p[0], p[1]), y: cy(p[0]), c: grid[p[0]][p[1]], t: 1 }); grid[p[0]][p[1]] = 0; });
          var fl = dropFloating(); score += cl.length * 10 + fl * 20; G.sfx.good();
        } else { G.sfx.tap(); }
        shots++;
        if (shots % shotsPerRow() === 0) pushRow();
        if (score > ls.get("bb_best", 0)) ls.set("bb_best", score); upd();
        if (!onBoard().length) { level++; score += 100; G.sfx.win(); nc = Math.min(6, ncol() + Math.floor(level / 2)); for (var i = 0; i < startRows(); i++) { var nr = newRow(); nr.length = rowCols(i); grid[i] = nr; } for (var j = startRows(); j < grid.length; j++) grid[j] = new Array(rowCols(j)).fill(0); upd(); $("#msg", r).textContent = "Level " + level + "! The board has been refilled."; }
        else if (lowest() >= MAXROWS) { over = true; G.sfx.lose(); setTimeout(function () { G.overlay(stage, { title: "Game over", text: "Score <b>" + score + "</b> · level " + level, buttons: [{ label: "Play again", fn: newGame }] }); }, 250); }
        cur = next; next = pick();
      }
      function pushRow() {
        par ^= 1; var nr = newRow(); nr.length = rowCols(0); grid.unshift(nr); grid.pop(); G.sfx.pop();
      }
      function lowest() { for (var rr = grid.length - 1; rr >= 0; rr--) for (var c = 0; c < grid[rr].length; c++) if (grid[rr][c]) return rr; return -1; }
      function snap(px, py) {
        var row = G.clamp(Math.round((py - R) / RH), 0, grid.length - 1), col = G.clamp(Math.round((px - R - (odd(row) ? R : 0)) / (2 * R)), 0, rowCols(row) - 1);
        if (grid[row][col]) { var best = null, bd = 1e9; nbrs(row, col).forEach(function (q) { if (!grid[q[0]][q[1]]) { var d = Math.pow(cx(q[0], q[1]) - px, 2) + Math.pow(cy(q[0]) - py, 2); if (d < bd) { bd = d; best = q; } } }); if (best) { row = best[0]; col = best[1]; } }
        return [row, col];
      }
      function step() {
        if (!shot) return;
        for (var k = 0; k < 2; k++) {
          shot.x += shot.vx; shot.y += shot.vy;
          if (shot.x < R) { shot.x = R; shot.vx = -shot.vx; } if (shot.x > W - R) { shot.x = W - R; shot.vx = -shot.vx; }
          var hit = shot.y <= R;
          if (!hit) { var row = Math.round((shot.y - R) / RH); for (var rr = Math.max(0, row - 1); rr <= Math.min(grid.length - 1, row + 1) && !hit; rr++) for (var c = 0; c < grid[rr].length; c++) if (grid[rr][c] && Math.pow(cx(rr, c) - shot.x, 2) + Math.pow(cy(rr) - shot.y, 2) < Math.pow(2 * R * .92, 2)) { hit = true; break; } }
          if (hit) { var s = snap(shot.x, shot.y), col = shot.c; shot = null; place(s[0], s[1], col); return; }
        }
      }
      function ball(bx, by, c, rad) {
        x.fillStyle = c; x.beginPath(); x.arc(bx, by, rad || R - 1.5, 0, 7); x.fill();
        x.fillStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.arc(bx - R * .3, by - R * .3, (rad || R) * .32, 0, 7); x.fill();
      }
      function draw() {
        x.fillStyle = "#0A0818"; x.fillRect(0, 0, W, H);
        x.strokeStyle = "rgba(255,255,255,.12)"; x.setLineDash([6, 8]); x.beginPath(); x.moveTo(0, cy(MAXROWS) - R); x.lineTo(W, cy(MAXROWS) - R); x.stroke(); x.setLineDash([]);
        grid.forEach(function (row, rr) { row.forEach(function (c, cc) { if (c) ball(cx(rr, cc), cy(rr), c); }); });
        pops = pops.filter(function (p) { p.t -= .08; x.globalAlpha = Math.max(0, p.t); ball(p.x, p.y, p.c, R * (1 + (1 - p.t) * .6)); x.globalAlpha = 1; return p.t > 0; });
        falls = falls.filter(function (f) { f.vy += .6; f.y += f.vy; ball(f.x, f.y, f.c); return f.y < H + R; });
        if (!shot && !over) { x.strokeStyle = "rgba(255,255,255,.25)"; x.setLineDash([4, 10]); x.beginPath(); x.moveTo(W / 2, SHOOT_Y); x.lineTo(W / 2 + Math.cos(aim) * 150, SHOOT_Y + Math.sin(aim) * 150); x.stroke(); x.setLineDash([]); }
        x.fillStyle = "#1b1540"; x.beginPath(); x.arc(W / 2, SHOOT_Y, R + 8, 0, 7); x.fill();
        if (shot) ball(shot.x, shot.y, shot.c); else ball(W / 2, SHOOT_Y, cur);
        ball(W / 2 + 60, SHOOT_Y + 4, next, R * .6); x.fillStyle = "rgba(255,255,255,.55)"; x.font = "12px system-ui"; x.textAlign = "left"; x.fillText("next", W / 2 + 78, SHOOT_Y + 8);
      }
      function loop() { cancelAnimationFrame(raf); (function f() { step(); draw(); if (!over || pops.length || falls.length) raf = requestAnimationFrame(f); })(); }
      function setAim(e) { var b = cv.getBoundingClientRect(), px = (e.clientX - b.left) * W / b.width, py = (e.clientY - b.top) * H / b.height; var a = Math.atan2(py - SHOOT_Y, px - W / 2); aim = G.clamp(a, -Math.PI + .18, -.18); }
      function fire() { if (shot || over) return; shot = { x: W / 2, y: SHOOT_Y, vx: Math.cos(aim) * SPEED, vy: Math.sin(aim) * SPEED, c: cur }; G.sfx.pop(); }
      var down = false;
      cv.addEventListener("pointerdown", function (e) { down = true; setAim(e); e.preventDefault(); });
      cv.addEventListener("pointermove", function (e) { if (down || e.pointerType === "mouse") setAim(e); });
      cv.addEventListener("pointerup", function (e) { if (!down) return; down = false; setAim(e); fire(); });
      cv.addEventListener("pointercancel", function () { down = false; });
      G.keys(function (e) { if (e.key === "ArrowLeft") { aim = Math.max(-Math.PI + .18, aim - .05); e.preventDefault(); } else if (e.key === "ArrowRight") { aim = Math.min(-.18, aim + .05); e.preventDefault(); } else if (e.key === " " || e.key === "ArrowUp") { fire(); e.preventDefault(); } });
      G.seg($("#odf", r), [["easy", "Easy"], ["normal", "Normal"], ["hard", "Hard"]], diff, function (v) { diff = v; ls.set("bb_d", v); newGame(); });
      $("#nw", r).addEventListener("click", newGame); G.soundBtn($("#sn", r));
      newGame();
    }
  });
})();
