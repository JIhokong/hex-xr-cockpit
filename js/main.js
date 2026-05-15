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
  var carImage = document.getElementById("carImage");
  var currentCarColor = "black";

  /* Swap the F1 car body to a pre-rendered color image. Each click loads
     `car_<name>.png` and cross-fades via opacity transition — no CSS
     filter / blend mode / tint overlay. */
  function setCarColor(name) {
    if (!carImage || !name || name === currentCarColor) return;
    currentCarColor = name;
    var src = "assets/car_" + name + ".png";
    // Preload to avoid a flash of empty image during fade.
    var pre = new Image();
    pre.onload = function () {
      carImage.style.opacity = "0";
      // After the fade-out finishes, swap src and fade back in.
      setTimeout(function () {
        carImage.src = src;
        // Force layout before re-opacity so the transition runs.
        void carImage.offsetWidth;
        carImage.style.opacity = "1";
      }, 200);
    };
    pre.src = src;
  }

  if (paintGrid) {
    paintGrid.addEventListener("click", function (e) {
      var btn = e.target.closest(".swatch-cell");
      if (!btn) return;
      paintGrid.querySelectorAll(".swatch-cell")
        .forEach(function (s) { s.classList.remove("active"); });
      btn.classList.add("active");
      setCarColor(btn.dataset.car);
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

  /* Generate 4 transparent wheel PNGs from customize-ref.jpg at load.
     Each crop covers a single wheel's bounding region; we then write
     alpha=0 for the bright panel-card background pixels so only the
     tire/rim remain. The resulting data URLs are reused as img.src on
     the wheel-slot images. */
  var WHEEL_CROPS = [
    { x: 4644, y: 1111, w: 752, h: 368 }, // wheel 0 — red sidewall
    { x: 4644, y: 1586, w: 752, h: 368 }, // wheel 1 — yellow
    { x: 4644, y: 2062, w: 752, h: 368 }, // wheel 2 — white
    { x: 4644, y: 2539, w: 752, h: 368 }  // wheel 3 — green
  ];
  var wheelDataUrls = [];

  function generateTransparentWheels() {
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      wheelDataUrls = WHEEL_CROPS.map(function (crop) {
        var c = document.createElement("canvas");
        c.width = crop.w;
        c.height = crop.h;
        var ctx = c.getContext("2d");
        ctx.drawImage(
          img,
          crop.x, crop.y, crop.w, crop.h,
          0, 0, crop.w, crop.h
        );
        var d = ctx.getImageData(0, 0, crop.w, crop.h);
        var data = d.data;
        for (var i = 0; i < data.length; i += 4) {
          var r = data[i], g = data[i + 1], b = data[i + 2];
          var lum = (r + g + b) / 3;
          if (lum >= 232) {
            data[i + 3] = 0; // bright panel bg → fully transparent
          } else if (lum > 195) {
            data[i + 3] = Math.round(255 * (232 - lum) / 37);
          }
        }
        ctx.putImageData(d, 0, 0);

        // Trim transparent edges so the wheel fills the resulting PNG —
        // when this PNG is placed in a slot with object-fit: cover, the
        // wheel completely covers the slot instead of floating in the
        // middle with empty alpha padding.
        var minX = crop.w, maxX = -1, minY = crop.h, maxY = -1;
        for (var y = 0; y < crop.h; y++) {
          for (var x = 0; x < crop.w; x++) {
            var a = data[(y * crop.w + x) * 4 + 3];
            if (a > 24) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < 0) return c.toDataURL("image/png"); // fallback
        var bw = maxX - minX + 1;
        var bh = maxY - minY + 1;
        var tight = document.createElement("canvas");
        tight.width = bw;
        tight.height = bh;
        tight.getContext("2d").drawImage(
          c,
          minX, minY, bw, bh,
          0, 0, bw, bh
        );
        return tight.toDataURL("image/png");
      });
    };
    img.src = "assets/customize-ref.jpg";
  }
  generateTransparentWheels();

  function applyCarWheel(idx) {
    var stage = document.getElementById("carStage");
    var front = document.getElementById("frontWheelImg");
    var rear = document.getElementById("rearWheelImg");
    if (!stage || !front || !rear) return;
    var url = wheelDataUrls[idx];
    if (!url) return;
    // Swap src on the existing img elements — never replace nodes.
    front.src = url;
    rear.src = url;
    stage.classList.add("wheel-selected");
  }

  /* Drag + drop animation: a ghost wheel flies from the wheel-card to
     the car's front tire while both car wheel slots glow red. */
  var wheelAnimating = false;
  function dragAndDropWheel(idx, sourceCard) {
    if (wheelAnimating || !sourceCard) {
      applyCarWheel(idx);
      return;
    }
    var stage = document.getElementById("carStage");
    var frontSlot = document.querySelector(".wheel-slot--front");
    var rearSlot = document.querySelector(".wheel-slot--rear");
    if (!stage || !frontSlot || !rearSlot) {
      applyCarWheel(idx);
      return;
    }
    wheelAnimating = true;

    var cardRect = sourceCard.getBoundingClientRect();
    var frontRect = frontSlot.getBoundingClientRect();
    var rearRect = rearSlot.getBoundingClientRect();

    var startX = cardRect.left + cardRect.width / 2;
    var startY = cardRect.top + cardRect.height / 2;
    var midX = (frontRect.left + frontRect.width / 2
              + rearRect.left + rearRect.width / 2) / 2;
    var midY = (frontRect.top + frontRect.height / 2
              + rearRect.top + rearRect.height / 2) / 2;

    // Build the flying ghost as an <img> using the same transparent PNG
    var ghost = document.createElement("img");
    ghost.className = "wheel-ghost";
    if (wheelDataUrls[idx]) ghost.src = wheelDataUrls[idx];
    ghost.style.left = startX + "px";
    ghost.style.top = startY + "px";
    document.body.appendChild(ghost);

    frontSlot.classList.add("drop-active");
    rearSlot.classList.add("drop-active");
    sourceCard.classList.add("dragging");

    void ghost.offsetHeight;
    ghost.classList.add("lifting");

    setTimeout(function () {
      ghost.classList.remove("lifting");
      ghost.classList.add("flying");
      ghost.style.left = midX + "px";
      ghost.style.top = midY + "px";
    }, 120);

    setTimeout(function () {
      applyCarWheel(idx);
      ghost.classList.remove("flying");
      ghost.classList.add("landed");
    }, 720);

    setTimeout(function () {
      ghost.remove();
      frontSlot.classList.remove("drop-active");
      rearSlot.classList.remove("drop-active");
      sourceCard.classList.remove("dragging");
      wheelAnimating = false;
    }, 1100);
  }

  var wheelStack = document.getElementById("wheelStack");
  if (wheelStack) {
    wheelStack.addEventListener("click", function (e) {
      var btn = e.target.closest(".wheel-card");
      if (!btn) return;
      var idx = parseInt(btn.dataset.wheel, 10) || 0;
      // Mark active card
      wheelStack.querySelectorAll(".wheel-card")
        .forEach(function (w) { w.classList.remove("active"); });
      btn.classList.add("active");
      // Drag-drop animation handles the actual car wheel update
      dragAndDropWheel(idx, btn);
    });
    // No default wheel applied on load — car.png's native tires show
    // until the user explicitly drops a wheel onto the car.
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
  function readTrackMeta(card) {
    var stats = card.querySelectorAll(".track-stat b");
    return {
      id: card.dataset.track || "monaco",
      name: (card.querySelector(".track-name") || {}).textContent || "",
      country: (card.querySelector(".track-country") || {}).textContent || "",
      length: stats[0] ? stats[0].textContent : "",
      turns: stats[1] ? stats[1].textContent : "",
      difficulty: stats[2] ? stats[2].textContent : ""
    };
  }
  function saveSelectedTrack(card) {
    try {
      sessionStorage.setItem(
        "hex.selectedTrack",
        JSON.stringify(readTrackMeta(card))
      );
    } catch (_) {
      // private mode → silent
    }
  }

  var trackGrid = document.getElementById("trackGrid");
  if (trackGrid) {
    var defaultActive = trackGrid.querySelector(".track.active");
    if (defaultActive) saveSelectedTrack(defaultActive);

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
      saveSelectedTrack(card);
    });
  }

  /* -------- Circuit page: scan simulation overlay -------- */
  var convertCta = document.getElementById("convertCta");
  var scanOverlay = document.getElementById("scanOverlay");
  if (convertCta && scanOverlay) {
    var scanStages = [
      { text: "Mapping room geometry", sub: "Scanning walls · 0%–34%" },
      { text: "Analyzing layout",      sub: "Matching to track topology · 34%–72%" },
      { text: "Building circuit",      sub: "Generating racing line · 72%–100%" }
    ];
    var scanBar = scanOverlay.querySelector(".scan-bar-fill");
    var scanTxt = scanOverlay.querySelector(".scan-stage-text");
    var scanSub = scanOverlay.querySelector(".scan-substep");
    var scanPips = scanOverlay.querySelectorAll(".scan-stages .pip");
    var scanRunning = false;

    function runScanStage(i) {
      if (i >= scanStages.length) {
        setTimeout(function () {
          window.location.href = "race.html";
        }, 320);
        return;
      }
      scanTxt.classList.add("swap");
      setTimeout(function () {
        scanTxt.textContent = scanStages[i].text;
        scanSub.textContent = scanStages[i].sub;
        scanTxt.classList.remove("swap");
        scanPips.forEach(function (p, k) {
          p.classList.toggle("active", k === i);
          p.classList.toggle("done", k < i);
        });
        scanBar.style.width =
          Math.round(((i + 1) / scanStages.length) * 100) + "%";
        setTimeout(function () { runScanStage(i + 1); }, 800);
      }, 180);
    }

    convertCta.addEventListener("click", function (e) {
      e.preventDefault();
      if (scanRunning) return;
      scanRunning = true;
      var active = document.querySelector(".track.active");
      if (active) saveSelectedTrack(active);
      scanOverlay.classList.add("active");
      scanBar.style.width = "0%";
      runScanStage(0);
    });
  }

  /* -------- Race page: countdown + live telemetry -------- */
  var raceStartScreen = document.getElementById("raceStartScreen");
  var raceLiveScreen = document.getElementById("raceLiveScreen");
  var raceStartBtn = document.getElementById("raceStartBtn");
  var countdownOverlay = document.getElementById("countdownOverlay");
  var countdownNum = document.getElementById("countdownNum");
  var lapEl = document.getElementById("lapTime");
  var bestLapEl = document.getElementById("bestLap");
  var speedEl = document.getElementById("speedVal");
  var gearEl = document.getElementById("gearVal");
  var speedoArc = document.getElementById("speedoArc");

  function padNum(n, w) {
    n = String(n);
    while (n.length < w) n = "0" + n;
    return n;
  }

  function fmtLap(ms) {
    var total = Math.max(0, Math.floor(ms));
    var min = Math.floor(total / 60000);
    var sec = Math.floor((total % 60000) / 1000);
    var mil = total % 1000;
    return padNum(min, 2) + ":" + padNum(sec, 2) + "." + padNum(mil, 3);
  }

  function startCountdown(then) {
    if (!countdownOverlay || !countdownNum) {
      then();
      return;
    }
    var seq = [
      { text: "3", cls: "" },
      { text: "2", cls: "" },
      { text: "1", cls: "" },
      { text: "GO", cls: "go" }
    ];
    countdownOverlay.classList.add("active");
    var i = 0;
    function step() {
      var item = seq[i];
      // Reset animation by re-adding the class
      countdownNum.classList.remove("go");
      void countdownNum.offsetWidth;
      countdownNum.textContent = item.text;
      if (item.cls) countdownNum.classList.add(item.cls);
      i++;
      if (i < seq.length) {
        setTimeout(step, item.text === "GO" ? 700 : 900);
      } else {
        setTimeout(function () {
          countdownOverlay.classList.remove("active");
          then();
        }, 600);
      }
    }
    step();
  }

  function startLiveRace() {
    if (raceStartScreen) raceStartScreen.classList.remove("active");
    if (raceLiveScreen) raceLiveScreen.classList.add("active");
    runTelemetry();
  }

  function runTelemetry() {
    if (!lapEl) return;
    var t0 = 0;
    var speed = 5;
    var bestLap = null;
    var currentLapStart = 0;

    function frame(ts) {
      if (!t0) {
        t0 = ts;
        currentLapStart = ts;
      }
      var elapsed = ts - currentLapStart;
      if (lapEl) lapEl.textContent = fmtLap(elapsed);

      // Speed cycles between 100-330 km/h with throttle/brake feel
      var phase = (elapsed % 11000) / 11000;
      var target =
        160 +
        Math.sin(phase * Math.PI * 2) * 70 +
        Math.sin(phase * Math.PI * 6) * 35 +
        60;
      speed += (target - speed) * 0.08;
      var displaySpeed = Math.round(speed);
      if (speedEl) speedEl.textContent = padNum(Math.floor(displaySpeed / 10), 2);

      var g = Math.min(8, Math.max(1, Math.round(speed / 45)));
      if (gearEl) gearEl.textContent = g;

      // Update speedo arc (full arc = 270° of circle, circumference 389.56)
      if (speedoArc) {
        var t = Math.min(1, speed / 340);
        // Fill from 0 → t of the 270° arc → dashoffset goes 389.56 → 389.56*(1-0.75*t)
        var offset = 389.56 * (1 - 0.75 * t);
        speedoArc.setAttribute("stroke-dashoffset", String(offset));
      }

      // Simulated lap completion every ~75s (mock)
      if (elapsed > 75000) {
        var lapMs = elapsed;
        if (bestLap === null || lapMs < bestLap) {
          bestLap = lapMs;
          if (bestLapEl) bestLapEl.textContent = fmtLap(bestLap);
        }
        currentLapStart = ts;
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (raceStartBtn) {
    raceStartBtn.addEventListener("click", function () {
      startCountdown(startLiveRace);
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
