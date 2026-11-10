/* Calculator tools */
(function () {
  "use strict";
  var VX = window.VX, $ = VX.$;

  function fld(id, label, val, extra) {
    return '<div class="fld"><label for="' + id + '">' + label + '</label><input id="' + id + '" class="in" type="number" inputmode="decimal" step="any" value="' + (val == null ? "" : val) + '"' + (extra || "") + "></div>";
  }
  function live(r, ids, fn) {
    ids.forEach(function (i) { var e = $("#" + i, r); e.addEventListener("input", fn); e.addEventListener("change", fn); });
    fn();
  }

  VX.tool("age-calculator", {
    html: '<div class="row"><div class="fld"><label for="dob">Date of birth</label><input id="dob" class="in" type="date"></div><div class="fld"><label for="on">Age on date</label><input id="on" class="in" type="date"></div></div><div class="stats" id="s"></div><div class="msg" id="m"></div>',
    init: function (r) {
      var today = new Date(); $("#on", r).value = today.toISOString().slice(0, 10);
      live(r, ["dob", "on"], function () {
        var d = $("#dob", r).value, o = $("#on", r).value, s = $("#s", r), m = $("#m", r);
        s.innerHTML = ""; m.textContent = ""; m.className = "msg";
        if (!d || !o) { m.textContent = "Pick your date of birth to see your age."; return; }
        var a = new Date(d + "T00:00:00"), b = new Date(o + "T00:00:00");
        if (a > b) { m.textContent = "Date of birth must be before the second date."; m.className = "msg err"; return; }
        var y = b.getFullYear() - a.getFullYear(), mo = b.getMonth() - a.getMonth(), dy = b.getDate() - a.getDate();
        if (dy < 0) { mo--; dy += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); }
        if (mo < 0) { y--; mo += 12; }
        var days = Math.round((b - a) / 864e5);
        var nb = new Date(b.getFullYear(), a.getMonth(), a.getDate()); if (nb < b) nb.setFullYear(b.getFullYear() + 1);
        var left = Math.round((nb - b) / 864e5);
        s.innerHTML = VX.stat("Age", y + " years " + mo + " months " + dy + " days") + VX.stat("Total months", y * 12 + mo) + VX.stat("Total weeks", Math.floor(days / 7)) + VX.stat("Total days", VX.fmt(days, 0)) + VX.stat("Next birthday in", left + " days");
      });
    }
  });

  VX.tool("emi-calculator", {
    html: '<div class="row">' + fld("p", "Loan amount (₹)", 1000000) + fld("r", "Interest rate (% per year)", 9.5) + fld("n", "Tenure", 5) + '<div class="fld"><label for="u">Tenure in</label><select id="u" class="in"><option value="y">Years</option><option value="m">Months</option></select></div></div><div class="stats" id="s"></div><div class="msg" id="m"></div><div class="tbl-wrap"><table class="tbl" id="t"></table></div>',
    init: function (r) {
      live(r, ["p", "r", "n", "u"], function () {
        var P = VX.num($("#p", r)), R = VX.num($("#r", r)), N = VX.num($("#n", r)); if ($("#u", r).value === "y") N *= 12;
        var s = $("#s", r), t = $("#t", r); t.innerHTML = "";
        if (!(P > 0) || !(N > 0) || !(R >= 0)) { s.innerHTML = ""; return; }
        var i = R / 1200, e = i === 0 ? P / N : P * i * Math.pow(1 + i, N) / (Math.pow(1 + i, N) - 1), tot = e * N;
        s.innerHTML = VX.stat("Monthly EMI", VX.inr(e)) + VX.stat("Total interest", VX.inr(tot - P)) + VX.stat("Total payment", VX.inr(tot));
        var bal = P, h = "<thead><tr><th>Year</th><th>Principal paid</th><th>Interest paid</th><th>Balance</th></tr></thead><tbody>", yp = 0, yi = 0;
        for (var k = 1; k <= Math.round(N); k++) {
          var it = bal * i, pr = e - it; bal = Math.max(0, bal - pr); yp += pr; yi += it;
          if (k % 12 === 0 || k === Math.round(N)) { h += "<tr><td>" + Math.ceil(k / 12) + "</td><td>" + VX.inr(yp) + "</td><td>" + VX.inr(yi) + "</td><td>" + VX.inr(bal) + "</td></tr>"; yp = 0; yi = 0; }
        }
        t.innerHTML = h + "</tbody>";
      });
    }
  });

  VX.tool("percentage-calculator", {
    html: '<h2 class="sub">What is X% of Y?</h2><div class="row">' + fld("a1", "Percent (%)", 15) + fld("b1", "Of number", 2000) + '</div><div class="out" id="o1"></div><h2 class="sub">X is what % of Y?</h2><div class="row">' + fld("a2", "Number X", 300) + fld("b2", "Number Y", 2000) + '</div><div class="out" id="o2"></div><h2 class="sub">Percentage change from X to Y</h2><div class="row">' + fld("a3", "From (X)", 800) + fld("b3", "To (Y)", 1000) + '</div><div class="out" id="o3"></div>',
    init: function (r) {
      live(r, ["a1", "b1", "a2", "b2", "a3", "b3"], function () {
        var v = function (i) { return VX.num($("#" + i, r)); };
        $("#o1", r).textContent = isFinite(v("a1") * v("b1")) ? v("a1") + "% of " + VX.fmt(v("b1")) + " = " + VX.fmt(v("a1") * v("b1") / 100, 4) : "";
        $("#o2", r).textContent = v("b2") ? VX.fmt(v("a2")) + " is " + VX.fmt(v("a2") / v("b2") * 100, 4) + "% of " + VX.fmt(v("b2")) : "";
        if (v("a3")) { var c = (v("b3") - v("a3")) / Math.abs(v("a3")) * 100; $("#o3", r).textContent = (c >= 0 ? "Increase of " : "Decrease of ") + VX.fmt(Math.abs(c), 4) + "%"; } else $("#o3", r).textContent = "";
      });
    }
  });

  VX.tool("bmi-calculator", {
    html: '<div class="row">' + fld("h", "Height (cm)", 170) + fld("w", "Weight (kg)", 65) + '</div><div class="stats" id="s"></div><div class="msg" id="m"></div>',
    init: function (r) {
      live(r, ["h", "w"], function () {
        var h = VX.num($("#h", r)) / 100, w = VX.num($("#w", r)), s = $("#s", r), m = $("#m", r);
        if (!(h > 0.5) || !(w > 0)) { s.innerHTML = ""; m.textContent = ""; return; }
        var b = w / (h * h), c = b < 18.5 ? "Underweight" : b < 25 ? "Normal weight" : b < 30 ? "Overweight" : "Obese";
        s.innerHTML = VX.stat("BMI", b.toFixed(1)) + VX.stat("Category", c) + VX.stat("Healthy weight range", (18.5 * h * h).toFixed(1) + " – " + (24.9 * h * h).toFixed(1) + " kg");
        m.textContent = "BMI is a general screening number. It does not account for muscle, age or body type. Talk to a doctor for health advice.";
      });
    }
  });

  VX.tool("sip-calculator", {
    html: '<div class="row">' + fld("p", "Monthly investment (₹)", 5000) + fld("r", "Expected return (% per year)", 12) + fld("y", "Time (years)", 10) + '</div><div class="stats" id="s"></div><div class="msg" id="m">Returns are only an estimate. Real market returns vary and are not guaranteed.</div>',
    init: function (r) {
      live(r, ["p", "r", "y"], function () {
        var P = VX.num($("#p", r)), R = VX.num($("#r", r)), Y = VX.num($("#y", r)), s = $("#s", r);
        if (!(P > 0) || !(Y > 0) || !(R >= 0)) { s.innerHTML = ""; return; }
        var n = Math.round(Y * 12), i = R / 1200, fv = i === 0 ? P * n : P * ((Math.pow(1 + i, n) - 1) / i) * (1 + i), inv = P * n;
        s.innerHTML = VX.stat("Amount invested", VX.inr(inv)) + VX.stat("Estimated returns", VX.inr(fv - inv)) + VX.stat("Total value", VX.inr(fv));
      });
    }
  });

  VX.tool("gst-calculator", {
    html: '<div class="row">' + fld("a", "Amount (₹)", 1000) + '<div class="fld"><label for="g">GST rate</label><select id="g" class="in"><option>3</option><option>5</option><option>12</option><option selected>18</option><option>28</option></select></div><div class="fld"><label for="t">Amount is</label><select id="t" class="in"><option value="ex">Without GST (add GST)</option><option value="in">With GST (remove GST)</option></select></div></div><div class="stats" id="s"></div>',
    init: function (r) {
      live(r, ["a", "g", "t"], function () {
        var a = VX.num($("#a", r)), g = +$("#g", r).value, s = $("#s", r);
        if (!(a >= 0)) { s.innerHTML = ""; return; }
        var base, tax;
        if ($("#t", r).value === "ex") { base = a; tax = a * g / 100; } else { base = a * 100 / (100 + g); tax = a - base; }
        s.innerHTML = VX.stat("Net amount", VX.inr(base)) + VX.stat("CGST (" + g / 2 + "%)", VX.inr(tax / 2)) + VX.stat("SGST (" + g / 2 + "%)", VX.inr(tax / 2)) + VX.stat("Total GST", VX.inr(tax)) + VX.stat("Gross amount", VX.inr(base + tax));
      });
    }
  });

  VX.tool("discount-calculator", {
    html: '<div class="row">' + fld("p", "Original price (₹)", 2499) + fld("d", "Discount (%)", 30) + fld("e", "Extra off (%) – optional", 0) + '</div><div class="stats" id="s"></div>',
    init: function (r) {
      live(r, ["p", "d", "e"], function () {
        var p = VX.num($("#p", r)), d = VX.num($("#d", r)) || 0, e = VX.num($("#e", r)) || 0, s = $("#s", r);
        if (!(p >= 0)) { s.innerHTML = ""; return; }
        var f = p * (1 - d / 100) * (1 - e / 100);
        s.innerHTML = VX.stat("You pay", VX.inr(f)) + VX.stat("You save", VX.inr(p - f)) + VX.stat("Total discount", VX.fmt(p ? (p - f) / p * 100 : 0, 2) + "%");
      });
    }
  });

  VX.tool("date-difference-calculator", {
    html: '<div class="row"><div class="fld"><label for="a">Start date</label><input id="a" class="in" type="date"></div><div class="fld"><label for="b">End date</label><input id="b" class="in" type="date"></div></div><div class="stats" id="s"></div>',
    init: function (r) {
      var t = new Date().toISOString().slice(0, 10); $("#a", r).value = t; $("#b", r).value = t;
      live(r, ["a", "b"], function () {
        var a = $("#a", r).value, b = $("#b", r).value, s = $("#s", r); if (!a || !b) { s.innerHTML = ""; return; }
        var x = new Date(a + "T00:00:00"), y = new Date(b + "T00:00:00"); if (x > y) { var z = x; x = y; y = z; }
        var yr = y.getFullYear() - x.getFullYear(), mo = y.getMonth() - x.getMonth(), dy = y.getDate() - x.getDate();
        if (dy < 0) { mo--; dy += new Date(y.getFullYear(), y.getMonth(), 0).getDate(); } if (mo < 0) { yr--; mo += 12; }
        var d = Math.round((y - x) / 864e5);
        s.innerHTML = VX.stat("Difference", yr + "y " + mo + "m " + dy + "d") + VX.stat("Total days", VX.fmt(d, 0)) + VX.stat("Weeks", (d / 7).toFixed(1)) + VX.stat("Hours", VX.fmt(d * 24, 0));
      });
    }
  });

  VX.tool("interest-calculator", {
    html: '<div class="row">' + fld("p", "Principal (₹)", 100000) + fld("r", "Rate (% per year)", 7) + fld("y", "Time (years)", 5) + '<div class="fld"><label for="c">Compounding</label><select id="c" class="in"><option value="0">Simple interest</option><option value="1">Yearly</option><option value="2">Half-yearly</option><option value="4" selected>Quarterly</option><option value="12">Monthly</option></select></div></div><div class="stats" id="s"></div>',
    init: function (r) {
      live(r, ["p", "r", "y", "c"], function () {
        var P = VX.num($("#p", r)), R = VX.num($("#r", r)), Y = VX.num($("#y", r)), c = +$("#c", r).value, s = $("#s", r);
        if (!(P > 0) || !(R >= 0) || !(Y > 0)) { s.innerHTML = ""; return; }
        var A = c === 0 ? P * (1 + R * Y / 100) : P * Math.pow(1 + R / 100 / c, c * Y);
        s.innerHTML = VX.stat("Interest earned", VX.inr(A - P)) + VX.stat("Maturity amount", VX.inr(A)) + VX.stat("Principal", VX.inr(P));
      });
    }
  });

  var U = {
    Length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mile: 1609.344, yard: 0.9144, foot: 0.3048, inch: 0.0254 },
    Weight: { kg: 1, g: 0.001, mg: 1e-6, tonne: 1000, pound: 0.45359237, ounce: 0.028349523125, quintal: 100 },
    Area: { "sq m": 1, "sq km": 1e6, "sq ft": 0.09290304, "sq yard": 0.83612736, acre: 4046.8564224, hectare: 10000, bigha: 2529.285 },
    Volume: { litre: 1, ml: 0.001, "cubic m": 1000, gallon: 3.785411784, cup: 0.2365882365, "fl oz": 0.0295735295625 },
    Speed: { "km/h": 1, "m/s": 3.6, mph: 1.609344, knot: 1.852 },
    Data: { byte: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 },
    Temperature: {}
  };
  VX.tool("unit-converter", {
    html: '<div class="fld"><label for="k">Type</label><select id="k" class="in"></select></div><div class="row">' + fld("v", "Value", 1) + '<div class="fld"><label for="f">From</label><select id="f" class="in"></select></div><div class="fld"><label for="t">To</label><select id="t" class="in"></select></div></div><div class="out" id="o"></div>',
    init: function (r) {
      var k = $("#k", r), f = $("#f", r), t = $("#t", r);
      k.innerHTML = Object.keys(U).map(function (x) { return "<option>" + x + "</option>"; }).join("");
      function units() {
        var l = k.value === "Temperature" ? ["Celsius", "Fahrenheit", "Kelvin"] : Object.keys(U[k.value]);
        var h = l.map(function (x) { return "<option>" + x + "</option>"; }).join(""); f.innerHTML = h; t.innerHTML = h; t.selectedIndex = Math.min(1, l.length - 1);
      }
      function conv() {
        var v = VX.num($("#v", r)); if (!isFinite(v)) { $("#o", r).textContent = ""; return; }
        var res;
        if (k.value === "Temperature") {
          var c = f.value === "Celsius" ? v : f.value === "Fahrenheit" ? (v - 32) * 5 / 9 : v - 273.15;
          res = t.value === "Celsius" ? c : t.value === "Fahrenheit" ? c * 9 / 5 + 32 : c + 273.15;
        } else res = v * U[k.value][f.value] / U[k.value][t.value];
        $("#o", r).textContent = VX.fmt(v, 6) + " " + f.value + " = " + VX.fmt(res, 6) + " " + t.value;
      }
      k.addEventListener("change", function () { units(); conv(); });
      ["v", "f", "t"].forEach(function (i) { $("#" + i, r).addEventListener("input", conv); $("#" + i, r).addEventListener("change", conv); });
      units(); conv();
    }
  });

  VX.tool("random-number-generator", {
    html: '<div class="row">' + fld("a", "Minimum", 1) + fld("b", "Maximum", 100) + fld("n", "How many", 1) + '</div><label class="chk"><input id="u" type="checkbox"> No repeats</label><div class="bar"><button class="btn" id="g" type="button">Generate</button><button class="btn ghost" id="cp" type="button">Copy</button></div><div class="out big" id="o"></div><div class="msg" id="m"></div>',
    init: function (r) {
      function rnd(n) { var a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n, x; do { crypto.getRandomValues(a); x = a[0]; } while (x >= lim); return x % n; }
      $("#g", r).addEventListener("click", function () {
        var a = Math.floor(VX.num($("#a", r))), b = Math.floor(VX.num($("#b", r))), n = Math.floor(VX.num($("#n", r))) || 1, m = $("#m", r);
        m.textContent = ""; if (!isFinite(a) || !isFinite(b) || b < a) { m.textContent = "Maximum must be greater than or equal to minimum."; m.className = "msg err"; return; }
        n = Math.min(Math.max(n, 1), 1000); var span = b - a + 1, out = [];
        if ($("#u", r).checked) {
          if (n > span) { m.textContent = "That range only has " + span + " different numbers."; m.className = "msg err"; return; }
          var pool = []; for (var i = a; i <= b && pool.length < 1e6; i++) pool.push(i);
          for (var j = 0; j < n; j++) out.push(pool.splice(rnd(pool.length), 1)[0]);
        } else for (var k = 0; k < n; k++) out.push(a + rnd(span));
        $("#o", r).textContent = out.join(", ");
      });
      $("#cp", r).addEventListener("click", function (e) { VX.copy($("#o", r).textContent, e.target); });
    }
  });

  VX.tool("stopwatch", {
    html: '<div class="out big" id="d" style="text-align:center;font-size:44px" aria-live="off">00:00.00</div><div class="bar" style="justify-content:center"><button class="btn" id="s" type="button">Start</button><button class="btn ghost" id="l" type="button">Lap</button><button class="btn ghost" id="x" type="button">Reset</button></div><ol class="laps" id="ls"></ol>',
    init: function (r) {
      var t0 = 0, el = 0, run = false, id, laps = [], d = $("#d", r);
      function f(ms) { var c = Math.floor(ms / 10) % 100, s = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000); return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s + "." + (c < 10 ? "0" : "") + c; }
      function tick() { d.textContent = f(el + Date.now() - t0); }
      $("#s", r).addEventListener("click", function (e) {
        if (!run) { t0 = Date.now(); id = setInterval(tick, 30); run = true; e.target.textContent = "Pause"; }
        else { clearInterval(id); el += Date.now() - t0; run = false; e.target.textContent = "Resume"; tick(); }
      });
      $("#l", r).addEventListener("click", function () {
        if (!run && !el) return; var cur = el + (run ? Date.now() - t0 : 0); laps.push(cur);
        $("#ls", r).innerHTML = laps.map(function (v, i) { return "<li>Lap " + (i + 1) + ": " + f(v) + "</li>"; }).reverse().join("");
      });
      $("#x", r).addEventListener("click", function () { clearInterval(id); run = false; el = 0; laps = []; d.textContent = "00:00.00"; $("#s", r).textContent = "Start"; $("#ls", r).innerHTML = ""; });
    }
  });
})();
