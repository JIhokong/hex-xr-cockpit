// HEX — MediaPipe Hand Tracking + Hover-dwell gesture
// Loaded on Customize and Circuit pages (HTML wires <script type="module">).
// Uses @mediapipe/tasks-vision via jsDelivr CDN.

import {
  HandLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const DWELL_MS = 1000;
const IS_CIRCUIT = !!document.getElementById("trackGrid");
const IS_CUSTOMIZE = !!document.querySelector(".car-stage");
const SELECTABLE = IS_CIRCUIT
  ? ".track, .cta"
  : ".swatch-cell, .wheel-card, .style-pill, .cta";

const cursor = document.getElementById("handCursor");
const overlay = document.getElementById("handOverlay");
const progress = document.getElementById("dwellProgress");
const video = document.getElementById("webcam");
const handCanvas = document.getElementById("handCanvas");
const handPip = document.getElementById("handPip");

// MediaPipe HandLandmarker connection topology (21 landmarks).
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],          // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],          // index
  [5, 9], [9, 10], [10, 11], [11, 12],     // middle
  [9, 13], [13, 14], [14, 15], [15, 16],   // ring
  [13, 17], [17, 18], [18, 19], [19, 20],  // pinky
  [0, 17],                                  // palm edge
];

if (!cursor || !overlay || !video) {
  console.warn("[hand] overlay DOM not found — skipping init");
} else {
  init().catch((err) => {
    console.warn("[hand] init failed; falling back to mouse only:", err);
  });
}

async function init() {
  // 1) Camera permission + stream
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });
  } catch (e) {
    console.warn("[hand] camera permission denied; mouse fallback only");
    return;
  }
  video.srcObject = stream;
  // Explicit play() in addition to the `autoplay` attribute — some
  // browsers (esp. mobile Safari) need a direct call before frames start.
  try { await video.play(); } catch (_) { /* autoplay will handle it */ }
  await new Promise((res) => {
    if (video.readyState >= 2) return res();
    video.onloadeddata = () => res();
  });

  // Match canvas backing pixels to the video's intrinsic resolution so
  // landmark coordinates (normalized 0..1) map 1:1 to canvas pixels.
  const ctx = handCanvas ? handCanvas.getContext("2d") : null;
  if (handCanvas) {
    handCanvas.width = video.videoWidth || 640;
    handCanvas.height = video.videoHeight || 480;
  }

  // Show the live PIP now that the stream is producing frames.
  if (handPip) handPip.classList.add("active");

  // 2) Load MediaPipe HandLandmarker model
  const fileset = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  const handLandmarker = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  // 3) Show the cursor overlay
  overlay.classList.add("active");

  // 4) Tracking + dwell state
  let lastVideoTime = -1;
  // Smoothed cursor (px in viewport coords)
  let smooth = { x: -100, y: -100 };
  const SMOOTH_ALPHA = 0.35;

  // Dwell tracking
  let dwellTarget = null;
  let dwellStart = 0;
  const RING_CIRC = 125.6; // 2*pi*20

  // Car-rotate gesture state — when the index fingertip is over the
  // car stage, horizontal movement turns into Y-axis rotation instead
  // of dwell-click.
  let overCar = false;
  let lastCarX = 0;
  const ROTATE_SENS = 0.9; // deg per pixel of finger travel

  function setDwellProgress(p) {
    progress.setAttribute("stroke-dashoffset", String(RING_CIRC * (1 - p)));
  }

  function clearDwell() {
    dwellTarget = null;
    dwellStart = 0;
    setDwellProgress(0);
  }

  function drawLandmarks(landmarks) {
    if (!ctx || !handCanvas) return;
    const w = handCanvas.width;
    const h = handCanvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!landmarks || !landmarks.length) return;
    const lm = landmarks[0];
    // Connection lines
    ctx.strokeStyle = "rgba(230, 59, 46, 0.9)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let i = 0; i < HAND_CONNECTIONS.length; i++) {
      const a = lm[HAND_CONNECTIONS[i][0]];
      const b = lm[HAND_CONNECTIONS[i][1]];
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.stroke();
    }
    // Landmark dots
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < lm.length; i++) {
      ctx.beginPath();
      ctx.arc(lm[i].x * w, lm[i].y * h, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Highlight the index fingertip (lm[8]) — that's our cursor anchor
    ctx.fillStyle = "#e63b2e";
    ctx.beginPath();
    ctx.arc(lm[8].x * w, lm[8].y * h, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function tick() {
    const now = performance.now();
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const result = handLandmarker.detectForVideo(video, now);

      // Draw the live skeleton on the PIP canvas regardless of whether
      // there's a target under the viewport cursor below.
      drawLandmarks(result.landmarks);

      if (result.landmarks && result.landmarks.length > 0) {
        // landmark[8] = index fingertip; normalized [0..1] coords
        const tip = result.landmarks[0][8];
        // Mirror X because the webcam is unflipped — user expects mirrored
        const nx = 1 - tip.x;
        const ny = tip.y;
        const tx = nx * window.innerWidth;
        const ty = ny * window.innerHeight;

        smooth.x = smooth.x + (tx - smooth.x) * SMOOTH_ALPHA;
        smooth.y = smooth.y + (ty - smooth.y) * SMOOTH_ALPHA;
        cursor.style.left = smooth.x + "px";
        cursor.style.top = smooth.y + "px";
        cursor.style.opacity = "1";

        // Find what's under the cursor
        const el = document.elementFromPoint(smooth.x, smooth.y);
        const carStageEl = IS_CUSTOMIZE && el ? el.closest(".car-stage") : null;
        const target = el ? el.closest(SELECTABLE) : null;

        if (carStageEl && !el?.closest(".rotate-badge")) {
          // Drag rotation: convert horizontal finger motion into rotation
          if (!overCar) {
            overCar = true;
            lastCarX = smooth.x;
            carStageEl.classList.add("dragging");
          } else {
            const dx = smooth.x - lastCarX;
            if (Math.abs(dx) > 0.1 && window.HEX && window.HEX.carRotateBy) {
              window.HEX.carRotateBy(dx * ROTATE_SENS);
            }
            lastCarX = smooth.x;
          }
          if (dwellTarget) clearDwell();
        } else {
          if (overCar) {
            overCar = false;
            document.querySelectorAll(".car-stage.dragging")
              .forEach((s) => s.classList.remove("dragging"));
          }
          if (target) {
            if (target !== dwellTarget) {
              dwellTarget = target;
              dwellStart = now;
              setDwellProgress(0);
            } else {
              const elapsed = now - dwellStart;
              const p = Math.min(1, elapsed / DWELL_MS);
              setDwellProgress(p);
              if (p >= 1) {
                fireSelect(dwellTarget);
                // After firing, suspend dwell briefly to prevent re-trigger
                dwellTarget = null;
                dwellStart = now + 600;
                setDwellProgress(0);
              }
            }
          } else {
            if (dwellTarget) clearDwell();
          }
        }
      } else {
        cursor.style.opacity = "0.25";
        if (dwellTarget) clearDwell();
      }
    }
    requestAnimationFrame(tick);
  }

  function fireSelect(el) {
    // Visual confirmation pulse
    el.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(0.94)" },
        { transform: "scale(1)" },
      ],
      { duration: 220, easing: "ease-out" }
    );

    // Convert CTA needs click() so the scan overlay handler fires
    // (direct href navigation would skip the simulation).
    if (el.id === "convertCta") {
      el.click();
      return;
    }
    // For anchor tags, navigate; otherwise dispatch click so existing
    // delegated handlers in main.js fire.
    if (el.tagName === "A" && el.href) {
      window.location.href = el.href;
    } else {
      el.click();
    }
  }

  requestAnimationFrame(tick);
}
