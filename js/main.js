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
