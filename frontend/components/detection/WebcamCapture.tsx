"use client";

import { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import Lottie from "lottie-react";
import loadingAnimation from "@/public/lottie/loading.json";
import { useDetectionStore } from "@/store/detectionStore";
import { useDetection } from "@/hooks/useDetection";
import type { FrameLandmarks } from "@/types/detection";

/* Use ideal (not exact) dimensions so mobile cameras can negotiate.
   facingMode: "user" keeps the front-facing camera for driver monitoring. */
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: "user",
  width:  { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 30, max: 30 },
};

export function WebcamCapture() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const frameLoop = useRef<ReturnType<typeof setInterval> | null>(null);

  const sessionActive = useDetectionStore((s) => s.sessionActive);
  const demoMode = useDetectionStore((s) => s.demoMode);
  const metrics = useDetectionStore((s) => s.metrics);
  const wsStatus = useDetectionStore((s) => s.wsStatus);

  const [cameraError, setCameraError] = useState<string | null>(null);

  const { sendFrame } = useDetection();

  /* ── Frame loop: starts/stops with session, stable reference ── */
  useEffect(() => {
    if (!sessionActive || demoMode) {
      if (frameLoop.current) {
        clearInterval(frameLoop.current);
        frameLoop.current = null;
      }
      return;
    }

    let tick = 0;
    frameLoop.current = setInterval(() => {
      tick += 1;
      const video = webcamRef.current?.video;
      const canvas = canvasRef.current;

      // TEMP DEBUG — remove after diagnosing missing frames, logs ~1x/sec
      if (tick % 30 === 0) {
        console.error("[frameLoop]", {
          hasVideo: !!video,
          readyState: video?.readyState,
          videoWidth: video?.videoWidth,
          hasCanvas: !!canvas,
        });
      }

      if (!video || !canvas || video.readyState < 2) return;

      // Dynamically match canvas dimensions to the actual camera resolution
      // This prevents aspect ratio squishing if the camera is 16:9 instead of 4:3
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      
      const overlayCanvas = overlayCanvasRef.current;
      if (overlayCanvas && (overlayCanvas.width !== video.videoWidth || overlayCanvas.height !== video.videoHeight)) {
        overlayCanvas.width = video.videoWidth;
        overlayCanvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      sendFrame(canvas);
    }, 33);

    return () => {
      if (frameLoop.current) {
        clearInterval(frameLoop.current);
        frameLoop.current = null;
      }
    };
  }, [sessionActive, demoMode, sendFrame]); // metrics NOT in deps

  /* ── Overlay draw: real landmarks, redrawn on every metrics update ── */
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!sessionActive || demoMode || !metrics?.landmarks) return;

    drawLandmarkOverlay(ctx, canvas.width, canvas.height, metrics.landmarks, metrics.compositeScore);
  }, [metrics, sessionActive, demoMode]);

  return (
    <div
      className="relative w-full h-full bg-black rounded-xl overflow-hidden"
      role="region"
      aria-label={sessionActive ? (demoMode ? "Demo mode — simulated driver face" : "Live webcam — drowsiness detection active") : "Webcam preview — session not started"}
    >
      {/* Webcam feed */}
      {!demoMode && (
        <Webcam
          ref={webcamRef}
          audio={false}
          videoConstraints={VIDEO_CONSTRAINTS}
          className="absolute inset-0 w-full h-full object-cover"
          mirrored
          onUserMedia={() => setCameraError(null)}
          onUserMediaError={(err) => {
            console.error("Webcam access failed:", err);
            setCameraError(
              err instanceof DOMException && err.name === "NotAllowedError"
                ? "Camera permission denied — allow camera access in your browser and try again."
                : err instanceof DOMException && err.name === "NotFoundError"
                ? "No camera found on this device."
                : "Could not access the camera — it may be in use by another app."
            );
          }}
        />
      )}

      {/* Camera error — previously failed with zero UI feedback */}
      {!demoMode && cameraError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 px-6 text-center bg-black/90">
          <p className="text-body font-semibold" style={{ color: "var(--ds-alert-3)" }}>
            Camera unavailable
          </p>
          <p className="text-caption text-muted-foreground">{cameraError}</p>
        </div>
      )}

      {/* Hidden frame-capture canvas — feeds sendFrame, never displayed */}
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
      />

      {/* Real landmark overlay — drawn from backend-computed coordinates, live mode only */}
      <canvas
        ref={overlayCanvasRef}
        width={640}
        height={480}
        className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${
          demoMode ? "opacity-0" : "opacity-100"
        }`}
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Demo animated face */}
      {demoMode && <DemoFaceCanvas metrics={metrics} />}

      {/* Connection status */}
      <div className="absolute top-3 left-3">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-medium text-white"
          style={{
            background:
              wsStatus === "connected" ? "var(--ds-emerald)" :
              wsStatus === "demo"      ? "var(--ds-alert-1)" :
              wsStatus === "error"     ? "var(--ds-alert-3)" :
              "var(--ds-base-raised)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
          {wsStatus === "connected"  ? "LIVE" :
           wsStatus === "demo"       ? "DEMO" :
           wsStatus === "connecting" ? "CONNECTING…" :
           wsStatus === "error"      ? "ERROR" : "OFFLINE"}
        </div>
      </div>

      {/* FPS chip */}
      {sessionActive && (
        <div
          className="absolute top-3 right-3 text-caption font-mono px-2 py-0.5 rounded"
          style={{ background: "rgba(0,0,0,0.5)", color: "var(--ds-emerald)" }}
        >
          {demoMode ? "10" : "30"} fps
        </div>
      )}

      {/* Idle placeholder */}
      {!sessionActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80">
          <Lottie
            animationData={loadingAnimation}
            loop
            style={{ width: 90, height: 90 }}
            aria-hidden
          />
          <p className="text-caption text-muted-foreground">
            Click Start to begin monitoring
          </p>
        </div>
      )}
    </div>
  );
}

/* ── SVG animated demo face ───────────────────────────────────────── */
function DemoFaceCanvas({
  metrics,
}: {
  metrics: ReturnType<typeof useDetectionStore.getState>["metrics"];
}) {
  const score = metrics?.compositeScore ?? 0;
  const yawn = metrics?.yawnDetected ?? false;

  const faceColor =
    score >= 0.75 ? "#EF4444" :
    score >= 0.50 ? "#F97316" :
    score >= 0.25 ? "#F59E0B" : "#10B981";

  const eyeOpen = 1 - Math.min(0.9, score * 1.2);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0A0F1E]">
      <svg viewBox="0 0 200 240" width="200" height="240">
        <ellipse cx="100" cy="120" rx="72" ry="90" fill="none" stroke={faceColor}
          strokeWidth="1.5" strokeDasharray="4 2" opacity="0.5" />

        <ellipse cx="72"  cy="100" rx="14" ry={14 * eyeOpen} fill="none" stroke={faceColor} strokeWidth="2" />
        <circle  cx="72"  cy="100" r="5"  fill={faceColor} opacity="0.8" />
        <ellipse cx="128" cy="100" rx="14" ry={14 * eyeOpen} fill="none" stroke={faceColor} strokeWidth="2" />
        <circle  cx="128" cy="100" r="5"  fill={faceColor} opacity="0.8" />

        {yawn ? (
          <ellipse cx="100" cy="148" rx="22" ry="18" fill="none" stroke={faceColor} strokeWidth="2" />
        ) : (
          <path d="M82 148 Q100 155 118 148" fill="none" stroke={faceColor} strokeWidth="2" strokeLinecap="round" />
        )}

        <path d="M100 118 L94 136 L106 136" fill="none" stroke={faceColor} strokeWidth="1.5" opacity="0.6" />

        {metrics && Math.abs(metrics.pitch) > 15 && (
          <text x="4" y="220" fontSize="11" fill="#F59E0B" fontFamily="monospace">
            PITCH {metrics.pitch.toFixed(0)}°
          </text>
        )}

        {[
          [72,88],[86,88],[100,88],[114,88],[128,88],
          [65,100],[78,100],[100,100],[122,100],[135,100],
          [76,124],[100,124],[124,124],
          [82,148],[100,148],[118,148],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2" fill={faceColor} opacity="0.6" />
        ))}
      </svg>
    </div>
  );
}

/* ── Canvas landmark overlay helper ──────────────────────────────────
   Draws the real MediaPipe FaceMesh eye/mouth contours and a posture
   line from the backend-computed normalized (0-1) coordinates.
──────────────────────────────────────────────────────────────────── */
function drawContour(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  w: number,
  h: number,
  color: string
) {
  if (points.length < 2) return;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = p.x * w;
    const y = p.y * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = color;
  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawLandmarkOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  landmarks: FrameLandmarks,
  score: number
) {
  const color =
    score >= 0.75 ? "#EF4444" :
    score >= 0.50 ? "#F97316" :
    score >= 0.25 ? "#F59E0B" : "#10B981";

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.85;

  drawContour(ctx, landmarks.leftEye, w, h, color);
  drawContour(ctx, landmarks.rightEye, w, h, color);
  drawContour(ctx, landmarks.mouth, w, h, color);

  if (landmarks.posture) {
    const { shoulders, ears } = landmarks.posture;
    const shoulderMid = {
      x: (shoulders[0].x + shoulders[1].x) / 2,
      y: (shoulders[0].y + shoulders[1].y) / 2,
    };
    const earMid = {
      x: (ears[0].x + ears[1].x) / 2,
      y: (ears[0].y + ears[1].y) / 2,
    };
    ctx.beginPath();
    ctx.moveTo(shoulderMid.x * w, shoulderMid.y * h);
    ctx.lineTo(earMid.x * w, earMid.y * h);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(shoulderMid.x * w, shoulderMid.y * h, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}
