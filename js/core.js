/* Tool helpers and registry */
(function () {
  "use strict";
  var VX = window.VX = window.VX || {};
  var reg = VX.reg = {};
  VX.tool = function (slug, def) { reg[slug] = def; };
  VX.$ = function (s, r) { return (r || document).querySelector(s); };
  VX.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  VX.num = function (el) { var v = parseFloat(String(el.value).replace(/,/g, "")); return isFinite(v) ? v : NaN; };
  VX.fmt = function (n, d) {
    if (!isFinite(n)) return "–";
    return Number(n).toLocaleString("en-IN", { maximumFractionDigits: d == null ? 2 : d });
  };
  VX.inr = function (n) { return isFinite(n) ? "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "–"; };
  VX.bytes = function (b) {
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
    return (b / 1048576).toFixed(2) + " MB";
  };
  VX.copy = function (text, btn) {
    var done = function () { if (btn) { var o = btn.textContent; btn.textContent = "Copied"; setTimeout(function () { btn.textContent = o; }, 1300); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    else fallback();
    function fallback() {
      var t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (e) {} t.remove(); done();
    }
  };
  VX.save = function (blob, name) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  };
  VX.load = function (src) {
    VX._l = VX._l || {};
    if (VX._l[src]) return VX._l[src];
    VX._l[src] = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function () { rej(new Error("Could not load " + src)); };
      document.head.appendChild(s);
    });
    return VX._l[src];
  };
  VX.pdfLib = function () {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    var base = (document.documentElement.getAttribute("data-root") || "/");
    return VX.load(base + "js/vendor/pdf-lib.min.js").then(function () { return window.PDFLib; });
  };
  VX.pdfJs = function () {
    if (window.__pdfjs) return Promise.resolve(window.__pdfjs);
    var base = (document.documentElement.getAttribute("data-root") || "/");
    var abs = function (p) { return new URL(base + p, document.baseURI).href; };
    return import(abs("js/vendor/pdfjs/pdf.min.js")).then(function (m) {
      m.GlobalWorkerOptions.workerSrc = abs("js/vendor/pdfjs/pdf.worker.min.js");
      window.__pdfjs = m; return m;
    });
  };
  VX.readImage = function (file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () { res({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("This file could not be read as an image.")); };
      img.src = url;
    });
  };
  VX.dropzone = function (root, opts) {
    // opts: {accept, multiple, onFiles}
    var box = document.createElement("label");
    box.className = "drop";
    box.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg><b>' + (opts.title || "Choose a file") + '</b><span>' + (opts.hint || "or drag and drop it here") + '</span>';
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = opts.accept || "*/*"; if (opts.multiple) inp.multiple = true;
    box.appendChild(inp); root.appendChild(box);
    var go = function (list) { var a = Array.prototype.slice.call(list); if (a.length) opts.onFiles(a); };
    inp.addEventListener("change", function () { go(inp.files); inp.value = ""; });
    ["dragenter", "dragover"].forEach(function (e) { box.addEventListener(e, function (ev) { ev.preventDefault(); box.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (e) { box.addEventListener(e, function (ev) { ev.preventDefault(); box.classList.remove("over"); }); });
    box.addEventListener("drop", function (ev) { go(ev.dataTransfer.files); });
    return box;
  };
  VX.esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  VX.stat = function (label, value) { return '<div class="stat"><b>' + VX.esc(value) + '</b><span>' + VX.esc(label) + '</span></div>'; };
  VX.run = function () {
    var host = document.getElementById("toolRoot");
    if (!host) return;
    var slug = host.getAttribute("data-tool"), def = reg[slug];
    if (!def) { host.textContent = "This tool could not be loaded."; return; }
    host.innerHTML = def.html;
    def.init(host);
  };
  document.addEventListener("DOMContentLoaded", VX.run);
})();
