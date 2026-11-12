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

/* Bubble Shooter – the classic: aim, bounce off the walls, match 3 or more of a colour to pop them.
   Bubbles left hanging fall. Every few shots that pop nothing, a new row slides in from the top. */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;
  var W = 440, H = 660, COLS = 11, R = W / COLS / 2, RH = R * Math.sqrt(3), SHOOT_Y = H - 52, DEAD = H - 120, SPEED = 1150;
  var PAL = [["#FB7185", "#E11D48", "#881337"], ["#60A5FA", "#2563EB", "#1E3A8A"], ["#FDE047", "#EAB308", "#854D0E"], ["#4ADE80", "#16A34A", "#14532D"], ["#C084FC", "#9333EA", "#581C87"], ["#FDBA74", "#F97316", "#7C2D12"]];

  VX.tool("bubble-shooter", {
    html: '<div class="gopt"><div id="odf" role="group" aria-label="Difficulty"></div></div>' +
      G.hud([["sc", "Score", 0], ["lv", "Level", 1], ["bs", "Best", 0]]) +
      '<div class="gwrap"><div class="gstage" style="--gw:440px"><canvas class="gcanvas swipe" id="cv" width="440" height="660" style="width:100%" aria-label="Bubble shooter board"></canvas></div>' +
      '<div class="gbar"><button class="btn sm" id="sw" type="button">⇄ Swap</button><button class="btn ghost sm" id="nw" type="button">New game</button><button class="btn ghost sm" id="sn" type="button"></button></div>' +
      '<p class="gnote" id="msg" aria-live="polite">Drag to aim (the green dots show the path), release to shoot. Bounce off the walls to reach tricky spots. Pop 3 or more of the same colour; bubbles left hanging drop for bonus points. Tap the shooter or Swap to change bubbles.</p></div>',
    init: function (r) {
      var cv = $("#cv", r), x = G.canvas(cv, W, H), stage = $(".gstage", r), fx = G.fx(stage);
      var diff = ls.get("bb_d", "normal"), grid, par, cur, next, shot, score, level, misses, over, aim = -Math.PI / 2, aiming = false, raf, last = 0, pops = [], falls = [], yOff = 0, nc, bg = null;
      var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      function ncol() { return Math.min(6, (diff === "easy" ? 4 : diff === "hard" ? 6 : 5) + (level > 3 ? 1 : 0)); }
      function startRows() { return Math.min(10, (diff === "easy" ? 5 : diff === "hard" ? 8 : 6) + Math.floor((level - 1) / 2)); }
      function missLimit() { return diff === "easy" ? 7 : diff === "hard" ? 4 : 5; }
      function odd(row) { return (row + par) % 2 === 1; }
      function rowCols(row) { return odd(row) ? COLS - 1 : COLS; }
      function cx(row, col) { return R + col * 2 * R + (odd(row) ? R : 0); }
      function cy(row) { return R + 6 + row * RH + yOff; }
      function present() { var s = {}; grid.forEach(function (row) { row.forEach(function (c) { if (c >= 0) s[c] = 1; }); }); return Object.keys(s).map(Number); }
      function pick() { var on = present(); return on.length ? on[G.rand(on.length)] : G.rand(nc); }
      function emptyRow(i) { var a = []; for (var c = 0; c < rowCols(i); c++) a.push(-1); return a; }
      function fullRow(i) { var a = []; for (var c = 0; c < rowCols(i); c++) a.push(G.rand(nc)); return a; }
      function ensureRows() { var need = Math.ceil((H - 40) / RH) + 2; while (grid.length < need) grid.push(emptyRow(grid.length)); }
      function setupLevel() {
        nc = ncol(); par = 0; grid = []; yOff = 0; misses = 0;
        for (var i = 0; i < startRows(); i++) grid.push(fullRow(i));
        // pairs of same colours make early matches likelier, like the classic boards
        for (var k = 0; k < grid.length * 3; k++) { var rr = G.rand(grid.length), cc = G.rand(grid[rr].length - 1); grid[rr][cc + 1] = grid[rr][cc]; }
        ensureRows(); cur = pick(); next = pick();
      }
      function newGame() { score = 0; level = 1; over = false; shot = null; pops = []; falls = []; setupLevel(); G.closeOverlay(stage); upd(); loop(); }
      function upd() { G.set(r, "sc", score); G.set(r, "lv", level); G.set(r, "bs", ls.get("bb_best", 0)); }
      function nbrs(row, col) {
        var o = odd(row) ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]], out = [];
        o.forEach(function (d) { var rr = row + d[0], cc = col + d[1]; if (rr >= 0 && rr < grid.length && cc >= 0 && cc < rowCols(rr)) out.push([rr, cc]); }); return out;
      }
      function cluster(row, col) {
        var c0 = grid[row][col], seen = {}, st = [[row, col]], out = [];
        while (st.length) { var p = st.pop(), k = p[0] + "," + p[1]; if (seen[k]) continue; seen[k] = 1; if (grid[p[0]][p[1]] !== c0) continue; out.push(p); nbrs(p[0], p[1]).forEach(function (q) { st.push(q); }); }
        return out;
      }
      function dropFloating() {
        var keep = {}, st = [];
        for (var c = 0; c < grid[0].length; c++) if (grid[0][c] >= 0) st.push([0, c]);
        while (st.length) { var p = st.pop(), k = p[0] + "," + p[1]; if (keep[k]) continue; keep[k] = 1; nbrs(p[0], p[1]).forEach(function (q) { if (grid[q[0]][q[1]] >= 0 && !keep[q[0] + "," + q[1]]) st.push(q); }); }
        var n = 0;
        grid.forEach(function (row, rr) { row.forEach(function (v, cc) { if (v >= 0 && !keep[rr + "," + cc]) { falls.push({ x: cx(rr, cc), y: cy(rr), c: v, vx: (Math.random() - .5) * 120, vy: -60 - Math.random() * 120 }); grid[rr][cc] = -1; n++; } }); });
        return n;
      }
      function place(row, col, c) {
        grid[row][col] = c; ensureRows();
        var cl = cluster(row, col);
        if (cl.length >= 3) {
          cl.forEach(function (p, i) { pops.push({ x: cx(p[0], p[1]), y: cy(p[0]), c: grid[p[0]][p[1]], t: -i * .03 }); grid[p[0]][p[1]] = -1; });
          var fl = dropFloating(), pts = cl.length * 10 + fl * 20 + (cl.length > 4 ? 30 : 0);
          score += pts; misses = 0; G.sfx.good(); if (fl) { setTimeout(G.sfx.coin, 150); G.buzz(30); }
          fx.burst(cx(row, col) / W, cy(row) / H, [PAL[c][0], "#fff", PAL[c][1]], 14 + cl.length * 3, 5);
          fx.text(cx(row, col) / W, cy(row) / H, "+" + pts, fl ? "#FDE047" : "#fff", fl ? 32 : 24);
        } else {
          G.sfx.knock(2); misses++;
          if (misses >= missLimit()) { misses = 0; setTimeout(addRow, 120); }
        }
        if (score > ls.get("bb_best", 0)) ls.set("bb_best", score); upd();
        if (!present().length) {
          level++; score += 250; G.sfx.win(); fx.confetti(); fx.text(.5, .4, "Level " + level + "!", "#FDE047", 40); upd();
          setTimeout(function () { setupLevel(); }, 700);
        }
        cur = next; next = pick(); if (present().indexOf(cur) < 0 && present().length) cur = pick();
        setTimeout(checkDead, 260);
      }
      function addRow() {
        if (over) return; par ^= 1; grid.unshift(fullRow(0)); grid.pop(); ensureRows();
        yOff = reduce ? 0 : -RH; G.sfx.whoosh(); G.shake(stage);
        checkDead();
      }
      function lowestY() { for (var rr = grid.length - 1; rr >= 0; rr--) for (var c = 0; c < grid[rr].length; c++) if (grid[rr][c] >= 0) return cy(rr) - yOff; return -1; }
      function checkDead() {
        if (over) return;
        if (lowestY() + R >= DEAD) {
          over = true; G.sfx.lose(); G.buzz(80);
          setTimeout(function () { G.overlay(stage, { lose: true, icon: "🫧", title: "Game over", text: "Score <b>" + score + "</b> · level " + level, buttons: [{ label: "Play again", fn: newGame }] }); }, 350);
        }
      }
      /* trace the shot path: returns points and the hit (row/col to snap to) */
      function trace(ax) {
        var px = W / 2, py = SHOOT_Y, dx = Math.cos(ax), dy = Math.sin(ax), pts = [[px, py]], stepL = 4;
        for (var i = 0; i < 900; i++) {
          px += dx * stepL; py += dy * stepL;
          if (px < R) { px = R + (R - px); dx = -dx; pts.push([px, py]); } else if (px > W - R) { px = (W - R) - (px - (W - R)); dx = -dx; pts.push([px, py]); }
          var hit = contact(px, py);
          if (hit || py <= R + 6 + yOff) { pts.push([px, py]); return { pts: pts, snap: snap(px, py, hit) }; }
        }
        return { pts: pts, snap: null };
      }
      function contact(px, py) {
        var row = Math.round((py - R - 6 - yOff) / RH), best = null, bd = 1e9;
        for (var rr = Math.max(0, row - 1); rr <= Math.min(grid.length - 1, row + 1); rr++) for (var c = 0; c < grid[rr].length; c++) if (grid[rr][c] >= 0) {
          var d = Math.pow(cx(rr, c) - px, 2) + Math.pow(cy(rr) - py, 2);
          if (d < Math.pow(2 * R * .88, 2) && d < bd) { bd = d; best = [rr, c]; }
        }
        return best;
      }
      function snap(px, py, hit) {
        var cand = [], row = G.clamp(Math.round((py - R - 6 - yOff) / RH), 0, grid.length - 1), col = G.clamp(Math.round((px - R - (odd(row) ? R : 0)) / (2 * R)), 0, rowCols(row) - 1);
        cand.push([row, col]); if (hit) cand = cand.concat(nbrs(hit[0], hit[1]));
        nbrs(row, col).forEach(function (q) { cand.push(q); });
        var best = null, bd = 1e9;
        cand.forEach(function (q) {
          if (grid[q[0]][q[1]] >= 0) return;
          // must touch the ceiling or another bubble
          var ok = q[0] === 0 || nbrs(q[0], q[1]).some(function (n) { return grid[n[0]][n[1]] >= 0; }); if (!ok) return;
          var d = Math.pow(cx(q[0], q[1]) - px, 2) + Math.pow(cy(q[0]) - py, 2); if (d < bd) { bd = d; best = q; }
        });
        return best || (grid[row][col] < 0 ? [row, col] : null);
      }
      function step(dt) {
        if (yOff < 0) yOff = Math.min(0, yOff + RH * dt * 6);
        pops = pops.filter(function (p) { p.t += dt * 3.2; return p.t < 1; });
        falls = falls.filter(function (f) { f.vy += 1500 * dt; f.x += f.vx * dt; f.y += f.vy * dt; return f.y < H + R * 2; });
        if (!shot) return;
        var dist = SPEED * dt, n = Math.ceil(dist / 5), s = dist / n;
        for (var i = 0; i < n; i++) {
          shot.x += shot.dx * s; shot.y += shot.dy * s;
          if (shot.x < R) { shot.x = 2 * R - shot.x; shot.dx = -shot.dx; G.sfx.tap(); } else if (shot.x > W - R) { shot.x = 2 * (W - R) - shot.x; shot.dx = -shot.dx; G.sfx.tap(); }
          var hit = contact(shot.x, shot.y);
          if (hit || shot.y <= R + 6 + yOff) {
            var sp = snap(shot.x, shot.y, hit), c = shot.c; shot = null;
            if (sp) place(sp[0], sp[1], c); else { cur = c; }
            return;
          }
        }
      }
      /* ---------- drawing ---------- */
      function buildBg() {
        var dpr = Math.min(2, window.devicePixelRatio || 1), o = document.createElement("canvas"); o.width = W * dpr; o.height = H * dpr;
        var c = o.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
        var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#1e1b4b"); g.addColorStop(.6, "#0f172a"); g.addColorStop(1, "#0b0a1f"); c.fillStyle = g; c.fillRect(0, 0, W, H);
        for (var i = 0; i < 60; i++) { c.fillStyle = "rgba(255,255,255," + (.1 + Math.random() * .4) + ")"; c.beginPath(); c.arc(Math.random() * W, Math.random() * H * .8, Math.random() * 1.4, 0, 7); c.fill(); }
        c.fillStyle = "rgba(255,255,255,.06)"; c.fillRect(0, 0, W, 6);
        c.strokeStyle = "rgba(248,113,113,.55)"; c.setLineDash([8, 8]); c.lineWidth = 2; c.beginPath(); c.moveTo(0, DEAD); c.lineTo(W, DEAD); c.stroke(); c.setLineDash([]);
        var bp = c.createLinearGradient(0, DEAD, 0, H); bp.addColorStop(0, "rgba(124,58,237,0)"); bp.addColorStop(1, "rgba(124,58,237,.25)"); c.fillStyle = bp; c.fillRect(0, DEAD, W, H - DEAD);
        return o;
      }
      function bubble(bx, by, ci, rad, alpha) {
        var p = PAL[ci], rr = rad || R - 1; x.globalAlpha = alpha == null ? 1 : alpha;
        var g = x.createRadialGradient(bx - rr * .35, by - rr * .4, rr * .1, bx, by, rr); g.addColorStop(0, "#fff"); g.addColorStop(.25, p[0]); g.addColorStop(.75, p[1]); g.addColorStop(1, p[2]);
        x.fillStyle = g; x.beginPath(); x.arc(bx, by, rr, 0, 7); x.fill();
        x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.ellipse(bx - rr * .32, by - rr * .42, rr * .3, rr * .17, -.6, 0, 7); x.fill();
        x.globalAlpha = 1;
      }
      function dots(pts) {
        // green dotted guide with a dark outline so it shows on any colour
        var gap = 16, acc = 0;
        for (var i = 1; i < pts.length; i++) {
          var a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), t = acc;
          while (t < L) { var k = t / L, px = a[0] + (b[0] - a[0]) * k, py = a[1] + (b[1] - a[1]) * k; x.fillStyle = "rgba(0,0,0,.55)"; x.beginPath(); x.arc(px, py, 4.6, 0, 7); x.fill(); x.fillStyle = "#4ADE80"; x.beginPath(); x.arc(px, py, 3.2, 0, 7); x.fill(); t += gap; }
          acc = t - L;
        }
      }
      function draw() {
        if (!bg) bg = buildBg();
        x.drawImage(bg, 0, 0, W, H);
        for (var rr = 0; rr < grid.length; rr++) for (var c = 0; c < grid[rr].length; c++) if (grid[rr][c] >= 0) bubble(cx(rr, c), cy(rr), grid[rr][c]);
        pops.forEach(function (p) { if (p.t < 0) { bubble(p.x, p.y, p.c); return; } bubble(p.x, p.y, p.c, R * (1 + p.t * .5), 1 - p.t); });
        falls.forEach(function (f) { bubble(f.x, f.y, f.c); });
        if (!shot && !over) {
          var tr = trace(aim); dots(tr.pts);
          if (tr.snap) { var gx = cx(tr.snap[0], tr.snap[1]), gy = cy(tr.snap[0]); x.strokeStyle = "rgba(74,222,128,.9)"; x.lineWidth = 2.5; x.setLineDash([4, 4]); x.beginPath(); x.arc(gx, gy, R - 2, 0, 7); x.stroke(); x.setLineDash([]); x.lineWidth = 1; }
        }
        // shooter
        x.save(); x.translate(W / 2, SHOOT_Y); x.rotate(aim + Math.PI / 2);
        var cg = x.createLinearGradient(-12, 0, 12, 0); cg.addColorStop(0, "#4338ca"); cg.addColorStop(.5, "#818cf8"); cg.addColorStop(1, "#3730a3"); x.fillStyle = cg; x.beginPath(); x.moveTo(-11, -4); x.lineTo(11, -4); x.lineTo(7, -R - 22); x.lineTo(-7, -R - 22); x.closePath(); x.fill(); x.restore();
        x.fillStyle = "#1e1b4b"; x.beginPath(); x.arc(W / 2, SHOOT_Y, R + 9, 0, 7); x.fill(); x.strokeStyle = "rgba(129,140,248,.8)"; x.lineWidth = 2; x.stroke(); x.lineWidth = 1;
        if (shot) bubble(shot.x, shot.y, shot.c); else if (!over) bubble(W / 2, SHOOT_Y, cur);
        // next bubble + swap hint
        x.fillStyle = "rgba(30,27,75,.9)"; x.beginPath(); x.arc(W / 2 + 66, SHOOT_Y + 10, R * .75, 0, 7); x.fill();
        bubble(W / 2 + 66, SHOOT_Y + 10, next, R * .62);
        x.fillStyle = "rgba(255,255,255,.6)"; x.font = "700 11px Inter,system-ui"; x.textAlign = "center"; x.fillText("NEXT", W / 2 + 66, SHOOT_Y + 38);
        // shots left before a new row
        var left = missLimit() - misses;
        for (var i = 0; i < missLimit(); i++) { x.fillStyle = i < left ? "#FDE047" : "rgba(255,255,255,.15)"; x.beginPath(); x.arc(28 + i * 14, SHOOT_Y + 10, 4.5, 0, 7); x.fill(); }
        x.fillStyle = "rgba(255,255,255,.6)"; x.textAlign = "left"; x.fillText("NEW ROW", 20, SHOOT_Y + 38);
      }
      function loop() { cancelAnimationFrame(raf); last = performance.now(); (function f(t) { var dt = Math.min(.04, ((t || performance.now()) - last) / 1000); last = t || performance.now(); if (!document.hidden) { step(dt); draw(); } raf = requestAnimationFrame(f); })(); }
      function local(e) { var b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) * W / b.width, y: (e.clientY - b.top) * H / b.height }; }
      function setAim(p) { var a = Math.atan2(p.y - SHOOT_Y, p.x - W / 2); if (a > 0) a = p.x > W / 2 ? -.12 : -Math.PI + .12; aim = G.clamp(a, -Math.PI + .12, -.12); }
      function fire() { if (shot || over || yOff < -2) return; shot = { x: W / 2, y: SHOOT_Y, dx: Math.cos(aim), dy: Math.sin(aim), c: cur }; G.sfx.whoosh(); }
      function swap() { if (shot || over) return; var t = cur; cur = next; next = t; G.sfx.tap(); }
      cv.addEventListener("pointerdown", function (e) {
        e.preventDefault(); var p = local(e);
        if (Math.hypot(p.x - W / 2, p.y - SHOOT_Y) < R + 12 || Math.hypot(p.x - (W / 2 + 66), p.y - (SHOOT_Y + 10)) < R) { swap(); return; }
        aiming = true; setAim(p); try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      });
      cv.addEventListener("pointermove", function (e) { if (aiming || e.pointerType === "mouse") setAim(local(e)); });
      cv.addEventListener("pointerup", function (e) { if (!aiming) return; aiming = false; var p = local(e); if (p.y > SHOOT_Y + 20) return; setAim(p); fire(); });
      cv.addEventListener("pointercancel", function () { aiming = false; });
      G.keys(function (e) { if (e.key === "ArrowLeft") { aim = Math.max(-Math.PI + .12, aim - .04); e.preventDefault(); } else if (e.key === "ArrowRight") { aim = Math.min(-.12, aim + .04); e.preventDefault(); } else if (e.key === " " || e.key === "ArrowUp") { fire(); e.preventDefault(); } else if (e.key === "s" || e.key === "S") swap(); });
      $("#sw", r).addEventListener("click", swap);
      G.seg($("#odf", r), [["easy", "Easy"], ["normal", "Normal"], ["hard", "Hard"]], diff, function (v) { diff = v; ls.set("bb_d", v); newGame(); });
      $("#nw", r).addEventListener("click", newGame); G.soundBtn($("#sn", r));
      cv._st = function () { return JSON.stringify({ score: score, level: level, over: over, misses: misses, shot: !!shot, n: present().length }); };
      newGame();
    }
  });
})();
