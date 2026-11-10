/* Image and PDF tools – everything runs in the browser */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$;

  function toBlob(canvas, type, q) { return new Promise(function (res) { canvas.toBlob(res, type, q); }); }
  function draw(img, w, h, type) {
    var c = document.createElement("canvas"); c.width = w; c.height = h; var x = c.getContext("2d");
    if (type === "image/jpeg") { x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); }
    x.drawImage(img, 0, 0, w, h); return c;
  }
  function ext(t) { return t === "image/jpeg" ? "jpg" : t === "image/webp" ? "webp" : "png"; }
  function base(n) { return n.replace(/\.[^.]+$/, ""); }
  function note(r, msg, err) { var m = $("#m", r); m.textContent = msg; m.className = "msg" + (err ? " err" : ""); }

  VX.tool("image-compressor", {
    html: '<div id="dz"></div><div class="row"><div class="fld"><label for="q">Quality: <span id="qv">75</span>%</label><input id="q" type="range" min="10" max="100" value="75"></div><div class="fld"><label for="f">Output format</label><select id="f" class="in"><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></div></div><div class="msg" id="m"></div><div class="files" id="fl"></div>',
    init: function (r) {
      var items = [];
      VX.dropzone($("#dz", r), { accept: "image/*", multiple: true, title: "Choose images", hint: "JPG, PNG or WebP · stays on your device", onFiles: function (fs) { fs.forEach(function (f) { items.push({ file: f }); }); run(); } });
      $("#q", r).addEventListener("input", function () { $("#qv", r).textContent = $("#q", r).value; });
      $("#q", r).addEventListener("change", run); $("#f", r).addEventListener("change", run);
      function run() {
        var q = $("#q", r).value / 100, t = $("#f", r).value, list = $("#fl", r); list.innerHTML = "";
        items.forEach(function (it) {
          var row = document.createElement("div"); row.className = "file"; row.textContent = it.file.name + " – working…"; list.appendChild(row);
          VX.readImage(it.file).then(function (o) { return toBlob(draw(o.img, o.img.naturalWidth, o.img.naturalHeight, t), t, q).then(function (b) { URL.revokeObjectURL(o.url); return b; }); })
            .then(function (b) {
              var pct = Math.round((1 - b.size / it.file.size) * 100);
              row.innerHTML = "<span>" + VX.esc(it.file.name) + "<small>" + VX.bytes(it.file.size) + " → " + VX.bytes(b.size) + (pct > 0 ? " (" + pct + "% smaller)" : " (no saving – try lower quality)") + "</small></span>";
              var a = document.createElement("button"); a.type = "button"; a.className = "btn sm"; a.textContent = "Download";
              a.addEventListener("click", function () { VX.save(b, base(it.file.name) + "-compressed." + ext(t)); }); row.appendChild(a);
            }).catch(function (e) { row.textContent = it.file.name + ": " + e.message; row.className = "file err"; });
        });
      }
    }
  });

  VX.tool("image-resizer", {
    html: '<div id="dz"></div><div id="ui" hidden><div class="preview"><img id="pv" alt="Preview of your image"></div><div class="row"><div class="fld"><label for="w">Width (px)</label><input id="w" class="in" type="number" min="1" max="10000"></div><div class="fld"><label for="h">Height (px)</label><input id="h" class="in" type="number" min="1" max="10000"></div><div class="fld"><label for="f">Format</label><select id="f" class="in"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></div></div><label class="chk"><input id="lk" type="checkbox" checked> Keep proportions</label><div class="bar"><button class="btn" id="go" type="button">Resize &amp; download</button></div></div><div class="msg" id="m"></div>',
    init: function (r) {
      var cur, ratio = 1;
      VX.dropzone($("#dz", r), { accept: "image/*", title: "Choose an image", onFiles: function (fs) {
        VX.readImage(fs[0]).then(function (o) { cur = { file: fs[0], img: o.img }; ratio = o.img.naturalWidth / o.img.naturalHeight; $("#pv", r).src = o.url; $("#w", r).value = o.img.naturalWidth; $("#h", r).value = o.img.naturalHeight; $("#ui", r).hidden = false; note(r, "Original: " + o.img.naturalWidth + " × " + o.img.naturalHeight + " px"); }).catch(function (e) { note(r, e.message, 1); });
      } });
      $("#w", r).addEventListener("input", function () { if ($("#lk", r).checked) $("#h", r).value = Math.max(1, Math.round($("#w", r).value / ratio)); });
      $("#h", r).addEventListener("input", function () { if ($("#lk", r).checked) $("#w", r).value = Math.max(1, Math.round($("#h", r).value * ratio)); });
      $("#go", r).addEventListener("click", function () {
        var w = Math.round(+$("#w", r).value), h = Math.round(+$("#h", r).value), t = $("#f", r).value;
        if (!(w > 0 && h > 0 && w <= 10000 && h <= 10000)) { note(r, "Enter a width and height between 1 and 10000.", 1); return; }
        toBlob(draw(cur.img, w, h, t), t, 0.92).then(function (b) { VX.save(b, base(cur.file.name) + "-" + w + "x" + h + "." + ext(t)); note(r, "Done – " + w + " × " + h + " px, " + VX.bytes(b.size)); });
      });
    }
  });

  VX.tool("image-converter", {
    html: '<div id="dz"></div><div class="row"><div class="fld"><label for="f">Convert to</label><select id="f" class="in"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></div></div><div class="msg" id="m"></div><div class="files" id="fl"></div>',
    init: function (r) {
      VX.dropzone($("#dz", r), { accept: "image/*", multiple: true, title: "Choose images", hint: "PNG, JPG, WebP, GIF, BMP…", onFiles: function (fs) {
        var t = $("#f", r).value;
        fs.forEach(function (f) {
          var row = document.createElement("div"); row.className = "file"; row.textContent = f.name + " – converting…"; $("#fl", r).appendChild(row);
          VX.readImage(f).then(function (o) { return toBlob(draw(o.img, o.img.naturalWidth, o.img.naturalHeight, t), t, 0.92); }).then(function (b) {
            if (!b) throw new Error("Your browser cannot save this format.");
            row.innerHTML = "<span>" + VX.esc(f.name) + "<small>→ " + ext(t).toUpperCase() + ", " + VX.bytes(b.size) + "</small></span>";
            var a = document.createElement("button"); a.type = "button"; a.className = "btn sm"; a.textContent = "Download"; a.addEventListener("click", function () { VX.save(b, base(f.name) + "." + ext(t)); }); row.appendChild(a);
          }).catch(function (e) { row.textContent = f.name + ": " + e.message; row.className = "file err"; });
        });
      } });
    }
  });

  VX.tool("image-to-base64", {
    html: '<div id="dz"></div><div class="preview" id="pw" hidden><img id="pv" alt="Preview"></div><div class="fld"><label for="o">Base64 data URI</label><textarea id="o" class="in" readonly></textarea></div><div class="bar"><button class="btn sm" id="cp" type="button">Copy</button></div><div class="msg" id="m"></div>',
    init: function (r) {
      VX.dropzone($("#dz", r), { accept: "image/*", title: "Choose an image", onFiles: function (fs) {
        var rd = new FileReader(); rd.onload = function () { $("#o", r).value = rd.result; $("#pv", r).src = rd.result; $("#pw", r).hidden = false; note(r, VX.fmt(rd.result.length, 0) + " characters"); }; rd.readAsDataURL(fs[0]);
      } });
      $("#cp", r).addEventListener("click", function (e) { VX.copy($("#o", r).value, e.target); });
    }
  });

  function listUI(r, items, render) {
    var l = $("#fl", r); l.innerHTML = "";
    items.forEach(function (it, i) {
      var row = document.createElement("div"); row.className = "file";
      row.innerHTML = "<span>" + (i + 1) + ". " + VX.esc(it.name) + "<small>" + (it.info || "") + "</small></span>";
      [["↑", -1, "Move up"], ["↓", 1, "Move down"], ["✕", 0, "Remove"]].forEach(function (a) {
        var b = document.createElement("button"); b.type = "button"; b.className = "btn ghost sm"; b.textContent = a[0]; b.setAttribute("aria-label", a[2] + " " + it.name);
        b.addEventListener("click", function () {
          if (a[1] === 0) items.splice(i, 1); else { var j = i + a[1]; if (j < 0 || j >= items.length) return; var t = items[i]; items[i] = items[j]; items[j] = t; }
          render();
        }); row.appendChild(b);
      }); l.appendChild(row);
    });
  }
  function readBuf(f) { return new Promise(function (res, rej) { var rd = new FileReader(); rd.onload = function () { res(rd.result); }; rd.onerror = function () { rej(new Error("Could not read " + f.name)); }; rd.readAsArrayBuffer(f); }); }

  VX.tool("image-to-pdf", {
    html: '<div id="dz"></div><div class="files" id="fl"></div><div class="row"><div class="fld"><label for="pg">Page size</label><select id="pg" class="in"><option value="fit">Same as image</option><option value="a4">A4</option></select></div></div><div class="bar"><button class="btn" id="go" type="button">Create PDF</button></div><div class="msg" id="m"></div>',
    init: function (r) {
      var items = [];
      function render() { listUI(r, items, render); }
      VX.dropzone($("#dz", r), { accept: "image/jpeg,image/png,image/webp,image/*", multiple: true, title: "Choose images", hint: "Pages follow the order below", onFiles: function (fs) { fs.forEach(function (f) { items.push({ name: f.name, file: f, info: VX.bytes(f.size) }); }); render(); } });
      $("#go", r).addEventListener("click", function () {
        if (!items.length) { note(r, "Add at least one image first.", 1); return; }
        note(r, "Creating PDF…");
        VX.pdfLib().then(function (L) {
          return L.PDFDocument.create().then(function (doc) {
            var chain = Promise.resolve();
            items.forEach(function (it) {
              chain = chain.then(function () { return VX.readImage(it.file); }).then(function (o) {
                var cv = draw(o.img, o.img.naturalWidth, o.img.naturalHeight, "image/jpeg"); URL.revokeObjectURL(o.url);
                return toBlob(cv, "image/jpeg", 0.92).then(readBuf).then(function (buf) { return doc.embedJpg(buf); });
              }).then(function (im) {
                var w = im.width, h = im.height, pw = w, ph = h, x = 0, y = 0;
                if ($("#pg", r).value === "a4") { pw = 595.28; ph = 841.89; var s = Math.min((pw - 40) / w, (ph - 40) / h); w *= s; h *= s; x = (pw - w) / 2; y = (ph - h) / 2; }
                doc.addPage([pw, ph]).drawImage(im, { x: x, y: y, width: w, height: h });
              });
            });
            return chain.then(function () { return doc.save(); });
          });
        }).then(function (bytes) { VX.save(new Blob([bytes], { type: "application/pdf" }), "images.pdf"); note(r, "Done – " + items.length + " page(s)."); }).catch(function (e) { note(r, e.message, 1); });
      });
    }
  });

  VX.tool("pdf-merge", {
    html: '<div id="dz"></div><div class="files" id="fl"></div><div class="bar"><button class="btn" id="go" type="button">Merge PDFs</button></div><div class="msg" id="m"></div>',
    init: function (r) {
      var items = [];
      function render() { listUI(r, items, render); }
      VX.dropzone($("#dz", r), { accept: "application/pdf", multiple: true, title: "Choose PDF files", hint: "Add two or more, then reorder", onFiles: function (fs) { fs.forEach(function (f) { items.push({ name: f.name, file: f, info: VX.bytes(f.size) }); }); render(); } });
      $("#go", r).addEventListener("click", function () {
        if (items.length < 2) { note(r, "Add at least two PDF files.", 1); return; }
        note(r, "Merging…");
        VX.pdfLib().then(function (L) {
          return L.PDFDocument.create().then(function (out) {
            var chain = Promise.resolve();
            items.forEach(function (it) {
              chain = chain.then(function () { return readBuf(it.file); }).then(function (b) { return L.PDFDocument.load(b); }).then(function (d) { return out.copyPages(d, d.getPageIndices()); }).then(function (ps) { ps.forEach(function (p) { out.addPage(p); }); });
            });
            return chain.then(function () { return out.save(); }).then(function (b) { return { b: b, n: out.getPageCount() }; });
          });
        }).then(function (o) { VX.save(new Blob([o.b], { type: "application/pdf" }), "merged.pdf"); note(r, "Done – merged file has " + o.n + " pages."); }).catch(function (e) { note(r, "Could not merge. A file may be damaged or password protected. " + e.message, 1); });
      });
    }
  });

  function parseRanges(s, max) {
    var out = [];
    s.split(",").forEach(function (p) {
      p = p.trim(); if (!p) return; var m = p.match(/^(\d+)(?:\s*-\s*(\d+))?$/); if (!m) throw new Error("Use ranges like 1-3, 5, 8-10.");
      var a = +m[1], b = m[2] ? +m[2] : a; if (a < 1 || b < a || b > max) throw new Error("Pages must be between 1 and " + max + ".");
      for (var i = a; i <= b; i++) out.push(i - 1);
    }); if (!out.length) throw new Error("Enter the pages you want to keep."); return out;
  }
  VX.tool("pdf-split", {
    html: '<div id="dz"></div><div id="ui" hidden><div class="msg" id="info"></div><div class="fld"><label for="rg">Pages to extract</label><input id="rg" class="in" type="text" placeholder="e.g. 1-3, 5, 8-10"></div><div class="bar"><button class="btn" id="go" type="button">Extract pages</button><button class="btn ghost" id="all" type="button">Every page as separate file</button></div></div><div class="msg" id="m"></div>',
    init: function (r) {
      var L, src, name, n;
      VX.dropzone($("#dz", r), { accept: "application/pdf", title: "Choose a PDF", onFiles: function (fs) {
        name = base(fs[0].name);
        VX.pdfLib().then(function (l) { L = l; return readBuf(fs[0]); }).then(function (b) { return L.PDFDocument.load(b); }).then(function (d) { src = d; n = d.getPageCount(); $("#info", r).textContent = fs[0].name + " has " + n + " page" + (n === 1 ? "" : "s") + "."; $("#ui", r).hidden = false; note(r, ""); }).catch(function (e) { note(r, "Could not open this PDF. " + e.message, 1); });
      } });
      function make(idx) { return L.PDFDocument.create().then(function (o) { return o.copyPages(src, idx).then(function (ps) { ps.forEach(function (p) { o.addPage(p); }); return o.save(); }); }); }
      $("#go", r).addEventListener("click", function () {
        try { var idx = parseRanges($("#rg", r).value, n); make(idx).then(function (b) { VX.save(new Blob([b], { type: "application/pdf" }), name + "-pages.pdf"); note(r, "Done – " + idx.length + " page(s) extracted."); }); } catch (e) { note(r, e.message, 1); }
      });
      $("#all", r).addEventListener("click", function () {
        if (n > 30 && !confirm("This will download " + n + " files. Continue?")) return;
        var c = Promise.resolve(); for (var i = 0; i < n; i++) (function (i) { c = c.then(function () { return make([i]); }).then(function (b) { VX.save(new Blob([b], { type: "application/pdf" }), name + "-page-" + (i + 1) + ".pdf"); return new Promise(function (s) { setTimeout(s, 250); }); }); })(i);
        c.then(function () { note(r, "Done – " + n + " files."); });
      });
    }
  });
})();
