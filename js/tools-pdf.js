/* PDF tools: editor, page organizer, PDF to image, page numbers and watermark. Everything runs in the browser. */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$;

  function note(r, msg, err, good) { var m = $("#m", r); if (!m) return; m.textContent = msg; m.className = "msg" + (err ? " err" : good ? " good" : ""); }
  function readBuf(f) { return f.arrayBuffer ? f.arrayBuffer() : new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsArrayBuffer(f); }); }
  function base(n) { return n.replace(/\.[^.]+$/, ""); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function hexRgb(h, L) { var n = parseInt(h.replace("#", ""), 16); return L.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); }
  function openDoc(buf) { return VX.pdfJs().then(function (js) { return js.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise; }); }
  function friendly(e) {
    var m = String((e && e.message) || e);
    if (/password/i.test(m) || (e && e.name === "PasswordException")) return "This PDF is password protected. Remove the password first, then try again.";
    return "Could not open this PDF. It may be damaged. (" + m + ")";
  }
  function renderTo(page, canvas, cssWidth) {
    var v1 = page.getViewport({ scale: 1 }), s = cssWidth / v1.width, dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var vp = page.getViewport({ scale: s * dpr });
    canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
    canvas.style.width = Math.round(vp.width / dpr) + "px"; canvas.style.height = Math.round(vp.height / dpr) + "px";
    return page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
  }
  /* map a point in the displayed page (points, origin top-left) to PDF user space. box = {x,y,w,h} visible box, rot = page rotation */
  function toUser(box, rot, px, py) {
    switch (((rot % 360) + 360) % 360) {
      case 90: return { x: box.x + py, y: box.y + px };
      case 180: return { x: box.x + box.w - px, y: box.y + py };
      case 270: return { x: box.x + box.w - py, y: box.y + box.h - px };
      default: return { x: box.x + px, y: box.y + box.h - py };
    }
  }
  function safeText(font, text) {
    var bad = 0, out = "";
    Array.prototype.forEach.call(text, function (ch) { try { font.widthOfTextAtSize(ch, 10); out += ch; } catch (e) { if (ch !== "\n") { out += "?"; bad++; } else out += ch; } });
    return { text: out, bad: bad };
  }
  function toBlob(canvas, type, q) { return new Promise(function (res) { canvas.toBlob(res, type, q); }); }

  /* ---------- tiny ZIP writer (store, no compression) ---------- */
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function makeZip(files) {
    var parts = [], central = [], off = 0, enc = new TextEncoder();
    files.forEach(function (f) {
      var name = enc.encode(f.name), crc = crc32(f.data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, 0, true); h.setUint16(12, 0x21, true);
      h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(h.buffer, name, f.data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true);
      c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(c.buffer, name);
      off += 30 + name.length + f.data.length;
    });
    var csize = 0; central.forEach(function (b) { csize += b.byteLength || b.length; });
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(central, [e.buffer]), { type: "application/zip" });
  }

  /* =====================================================================
     PDF EDITOR
     ===================================================================== */

  /* ---------- same-font text replacement helpers ---------- */
  var CP_HI = [0x20AC, 0, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0, 0x017D, 0, 0, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014, 0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0, 0x017E, 0x0178];
  var WIN = (function () { var m = {}, c; for (c = 32; c < 256; c++) { var u = (c >= 128 && c < 160) ? CP_HI[c - 128] : c; if (u) m[String.fromCharCode(u)] = c; } m[" "] = 160; return m; })();
  function hex(n, nb) { var h = n.toString(16); while (h.length < nb * 2) h = "0" + h; return h; }
  function rootBase() { return document.documentElement.getAttribute("data-root") || "/"; }
  var fontCache = {};
  function loadFontData() { return window.VX.pdfFontData ? Promise.resolve(VX.pdfFontData) : VX.load(rootBase() + "js/pdf-fontdata.js").then(function () { return VX.pdfFontData; }); }
  function fetchFont(key) {
    if (!fontCache[key]) fontCache[key] = fetch(rootBase() + "fonts/pdf/vx-" + key + ".ttf").then(function (r) { if (!r.ok) throw new Error("font"); return r.arrayBuffer(); }).then(function (b) { return new Uint8Array(b); });
    return fontCache[key];
  }
  /* pick the bundled look-alike for a PDF font name (Arial/Helvetica -> sans, Times -> serif, Calibri -> cal ...) */
  function pickLook(name, f) {
    var n = String(name || "").replace(/^[A-Z]{6}\+/, "").toLowerCase(), fam;
    if (/mono|courier|consolas|menlo|cousine|lucida console|typewriter/.test(n) || (f && f.mono)) fam = "mono";
    else if (/calibri|carlito/.test(n)) fam = "cal";
    else if (/cambria|caladea/.test(n)) fam = "cam";
    else if (/sans|arial|helvet|verdana|tahoma|segoe|roboto|open|lato|calibri/.test(n)) fam = "sans";
    else if (/times|serif|georgia|garamond|palatino|book|minion|tinos|century|didot|baskerville|charter|roman|cmr/.test(n) || (f && f.serif)) fam = "serif";
    else fam = "sans";
    var b = /bold|black|heavy|demi|extrabold|-bd|,bd/.test(n) || (f && f.bold), i = /italic|oblique|-it\b|,it\b|ital/.test(n) || (f && f.italic);
    return fam + "-" + (b && i ? "bi" : b ? "b" : i ? "i" : "r");
  }
  /* embed one bundled TrueType in the PDF (simple font, WinAnsi) and return an encoder */
  function embedLook(doc, L, key, cache) {
    if (cache["look:" + key]) return Promise.resolve(cache["look:" + key]);
    return Promise.all([loadFontData(), fetchFont(key)]).then(function (a) {
      var d = a[0][key], bytes = a[1], ctx = doc.context;
      var ff = ctx.flateStream(bytes, { Length1: bytes.length }), ffRef = ctx.register(ff);
      var flags = 32 | (d.sf ? 2 : 0) | (d.fx ? 1 : 0) | (d.i ? 64 : 0) | (d.b ? 1 << 18 : 0);
      var desc = ctx.register(ctx.obj({ Type: "FontDescriptor", FontName: d.n, Flags: flags, FontBBox: d.bb, ItalicAngle: d.it || 0, Ascent: d.asc, Descent: d.desc, CapHeight: d.cap, StemV: d.b ? 140 : 80, FontFile2: ffRef }));
      var fref = ctx.register(ctx.obj({ Type: "Font", Subtype: "TrueType", BaseFont: d.n, FirstChar: 32, LastChar: 255, Widths: d.w, Encoding: "WinAnsiEncoding", FontDescriptor: desc }));
      var face = { ref: fref, kind: "look", enc: function (text) {
        var hx = "", bad = 0;
        Array.prototype.forEach.call(text, function (ch) { var c = WIN[ch]; if (c && d.w[c - 32] > 0) hx += hex(c, 1); else { bad++; hx += hex(63, 1); } });
        return { seg: [hx], bad: bad };
      } };
      cache["look:" + key] = face; return face;
    });
  }
  /* parse a ToUnicode CMap into  character -> code  (only single UTF-16 units) */
  function cmapReverse(txt) {
    var rev = {}, nb = 1;
    function strip(t) { return t.replace(/[<>\s]/g, ""); }
    function uni(h) { if (h.length <= 2) return String.fromCharCode(parseInt(h, 16)); var o = ""; for (var i = 0; i + 3 < h.length + 1 && i + 4 <= h.length; i += 4) o += String.fromCharCode(parseInt(h.substr(i, 4), 16)); return o; }
    function put(code, ch, n) { if (ch.length === 1 && ch !== "\u0000" && rev[ch] === undefined) { rev[ch] = code; if (n > nb) nb = n; } }
    var re = /beginbf(char|range)([\s\S]*?)endbf(?:char|range)/g, m;
    while ((m = re.exec(txt))) {
      var t = m[2].match(/<[0-9a-fA-F\s]*>|\[|\]/g) || [], i = 0;
      if (m[1] === "char") { for (; i + 1 < t.length; i += 2) put(parseInt(strip(t[i]), 16), uni(strip(t[i + 1])), strip(t[i]).length / 2); }
      else {
        while (i + 1 < t.length) {
          var lo = t[i++], hi = t[i++], a0 = parseInt(strip(lo), 16), a1 = parseInt(strip(hi), 16), n = strip(lo).length / 2;
          if (t[i] === "[") { i++; var k = 0; while (i < t.length && t[i] !== "]") { put(a0 + k, uni(strip(t[i])), n); k++; i++; } i++; }
          else { var d = uni(strip(t[i++])); if (!d) continue; for (var c = a0; c <= a1 && c - a0 < 65536; c++) put(c, String.fromCharCode(d.charCodeAt(0) + (c - a0)), n); }
        }
      }
    }
    return { rev: rev, nb: nb };
  }
  /* find the font already inside the PDF page (by BaseFont) and build an encoder that writes with it */
  function findPdfFace(doc, L, pg, baseName) {
    try {
      var res = pg.node.Resources(); if (!res) return null;
      var fd = res.lookupMaybe(L.PDFName.of("Font"), L.PDFDict); if (!fd) return null;
      var hit = null;
      fd.entries().forEach(function (e) {
        if (hit) return; var d = doc.context.lookupMaybe(e[1], L.PDFDict); if (!d) return;
        var bf = d.lookupMaybe(L.PDFName.of("BaseFont"), L.PDFName); if (bf && bf.decodeText() === baseName) hit = { tag: e[0], dict: d };
      });
      if (!hit) return null;
      var d = hit.dict, sub = d.lookupMaybe(L.PDFName.of("Subtype"), L.PDFName), st = sub ? sub.decodeText() : "";
      if (st !== "TrueType" && st !== "Type1" && st !== "Type0") return null;
      var fdesc = d;
      if (st === "Type0") { var da = d.lookupMaybe(L.PDFName.of("DescendantFonts"), L.PDFArray); fdesc = da && da.lookupMaybe(0, L.PDFDict); if (!fdesc) return null; }
      var desc = fdesc.lookupMaybe(L.PDFName.of("FontDescriptor"), L.PDFDict), emb = desc && (desc.has(L.PDFName.of("FontFile")) || desc.has(L.PDFName.of("FontFile2")) || desc.has(L.PDFName.of("FontFile3")));
      var tu = d.lookup(L.PDFName.of("ToUnicode")), map = null;
      if (tu && tu.contents !== undefined) map = cmapReverse(new TextDecoder("latin1").decode(L.decodePDFRawStream(tu).decode()));
      var winOk = false;
      if (!map && st !== "Type0" && !emb) { var en = d.lookup(L.PDFName.of("Encoding")); winOk = !!(en && en.decodeText && en.decodeText() === "WinAnsiEncoding"); }
      if (!map && !winOk) return null;
      return { tag: hit.tag, kind: "pdf", enc: function (text) {
        var seg = [], cur = "", bad = 0;
        Array.prototype.forEach.call(text, function (ch) {
          var c = map ? map.rev[ch] : WIN[ch], nb = map ? map.nb : 1;
          if (c === undefined && ch === " " && map && map.rev[" "] !== undefined) c = map.rev[" "];
          if (c !== undefined) cur += hex(c, nb);
          else if (ch === " ") { if (cur) seg.push(cur); cur = ""; seg.push(-278); }
          else bad++;
        });
        if (cur) seg.push(cur);
        return { seg: seg, bad: bad };
      } };
    } catch (e) { return null; }
  }
  /* write text with a face at a baseline point (user space), rotated like the page */
  function putText(pg, L, face, tag, text, P, size, color, rot) {
    var e = face.enc(text);
    var a = rot * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), N = L.PDFNumber, ctx = pg.doc.context, show;
    var items = e.seg.map(function (x) { return typeof x === "number" ? N.of(x) : L.PDFHexString.of(x); });
    show = L.PDFOperator.of("TJ", [ctx.obj(items)]);
    pg.pushOperators(L.pushGraphicsState(), L.beginText(),
      L.PDFOperator.of("Tr", [N.of(0)]), L.PDFOperator.of("Tc", [N.of(0)]), L.PDFOperator.of("Tw", [N.of(0)]), L.PDFOperator.of("Tz", [N.of(100)]), L.PDFOperator.of("Ts", [N.of(0)]),
      L.setFillingColor(color), L.setFontAndSize(tag, size), L.setTextMatrix(cs, sn, -sn, cs, P.x, P.y), show, L.endText(), L.popGraphicsState());
    return e.bad;
  }

  /* cover the old text, then write the new text in the PDF's own font when it has the letters, else a matching look-alike */
  function drawRetext(doc, L, pg, pi, box, rot, o, cache) {
    var B = toUser(box, rot, o.x - 0.5, o.y + o.h);
    pg.drawRectangle({ x: B.x, y: B.y, width: o.w + 1, height: o.h, rotate: L.degrees(rot), color: hexRgb(o.bg, L), borderWidth: 0 });
    if (!o.text.trim()) return Promise.resolve({ bad: 0, how: "pdf" });
    var P = toUser(box, rot, o.x, o.base), col = hexRgb(o.color, L), key = "pdf:" + pi + ":" + o.pdfName;
    if (!(key in cache)) cache[key] = o.pdfName ? findPdfFace(doc, L, pg, o.pdfName) : null;
    var f = cache[key];
    if (f && f.enc(o.text).bad === 0) { putText(pg, L, f, f.tag, o.text, P, o.size, col, rot); return Promise.resolve({ bad: 0, how: "pdf" }); }
    return embedLook(doc, L, o.look, cache).then(function (face) {
      var tk = "tag:" + pi + ":" + o.look; if (!cache[tk]) cache[tk] = pg.node.newFontDictionary("VXF", face.ref);
      return { bad: putText(pg, L, face, cache[tk], o.text, P, o.size, col, rot), how: "look" };
    });
  }

  VX.tool("pdf-editor", {
    html: '<div id="dz"></div><div id="ed" hidden>' +
      '<div class="pe-bar" role="toolbar" aria-label="Editor tools">' +
      '<button type="button" class="btn ghost sm" data-tool="edit">Edit text</button>' +
      '<button type="button" class="btn ghost sm" data-tool="text">Add text</button>' +
      '<button type="button" class="btn ghost sm" data-tool="white">Whiteout</button>' +
      '<button type="button" class="btn ghost sm" data-tool="hl">Highlight</button>' +
      '<button type="button" class="btn ghost sm" data-act="image">Add image</button>' +
      '<button type="button" class="btn ghost sm" data-act="sign">Sign</button>' +
      '<button type="button" class="btn ghost sm" data-act="tick">✓ Tick</button>' +
      '<button type="button" class="btn ghost sm" data-act="cross">✕ Cross</button>' +
      '</div>' +
      '<div class="pe-opts"><label>Text size <input id="sz" type="number" min="6" max="120" value="16" class="in sm"></label><label>Colour <input id="cl" type="color" value="#111827"></label><button type="button" class="btn ghost sm" id="del" disabled>Delete selected</button>' +
      '<span class="pe-nav"><button type="button" class="btn ghost sm" id="pv" aria-label="Previous page">◀</button><span id="pg">Page 1 of 1</span><button type="button" class="btn ghost sm" id="nx" aria-label="Next page">▶</button></span></div>' +
      '<p class="gnote" id="hint">Pick a tool, then click on the page. “Edit text” changes existing text in its own font. Drag the ✥ handle to move an item and the corner square to resize it.</p>' +
      '<form class="pe-cmd" id="cmdf" autocomplete="off"><input id="cmd" class="in" type="text" placeholder="e.g. replace 2024 with 2025" aria-label="Type a command"><button type="submit" class="btn sm">Go</button></form>' +
      '<p class="gnote" id="cmdlog" aria-live="polite">Examples: replace 2024 with 2025 · replace Rahul with Amit on all pages · remove DRAFT · undo</p>' +
      '<div class="pe-wrap" id="wrap"><div class="pe-stage" id="stage"><canvas id="cv"></canvas><div class="pe-layer" id="ly"></div></div></div>' +
      '<div class="bar"><button class="btn" id="go" type="button">Download edited PDF</button><button class="btn ghost" id="new" type="button">Choose another PDF</button></div>' +
      '<input type="file" id="imf" accept="image/png,image/jpeg,image/webp" hidden>' +
      '</div><div class="msg" id="m"></div>',
    init: function (r) {
      var st = { pdf: null, bytes: null, name: "edited", pages: [], cur: 0, objs: [], lines: [], tool: null, sel: null, s: 1, nid: 1, busy: false };
      var stage = $("#stage", r), cv = $("#cv", r), ly = $("#ly", r), wrap = $("#wrap", r), measure = document.createElement("canvas").getContext("2d");
      var FONT = "Helvetica, Arial, sans-serif";

      VX.dropzone($("#dz", r), { accept: "application/pdf", multiple: false, title: "Choose a PDF to edit", hint: "Your file stays on your device", onFiles: function (fs) { load(fs[0]); } });

      function load(f) {
        note(r, "Opening PDF…");
        readBuf(f).then(function (buf) { st.bytes = buf; return openDoc(buf); }).then(function (pdf) {
          st.pdf = pdf; st.name = base(f.name); st.cur = 0; st.objs = []; st.lines = []; st.sel = null; st.pages = [];
          for (var i = 0; i < pdf.numPages; i++) st.objs.push([]);
          return Promise.all(Array.apply(null, Array(pdf.numPages)).map(function (_, i) { return pdf.getPage(i + 1).then(function (p) { var vp = p.getViewport({ scale: 1 }); st.pages[i] = { view: p.view, rot: p.rotate || 0, w: vp.width, h: vp.height }; }); }));
        }).then(function () { $("#dz", r).hidden = true; $("#ed", r).hidden = false; note(r, ""); showPage(0); }).catch(function (e) { note(r, friendly(e), 1); });
      }

      function fitWidth() { return Math.max(240, Math.min(wrap.clientWidth - 2, 860)); }
      function showPage(i) {
        st.cur = i; st.sel = null; var pg = st.pages[i];
        $("#pg", r).textContent = "Page " + (i + 1) + " of " + st.pages.length;
        $("#pv", r).disabled = i === 0; $("#nx", r).disabled = i === st.pages.length - 1;
        st.s = fitWidth() / pg.w;
        stage.style.width = Math.round(pg.w * st.s) + "px"; stage.style.height = Math.round(pg.h * st.s) + "px";
        st.pdf.getPage(i + 1).then(function (p) { return renderTo(p, cv, pg.w * st.s).then(function () { return getLines(i, p); }); }).then(function () { if (st.cur === i) paint(); }).catch(function () {});
        paint(); updDel();
      }
      function updDel() { $("#del", r).disabled = !st.sel; }

      /* ---- objects ---- */
      function textSize(o) {
        if (o.t === "retext") { measure.font = o.size + "px " + o.fam; o.w = Math.max(o.cw, measure.measureText(o.text || " ").width + 2); return; }
        measure.font = o.size + "px " + FONT; var lines = o.text.split("\n"), w = 0;
        lines.forEach(function (l) { w = Math.max(w, measure.measureText(l || " ").width); });
        o.w = Math.max(w + 4, o.size); o.h = lines.length * o.size * 1.2;
      }
      function place(o, dom) {
        var s = st.s; dom.style.left = o.x * s + "px"; dom.style.top = o.y * s + "px"; dom.style.width = o.w * s + "px"; dom.style.height = o.h * s + "px";
        if (o.t === "text") { dom.style.fontSize = o.size * s + "px"; dom.style.lineHeight = "1.2"; dom.style.color = o.color; }
        if (o.t === "retext") { var rt = dom.querySelector("textarea"); if (rt) { rt.style.fontSize = o.size * s + "px"; rt.style.lineHeight = o.h * s + "px"; rt.style.color = o.color; rt.style.fontFamily = o.fam; } }
      }
      function paint() {
        ly.innerHTML = "";
        st.objs[st.cur].forEach(function (o) {
          var box = el("div", "pe-obj pe-" + o.t + (st.sel === o ? " sel" : "")), inner;
          if (o.t === "text") {
            inner = el("textarea", "pe-ta"); inner.value = o.text; inner.spellcheck = false; inner.rows = 1; inner.setAttribute("aria-label", "Text");
            inner.addEventListener("input", function () { o.text = inner.value; textSize(o); place(o, box); });
            inner.addEventListener("focus", function () { select(o, true); });
            box.appendChild(inner);
          } else if (o.t === "retext") {
            box.style.background = o.bg;
            inner = el("textarea", "pe-ta pe-rta"); inner.value = o.text; inner.spellcheck = false; inner.rows = 1; inner.setAttribute("aria-label", "Edit this text");
            inner.addEventListener("input", function () {
              var v = inner.value.replace(/[\r\n]+/g, " "); if (v !== inner.value) inner.value = v; o.text = v; textSize(o); place(o, box);
              var odd = Array.prototype.filter.call(v, function (c) { return !WIN[c]; }).length;
              note(r, odd ? "Only English letters, digits and common symbols can be added. " + odd + " other character" + (odd > 1 ? "s" : "") + " will show as ?." : "", odd ? 1 : 0);
            });
            inner.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); inner.blur(); } });
            inner.addEventListener("focus", function () { select(o, true); });
            box.appendChild(inner);
          } else if (o.t === "img") { inner = el("img"); inner.src = o.data; inner.alt = ""; inner.draggable = false; box.appendChild(inner); }
          place(o, box);
          box.addEventListener("pointerdown", function (e) { if (e.target.closest(".pe-h")) return; select(o, true); });
          if (st.sel === o) {
            if (o.t !== "retext") { var mv = el("span", "pe-h pe-mv", "✥"); mv.title = "Drag to move"; box.appendChild(mv); drag(mv, o, box, "move"); }
            if (o.t !== "text" && o.t !== "retext") { var rs = el("span", "pe-h pe-rs"); rs.title = "Drag to resize"; box.appendChild(rs); drag(rs, o, box, "size"); }
          }
          ly.appendChild(box); o.dom = box;
        });
        paintHot();
      }
      /* ---- existing text on the page (for "Edit text") ---- */
      function getLines(i, p) {
        if (st.lines[i]) return Promise.resolve();
        var U = window.__pdfjs.Util, vp = p.getViewport({ scale: 1 });
        return p.getTextContent().then(function (tc) {
          var out = [], cur = null, pend = "";
          tc.items.forEach(function (it) {
            if (!it.str) return;
            var m = U.transform(vp.transform, it.transform), size = Math.hypot(m[2], m[3]);
            if (!size || !(m[0] > 0) || Math.abs(m[1]) > 0.05 * m[0]) { cur = null; pend = ""; return; }
            var blank = !it.str.trim();
            if (cur && cur.fn === it.fontName && Math.abs(m[5] - cur.base) < 0.2 * size && m[4] - (cur.x + cur.w) > -0.3 * size && m[4] - (cur.x + cur.w) < 0.9 * size) {
              if (blank) { pend += it.str; return; }
              cur.str += pend + it.str; cur.w = m[4] + it.width - cur.x; pend = ""; return;
            }
            pend = ""; cur = null; if (blank) return;
            var fo = null, sty = tc.styles[it.fontName] || {}; try { fo = p.commonObjs.get(it.fontName); } catch (e) {}
            cur = { id: out.length, str: it.str, x: m[4], base: m[5], w: it.width, size: size, fn: it.fontName, fo: fo, sty: sty };
            out.push(cur);
          });
          st.lines[i] = out;
        }).catch(function () { st.lines[i] = []; });
      }
      function paintHot() {
        var old = ly.querySelectorAll(".pe-hot"); Array.prototype.forEach.call(old, function (n) { n.remove(); });
        if (st.tool !== "edit" || !st.lines[st.cur]) return;
        var used = {}; st.objs[st.cur].forEach(function (o) { if (o.t === "retext") used[o.lineId] = 1; });
        var s = st.s, lines = st.lines[st.cur];
        if (!lines.length) { $("#hint", r).textContent = "No selectable text was found on this page. It may be a scanned picture. Use Whiteout and Add text instead."; return; }
        lines.forEach(function (ln) {
          if (used[ln.id]) return;
          var g = lineGeom(ln), b = el("div", "pe-hot"); b.title = "Click to edit this text";
          b.style.left = (g.x - 1) * s + "px"; b.style.top = g.y * s + "px"; b.style.width = (g.w + 2) * s + "px"; b.style.height = g.h * s + "px";
          b.addEventListener("pointerdown", function (e) { e.preventDefault(); e.stopPropagation(); startEdit(ln); });
          ly.appendChild(b);
        });
      }
      function lineGeom(ln) {
        var asc = Math.max((ln.fo && ln.fo.ascent) || ln.sty.ascent || 0.9, 0.8), desc = Math.min((ln.fo && ln.fo.descent) || ln.sty.descent || -0.22, -0.2);
        return { x: ln.x, y: ln.base - asc * ln.size, w: ln.w, h: (asc - desc) * ln.size, asc: asc, desc: desc };
      }
      /* find the text colour and the page colour behind it from the rendered page */
      function sampleColors(g, canvas, pageW) {
        var k = canvas.width / pageW, c = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
        var x0 = Math.max(0, Math.floor(g.x * k)), y0 = Math.max(0, Math.floor(g.y * k)), x1 = Math.min(W, Math.ceil((g.x + g.w) * k)), y1 = Math.min(H, Math.ceil((g.y + g.h) * k));
        var out = { fg: "#000000", bg: "#ffffff" }; if (x1 - x0 < 2 || y1 - y0 < 2) return out;
        function hx(a) { return "#" + a.map(function (v) { return ("0" + Math.round(v).toString(16)).slice(-2); }).join(""); }
        try {
          var px = [[], [], []], ring = 2;
          function take(x, y, w, h) { if (w < 1 || h < 1) return; var d = c.getImageData(x, y, w, h).data; for (var i = 0; i < d.length; i += 4) { px[0].push(d[i]); px[1].push(d[i + 1]); px[2].push(d[i + 2]); } }
          take(x0, Math.max(0, y0 - ring), x1 - x0, Math.min(ring, y0)); take(x0, y1, x1 - x0, Math.min(ring, H - y1));
          take(Math.max(0, x0 - ring), y0, Math.min(ring, x0), y1 - y0); take(x1, y0, Math.min(ring, W - x1), y1 - y0);
          if (!px[0].length) take(x0, y0, x1 - x0, y1 - y0);
          var bg = px.map(function (a) { a.sort(function (p, q) { return p - q; }); return a[a.length >> 1]; });
          out.bg = hx(bg);
          var d = c.getImageData(x0, y0, x1 - x0, y1 - y0).data, best = 0, ds = [];
          for (var i = 0; i < d.length; i += 4) { var e = Math.pow(d[i] - bg[0], 2) + Math.pow(d[i + 1] - bg[1], 2) + Math.pow(d[i + 2] - bg[2], 2); ds.push(e); if (e > best) best = e; }
          if (best > 900) { var sum = [0, 0, 0], n = 0; for (var j = 0; j < ds.length; j++) if (ds[j] > best * 0.7) { sum[0] += d[j * 4]; sum[1] += d[j * 4 + 1]; sum[2] += d[j * 4 + 2]; n++; } out.fg = hx([sum[0] / n, sum[1] / n, sum[2] / n]); }
          else { var lum = (bg[0] * 299 + bg[1] * 587 + bg[2] * 114) / 1000; out.fg = lum > 128 ? "#000000" : "#ffffff"; }
        } catch (e) {}
        return out;
      }
      function makeRetext(ln, canvas, pageW, text) {
        var g = lineGeom(ln), col = sampleColors(g, canvas, pageW), fo = ln.fo;
        var o = { t: "retext", lineId: ln.id, text: text == null ? ln.str : text, orig: ln.str, x: g.x, y: g.y, cw: g.w, w: g.w, h: g.h, base: ln.base, size: ln.size, color: col.fg, bg: col.bg,
          fam: '"' + ln.fn + '", ' + (ln.sty.fontFamily || "sans-serif"), pdfName: fo && fo.name, look: pickLook(fo && fo.name, fo) };
        textSize(o); return o;
      }
      function startEdit(ln) { add(makeRetext(ln, cv, st.pages[st.cur].w)); }

      /* ---- command box: "replace A with B", "remove A", "undo" ---- */
      var hist = [];
      function esc(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
      function say(msg, err) { var n = $("#cmdlog", r); n.textContent = msg; n.className = "gnote" + (err ? " err" : ""); }
      function replaceText(a, b, all) {
        var idx = all ? st.pages.map(function (_, i) { return i; }) : [st.cur], changed = [], made = [], pagesHit = 0, places = 0, chain = Promise.resolve();
        idx.forEach(function (pi) {
          chain = chain.then(function () { return st.pdf.getPage(pi + 1); }).then(function (p) {
            return getLines(pi, p).then(function () {
              var todo = [];
              st.lines[pi].forEach(function (ln) {
                var ex = null; st.objs[pi].forEach(function (o) { if (o.t === "retext" && o.lineId === ln.id) ex = o; });
                var cur = ex ? ex.text : ln.str, re = new RegExp(esc(a), "g"), n = (cur.match(re) || []).length;
                if (!n) { re = new RegExp(esc(a), "gi"); n = (cur.match(re) || []).length; }
                if (n) todo.push({ ln: ln, ex: ex, next: cur.replace(re, function () { return b; }), n: n });
              });
              if (!todo.length) return;
              pagesHit++;
              var cnv = null, pw = st.pages[pi].w;
              var ready = pi === st.cur ? Promise.resolve(cv) : (function () { var c = document.createElement("canvas"); return renderTo(p, c, Math.min(900, pw * 1.5)).then(function () { return c; }); })();
              return ready.then(function (c) {
                todo.forEach(function (t) {
                  places += t.n;
                  if (t.ex) { changed.push({ o: t.ex, prev: t.ex.text }); t.ex.text = t.next; textSize(t.ex); }
                  else { var o = makeRetext(t.ln, c, c === cv ? pw : pw, t.next); o.id = st.nid++; st.objs[pi].push(o); made.push({ pi: pi, o: o }); }
                });
              });
            });
          });
        });
        return chain.then(function () {
          if (!places) return { ok: false, msg: "Could not find “" + a + "” " + (all ? "on any page." : "on this page. Add “on all pages” to search every page, or use Edit text and click the line.") };
          hist.push({ changed: changed, made: made });
          st.sel = null; paint(); updDel();
          return { ok: true, msg: (b ? "Replaced “" + a + "” with “" + b + "”" : "Removed “" + a + "”") + " in " + places + " place" + (places > 1 ? "s" : "") + (all ? " on " + pagesHit + " page" + (pagesHit > 1 ? "s" : "") : " on this page") + ". Check the result, then press Download." };
        });
      }
      function runCmd(raw) {
        var t = raw.trim(); if (!t) return Promise.resolve({ ok: false, msg: "Type a command first." });
        var all = false, m;
        if (/^undo$/i.test(t)) {
          var h = hist.pop(); if (!h) return Promise.resolve({ ok: false, msg: "Nothing to undo." });
          h.changed.forEach(function (c) { c.o.text = c.prev; textSize(c.o); });
          h.made.forEach(function (c) { var a = st.objs[c.pi]; a.splice(a.indexOf(c.o), 1); });
          st.sel = null; paint(); updDel(); return Promise.resolve({ ok: true, msg: "Undone." });
        }
        t = t.replace(/\s+(?:on|in)\s+all\s+pages?\s*$/i, function () { all = true; return ""; }).replace(/\s+(?:everywhere|on every page)\s*$/i, function () { all = true; return ""; });
        if ((m = t.match(/^(?:replace|change)\s+["“'‘](.+?)["”'’]\s+(?:with|to|by)\s+["“'‘]?(.*?)["”'’]?\s*$/i)) || (m = t.match(/^(?:replace|change)\s+(.+?)\s+with\s+(.*?)\s*$/i)) || (m = t.match(/^(?:replace|change)\s+(.+?)\s+(?:to|by)\s+(.*?)\s*$/i))) {
          if (!m[1]) return Promise.resolve({ ok: false, msg: "Say what to replace, e.g. replace 2024 with 2025." });
          return replaceText(m[1], m[2], all);
        }
        if ((m = t.match(/^(?:remove|delete|erase)\s+["“'‘]?(.+?)["”'’]?\s*$/i))) return replaceText(m[1], "", all);
        return Promise.resolve({ ok: false, msg: "I did not understand that. Try: replace 2024 with 2025 · remove DRAFT · undo" });
      }
      $("#cmdf", r).addEventListener("submit", function (e) {
        e.preventDefault(); if (!st.pdf) return; var inp = $("#cmd", r); say("Working…");
        runCmd(inp.value).then(function (res) { say(res.msg, !res.ok); if (res.ok) inp.value = ""; }).catch(function (er) { say("Something went wrong. " + (er && er.message || ""), true); });
      });
      function select(o, keep) {
        if (st.sel === o) return; st.sel = o; if (o && (o.t === "text" || o.t === "retext")) { $("#sz", r).value = Math.round(o.size * 10) / 10; $("#cl", r).value = o.color; }
        if (!keep) paint(); else { paint(); if (o && (o.t === "text" || o.t === "retext")) { var ta = o.dom && o.dom.querySelector("textarea"); if (ta) try { ta.focus({ preventScroll: true }); } catch (e) {} } } updDel();
      }
      function drag(h, o, box, mode) {
        h.addEventListener("pointerdown", function (e) {
          e.preventDefault(); e.stopPropagation(); h.setPointerCapture(e.pointerId);
          var sx = e.clientX, sy = e.clientY, ox = o.x, oy = o.y, ow = o.w, oh = o.h, ar = ow / oh;
          function mvf(ev) {
            var dx = (ev.clientX - sx) / st.s, dy = (ev.clientY - sy) / st.s, pg = st.pages[st.cur];
            if (mode === "move") { o.x = Math.max(0, Math.min(pg.w - 8, ox + dx)); o.y = Math.max(0, Math.min(pg.h - 8, oy + dy)); }
            else { o.w = Math.max(10, ow + dx); o.h = o.t === "img" ? o.w / ar : Math.max(6, oh + dy); }
            place(o, box);
          }
          function up() { h.removeEventListener("pointermove", mvf); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); }
          h.addEventListener("pointermove", mvf); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
        });
      }
      function add(o) { o.id = st.nid++; st.objs[st.cur].push(o); st.sel = null; select(o, true); return o; }
      function centerPos(w, h) { var pg = st.pages[st.cur]; return { x: Math.max(0, (pg.w - w) / 2), y: Math.max(0, pg.h / 3 - h / 2) }; }
      function addImage(data, w, h, wpt) { var hpt = wpt * h / w, p = centerPos(wpt, hpt); add({ t: "img", data: data, x: p.x, y: p.y, w: wpt, h: hpt }); setTool(null); }

      /* ---- tools ---- */
      function setTool(t) {
        st.tool = t;
        Array.prototype.forEach.call(r.querySelectorAll("[data-tool]"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-tool") === t)); });
        ly.className = "pe-layer" + (t === "edit" ? " editing" : t ? " armed" : "");
        $("#hint", r).textContent = t === "edit" ? "Click any text on the page, then type to change it. It keeps the same font, size and colour." : t === "text" ? "Click where the text should go." : t === "white" || t === "hl" ? "Drag on the page to draw a box." : "Pick a tool, then click on the page. “Edit text” changes existing text in its own font. Drag the ✥ handle to move an item and the corner square to resize it.";
        paintHot();
      }
      Array.prototype.forEach.call(r.querySelectorAll("[data-tool]"), function (b) { b.addEventListener("click", function () { var t = b.getAttribute("data-tool"); setTool(st.tool === t ? null : t); }); });
      function pt(e) { var b = ly.getBoundingClientRect(); return { x: (e.clientX - b.left) / st.s, y: (e.clientY - b.top) / st.s }; }
      ly.addEventListener("pointerdown", function (e) {
        if (e.target !== ly) return;
        var p = pt(e);
        if (!st.tool) { if (st.sel) { st.sel = null; paint(); updDel(); } return; }
        e.preventDefault();
        if (st.tool === "text") {
          var o = { t: "text", text: "", size: +$("#sz", r).value || 16, color: $("#cl", r).value, x: p.x, y: p.y - 8 }; textSize(o); add(o); setTool(null); return;
        }
        var kind = st.tool, o2 = { t: kind === "white" ? "white" : "hl", x: p.x, y: p.y, w: 1, h: 1 };
        st.objs[st.cur].push(o2); st.sel = null; paint();
        var box = o2.dom; ly.setPointerCapture(e.pointerId);
        function mvf(ev) { var q = pt(ev); o2.x = Math.min(p.x, q.x); o2.y = Math.min(p.y, q.y); o2.w = Math.abs(q.x - p.x); o2.h = Math.abs(q.y - p.y); place(o2, box); }
        function up() {
          ly.removeEventListener("pointermove", mvf); ly.removeEventListener("pointerup", up); ly.removeEventListener("pointercancel", up);
          if (o2.w < 4 || o2.h < 4) { st.objs[st.cur].splice(st.objs[st.cur].indexOf(o2), 1); paint(); } else { o2.id = st.nid++; select(o2, false); }
          setTool(null);
        }
        ly.addEventListener("pointermove", mvf); ly.addEventListener("pointerup", up); ly.addEventListener("pointercancel", up);
      });

      $("#del", r).addEventListener("click", delSel);
      function delSel() { if (!st.sel) return; var a = st.objs[st.cur]; a.splice(a.indexOf(st.sel), 1); st.sel = null; paint(); updDel(); }
      r.addEventListener("keydown", function (e) { if ((e.key === "Delete" || e.key === "Backspace") && st.sel && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "INPUT") { e.preventDefault(); delSel(); } });
      $("#sz", r).addEventListener("input", function () { if (st.sel && (st.sel.t === "text" || st.sel.t === "retext")) { st.sel.size = Math.max(4, Math.min(120, +this.value || 16)); textSize(st.sel); place(st.sel, st.sel.dom); } });
      $("#cl", r).addEventListener("input", function () { if (st.sel && (st.sel.t === "text" || st.sel.t === "retext")) { st.sel.color = this.value; place(st.sel, st.sel.dom); } });
      $("#pv", r).addEventListener("click", function () { if (st.cur > 0) showPage(st.cur - 1); });
      $("#nx", r).addEventListener("click", function () { if (st.cur < st.pages.length - 1) showPage(st.cur + 1); });
      $("#new", r).addEventListener("click", function () { $("#ed", r).hidden = true; $("#dz", r).hidden = false; st.pdf = null; note(r, ""); });
      var rz; window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { if (st.pdf && !$("#ed", r).hidden) { var sel = st.sel; showPage(st.cur); st.sel = sel; paint(); } }, 200); });

      /* ---- image, tick, cross, sign ---- */
      Array.prototype.forEach.call(r.querySelectorAll("[data-act]"), function (b) {
        b.addEventListener("click", function () {
          var a = b.getAttribute("data-act");
          if (a === "image") $("#imf", r).click();
          else if (a === "sign") signPad();
          else mark(a);
        });
      });
      $("#imf", r).addEventListener("change", function () {
        var f = this.files[0]; this.value = ""; if (!f) return;
        VX.readImage(f).then(function (o) {
          var k = Math.min(1, 1400 / Math.max(o.img.naturalWidth, o.img.naturalHeight)), c = document.createElement("canvas");
          c.width = Math.round(o.img.naturalWidth * k); c.height = Math.round(o.img.naturalHeight * k); c.getContext("2d").drawImage(o.img, 0, 0, c.width, c.height); URL.revokeObjectURL(o.url);
          var pg = st.pages[st.cur]; addImage(c.toDataURL("image/png"), c.width, c.height, Math.min(220, pg.w * .5));
        }).catch(function (e) { note(r, e.message, 1); });
      });
      function mark(kind) {
        var c = document.createElement("canvas"); c.width = c.height = 96; var x = c.getContext("2d");
        x.strokeStyle = $("#cl", r).value; x.lineWidth = 12; x.lineCap = "round"; x.lineJoin = "round"; x.beginPath();
        if (kind === "tick") { x.moveTo(16, 52); x.lineTo(38, 74); x.lineTo(82, 22); } else { x.moveTo(20, 20); x.lineTo(76, 76); x.moveTo(76, 20); x.lineTo(20, 76); }
        x.stroke(); addImage(c.toDataURL("image/png"), 96, 96, 22);
      }
      function signPad() {
        var m = el("div", "pe-modal"), box = el("div", "pe-modal-box", '<h3>Draw your signature</h3><canvas width="520" height="200" class="pe-sig" aria-label="Signature drawing area"></canvas><div class="bar"><button class="btn" type="button" data-k="ok">Add signature</button><button class="btn ghost" type="button" data-k="clr">Clear</button><button class="btn ghost" type="button" data-k="no">Cancel</button></div><p class="gnote">Draw with your finger or mouse.</p>');
        m.appendChild(box); document.body.appendChild(m);
        var c = box.querySelector("canvas"), x = c.getContext("2d"), down = false, inked = false;
        x.strokeStyle = "#111827"; x.lineWidth = 3.2; x.lineCap = "round"; x.lineJoin = "round";
        function p(e) { var b = c.getBoundingClientRect(); return { x: (e.clientX - b.left) * c.width / b.width, y: (e.clientY - b.top) * c.height / b.height }; }
        c.addEventListener("pointerdown", function (e) { e.preventDefault(); c.setPointerCapture(e.pointerId); down = true; inked = true; var q = p(e); x.beginPath(); x.moveTo(q.x, q.y); x.lineTo(q.x + .1, q.y + .1); x.stroke(); });
        c.addEventListener("pointermove", function (e) { if (!down) return; var q = p(e); x.lineTo(q.x, q.y); x.stroke(); });
        c.addEventListener("pointerup", function () { down = false; }); c.addEventListener("pointercancel", function () { down = false; });
        function close() { m.remove(); }
        box.querySelector('[data-k="no"]').addEventListener("click", close);
        box.querySelector('[data-k="clr"]').addEventListener("click", function () { x.clearRect(0, 0, c.width, c.height); inked = false; });
        box.querySelector('[data-k="ok"]').addEventListener("click", function () {
          if (!inked) return;
          var d = x.getImageData(0, 0, c.width, c.height).data, x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
          for (var yy = 0; yy < c.height; yy++) for (var xx = 0; xx < c.width; xx++) if (d[(yy * c.width + xx) * 4 + 3] > 8) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
          var w = x1 - x0 + 8, h = y1 - y0 + 8, t = document.createElement("canvas"); t.width = w; t.height = h; t.getContext("2d").drawImage(c, x0 - 4, y0 - 4, w, h, 0, 0, w, h);
          close(); addImage(t.toDataURL("image/png"), w, h, Math.min(150, w * .6));
        });
      }

      /* ---- export ---- */
      $("#go", r).addEventListener("click", function () {
        var total = st.objs.reduce(function (n, a) { return n + a.length; }, 0);
        if (!total) { note(r, "Change some text or add text, an image or a box first.", 1); return; }
        note(r, "Building your PDF…");
        VX.pdfLib().then(function (L) {
          return L.PDFDocument.load(st.bytes.slice(0)).then(function (doc) {
            return doc.embedFont(L.StandardFonts.Helvetica).then(function (font) {
              var pages = doc.getPages(), bad = 0, chain = Promise.resolve(), cache = {}, same = 0, close = 0;
              st.objs.forEach(function (list, i) {
                if (!list.length) return;
                var pg = pages[i], info = st.pages[i], box = { x: info.view[0], y: info.view[1], w: info.view[2] - info.view[0], h: info.view[3] - info.view[1] }, rot = info.rot;
                list.forEach(function (o) {
                  if (o.t === "text") {
                    var sc = safeText(font, o.text); bad += sc.bad;
                    sc.text.split("\n").forEach(function (line, li) {
                      if (!line) return;
                      var P = toUser(box, rot, o.x, o.y + li * o.size * 1.2 + o.size * .9465);
                      pg.drawText(line, { x: P.x, y: P.y, size: o.size, font: font, color: hexRgb(o.color, L), rotate: L.degrees(rot) });
                    });
                  } else if (o.t === "retext") {
                    if (o.text === o.orig) return;
                    chain = chain.then(function () { return drawRetext(doc, L, pg, i, box, rot, o, cache); }).then(function (res) { bad += res.bad; if (res.how === "pdf") same++; else close++; });
                  } else if (o.t === "white" || o.t === "hl") {
                    var B = toUser(box, rot, o.x, o.y + o.h);
                    pg.drawRectangle({ x: B.x, y: B.y, width: o.w, height: o.h, rotate: L.degrees(rot), color: o.t === "white" ? L.rgb(1, 1, 1) : L.rgb(1, .92, 0), opacity: o.t === "white" ? 1 : .4, blendMode: o.t === "hl" ? L.BlendMode.Multiply : undefined, borderWidth: 0 });
                  } else if (o.t === "img") {
                    chain = chain.then(function () { var bin = atob(o.data.split(",")[1]), u = new Uint8Array(bin.length); for (var k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k); return doc.embedPng(u); }).then(function (im) {
                      var B2 = toUser(box, rot, o.x, o.y + o.h); pg.drawImage(im, { x: B2.x, y: B2.y, width: o.w, height: o.h, rotate: L.degrees(rot) });
                    });
                  }
                });
              });
              return chain.then(function () { return doc.save(); }).then(function (b) { return { b: b, bad: bad, same: same, close: close }; });
            });
          });
        }).then(function (o) {
          VX.save(new Blob([o.b], { type: "application/pdf" }), st.name + "-edited.pdf");
          var extra = (o.same ? " " + o.same + " text change" + (o.same > 1 ? "s" : "") + " used the PDF’s own font." : "") + (o.close ? " " + o.close + " used a close matching font because the PDF’s own font does not contain every letter you typed." : "");
          note(r, o.bad ? "Done. " + o.bad + " character" + (o.bad > 1 ? "s" : "") + " outside the basic Latin set were replaced with ? because the font cannot draw them." + extra : "Done – your edited PDF has been downloaded." + extra, 0, !o.bad);
        }).catch(function (e) { note(r, "Could not save the PDF. " + e.message, 1); });
      });
    }
  });

  /* =====================================================================
     PDF PAGE ORGANIZER
     ===================================================================== */
  VX.tool("pdf-organizer", {
    html: '<div id="dz"></div><div id="ui" hidden><p class="gnote" id="info"></p><div class="bar"><button class="btn ghost sm" id="addpdf" type="button">Add another PDF</button><button class="btn ghost sm" id="addblank" type="button">Add blank page</button></div><div class="po-grid" id="grid"></div><div class="bar"><button class="btn" id="go" type="button">Download PDF</button><button class="btn ghost" id="new" type="button">Start over</button></div><input type="file" id="more" accept="application/pdf" hidden></div><div class="msg" id="m"></div>',
    init: function (r) {
      var docs = [], items = [], name = "organized", grid = $("#grid", r), busy = 0;
      VX.dropzone($("#dz", r), { accept: "application/pdf", multiple: false, title: "Choose a PDF", hint: "Rotate, delete and reorder its pages", onFiles: function (fs) { name = base(fs[0].name); addFile(fs[0], true); } });
      $("#addpdf", r).addEventListener("click", function () { $("#more", r).click(); });
      $("#more", r).addEventListener("change", function () { var f = this.files[0]; this.value = ""; if (f) addFile(f, false); });
      $("#addblank", r).addEventListener("click", function () { items.push({ blank: true, rot: 0 }); paint(); });
      $("#new", r).addEventListener("click", function () { docs = []; items = []; $("#ui", r).hidden = true; $("#dz", r).hidden = false; note(r, ""); });

      function addFile(f, first) {
        note(r, "Reading pages…"); busy++;
        readBuf(f).then(function (buf) { return openDoc(buf).then(function (pdf) { return { buf: buf, pdf: pdf, name: f.name }; }); }).then(function (d) {
          var di = docs.push(d) - 1; if (first) items = [];
          for (var i = 0; i < d.pdf.numPages; i++) items.push({ doc: di, i: i, rot: 0 });
          $("#dz", r).hidden = true; $("#ui", r).hidden = false; note(r, ""); paint();
        }).catch(function (e) { note(r, friendly(e), 1); }).then(function () { busy--; });
      }
      var thumbQ = Promise.resolve();
      function thumb(it, cv) {
        thumbQ = thumbQ.then(function () { if (it.thumb) { cv.getContext("2d").drawImage(it.thumb, 0, 0); return; } return docs[it.doc].pdf.getPage(it.i + 1).then(function (p) { return renderTo(p, cv, 140).then(function () { var c = document.createElement("canvas"); c.width = cv.width; c.height = cv.height; c.getContext("2d").drawImage(cv, 0, 0); it.thumb = c; it.tw = cv.style.width; it.th = cv.style.height; }); }); }).catch(function () {});
      }
      function paint() {
        grid.innerHTML = ""; $("#info", r).textContent = items.length + " page" + (items.length === 1 ? "" : "s") + ". Use the buttons on each page.";
        items.forEach(function (it, n) {
          var card = el("div", "po-card"), vw = el("div", "po-view"), cv = el("canvas");
          if (it.blank) { cv.width = 140; cv.height = 198; cv.style.width = "140px"; cv.style.height = "198px"; var x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 140, 198); x.fillStyle = "#9ca3af"; x.font = "13px sans-serif"; x.textAlign = "center"; x.fillText("Blank page", 70, 102); }
          else { if (it.thumb) { cv.width = it.thumb.width; cv.height = it.thumb.height; cv.style.width = it.tw; cv.style.height = it.th; } thumb(it, cv); }
          var rot = ((it.rot % 360) + 360) % 360, swap = rot === 90 || rot === 270; cv.style.transform = "rotate(" + rot + "deg)";
          vw.appendChild(cv); card.appendChild(vw);
          if (!it.blank) { var w = parseFloat(cv.style.width) || 140, h = parseFloat(cv.style.height) || 198; vw.style.width = (swap ? h : w) + "px"; vw.style.height = (swap ? w : h) + "px"; cv.style.margin = swap ? ((h - w) / 2) + "px " + ((w - h) / 2) + "px" : "0"; }
          else { vw.style.width = (swap ? 198 : 140) + "px"; vw.style.height = (swap ? 140 : 198) + "px"; cv.style.margin = swap ? "29px -29px" : "0"; }
          card.appendChild(el("div", "po-n", "Page " + (n + 1) + (it.doc > 0 ? " · file " + (it.doc + 1) : "")));
          var bar = el("div", "po-btns");
          [["◀", "Move left", function () { if (n > 0) { items.splice(n - 1, 0, items.splice(n, 1)[0]); paint(); } }, n === 0],
           ["▶", "Move right", function () { if (n < items.length - 1) { items.splice(n + 1, 0, items.splice(n, 1)[0]); paint(); } }, n === items.length - 1],
           ["↺", "Rotate left", function () { it.rot -= 90; paint(); }],
           ["↻", "Rotate right", function () { it.rot += 90; paint(); }],
           ["✕", "Delete page", function () { items.splice(n, 1); paint(); }]].forEach(function (b) {
            var bt = el("button", "po-b", b[0]); bt.type = "button"; bt.title = b[1]; bt.setAttribute("aria-label", b[1] + " " + (n + 1)); if (b[3]) bt.disabled = true; bt.addEventListener("click", b[2]); bar.appendChild(bt);
          });
          card.appendChild(bar); grid.appendChild(card);
        });
      }
      $("#go", r).addEventListener("click", function () {
        if (!items.length) { note(r, "There are no pages left to save.", 1); return; }
        note(r, "Building your PDF…");
        VX.pdfLib().then(function (L) {
          var libs = {}, out;
          function lib(di) { return libs[di] ? Promise.resolve(libs[di]) : L.PDFDocument.load(docs[di].buf.slice(0)).then(function (d) { libs[di] = d; return d; }); }
          return L.PDFDocument.create().then(function (o) {
            out = o; var chain = Promise.resolve();
            items.forEach(function (it) {
              chain = chain.then(function () {
                if (it.blank) { var p = out.addPage([595.28, 841.89]); p.setRotation(L.degrees(((it.rot % 360) + 360) % 360)); return; }
                return lib(it.doc).then(function (d) { return out.copyPages(d, [it.i]); }).then(function (ps) { var p = ps[0]; p.setRotation(L.degrees((((p.getRotation().angle + it.rot) % 360) + 360) % 360)); out.addPage(p); });
              });
            });
            return chain;
          }).then(function () { return out.save(); });
        }).then(function (b) { VX.save(new Blob([b], { type: "application/pdf" }), name + "-organized.pdf"); note(r, "Done – your PDF has " + items.length + " page" + (items.length === 1 ? "" : "s") + ".", 0, 1); })
          .catch(function (e) { note(r, "Could not save the PDF. " + e.message, 1); });
      });
    }
  });

  /* =====================================================================
     PDF TO IMAGE
     ===================================================================== */
  function parsePages(s, max) {
    s = (s || "").trim(); if (!s) { var all = []; for (var i = 0; i < max; i++) all.push(i); return all; }
    var out = []; s.split(",").forEach(function (p) {
      p = p.trim(); if (!p) return; var m = p.match(/^(\d+)(?:\s*-\s*(\d+))?$/); if (!m) throw new Error("Use pages like 1-3, 5, 8-10.");
      var a = +m[1], b = m[2] ? +m[2] : a; if (a < 1 || b < a || b > max) throw new Error("Pages must be between 1 and " + max + ".");
      for (var i2 = a; i2 <= b; i2++) if (out.indexOf(i2 - 1) < 0) out.push(i2 - 1);
    }); return out;
  }
  VX.tool("pdf-to-image", {
    html: '<div id="dz"></div><div id="ui" hidden><p class="gnote" id="info"></p><div class="row"><div><label class="lb">Format</label><div id="fmt"></div></div><div><label class="lb">Quality</label><div id="qual"></div></div><div><label class="lb" for="pgs">Pages (leave empty for all)</label><input id="pgs" class="in" type="text" placeholder="e.g. 1-3, 5"></div></div><div class="bar"><button class="btn" id="go" type="button">Convert to images</button><button class="btn ghost" id="new" type="button">Choose another PDF</button></div><div class="pi-out" id="out"></div></div><div class="msg" id="m"></div>',
    init: function (r) {
      var pdf = null, name = "pdf", fmt = "png", sc = 2, urls = [];
      VX.dropzone($("#dz", r), { accept: "application/pdf", multiple: false, title: "Choose a PDF", hint: "Each page becomes an image", onFiles: function (fs) {
        name = base(fs[0].name); note(r, "Opening PDF…");
        readBuf(fs[0]).then(openDoc).then(function (p) { pdf = p; $("#dz", r).hidden = true; $("#ui", r).hidden = false; $("#info", r).textContent = fs[0].name + " has " + p.numPages + " page" + (p.numPages === 1 ? "" : "s") + "."; note(r, ""); }).catch(function (e) { note(r, friendly(e), 1); });
      } });
      function seg(host, opts, cur, fn) {
        host.className = "seg"; opts.forEach(function (o) { var b = el("button", "", o[1]); b.type = "button"; b.setAttribute("aria-pressed", String(o[0] === cur)); b.addEventListener("click", function () { Array.prototype.forEach.call(host.children, function (x) { x.setAttribute("aria-pressed", "false"); }); b.setAttribute("aria-pressed", "true"); fn(o[0]); }); host.appendChild(b); });
      }
      seg($("#fmt", r), [["png", "PNG"], ["jpg", "JPG"]], "png", function (v) { fmt = v; });
      seg($("#qual", r), [[1.5, "Standard"], [2, "High"], [3, "Maximum"]], 2, function (v) { sc = v; });
      $("#new", r).addEventListener("click", function () { $("#ui", r).hidden = true; $("#dz", r).hidden = false; $("#out", r).innerHTML = ""; pdf = null; note(r, ""); });
      $("#go", r).addEventListener("click", function () {
        var list; try { list = parsePages($("#pgs", r).value, pdf.numPages); } catch (e) { note(r, e.message, 1); return; }
        if (list.length > 150) { note(r, "Please convert up to 150 pages at a time.", 1); return; }
        urls.forEach(URL.revokeObjectURL); urls = []; var out = $("#out", r); out.innerHTML = ""; var files = [], pad = String(pdf.numPages).length, type = fmt === "jpg" ? "image/jpeg" : "image/png", ext = fmt;
        var chain = Promise.resolve();
        list.forEach(function (pi, n) {
          chain = chain.then(function () {
            note(r, "Converting page " + (pi + 1) + " (" + (n + 1) + " of " + list.length + ")…");
            return pdf.getPage(pi + 1).then(function (p) {
              var v1 = p.getViewport({ scale: 1 }), s = sc, mp = 24e6; if (v1.width * v1.height * s * s > mp) s = Math.sqrt(mp / (v1.width * v1.height));
              var vp = p.getViewport({ scale: s }), c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height); var x = c.getContext("2d");
              if (fmt === "jpg") { x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); }
              return p.render({ canvasContext: x, viewport: vp }).promise.then(function () { return toBlob(c, type, .92); });
            }).then(function (b) {
              var fn = name + "-page-" + String(pi + 1).padStart(pad, "0") + "." + ext, u = URL.createObjectURL(b); urls.push(u);
              var card = el("div", "pi-card", '<img alt="Page ' + (pi + 1) + '" src="' + u + '"><div class="pi-row"><span>Page ' + (pi + 1) + " · " + VX.bytes(b.size) + '</span><a class="btn ghost sm" download="' + fn + '" href="' + u + '">Download</a></div>');
              out.appendChild(card);
              return readBuf(b).then(function (ab) { files.push({ name: fn, data: new Uint8Array(ab) }); });
            });
          });
        });
        chain.then(function () {
          note(r, "Done – " + list.length + " image" + (list.length === 1 ? "" : "s") + " ready.", 0, 1);
          if (list.length > 1) { var zb = el("button", "btn", "Download all as ZIP"); zb.type = "button"; zb.addEventListener("click", function () { VX.save(makeZip(files), name + "-images.zip"); }); out.insertBefore(zb, out.firstChild); }
        }).catch(function (e) { note(r, "Could not convert. " + e.message, 1); });
      });
    }
  });

  /* =====================================================================
     PAGE NUMBERS AND WATERMARK
     ===================================================================== */
  VX.tool("pdf-page-numbers-watermark", {
    html: '<div id="dz"></div><div id="ui" hidden><div class="row"><div><label class="lb">What to add</label><div id="mode"></div></div></div>' +
      '<div id="pn"><div class="row"><div><label class="lb" for="pos">Position</label><select id="pos" class="in"><option value="bc">Bottom centre</option><option value="br">Bottom right</option><option value="bl">Bottom left</option><option value="tc">Top centre</option><option value="tr">Top right</option><option value="tl">Top left</option></select></div>' +
      '<div><label class="lb" for="fm">Format</label><select id="fm" class="in"><option value="n">1</option><option value="p">Page 1</option><option value="pn">Page 1 of N</option><option value="sn">1 / N</option></select></div>' +
      '<div><label class="lb" for="st">Start at</label><input id="st" class="in" type="number" min="0" value="1"></div></div>' +
      '<div class="row"><div><label class="lb" for="ps">Font size</label><input id="ps" class="in" type="number" min="6" max="48" value="12"></div><div><label class="lb" for="pc">Colour</label><input id="pc" type="color" value="#111827"></div><div><label class="lb" for="mg">Margin from edge (pt)</label><input id="mg" class="in" type="number" min="8" max="120" value="28"></div></div>' +
      '<label class="chk"><input id="sk" type="checkbox"> Do not number the first page</label></div>' +
      '<div id="wm" hidden><div class="row"><div><label class="lb" for="wt">Watermark text</label><input id="wt" class="in" type="text" value="CONFIDENTIAL" maxlength="60"></div><div><label class="lb" for="ws">Size (pt)</label><input id="ws" class="in" type="number" min="12" max="300" value="72"></div></div>' +
      '<div class="row"><div><label class="lb" for="wo">Opacity: <span id="wov">20</span>%</label><input id="wo" type="range" min="5" max="100" value="20"></div><div><label class="lb" for="wa">Angle</label><select id="wa" class="in"><option value="45">Diagonal up (45°)</option><option value="0">Straight (0°)</option><option value="-45">Diagonal down (−45°)</option></select></div><div><label class="lb" for="wc">Colour</label><input id="wc" type="color" value="#6b7280"></div></div></div>' +
      '<p class="gnote">Preview of page 1:</p><div class="pn-prev"><canvas id="pv"></canvas></div>' +
      '<div class="bar"><button class="btn" id="go" type="button">Download PDF</button><button class="btn ghost" id="new" type="button">Choose another PDF</button></div></div><div class="msg" id="m"></div>',
    init: function (r) {
      var buf = null, pdf = null, name = "pdf", mode = "pn", cv = $("#pv", r), prev = null, count = 0;
      VX.dropzone($("#dz", r), { accept: "application/pdf", multiple: false, title: "Choose a PDF", hint: "Add page numbers or a text watermark", onFiles: function (fs) {
        name = base(fs[0].name); note(r, "Opening PDF…");
        readBuf(fs[0]).then(function (b) { buf = b; return openDoc(b); }).then(function (p) { pdf = p; count = p.numPages; return p.getPage(1); }).then(function (p) {
          $("#dz", r).hidden = true; $("#ui", r).hidden = false; note(r, ""); var cw = Math.min(360, ($("#ui", r).clientWidth || 360) - 10);
          return renderTo(p, cv, cw).then(function () { prev = document.createElement("canvas"); prev.width = cv.width; prev.height = cv.height; prev.getContext("2d").drawImage(cv, 0, 0); prev.vw = p.getViewport({ scale: 1 }).width; draw(); });
        }).catch(function (e) { note(r, friendly(e), 1); });
      } });
      var host = $("#mode", r); host.className = "seg";
      [["pn", "Page numbers"], ["wm", "Watermark"]].forEach(function (o) { var b = el("button", "", o[1]); b.type = "button"; b.setAttribute("aria-pressed", String(o[0] === "pn")); b.addEventListener("click", function () { mode = o[0]; Array.prototype.forEach.call(host.children, function (x) { x.setAttribute("aria-pressed", "false"); }); b.setAttribute("aria-pressed", "true"); $("#pn", r).hidden = mode !== "pn"; $("#wm", r).hidden = mode !== "wm"; draw(); }); host.appendChild(b); });
      $("#new", r).addEventListener("click", function () { $("#ui", r).hidden = true; $("#dz", r).hidden = false; pdf = null; note(r, ""); });
      Array.prototype.forEach.call(r.querySelectorAll("#ui input, #ui select"), function (e) { e.addEventListener("input", function () { $("#wov", r).textContent = $("#wo", r).value; draw(); }); e.addEventListener("change", draw); });

      function label(fmt, n, total) { return fmt === "p" ? "Page " + n : fmt === "pn" ? "Page " + n + " of " + total : fmt === "sn" ? n + " / " + total : String(n); }
      function opts() {
        return { mode: mode, pos: $("#pos", r).value, fmt: $("#fm", r).value, start: Math.max(0, parseInt($("#st", r).value, 10) || 1), size: Math.max(6, Math.min(48, +$("#ps", r).value || 12)), color: $("#pc", r).value, margin: Math.max(8, +$("#mg", r).value || 28), skip: $("#sk", r).checked,
          wt: $("#wt", r).value || " ", ws: Math.max(12, +$("#ws", r).value || 72), wo: (+$("#wo", r).value || 20) / 100, wa: +$("#wa", r).value, wc: $("#wc", r).value };
      }
      function draw() {
        if (!prev) return; var x = cv.getContext("2d"), o = opts(), k = prev.width / prev.vw, W = prev.width, H = prev.height;
        x.clearRect(0, 0, W, H); x.drawImage(prev, 0, 0);
        if (o.mode === "pn") {
          var t = label(o.fmt, o.start, count + o.start - 1), fs = o.size * k, m = o.margin * k; x.font = fs + "px Helvetica, Arial, sans-serif"; x.fillStyle = o.color; x.textBaseline = "alphabetic";
          var tw = x.measureText(t).width, px = o.pos[1] === "c" ? (W - tw) / 2 : o.pos[1] === "l" ? m : W - m - tw, py = o.pos[0] === "b" ? H - m : m + fs * .8;
          if (!o.skip) x.fillText(t, px, py); else { x.globalAlpha = .35; x.fillText(t, px, py); x.globalAlpha = 1; }
        } else {
          x.save(); x.globalAlpha = o.wo; x.fillStyle = o.wc; x.font = "bold " + (o.ws * k) + "px Helvetica, Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.translate(W / 2, H / 2); x.rotate(-o.wa * Math.PI / 180); x.fillText(o.wt, 0, 0); x.restore();
        }
      }
      $("#go", r).addEventListener("click", function () {
        var o = opts(); note(r, "Building your PDF…");
        VX.pdfLib().then(function (L) {
          return L.PDFDocument.load(buf.slice(0)).then(function (doc) {
            return doc.embedFont(o.mode === "wm" ? L.StandardFonts.HelveticaBold : L.StandardFonts.Helvetica).then(function (font) {
              var pages = doc.getPages(), total = pages.length, bad = 0;
              pages.forEach(function (pg, i) {
                var cb = pg.getCropBox(), rot = ((pg.getRotation().angle % 360) + 360) % 360, box = { x: cb.x, y: cb.y, w: cb.width, h: cb.height }, sw = rot === 90 || rot === 270, dw = sw ? box.h : box.w, dh = sw ? box.w : box.h;
                if (o.mode === "pn") {
                  if (o.skip && i === 0) return;
                  var n = o.start + i - (o.skip ? 1 : 0), sc = safeText(font, label(o.fmt, n, o.start + total - 1 - (o.skip ? 1 : 0))), tw = font.widthOfTextAtSize(sc.text, o.size);
                  var px = o.pos[1] === "c" ? (dw - tw) / 2 : o.pos[1] === "l" ? o.margin : dw - o.margin - tw, py = o.pos[0] === "b" ? dh - o.margin : o.margin + o.size * .8, P = toUser(box, rot, px, py);
                  pg.drawText(sc.text, { x: P.x, y: P.y, size: o.size, font: font, color: hexRgb(o.color, L), rotate: L.degrees(rot) });
                } else {
                  var sc2 = safeText(font, o.wt); bad += sc2.bad; var tw2 = font.widthOfTextAtSize(sc2.text, o.ws), th = o.wa * Math.PI / 180, dir = { x: Math.cos(th), y: -Math.sin(th) }, dn = { x: Math.sin(th), y: Math.cos(th) };
                  var sx = dw / 2 - dir.x * tw2 / 2 + dn.x * o.ws * .35, sy = dh / 2 - dir.y * tw2 / 2 + dn.y * o.ws * .35, P2 = toUser(box, rot, sx, sy);
                  pg.drawText(sc2.text, { x: P2.x, y: P2.y, size: o.ws, font: font, color: hexRgb(o.wc, L), opacity: o.wo, rotate: L.degrees(o.wa + rot) });
                }
              });
              return doc.save().then(function (b) { return { b: b, bad: bad }; });
            });
          });
        }).then(function (res) {
          VX.save(new Blob([res.b], { type: "application/pdf" }), name + (o.mode === "wm" ? "-watermarked.pdf" : "-numbered.pdf"));
          note(r, res.bad ? "Done. " + res.bad + " character" + (res.bad > 1 ? "s" : "") + " could not be drawn with the built-in font and were replaced with ?." : "Done – your PDF has been downloaded.", 0, !res.bad);
        }).catch(function (e) { note(r, "Could not save the PDF. " + e.message, 1); });
      });
    }
  });
})();
