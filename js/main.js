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

  /* -------- Customize: Paint / Driving style / Wheel -------- */
  var paintGrid = document.getElementById("paintGrid");
  var carTint = document.getElementById("carTint");

  function hexToRgba(hex, alpha) {
    var h = hex.replace("#", "");
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
  }

  function hexToHsl(hex) {
    var h = hex.replace("#", "");
    var r = parseInt(h.substring(0, 2), 16) / 255;
    var g = parseInt(h.substring(2, 4), 16) / 255;
    var b = parseInt(h.substring(4, 6), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var l = (max + min) / 2, s;
    if (max === min) {
      s = 0;
    } else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    }
    return { s: s * 100, l: l * 100 };
  }

  /* Generate a body-only alpha mask from car.png: opaque only on the
     mid-tone pixels (silver body), transparent on bright pixels (white
     bg) and dark pixels (tires). Set as the mask-image for #carTint. */
  function setupBodyMask() {
    if (!carTint) return;
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      var c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      var ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      var d = ctx.getImageData(0, 0, c.width, c.height);
      var data = d.data;
      for (var i = 0; i < data.length; i += 4) {
        var lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        var alpha;
        if (lum > 240 || lum < 45) {
          alpha = 0; // hide bright bg + dark tires
        } else {
          var distFromEdge = Math.min(lum - 45, 240 - lum);
          alpha = Math.min(255, distFromEdge * 6);
        }
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = alpha;
      }
      ctx.putImageData(d, 0, 0);
      var url = c.toDataURL("image/png");
      carTint.style.maskImage = "url(" + url + ")";
      carTint.style.webkitMaskImage = "url(" + url + ")";
      carTint.style.maskMode = "alpha";
      carTint.style.webkitMaskMode = "alpha";
      carTint.style.maskSize = "contain";
      carTint.style.webkitMaskSize = "contain";
      carTint.style.maskPosition = "center";
      carTint.style.webkitMaskPosition = "center";
      carTint.style.maskRepeat = "no-repeat";
      carTint.style.webkitMaskRepeat = "no-repeat";
    };
    img.src = "assets/car.png";
  }
  if (carTint) setupBodyMask();

  function applyCarColor(color) {
    if (!carTint) return;
    var hsl = hexToHsl(color);
    var isGrayscale = hsl.s < 5;
    if (isGrayscale) {
      // For white/black/gray, color blend mode does nothing (S=0).
      // Use normal alpha overlay so the body actually changes luminance.
      carTint.style.mixBlendMode = "normal";
      carTint.style.backgroundColor = hexToRgba(color, 0.85);
    } else {
      // Chromatic — preserve underlying shading via color blend.
      carTint.style.mixBlendMode = "color";
      carTint.style.backgroundColor = hexToRgba(color, 0.85);
    }
  }

  if (paintGrid) {
    paintGrid.addEventListener("click", function (e) {
      var btn = e.target.closest(".swatch-cell");
      if (!btn) return;
      paintGrid.querySelectorAll(".swatch-cell")
        .forEach(function (s) { s.classList.remove("active"); });
      btn.classList.add("active");
      applyCarColor(btn.dataset.color);
    });
  }

  var styleStack = document.getElementById("styleStack");
  if (styleStack) {
    styleStack.addEventListener("click", function (e) {
      var btn = e.target.closest(".style-pill");
      if (!btn) return;
      styleStack.querySelectorAll(".style-pill")
        .forEach(function (s) { s.classList.remove("active"); });
      btn.classList.add("active");
    });
  }

  var wheelStack = document.getElementById("wheelStack");
  if (wheelStack) {
    wheelStack.addEventListener("click", function (e) {
      var btn = e.target.closest(".wheel-card");
      if (!btn) return;
      wheelStack.querySelectorAll(".wheel-card")
        .forEach(function (w) { w.classList.remove("active"); });
      btn.classList.add("active");
    });
  }

  /* 360° drag-based rotation — pointer drag (mouse + touch) and an
     exposed API used by hand-tracking.js for hand gestures. */
  var rotateBadge = document.querySelector(".rotate-badge");
  var carStage = document.getElementById("carStage");
  var carRotation = 0;
  var dragActive = false;
  var dragStartX = 0;
  var dragStartRot = 0;
  var DRAG_SENS = 0.6; // degrees per pixel

  function setCarRotation(deg) {
    carRotation = deg;
    if (carStage) {
      carStage.style.setProperty("--car-rotate", carRotation + "deg");
    }
  }

  if (carStage) {
    carStage.addEventListener("pointerdown", function (e) {
      // Ignore drag start when interacting with the badge — let it click.
      if (e.target.closest(".rotate-badge")) return;
      dragActive = true;
      dragStartX = e.clientX;
      dragStartRot = carRotation;
      carStage.classList.add("dragging");
      try { carStage.setPointerCapture(e.pointerId); } catch (_) {}
    });
    carStage.addEventListener("pointermove", function (e) {
      if (!dragActive) return;
      var dx = e.clientX - dragStartX;
      setCarRotation(dragStartRot + dx * DRAG_SENS);
    });
    function endDrag(e) {
      if (!dragActive) return;
      dragActive = false;
      carStage.classList.remove("dragging");
      try { carStage.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    carStage.addEventListener("pointerup", endDrag);
    carStage.addEventListener("pointercancel", endDrag);
  }

  /* Badge: click to snap rotation back to 0 (resets car orientation) */
  if (rotateBadge && carStage) {
    rotateBadge.addEventListener("click", function (e) {
      e.stopPropagation();
      // Smooth reset by transitioning the CSS var via a brief animation.
      var img = carStage.querySelector(".car-image");
      var tint = carStage.querySelector(".car-tint");
      if (img) img.style.transition = "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
      if (tint) tint.style.transition = "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
      setCarRotation(0);
      setTimeout(function () {
        if (img) img.style.transition = "";
        if (tint) tint.style.transition = "";
      }, 650);
    });
  }

  // Expose API for hand-tracking.js
  window.HEX = window.HEX || {};
  window.HEX.carRotateBy = function (deltaDeg) { setCarRotation(carRotation + deltaDeg); };
  window.HEX.carRotateReset = function () { setCarRotation(0); };
  window.HEX.carStage = carStage;
  window.HEX.dragSensitivity = DRAG_SENS;

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
