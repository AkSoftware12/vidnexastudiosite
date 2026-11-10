/* Small QR Code encoder (byte mode, versions 1-40, ECC L/M/Q/H). Written for Vidnexa Studio. */
(function () {
  "use strict";
  var ECC = {
    L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  };
  var BLK = {
    L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  };
  var FMT = { L: 1, M: 0, Q: 3, H: 2 };

  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function dataCodewords(v, e) { return Math.floor(rawModules(v) / 8) - ECC[e][v - 1] * BLK[e][v - 1]; }

  function gfMul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
  function rsDiv(deg) {
    var r = []; for (var i = 0; i < deg - 1; i++) r.push(0); r.push(1);
    var root = 1;
    for (i = 0; i < deg; i++) {
      for (var j = 0; j < r.length; j++) { r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      root = gfMul(root, 2);
    }
    return r;
  }
  function rsRem(data, div) {
    var res = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ res.shift(); res.push(0);
      div.forEach(function (c, i) { res[i] ^= gfMul(c, f); });
    });
    return res;
  }

  function utf8(s) { return Array.prototype.slice.call(new TextEncoder().encode(s)); }

  function encode(text, ecc) {
    ecc = ecc || "M"; var bytes = utf8(text), ver, cap;
    for (ver = 1; ver <= 40; ver++) {
      cap = dataCodewords(ver, ecc) * 8; var cc = ver < 10 ? 8 : 16;
      if (4 + cc + bytes.length * 8 <= cap) break;
    }
    if (ver > 40) throw new Error("Text is too long for a QR code.");
    var bits = [];
    function put(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = []; for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var k = 0; k < 8; k++) b = (b << 1) | bits[i + k]; data.push(b); }

    // split into blocks, add error correction, interleave
    var nb = BLK[ecc][ver - 1], ec = ECC[ecc][ver - 1], raw = Math.floor(rawModules(ver) / 8);
    var shortBlocks = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDiv(ec), blocks = [], off = 0;
    for (i = 0; i < nb; i++) {
      var len = shortLen - ec + (i < shortBlocks ? 0 : 1), d = data.slice(off, off + len); off += len;
      var rem = rsRem(d, div); if (i < shortBlocks) d.push(0); blocks.push(d.concat(rem));
    }
    var all = [];
    for (i = 0; i < blocks[0].length; i++) blocks.forEach(function (bl, j) { if (i !== shortLen - ec || j >= shortBlocks) all.push(bl[i]); });

    // matrix
    var size = ver * 4 + 17, m = [], fn = [];
    for (i = 0; i < size; i++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function setF(x, y, d) { m[y][x] = d; fn[y][x] = true; }
    for (i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    function finder(cx, cy) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var dist = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, dist !== 2 && dist !== 4); } }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    var ap = []; if (ver > 1) { var na = Math.floor(ver / 7) + 2, step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2; ap = [6]; for (var pos = size - 7; ap.length < na; pos -= step) ap.splice(1, 0, pos); }
    ap.forEach(function (ax, a) { ap.forEach(function (ay, b) {
      if ((a === 0 && b === 0) || (a === 0 && b === ap.length - 1) || (a === ap.length - 1 && b === 0)) return;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }); });
    function fmtBits(mask) {
      var d = (FMT[ecc] << 3) | mask, r = d; for (var j = 0; j < 10; j++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      var bitsF = ((d << 10) | r) ^ 0x5412;
      function g(j) { return ((bitsF >>> j) & 1) !== 0; }
      for (var j2 = 0; j2 <= 5; j2++) setF(8, j2, g(j2)); setF(8, 7, g(6)); setF(8, 8, g(7)); setF(7, 8, g(8));
      for (j2 = 9; j2 < 15; j2++) setF(14 - j2, 8, g(j2));
      for (j2 = 0; j2 < 8; j2++) setF(size - 1 - j2, 8, g(j2));
      for (j2 = 8; j2 < 15; j2++) setF(8, size - 15 + j2, g(j2));
      setF(8, size - 8, true);
    }
    fmtBits(0);
    if (ver >= 7) {
      var rr = ver; for (i = 0; i < 12; i++) rr = (rr << 1) ^ ((rr >>> 11) * 0x1F25);
      var vb = (ver << 12) | rr;
      for (i = 0; i < 18; i++) { var bit = ((vb >>> i) & 1) !== 0, a2 = size - 11 + i % 3, b2 = Math.floor(i / 3); setF(a2, b2, bit); setF(b2, a2, bit); }
    }
    // place data
    var idx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (var j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && idx < all.length * 8) { m[y][x] = ((all[idx >>> 3] >>> (7 - (idx & 7))) & 1) !== 0; idx++; }
      }
    }
    function applyMask(mask) {
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        var inv; switch (mask) {
          case 0: inv = (x + y) % 2 === 0; break; case 1: inv = y % 2 === 0; break; case 2: inv = x % 3 === 0; break; case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break; case 5: inv = x * y % 2 + x * y % 3 === 0; break;
          case 6: inv = (x * y % 2 + x * y % 3) % 2 === 0; break; default: inv = ((x + y) % 2 + x * y % 3) % 2 === 0;
        }
        if (!fn[y][x] && inv) m[y][x] = !m[y][x];
      }
    }
    function penalty() {
      var p = 0, y, x, run, c;
      function lineScore(get) {
        var s = 0, runL = 1, hist = [0, 0, 0, 0, 0, 0, 0, 0], prev = get(0), q, hist2 = hist;
        for (q = 1; q < size; q++) { var cur = get(q); if (cur === prev) { runL++; if (runL === 5) s += 3; else if (runL > 5) s++; } else { runL = 1; prev = cur; } }
        return s;
      }
      for (y = 0; y < size; y++) p += lineScore(function (q) { return m[y][q]; });
      for (x = 0; x < size; x++) p += lineScore(function (q) { return m[q][x]; });
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) { c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
      var pat = [true, false, true, true, true, false, true, false, false, false, false];
      function finderPen(get) {
        var s = 0; for (var st = 0; st + 11 <= size; st++) {
          var a = true, b = true; for (var k = 0; k < 11; k++) { if (get(st + k) !== pat[k]) a = false; if (get(st + k) !== pat[10 - k]) b = false; }
          if (a || b) s += 40;
        } return s;
      }
      for (y = 0; y < size; y++) p += finderPen(function (q) { return m[y][q]; });
      for (x = 0; x < size; x++) p += finderPen(function (q) { return m[q][x]; });
      var dark = 0; m.forEach(function (row) { row.forEach(function (v) { if (v) dark++; }); });
      p += (Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size * 10)) - 1) * 10;
      return p;
    }
    var best = 0, bestP = Infinity;
    for (var mk = 0; mk < 8; mk++) { applyMask(mk); fmtBits(mk); var pen = penalty(); if (pen < bestP) { bestP = pen; best = mk; } applyMask(mk); }
    applyMask(best); fmtBits(best);
    return { size: size, version: ver, get: function (x, y) { return m[y][x]; } };
  }

  function toCanvas(qr, scale, margin, fg, bg) {
    var n = qr.size + margin * 2, c = document.createElement("canvas"); c.width = c.height = n * scale;
    var x = c.getContext("2d"); x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); x.fillStyle = fg;
    for (var j = 0; j < qr.size; j++) for (var i = 0; i < qr.size; i++) if (qr.get(i, j)) x.fillRect((i + margin) * scale, (j + margin) * scale, scale, scale);
    return c;
  }
  function toSVG(qr, margin, fg, bg) {
    var n = qr.size + margin * 2, d = "";
    for (var j = 0; j < qr.size; j++) for (var i = 0; i < qr.size; i++) if (qr.get(i, j)) d += "M" + (i + margin) + "," + (j + margin) + "h1v1h-1z";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + " " + n + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="' + bg + '"/><path d="' + d + '" fill="' + fg + '"/></svg>';
  }
  window.VXQR = { encode: encode, toCanvas: toCanvas, toSVG: toSVG };
})();
