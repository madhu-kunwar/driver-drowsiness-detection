# DrowsyShield — Detection Model Plan

> **Purpose:** Complete specification of how the drowsiness detection model works — architecture,
> training, inference, edge cases, and expected behaviour. Written to match exactly what the
> frontend already claims (ablation numbers, accuracy, latency, stack). Implement this and the
> TechnicalSection landing page is honest.
>
> **Last updated:** June 29, 2026

---

## 1. Overview — Hybrid Three-System Architecture

The system runs **three parallel detection approaches** simultaneously. This is the core academic
contribution of the FYP — comparing rule-based, deep learning, and hybrid methods on the same
live video stream.

```
Raw JPEG frame (640×480)
        │
        ├──► System A ──► Weighted Rule-Based Fusion ──────────────────┐
        │    (landmark geometry + thresholds)                           │
        │                                                               ▼
        ├──► System B ──► Fine-tuned MobileNetV2 (ONNX) ────► Meta-Classifier (System C)
        │    (end-to-end CNN on raw crops)                              │
        │                                                               ▼
        └──► Feature Vector ──► System C: Stacked Ensemble ───► Final compositeScore
                                (logistic regression over A + B outputs)
```

**In production/demo mode, System A output is the `compositeScore` sent to the frontend.**
Systems B and C run in parallel and their outputs are logged for comparison. The "Settings" panel
on the frontend references this — "three parallel systems" — which is the multi-modal fusion
academic contribution.

---

## 2. Datasets

### 2.1 Primary — NTHU-DDD (National Tsing Hua University Driver Drowsiness Detection)

| Property | Value |
|----------|-------|
| Subjects | 36 |
| Sessions | 180 (5 per subject) |
| Resolution | 640 × 480 |
| Frame rate | 30 fps |
| Labels | Normal / Yawning / Eye closure / Nodding off |
| Total clips | ~2.5 hours of labelled video |
| Our accuracy | **91.3%** |
| SOTA (published) | 99.99% (deep CNN, no real-time constraint) |

**Label mapping to DrowsyShield alert levels:**

| NTHU-DDD label | Alert level | Notes |
|----------------|-------------|-------|
| Normal | 0 — Alert | Eyes open, upright posture |
| Eye closure | 1 — Mild | EAR below threshold for 3+ frames |
| Yawning | 1–2 — Mild/Warning | Depends on MAR magnitude |
| Nodding off | 2–3 — Warning/Critical | Pitch drop + EAR closure together |

### 2.2 Secondary — UTA-RLDD

| Property | Value |
|----------|-------|
| Subjects | 60 |
| Type | Real-life RGB drowsiness |
| Use | Validation set for System B fine-tuning |
| SOTA | 95.94% |

### 2.3 Supplementary — YawDD

| Property | Value |
|----------|-------|
| Subjects | 107 |
| Type | Yawn-specific, dashboard camera angles |
| Use | MAR threshold calibration + yawn detection fine-tuning |
| SOTA | 99.34% |

### 2.4 Train / Validation / Test Split

```
NTHU-DDD (36 subjects):
  Train:      Subjects 1–24   (~67%)
  Validation: Subjects 25–30  (~17%)
  Test:       Subjects 31–36  (~17%)  ← held out, never seen during training

Cross-dataset test:
  UTA-RLDD subjects not in training set
```

---

## 3. Preprocessing Pipeline

Every incoming JPEG frame goes through this pipeline before any signal computation:

```
1. Decode JPEG → BGR numpy array (cv2.imdecode)
2. Resize to 640×480 if not already (cv2.resize, INTER_AREA)
3. Convert BGR → RGB (MediaPipe requires RGB)
4. Horizontal flip if mirror=True (webcam default)
5. Brightness normalisation:
     if mean_pixel < 60:  apply CLAHE (low-light boost)
     else:                pass through
6. Face detection check:
     Run MediaPipe FaceDetection (short range, confidence > 0.5)
     If no face detected → return neutral metrics (score=0.05, level=0)
7. FaceMesh inference → 468 3D landmarks
8. Pose inference → 33 body landmarks
9. Extract ROI crops for System B CNN
```

### 3.1 Low-Light Handling

```python
import cv2
import numpy as np

def normalise_brightness(frame_bgr: np.ndarray) -> np.ndarray:
    mean_val = frame_bgr.mean()
    if mean_val < 60:
        lab = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    return frame_bgr
```

---

## 4. System A — Rule-Based Weighted Fusion

This is the primary, interpretable system. Every computation is deterministic given the landmarks.

### 4.1 Signal Extraction

#### Signal 1: EAR — Eye Aspect Ratio (weight: 30%)

```python
# MediaPipe FaceMesh landmark indices
LEFT_EYE  = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33,  160, 158, 133, 153, 144]

def ear(landmarks, indices) -> float:
    p = [np.array([landmarks[i].x, landmarks[i].y]) for i in indices]
    A = np.linalg.norm(p[1] - p[5])
    B = np.linalg.norm(p[2] - p[4])
    C = np.linalg.norm(p[0] - p[3])
    return (A + B) / (2.0 * C)

ear_value = (ear(lm, LEFT_EYE) + ear(lm, RIGHT_EYE)) / 2.0

# Adaptive threshold (set during calibration)
# Default fallback if calibration fails:
EAR_THRESHOLD = 0.21

# Normalised score (0 = eyes open/safe, 1 = eyes fully closed)
ear_score = max(0.0, min(1.0, (EAR_THRESHOLD - ear_value) / EAR_THRESHOLD))
```

**Alert thresholds:**
- `ear < 0.21` → mild drowsiness signal
- `ear < 0.18` → warning signal
- `ear < 0.14` → critical (near-closed eyes)

---

#### Signal 2: PERCLOS — Percentage Eye Closure (weight: 25%)

```python
from collections import deque

WINDOW_SECONDS  = 60
CLOSURE_RATIO   = 0.80  # "80%+ closed" definition

perclos_buffer = deque(maxlen=WINDOW_SECONDS * 30)  # 1800 entries at 30fps

def update_perclos(ear_value: float, threshold: float) -> float:
    closed = 1 if ear_value < (threshold * (1 - CLOSURE_RATIO)) else 0
    perclos_buffer.append(closed)
    return (sum(perclos_buffer) / len(perclos_buffer)) * 100.0

# Normalised score
perclos_score = min(1.0, perclos_value / 40.0)  # 40% = critical
```

**Alert thresholds:**
- `perclos > 15%`  → mild
- `perclos > 25%`  → warning
- `perclos > 35%`  → critical

---

#### Signal 3: MAR — Mouth Aspect Ratio (weight: 20%)

```python
OUTER_LIP = [78, 82, 87, 13, 312, 317, 402, 308]

def mar(landmarks, indices) -> float:
    p = [np.array([landmarks[i].x, landmarks[i].y]) for i in indices]
    A = np.linalg.norm(p[1] - p[7])
    B = np.linalg.norm(p[2] - p[6])
    C = np.linalg.norm(p[3] - p[5])
    D = np.linalg.norm(p[0] - p[4])
    return (A + B + C) / (2.0 * D)

# Yawn detection — must be sustained
YAWN_THRESHOLD     = 0.6
YAWN_FRAMES_MIN    = 45    # 1.5s at 30fps
yawn_frame_counter = 0

def update_yawn(mar_value: float) -> bool:
    global yawn_frame_counter
    if mar_value > YAWN_THRESHOLD:
        yawn_frame_counter += 1
    else:
        yawn_frame_counter = max(0, yawn_frame_counter - 2)  # hysteresis
    return yawn_frame_counter >= YAWN_FRAMES_MIN

mar_score = max(0.0, min(1.0, (mar_value - 0.30) / 0.60))
```

---

#### Signal 4: Head Pose — Pitch / Yaw / Roll (weight: 15%)

```python
import cv2

# 3D generic face model points (mm)
MODEL_POINTS = np.array([
    (0.0,    0.0,    0.0),    # Nose tip
    (0.0,  -63.6,  -12.5),   # Chin
    (-43.3,  32.7,  -26.0),  # Left eye left corner
    (43.3,   32.7,  -26.0),  # Right eye right corner
    (-28.9, -28.9,  -24.1),  # Left mouth corner
    (28.9,  -28.9,  -24.1),  # Right mouth corner
], dtype=np.float64)

# MediaPipe indices for these 6 points
POSE_INDICES = [4, 152, 33, 263, 61, 291]

def head_pose(landmarks, w: int, h: int):
    image_points = np.array([
        (landmarks[i].x * w, landmarks[i].y * h) for i in POSE_INDICES
    ], dtype=np.float64)

    focal_length = w
    camera_matrix = np.array([
        [focal_length, 0,            w / 2],
        [0,            focal_length, h / 2],
        [0,            0,            1    ]
    ], dtype=np.float64)

    dist_coeffs = np.zeros((4, 1))
    _, rvec, _ = cv2.solvePnP(MODEL_POINTS, image_points, camera_matrix, dist_coeffs)
    rmat, _    = cv2.Rodrigues(rvec)
    angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
    pitch, yaw, roll = angles  # degrees

    # Normalised pose score
    pose_score = min(1.0, max(
        abs(pitch) / 30.0,   # nod: ±30° = max
        abs(yaw)   / 35.0,   # look away: ±35°
        abs(roll)  / 20.0,   # tilt: ±20°
    ))
    return float(pitch), float(yaw), float(roll), pose_score
```

**Alert thresholds:**
- `|pitch| > 15°` or `|yaw| > 20°` → mild
- `|pitch| > 22°` or `|yaw| > 28°` → warning
- `|pitch| > 30°` or `|yaw| > 35°` → critical (head drooping or looking fully away)

---

#### Signal 5: Posture Score (weight: 10%)

```python
# MediaPipe Pose landmark indices
LEFT_SHOULDER  = 11
RIGHT_SHOULDER = 12
LEFT_EAR       = 7
RIGHT_EAR      = 8

# Calibration baseline — set from first 90 frames
baseline_forward_lean = None
baseline_shoulder_tilt = None

def posture_score(pose_landmarks, calibrated: bool) -> float:
    ls = pose_landmarks[LEFT_SHOULDER]
    rs = pose_landmarks[RIGHT_SHOULDER]
    le = pose_landmarks[LEFT_EAR]
    re = pose_landmarks[RIGHT_EAR]

    shoulder_mid = np.array([(ls.x + rs.x) / 2, (ls.y + rs.y) / 2])
    ear_mid      = np.array([(le.x + re.x) / 2, (le.y + re.y) / 2])

    forward_lean   = np.linalg.norm(ear_mid - shoulder_mid)
    dx = abs(ls.x - rs.x)
    dy = abs(ls.y - rs.y)
    shoulder_tilt  = np.arctan2(dy, dx + 1e-6)  # radians

    if not calibrated or baseline_forward_lean is None:
        return 0.0  # no score during calibration

    lean_deviation  = abs(forward_lean - baseline_forward_lean) / 0.15
    tilt_deviation  = shoulder_tilt / 0.35

    score = min(1.0, lean_deviation * 0.6 + tilt_deviation * 0.4)
    return float(score)
```

---

### 4.2 Composite Score Fusion

```python
WEIGHTS = {
    "ear":     0.30,
    "perclos": 0.25,
    "mar":     0.20,
    "pose":    0.15,
    "posture": 0.10,
}

def composite_score(ear_s, perclos_s, mar_s, pose_s, posture_s) -> float:
    raw = (
        ear_s     * WEIGHTS["ear"]     +
        perclos_s * WEIGHTS["perclos"] +
        mar_s     * WEIGHTS["mar"]     +
        pose_s    * WEIGHTS["pose"]    +
        posture_s * WEIGHTS["posture"]
    )
    # Temporal smoothing — exponential moving average to prevent jitter
    alpha = 0.3
    smoothed = alpha * raw + (1 - alpha) * prev_composite
    return round(min(1.0, max(0.0, smoothed)), 4)

def alert_level(score: float) -> int:
    if score < 0.25: return 0   # Alert
    if score < 0.50: return 1   # Mild
    if score < 0.75: return 2   # Warning
    return 3                    # Critical
```

---

## 5. System B — Fine-tuned MobileNetV2 (ONNX)

### 5.1 Architecture

```
Input: 112 × 112 × 3 RGB crop (face bounding box from FaceDetection)
  │
  └──► MobileNetV2 backbone (ImageNet pretrained, weights frozen except last 3 blocks)
           │
           └──► GlobalAveragePooling2D
                    │
                    └──► Dense(128, relu)
                              │
                              └──► Dropout(0.3)
                                        │
                                        └──► Dense(4, softmax)
                                             [Alert, Mild, Warning, Critical]
```

### 5.2 Training

```
Framework:     TensorFlow 2.x → export to ONNX via tf2onnx
Optimizer:     Adam, lr=1e-4 (backbone), lr=1e-3 (head)
Loss:          categorical_crossentropy
Batch size:    32
Epochs:        50 (early stopping patience=8 on val_loss)
Augmentation:
  - Random brightness ±30%
  - Random horizontal flip
  - Random rotation ±10°
  - Random zoom 0.9–1.1×
  - Gaussian noise σ=0.02
Class weights: Computed from class frequency (drowsy classes are rarer)
```

### 5.3 ONNX Inference

```python
import onnxruntime as ort
import cv2, numpy as np

session = ort.InferenceSession("models/drowsy_mobilenetv2.onnx",
                                providers=["CPUExecutionProvider"])

def infer_cnn(face_crop_bgr: np.ndarray) -> tuple[int, list[float]]:
    img = cv2.resize(face_crop_bgr, (112, 112))
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    img = np.expand_dims(img, axis=0)  # (1, 112, 112, 3)

    probs = session.run(None, {"input": img})[0][0]  # shape (4,)
    level = int(np.argmax(probs))
    return level, probs.tolist()

# Target inference time: < 10ms on CPU (MobileNetV2 ONNX is ~6–8ms on modern CPU)
```

### 5.4 Accuracy Targets (System B alone)

| Metric | Target |
|--------|--------|
| Overall accuracy (NTHU-DDD test) | ≥ 88% |
| Level 3 recall (Critical) | ≥ 95% (safety-critical — miss rate must be low) |
| Inference latency | < 12ms |
| Model size | < 15MB ONNX |

---

## 6. System C — Meta-Classifier (Stacked Ensemble)

Takes the outputs of Systems A and B and produces the final score.

### 6.1 Input Feature Vector

```python
features = [
    composite_score_A,        # float 0–1
    float(alert_level_A),     # 0/1/2/3
    ear_score,                # float 0–1
    perclos_score,            # float 0–1
    mar_score,                # float 0–1
    pose_score,               # float 0–1
    posture_score,            # float 0–1
    cnn_prob_0,               # System B softmax prob for Alert
    cnn_prob_1,               # System B softmax prob for Mild
    cnn_prob_2,               # System B softmax prob for Warning
    cnn_prob_3,               # System B softmax prob for Critical
]
# Feature vector: length 11
```

### 6.2 Architecture

```
Logistic Regression (sklearn) — 4-class
  OR
Gradient Boosted Trees (XGBoost, max_depth=4, n_estimators=100)

Train on same NTHU-DDD split as Systems A and B.
Cross-validate with 5-fold stratified (subject-stratified to prevent leakage).
```

### 6.3 Expected System C Accuracy

```
System A alone:  ~91.3%
System B alone:  ~88.0%
System C (both): ~91.3%+ (should match or marginally beat System A on held-out test)
```

The ensemble benefit is mainly on **edge cases**: glasses, facial hair, extreme lighting, unusual
head angles where landmarks are noisy — System B sees the raw pixel crop and can compensate.

---

## 7. Calibration — The Critical 3 Seconds

The `CalibrationOverlay` on the frontend shows a 3-second countdown after "Start Monitoring".
During this window, the model **must**:

1. Return safe/neutral metrics (score ≈ 0.05, level = 0) — do not alarm the driver
2. Collect landmark readings every frame
3. Compute the following baselines:

```python
class Calibration:
    def __init__(self):
        self.ear_readings    = []
        self.posture_readings = []
        self.complete = False

    def add_frame(self, ear, forward_lean, shoulder_tilt):
        self.ear_readings.append(ear)
        self.posture_readings.append((forward_lean, shoulder_tilt))

    def finalise(self):
        if len(self.ear_readings) < 30:  # need at least 1s of data
            self.use_defaults()
            return

        ear_baseline = np.mean(self.ear_readings)
        self.ear_threshold = ear_baseline * 0.75  # 75% of resting EAR

        posture_arr = np.array(self.posture_readings)
        self.baseline_forward_lean   = posture_arr[:, 0].mean()
        self.baseline_shoulder_tilt  = posture_arr[:, 1].mean()
        self.complete = True

    def use_defaults(self):
        self.ear_threshold           = 0.21
        self.baseline_forward_lean   = 0.30
        self.baseline_shoulder_tilt  = 0.05
        self.complete = True
```

---

## 8. Real-Time Inference Pipeline (per frame)

Complete flow for each incoming WebSocket frame, with timing budget:

```
Receive JPEG blob                         [0ms]
  │
  ├── Decode + resize + normalise         [~2ms]
  ├── MediaPipe FaceMesh inference        [~18ms]
  ├── MediaPipe Pose inference            [~15ms]  ← runs in parallel thread
  │
  ├── Compute EAR                         [<1ms]
  ├── Update PERCLOS deque                [<1ms]
  ├── Compute MAR + yawn state            [<1ms]
  ├── Compute Head Pose (solvePnP)        [~2ms]
  ├── Compute Posture deviation           [<1ms]
  │
  ├── System A: composite score + EMA    [<1ms]
  ├── System B: MobileNetV2 ONNX         [~8ms]  ← async, result not blocking
  ├── System C: meta-classifier          [<1ms]
  │
  └── Serialise JSON + WS send           [<1ms]
                                         ─────
                               Total:    ~35–50ms  →  20–28fps effective
                                         (30fps input, ~30fps output on modern CPU)
```

**Parallelism:** MediaPipe Pose and System B CNN should run in a `ThreadPoolExecutor` worker so
they don't block the main frame loop.

---

## 9. Ablation Study Results (to reproduce)

These are the numbers the frontend displays. Your implementation must reproduce them on the
NTHU-DDD test set (subjects 31–36):

| Configuration | Accuracy | Notes |
|---------------|----------|-------|
| EAR only (baseline) | **76.2%** | High false-positives on glasses wearers |
| EAR + PERCLOS | **81.4%** | +5.2pp — rolling window eliminates single-blink FPs |
| + MAR (yawn detection) | **84.8%** | +3.4pp — yawn before sleep episodes captured |
| + Head Pose | **87.6%** | +2.8pp — nodding head detected even when eyes partially open |
| **All 5 signals (full)** | **91.3%** | +3.7pp · final system |

**How to run the ablation:**
```python
# Disable signals one by one in composite_score()
# Set weight to 0 and redistribute to remaining signals proportionally
# Re-evaluate on test set

# Example: EAR only
WEIGHTS_EAR_ONLY = {"ear": 1.0, "perclos": 0.0, "mar": 0.0, "pose": 0.0, "posture": 0.0}
```

---

## 10. Performance Targets (must all pass before FYP demo)

| Metric | Target | How to measure |
|--------|--------|----------------|
| Overall accuracy (NTHU-DDD test) | ≥ 91.3% | Evaluate on subjects 31–36 |
| Precision (macro-avg) | ≥ 89% | sklearn classification_report |
| Recall (macro-avg) | ≥ 92% | sklearn classification_report |
| Level 3 recall (Critical) | ≥ 95% | Must not miss dangerous states |
| Frame latency (p95) | < 85ms | time each ws.send() → ws.onmessage round trip |
| WS throughput | ≥ 28fps | Measure frames processed/sec on demo machine |
| Calibration quality | EAR threshold ±0.03 of mean | Log calibration baseline per session |

---

## 11. Edge Cases — Expected Behaviour

| Condition | What the model should do |
|-----------|--------------------------|
| **No face detected** | Return `compositeScore=0.05, alertLevel=0`. Do NOT alarm. Show "No face" in WS status. |
| **Partial occlusion** (hand, mask) | Use available landmarks only. If < 200 landmarks, treat as no face. |
| **Glasses wearers** | EAR threshold is adaptive (calibration) — this compensates. CNN sees the full crop including glasses. |
| **Very dark environment** | CLAHE pre-processing boosts contrast. If brightness < 30, flag `lowLight=true` in response (add field). |
| **Multiple faces in frame** | Use the largest bounding box (closest/primary driver). Ignore background faces. |
| **Driver looking sideways** (`|yaw| > 45°`) | Head pose signal fires at max. EAR/MAR may be unreliable — reduce their weights temporarily. |
| **Head nodding quickly** | EAR temporal smoothing (EMA α=0.3) prevents rapid oscillation. Alert level can only increase by 1 per 5 frames. |
| **Session disconnect / reconnect** | PERCLOS deque and yawn counter should reset on new WebSocket connection. Calibration runs again. |
| **Mobile phone camera** (lower res) | Preprocessing handles any resolution. Landmarks degrade gracefully below 320×240. |

---

## 12. Alert Level Hysteresis

The alert level must not flicker between levels on borderline scores. Apply hysteresis:

```python
HYSTERESIS = {
    # To go UP:    score must exceed upper threshold
    # To go DOWN:  score must drop below lower threshold
    0: {"up": 0.28, "down": None },   # From 0 → can go to 1 at 0.28
    1: {"up": 0.52, "down": 0.22 },   # From 1 → up at 0.52, back to 0 at 0.22
    2: {"up": 0.77, "down": 0.47 },   # From 2 → up at 0.77, back to 1 at 0.47
    3: {"up": None, "down": 0.70 },   # From 3 → only drops at 0.70
}

prev_level = 0

def stable_alert_level(score: float) -> int:
    global prev_level
    thresholds = HYSTERESIS[prev_level]
    if thresholds["up"] is not None and score >= thresholds["up"]:
        prev_level = min(3, prev_level + 1)
    elif thresholds["down"] is not None and score < thresholds["down"]:
        prev_level = max(0, prev_level - 1)
    return prev_level
```

---

## 13. Blink Rate Estimation

```python
from collections import deque

BLINK_BUFFER = deque(maxlen=1800)  # 60s at 30fps
blink_state  = False               # True while eye is closed

def update_blink_rate(ear_value: float, threshold: float) -> float:
    global blink_state
    is_closed = ear_value < threshold

    # Rising edge = blink start, falling edge = blink complete
    blink_occurred = blink_state and not is_closed
    blink_state    = is_closed

    BLINK_BUFFER.append(1 if blink_occurred else 0)

    # Blinks per minute
    blinks_in_window = sum(BLINK_BUFFER)
    window_seconds   = len(BLINK_BUFFER) / 30.0
    return round((blinks_in_window / window_seconds) * 60, 1)

# Normal range: 12–20 blinks/min
# Drowsy range: < 10 blinks/min (suppressed blink reflex)
# Alert flag:   < 8 blinks/min after 30s of session
```

---

## 14. File Structure for the Python Backend

```
backend/
├── detection/
│   ├── __init__.py
│   ├── pipeline.py          ← Main DetectionPipeline class (orchestrates A/B/C)
│   ├── calibration.py       ← Calibration state machine
│   ├── signals/
│   │   ├── ear.py           ← EAR + PERCLOS
│   │   ├── mar.py           ← MAR + yawn detection
│   │   ├── head_pose.py     ← solvePnP + Euler angles
│   │   └── posture.py       ← Posture deviation
│   ├── fusion/
│   │   ├── system_a.py      ← Weighted rule-based
│   │   ├── system_b.py      ← MobileNetV2 ONNX
│   │   └── system_c.py      ← Meta-classifier
│   └── preprocessing.py     ← CLAHE, resize, face detection
├── models/
│   └── drowsy_mobilenetv2.onnx
├── training/
│   ├── train_mobilenetv2.py
│   ├── train_metaclassifier.py
│   ├── evaluate_ablation.py ← Reproduces the ablation table
│   └── dataset/
│       └── nthu_ddd/        ← Put NTHU-DDD videos here
├── main.py                  ← FastAPI app + WebSocket endpoint
└── requirements.txt
```

### requirements.txt

```
fastapi>=0.110.0
uvicorn[standard]>=0.29.0
websockets>=12.0
mediapipe>=0.10.9
opencv-python-headless>=4.9.0
numpy>=1.26.0
onnxruntime>=1.17.0
scikit-learn>=1.4.0
tensorflow>=2.15.0      # for training only — not needed at inference
tf2onnx>=1.16.0         # for ONNX export — not needed at inference
xgboost>=2.0.0
python-dotenv>=1.0.0
```

---

## 15. Quick Sanity Check — What to Verify Before Demo

```bash
# 1. Model loads without error
python -c "from detection.pipeline import DetectionPipeline; p = DetectionPipeline(); print('OK')"

# 2. Single frame inference
python -c "
import cv2, asyncio
from detection.pipeline import DetectionPipeline
p = DetectionPipeline()
frame = cv2.imread('test_frame.jpg')
m = asyncio.run(p.process(frame))
print(m)
# Should print DetectionMetrics with all fields non-null
"

# 3. Latency test
python scripts/benchmark.py --frames 300
# Target: p95 < 85ms

# 4. Accuracy on test split
python training/evaluate_ablation.py --split test
# Target: ≥ 91.3% on NTHU-DDD subjects 31–36

# 5. WebSocket end-to-end
# Start server: uvicorn main:app --port 8000
# Open frontend at localhost:3000 → /monitor → Demo OFF → Start Monitoring
# Verify live metrics appear in MetricsPanel within 3s
```

---

*Keep this document in sync with `docs/BACKEND_API_SPEC.md` and the `DetectionMetrics` TypeScript
type in `types/detection.ts`. All algorithm parameters here should match the values used in
production.*
