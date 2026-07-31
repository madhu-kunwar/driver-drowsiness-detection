# Live Detection — Debugging & Implementation Notes (2026-07-31)

Context: the `ai/` Python detection pipeline (MediaPipe FaceMesh EAR/PERCLOS/MAR, OpenCV
head pose, MediaPipe Pose posture) was already fully written, but had never actually been
run, and Live Mode never showed any landmark overlay on the video feed. This session got
it running end-to-end and fixed the bugs found along the way.

## Environment

- System `python3` is Homebrew 3.14 — no MediaPipe wheel exists for it.
- MediaPipe `>=0.10.15` (and `1.0.0`) removed the legacy `mp.solutions.*` API that this
  codebase's pipeline is built on (`face_mesh`, `pose`, `face_detection`).
- Fix: created a `python3.12` venv at `ai/.venv`, pinned `mediapipe==0.10.14` (last version
  with the legacy API). Recommend pinning this in `ai/requirements.txt` if reinstalling
  elsewhere — currently it just says `mediapipe>=0.10.9`.

## Bugs found and fixed

1. **`ai/detection/preprocessing.py`** — `preprocess()` returned a numpy `bool_` for
   `low_light` (from `frame_bgr.mean() < 60`). This isn't JSON-serializable, so
   `json.dumps()` would crash on the very first frame the server ever processed. Fixed
   with an explicit `bool(...)` cast.

2. **`frontend/hooks/useDetection.ts`** — the real bug behind "nothing happens" / no dots.
   `WebcamCapture.tsx` and `SessionControls.tsx` each call `useDetection()` independently.
   The WebSocket lived in a per-call `useRef`, so each caller got its **own separate
   socket**. `SessionControls.connect()` opened the real connection (which is why the
   backend logs showed sessions connecting), but `WebcamCapture`'s `sendFrame` checked a
   *different*, always-null socket and silently no-opped — no camera frame was ever sent
   to the backend, no matter how long a session ran. Fixed by moving the WebSocket state
   to module scope (`sharedWs`, `sharedDemoInterval`, `sharedPrevLevel`) so every caller
   of the hook shares one real connection.

3. **`frontend/components/detection/WebcamCapture.tsx`** — the only overlay canvas was
   rendered at `opacity-0` in Live Mode (it existed purely to capture frames for
   `sendFrame`, not to display anything). So even once frames were flowing, there was
   nowhere for landmarks to be drawn. Added a second, visible `overlayCanvasRef` canvas,
   mirrored via CSS (`scaleX(-1)`) to match the video display.

4. **No feedback on camera failure** — `<Webcam>` had no `onUserMediaError` handler, so a
   denied permission / missing camera / camera-in-use failed completely silently. Added
   an error handler with a visible "Camera unavailable" message, and `onUserMedia` to
   clear it on success.

## Backend change — emitting landmark coordinates

`ai/detection/pipeline.py` computed FaceMesh/Pose landmarks internally to derive
EAR/MAR/head-pose/posture scores, but discarded the raw points afterward. The
`DetectionResult` dataclass (and WebSocket JSON payload) now includes a `landmarks` field:

```json
{
  "leftEye":  [{"x": ..., "y": ...}, ...6 points],
  "rightEye": [{"x": ..., "y": ...}, ...6 points],
  "mouth":    [{"x": ..., "y": ...}, ...8 points],
  "posture":  { "shoulders": [...2 points], "ears": [...2 points] } | null
}
```

Coordinates are normalized (0–1, MediaPipe's native output). `landmarks` is `null` during
calibration or when no face is detected. Reuses the existing `LEFT_EYE` / `RIGHT_EYE`
(`signals/ear.py`) and `OUTER_LIP` (`signals/mar.py`) index constants — no new landmark
logic was written.

`frontend/types/detection.ts` gained a matching `FrameLandmarks` type and
`DetectionMetrics.landmarks?: FrameLandmarks | null`.

`WebcamCapture.tsx`'s `drawLandmarkOverlay` was rewritten from a decorative rectangle into
one that draws real eye/mouth contours and a shoulder→ear posture line from this data.

## Status as of last check

Confirmed via backend log during a live session:
```
frame bytes=31031 faceDetected=True calibrated=True landmarks=True
```
Frames are reaching the backend, a face is being detected, calibration completes, and
landmark data is being generated and sent back. Frontend-side frame-loop debug also
confirmed `hasVideo: true, readyState: 4, videoWidth: 640` — the capture side is healthy.

**Not yet confirmed:** whether the overlay canvas actually renders the dots visually in
the browser. The data pipeline is proven end-to-end; what's unverified is the final
canvas-drawing/CSS step.

## Temporary debug code still in the tree — remove once overlay is visually confirmed

- `ai/main.py` — a `log.info(...)` line inside the WebSocket frame handler printing frame
  size / faceDetected / calibrated / landmarks presence per frame.
- `frontend/components/detection/WebcamCapture.tsx` — a `console.error("[frameLoop]", ...)`
  inside the frame-loop `setInterval`, throttled to ~once/sec via `tick % 30 === 0`.

Both are marked `// TEMP DEBUG` / `# TEMP DEBUG` in place.

## Next steps

1. Confirm visually that eye/mouth/posture dots render correctly on `/monitor` in Live
   Mode, then strip the temp debug logging above.
2. Pin `mediapipe==0.10.14` in `ai/requirements.txt` (currently `>=0.10.9`, which now
   resolves to the incompatible `1.0.0`).
3. System B (MobileNetV2 ONNX) and System C (XGBoost) are still untrained —
   `ai/models/` is empty. Requires running `ai/train_colab.py` against the DMD dataset
   (see `ai/SETUP.md`) and copying the resulting `.onnx`/`.pkl` files into `ai/models/`.
