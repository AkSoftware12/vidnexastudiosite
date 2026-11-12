/* Vidnexa Studio – shared site script (small, no dependencies) */
(function () {
  "use strict";
  var cfg = window.VX_CFG || {};
  // mobile nav
  var t = document.getElementById("navToggle"), n = document.getElementById("nav");
  if (t && n) {
    t.addEventListener("click", function () {
      var open = n.classList.toggle("open");
      t.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  // ads: only turned on when an AdSense client id is set in the build config
  if (cfg.adsClient) {
    document.documentElement.classList.add("ads-on");
    var s = document.createElement("script");
    s.async = true; s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(cfg.adsClient);
    document.head.appendChild(s);
    document.querySelectorAll("ins.adsbygoogle").forEach(function () {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    });
  }
  // tools / games list filter
  var q = document.getElementById("listSearch");
  var cats = document.querySelectorAll("[data-cat-btn]");
  var items = document.querySelectorAll("[data-item]");
  if (items.length) {
    var cat = "all";
    var apply = function () {
      var term = q ? q.value.trim().toLowerCase() : "";
      var shown = 0;
      items.forEach(function (el) {
        var ok = (cat === "all" || el.getAttribute("data-cat") === cat) &&
          (!term || el.getAttribute("data-text").indexOf(term) !== -1);
        el.hidden = !ok; if (ok) shown++;
      });
      document.querySelectorAll("[data-group]").forEach(function (g) {
        g.hidden = !g.querySelector("[data-item]:not([hidden])");
      });
      var e = document.getElementById("emptyMsg"); if (e) e.hidden = shown !== 0;
    };
    if (q) q.addEventListener("input", apply);
    cats.forEach(function (b) {
      b.addEventListener("click", function () {
        cat = b.getAttribute("data-cat-btn");
        cats.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        apply();
      });
    });
  }
})();

/* scroll reveal + hero parallax */
(function () {
  "use strict";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var els = document.querySelectorAll(".rv");
  if (reduce || !("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("seen"); }); }
  else {
    var io = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add("seen"); io.unobserve(x.target); } }); }, { rootMargin: "0px 0px -8% 0px", threshold: .08 });
    els.forEach(function (e) { io.observe(e); });
  }
  var hx = document.querySelector(".hx");
  if (hx && !reduce && window.matchMedia("(pointer:fine)").matches) {
    var raf = 0;
    window.addEventListener("pointermove", function (e) {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0; var b = hx.getBoundingClientRect();
        var mx = Math.max(-1, Math.min(1, (e.clientX - (b.left + b.width / 2)) / (b.width))), my = Math.max(-1, Math.min(1, (e.clientY - (b.top + b.height / 2)) / (b.height)));
        hx.style.setProperty("--mx", mx.toFixed(3)); hx.style.setProperty("--my", my.toFixed(3));
      });
    }, { passive: true });
  }
})();
