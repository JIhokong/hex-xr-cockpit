/* HEX — XR F1 Cockpit System
   Lightweight interactions, no dependencies. */

(function () {
  "use strict";

  /* -------- Welcome: tiny press feedback -------- */
  var readyBtn = document.getElementById("readyBtn");
  if (readyBtn) {
    readyBtn.addEventListener("click", function () {
      readyBtn.style.transform = "scale(0.97)";
    });
  }

  /* -------- Customize: color swatches & spec options -------- */
  var carBody = document.getElementById("carBody");
  var rearWing = document.getElementById("rearWing");
  var frontWing = document.getElementById("frontWing");
  var frontWingBottom = document.querySelectorAll("#carSvg rect[fill='var(--car-color, #e63b2e)']");

  function applyCarColor(color) {
    var svg = document.getElementById("carSvg");
    if (!svg) return;
    svg.style.setProperty("--car-color", color);
    // Force re-paint for older Safari handling of CSS vars on SVG attrs
    var painted = svg.querySelectorAll("[fill='var(--car-color, #e63b2e)']");
    painted.forEach(function (el) {
      el.setAttribute("fill", color);
      el.setAttribute("data-themed", "1");
    });
    document.querySelectorAll("[data-themed='1']").forEach(function (el) {
      el.setAttribute("fill", color);
    });
  }

  var colorRow = document.getElementById("colorRow");
  if (colorRow) {
    colorRow.addEventListener("click", function (e) {
      var btn = e.target.closest(".swatch");
      if (!btn) return;
      colorRow
        .querySelectorAll(".swatch")
        .forEach(function (s) { s.classList.remove("active"); });
      btn.classList.add("active");
      applyCarColor(btn.dataset.color);
    });
  }

  /* Stats table -------------------------------------------- */
  var SPEC = {
    engine: {
      balanced: { speed: 348, corner: 82, stab: 74, label: "V6 Balanced" },
      speed:    { speed: 372, corner: 70, stab: 68, label: "V6 Top Speed" },
      agile:    { speed: 322, corner: 92, stab: 80, label: "V6 Agile" }
    },
    tire: {
      soft:   { corner: 6, stab: -4 },
      medium: { corner: 0, stab: 0 },
      hard:   { corner: -5, stab: 8 }
    }
  };

  var state = { engine: "balanced", tire: "soft" };

  function recalc() {
    var e = SPEC.engine[state.engine];
    var t = SPEC.tire[state.tire];
    var corner = Math.max(40, Math.min(99, e.corner + t.corner));
    var stab = Math.max(40, Math.min(99, e.stab + t.stab));
    var speed = e.speed;

    var sEl = document.getElementById("statSpeed");
    var cEl = document.getElementById("statCorner");
    var stEl = document.getElementById("statStab");
    var bs = document.getElementById("barSpeed");
    var bc = document.getElementById("barCorner");
    var bt = document.getElementById("barStab");
    if (!sEl) return;

    sEl.innerHTML = speed + '<span style="font-size:13px;color:var(--muted)"> km/h</span>';
    cEl.innerHTML = corner + '<span style="font-size:13px;color:var(--muted)"> pt</span>';
    stEl.innerHTML = stab + '<span style="font-size:13px;color:var(--muted)"> pt</span>';
    bs.style.width = Math.round((speed / 400) * 100) + "%";
    bc.style.width = corner + "%";
    bt.style.width = stab + "%";
  }

  document.querySelectorAll("[data-group='engine'] .opt").forEach(function (b) {
    b.addEventListener("click", function () {
      document
        .querySelectorAll("[data-group='engine'] .opt")
        .forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      state.engine = b.dataset.engine;
      recalc();
    });
  });
  document.querySelectorAll("[data-group='tire'] .opt").forEach(function (b) {
    b.addEventListener("click", function () {
      document
        .querySelectorAll("[data-group='tire'] .opt")
        .forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      state.tire = b.dataset.tire;
      recalc();
    });
  });

  /* Stage rotate (visual nudge) */
  var rotate = 0;
  var carSvg = document.getElementById("carSvg");
  var rotateBtns = document.querySelectorAll(".stage-rotate button");
  if (carSvg && rotateBtns.length) {
    rotateBtns[0].addEventListener("click", function () {
      rotate -= 12; carSvg.style.transform = "perspective(1000px) rotateY(" + rotate + "deg)";
    });
    rotateBtns[1].addEventListener("click", function () {
      rotate = 0; carSvg.style.transform = "perspective(1000px) rotateY(0deg)";
    });
    rotateBtns[2].addEventListener("click", function () {
      rotate += 12; carSvg.style.transform = "perspective(1000px) rotateY(" + rotate + "deg)";
    });
  }

  /* -------- Circuit page: track selection -------- */
  var trackGrid = document.getElementById("trackGrid");
  if (trackGrid) {
    trackGrid.addEventListener("click", function (e) {
      var card = e.target.closest(".track");
      if (!card) return;
      trackGrid
        .querySelectorAll(".track")
        .forEach(function (t) {
          t.classList.remove("active");
          var b = t.querySelector(".track-badge");
          if (b && b.textContent === "Selected") b.remove();
        });
      card.classList.add("active");
      if (!card.querySelector(".track-badge")) {
        var span = document.createElement("span");
        span.className = "track-badge";
        span.textContent = "Selected";
        card.appendChild(span);
      } else if (card.querySelector(".track-badge").textContent !== "Selected") {
        // keep "New" badges, but ensure a "Selected" indicator
        var b2 = document.createElement("span");
        b2.className = "track-badge";
        b2.style.top = "40px";
        b2.textContent = "Selected";
        card.appendChild(b2);
      }
    });
  }

  /* -------- Race page: telemetry simulation -------- */
  var speedEl = document.getElementById("speedVal");
  var gearEl = document.getElementById("gearVal");
  var rpmEl = document.getElementById("rpmVal");
  var drsEl = document.getElementById("drsVal");
  var fuelEl = document.getElementById("fuelVal");
  var lapEl = document.getElementById("lapTime");
  var startBtn = document.getElementById("startBtn");

  if (speedEl && startBtn) {
    var running = false;
    var t0 = 0;
    var anim = 0;
    var speed = 0;
    var fuel = 100;

    function pad(n, w) {
      n = String(n);
      while (n.length < w) n = "0" + n;
      return n;
    }

    function fmt(ms) {
      var total = Math.max(0, Math.floor(ms));
      var min = Math.floor(total / 60000);
      var sec = Math.floor((total % 60000) / 1000);
      var mil = total % 1000;
      return pad(min, 2) + ":" + pad(sec, 2) + "." + pad(mil, 3);
    }

    function frame(ts) {
      if (!running) return;
      if (!t0) t0 = ts;
      var elapsed = ts - t0;
      lapEl.textContent = fmt(elapsed);

      // Speed bobs between 180-340 like a lap with throttle/brake cycles
      var phase = (elapsed % 11000) / 11000;
      var target =
        180 +
        Math.sin(phase * Math.PI * 2) * 60 +
        Math.sin(phase * Math.PI * 6) * 30 +
        60;
      speed += (target - speed) * 0.08;
      speedEl.textContent = pad(Math.round(speed), 3);

      var g = Math.min(8, Math.max(1, Math.round(speed / 45)));
      gearEl.textContent = g;
      var rpm = Math.round((4 + (speed / 340) * 9) * 10) / 10;
      rpmEl.innerHTML = rpm.toFixed(1) + '<span>×1000</span>';
      drsEl.textContent = speed > 280 ? "OPEN" : "OFF";
      drsEl.style.color = speed > 280 ? "#4ade80" : "#fff";

      fuel = Math.max(0, fuel - 0.005);
      fuelEl.innerHTML = fuel.toFixed(1) + '<span>%</span>';

      anim = requestAnimationFrame(frame);
    }

    startBtn.addEventListener("click", function () {
      running = !running;
      if (running) {
        startBtn.innerHTML = 'Engine Running <span class="chev">●</span>';
        startBtn.style.background = "#e63b2e";
        t0 = 0;
        anim = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(anim);
        startBtn.innerHTML = 'Start Engine <span class="chev">»</span>';
        startBtn.style.background = "";
      }
    });
  }

  /* -------- Brand mark micro-interaction -------- */
  document.querySelectorAll(".brand").forEach(function (b) {
    b.style.cursor = "pointer";
    b.addEventListener("click", function () {
      window.location.href = "index.html";
    });
  });
})();
