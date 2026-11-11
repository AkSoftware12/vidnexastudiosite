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

/* Cricket Batting – tap at the right moment to hit. Perfect timing is a six, late or early is a dot ball or a wicket. */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$, G = VX.G, ls = G.ls;
  var W = 440, H = 560, PITCH_X = W / 2, BOWL_Y = 90, BAT_Y = 455;

  VX.tool("cricket", {
    html: '<div class="gopt"><div id="omd" role="group" aria-label="Match"></div><div id="odf" role="group" aria-label="Bowling"></div></div>' +
      G.hud([["sc", "Score", "0/0"], ["ov", "Overs", "0.0"], ["tg", "Target", "–"], ["bs", "Best", 0]]) +
      '<div class="gwrap"><div class="gstage" style="--gw:440px"><canvas class="gcanvas swipe" id="cv" width="440" height="560" style="width:100%" aria-label="Cricket pitch"></canvas></div>' +
      '<div class="gmsg" id="msg" aria-live="polite" style="min-height:52px;display:flex;align-items:center"></div>' +
      '<div class="gbar"><button class="btn" id="hit" type="button" style="min-width:200px">🏏 Hit</button></div>' +
      '<div class="gbar" style="margin-top:14px"><button class="btn ghost sm" id="nw" type="button">New match</button><button class="btn ghost sm" id="sn" type="button"></button></div>' +
      '<p class="gnote">Tap Hit (or the pitch, or press Space) when the ball reaches the bat. Perfect timing is a 6, good is a 4, early or late can get you out.</p></div>',
    init: function (r) {
      var cv = $("#cv", r), x = G.canvas(cv, W, H), stage = $(".gstage", r), msg = $("#msg", r), hitBtn = $("#hit", r);
      var mode = ls.get("ck_m", "2"), diff = ls.get("ck_d", "normal"), runs, wk, balls, target, over, ball, swing, fx, raf, lastRes, streak, commentary;
      var BALLS = { "2": 12, "5": 30, "chase": 12 };
      function bestKey() { return "ck_best_" + mode + diff; }
      function say(t) { msg.textContent = t; }
      function newGame() {
        runs = 0; wk = 0; balls = 0; over = false; ball = null; swing = 0; fx = []; lastRes = ""; streak = 0;
        target = mode === "chase" ? 18 + G.rand(20) + (diff === "hard" ? 8 : 0) : null;
        G.closeOverlay(stage); upd(); say(mode === "chase" ? "Chase " + target + " in 2 overs with 3 wickets. Tap Hit to start." : "Tap Hit when the ball reaches the bat. Tap to bowl."); hitBtn.disabled = false; loop();
      }
      function upd() { G.set(r, "sc", runs + "/" + wk); G.set(r, "ov", Math.floor(balls / 6) + "." + (balls % 6)); G.set(r, "tg", target ? target : "–"); G.set(r, "bs", ls.get(bestKey(), 0)); }
      function bowl() {
        if (ball || over) return;
        var sp = (diff === "easy" ? 3.6 : diff === "hard" ? 5.6 : 4.5) + Math.random() * (diff === "hard" ? 2.2 : 1.2);
        ball = { x: PITCH_X + (Math.random() - .5) * 60, y: BOWL_Y, vy: sp, vx: (Math.random() - .5) * .6, hit: false, t: 0, bounced: false };
        say(""); G.sfx.tap();
      }
      function hit() {
        if (over) return; if (!ball) return bowl(); if (ball.hit || swing > 0) return;
        swing = 12; var d = ball.y - BAT_Y, res, rn = 0; // d < 0: early (ball still above the bat)
        var win = diff === "easy" ? 1.35 : diff === "hard" ? .85 : 1;
        var a = Math.abs(d);
        if (a < 10 * win) { res = "SIX!"; rn = 6; } else if (a < 22 * win) { res = "FOUR!"; rn = 4; } else if (a < 36 * win) { res = d < 0 ? "Two runs" : "Single"; rn = d < 0 ? 2 : 1; }
        else if (a < 60 * win) { res = d < 0 ? "Too early, dot ball" : "Late, dot ball"; rn = 0; } else { res = d < 0 ? "Caught! Too early" : "Bowled! Too late"; rn = -1; }
        ball.hit = true; ball.res = rn;
        if (rn > 0) { ball.vx = (Math.random() - .5) * 6 + (rn === 6 ? 0 : (Math.random() - .5) * 4); ball.vy = -(rn === 6 ? 11 : rn === 4 ? 8 : 5); G.sfx.good(); }
        else if (rn === 0) { ball.vy = 1.5; ball.vx = (Math.random() - .5) * 2; G.sfx.pop(); }
        else { ball.vy = rn === -1 && d < 0 ? -4 : 3; G.sfx.bad(); }
        setTimeout(function () { score(rn, res); }, 500);
      }
      function missed() { ball.hit = true; ball.res = -1; G.sfx.bad(); setTimeout(function () { score(-1, "Bowled! You missed"); }, 400); }
      function score(rn, res) {
        if (over) return; balls++;
        if (rn < 0) { wk++; streak = 0; } else { runs += rn; if (rn >= 4) streak++; else streak = 0; }
        if (streak >= 3) res += " · " + streak + " in a row!";
        say(res); fx.push({ t: 1, s: res.split("!")[0] + (res.indexOf("!") > 0 ? "!" : ""), big: rn >= 4 || rn < 0, red: rn < 0 });
        if (runs > ls.get(bestKey(), 0)) ls.set(bestKey(), runs); upd(); ball = null;
        var max = BALLS[mode], done = false, title = "", text = "";
        if (target && runs >= target) { done = true; title = "You won! 🏆"; text = "Target " + target + " chased with " + (max - balls) + " balls and " + (3 - wk) + " wickets left."; }
        else if (wk >= 3) { done = true; title = target ? "All out, you lost" : "All out!"; text = "You scored <b>" + runs + "</b> in " + Math.floor(balls / 6) + "." + (balls % 6) + " overs."; }
        else if (balls >= max) { done = true; title = target ? (runs >= target ? "You won!" : "Lost by " + (target - runs) + " runs") : "Innings over"; text = "Final score <b>" + runs + "/" + wk + "</b>" + (runs >= ls.get(bestKey(), 0) && runs > 0 ? " · best!" : ""); }
        if (done) { over = true; hitBtn.disabled = true; if (title.indexOf("won") >= 0 || (!target && runs >= 20)) G.sfx.win(); setTimeout(function () { G.overlay(stage, { title: title, text: text, buttons: [{ label: "Play again", fn: newGame }] }); }, 1200); }
      }
      function draw() {
        x.fillStyle = "#166534"; x.fillRect(0, 0, W, H);
        x.fillStyle = "#15803d"; for (var i = 0; i < 8; i++) if (i % 2) x.fillRect(0, i * 70, W, 70);
        x.strokeStyle = "rgba(255,255,255,.5)"; x.lineWidth = 2; x.beginPath(); x.arc(W / 2, H / 2 + 30, 300, 0, 7); x.stroke();
        x.fillStyle = "#d6b98c"; x.fillRect(PITCH_X - 42, BOWL_Y - 30, 84, BAT_Y + 50 - BOWL_Y + 30);
        x.fillStyle = "#fff"; x.fillRect(PITCH_X - 42, BAT_Y - 2, 84, 2); x.fillRect(PITCH_X - 42, BAT_Y + 32, 84, 2);
        x.fillRect(PITCH_X - 42, BOWL_Y - 2, 84, 2);
        // stumps bowler end and batter end
        [BOWL_Y - 22, BAT_Y + 38].forEach(function (sy) { x.fillStyle = "#f5deb3"; [-10, 0, 10].forEach(function (dx) { x.fillRect(PITCH_X + dx - 2, sy - 22, 4, 24); }); });
        // timing zone
        x.fillStyle = "rgba(250,204,21,.18)"; x.fillRect(PITCH_X - 42, BAT_Y - 22, 84, 44);
        // batter
        var bx = PITCH_X + 30, by = BAT_Y + 10;
        x.fillStyle = "#1e3a8a"; x.beginPath(); x.ellipse(bx, by + 8, 12, 20, 0, 0, 7); x.fill(); x.fillStyle = "#fcd9b6"; x.beginPath(); x.arc(bx, by - 18, 9, 0, 7); x.fill(); x.fillStyle = "#1e3a8a"; x.fillRect(bx - 10, by - 28, 20, 6);
        x.save(); x.translate(bx - 8, by + 4); x.rotate(swing > 0 ? -Math.PI / 2 - (12 - swing) * .18 : .35); x.fillStyle = "#deb887"; x.fillRect(-4, -4, 8, 46); x.restore();
        // bowler
        x.fillStyle = "#991b1b"; x.beginPath(); x.ellipse(PITCH_X - 24, BOWL_Y - 2, 11, 18, 0, 0, 7); x.fill(); x.fillStyle = "#fcd9b6"; x.beginPath(); x.arc(PITCH_X - 24, BOWL_Y - 26, 8, 0, 7); x.fill();
        if (ball) {
          var sh = ball.hit ? 0 : Math.max(0, 8 - Math.abs(((ball.y - BOWL_Y) / 60) % 2 - 1) * 8);
          x.fillStyle = "rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(ball.x, ball.y + 6, 7, 3, 0, 0, 7); x.fill();
          x.fillStyle = "#dc2626"; x.beginPath(); x.arc(ball.x, ball.y - sh, 7, 0, 7); x.fill(); x.strokeStyle = "#fff"; x.lineWidth = 1; x.beginPath(); x.arc(ball.x, ball.y - sh, 4, 0, 7); x.stroke();
        }
        fx = fx.filter(function (f) { f.t -= .012; x.globalAlpha = Math.min(1, f.t * 2); x.font = "800 " + (f.big ? 40 : 26) + "px system-ui"; x.textAlign = "center"; x.fillStyle = f.red ? "#fca5a5" : "#fde047"; x.fillText(f.s, W / 2, 250 - (1 - f.t) * 40); x.globalAlpha = 1; return f.t > 0; });
        if (!ball && !over) { x.font = "600 16px system-ui"; x.textAlign = "center"; x.fillStyle = "rgba(255,255,255,.85)"; x.fillText("Tap to bowl", W / 2, 300); }
      }
      function step() {
        if (swing > 0) swing--;
        if (!ball) return;
        ball.y += ball.vy; ball.x += ball.vx;
        if (!ball.hit && ball.y > BAT_Y + 70) missed();
        if (ball.hit && (ball.y < -20 || ball.y > H + 20 || ball.x < -20 || ball.x > W + 20)) { ball.vy = 0; ball.vx = 0; }
      }
      function loop() { cancelAnimationFrame(raf); (function f() { step(); draw(); raf = requestAnimationFrame(f); })(); }
      cv.addEventListener("pointerdown", function (e) { e.preventDefault(); hit(); });
      hitBtn.addEventListener("click", hit);
      G.keys(function (e) { if (e.key === " " || e.key === "Enter") { hit(); e.preventDefault(); } });
      G.seg($("#omd", r), [["2", "2 overs"], ["5", "5 overs"], ["chase", "Chase"]], mode, function (v) { mode = v; ls.set("ck_m", v); newGame(); });
      G.seg($("#odf", r), [["easy", "Easy"], ["normal", "Normal"], ["hard", "Hard"]], diff, function (v) { diff = v; ls.set("ck_d", v); newGame(); });
      $("#nw", r).addEventListener("click", newGame); G.soundBtn($("#sn", r));
      newGame();
    }
  });
})();
