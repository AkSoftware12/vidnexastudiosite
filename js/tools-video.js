/* Video and audio tools – everything runs in the browser (MediaRecorder, canvas, Web Audio) */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$;

  function base(n) { return n.replace(/\.[^.]+$/, ""); }
  function note(r, msg, err) { var m = $("#m", r); if (!m) return; m.textContent = msg; m.className = "msg" + (err ? " err" : ""); }
  function clock(s) { s = Math.max(0, s || 0); var m = Math.floor(s / 60), x = s - m * 60; return m + ":" + (x < 10 ? "0" : "") + x.toFixed(1); }
  function even(n) { n = Math.round(n); return n % 2 ? n - 1 : n; }
  function pickMime(kind) {
    var list = kind === "audio" ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"] : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    if (!window.MediaRecorder) return "";
    for (var i = 0; i < list.length; i++) if (MediaRecorder.isTypeSupported(list[i])) return list[i];
    return "";
  }
  function extOf(m) { return /mp4/.test(m) ? "mp4" : /ogg/.test(m) ? "ogg" : "webm"; }
  function openVideo(file) {
    return new Promise(function (res, rej) {
      var v = document.createElement("video"); v.preload = "auto"; v.playsInline = true; v.src = URL.createObjectURL(file);
      v.onloadedmetadata = function () { if (!isFinite(v.duration) || !v.videoWidth) { rej(new Error("This video could not be read. Try an MP4 or WebM file.")); return; } res(v); };
      v.onerror = function () { rej(new Error("This video could not be opened. Try an MP4 or WebM file.")); };
    });
  }
  function seek(v, t) {
    return new Promise(function (res) {
      var done = false, fin = function () { if (!done) { done = true; v.removeEventListener("seeked", fin); res(); } };
      v.addEventListener("seeked", fin); setTimeout(fin, 4000); v.currentTime = t;
    });
  }
  function fileUI(r, accept, hint, onFile) {
    VX.dropzone($("#dz", r), { accept: accept, title: "Choose a video", hint: hint || "MP4, WebM, MOV · stays on your device", onFiles: function (fs) { onFile(fs[0]); } });
  }
  function track(el) { var b = el.parentNode.querySelector("progress"); return b; }

  /* Record part of a video (optionally resized/sped up) into a new file. Real time: a 1 minute clip takes about 1 minute. */
  function record(url, o) {
    var cancelled = false, stopFn = null;
    var p = new Promise(function (res, rej) {
      var mime = pickMime("video");
      if (!mime) { rej(new Error("This browser cannot record video. Please use a recent Chrome, Edge, Firefox or Safari.")); return; }
      var vv = document.createElement("video"); vv.playsInline = true; vv.preload = "auto"; vv.src = url;
      vv.onerror = function () { rej(new Error("The video could not be played.")); };
      vv.onloadedmetadata = function () {
        var end = Math.min(o.end == null ? vv.duration : o.end, vv.duration), start = Math.max(0, o.start || 0);
        var cv = document.createElement("canvas"); cv.width = o.w; cv.height = o.h; var x = cv.getContext("2d");
        var stream = cv.captureStream(o.fps || 30), actx = null;
        if (o.audio) {
          try {
            actx = new (window.AudioContext || window.webkitAudioContext)();
            var src = actx.createMediaElementSource(vv), dest = actx.createMediaStreamDestination();
            src.connect(dest); dest.stream.getAudioTracks().forEach(function (t) { stream.addTrack(t); });
          } catch (e) { actx = null; }
        }
        var chunks = [], rec, finished = false, opts = { mimeType: mime };
        if (o.vbps) opts.videoBitsPerSecond = o.vbps;
        try { rec = new MediaRecorder(stream, opts); } catch (e) { rec = new MediaRecorder(stream); }
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); }); if (actx) try { actx.close(); } catch (e) {}
          vv.pause();
          if (cancelled) rej(new Error("Cancelled.")); else res({ blob: new Blob(chunks, { type: mime.split(";")[0] }), mime: mime });
        };
        function finish() { if (finished) return; finished = true; try { rec.stop(); } catch (e) { rej(e); } }
        stopFn = finish;
        function tick() {
          if (finished) return;
          x.drawImage(vv, 0, 0, o.w, o.h);
          var t = vv.currentTime; if (o.onProgress) o.onProgress(Math.min(1, Math.max(0, (t - start) / Math.max(0.1, end - start))));
          if (t >= end - 0.04 || vv.ended) { finish(); return; }
          requestAnimationFrame(tick);
        }
        seek(vv, start).then(function () {
          vv.playbackRate = o.rate || 1;
          x.drawImage(vv, 0, 0, o.w, o.h);
          rec.start(500);
          var pr = vv.play(); if (pr && pr.catch) pr.catch(function () { cancelled = true; finish(); });
          requestAnimationFrame(tick);
        });
      };
    });
    return { promise: p, cancel: function () { cancelled = true; if (stopFn) stopFn(); } };
  }

  /* shared UI for the three "re-record" tools */
  function recorderTool(cfg) {
    VX.tool(cfg.slug, {
      html: '<div id="dz"></div><div id="ui" hidden><div class="preview"><figure><video id="pv" controls playsinline preload="metadata" style="max-width:100%;max-height:300px;border-radius:10px"></video><figcaption id="info"></figcaption></figure></div>' + cfg.options +
        '<div class="bar"><button class="btn" id="go" type="button">' + cfg.button + '</button><button class="btn ghost" id="cx" type="button" hidden>Cancel</button></div>' +
        '<progress id="pg" max="100" value="0" hidden style="width:100%;margin-top:12px"></progress>' +
        '<div id="out" hidden><div class="preview"><figure><video id="rv" controls playsinline style="max-width:100%;max-height:300px;border-radius:10px"></video><figcaption id="rinfo"></figcaption></figure></div><div class="bar"><button class="btn" id="dl" type="button">Download</button></div></div></div>' +
        '<div class="msg" id="m">Everything happens on your device. Keep this tab open while it works – processing runs at normal playback speed.</div>',
      init: function (r) {
        var cur = null, job = null, result = null;
        fileUI(r, "video/*", "", function (f) {
          openVideo(f).then(function (v) {
            cur = { file: f, url: v.src, w: v.videoWidth, h: v.videoHeight, d: v.duration };
            $("#pv", r).src = v.src; $("#ui", r).hidden = false; $("#out", r).hidden = true;
            $("#info", r).textContent = f.name + " · " + v.videoWidth + "×" + v.videoHeight + " · " + clock(v.duration) + " · " + VX.bytes(f.size);
            if (cfg.onLoad) cfg.onLoad(r, cur); note(r, "Ready.");
          }).catch(function (e) { note(r, e.message, 1); });
        });
        $("#cx", r).addEventListener("click", function () { if (job) job.cancel(); });
        $("#go", r).addEventListener("click", function () {
          if (!cur || job) return;
          var o = cfg.build(r, cur); if (typeof o === "string") { note(r, o, 1); return; }
          $("#pv", r).pause(); var pg = $("#pg", r); pg.hidden = false; pg.value = 0; $("#cx", r).hidden = false; $("#go", r).disabled = true; $("#out", r).hidden = true;
          o.onProgress = function (p) { pg.value = Math.round(p * 100); note(r, "Working… " + Math.round(p * 100) + "%  (keep this tab open)"); };
          job = record(cur.url, o);
          job.promise.then(function (res) {
            result = res; var u = URL.createObjectURL(res.blob); $("#rv", r).src = u; $("#out", r).hidden = false;
            $("#rinfo", r).textContent = (o.w + "×" + o.h) + " · " + VX.bytes(res.blob.size) + (cfg.compare ? " (was " + VX.bytes(cur.file.size) + (res.blob.size >= cur.file.size ? " – no saving, try a smaller size or the Small file quality" : "") + ")" : "");
            note(r, "Done. Preview it, then download.");
          }).catch(function (e) { note(r, e.message, e.message === "Cancelled." ? 0 : 1); })
            .then(function () { job = null; pg.hidden = true; $("#cx", r).hidden = true; $("#go", r).disabled = false; });
        });
        $("#dl", r).addEventListener("click", function () { if (result) VX.save(result.blob, base(cur.file.name) + cfg.suffix + "." + extOf(result.mime)); });
      }
    });
  }

  recorderTool({
    slug: "video-compressor", button: "Compress video", suffix: "-compressed", compare: true,
    options: '<div class="row"><div class="fld"><label for="rs">Size</label><select id="rs" class="in"><option value="0">Same as original</option><option value="720">720p</option><option value="480" selected>480p</option><option value="360">360p</option></select></div><div class="fld"><label for="ql">Quality</label><select id="ql" class="in"><option value="0.09">High</option><option value="0.055" selected>Medium</option><option value="0.03">Small file</option></select></div></div><label class="chk"><input id="mu" type="checkbox"> Remove sound</label>',
    build: function (r, c) {
      var s = +$("#rs", r).value, w = c.w, h = c.h;
      if (s && Math.min(w, h) > s) { var k = s / Math.min(w, h); w *= k; h *= k; }
      w = even(w); h = even(h); var fps = 30;
      return { start: 0, end: c.d, w: w, h: h, fps: fps, vbps: Math.max(150000, Math.round(w * h * fps * +$("#ql", r).value)), audio: !$("#mu", r).checked, rate: 1 };
    }
  });

  recorderTool({
    slug: "video-trimmer", button: "Trim video", suffix: "-trimmed",
    options: '<div class="row"><div class="fld"><label for="st">Start (seconds)</label><input id="st" class="in" type="number" min="0" step="0.1" value="0"></div><div class="fld"><label for="en">End (seconds)</label><input id="en" class="in" type="number" min="0" step="0.1" value="0"></div></div><div class="bar"><button class="btn ghost sm" id="ss" type="button">Use current time as start</button><button class="btn ghost sm" id="se" type="button">Use current time as end</button></div><label class="chk"><input id="mu" type="checkbox"> Remove sound</label>',
    onLoad: function (r, c) {
      $("#st", r).value = 0; $("#en", r).value = c.d.toFixed(1);
      $("#ss", r).onclick = function () { $("#st", r).value = $("#pv", r).currentTime.toFixed(1); };
      $("#se", r).onclick = function () { $("#en", r).value = $("#pv", r).currentTime.toFixed(1); };
    },
    build: function (r, c) {
      var a = +$("#st", r).value, b = +$("#en", r).value;
      if (!(a >= 0 && b > a)) return "Enter an end time that is later than the start time.";
      if (a >= c.d) return "The start time is past the end of the video.";
      return { start: a, end: Math.min(b, c.d), w: even(c.w), h: even(c.h), fps: 30, vbps: Math.max(500000, Math.round(c.w * c.h * 30 * 0.08)), audio: !$("#mu", r).checked, rate: 1 };
    }
  });

  recorderTool({
    slug: "video-speed-changer", button: "Change speed", suffix: "-speed",
    options: '<div class="row"><div class="fld"><label for="sp">Speed</label><select id="sp" class="in"><option value="0.5">0.5× (slow motion)</option><option value="0.75">0.75×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2" selected>2× (fast)</option></select></div></div><label class="chk"><input id="mu" type="checkbox"> Remove sound</label>',
    build: function (r, c) {
      return { start: 0, end: c.d, w: even(c.w), h: even(c.h), fps: 30, vbps: Math.max(500000, Math.round(c.w * c.h * 30 * 0.08)), audio: !$("#mu", r).checked, rate: +$("#sp", r).value };
    }
  });

  /* ---------- Video to audio ---------- */
  function wavFrom(buf) {
    var ch = Math.min(2, buf.numberOfChannels), n = buf.length, sr = buf.sampleRate, bytes = 44 + n * ch * 2, ab = new ArrayBuffer(bytes), dv = new DataView(ab);
    function s(o, t) { for (var i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i)); }
    s(0, "RIFF"); dv.setUint32(4, bytes - 8, true); s(8, "WAVE"); s(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); s(36, "data"); dv.setUint32(40, n * ch * 2, true);
    var d = [], i, c, o = 44; for (c = 0; c < ch; c++) d.push(buf.getChannelData(c));
    for (i = 0; i < n; i++) for (c = 0; c < ch; c++) { var v = Math.max(-1, Math.min(1, d[c][i])); dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
    return new Blob([ab], { type: "audio/wav" });
  }
  VX.tool("video-to-audio", {
    html: '<div id="dz"></div><div id="ui" hidden><div class="row"><div class="fld"><label for="fm">Output</label><select id="fm" class="in"><option value="wav">WAV – fast, large file</option><option value="rec">WebM/Opus – small file, takes as long as the video</option></select></div></div><div class="bar"><button class="btn" id="go" type="button">Extract audio</button></div><progress id="pg" max="100" value="0" hidden style="width:100%;margin-top:12px"></progress><div id="out" hidden><audio id="au" controls style="width:100%"></audio><div class="bar"><button class="btn" id="dl" type="button">Download</button></div></div></div><div class="msg" id="m">Your video is not uploaded. Audio is pulled out right here in your browser.</div>',
    init: function (r) {
      var file = null, result = null, name = "";
      fileUI(r, "video/*,audio/*", "", function (f) { file = f; $("#ui", r).hidden = false; $("#out", r).hidden = true; note(r, f.name + " · " + VX.bytes(f.size)); });
      $("#go", r).addEventListener("click", function () {
        if (!file) return; var fm = $("#fm", r).value, go = $("#go", r); go.disabled = true; $("#out", r).hidden = true; var pg = $("#pg", r); pg.hidden = false; pg.value = 0;
        function done(blob, ext) { result = blob; name = base(file.name) + "-audio." + ext; $("#au", r).src = URL.createObjectURL(blob); $("#out", r).hidden = false; note(r, "Done – " + VX.bytes(blob.size) + "."); go.disabled = false; pg.hidden = true; }
        function fail(e) { note(r, e.message || "Could not extract audio.", 1); go.disabled = false; pg.hidden = true; }
        if (fm === "wav") {
          note(r, "Reading audio…");
          file.arrayBuffer().then(function (ab) {
            var AC = window.AudioContext || window.webkitAudioContext, ac = new AC();
            return new Promise(function (ok, no) { ac.decodeAudioData(ab, ok, no); }).then(function (buf) { ac.close(); done(wavFrom(buf), "wav"); });
          }).catch(function () { fail(new Error("This browser could not read the audio in that file. Try the WebM/Opus option instead.")); });
        } else {
          var mime = pickMime("audio"); if (!mime) { fail(new Error("This browser cannot record audio.")); return; }
          var v = document.createElement("video"); v.src = URL.createObjectURL(file); v.playsInline = true;
          v.onerror = function () { fail(new Error("This file could not be played.")); };
          v.onloadedmetadata = function () {
            try {
              var ac = new (window.AudioContext || window.webkitAudioContext)(), src = ac.createMediaElementSource(v), dest = ac.createMediaStreamDestination(); src.connect(dest);
              var chunks = [], rec = new MediaRecorder(dest.stream, { mimeType: mime });
              rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
              rec.onstop = function () { ac.close(); done(new Blob(chunks, { type: mime.split(";")[0] }), extOf(mime)); };
              v.ontimeupdate = function () { pg.value = Math.round(v.currentTime / v.duration * 100); note(r, "Recording audio… " + pg.value + "% (keep this tab open)"); };
              v.onended = function () { rec.stop(); };
              rec.start(500); v.play().catch(fail);
            } catch (e) { fail(e); }
          };
        }
      });
      $("#dl", r).addEventListener("click", function () { if (result) VX.save(result, name); });
    }
  });

  /* ---------- Frame extractor ---------- */
  VX.tool("video-frame-extractor", {
    html: '<div id="dz"></div><div id="ui" hidden><div class="preview"><figure><video id="pv" controls playsinline preload="auto" style="max-width:100%;max-height:340px;border-radius:10px"></video><figcaption id="tm">0:00.0</figcaption></figure></div><div class="fld"><label for="rg">Position</label><input id="rg" type="range" min="0" max="100" step="0.01" value="0"></div><div class="bar"><button class="btn ghost sm" id="pf" type="button">◀ Previous frame</button><button class="btn ghost sm" id="nf" type="button">Next frame ▶</button></div><div class="row"><div class="fld"><label for="ft">Format</label><select id="ft" class="in"><option value="image/png">PNG (best quality)</option><option value="image/jpeg">JPG (smaller)</option></select></div></div><div class="bar"><button class="btn" id="go" type="button">Save this frame</button></div></div><div class="msg" id="m">Pause on the exact moment you want, or drag the slider, then save the frame.</div>',
    init: function (r) {
      var v = $("#pv", r), rg = $("#rg", r), name = "frame";
      fileUI(r, "video/*", "", function (f) {
        openVideo(f).then(function (o) { name = base(f.name); v.src = o.src; rg.max = o.duration; rg.value = 0; $("#ui", r).hidden = false; note(r, o.videoWidth + "×" + o.videoHeight + " · " + clock(o.duration)); }).catch(function (e) { note(r, e.message, 1); });
      });
      rg.addEventListener("input", function () { v.pause(); v.currentTime = +rg.value; });
      v.addEventListener("timeupdate", function () { rg.value = v.currentTime; $("#tm", r).textContent = clock(v.currentTime) + " / " + clock(v.duration); });
      $("#pf", r).onclick = function () { v.pause(); v.currentTime = Math.max(0, v.currentTime - 1 / 30); };
      $("#nf", r).onclick = function () { v.pause(); v.currentTime = Math.min(v.duration, v.currentTime + 1 / 30); };
      $("#go", r).addEventListener("click", function () {
        var t = $("#ft", r).value, c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; var x = c.getContext("2d");
        if (t === "image/jpeg") { x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); }
        x.drawImage(v, 0, 0);
        c.toBlob(function (b) { VX.save(b, name + "-" + v.currentTime.toFixed(2).replace(".", "_") + "s." + (t === "image/png" ? "png" : "jpg")); note(r, "Saved " + c.width + "×" + c.height + " frame at " + clock(v.currentTime) + "."); }, t, 0.95);
      });
    }
  });

  /* ---------- Video info ---------- */
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  VX.tool("video-info", {
    html: '<div id="dz"></div><div id="ui" hidden><div class="stats" id="st"></div></div><div class="msg" id="m">Choose a video to see its details. The file is not uploaded.</div>',
    init: function (r) {
      fileUI(r, "video/*", "", function (f) {
        openVideo(f).then(function (v) {
          var g = gcd(v.videoWidth, v.videoHeight), br = f.size * 8 / v.duration;
          var items = [["File name", f.name], ["File size", VX.bytes(f.size)], ["Type", f.type || "unknown"], ["Duration", clock(v.duration)], ["Resolution", v.videoWidth + " × " + v.videoHeight],
            ["Aspect ratio", (v.videoWidth / g) + ":" + (v.videoHeight / g)], ["Orientation", v.videoWidth >= v.videoHeight ? (v.videoWidth === v.videoHeight ? "Square" : "Landscape") : "Portrait"],
            ["Average bitrate", (br / 1e6 >= 1 ? (br / 1e6).toFixed(2) + " Mbps" : Math.round(br / 1000) + " kbps")], ["Last modified", f.lastModified ? new Date(f.lastModified).toLocaleString() : "unknown"]];
          $("#st", r).innerHTML = items.map(function (i) { return VX.stat(i[0], i[1]); }).join(""); $("#st", r).className = "stats"; $("#ui", r).hidden = false; note(r, "Bitrate is the file size divided by duration, so it includes audio.");
        }).catch(function (e) { note(r, e.message, 1); });
      });
    }
  });

  /* ---------- Video to GIF ---------- */
  function hist15(frames, hist) {
    for (var f = 0; f < frames.length; f++) { var d = frames[f]; for (var i = 0; i < d.length; i += 16) hist[((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3)]++; }
  }
  function makePalette(hist) {
    var items = [], k; for (k = 0; k < 32768; k++) if (hist[k]) items.push(k);
    function ch(k, c) { return c === 0 ? (k >> 10) & 31 : c === 1 ? (k >> 5) & 31 : k & 31; }
    var boxes = [items];
    while (boxes.length < 256) {
      var bi = -1, best = 1;
      for (var i = 0; i < boxes.length; i++) if (boxes[i].length > best) { best = boxes[i].length; bi = i; }
      if (bi < 0) break;
      var b = boxes[bi], mn = [31, 31, 31], mx = [0, 0, 0];
      for (i = 0; i < b.length; i++) for (var c = 0; c < 3; c++) { var v = ch(b[i], c); if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; }
      var rg = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]], ax = rg[0] >= rg[1] && rg[0] >= rg[2] ? 0 : rg[1] >= rg[2] ? 1 : 2;
      b.sort(function (a, z) { return ch(a, ax) - ch(z, ax); });
      var tot = 0; for (i = 0; i < b.length; i++) tot += hist[b[i]];
      var acc = 0, cut = Math.floor(b.length / 2);
      for (i = 0; i < b.length; i++) { acc += hist[b[i]]; if (acc >= tot / 2) { cut = Math.min(Math.max(i + 1, 1), b.length - 1); break; } }
      boxes.splice(bi, 1, b.slice(0, cut), b.slice(cut));
    }
    var pal = boxes.map(function (b) {
      var r = 0, g = 0, bl = 0, t = 0; for (var i = 0; i < b.length; i++) { var w = hist[b[i]], k = b[i]; r += ((k >> 10) & 31) * w; g += ((k >> 5) & 31) * w; bl += (k & 31) * w; t += w; }
      t = t || 1; return [Math.min(255, Math.round(r / t * 8 + 4)), Math.min(255, Math.round(g / t * 8 + 4)), Math.min(255, Math.round(bl / t * 8 + 4))];
    });
    while (pal.length < 256) pal.push([0, 0, 0]);
    return pal;
  }
  function lzw(idx) {
    var min = 8, clear = 256, eoi = 257, next = 258, size = 9, dict = new Map(), out = [], cur = 0, bits = 0;
    function emit(code) { cur |= code << bits; bits += size; while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; } }
    emit(clear); var prefix = idx[0];
    for (var i = 1; i < idx.length; i++) {
      var k = idx[i], key = prefix * 256 + k, v = dict.get(key);
      if (v !== undefined) { prefix = v; continue; }
      emit(prefix);
      if (next === 4096) { emit(clear); dict.clear(); next = 258; size = 9; }
      else { if (next >= (1 << size)) size++; dict.set(key, next++); }
      prefix = k;
    }
    emit(prefix); emit(eoi); if (bits > 0) out.push(cur & 255);
    return out;
  }
  function encodeGif(frames, w, h, delayCs) {
    var hist = new Uint32Array(32768); hist15(frames, hist);
    var pal = makePalette(hist), lut = new Int16Array(32768).fill(-1);
    function nearest(k) {
      if (lut[k] >= 0) return lut[k];
      var r = ((k >> 10) & 31) * 8 + 4, g = ((k >> 5) & 31) * 8 + 4, b = (k & 31) * 8 + 4, bd = 1e9, bi = 0;
      for (var i = 0; i < 256; i++) { var dr = pal[i][0] - r, dg = pal[i][1] - g, db = pal[i][2] - b, d = dr * dr * 3 + dg * dg * 4 + db * db * 2; if (d < bd) { bd = d; bi = i; } }
      return (lut[k] = bi);
    }
    var o = [];
    function w16(n) { o.push(n & 255, (n >> 8) & 255); }
    "GIF89a".split("").forEach(function (c) { o.push(c.charCodeAt(0)); });
    w16(w); w16(h); o.push(0xF7, 0, 0);
    for (var i = 0; i < 256; i++) o.push(pal[i][0], pal[i][1], pal[i][2]);
    o.push(0x21, 0xFF, 0x0B); "NETSCAPE2.0".split("").forEach(function (c) { o.push(c.charCodeAt(0)); }); o.push(3, 1, 0, 0, 0);
    frames.forEach(function (d) {
      var idx = new Uint8Array(w * h);
      for (var p = 0, j = 0; p < idx.length; p++, j += 4) idx[p] = nearest(((d[j] >> 3) << 10) | ((d[j + 1] >> 3) << 5) | (d[j + 2] >> 3));
      o.push(0x21, 0xF9, 4, 0x04); w16(delayCs); o.push(0, 0);
      o.push(0x2C); w16(0); w16(0); w16(w); w16(h); o.push(0, 8);
      var data = lzw(idx);
      for (var s = 0; s < data.length; s += 255) { var n = Math.min(255, data.length - s); o.push(n); for (var q = 0; q < n; q++) o.push(data[s + q]); }
      o.push(0);
    });
    o.push(0x3B);
    return new Blob([new Uint8Array(o)], { type: "image/gif" });
  }
  VX.tool("video-to-gif", {
    html: '<div id="dz"></div><div id="ui" hidden><div class="preview"><figure><video id="pv" controls playsinline preload="metadata" style="max-width:100%;max-height:300px;border-radius:10px"></video><figcaption id="info"></figcaption></figure></div><div class="row"><div class="fld"><label for="st">Start (seconds)</label><input id="st" class="in" type="number" min="0" step="0.1" value="0"></div><div class="fld"><label for="ln">Length (seconds, max 10)</label><input id="ln" class="in" type="number" min="0.5" max="10" step="0.5" value="3"></div><div class="fld"><label for="wd">Width</label><select id="wd" class="in"><option value="240">240 px (small)</option><option value="320" selected>320 px</option><option value="480">480 px</option></select></div><div class="fld"><label for="fp">Frames per second</label><select id="fp" class="in"><option value="6">6</option><option value="10" selected>10</option><option value="15">15</option></select></div></div><div class="bar"><button class="btn ghost sm" id="ss" type="button">Use current time as start</button><button class="btn" id="go" type="button">Make GIF</button></div><progress id="pg" max="100" value="0" hidden style="width:100%;margin-top:12px"></progress><div id="out" hidden><div class="preview"><figure><img id="gi" alt="Your GIF"><figcaption id="gc"></figcaption></figure></div><div class="bar"><button class="btn" id="dl" type="button">Download GIF</button></div></div></div><div class="msg" id="m">Pick a short moment. GIFs get big quickly, so keep clips short and small.</div>',
    init: function (r) {
      var cur = null, blob = null;
      fileUI(r, "video/*", "", function (f) {
        openVideo(f).then(function (v) { cur = { f: f, v: v }; $("#pv", r).src = v.src; $("#ui", r).hidden = false; $("#out", r).hidden = true; $("#info", r).textContent = f.name + " · " + v.videoWidth + "×" + v.videoHeight + " · " + clock(v.duration); note(r, "Ready."); }).catch(function (e) { note(r, e.message, 1); });
      });
      $("#ss", r).onclick = function () { $("#st", r).value = $("#pv", r).currentTime.toFixed(1); };
      $("#go", r).addEventListener("click", function () {
        if (!cur) return; var v = cur.v, go = $("#go", r), pg = $("#pg", r);
        var st = Math.max(0, +$("#st", r).value || 0), ln = Math.min(10, Math.max(0.5, +$("#ln", r).value || 3)), w = +$("#wd", r).value, fps = +$("#fp", r).value;
        if (st >= v.duration) { note(r, "The start time is past the end of the video.", 1); return; }
        ln = Math.min(ln, v.duration - st); var h = even(w * v.videoHeight / v.videoWidth), n = Math.max(1, Math.round(ln * fps));
        var c = document.createElement("canvas"); c.width = w; c.height = h; var x = c.getContext("2d", { willReadFrequently: true }), frames = [], i = 0;
        go.disabled = true; pg.hidden = false; pg.value = 0; $("#pv", r).pause(); $("#out", r).hidden = true;
        (function next() {
          if (i >= n) {
            note(r, "Building the GIF…");
            setTimeout(function () {
              try { blob = encodeGif(frames, w, h, Math.max(2, Math.round(100 / fps))); } catch (e) { note(r, "Could not build the GIF: " + e.message, 1); go.disabled = false; pg.hidden = true; return; }
              $("#gi", r).src = URL.createObjectURL(blob); $("#gc", r).textContent = w + "×" + h + " · " + n + " frames · " + VX.bytes(blob.size); $("#out", r).hidden = false; pg.hidden = true; go.disabled = false; note(r, "Done.");
            }, 30); return;
          }
          seek(v, Math.min(v.duration - 0.01, st + i / fps)).then(function () {
            x.drawImage(v, 0, 0, w, h); frames.push(x.getImageData(0, 0, w, h).data); i++; pg.value = Math.round(i / n * 100); note(r, "Capturing frames… " + i + " / " + n); setTimeout(next, 0);
          });
        })();
      });
      $("#dl", r).addEventListener("click", function () { if (blob) VX.save(blob, base(cur.f.name) + ".gif"); });
    }
  });

  /* ---------- Screen recorder ---------- */
  function timerUI(r) {
    var t0 = 0, iv = null, el = $("#tm", r);
    return { start: function () { t0 = Date.now(); el.textContent = "0:00"; iv = setInterval(function () { var s = Math.floor((Date.now() - t0) / 1000); el.textContent = Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); }, 500); }, stop: function () { clearInterval(iv); } };
  }
  VX.tool("screen-recorder", {
    html: '<div class="row"><label class="chk"><input id="mic" type="checkbox"> Also record my microphone</label></div><div class="bar"><button class="btn" id="go" type="button">Start recording</button><button class="btn ghost" id="stp" type="button" hidden>Stop</button><span id="tm" aria-live="off" style="align-self:center;font-variant-numeric:tabular-nums"></span></div><div id="out" hidden><div class="preview"><figure><video id="rv" controls playsinline style="max-width:100%;max-height:340px;border-radius:10px"></video><figcaption id="rinfo"></figcaption></figure></div><div class="bar"><button class="btn" id="dl" type="button">Download recording</button></div></div><div class="msg" id="m">Your browser will ask what to share (screen, window or tab). Nothing is uploaded.</div>',
    init: function (r) {
      if (!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) { note(r, "Screen recording is not supported in this browser. Try Chrome, Edge or Firefox on a computer.", 1); $("#go", r).disabled = true; return; }
      var rec = null, blob = null, mime = "", tm = timerUI(r), streams = [];
      function cleanup() { streams.forEach(function (s) { s.getTracks().forEach(function (t) { t.stop(); }); }); streams = []; tm.stop(); $("#go", r).hidden = false; $("#stp", r).hidden = true; }
      $("#go", r).addEventListener("click", function () {
        mime = pickMime("video"); if (!mime) { note(r, "This browser cannot record video.", 1); return; }
        navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).then(function (disp) {
          streams.push(disp); var final = disp;
          function begin(stream) {
            var chunks = []; rec = new MediaRecorder(stream, { mimeType: mime });
            rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
            rec.onstop = function () { cleanup(); blob = new Blob(chunks, { type: mime.split(";")[0] }); var u = URL.createObjectURL(blob); $("#rv", r).src = u; $("#out", r).hidden = false; $("#rinfo", r).textContent = VX.bytes(blob.size); note(r, "Recording saved below."); };
            disp.getVideoTracks()[0].addEventListener("ended", function () { if (rec && rec.state !== "inactive") rec.stop(); });
            rec.start(1000); tm.start(); $("#go", r).hidden = true; $("#stp", r).hidden = false; $("#out", r).hidden = true; note(r, "Recording… press Stop when you are done.");
          }
          if ($("#mic", r).checked) {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(function (mic) {
              streams.push(mic);
              var ac = new (window.AudioContext || window.webkitAudioContext)(), dest = ac.createMediaStreamDestination();
              ac.createMediaStreamSource(mic).connect(dest);
              if (disp.getAudioTracks().length) ac.createMediaStreamSource(new MediaStream(disp.getAudioTracks())).connect(dest);
              begin(new MediaStream(disp.getVideoTracks().concat(dest.stream.getAudioTracks())));
            }).catch(function () { note(r, "Microphone access was denied, recording the screen only."); begin(final); });
          } else begin(final);
        }).catch(function (e) { note(r, e && e.name === "NotAllowedError" ? "Recording was cancelled or not allowed." : "Could not start recording.", 1); });
      });
      $("#stp", r).addEventListener("click", function () { if (rec && rec.state !== "inactive") rec.stop(); });
      $("#dl", r).addEventListener("click", function () { if (blob) VX.save(blob, "screen-recording." + extOf(mime)); });
    }
  });

  /* ---------- Voice recorder ---------- */
  VX.tool("voice-recorder", {
    html: '<div class="bar"><button class="btn" id="go" type="button">Start recording</button><button class="btn ghost" id="stp" type="button" hidden>Stop</button><span id="tm" style="align-self:center;font-variant-numeric:tabular-nums"></span></div><div id="out" hidden><audio id="au" controls style="width:100%"></audio><div class="bar"><button class="btn" id="dl" type="button">Download recording</button></div></div><div class="msg" id="m">Your browser will ask for microphone permission. Recordings stay on your device.</div>',
    init: function (r) {
      if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || !window.MediaRecorder) { note(r, "Voice recording is not supported in this browser.", 1); $("#go", r).disabled = true; return; }
      var rec = null, blob = null, mime = pickMime("audio"), tm = timerUI(r), stream = null;
      $("#go", r).addEventListener("click", function () {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
          stream = s; var chunks = []; rec = mime ? new MediaRecorder(s, { mimeType: mime }) : new MediaRecorder(s);
          rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
          rec.onstop = function () { s.getTracks().forEach(function (t) { t.stop(); }); tm.stop(); $("#go", r).hidden = false; $("#stp", r).hidden = true; blob = new Blob(chunks, { type: (rec.mimeType || mime || "audio/webm").split(";")[0] }); $("#au", r).src = URL.createObjectURL(blob); $("#out", r).hidden = false; note(r, "Saved – " + VX.bytes(blob.size) + "."); };
          rec.start(1000); tm.start(); $("#go", r).hidden = true; $("#stp", r).hidden = false; $("#out", r).hidden = true; note(r, "Recording… press Stop when you are done.");
        }).catch(function () { note(r, "Microphone access was denied or no microphone was found.", 1); });
      });
      $("#stp", r).addEventListener("click", function () { if (rec && rec.state !== "inactive") rec.stop(); });
      $("#dl", r).addEventListener("click", function () { if (blob) VX.save(blob, "voice-recording." + extOf(blob.type)); });
    }
  });
})();
