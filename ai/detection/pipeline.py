"""
DetectionPipeline — per-WebSocket-session stateful detection engine.

One instance is created per connected client so each driver gets their own
calibration, PERCLOS buffer, yawn counter, and blink tracker.

Systems:
  A — Rule-based weighted fusion (always available, no models needed)
  B — MobileNetV2 ONNX (loaded once at process start, shared read-only)
  C — XGBoost meta-classifier (loaded once at process start, shared read-only)

If models/ files are absent, only System A runs (still fully functional).
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import cv2
import mediapipe as mp
import numpy as np

from .calibration import Calibration
from .preprocessing import decode_jpeg, preprocess
from .signals.ear import (
    LEFT_EYE,
    RIGHT_EYE,
    BlinkTracker,
    PerclosTracker,
    compute_ear,
    normalise_ear,
)
from .signals.head_pose import compute_head_pose, normalise_pose
from .signals.mar import OUTER_LIP, YawnDetector, compute_mar, normalise_mar
from .signals.posture import compute_posture, measure_posture, pose_reliable

# ── MediaPipe singletons (shared across all sessions) ────────────────
_mp_face_mesh   = mp.solutions.face_mesh
_mp_face_detect = mp.solutions.face_detection
_mp_pose        = mp.solutions.pose

_face_mesh = _mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)
_face_detector = _mp_face_detect.FaceDetection(
    model_selection=0,
    min_detection_confidence=0.5,
)
_pose_detector = _mp_pose.Pose(
    static_image_mode=False,
    model_complexity=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

# ── Model paths ──────────────────────────────────────────────────────
_MODELS_DIR = Path(__file__).parent.parent / "models"
_ONNX_PATH  = _MODELS_DIR / "drowsy_mobilenetv2.onnx"
_META_PATH  = _MODELS_DIR / "meta_classifier.pkl"

# ── Load System B (ONNX) ─────────────────────────────────────────────
_onnx_session = None
try:
    import onnxruntime as ort
    if _ONNX_PATH.exists():
        _onnx_session = ort.InferenceSession(
            str(_ONNX_PATH),
            providers=["CPUExecutionProvider"],
        )
        print(f"[pipeline] System B loaded: {_ONNX_PATH.name}")
    else:
        print(f"[pipeline] System B ONNX not found at {_ONNX_PATH} — running A only")
except ImportError:
    print("[pipeline] onnxruntime not installed — System B disabled")

# ── Load System C (XGBoost meta-classifier) ──────────────────────────
_meta_bundle = None
try:
    import pickle
    if _META_PATH.exists():
        with open(_META_PATH, "rb") as f:
            _meta_bundle = pickle.load(f)
        print(f"[pipeline] System C loaded: {_META_PATH.name}")
    else:
        print(f"[pipeline] System C PKL not found at {_META_PATH} — running A+B only")
except Exception as e:
    print(f"[pipeline] System C failed to load: {e}")

# ── Fusion weights ────────────────────────────────────────────────────
_WEIGHTS = {
    "ear":      0.30,
    "perclos":  0.25,
    "mar":      0.20,
    "pose":     0.15,
    "posture":  0.10,
}

_ALERT_LABELS = ["Alert", "Mild", "Warning", "Critical"]

# ── Alert level hysteresis ────────────────────────────────────────────
_HYSTERESIS = {
    0: {"up": 0.28, "down": None},
    1: {"up": 0.52, "down": 0.22},
    2: {"up": 0.77, "down": 0.47},
    3: {"up": None, "down": 0.70},
}

# CNN input size
_IMG_SIZE = 112

# Calibration window: 3 seconds at 30fps
_CALIBRATION_FRAMES = 90


@dataclass
class DetectionResult:
    """Mirrors the DetectionMetrics TypeScript interface exactly."""
    ear:            float
    perclos:        float
    mar:            float
    pitch:          float
    yaw:            float
    roll:           float
    postureScore:   float
    compositeScore: float
    alertLevel:     int
    alertLabel:     str
    yawnDetected:   bool
    blinkRate:      float
    timestamp:      str
    # Extra diagnostic fields (not required by frontend, ignored if unknown)
    faceDetected:   bool = True
    lowLight:       bool = False
    systemA:        float = 0.0
    systemB:        int   = 0
    systemC:        int   = 0
    latencyMs:      float = 0.0
    # Normalized (0-1) landmark points for frontend overlay drawing
    landmarks:      Optional[dict] = None

    def to_dict(self) -> dict:
        return {
            "ear":            round(self.ear, 4),
            "perclos":        round(self.perclos, 2),
            "mar":            round(self.mar, 4),
            "pitch":          round(self.pitch, 2),
            "yaw":            round(self.yaw, 2),
            "roll":           round(self.roll, 2),
            "postureScore":   round(self.postureScore, 4),
            "compositeScore": round(self.compositeScore, 4),
            "alertLevel":     self.alertLevel,
            "alertLabel":     self.alertLabel,
            "yawnDetected":   self.yawnDetected,
            "blinkRate":      round(self.blinkRate, 1),
            "timestamp":      self.timestamp,
            "faceDetected":   self.faceDetected,
            "lowLight":       self.lowLight,
            "systemA":        round(self.systemA, 4),
            "systemB":        self.systemB,
            "systemC":        self.systemC,
            "latencyMs":      round(self.latencyMs, 1),
            "landmarks":      self.landmarks,
        }


def _score_to_level(score: float) -> int:
    if score < 0.25: return 0
    if score < 0.50: return 1
    if score < 0.75: return 2
    return 3


def _extract_face_crop(frame_bgr: np.ndarray) -> Optional[np.ndarray]:
    h, w = frame_bgr.shape[:2]
    rgb  = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    res  = _face_detector.process(rgb)
    if not res.detections:
        return None
    best = max(
        res.detections,
        key=lambda d: d.location_data.relative_bounding_box.width
                    * d.location_data.relative_bounding_box.height,
    )
    pad = 0.15
    bb  = best.location_data.relative_bounding_box
    x1  = max(0, int((bb.xmin - pad) * w))
    y1  = max(0, int((bb.ymin - pad) * h))
    x2  = min(w, int((bb.xmin + bb.width  + pad) * w))
    y2  = min(h, int((bb.ymin + bb.height + pad) * h))
    crop = frame_bgr[y1:y2, x1:x2]
    if crop.size == 0:
        return None
    crop = cv2.resize(crop, (_IMG_SIZE, _IMG_SIZE), interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)


class DetectionPipeline:
    """
    Stateful per-session pipeline.
    Create one instance when a WebSocket connects; discard when it closes.
    """

    def __init__(self):
        self.calibration    = Calibration()
        self.perclos        = PerclosTracker(fps=30.0)
        self.blink          = BlinkTracker(fps=30.0)
        self.yawn           = YawnDetector()
        self._frame_count   = 0
        self._prev_level    = 0
        self._prev_score    = 0.0

    # ── Public entry point ───────────────────────────────────────────

    async def process(self, raw_bytes: bytes) -> DetectionResult:
        t0 = time.perf_counter()

        frame_bgr, low_light = preprocess(decode_jpeg(raw_bytes))
        self._frame_count += 1
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        h, w = frame_bgr.shape[:2]
        ts  = datetime.now(timezone.utc).isoformat()

        # ── Calibration phase (first 90 frames = ~3s) ─────────────
        if not self.calibration.is_complete:
            if self._frame_count >= _CALIBRATION_FRAMES:
                self.calibration.finalise()
            else:
                self._try_calibration_frame(rgb, h, w)
                return self._safe_result(ts, low_light)

        thr  = self.calibration.ear_threshold
        blen = self.calibration.baseline_lean
        btlt = self.calibration.baseline_tilt

        # ── FaceMesh ─────────────────────────────────────────────
        fm = _face_mesh.process(rgb)
        if not fm.multi_face_landmarks:
            return self._no_face_result(ts, low_light)

        lm = fm.multi_face_landmarks[0].landmark

        # ── Signals ──────────────────────────────────────────────
        ear   = compute_ear(lm)
        mar   = compute_mar(lm)
        pitch, yaw, roll = compute_head_pose(lm, w, h)

        ear_s    = normalise_ear(ear, thr)
        mar_s    = normalise_mar(mar)
        pose_s   = normalise_pose(pitch, yaw, roll)

        perclos_val   = self.perclos.update(ear, thr)
        perclos_s     = min(1.0, perclos_val / 40.0)

        blink_rate    = self.blink.update(ear, thr)
        yawn_detected = self.yawn.update(mar)

        # ── Posture ───────────────────────────────────────────────
        pr = _pose_detector.process(rgb)
        posture_s = 0.0
        posture_landmarks = None
        if pr.pose_landmarks and pose_reliable(pr.pose_landmarks):
            posture_s = compute_posture(pr.pose_landmarks, blen, btlt)
            pl = pr.pose_landmarks.landmark
            posture_landmarks = {
                "shoulders": [{"x": pl[11].x, "y": pl[11].y}, {"x": pl[12].x, "y": pl[12].y}],
                "ears":      [{"x": pl[7].x,  "y": pl[7].y},  {"x": pl[8].x,  "y": pl[8].y}],
            }

        landmarks = {
            "leftEye":  [{"x": lm[i].x, "y": lm[i].y} for i in LEFT_EYE],
            "rightEye": [{"x": lm[i].x, "y": lm[i].y} for i in RIGHT_EYE],
            "mouth":    [{"x": lm[i].x, "y": lm[i].y} for i in OUTER_LIP],
            "posture":  posture_landmarks,
        }

        # ── System A — weighted fusion ────────────────────────────
        score_a = (
            ear_s     * _WEIGHTS["ear"]     +
            perclos_s * _WEIGHTS["perclos"] +
            mar_s     * _WEIGHTS["mar"]     +
            pose_s    * _WEIGHTS["pose"]    +
            posture_s * _WEIGHTS["posture"]
        )
        score_a = float(np.clip(score_a, 0.0, 1.0))

        # Exponential moving average to smooth jitter
        alpha   = 0.3
        score_a = alpha * score_a + (1 - alpha) * self._prev_score
        self._prev_score = score_a

        # ── System B — CNN (if available) ─────────────────────────
        level_b   = _score_to_level(score_a)  # fallback = System A level
        cnn_probs = [0.8, 0.1, 0.05, 0.05]   # fallback neutral probs

        if _onnx_session is not None:
            crop = _extract_face_crop(frame_bgr)
            if crop is not None:
                x_in      = crop.astype(np.float32) / 255.0
                x_in      = np.expand_dims(x_in, 0)
                raw_probs = _onnx_session.run(None, {"input": x_in})[0][0]
                cnn_probs = raw_probs.tolist()
                level_b   = int(np.argmax(raw_probs))

        # ── System C — meta-classifier (if available) ─────────────
        level_c = level_b  # fallback
        if _meta_bundle is not None:
            feat = np.array([[
                score_a, float(_score_to_level(score_a)),
                ear_s, perclos_s, mar_s, pose_s, posture_s,
                *cnn_probs,
            ]], dtype=np.float32)
            feat_sc = _meta_bundle["scaler"].transform(feat)
            level_c = int(_meta_bundle["model"].predict(feat_sc)[0])

        # ── Final score: use System A composite, level from best system ──
        final_score = score_a
        final_level = self._stable_level(final_score)

        latency = (time.perf_counter() - t0) * 1000

        return DetectionResult(
            ear            = ear,
            perclos        = perclos_val,
            mar            = mar,
            pitch          = pitch,
            yaw            = yaw,
            roll           = roll,
            postureScore   = posture_s,
            compositeScore = final_score,
            alertLevel     = final_level,
            alertLabel     = _ALERT_LABELS[final_level],
            yawnDetected   = yawn_detected,
            blinkRate      = blink_rate,
            timestamp      = ts,
            faceDetected   = True,
            lowLight       = low_light,
            systemA        = score_a,
            systemB        = level_b,
            systemC        = level_c,
            latencyMs      = latency,
            landmarks      = landmarks,
        )

    # ── Calibration helpers ──────────────────────────────────────────

    def _try_calibration_frame(self, rgb: np.ndarray, h: int, w: int):
        fm = _face_mesh.process(rgb)
        if not fm.multi_face_landmarks:
            return
        lm = fm.multi_face_landmarks[0].landmark
        ear = compute_ear(lm)

        pr = _pose_detector.process(rgb)
        if pr.pose_landmarks and pose_reliable(pr.pose_landmarks):
            lean, tilt = measure_posture(pr.pose_landmarks)
            self.calibration.add_frame(ear, lean, tilt)
        else:
            # Face calibrated even when the body isn't in frame; posture
            # baseline simply isn't recorded from this frame.
            self.calibration.add_frame(ear)

    # ── Hysteresis ────────────────────────────────────────────────────

    def _stable_level(self, score: float) -> int:
        thr = _HYSTERESIS[self._prev_level]
        if thr["up"] is not None and score >= thr["up"]:
            self._prev_level = min(3, self._prev_level + 1)
        elif thr["down"] is not None and score < thr["down"]:
            self._prev_level = max(0, self._prev_level - 1)
        return self._prev_level

    # ── Safe return values ────────────────────────────────────────────

    def _safe_result(self, ts: str, low_light: bool) -> DetectionResult:
        """Returned during calibration window — neutral values."""
        progress = self._frame_count / _CALIBRATION_FRAMES
        return DetectionResult(
            ear=0.28, perclos=0.0, mar=0.20,
            pitch=0.0, yaw=0.0, roll=0.0,
            postureScore=0.0, compositeScore=0.05,
            alertLevel=0, alertLabel="Alert",
            yawnDetected=False, blinkRate=15.0,
            timestamp=ts, faceDetected=True, lowLight=low_light,
            systemA=0.05, systemB=0, systemC=0,
            latencyMs=0.0,
        )

    def _no_face_result(self, ts: str, low_light: bool) -> DetectionResult:
        """Returned when no face is detected in frame."""
        return DetectionResult(
            ear=0.0, perclos=0.0, mar=0.0,
            pitch=0.0, yaw=0.0, roll=0.0,
            postureScore=0.0, compositeScore=0.05,
            alertLevel=0, alertLabel="Alert",
            yawnDetected=False, blinkRate=0.0,
            timestamp=ts, faceDetected=False, lowLight=low_light,
            systemA=0.05, systemB=0, systemC=0,
            latencyMs=0.0,
        )

    def reset(self):
        """Call when a WebSocket reconnects mid-session."""
        self.__init__()
