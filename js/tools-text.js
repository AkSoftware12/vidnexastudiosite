/* Text tools */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$;

  VX.tool("word-counter", {
    html: '<div class="fld"><label for="t">Type or paste your text</label><textarea id="t" class="in" placeholder="Start typing here…"></textarea></div><div class="stats" id="s"></div><div class="bar"><button class="btn ghost sm" id="clr" type="button">Clear</button></div>',
    init: function (r) {
      var t = $("#t", r), s = $("#s", r);
      function up() {
        var x = t.value, w = (x.match(/\S+/g) || []).length;
        var sent = (x.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || []).filter(function (z) { return z.trim(); }).length;
        var para = x.split(/\n\s*\n/).filter(function (z) { return z.trim(); }).length;
        var mins = w / 200, sp = w / 130;
        var rt = w === 0 ? "0 sec" : mins < 1 ? Math.max(1, Math.round(mins * 60)) + " sec" : Math.round(mins * 10) / 10 + " min";
        var st = w === 0 ? "0 sec" : sp < 1 ? Math.max(1, Math.round(sp * 60)) + " sec" : Math.round(sp * 10) / 10 + " min";
        s.innerHTML = VX.stat("Words", w) + VX.stat("Characters", x.length) + VX.stat("No spaces", x.replace(/\s/g, "").length) +
          VX.stat("Sentences", sent) + VX.stat("Paragraphs", para) + VX.stat("Reading time", rt) + VX.stat("Speaking time", st);
      }
      t.addEventListener("input", up); $("#clr", r).addEventListener("click", function () { t.value = ""; up(); t.focus(); }); up();
    }
  });

  function words(s) { return s.replace(/[_\-]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim().split(/\s+/).filter(Boolean); }
  var CASES = {
    "UPPERCASE": function (s) { return s.toUpperCase(); },
    "lowercase": function (s) { return s.toLowerCase(); },
    "Title Case": function (s) { return s.toLowerCase().replace(/(^|[\s\-(])([a-zà-ÿ])/g, function (m, a, b) { return a + b.toUpperCase(); }); },
    "Sentence case": function (s) { return s.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }); },
    "camelCase": function (s) { var w = words(s.toLowerCase()); return w.map(function (x, i) { return i ? x[0].toUpperCase() + x.slice(1) : x; }).join(""); },
    "PascalCase": function (s) { return words(s.toLowerCase()).map(function (x) { return x[0].toUpperCase() + x.slice(1); }).join(""); },
    "snake_case": function (s) { return words(s.toLowerCase()).join("_"); },
    "kebab-case": function (s) { return words(s.toLowerCase()).join("-"); },
    "aLtErNaTiNg": function (s) { var i = 0; return s.replace(/[a-z]/gi, function (c) { return i++ % 2 ? c.toUpperCase() : c.toLowerCase(); }); }
  };
  VX.tool("case-converter", {
    html: '<div class="fld"><label for="t">Your text</label><textarea id="t" class="in" placeholder="Paste text here…"></textarea></div><div class="seg" id="b" role="group" aria-label="Choose a case"></div><div class="fld" style="margin-top:16px"><label for="o">Result</label><textarea id="o" class="in" readonly></textarea></div><div class="bar"><button class="btn sm" id="cp" type="button">Copy result</button></div>',
    init: function (r) {
      var t = $("#t", r), o = $("#o", r), b = $("#b", r), cur = "UPPERCASE";
      Object.keys(CASES).forEach(function (k) {
        var x = document.createElement("button"); x.type = "button"; x.textContent = k; x.setAttribute("aria-pressed", k === cur ? "true" : "false");
        x.addEventListener("click", function () { cur = k; VX.$$("button", b).forEach(function (y) { y.setAttribute("aria-pressed", y === x ? "true" : "false"); }); up(); });
        b.appendChild(x);
      });
      function up() { o.value = CASES[cur](t.value); }
      t.addEventListener("input", up); $("#cp", r).addEventListener("click", function (e) { VX.copy(o.value, e.target); }); up();
    }
  });

  var LW = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(" ");
  VX.tool("lorem-ipsum-generator", {
    html: '<div class="row"><div class="fld"><label for="n">How many</label><input id="n" class="in" type="number" min="1" max="100" value="3"></div><div class="fld"><label for="u">Unit</label><select id="u" class="in"><option value="p">Paragraphs</option><option value="s">Sentences</option><option value="w">Words</option></select></div></div><div class="chk" style="margin-bottom:14px"><input id="cl" type="checkbox" checked><label for="cl">Start with "Lorem ipsum dolor sit amet"</label></div><div class="bar"><button class="btn" id="g" type="button">Generate</button><button class="btn ghost" id="cp" type="button">Copy</button></div><div class="out" id="o"></div>',
    init: function (r) {
      var o = $("#o", r);
      function pick() { return LW[Math.floor(Math.random() * LW.length)]; }
      function sentence() { var n = 8 + Math.floor(Math.random() * 10), a = []; for (var i = 0; i < n; i++) a.push(pick()); var s = a.join(" "); return s[0].toUpperCase() + s.slice(1) + "."; }
      function para() { var n = 3 + Math.floor(Math.random() * 4), a = []; for (var i = 0; i < n; i++) a.push(sentence()); return a.join(" "); }
      function gen() {
        var n = Math.min(100, Math.max(1, parseInt($("#n", r).value, 10) || 1)), u = $("#u", r).value, out = [];
        if (u === "w") { var w = []; for (var i = 0; i < n; i++) w.push(pick()); out = [w.join(" ")]; }
        else if (u === "s") { var s = []; for (var j = 0; j < n; j++) s.push(sentence()); out = [s.join(" ")]; }
        else for (var k = 0; k < n; k++) out.push(para());
        var txt = out.join("\n\n");
        if ($("#cl", r).checked) txt = "Lorem ipsum dolor sit amet" + (u === "w" ? " " : ", consectetur adipiscing elit. ") + txt.replace(/^\S+(\s+\S+){0,4}\s*/, u === "w" ? "" : "");
        if (u === "w") { var arr = txt.split(/\s+/).filter(Boolean).slice(0, Math.max(n, $("#cl", r).checked ? 5 : n)); txt = arr.join(" "); }
        o.textContent = txt;
      }
      $("#g", r).addEventListener("click", gen); $("#cp", r).addEventListener("click", function (e) { VX.copy(o.textContent, e.target); }); gen();
    }
  });

  VX.tool("remove-duplicate-lines", {
    html: '<div class="fld"><label for="t">Paste your lines (one per line)</label><textarea id="t" class="in"></textarea></div><div class="row tight"><label class="chk"><input id="ci" type="checkbox"> Ignore upper/lower case</label><label class="chk"><input id="tr" type="checkbox" checked> Trim spaces</label><label class="chk"><input id="eb" type="checkbox" checked> Remove empty lines</label></div><div class="bar"><button class="btn" id="go" type="button">Remove duplicates</button><button class="btn ghost" id="cp" type="button">Copy result</button></div><div class="msg" id="m"></div><div class="fld"><label for="o">Result</label><textarea id="o" class="in" readonly></textarea></div>',
    init: function (r) {
      $("#go", r).addEventListener("click", function () {
        var ci = $("#ci", r).checked, tr = $("#tr", r).checked, eb = $("#eb", r).checked, seen = {}, out = [], total = 0;
        $("#t", r).value.split(/\r?\n/).forEach(function (l) {
          var v = tr ? l.trim() : l; if (eb && !v) return; total++;
          var k = ci ? v.toLowerCase() : v; if (seen[k]) return; seen[k] = 1; out.push(v);
        });
        $("#o", r).value = out.join("\n");
        $("#m", r).textContent = total + " lines checked, " + (total - out.length) + " duplicate" + (total - out.length === 1 ? "" : "s") + " removed, " + out.length + " left.";
      });
      $("#cp", r).addEventListener("click", function (e) { VX.copy($("#o", r).value, e.target); });
    }
  });

  VX.tool("text-sorter", {
    html: '<div class="fld"><label for="t">Lines to sort</label><textarea id="t" class="in"></textarea></div><div class="seg" id="b" role="group" aria-label="Sort method"></div><div class="fld" style="margin-top:16px"><label for="o">Result</label><textarea id="o" class="in" readonly></textarea></div><div class="bar"><button class="btn sm" id="cp" type="button">Copy result</button></div>',
    init: function (r) {
      var M = {
        "A to Z": function (a) { return a.sort(function (x, y) { return x.localeCompare(y, undefined, { sensitivity: "base", numeric: true }); }); },
        "Z to A": function (a) { return a.sort(function (x, y) { return y.localeCompare(x, undefined, { sensitivity: "base", numeric: true }); }); },
        "Shortest first": function (a) { return a.sort(function (x, y) { return x.length - y.length; }); },
        "Longest first": function (a) { return a.sort(function (x, y) { return y.length - x.length; }); },
        "Reverse order": function (a) { return a.reverse(); },
        "Shuffle": function (a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
      }, b = $("#b", r), cur = "A to Z";
      Object.keys(M).forEach(function (k) {
        var x = document.createElement("button"); x.type = "button"; x.textContent = k; x.setAttribute("aria-pressed", k === cur ? "true" : "false");
        x.addEventListener("click", function () { cur = k; VX.$$("button", b).forEach(function (y) { y.setAttribute("aria-pressed", y === x ? "true" : "false"); }); up(); }); b.appendChild(x);
      });
      function up() { var l = $("#t", r).value.split(/\r?\n/).filter(function (z) { return z.length; }); $("#o", r).value = M[cur](l).join("\n"); }
      $("#t", r).addEventListener("input", up); $("#cp", r).addEventListener("click", function (e) { VX.copy($("#o", r).value, e.target); });
    }
  });

  VX.tool("slug-generator", {
    html: '<div class="fld"><label for="t">Title or sentence</label><input id="t" class="in" type="text" placeholder="e.g. 10 Best Free Video Players for Android"></div><div class="row tight"><label class="chk"><input id="lw" type="checkbox" checked> Lowercase</label><label class="chk"><input id="sw" type="checkbox"> Remove small words (a, the, of…)</label></div><div class="fld" style="margin-top:14px"><label for="o">URL slug</label><input id="o" class="in" type="text" readonly></div><div class="bar"><button class="btn sm" id="cp" type="button">Copy slug</button></div>',
    init: function (r) {
      function up() {
        var s = $("#t", r).value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ");
        if ($("#lw", r).checked) s = s.toLowerCase();
        var w = s.replace(/[^A-Za-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
        if ($("#sw", r).checked) w = w.filter(function (x) { return ["a", "an", "the", "of", "and", "or", "to", "in", "on", "for", "at", "by"].indexOf(x.toLowerCase()) === -1; });
        $("#o", r).value = w.join("-");
      }
      ["#t", "#lw", "#sw"].forEach(function (q) { $(q, r).addEventListener("input", up); $(q, r).addEventListener("change", up); });
      $("#cp", r).addEventListener("click", function (e) { VX.copy($("#o", r).value, e.target); });
    }
  });

  VX.tool("text-reverser", {
    html: '<div class="fld"><label for="t">Your text</label><textarea id="t" class="in"></textarea></div><div class="seg" id="b" role="group" aria-label="Reverse mode"></div><div class="fld" style="margin-top:16px"><label for="o">Result</label><textarea id="o" class="in" readonly></textarea></div><div class="bar"><button class="btn sm" id="cp" type="button">Copy result</button></div>',
    init: function (r) {
      var M = {
        "Reverse characters": function (s) { return Array.from(s).reverse().join(""); },
        "Reverse words": function (s) { return s.split(/(\s+)/).reverse().join(""); },
        "Reverse each word": function (s) { return s.replace(/\S+/g, function (w) { return Array.from(w).reverse().join(""); }); },
        "Reverse lines": function (s) { return s.split(/\r?\n/).reverse().join("\n"); }
      }, b = $("#b", r), cur = "Reverse characters";
      Object.keys(M).forEach(function (k) {
        var x = document.createElement("button"); x.type = "button"; x.textContent = k; x.setAttribute("aria-pressed", k === cur ? "true" : "false");
        x.addEventListener("click", function () { cur = k; VX.$$("button", b).forEach(function (y) { y.setAttribute("aria-pressed", y === x ? "true" : "false"); }); up(); }); b.appendChild(x);
      });
      function up() { $("#o", r).value = M[cur]($("#t", r).value); }
      $("#t", r).addEventListener("input", up); $("#cp", r).addEventListener("click", function (e) { VX.copy($("#o", r).value, e.target); });
    }
  });

  VX.tool("text-to-speech", {
    html: '<div class="fld"><label for="t">Text to read aloud</label><textarea id="t" class="in" placeholder="Type or paste text, then press Speak."></textarea></div><div class="row"><div class="fld"><label for="v">Voice</label><select id="v" class="in"></select></div><div class="fld"><label for="rt">Speed: <span id="rv">1</span>×</label><input id="rt" type="range" min="0.5" max="2" step="0.1" value="1"></div></div><div class="bar"><button class="btn" id="sp" type="button">Speak</button><button class="btn ghost" id="st" type="button">Stop</button></div><div class="msg" id="m"></div>',
    init: function (r) {
      var syn = window.speechSynthesis, vs = $("#v", r);
      if (!syn) { $("#m", r).textContent = "Your browser does not support text to speech."; $("#m", r).className = "msg err"; $("#sp", r).disabled = true; return; }
      var voices = [];
      function fill() { voices = syn.getVoices(); vs.innerHTML = voices.map(function (v, i) { return '<option value="' + i + '">' + VX.esc(v.name + " (" + v.lang + ")") + "</option>"; }).join(""); }
      fill(); syn.onvoiceschanged = fill;
      $("#rt", r).addEventListener("input", function (e) { $("#rv", r).textContent = e.target.value; });
      $("#sp", r).addEventListener("click", function () {
        syn.cancel(); var u = new SpeechSynthesisUtterance($("#t", r).value || "Please type some text first.");
        if (voices[vs.value]) u.voice = voices[vs.value]; u.rate = parseFloat($("#rt", r).value); syn.speak(u);
      });
      $("#st", r).addEventListener("click", function () { syn.cancel(); });
    }
  });

  VX.tool("typing-speed-test", {
    html: '<div class="stats" id="s"></div><div class="out" id="p" style="font-family:inherit;font-size:19px;line-height:1.8;user-select:none"></div><div class="fld" style="margin-top:14px"><label for="t">Start typing here — the timer starts on your first key</label><textarea id="t" class="in" style="min-height:110px" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea></div><div class="bar"><button class="btn" id="rs" type="button">New test</button></div>',
    init: function (r) {
      var P = ["The quick brown fox jumps over the lazy dog while the sun sets slowly behind the distant hills and the town grows quiet.",
        "Good habits are built one small step at a time, and every day you practise a little you get a little faster and a little better.",
        "Technology works best when it is simple, fast and easy to use, so that people can spend their time on what really matters to them.",
        "A clear mind and steady hands can turn a hard task into an easy one, as long as you keep going and never stop learning something new."];
      var txt, start = 0, done = false, timer;
      var p = $("#p", r), t = $("#t", r), s = $("#s", r);
      function reset() { clearInterval(timer); txt = P[Math.floor(Math.random() * P.length)]; start = 0; done = false; t.value = ""; t.disabled = false; render(); stats(0, 0, 0); }
      function render() {
        var v = t.value, h = "";
        for (var i = 0; i < txt.length; i++) {
          var c = VX.esc(txt[i]);
          if (i < v.length) h += '<span style="color:' + (v[i] === txt[i] ? "#34D399" : "#F87171") + (v[i] === txt[i] ? "" : ";text-decoration:underline") + '">' + c + "</span>";
          else if (i === v.length) h += '<span style="background:rgba(167,139,250,.35);border-radius:3px">' + c + "</span>";
          else h += c;
        }
        p.innerHTML = h;
      }
      function stats(wpm, acc, secs) { s.innerHTML = VX.stat("Speed", wpm + " WPM") + VX.stat("Accuracy", acc + "%") + VX.stat("Time", secs + " s"); }
      function calc(final) {
        var v = t.value, secs = Math.max((Date.now() - start) / 1000, 1), ok = 0;
        for (var i = 0; i < v.length; i++) if (v[i] === txt[i]) ok++;
        var wpm = Math.round((ok / 5) / (secs / 60)), acc = v.length ? Math.round(ok / v.length * 100) : 100;
        stats(wpm, acc, Math.round(secs)); return final;
      }
      t.addEventListener("input", function () {
        if (done) return;
        if (!start) { start = Date.now(); timer = setInterval(calc, 250); }
        if (t.value.length >= txt.length) { done = true; clearInterval(timer); t.value = t.value.slice(0, txt.length); t.disabled = true; calc(true); }
        render();
      });
      $("#rs", r).addEventListener("click", function () { reset(); t.focus(); }); reset();
    }
  });
})();
