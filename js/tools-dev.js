/* Developer and utility tools */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$;
  function note(r, msg, err) { var m = $("#m", r); if (m) { m.textContent = msg; m.className = "msg" + (err ? " err" : ""); } }
  function rnd(n) { var a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n, x; do { crypto.getRandomValues(a); x = a[0]; } while (x >= lim); return x % n; }

  VX.tool("qr-code-generator", {
    html: '<div class="fld"><label for="t">Text or link</label><textarea id="t" class="in" style="min-height:90px" placeholder="https://example.com"></textarea></div><div class="row"><div class="fld"><label for="e">Error correction</label><select id="e" class="in"><option value="L">Low (smallest)</option><option value="M" selected>Medium</option><option value="Q">Quartile</option><option value="H">High</option></select></div><div class="fld"><label for="s">Size</label><select id="s" class="in"><option value="6">Small</option><option value="10" selected>Medium</option><option value="16">Large</option></select></div><div class="fld"><label for="fg">Dot colour</label><input id="fg" type="color" value="#000000" class="in" style="padding:4px;height:46px"></div><div class="fld"><label for="bg">Background</label><input id="bg" type="color" value="#ffffff" class="in" style="padding:4px;height:46px"></div></div><div class="qrbox" id="box"></div><div class="msg" id="m"></div><div class="bar"><button class="btn" id="png" type="button">Download PNG</button><button class="btn ghost" id="svg" type="button">Download SVG</button></div>',
    init: function (r) {
      var qr = null;
      function up() {
        var t = $("#t", r).value, box = $("#box", r); box.innerHTML = ""; qr = null; note(r, "");
        if (!t) { note(r, "Type something above and your QR code will appear here."); return; }
        try { qr = VXQR.encode(t, $("#e", r).value); } catch (e) { note(r, e.message, 1); return; }
        var c = VXQR.toCanvas(qr, +$("#s", r).value, 4, $("#fg", r).value, $("#bg", r).value); c.setAttribute("role", "img"); c.setAttribute("aria-label", "QR code for your text"); c.style.maxWidth = "100%"; c.style.height = "auto"; box.appendChild(c);
      }
      ["t", "e", "s", "fg", "bg"].forEach(function (i) { $("#" + i, r).addEventListener("input", up); $("#" + i, r).addEventListener("change", up); });
      $("#png", r).addEventListener("click", function () { if (!qr) return; VXQR.toCanvas(qr, 20, 4, $("#fg", r).value, $("#bg", r).value).toBlob(function (b) { VX.save(b, "qr-code.png"); }); });
      $("#svg", r).addEventListener("click", function () { if (!qr) return; VX.save(new Blob([VXQR.toSVG(qr, 4, $("#fg", r).value, $("#bg", r).value)], { type: "image/svg+xml" }), "qr-code.svg"); });
      up();
    }
  });

  VX.tool("password-generator", {
    html: '<div class="out big" id="o" style="word-break:break-all;min-height:56px"></div><div class="stats" id="s"></div><div class="row"><div class="fld"><label for="n">Length: <span id="nv">16</span></label><input id="n" type="range" min="6" max="64" value="16"></div></div><div class="row tight"><label class="chk"><input id="u" type="checkbox" checked> A–Z</label><label class="chk"><input id="l" type="checkbox" checked> a–z</label><label class="chk"><input id="d" type="checkbox" checked> 0–9</label><label class="chk"><input id="y" type="checkbox" checked> Symbols</label><label class="chk"><input id="a" type="checkbox"> Skip look-alikes (0 O l 1 I)</label></div><div class="bar"><button class="btn" id="g" type="button">New password</button><button class="btn ghost" id="cp" type="button">Copy</button></div><div class="msg" id="m">Passwords are made in your browser and never sent anywhere.</div>',
    init: function (r) {
      function gen() {
        var sets = []; if ($("#u", r).checked) sets.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ"); if ($("#l", r).checked) sets.push("abcdefghijklmnopqrstuvwxyz"); if ($("#d", r).checked) sets.push("0123456789"); if ($("#y", r).checked) sets.push("!@#$%^&*()-_=+[]{};:,.?");
        if ($("#a", r).checked) sets = sets.map(function (s) { return s.replace(/[0OIl1]/g, ""); });
        if (!sets.length) { $("#o", r).textContent = ""; note(r, "Choose at least one type of character.", 1); return; }
        var n = +$("#n", r).value, all = sets.join(""), out = [];
        sets.forEach(function (s) { out.push(s[rnd(s.length)]); });
        while (out.length < n) out.push(all[rnd(all.length)]);
        for (var i = out.length - 1; i > 0; i--) { var j = rnd(i + 1), t = out[i]; out[i] = out[j]; out[j] = t; }
        out = out.slice(0, n); $("#o", r).textContent = out.join(""); note(r, "Passwords are made in your browser and never sent anywhere.");
        var bitsE = Math.round(n * Math.log2(all.length)); $("#s", r).innerHTML = VX.stat("Strength", bitsE < 50 ? "Weak" : bitsE < 70 ? "Fair" : bitsE < 100 ? "Strong" : "Very strong") + VX.stat("Entropy", bitsE + " bits");
      }
      $("#n", r).addEventListener("input", function () { $("#nv", r).textContent = $("#n", r).value; gen(); });
      ["u", "l", "d", "y", "a"].forEach(function (i) { $("#" + i, r).addEventListener("change", gen); });
      $("#g", r).addEventListener("click", gen); $("#cp", r).addEventListener("click", function (e) { VX.copy($("#o", r).textContent, e.target); }); gen();
    }
  });

  VX.tool("json-formatter", {
    html: '<div class="fld"><label for="t">Paste JSON</label><textarea id="t" class="in mono" style="min-height:200px" spellcheck="false"></textarea></div><div class="bar"><button class="btn" id="f" type="button">Format</button><button class="btn ghost" id="mn" type="button">Minify</button><button class="btn ghost" id="cp" type="button">Copy</button></div><div class="msg" id="m"></div>',
    init: function (r) {
      var t = $("#t", r);
      function go(min) { try { var v = JSON.parse(t.value); t.value = min ? JSON.stringify(v) : JSON.stringify(v, null, 2); note(r, "Valid JSON."); } catch (e) { note(r, "Invalid JSON: " + e.message, 1); } }
      $("#f", r).addEventListener("click", function () { go(false); }); $("#mn", r).addEventListener("click", function () { go(true); });
      $("#cp", r).addEventListener("click", function (e) { VX.copy(t.value, e.target); });
    }
  });

  VX.tool("base64-encoder-decoder", {
    html: '<div class="fld"><label for="t">Text</label><textarea id="t" class="in" style="min-height:140px"></textarea></div><div class="bar"><button class="btn" id="e" type="button">Encode</button><button class="btn ghost" id="d" type="button">Decode</button><button class="btn ghost" id="cp" type="button">Copy result</button></div><div class="msg" id="m"></div><div class="fld"><label for="o">Result</label><textarea id="o" class="in" style="min-height:140px" readonly></textarea></div>',
    init: function (r) {
      $("#e", r).addEventListener("click", function () { var b = new TextEncoder().encode($("#t", r).value), s = ""; b.forEach(function (c) { s += String.fromCharCode(c); }); $("#o", r).value = btoa(s); note(r, ""); });
      $("#d", r).addEventListener("click", function () {
        try { var s = atob($("#t", r).value.trim().replace(/-/g, "+").replace(/_/g, "/")), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); $("#o", r).value = new TextDecoder("utf-8", { fatal: true }).decode(a); note(r, ""); }
        catch (e) { note(r, "That is not valid Base64 text.", 1); }
      });
      $("#cp", r).addEventListener("click", function (e) { VX.copy($("#o", r).value, e.target); });
    }
  });

  VX.tool("url-encoder-decoder", {
    html: '<div class="fld"><label for="t">Text or URL</label><textarea id="t" class="in" style="min-height:120px"></textarea></div><div class="bar"><button class="btn" id="e" type="button">Encode</button><button class="btn ghost" id="d" type="button">Decode</button><button class="btn ghost" id="cp" type="button">Copy result</button></div><div class="msg" id="m"></div><div class="fld"><label for="o">Result</label><textarea id="o" class="in" style="min-height:120px" readonly></textarea></div>',
    init: function (r) {
      $("#e", r).addEventListener("click", function () { $("#o", r).value = encodeURIComponent($("#t", r).value); note(r, ""); });
      $("#d", r).addEventListener("click", function () { try { $("#o", r).value = decodeURIComponent($("#t", r).value.replace(/\+/g, " ")); note(r, ""); } catch (e) { note(r, "This text is not correctly URL encoded.", 1); } });
      $("#cp", r).addEventListener("click", function (e) { VX.copy($("#o", r).value, e.target); });
    }
  });

  function hex2rgb(h) { h = h.replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&"); if (!/^[0-9a-f]{6}$/i.test(h)) return null; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255; var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn;
    if (d) { s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
  }
  function hsl2rgb(h, s, l) { s /= 100; l /= 100; var k = function (n) { return (n + h / 30) % 12; }, a = s * Math.min(l, 1 - l), f = function (n) { return Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))); }; return [f(0), f(8), f(4)]; }
  VX.tool("color-converter", {
    html: '<div class="row"><div class="fld"><label for="p">Pick a colour</label><input id="p" type="color" value="#7c3aed" class="in" style="padding:4px;height:56px"></div><div class="fld"><label for="hx">HEX</label><input id="hx" class="in" value="#7C3AED"></div><div class="fld"><label for="rg">RGB</label><input id="rg" class="in" value="rgb(124, 58, 237)"></div><div class="fld"><label for="hs">HSL</label><input id="hs" class="in" value="hsl(262, 83%, 58%)"></div></div><div class="swatch" id="sw" style="height:80px;border-radius:14px"></div><div class="msg" id="m"></div>',
    init: function (r) {
      function show(c, from) {
        var hex = "#" + c.map(function (v) { return ("0" + v.toString(16)).slice(-2); }).join("").toUpperCase(), h = rgb2hsl(c[0], c[1], c[2]);
        if (from !== "p") $("#p", r).value = hex.toLowerCase(); if (from !== "hx") $("#hx", r).value = hex;
        if (from !== "rg") $("#rg", r).value = "rgb(" + c.join(", ") + ")"; if (from !== "hs") $("#hs", r).value = "hsl(" + h[0] + ", " + h[1] + "%, " + h[2] + "%)";
        $("#sw", r).style.background = hex; note(r, "");
      }
      $("#p", r).addEventListener("input", function () { show(hex2rgb($("#p", r).value), "p"); });
      $("#hx", r).addEventListener("input", function () { var c = hex2rgb($("#hx", r).value.trim()); if (c) show(c, "hx"); else note(r, "Enter a HEX colour like #7C3AED.", 1); });
      $("#rg", r).addEventListener("input", function () { var m = $("#rg", r).value.match(/\d+/g); if (m && m.length >= 3 && m.slice(0, 3).every(function (v) { return +v <= 255; })) show(m.slice(0, 3).map(Number), "rg"); else note(r, "Enter RGB like rgb(124, 58, 237).", 1); });
      $("#hs", r).addEventListener("input", function () { var m = $("#hs", r).value.match(/\d+/g); if (m && m.length >= 3 && +m[0] <= 360 && +m[1] <= 100 && +m[2] <= 100) show(hsl2rgb(+m[0], +m[1], +m[2]), "hs"); else note(r, "Enter HSL like hsl(262, 83%, 58%).", 1); });
      show([124, 58, 237], "");
    }
  });

  VX.tool("uuid-generator", {
    html: '<div class="row"><div class="fld"><label for="n">How many</label><input id="n" class="in" type="number" min="1" max="100" value="5"></div></div><div class="bar"><button class="btn" id="g" type="button">Generate</button><button class="btn ghost" id="cp" type="button">Copy all</button></div><div class="out" id="o"></div>',
    init: function (r) {
      function uuid() { if (crypto.randomUUID) return crypto.randomUUID(); var b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128; var h = Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20); }
      function gen() { var n = Math.min(100, Math.max(1, Math.floor(VX.num($("#n", r))) || 1)), a = []; for (var i = 0; i < n; i++) a.push(uuid()); $("#o", r).textContent = a.join("\n"); }
      $("#g", r).addEventListener("click", gen); $("#cp", r).addEventListener("click", function (e) { VX.copy($("#o", r).textContent, e.target); }); gen();
    }
  });

  VX.tool("hash-generator", {
    html: '<div class="fld"><label for="t">Text</label><textarea id="t" class="in"></textarea></div><div class="out" id="o" style="word-break:break-all"></div><div class="msg" id="m">MD5 is not offered because the browser does not include it. SHA-1 is shown for compatibility only; do not use it for security.</div>',
    init: function (r) {
      var A = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"], seq = 0;
      function up() {
        var id = ++seq, data = new TextEncoder().encode($("#t", r).value);
        Promise.all(A.map(function (a) { return crypto.subtle.digest(a, data).then(function (b) { return a + ":\n" + Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }); })).then(function (l) { if (id === seq) $("#o", r).textContent = l.join("\n\n"); });
      }
      if (!window.crypto || !crypto.subtle) { $("#o", r).textContent = "Hashing needs a secure (https) page."; return; }
      $("#t", r).addEventListener("input", up); up();
    }
  });

  VX.tool("timestamp-converter", {
    html: '<div class="out big" id="now" style="text-align:center"></div><h2 class="sub">Unix timestamp → date</h2><div class="row"><div class="fld"><label for="ts">Timestamp (seconds or milliseconds)</label><input id="ts" class="in" inputmode="numeric"></div></div><div class="out" id="o1"></div><h2 class="sub">Date → Unix timestamp</h2><div class="row"><div class="fld"><label for="dt">Date and time (your local time)</label><input id="dt" class="in" type="datetime-local"></div></div><div class="out" id="o2"></div>',
    init: function (r) {
      var n = Math.floor(Date.now() / 1000); $("#ts", r).value = n;
      setInterval(function () { $("#now", r).textContent = "Now: " + Math.floor(Date.now() / 1000); }, 1000); $("#now", r).textContent = "Now: " + n;
      function a() { var v = VX.num($("#ts", r)), o = $("#o1", r); if (!isFinite(v)) { o.textContent = ""; return; } var d = new Date(Math.abs(v) < 1e11 ? v * 1000 : v); o.textContent = isNaN(d) ? "Not a valid timestamp" : "UTC: " + d.toUTCString() + "\nLocal: " + d.toString() + "\nISO: " + d.toISOString(); }
      function b() { var v = $("#dt", r).value; $("#o2", r).textContent = v ? "Seconds: " + Math.floor(new Date(v).getTime() / 1000) + "\nMilliseconds: " + new Date(v).getTime() : ""; }
      $("#ts", r).addEventListener("input", a); $("#dt", r).addEventListener("input", b); a();
    }
  });
})();
