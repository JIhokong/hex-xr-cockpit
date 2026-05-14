// HEX — MediaPipe Hand Tracking + Hover-dwell gesture
// Loaded only on the Customize page (HTML wires <script type="module">).
// Uses @mediapipe/tasks-vision via jsDelivr CDN.

import {
  HandLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const DWELL_MS = 1000;
const SELECTABLE = ".swatch-cell, .wheel-card, .style-pill, .cta";

const cursor = document.getElementById("handCursor");
const overlay = document.getElementById("handOverlay");
const progress = document.getElementById("dwellProgress");
const video = document.getElementById("webcam");

if (!cursor || !overlay || !video) {
  console.warn("[hand] customize DOM not found — skipping init");
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
  await new Promise((res) => {
    if (video.readyState >= 2) return res();
    video.onloadeddata = () => res();
  });

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

  function setDwellProgress(p) {
    progress.setAttribute("stroke-dashoffset", String(RING_CIRC * (1 - p)));
  }

  function clearDwell() {
    dwellTarget = null;
    dwellStart = 0;
    setDwellProgress(0);
  }

  function tick() {
    const now = performance.now();
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const result = handLandmarker.detectForVideo(video, now);

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
        const el = document
          .elementFromPoint(smooth.x, smooth.y);
        const target = el ? el.closest(SELECTABLE) : null;

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
