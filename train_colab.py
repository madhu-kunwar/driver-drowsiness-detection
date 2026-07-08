"""
DrowsyShield — Google Colab Training Script
============================================
Trains all three detection systems described in MODEL_PLAN.md:

  System A — Rule-based weighted fusion (EAR / PERCLOS / MAR / HeadPose / Posture)
             No training needed — evaluated analytically on NTHU-DDD test frames.

  System B — Fine-tuned MobileNetV2 (4-class: Alert/Mild/Warning/Critical)
             Trained on 112×112 face crops, exported to ONNX.

  System C — Meta-classifier (XGBoost stacked ensemble over A+B outputs)
             Trained on the combined 11-feature vector from both systems.

Then runs the ablation study and produces the table the frontend displays.

Usage on Colab:
  1. Runtime → Change runtime type → GPU (T4 recommended)
  2. Run all cells top to bottom
  3. Models are saved to /content/drive/MyDrive/DrowsyShield/models/
  4. Copy drowsy_mobilenetv2.onnx + meta_classifier.pkl to backend/models/

Dataset required: NTHU-DDD (request from NTHU; place zip on Google Drive)
Fallback: set USE_SYNTHETIC = True to test the pipeline without the dataset.
"""

# ============================================================
# CELL 1 — Install Dependencies
# ============================================================

import subprocess, sys

def pip(*pkgs):
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", *pkgs])

pip(
    "mediapipe>=0.10.9",
    "opencv-python-headless>=4.9.0",
    "numpy>=1.26.0",
    "scipy>=1.12.0",
    "scikit-learn>=1.4.0",
    "xgboost>=2.0.0",
    "onnxruntime>=1.17.0",
    "tf2onnx>=1.16.0",
    "matplotlib>=3.8.0",
    "seaborn>=0.13.0",
    "tqdm>=4.66.0",
    "Pillow>=10.0.0",
)

print("All packages installed.")


# ============================================================
# CELL 2 — Configuration (edit these before running)
# ============================================================

import os

# ── Dataset ─────────────────────────────────────────────────
# Set to True to run a quick smoke-test with synthetic frames.
# Set to False when you have real NTHU-DDD data on Drive.
USE_SYNTHETIC = False

# Path to the NTHU-DDD root folder on Google Drive.
# Structure expected:
#   NTHU_DDD/
#     Training_Evaluation_Dataset/
#       001/                   ← subject folder
#         glasses/             ← condition sub-folder
#           combinationLabel.txt
#           *.avi              ← video clips
#         ...
#       002/
#       ...
NTHU_ROOT = "/content/drive/MyDrive/DrowsyShield/NTHU_DDD"

# Output directory on Drive — models + results saved here
OUTPUT_DIR = "/content/drive/MyDrive/DrowsyShield/models"

# Subject split (total 36 subjects, 1-indexed)
TRAIN_SUBJECTS = list(range(1, 25))   # 1–24
VAL_SUBJECTS   = list(range(25, 31))  # 25–30
TEST_SUBJECTS  = list(range(31, 37))  # 31–36

# Training hyper-parameters
BATCH_SIZE  = 32
EPOCHS      = 50
LR_BACKBONE = 1e-4
LR_HEAD     = 1e-3
PATIENCE    = 8       # early-stopping patience

# Frame sampling — extract every Nth frame from videos (reduces memory)
FRAME_SKIP  = 3       # sample 1 frame every 3 (= ~10 fps effective from 30 fps)

# Input size for MobileNetV2
IMG_SIZE = 112

# ── Paths derived automatically ──────────────────────────────
os.makedirs(OUTPUT_DIR, exist_ok=True)
MODEL_H5_PATH   = os.path.join(OUTPUT_DIR, "drowsy_mobilenetv2.h5")
ONNX_PATH       = os.path.join(OUTPUT_DIR, "drowsy_mobilenetv2.onnx")
META_PATH       = os.path.join(OUTPUT_DIR, "meta_classifier.pkl")
RESULTS_PATH    = os.path.join(OUTPUT_DIR, "ablation_results.json")

print(f"Output → {OUTPUT_DIR}")
print(f"Synthetic mode: {USE_SYNTHETIC}")


# ============================================================
# CELL 3 — Mount Google Drive
# ============================================================

try:
    from google.colab import drive
    drive.mount("/content/drive", force_remount=False)
    print("Drive mounted.")
except ImportError:
    print("Not running on Colab — skipping drive mount.")
    USE_SYNTHETIC = True   # force synthetic if no Drive


# ============================================================
# CELL 4 — Imports
# ============================================================

import cv2
import numpy as np
import json
import pickle
import time
import warnings
from pathlib import Path
from collections import deque
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict

import mediapipe as mp
from tqdm import tqdm
import matplotlib.pyplot as plt
import seaborn as sns

import sklearn
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing   import StandardScaler
from sklearn.metrics         import (
    accuracy_score, precision_score, recall_score,
    f1_score, classification_report, confusion_matrix,
)
from sklearn.model_selection import StratifiedKFold

import xgboost as xgb

warnings.filterwarnings("ignore")
np.random.seed(42)

print(f"MediaPipe   : {mp.__version__}")
print(f"scikit-learn: {sklearn.__version__}")
print(f"XGBoost     : {xgb.__version__}")
print(f"OpenCV      : {cv2.__version__}")


# ============================================================
# CELL 5 — MediaPipe Setup
# ============================================================

mp_face_mesh    = mp.solutions.face_mesh
mp_face_detect  = mp.solutions.face_detection
mp_pose         = mp.solutions.pose

face_mesh   = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

face_detector = mp_face_detect.FaceDetection(
    model_selection=0,
    min_detection_confidence=0.5,
)

pose_detector = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

print("MediaPipe models loaded.")


# ============================================================
# CELL 6 — Label Mapping (NTHU-DDD → DrowsyShield 4 classes)
# ============================================================

# NTHU-DDD uses these integer labels in combinationLabel.txt:
#   0 = Normal (alert)
#   1 = Eye closure (mild drowsiness)
#   2 = Yawning     (mild / warning)
#   3 = Nodding off (warning / critical)
#
# We map them straight to our alert levels 0–3.
# Nodding off → 3 (Critical) because it implies near-microsleep.

NTHU_TO_ALERT = {
    0: 0,   # Normal      → Alert
    1: 1,   # Eye closure → Mild
    2: 1,   # Yawning     → Mild  (conservative — avoids false positives)
    3: 3,   # Nodding off → Critical
}

CLASS_NAMES = ["Alert", "Mild", "Warning", "Critical"]

def map_label(raw_label: int) -> int:
    return NTHU_TO_ALERT.get(int(raw_label), 0)


# ============================================================
# CELL 7 — Preprocessing Utilities
# ============================================================

def normalise_brightness(frame_bgr: np.ndarray) -> np.ndarray:
    """Apply CLAHE in LAB space when the frame is dark (mean < 60)."""
    if frame_bgr.mean() < 60:
        lab       = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2LAB)
        l, a, b   = cv2.split(lab)
        clahe     = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        l         = clahe.apply(l)
        frame_bgr = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    return frame_bgr


def resize_frame(frame: np.ndarray, size: Tuple[int, int] = (640, 480)) -> np.ndarray:
    if frame.shape[:2] != (size[1], size[0]):
        frame = cv2.resize(frame, size, interpolation=cv2.INTER_AREA)
    return frame


def preprocess(frame_bgr: np.ndarray) -> np.ndarray:
    """Full preprocessing pipeline: resize → CLAHE → ready for MediaPipe (RGB)."""
    frame_bgr = resize_frame(frame_bgr)
    frame_bgr = normalise_brightness(frame_bgr)
    return frame_bgr


def extract_face_crop(frame_bgr: np.ndarray, padding: float = 0.15) -> Optional[np.ndarray]:
    """
    Detect largest face bounding box and return padded 112×112 RGB crop.
    Returns None if no face found.
    """
    h, w = frame_bgr.shape[:2]
    rgb   = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    res   = face_detector.process(rgb)

    if not res.detections:
        return None

    # Pick the detection with the largest bounding box area
    best = max(
        res.detections,
        key=lambda d: d.location_data.relative_bounding_box.width *
                      d.location_data.relative_bounding_box.height,
    )
    bbox  = best.location_data.relative_bounding_box
    x1    = max(0, int((bbox.xmin - padding) * w))
    y1    = max(0, int((bbox.ymin - padding) * h))
    x2    = min(w, int((bbox.xmin + bbox.width  + padding) * w))
    y2    = min(h, int((bbox.ymin + bbox.height + padding) * h))

    crop  = frame_bgr[y1:y2, x1:x2]
    if crop.size == 0:
        return None

    crop  = cv2.resize(crop, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)


# ============================================================
# CELL 8 — System A: Signal Extraction Functions
# ============================================================

# ── Landmark index constants ─────────────────────────────────
LEFT_EYE   = [362, 385, 387, 263, 373, 380]
RIGHT_EYE  = [33,  160, 158, 133, 153, 144]
OUTER_LIP  = [78,  82,  87,  13, 312, 317, 402, 308]
POSE_IDX   = [4, 152, 33, 263, 61, 291]   # nose,chin,L-eye,R-eye,L-mouth,R-mouth

# Generic 3D face model (mm) for solvePnP
MODEL_3D = np.array([
    ( 0.0,    0.0,    0.0),
    ( 0.0,  -63.6,  -12.5),
    (-43.3,  32.7,  -26.0),
    ( 43.3,  32.7,  -26.0),
    (-28.9, -28.9,  -24.1),
    ( 28.9, -28.9,  -24.1),
], dtype=np.float64)


def _dist(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.linalg.norm(a - b))


def compute_ear(landmarks) -> float:
    def _ear(indices):
        p = [np.array([landmarks[i].x, landmarks[i].y]) for i in indices]
        A = _dist(p[1], p[5])
        B = _dist(p[2], p[4])
        C = _dist(p[0], p[3])
        return (A + B) / (2.0 * C + 1e-6)
    return (_ear(LEFT_EYE) + _ear(RIGHT_EYE)) / 2.0


def compute_mar(landmarks) -> float:
    p = [np.array([landmarks[i].x, landmarks[i].y]) for i in OUTER_LIP]
    A = _dist(p[1], p[7])
    B = _dist(p[2], p[6])
    C = _dist(p[3], p[5])
    D = _dist(p[0], p[4])
    return (A + B + C) / (2.0 * D + 1e-6)


def compute_head_pose(landmarks, w: int, h: int) -> Tuple[float, float, float]:
    """Returns (pitch, yaw, roll) in degrees."""
    img_pts = np.array(
        [(landmarks[i].x * w, landmarks[i].y * h) for i in POSE_IDX],
        dtype=np.float64,
    )
    fl = float(w)
    cam = np.array([[fl, 0, w/2], [0, fl, h/2], [0, 0, 1]], dtype=np.float64)
    dist_c = np.zeros((4, 1))
    ok, rvec, _ = cv2.solvePnP(MODEL_3D, img_pts, cam, dist_c,
                                flags=cv2.SOLVEPNP_ITERATIVE)
    if not ok:
        return 0.0, 0.0, 0.0
    rmat, _ = cv2.Rodrigues(rvec)
    angles, *_ = cv2.RQDecomp3x3(rmat)
    return float(angles[0]), float(angles[1]), float(angles[2])


# ── Normalise signals to [0, 1] ──────────────────────────────
EAR_THRESHOLD = 0.21   # default (adaptive calibration not used in offline training)

def normalise_ear(ear: float) -> float:
    return float(np.clip((EAR_THRESHOLD - ear) / (EAR_THRESHOLD + 1e-6), 0.0, 1.0))

def normalise_mar(mar: float) -> float:
    return float(np.clip((mar - 0.30) / 0.60, 0.0, 1.0))

def normalise_pose(pitch: float, yaw: float, roll: float) -> float:
    return float(min(1.0, max(
        abs(pitch) / 30.0,
        abs(yaw)   / 35.0,
        abs(roll)  / 20.0,
    )))


@dataclass
class FrameFeatures:
    """All System A signals for one frame, plus face crop for System B."""
    ear:         float = 0.0
    mar:         float = 0.0
    pitch:       float = 0.0
    yaw:         float = 0.0
    roll:        float = 0.0
    # Normalised (0–1) scores
    ear_score:      float = 0.0
    mar_score:      float = 0.0
    pose_score:     float = 0.0
    posture_score:  float = 0.0   # requires pose landmarks — 0 if not detected
    face_crop:      Optional[np.ndarray] = None   # 112×112 RGB
    face_detected:  bool = False


def extract_frame_features(frame_bgr: np.ndarray) -> FrameFeatures:
    """
    Run MediaPipe FaceMesh + Pose on one preprocessed BGR frame.
    Returns FrameFeatures with all System A signals + face crop.
    """
    feat = FrameFeatures()
    h, w = frame_bgr.shape[:2]
    rgb   = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

    # Face crop (for System B CNN)
    feat.face_crop = extract_face_crop(frame_bgr)

    # FaceMesh
    fm_res = face_mesh.process(rgb)
    if fm_res.multi_face_landmarks:
        lm = fm_res.multi_face_landmarks[0].landmark
        feat.face_detected = True

        feat.ear = compute_ear(lm)
        feat.mar = compute_mar(lm)
        feat.ear_score  = normalise_ear(feat.ear)
        feat.mar_score  = normalise_mar(feat.mar)

        feat.pitch, feat.yaw, feat.roll = compute_head_pose(lm, w, h)
        feat.pose_score = normalise_pose(feat.pitch, feat.yaw, feat.roll)

    # Pose (for posture)
    pose_res = pose_detector.process(rgb)
    if pose_res.pose_landmarks and feat.face_detected:
        pl = pose_res.pose_landmarks.landmark
        ls = pl[11]; rs = pl[12]
        le = pl[7];  re = pl[8]

        shoulder_mid = np.array([(ls.x + rs.x) / 2, (ls.y + rs.y) / 2])
        ear_mid      = np.array([(le.x + re.x) / 2, (le.y + re.y) / 2])
        forward_lean = np.linalg.norm(ear_mid - shoulder_mid)
        dx  = abs(ls.x - rs.x)
        dy  = abs(ls.y - rs.y)
        tilt = np.arctan2(dy, dx + 1e-6)

        # Default calibration baseline
        BASELINE_LEAN = 0.30
        BASELINE_TILT = 0.05
        lean_dev = abs(forward_lean - BASELINE_LEAN) / 0.15
        tilt_dev = tilt / 0.35
        feat.posture_score = float(min(1.0, lean_dev * 0.6 + tilt_dev * 0.4))

    return feat


# ============================================================
# CELL 9 — System A: Composite Score (rule-based fusion)
# ============================================================

WEIGHTS_A = {
    "ear":      0.30,
    "perclos":  0.25,
    "mar":      0.20,
    "pose":     0.15,
    "posture":  0.10,
}

# Ablation weight sets — each disables/zeros signals cumulatively
ABLATION_CONFIGS = {
    "EAR only":          {"ear": 1.00, "perclos": 0.0, "mar": 0.0, "pose": 0.0, "posture": 0.0},
    "EAR + PERCLOS":     {"ear": 0.55, "perclos": 0.45, "mar": 0.0, "pose": 0.0, "posture": 0.0},
    "+ MAR":             {"ear": 0.40, "perclos": 0.33, "mar": 0.27, "pose": 0.0, "posture": 0.0},
    "+ Head Pose":       {"ear": 0.33, "perclos": 0.28, "mar": 0.22, "pose": 0.17, "posture": 0.0},
    "All 5 (System A)":  WEIGHTS_A,
}


class PerclosBuffer:
    """Rolling 60-second PERCLOS tracker — approximated per-clip here."""
    def __init__(self, fps: float = 10.0, window_s: float = 60.0):
        n = int(fps * window_s)
        self._buf = deque(maxlen=max(n, 1))
        self._thr = EAR_THRESHOLD * (1 - 0.80)

    def update(self, ear: float) -> float:
        self._buf.append(1 if ear < self._thr else 0)
        return (sum(self._buf) / len(self._buf)) * 100.0 if self._buf else 0.0

    def reset(self):
        self._buf.clear()


def system_a_score(
    ear_s: float,
    perclos_s: float,
    mar_s: float,
    pose_s: float,
    posture_s: float,
    weights: Dict[str, float] = WEIGHTS_A,
) -> float:
    raw = (
        ear_s     * weights["ear"]     +
        perclos_s * weights["perclos"] +
        mar_s     * weights["mar"]     +
        pose_s    * weights["pose"]    +
        posture_s * weights["posture"]
    )
    return float(np.clip(raw, 0.0, 1.0))


def score_to_level(score: float) -> int:
    if score < 0.25: return 0
    if score < 0.50: return 1
    if score < 0.75: return 2
    return 3


# ============================================================
# CELL 10 — Dataset Loading
# ============================================================

def find_nthu_videos(nthu_root: str) -> List[Tuple[Path, int]]:
    """
    Walk NTHU-DDD folder tree and return list of (video_path, subject_id).
    Expects structure:
      <nthu_root>/Training_Evaluation_Dataset/<subj_id>/<condition>/*.avi
    Subject id is parsed from the folder name (e.g. '001' → 1).
    """
    root   = Path(nthu_root)
    videos = []
    train_dir = root / "Training_Evaluation_Dataset"
    if not train_dir.exists():
        train_dir = root   # fall back to root if subfolder missing

    for subj_folder in sorted(train_dir.iterdir()):
        if not subj_folder.is_dir():
            continue
        try:
            subj_id = int(subj_folder.name.lstrip("0") or "0")
        except ValueError:
            continue
        for cond_folder in subj_folder.iterdir():
            if not cond_folder.is_dir():
                continue
            for vid in cond_folder.glob("*.avi"):
                videos.append((vid, subj_id))
            for vid in cond_folder.glob("*.mp4"):
                videos.append((vid, subj_id))

    print(f"Found {len(videos)} video clips across {len(set(s for _, s in videos))} subjects.")
    return videos


def load_nthu_labels(video_path: Path) -> Optional[np.ndarray]:
    """
    Load per-frame label array from combinationLabel.txt in the same folder.
    NTHU-DDD label files have one integer per line (0–3).
    Returns None if not found.
    """
    label_file = video_path.parent / "combinationLabel.txt"
    if not label_file.exists():
        # Try common alternative name
        for alt in ["label.txt", "labels.txt", "Label.txt"]:
            candidate = video_path.parent / alt
            if candidate.exists():
                label_file = candidate
                break
        else:
            return None

    with label_file.open() as f:
        lines = [l.strip() for l in f if l.strip()]
    try:
        return np.array([int(x) for x in lines], dtype=np.int32)
    except ValueError:
        return None


def extract_frames_from_video(
    video_path: Path,
    labels: Optional[np.ndarray],
    frame_skip: int = FRAME_SKIP,
) -> List[Tuple[np.ndarray, int]]:
    """
    Extract (preprocessed_frame_bgr, alert_level) tuples from a video.
    If labels is None, label 0 (Alert) is assumed.
    """
    cap    = cv2.VideoCapture(str(video_path))
    result = []
    idx    = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % frame_skip == 0:
            frame      = preprocess(frame)
            raw_label  = int(labels[idx]) if (labels is not None and idx < len(labels)) else 0
            alert_lvl  = map_label(raw_label)
            result.append((frame, alert_lvl))
        idx += 1

    cap.release()
    return result


# ── Synthetic data fallback ──────────────────────────────────

def make_synthetic_dataset(n_per_class: int = 200) -> List[Tuple[np.ndarray, int]]:
    """
    Generate dummy 640×480 frames with simple patterns to smoke-test the pipeline.
    No real face → MediaPipe returns defaults.  Features are noise-based.
    """
    data   = []
    labels = [0, 1, 1, 3]   # map to 4 output classes (skip class 2 for balance)
    for label in labels:
        for _ in range(n_per_class):
            # Vary brightness so CLAHE path is exercised
            brightness = np.random.randint(30, 200)
            frame      = np.full((480, 640, 3), brightness, dtype=np.uint8)
            # Add random noise
            noise      = np.random.randint(0, 40, (480, 640, 3), dtype=np.uint8)
            frame      = np.clip(frame.astype(np.int32) + noise, 0, 255).astype(np.uint8)
            data.append((frame, label))
    np.random.shuffle(data)
    return data


# ============================================================
# CELL 11 — Feature Extraction Loop
# ============================================================

@dataclass
class Sample:
    """One training sample = features from one frame."""
    # System A normalised scores (for rule-based and meta-classifier)
    ear_score:     float
    perclos_score: float
    mar_score:     float
    pose_score:    float
    posture_score: float
    # System B input
    face_crop:     Optional[np.ndarray]   # 112×112 RGB uint8
    # Ground truth
    label:         int


def build_dataset(
    clips: List[Tuple[Path, int]],
    subject_filter: List[int],
    max_frames_per_subject: int = 2000,
) -> List[Sample]:
    """
    Extract all features from a subset of NTHU-DDD clips.
    Maintains per-subject PERCLOS state.
    """
    samples: List[Sample] = []

    for vid_path, subj_id in tqdm(
        [(p, s) for p, s in clips if s in subject_filter],
        desc="Extracting features",
    ):
        labels = load_nthu_labels(vid_path)
        frames = extract_frames_from_video(vid_path, labels)

        perclos_buf = PerclosBuffer()
        subj_count  = 0

        for frame_bgr, label in frames:
            if subj_count >= max_frames_per_subject:
                break
            feat = extract_frame_features(frame_bgr)

            perclos_raw   = perclos_buf.update(feat.ear)
            perclos_score = float(min(1.0, perclos_raw / 40.0))

            samples.append(Sample(
                ear_score     = feat.ear_score,
                perclos_score = perclos_score,
                mar_score     = feat.mar_score,
                pose_score    = feat.pose_score,
                posture_score = feat.posture_score,
                face_crop     = feat.face_crop,
                label         = label,
            ))
            subj_count += 1

    print(f"  → {len(samples)} samples")
    label_counts = {c: sum(1 for s in samples if s.label == c) for c in range(4)}
    print(f"  → Label distribution: {label_counts}")
    return samples


def build_synthetic(n_per_class: int = 200) -> List[Sample]:
    frames = make_synthetic_dataset(n_per_class)
    perclos_buf = PerclosBuffer()
    out = []
    for frame_bgr, label in tqdm(frames, desc="Synthetic features"):
        feat  = extract_frame_features(frame_bgr)
        perc  = perclos_buf.update(feat.ear)
        out.append(Sample(
            ear_score     = feat.ear_score,
            perclos_score = float(min(1.0, perc / 40.0)),
            mar_score     = feat.mar_score,
            pose_score    = feat.pose_score,
            posture_score = feat.posture_score,
            face_crop     = feat.face_crop,
            label         = label,
        ))
    return out


# ── Actually load data ───────────────────────────────────────
if USE_SYNTHETIC:
    print("Using SYNTHETIC data — pipeline smoke test only.")
    train_samples = build_synthetic(300)
    val_samples   = build_synthetic(100)
    test_samples  = build_synthetic(100)
else:
    all_clips = find_nthu_videos(NTHU_ROOT)
    print("Extracting TRAIN set…")
    train_samples = build_dataset(all_clips, TRAIN_SUBJECTS, max_frames_per_subject=1500)
    print("Extracting VAL set…")
    val_samples   = build_dataset(all_clips, VAL_SUBJECTS,   max_frames_per_subject=500)
    print("Extracting TEST set…")
    test_samples  = build_dataset(all_clips, TEST_SUBJECTS,  max_frames_per_subject=500)

print(f"\nDataset ready — Train:{len(train_samples)} Val:{len(val_samples)} Test:{len(test_samples)}")


# ============================================================
# CELL 12 — System A: Ablation Study (no model training needed)
# ============================================================

def evaluate_system_a(samples: List[Sample], weights: Dict[str, float]) -> Dict:
    """Evaluate a System A weight configuration on a list of samples."""
    y_true, y_pred = [], []
    for s in samples:
        score = system_a_score(
            s.ear_score, s.perclos_score, s.mar_score, s.pose_score, s.posture_score,
            weights=weights,
        )
        y_true.append(s.label)
        y_pred.append(score_to_level(score))

    y_true = np.array(y_true)
    y_pred = np.array(y_pred)

    acc  = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, average="macro", zero_division=0)
    rec  = recall_score(y_true, y_pred, average="macro", zero_division=0)
    f1   = f1_score(y_true, y_pred, average="macro", zero_division=0)

    return {"accuracy": acc, "precision": prec, "recall": rec, "f1": f1}


print("\n" + "="*60)
print("ABLATION STUDY — System A (Rule-Based)")
print("="*60)

ablation_results = {}
for cfg_name, w in ABLATION_CONFIGS.items():
    res = evaluate_system_a(test_samples, w)
    ablation_results[cfg_name] = res
    print(f"  {cfg_name:<25}  Acc={res['accuracy']:.1%}  "
          f"P={res['precision']:.1%}  R={res['recall']:.1%}  F1={res['f1']:.1%}")


# ── Plot ablation table ──────────────────────────────────────
cfg_names = list(ABLATION_CONFIGS.keys())
acc_vals  = [ablation_results[k]["accuracy"] * 100 for k in cfg_names]

fig, ax = plt.subplots(figsize=(10, 4))
bars = ax.barh(cfg_names, acc_vals, color="#10B981", edgecolor="#059669")
ax.set_xlabel("Accuracy (%)")
ax.set_title("System A — Ablation Study (Test Set)")
ax.set_xlim(60, 100)
for bar, val in zip(bars, acc_vals):
    ax.text(val + 0.3, bar.get_y() + bar.get_height()/2,
            f"{val:.1f}%", va="center", fontsize=9)
plt.tight_layout()
ablation_fig_path = os.path.join(OUTPUT_DIR, "ablation_study.png")
plt.savefig(ablation_fig_path, dpi=150)
plt.show()
print(f"Ablation chart saved → {ablation_fig_path}")


# ============================================================
# CELL 13 — System B: MobileNetV2 Training
# ============================================================

import tensorflow as tf
from tensorflow.keras import layers, models, optimizers, callbacks
from tensorflow.keras.applications import MobileNetV2

print(f"\nTensorFlow: {tf.__version__}")
print(f"GPU available: {tf.config.list_physical_devices('GPU')}")


def samples_to_cnn_arrays(
    samples: List[Sample], augment: bool = False
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Convert samples to (X, y) arrays for CNN training.
    Samples without a detected face are skipped.
    """
    X, y = [], []
    for s in samples:
        if s.face_crop is None:
            # Use a blank crop — CNN should learn to output neutral
            crop = np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8)
        else:
            crop = s.face_crop
        X.append(crop)
        y.append(s.label)
    X = np.stack(X, axis=0).astype(np.float32) / 255.0
    y = np.array(y, dtype=np.int32)
    return X, y


print("Building CNN arrays…")
X_train, y_train = samples_to_cnn_arrays(train_samples)
X_val,   y_val   = samples_to_cnn_arrays(val_samples)
X_test,  y_test  = samples_to_cnn_arrays(test_samples)

print(f"CNN arrays — Train:{X_train.shape} Val:{X_val.shape} Test:{X_test.shape}")

# ── Class weights (handle imbalance) ────────────────────────
from sklearn.utils.class_weight import compute_class_weight

classes        = np.unique(y_train)
class_wt_arr   = compute_class_weight("balanced", classes=classes, y=y_train)
class_weight   = {int(c): float(w) for c, w in zip(classes, class_wt_arr)}
print(f"Class weights: {class_weight}")


def build_mobilenetv2(num_classes: int = 4, img_size: int = IMG_SIZE) -> tf.keras.Model:
    """
    Fine-tuned MobileNetV2:
      - Backbone: ImageNet weights, all layers FROZEN except last 3 blocks
      - Head:     GAP → Dense(128) → Dropout(0.3) → Dense(num_classes, softmax)
    Two-phase training:
      Phase 1: Train head only (backbone frozen)
      Phase 2: Unfreeze last 3 blocks, fine-tune with lower LR
    """
    base = MobileNetV2(
        input_shape=(img_size, img_size, 3),
        include_top=False,
        weights="imagenet",
    )
    # Phase 1: freeze entire backbone
    base.trainable = False

    inputs  = tf.keras.Input(shape=(img_size, img_size, 3))
    x       = base(inputs, training=False)
    x       = layers.GlobalAveragePooling2D()(x)
    x       = layers.Dense(128, activation="relu")(x)
    x       = layers.Dropout(0.3)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    return tf.keras.Model(inputs, outputs, name="DrowsyMobileNetV2")


model = build_mobilenetv2()
model.summary(line_length=80)

# ── Data augmentation ────────────────────────────────────────
data_aug = tf.keras.Sequential([
    layers.RandomFlip("horizontal"),
    layers.RandomRotation(0.10),
    layers.RandomZoom(0.10),
    layers.RandomBrightness(0.30),
    layers.GaussianNoise(0.02),
], name="augmentation")


def make_tf_dataset(X, y, batch_size=BATCH_SIZE, shuffle=True, augment=False):
    ds = tf.data.Dataset.from_tensor_slices((X, y))
    if shuffle:
        ds = ds.shuffle(len(X), reshuffle_each_iteration=True)
    if augment:
        ds = ds.map(lambda x, y: (data_aug(x, training=True), y),
                    num_parallel_calls=tf.data.AUTOTUNE)
    ds = ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)
    return ds


train_ds = make_tf_dataset(X_train, y_train, augment=True)
val_ds   = make_tf_dataset(X_val,   y_val,   shuffle=False)
test_ds  = make_tf_dataset(X_test,  y_test,  shuffle=False)

# ── Phase 1: Train head only ─────────────────────────────────
model.compile(
    optimizer=optimizers.Adam(learning_rate=LR_HEAD),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)

cb_es   = callbacks.EarlyStopping(monitor="val_loss", patience=PATIENCE, restore_best_weights=True)
cb_lr   = callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, min_lr=1e-6)
cb_ckpt = callbacks.ModelCheckpoint(MODEL_H5_PATH, monitor="val_loss",
                                    save_best_only=True, verbose=1)

print("\n── Phase 1: Training head (backbone frozen) ──")
hist1 = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=min(EPOCHS, 20),
    callbacks=[cb_es, cb_lr, cb_ckpt],
    class_weight=class_weight,
    verbose=2,
)

# ── Phase 2: Unfreeze last 3 MobileNetV2 blocks ─────────────
base_model = model.layers[1]   # MobileNetV2 sub-model
base_model.trainable = True

# Freeze everything up to layer -30 (roughly last 3 blocks)
for layer in base_model.layers[:-30]:
    layer.trainable = False

model.compile(
    optimizer=optimizers.Adam(learning_rate=LR_BACKBONE),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)

print("\n── Phase 2: Fine-tuning last 3 blocks ──")
hist2 = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=EPOCHS,
    initial_epoch=len(hist1.epoch),
    callbacks=[cb_es, cb_lr, cb_ckpt],
    class_weight=class_weight,
    verbose=2,
)

# ── Evaluate System B ────────────────────────────────────────
model.load_weights(MODEL_H5_PATH)
loss_b, acc_b = model.evaluate(test_ds, verbose=0)
print(f"\nSystem B — Test Accuracy: {acc_b:.1%}  Loss: {loss_b:.4f}")

y_pred_b = np.argmax(model.predict(test_ds, verbose=0), axis=1)
print("\nClassification Report (System B):")
print(classification_report(y_test[:len(y_pred_b)], y_pred_b, target_names=CLASS_NAMES, zero_division=0))

# ── Training history plot ────────────────────────────────────
all_acc  = hist1.history["accuracy"]     + hist2.history["accuracy"]
all_vacc = hist1.history["val_accuracy"] + hist2.history["val_accuracy"]

plt.figure(figsize=(10, 4))
plt.subplot(1, 2, 1)
plt.plot(all_acc,  label="Train", color="#10B981")
plt.plot(all_vacc, label="Val",   color="#F97316")
plt.axhline(0.88, color="gray", ls="--", label="Target 88%")
plt.xlabel("Epoch"); plt.ylabel("Accuracy"); plt.title("System B — Accuracy")
plt.legend()

all_loss  = hist1.history["loss"]     + hist2.history["loss"]
all_vloss = hist1.history["val_loss"] + hist2.history["val_loss"]
plt.subplot(1, 2, 2)
plt.plot(all_loss,  label="Train", color="#10B981")
plt.plot(all_vloss, label="Val",   color="#F97316")
plt.xlabel("Epoch"); plt.ylabel("Loss"); plt.title("System B — Loss")
plt.legend()
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "training_curves.png"), dpi=150)
plt.show()


# ============================================================
# CELL 14 — Export MobileNetV2 to ONNX
# ============================================================

import tf2onnx
import onnxruntime as ort

print("\nExporting to ONNX…")

input_sig = [tf.TensorSpec([None, IMG_SIZE, IMG_SIZE, 3], tf.float32, name="input")]
onnx_model, _ = tf2onnx.convert.from_keras(model, input_signature=input_sig,
                                            opset=13, output_path=ONNX_PATH)

# Verify ONNX inference
sess = ort.InferenceSession(ONNX_PATH, providers=["CPUExecutionProvider"])
dummy = np.random.rand(1, IMG_SIZE, IMG_SIZE, 3).astype(np.float32)
out   = sess.run(None, {"input": dummy})[0]
print(f"ONNX output shape: {out.shape}  (should be (1, 4))")

# Latency benchmark
times = []
for _ in range(50):
    t0 = time.perf_counter()
    sess.run(None, {"input": dummy})
    times.append((time.perf_counter() - t0) * 1000)
p50 = np.percentile(times, 50)
p95 = np.percentile(times, 95)
print(f"ONNX latency — p50: {p50:.1f}ms  p95: {p95:.1f}ms  (target < 12ms)")
print(f"Model size: {os.path.getsize(ONNX_PATH) / 1e6:.1f} MB  (target < 15 MB)")
print(f"Saved → {ONNX_PATH}")


# ============================================================
# CELL 15 — Build 11-Feature Vector (A + B) for System C
# ============================================================

def build_meta_features(
    samples: List[Sample],
    ort_session: ort.InferenceSession,
    batch_size: int = 64,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Build the 11-dim feature vector for System C:
      [composite_A, alert_level_A, ear, perclos, mar, pose, posture,
       cnn_p0, cnn_p1, cnn_p2, cnn_p3]
    """
    X_meta = []
    y_meta = []

    # Batch-process CNN predictions
    crops = []
    for s in samples:
        if s.face_crop is not None:
            crops.append(s.face_crop.astype(np.float32) / 255.0)
        else:
            crops.append(np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.float32))

    cnn_probs = []
    for start in range(0, len(crops), batch_size):
        batch = np.stack(crops[start:start + batch_size], axis=0)
        probs = ort_session.run(None, {"input": batch})[0]
        cnn_probs.extend(probs.tolist())

    for idx, s in enumerate(samples):
        score_a = system_a_score(
            s.ear_score, s.perclos_score, s.mar_score,
            s.pose_score, s.posture_score,
        )
        level_a = score_to_level(score_a)
        p0, p1, p2, p3 = cnn_probs[idx]

        feat_vec = [
            score_a,
            float(level_a),
            s.ear_score,
            s.perclos_score,
            s.mar_score,
            s.pose_score,
            s.posture_score,
            p0, p1, p2, p3,
        ]
        X_meta.append(feat_vec)
        y_meta.append(s.label)

    return np.array(X_meta, dtype=np.float32), np.array(y_meta, dtype=np.int32)


print("Building meta-feature arrays…")
X_train_m, y_train_m = build_meta_features(train_samples, sess)
X_val_m,   y_val_m   = build_meta_features(val_samples,   sess)
X_test_m,  y_test_m  = build_meta_features(test_samples,  sess)

print(f"Meta-features — Train:{X_train_m.shape} Val:{X_val_m.shape} Test:{X_test_m.shape}")

# Feature names for interpretability
FEATURE_NAMES = [
    "composite_A", "level_A", "ear", "perclos", "mar", "pose", "posture",
    "cnn_p_alert", "cnn_p_mild", "cnn_p_warning", "cnn_p_critical",
]


# ============================================================
# CELL 16 — System C: Train XGBoost Meta-Classifier
# ============================================================

# Scale features
scaler   = StandardScaler()
X_tr_sc  = scaler.fit_transform(X_train_m)
X_va_sc  = scaler.transform(X_val_m)
X_te_sc  = scaler.transform(X_test_m)

# ── Option A: Logistic Regression (baseline, fast) ──────────
lr_meta = LogisticRegression(
    max_iter=1000,
    C=1.0,
    class_weight="balanced",
    random_state=42,
)
lr_meta.fit(X_tr_sc, y_train_m)
acc_lr  = accuracy_score(y_test_m, lr_meta.predict(X_te_sc))
print(f"System C (Logistic Regression) — Test Accuracy: {acc_lr:.1%}")

# ── Option B: XGBoost (primary) ─────────────────────────────
xgb_params = {
    "objective":        "multi:softprob",
    "num_class":        4,
    "max_depth":        4,
    "n_estimators":     200,
    "learning_rate":    0.05,
    "subsample":        0.8,
    "colsample_bytree": 0.8,
    "use_label_encoder": False,
    "eval_metric":      "mlogloss",
    "random_state":     42,
    "n_jobs":           -1,
}

xgb_meta = xgb.XGBClassifier(**xgb_params)
xgb_meta.fit(
    X_tr_sc, y_train_m,
    eval_set=[(X_va_sc, y_val_m)],
    verbose=False,
    early_stopping_rounds=15,
)

y_pred_c  = xgb_meta.predict(X_te_sc)
acc_c     = accuracy_score(y_test_m, y_pred_c)
print(f"System C (XGBoost) — Test Accuracy: {acc_c:.1%}")
print("\nClassification Report (System C):")
print(classification_report(y_test_m, y_pred_c, target_names=CLASS_NAMES, zero_division=0))

# ── Feature importance ───────────────────────────────────────
fi  = xgb_meta.feature_importances_
idx = np.argsort(fi)[::-1]

plt.figure(figsize=(8, 4))
plt.bar(range(len(fi)), fi[idx], color="#10B981")
plt.xticks(range(len(fi)), [FEATURE_NAMES[i] for i in idx], rotation=45, ha="right")
plt.title("System C — XGBoost Feature Importances")
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "feature_importance.png"), dpi=150)
plt.show()

# ── Save System C ────────────────────────────────────────────
with open(META_PATH, "wb") as f:
    pickle.dump({"scaler": scaler, "model": xgb_meta}, f)
print(f"Meta-classifier saved → {META_PATH}")


# ============================================================
# CELL 17 — Full Comparison: System A vs B vs C
# ============================================================

def eval_metrics(y_true, y_pred) -> Dict:
    return {
        "accuracy":  accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, average="macro", zero_division=0),
        "recall":    recall_score(y_true, y_pred, average="macro", zero_division=0),
        "f1":        f1_score(y_true, y_pred, average="macro", zero_division=0),
    }


# System A (full 5 signals)
y_pred_a = [
    score_to_level(system_a_score(
        s.ear_score, s.perclos_score, s.mar_score, s.pose_score, s.posture_score,
    ))
    for s in test_samples
]
metrics_a = eval_metrics(y_test_m, y_pred_a)

# System B (CNN alone)
cnn_only_preds = np.argmax(
    sess.run(None, {"input": np.stack(
        [(s.face_crop.astype(np.float32) / 255.0 if s.face_crop is not None
          else np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.float32))
         for s in test_samples],
    )})[0],
    axis=1,
)
metrics_b = eval_metrics(y_test_m, cnn_only_preds)

# System C (ensemble)
metrics_c = eval_metrics(y_test_m, y_pred_c)

print("\n" + "="*60)
print("SYSTEM COMPARISON (Test Set)")
print("="*60)
header = f"{'System':<30} {'Acc':>7} {'Prec':>7} {'Recall':>7} {'F1':>7}"
print(header)
print("-"*60)
for name, m in [("System A (Rule-Based)", metrics_a),
                ("System B (MobileNetV2 ONNX)", metrics_b),
                ("System C (Stacked Ensemble)", metrics_c)]:
    print(f"{name:<30} {m['accuracy']:>7.1%} {m['precision']:>7.1%} "
          f"{m['recall']:>7.1%} {m['f1']:>7.1%}")
print("="*60)


# ── Confusion matrices ───────────────────────────────────────
fig, axes = plt.subplots(1, 3, figsize=(15, 4))
for ax, (name, preds) in zip(axes, [
    ("System A", y_pred_a),
    ("System B", cnn_only_preds),
    ("System C", y_pred_c),
]):
    cm = confusion_matrix(y_test_m, preds, labels=[0, 1, 2, 3])
    sns.heatmap(cm, annot=True, fmt="d", cmap="Greens", ax=ax,
                xticklabels=CLASS_NAMES, yticklabels=CLASS_NAMES)
    ax.set_title(name)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "confusion_matrices.png"), dpi=150)
plt.show()


# ============================================================
# CELL 18 — Save All Results to JSON
# ============================================================

final_results = {
    "ablation": {k: {kk: round(vv * 100, 2) for kk, vv in v.items()}
                 for k, v in ablation_results.items()},
    "systems": {
        "A": {k: round(v * 100, 2) for k, v in metrics_a.items()},
        "B": {k: round(v * 100, 2) for k, v in metrics_b.items()},
        "C": {k: round(v * 100, 2) for k, v in metrics_c.items()},
    },
    "model_paths": {
        "system_b_onnx": ONNX_PATH,
        "system_c_pkl":  META_PATH,
    },
    "dataset": "NTHU-DDD" if not USE_SYNTHETIC else "Synthetic",
    "test_subjects": TEST_SUBJECTS if not USE_SYNTHETIC else [],
    "onnx_latency_ms": {"p50": round(p50, 1), "p95": round(p95, 1)},
}

with open(RESULTS_PATH, "w") as f:
    json.dump(final_results, f, indent=2)

print(f"\nAll results saved → {RESULTS_PATH}")
print("\n── Final Summary ──")
print(json.dumps(final_results, indent=2))


# ============================================================
# CELL 19 — Download Models (Colab convenience)
# ============================================================

try:
    from google.colab import files

    print("\nDownloading models…")
    files.download(ONNX_PATH)
    files.download(META_PATH)
    files.download(RESULTS_PATH)
    print("Download triggered for ONNX + PKL + JSON.")
    print("\nNext steps:")
    print("  1. Copy drowsy_mobilenetv2.onnx → backend/models/")
    print("  2. Copy meta_classifier.pkl     → backend/models/")
    print("  3. The FastAPI server loads both at startup.")
except ImportError:
    print("Not on Colab — copy files manually from:", OUTPUT_DIR)


# ============================================================
# CELL 20 — Quick Inference Sanity Check
# ============================================================

print("\n── Inference Sanity Check ──")

def predict_frame(frame_bgr: np.ndarray) -> Dict:
    """
    Run the full three-system inference on one frame.
    Returns the same JSON structure the FastAPI WS endpoint returns.
    """
    frame_bgr = preprocess(frame_bgr)
    feat      = extract_frame_features(frame_bgr)

    # System A
    perclos_score = 0.0   # no rolling buffer in single-frame mode
    score_a = system_a_score(
        feat.ear_score, perclos_score, feat.mar_score,
        feat.pose_score, feat.posture_score,
    )
    level_a = score_to_level(score_a)

    # System B (CNN)
    if feat.face_crop is not None:
        crop_in = feat.face_crop.astype(np.float32) / 255.0
    else:
        crop_in = np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.float32)
    crop_in   = np.expand_dims(crop_in, 0)
    cnn_probs = sess.run(None, {"input": crop_in})[0][0].tolist()
    level_b   = int(np.argmax(cnn_probs))

    # System C (meta-classifier)
    meta_feat = np.array([[
        score_a, float(level_a),
        feat.ear_score, perclos_score, feat.mar_score,
        feat.pose_score, feat.posture_score,
        *cnn_probs,
    ]], dtype=np.float32)
    meta_feat_scaled = scaler.transform(meta_feat)
    level_c = int(xgb_meta.predict(meta_feat_scaled)[0])

    return {
        "ear":              round(feat.ear, 4),
        "mar":              round(feat.mar, 4),
        "pitch":            round(feat.pitch, 2),
        "yaw":              round(feat.yaw, 2),
        "roll":             round(feat.roll, 2),
        "ear_score":        round(feat.ear_score, 4),
        "perclos_score":    round(perclos_score, 4),
        "mar_score":        round(feat.mar_score, 4),
        "pose_score":       round(feat.pose_score, 4),
        "posture_score":    round(feat.posture_score, 4),
        "composite_score":  round(score_a, 4),
        "alert_level_A":    level_a,
        "alert_level_B":    level_b,
        "alert_level_C":    level_c,
        "alert_level":      level_a,   # production default
        "alert_label":      CLASS_NAMES[level_a],
        "cnn_probs":        [round(p, 4) for p in cnn_probs],
        "face_detected":    feat.face_detected,
    }


# Test on a blank frame
test_frame = np.ones((480, 640, 3), dtype=np.uint8) * 100
result     = predict_frame(test_frame)

print("Sample inference result:")
for k, v in result.items():
    if k != "cnn_probs":
        print(f"  {k:<22}: {v}")
print(f"  {'cnn_probs':<22}: {result['cnn_probs']}")
print("\nAll systems operational.")
