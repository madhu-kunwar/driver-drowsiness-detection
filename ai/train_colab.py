"""
DrowsyShield — Google Colab Training Script (DMD Dataset Edition)
=================================================================
Dataset: DMD — Driver Monitoring Dataset (Vicomtech)
         https://opendatasets.vicomtech.org/di21-dmd-dataset-distraction-rgb-ir/

Trains three detection systems:
  System A — Rule-based weighted fusion (EAR/PERCLOS/MAR/HeadPose/Posture)
             No training needed — evaluated analytically on DMD test frames.
  System B — Fine-tuned MobileNetV2 (4-class alert level classifier)
             Input: 112×112 RGB face crop  |  Output: [Alert, Mild, Warning, Critical]
  System C — XGBoost meta-classifier stacked over A + B outputs

Then runs the ablation study.

Usage:
  1. Runtime → Change runtime type → GPU (T4)
  2. Upload DMD dataset to Google Drive (see SETUP.md)
  3. Edit CELL 2 paths to match your Drive
  4. Runtime → Run all
"""

# ============================================================
# CELL 1 — Install Dependencies
# ============================================================

import subprocess, sys

def pip(*pkgs):
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", *pkgs])

pip(
    # Pinned: mediapipe >= 0.10.15 (and 1.0.0) removed the legacy mp.solutions
    # API this script relies on (face_mesh / pose / face_detection). 0.10.14 is
    # the last version with it, and matches the runtime server (ai/requirements).
    "mediapipe==0.10.14",
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
# CELL 2 — Configuration  ← EDIT THESE BEFORE RUNNING
# ============================================================

import os

# ── Set to True only to smoke-test without any dataset ───────
USE_SYNTHETIC = False

# ── Root folder of DMD on your Google Drive ──────────────────
# After unzipping the download, your Drive should look like:
#   MyDrive/DrowsyShield/DMD/gA/s1/rgb_face/video.mp4
#                              s1/ann/gA_s1_ann_distraction.json
#                            s2/...
#                        gB/s1/...
DMD_ROOT = "/content/drive/MyDrive/DrowsyShield/DMD"

# ── Output folder (created automatically) ────────────────────
OUTPUT_DIR = "/content/drive/MyDrive/DrowsyShield/models"

# ── Camera stream to use — rgb_face is the face-view video ───
# Options inside each subject folder: rgb_face / rgb_body / ir_face
CAMERA_STREAM = "rgb_face"

# ── Train / Val / Test split by group name ───────────────────
# DMD has groups gA, gB, gC ... list which go where.
# If you only have gA and gB, a common split is below.
TRAIN_GROUPS = ["gA"]
VAL_GROUPS   = ["gB"]
TEST_GROUPS  = ["gC"]   # change to ["gB"] if you only have gA + gB

# ── Subject-level max frames per session (memory control) ─────
MAX_FRAMES_PER_SESSION = 1500

# ── Training hyper-parameters ────────────────────────────────
BATCH_SIZE  = 32
EPOCHS      = 50
LR_BACKBONE = 1e-4
LR_HEAD     = 1e-3
PATIENCE    = 8
FRAME_SKIP  = 3    # sample every 3rd frame → ~10 fps from 30 fps
IMG_SIZE    = 112  # MobileNetV2 input

# ── Derived paths ─────────────────────────────────────────────
os.makedirs(OUTPUT_DIR, exist_ok=True)
MODEL_H5_PATH = os.path.join(OUTPUT_DIR, "drowsy_mobilenetv2.h5")
ONNX_PATH     = os.path.join(OUTPUT_DIR, "drowsy_mobilenetv2.onnx")
META_PATH     = os.path.join(OUTPUT_DIR, "meta_classifier.pkl")
RESULTS_PATH  = os.path.join(OUTPUT_DIR, "ablation_results.json")

print(f"DMD root   : {DMD_ROOT}")
print(f"Output dir : {OUTPUT_DIR}")
print(f"Synthetic  : {USE_SYNTHETIC}")


# ============================================================
# CELL 3 — Mount Google Drive
# ============================================================

try:
    from google.colab import drive
    drive.mount("/content/drive", force_remount=False)
    print("Drive mounted.")
except ImportError:
    print("Not on Colab — skipping drive mount.")
    USE_SYNTHETIC = True


# ============================================================
# CELL 4 — Imports
# ============================================================

import cv2
import json
import pickle
import time
import warnings
from pathlib import Path
from collections import deque
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np
import mediapipe as mp
from tqdm import tqdm
import matplotlib.pyplot as plt
import seaborn as sns

import sklearn
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, classification_report,
    confusion_matrix, f1_score, precision_score, recall_score,
)
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler

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

mp_face_mesh   = mp.solutions.face_mesh
mp_face_detect = mp.solutions.face_detection
mp_pose        = mp.solutions.pose

face_mesh = mp_face_mesh.FaceMesh(
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
# CELL 6 — DMD Label Mapping → DrowsyShield 4 Alert Levels
# ============================================================
#
# DMD action types (strings from the JSON "type" field):
#
#  Distraction actions:
#   safe_drive              → 0  fully attentive, no distraction
#   radio                   → 1  brief eyes-down glance
#   reach_side              → 1  arm reaching, momentary
#   talking_to_passenger    → 1  head turned, conversing
#   hair_and_makeup         → 1  grooming — eyes briefly off road
#   drinking                → 2  sustained eyes-off + one hand off wheel
#   eating                  → 2  sustained eyes-off + manual
#   phone_call_right        → 2  phone to ear — cognitive + visual
#   phone_call_left         → 2  phone to ear — cognitive + visual
#   texting                 → 3  visual + manual + cognitive simultaneously
#   read_write              → 3  prolonged eyes-off road
#
#  Drowsiness actions (present if you have the full DMD):
#   alert                   → 0
#   yawning                 → 1
#   drowsy                  → 2
#   microsleep              → 3
#   microsleep_eyes_open    → 3
#
# Any unknown label defaults to 0 (conservative — do not falsely alarm).

DMD_LABEL_MAP: Dict[str, int] = {
    # ── safe / attentive ────────────────────────────────────
    "safe_drive":               0,
    "alert":                    0,
    "attentive":                0,
    # ── mild (Level 1) ──────────────────────────────────────
    "radio":                    1,
    "reach_side":               1,
    "talking_to_passenger":     1,
    "hair_and_makeup":          1,
    "drinking":                 1,
    "eating":                   1,
    "yawning":                  1,
    # ── warning (Level 2) ───────────────────────────────────
    "phone_call_right":         2,
    "phone_call_left":          2,
    "GPS":                      2,
    "drowsy":                   2,
    # ── critical (Level 3) ──────────────────────────────────
    "texting":                  3,
    "read_write":               3,
    "microsleep":               3,
    "microsleep_eyes_open":     3,
}

CLASS_NAMES = ["Alert", "Mild", "Warning", "Critical"]

def map_dmd_label(action_type: str) -> int:
    return DMD_LABEL_MAP.get(action_type.strip().lower(), 0)


# ============================================================
# CELL 7 — Preprocessing Utilities
# ============================================================

def normalise_brightness(frame_bgr: np.ndarray) -> np.ndarray:
    """CLAHE in LAB space when frame mean pixel < 60 (low-light)."""
    if frame_bgr.mean() < 60:
        lab       = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2LAB)
        l, a, b   = cv2.split(lab)
        clahe     = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        l         = clahe.apply(l)
        frame_bgr = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    return frame_bgr


def preprocess(frame_bgr: np.ndarray, target: Tuple[int,int] = (640, 480)) -> np.ndarray:
    h, w = frame_bgr.shape[:2]
    if (w, h) != target:
        frame_bgr = cv2.resize(frame_bgr, target, interpolation=cv2.INTER_AREA)
    return normalise_brightness(frame_bgr)


def extract_face_crop(frame_bgr: np.ndarray, pad: float = 0.15) -> Optional[np.ndarray]:
    h, w = frame_bgr.shape[:2]
    rgb  = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    res  = face_detector.process(rgb)
    if not res.detections:
        return None
    best = max(
        res.detections,
        key=lambda d: d.location_data.relative_bounding_box.width
                    * d.location_data.relative_bounding_box.height,
    )
    bb = best.location_data.relative_bounding_box
    x1 = max(0, int((bb.xmin - pad) * w))
    y1 = max(0, int((bb.ymin - pad) * h))
    x2 = min(w, int((bb.xmin + bb.width  + pad) * w))
    y2 = min(h, int((bb.ymin + bb.height + pad) * h))
    crop = frame_bgr[y1:y2, x1:x2]
    if crop.size == 0:
        return None
    crop = cv2.resize(crop, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)


# ============================================================
# CELL 8 — System A Signal Extraction
# ============================================================

LEFT_EYE  = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33,  160, 158, 133, 153, 144]
OUTER_LIP = [78,  82,  87,  13, 312, 317, 402, 308]
POSE_IDX  = [4, 152, 33, 263, 61, 291]

# Y-down / Z-forward to match image pixel coords (a frontal face → ~(0,0,0)).
# A Y-up model makes solvePnP return a 180°-flipped rotation, so pitch reads
# ~178° for a straight head. Must match ai/detection/signals/head_pose.py so
# trained features equal runtime features.
MODEL_3D = np.array([
    ( 0.0,   0.0,   0.0),
    ( 0.0,  63.6,  12.5),
    (-43.3, -32.7, 26.0),
    ( 43.3, -32.7, 26.0),
    (-28.9,  28.9, 24.1),
    ( 28.9,  28.9, 24.1),
], dtype=np.float64)

EAR_THRESHOLD = 0.21


def _d(a, b): return float(np.linalg.norm(a - b))


def compute_ear(lm) -> float:
    def _ear(idx):
        p = [np.array([lm[i].x, lm[i].y]) for i in idx]
        return (_d(p[1],p[5]) + _d(p[2],p[4])) / (2.0 * _d(p[0],p[3]) + 1e-6)
    return (_ear(LEFT_EYE) + _ear(RIGHT_EYE)) / 2.0


def compute_mar(lm) -> float:
    # Numerator terms MUST pair vertically aligned upper/lower lip points, not
    # lip-to-corner diagonals (the old bug made a closed mouth read MAR ~0.88).
    p = [np.array([lm[i].x, lm[i].y]) for i in OUTER_LIP]
    return (_d(p[1],p[2]) + _d(p[4],p[5]) + _d(p[3],p[6])) / (2.0 * _d(p[0],p[7]) + 1e-6)


def _unwrap(a: float) -> float:
    return a - 180 if a > 90 else (a + 180 if a < -90 else a)


def compute_head_pose(lm, w: int, h: int) -> Tuple[float, float, float]:
    pts = np.array([(lm[i].x*w, lm[i].y*h) for i in POSE_IDX], dtype=np.float64)
    cam = np.array([[float(w),0,w/2],[0,float(w),h/2],[0,0,1]], dtype=np.float64)
    ok, rvec, _ = cv2.solvePnP(MODEL_3D, pts, cam, np.zeros((4,1)),
                                flags=cv2.SOLVEPNP_ITERATIVE)
    if not ok:
        return 0.0, 0.0, 0.0
    rmat, _ = cv2.Rodrigues(rvec)
    angles, *_ = cv2.RQDecomp3x3(rmat)
    return _unwrap(angles[0]), _unwrap(angles[1]), _unwrap(angles[2])


def norm_ear(ear: float) -> float:
    # Shut eyes bottom out around EAR 0.10-0.15, never 0, so normalise between
    # the threshold and a realistic closed level (55% of threshold) → 1.0 shut.
    closed = EAR_THRESHOLD * 0.55
    return float(np.clip((EAR_THRESHOLD - ear) / (EAR_THRESHOLD - closed + 1e-6), 0.0, 1.0))

def norm_mar(mar: float) -> float:
    return float(np.clip((mar - 0.30) / 0.60, 0.0, 1.0))

def norm_pose(pitch, yaw, roll) -> float:
    return float(min(1.0, max(abs(pitch)/30.0, abs(yaw)/35.0, abs(roll)/20.0)))


@dataclass
class FrameFeatures:
    ear: float = 0.0
    mar: float = 0.0
    pitch: float = 0.0
    yaw: float = 0.0
    roll: float = 0.0
    ear_score: float = 0.0
    mar_score: float = 0.0
    pose_score: float = 0.0
    posture_score: float = 0.0
    face_crop: Optional[np.ndarray] = None
    face_detected: bool = False


def extract_frame_features(frame_bgr: np.ndarray) -> FrameFeatures:
    feat = FrameFeatures()
    h, w = frame_bgr.shape[:2]
    rgb  = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

    feat.face_crop = extract_face_crop(frame_bgr)

    fm = face_mesh.process(rgb)
    if fm.multi_face_landmarks:
        lm = fm.multi_face_landmarks[0].landmark
        feat.face_detected = True
        feat.ear       = compute_ear(lm)
        feat.mar       = compute_mar(lm)
        feat.ear_score = norm_ear(feat.ear)
        feat.mar_score = norm_mar(feat.mar)
        feat.pitch, feat.yaw, feat.roll = compute_head_pose(lm, w, h)
        feat.pose_score = norm_pose(feat.pitch, feat.yaw, feat.roll)

    pr = pose_detector.process(rgb)
    if pr.pose_landmarks and feat.face_detected:
        pl = pr.pose_landmarks.landmark
        sm = np.array([(pl[11].x+pl[12].x)/2, (pl[11].y+pl[12].y)/2])
        em = np.array([(pl[7].x +pl[8].x )/2, (pl[7].y +pl[8].y )/2])
        lean = np.linalg.norm(em - sm)
        tilt = np.arctan2(abs(pl[11].y-pl[12].y), abs(pl[11].x-pl[12].x)+1e-6)
        lean_dev = abs(lean - 0.30) / 0.15
        tilt_dev = abs(tilt - 0.05) / 0.35   # deviate from baseline tilt, matching runtime
        feat.posture_score = float(min(1.0, lean_dev*0.6 + tilt_dev*0.4))

    return feat


# ============================================================
# CELL 9 — System A Composite Score & Ablation Configs
# ============================================================

WEIGHTS_A = {"ear":0.30, "perclos":0.25, "mar":0.20, "pose":0.15, "posture":0.10}

ABLATION_CONFIGS = {
    "EAR only":         {"ear":1.00,"perclos":0.00,"mar":0.00,"pose":0.00,"posture":0.00},
    "EAR + PERCLOS":    {"ear":0.55,"perclos":0.45,"mar":0.00,"pose":0.00,"posture":0.00},
    "+ MAR":            {"ear":0.40,"perclos":0.33,"mar":0.27,"pose":0.00,"posture":0.00},
    "+ Head Pose":      {"ear":0.33,"perclos":0.28,"mar":0.22,"pose":0.17,"posture":0.00},
    "All 5 (System A)": WEIGHTS_A,
}


class PerclosBuffer:
    def __init__(self, fps=10.0, window_s=60.0):
        self._buf = deque(maxlen=max(int(fps*window_s), 1))
        self._thr = EAR_THRESHOLD          # eyes closed when EAR < threshold

    def update(self, ear: float) -> float:
        self._buf.append(1 if ear < self._thr else 0)
        return (sum(self._buf) / len(self._buf)) * 100.0 if self._buf else 0.0

    def reset(self):
        self._buf.clear()


def system_a_score(ear_s, perclos_s, mar_s, pose_s, posture_s,
                   weights=WEIGHTS_A) -> float:
    raw = (ear_s*weights["ear"] + perclos_s*weights["perclos"] +
           mar_s*weights["mar"] + pose_s*weights["pose"] +
           posture_s*weights["posture"])
    return float(np.clip(raw, 0.0, 1.0))


def score_to_level(score: float) -> int:
    if score < 0.25: return 0
    if score < 0.50: return 1
    if score < 0.75: return 2
    return 3


# ============================================================
# CELL 10 — DMD Dataset Loading
# ============================================================
#
# Expected DMD folder layout on Drive:
#
#   DMD/
#   ├── gA/
#   │   ├── s1/
#   │   │   ├── rgb_face/
#   │   │   │   └── video.mp4          ← face video
#   │   │   └── ann/
#   │   │       └── *_ann_*.json       ← OpenLABEL annotation
#   │   ├── s2/
#   │   └── ...
#   ├── gB/
#   └── gC/
#
# The annotation JSON uses OpenLABEL "actions" with frame_intervals:
#
#   {
#     "openlabel": {
#       "actions": {
#         "0": {
#           "name":  "driver_actions_lr",
#           "type":  "safe_drive",
#           "frame_intervals": [{"frame_start": 0, "frame_end": 899}]
#         },
#         "1": {
#           "name":  "driver_actions_lr",
#           "type":  "texting",
#           "frame_intervals": [{"frame_start": 900, "frame_end": 1350}]
#         }
#       }
#     }
#   }

def parse_openlabel_json(json_path: Path) -> Optional[np.ndarray]:
    """
    Read a DMD OpenLABEL JSON and return a dense per-frame label array.
    Each frame index maps to a DrowsyShield alert level (0–3).
    Returns None if the file cannot be parsed.
    """
    try:
        with json_path.open() as f:
            data = json.load(f)
    except Exception as e:
        print(f"  [warn] Cannot read {json_path.name}: {e}")
        return None

    # Navigate to actions — handle both flat and nested openlabel keys
    ol = data.get("openlabel", data)
    actions = ol.get("actions", {})

    if not actions:
        print(f"  [warn] No actions found in {json_path.name}")
        return None

    # Find the maximum frame index across all actions
    max_frame = 0
    for action in actions.values():
        for fi in action.get("frame_intervals", []):
            max_frame = max(max_frame, fi.get("frame_end", 0))

    if max_frame == 0:
        return None

    labels = np.zeros(max_frame + 1, dtype=np.int32)  # default 0 = Alert

    for action in actions.values():
        action_type = action.get("type", "safe_drive")
        level       = map_dmd_label(action_type)
        for fi in action.get("frame_intervals", []):
            start = fi.get("frame_start", 0)
            end   = fi.get("frame_end",   0)
            labels[start:end + 1] = level

    return labels


def find_dmd_sessions(dmd_root: str, groups: List[str],
                      camera: str = CAMERA_STREAM) -> List[Tuple[Path, Path, str]]:
    """
    Walk DMD folder tree and return list of (video_path, ann_json_path, session_id).
    session_id = "gA_s1" style string for logging.
    """
    root     = Path(dmd_root)
    sessions = []

    for group in groups:
        group_dir = root / group
        if not group_dir.exists():
            print(f"  [warn] Group folder not found: {group_dir}")
            continue

        for subj_dir in sorted(group_dir.iterdir()):
            if not subj_dir.is_dir():
                continue

            # Find video
            cam_dir  = subj_dir / camera
            video    = None
            if cam_dir.exists():
                for ext in ("*.mp4", "*.avi", "*.MP4", "*.AVI"):
                    vids = list(cam_dir.glob(ext))
                    if vids:
                        video = vids[0]
                        break

            if video is None:
                # Try video directly in subject folder
                for ext in ("*.mp4", "*.avi"):
                    vids = list(subj_dir.glob(f"*{camera}*" + ext[1:]))
                    if vids:
                        video = vids[0]
                        break

            if video is None:
                print(f"  [warn] No video for {group}/{subj_dir.name}/{camera}")
                continue

            # Find annotation JSON
            ann_dir = subj_dir / "ann"
            ann_json = None
            if ann_dir.exists():
                jsons = list(ann_dir.glob("*.json"))
                if jsons:
                    ann_json = jsons[0]

            # Also try annotation in subject folder directly
            if ann_json is None:
                jsons = list(subj_dir.glob("*.json"))
                if jsons:
                    ann_json = jsons[0]

            if ann_json is None:
                print(f"  [warn] No annotation JSON for {group}/{subj_dir.name} — skipping")
                continue

            session_id = f"{group}_{subj_dir.name}"
            sessions.append((video, ann_json, session_id))

    print(f"Found {len(sessions)} annotated sessions in groups: {groups}")
    return sessions


def extract_frames_from_session(
    video_path: Path,
    labels: np.ndarray,
    frame_skip: int = FRAME_SKIP,
    max_frames: int = MAX_FRAMES_PER_SESSION,
) -> List[Tuple[np.ndarray, int]]:
    """
    Yield (preprocessed_frame_bgr, alert_level) from one DMD session video.
    """
    cap    = cv2.VideoCapture(str(video_path))
    result = []
    idx    = 0

    while len(result) < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % frame_skip == 0:
            frame = preprocess(frame)
            label = int(labels[idx]) if idx < len(labels) else 0
            result.append((frame, label))
        idx += 1

    cap.release()
    return result


# ── Synthetic fallback ───────────────────────────────────────

def make_synthetic_dataset(n: int = 200) -> List[Tuple[np.ndarray, int]]:
    data = []
    for label in [0, 1, 2, 3]:
        for _ in range(n):
            brightness = np.random.randint(30, 200)
            frame = np.full((480, 640, 3), brightness, dtype=np.uint8)
            noise = np.random.randint(0, 40, (480, 640, 3), dtype=np.uint8)
            frame = np.clip(frame.astype(np.int32) + noise, 0, 255).astype(np.uint8)
            data.append((frame, label))
    np.random.shuffle(data)
    return data


# ============================================================
# CELL 11 — Feature Extraction Loop
# ============================================================

@dataclass
class Sample:
    ear_score:     float
    perclos_score: float
    mar_score:     float
    pose_score:    float
    posture_score: float
    face_crop:     Optional[np.ndarray]
    label:         int


def build_dataset(sessions: List[Tuple[Path, Path, str]]) -> List[Sample]:
    samples: List[Sample] = []

    for video_path, ann_path, session_id in tqdm(sessions, desc="Extracting features"):
        labels = parse_openlabel_json(ann_path)
        if labels is None:
            print(f"  [skip] {session_id} — could not parse labels")
            continue

        frames      = extract_frames_from_session(video_path, labels)
        perclos_buf = PerclosBuffer()

        for frame_bgr, label in frames:
            feat          = extract_frame_features(frame_bgr)
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

    counts = {c: sum(1 for s in samples if s.label == c) for c in range(4)}
    print(f"  → {len(samples)} samples | distribution: {counts}")
    return samples


def build_synthetic(n: int = 200) -> List[Sample]:
    frames      = make_synthetic_dataset(n)
    perclos_buf = PerclosBuffer()
    out         = []
    for frame_bgr, label in tqdm(frames, desc="Synthetic features"):
        feat = extract_frame_features(frame_bgr)
        perc = perclos_buf.update(feat.ear)
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


# ── Load data ────────────────────────────────────────────────

if USE_SYNTHETIC:
    print("SYNTHETIC mode — pipeline smoke test only.")
    train_samples = build_synthetic(300)
    val_samples   = build_synthetic(100)
    test_samples  = build_synthetic(100)
else:
    train_sessions = find_dmd_sessions(DMD_ROOT, TRAIN_GROUPS)
    val_sessions   = find_dmd_sessions(DMD_ROOT, VAL_GROUPS)
    test_sessions  = find_dmd_sessions(DMD_ROOT, TEST_GROUPS)

    print("\nExtracting TRAIN …")
    train_samples = build_dataset(train_sessions)
    print("Extracting VAL …")
    val_samples   = build_dataset(val_sessions)
    print("Extracting TEST …")
    test_samples  = build_dataset(test_sessions)

print(f"\nReady — Train:{len(train_samples)}  Val:{len(val_samples)}  Test:{len(test_samples)}")


# ============================================================
# CELL 12 — System A Ablation Study
# ============================================================

def evaluate_system_a(samples: List[Sample], weights: Dict) -> Dict:
    y_true, y_pred = [], []
    for s in samples:
        score = system_a_score(s.ear_score, s.perclos_score, s.mar_score,
                               s.pose_score, s.posture_score, weights=weights)
        y_true.append(s.label)
        y_pred.append(score_to_level(score))
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    return {
        "accuracy":  accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, average="macro", zero_division=0),
        "recall":    recall_score(y_true, y_pred, average="macro", zero_division=0),
        "f1":        f1_score(y_true, y_pred, average="macro", zero_division=0),
    }


print("\n" + "="*60)
print("ABLATION STUDY — System A (Rule-Based Fusion)")
print("="*60)

ablation_results = {}
for cfg_name, w in ABLATION_CONFIGS.items():
    res = evaluate_system_a(test_samples, w)
    ablation_results[cfg_name] = res
    print(f"  {cfg_name:<25}  Acc={res['accuracy']:.1%}  "
          f"P={res['precision']:.1%}  R={res['recall']:.1%}  F1={res['f1']:.1%}")

# Plot
names    = list(ABLATION_CONFIGS.keys())
acc_vals = [ablation_results[k]["accuracy"] * 100 for k in names]

fig, ax = plt.subplots(figsize=(10, 4))
bars = ax.barh(names, acc_vals, color="#10B981", edgecolor="#059669")
ax.set_xlabel("Accuracy (%)")
ax.set_title("System A — Ablation Study (DMD Test Set)")
ax.set_xlim(50, 100)
for bar, val in zip(bars, acc_vals):
    ax.text(val + 0.3, bar.get_y() + bar.get_height()/2,
            f"{val:.1f}%", va="center", fontsize=9)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "ablation_study.png"), dpi=150)
plt.show()


# ============================================================
# CELL 13 — System B: MobileNetV2 Training
# ============================================================

import tensorflow as tf
from tensorflow.keras import callbacks, layers, optimizers
from tensorflow.keras.applications import MobileNetV2

print(f"\nTensorFlow : {tf.__version__}")
print(f"GPU        : {tf.config.list_physical_devices('GPU')}")


def to_arrays(samples: List[Sample]) -> Tuple[np.ndarray, np.ndarray]:
    X = np.stack([
        (s.face_crop if s.face_crop is not None
         else np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8))
        for s in samples
    ]).astype(np.float32) / 255.0
    y = np.array([s.label for s in samples], dtype=np.int32)
    return X, y


print("Building CNN arrays …")
X_train, y_train = to_arrays(train_samples)
X_val,   y_val   = to_arrays(val_samples)
X_test,  y_test  = to_arrays(test_samples)
print(f"Train:{X_train.shape}  Val:{X_val.shape}  Test:{X_test.shape}")

from sklearn.utils.class_weight import compute_class_weight
classes      = np.unique(y_train)
cw_arr       = compute_class_weight("balanced", classes=classes, y=y_train)
class_weight = {int(c): float(w) for c, w in zip(classes, cw_arr)}
print(f"Class weights: {class_weight}")


def build_model(num_classes: int = 4) -> tf.keras.Model:
    base = MobileNetV2(input_shape=(IMG_SIZE, IMG_SIZE, 3),
                       include_top=False, weights="imagenet")
    base.trainable = False
    inp     = tf.keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x       = base(inp, training=False)
    x       = layers.GlobalAveragePooling2D()(x)
    x       = layers.Dense(128, activation="relu")(x)
    x       = layers.Dropout(0.3)(x)
    out     = layers.Dense(num_classes, activation="softmax")(x)
    return tf.keras.Model(inp, out, name="DrowsyMobileNetV2")


model = build_model()
model.summary(line_length=80)

aug = tf.keras.Sequential([
    layers.RandomFlip("horizontal"),
    layers.RandomRotation(0.10),
    layers.RandomZoom(0.10),
    layers.RandomBrightness(0.30),
    layers.GaussianNoise(0.02),
], name="augmentation")


def make_ds(X, y, shuffle=True, augment=False):
    ds = tf.data.Dataset.from_tensor_slices((X, y))
    if shuffle:
        ds = ds.shuffle(len(X), reshuffle_each_iteration=True)
    if augment:
        ds = ds.map(lambda x, y: (aug(x, training=True), y),
                    num_parallel_calls=tf.data.AUTOTUNE)
    return ds.batch(BATCH_SIZE).prefetch(tf.data.AUTOTUNE)


train_ds = make_ds(X_train, y_train, augment=True)
val_ds   = make_ds(X_val,   y_val,   shuffle=False)
test_ds  = make_ds(X_test,  y_test,  shuffle=False)

cb_es   = callbacks.EarlyStopping(monitor="val_loss", patience=PATIENCE,
                                   restore_best_weights=True)
cb_lr   = callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5,
                                       patience=3, min_lr=1e-6)
cb_ckpt = callbacks.ModelCheckpoint(MODEL_H5_PATH, monitor="val_loss",
                                     save_best_only=True, verbose=1)

# ── Phase 1: head only ───────────────────────────────────────
model.compile(optimizer=optimizers.Adam(LR_HEAD),
              loss="sparse_categorical_crossentropy", metrics=["accuracy"])
print("\n── Phase 1: head only (backbone frozen) ──")
hist1 = model.fit(train_ds, validation_data=val_ds,
                  epochs=min(EPOCHS, 20),
                  callbacks=[cb_es, cb_lr, cb_ckpt],
                  class_weight=class_weight, verbose=2)

# ── Phase 2: unfreeze last 30 layers of backbone ─────────────
base_layer = model.layers[1]
base_layer.trainable = True
for layer in base_layer.layers[:-30]:
    layer.trainable = False

model.compile(optimizer=optimizers.Adam(LR_BACKBONE),
              loss="sparse_categorical_crossentropy", metrics=["accuracy"])
print("\n── Phase 2: fine-tuning last 3 blocks ──")
hist2 = model.fit(train_ds, validation_data=val_ds,
                  epochs=EPOCHS, initial_epoch=len(hist1.epoch),
                  callbacks=[cb_es, cb_lr, cb_ckpt],
                  class_weight=class_weight, verbose=2)

# ── Evaluate ─────────────────────────────────────────────────
model.load_weights(MODEL_H5_PATH)
loss_b, acc_b = model.evaluate(test_ds, verbose=0)
print(f"\nSystem B — Test Accuracy: {acc_b:.1%}  Loss: {loss_b:.4f}")
y_pred_b = np.argmax(model.predict(test_ds, verbose=0), axis=1)
print(classification_report(y_test[:len(y_pred_b)], y_pred_b,
                             target_names=CLASS_NAMES, zero_division=0))

# ── Training curves ──────────────────────────────────────────
all_acc  = hist1.history["accuracy"]     + hist2.history["accuracy"]
all_vacc = hist1.history["val_accuracy"] + hist2.history["val_accuracy"]
all_loss = hist1.history["loss"]         + hist2.history["loss"]
all_vloss= hist1.history["val_loss"]     + hist2.history["val_loss"]

plt.figure(figsize=(10, 4))
plt.subplot(1,2,1)
plt.plot(all_acc, color="#10B981", label="Train")
plt.plot(all_vacc, color="#F97316", label="Val")
plt.axhline(0.88, color="gray", ls="--", label="Target 88%")
plt.title("System B — Accuracy"); plt.legend()
plt.subplot(1,2,2)
plt.plot(all_loss, color="#10B981", label="Train")
plt.plot(all_vloss, color="#F97316", label="Val")
plt.title("System B — Loss"); plt.legend()
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "training_curves.png"), dpi=150)
plt.show()


# ============================================================
# CELL 14 — Export to ONNX
# ============================================================

import tf2onnx
import onnxruntime as ort

print("\nExporting to ONNX …")
sig  = [tf.TensorSpec([None, IMG_SIZE, IMG_SIZE, 3], tf.float32, name="input")]
tf2onnx.convert.from_keras(model, input_signature=sig, opset=13,
                            output_path=ONNX_PATH)

sess  = ort.InferenceSession(ONNX_PATH, providers=["CPUExecutionProvider"])
dummy = np.random.rand(1, IMG_SIZE, IMG_SIZE, 3).astype(np.float32)
out   = sess.run(None, {"input": dummy})[0]
print(f"ONNX output shape: {out.shape}  (should be (1, 4))")

times = []
for _ in range(50):
    t0 = time.perf_counter()
    sess.run(None, {"input": dummy})
    times.append((time.perf_counter() - t0) * 1000)
p50 = np.percentile(times, 50)
p95 = np.percentile(times, 95)
print(f"Latency — p50:{p50:.1f}ms  p95:{p95:.1f}ms  (target <12ms)")
print(f"Size    — {os.path.getsize(ONNX_PATH)/1e6:.1f} MB  (target <15 MB)")
print(f"Saved → {ONNX_PATH}")


# ============================================================
# CELL 15 — Build 11-Feature Vector for System C
# ============================================================

FEATURE_NAMES = [
    "composite_A","level_A","ear","perclos","mar","pose","posture",
    "cnn_p_alert","cnn_p_mild","cnn_p_warning","cnn_p_critical",
]


def build_meta_features(samples: List[Sample],
                        ort_sess: ort.InferenceSession,
                        batch: int = 64) -> Tuple[np.ndarray, np.ndarray]:
    crops = [
        (s.face_crop.astype(np.float32)/255.0
         if s.face_crop is not None
         else np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.float32))
        for s in samples
    ]
    cnn_probs = []
    for i in range(0, len(crops), batch):
        b     = np.stack(crops[i:i+batch])
        probs = ort_sess.run(None, {"input": b})[0]
        cnn_probs.extend(probs.tolist())

    X_meta, y_meta = [], []
    for idx, s in enumerate(samples):
        sa = system_a_score(s.ear_score, s.perclos_score, s.mar_score,
                            s.pose_score, s.posture_score)
        la = score_to_level(sa)
        p0, p1, p2, p3 = cnn_probs[idx]
        X_meta.append([sa, float(la), s.ear_score, s.perclos_score,
                        s.mar_score, s.pose_score, s.posture_score,
                        p0, p1, p2, p3])
        y_meta.append(s.label)

    return (np.array(X_meta, dtype=np.float32),
            np.array(y_meta,  dtype=np.int32))


print("Building meta-features …")
X_tr_m, y_tr_m = build_meta_features(train_samples, sess)
X_va_m, y_va_m = build_meta_features(val_samples,   sess)
X_te_m, y_te_m = build_meta_features(test_samples,  sess)
print(f"Train:{X_tr_m.shape}  Val:{X_va_m.shape}  Test:{X_te_m.shape}")


# ============================================================
# CELL 16 — System C: XGBoost Meta-Classifier
# ============================================================

scaler  = StandardScaler()
X_tr_sc = scaler.fit_transform(X_tr_m)
X_va_sc = scaler.transform(X_va_m)
X_te_sc = scaler.transform(X_te_m)

# Logistic Regression baseline
lr_meta = LogisticRegression(max_iter=1000, C=1.0,
                              class_weight="balanced", random_state=42)
lr_meta.fit(X_tr_sc, y_tr_m)
print(f"System C (LogReg) — Test Acc: {accuracy_score(y_te_m, lr_meta.predict(X_te_sc)):.1%}")

# XGBoost (primary)
xgb_meta = xgb.XGBClassifier(
    objective="multi:softprob", num_class=4,
    max_depth=4, n_estimators=200, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8,
    use_label_encoder=False, eval_metric="mlogloss",
    random_state=42, n_jobs=-1,
)
xgb_meta.fit(X_tr_sc, y_tr_m,
             eval_set=[(X_va_sc, y_va_m)],
             early_stopping_rounds=15, verbose=False)

y_pred_c = xgb_meta.predict(X_te_sc)
acc_c    = accuracy_score(y_te_m, y_pred_c)
print(f"System C (XGBoost) — Test Acc: {acc_c:.1%}")
print(classification_report(y_te_m, y_pred_c,
                             target_names=CLASS_NAMES, zero_division=0))

# Feature importance plot
fi  = xgb_meta.feature_importances_
idx = np.argsort(fi)[::-1]
plt.figure(figsize=(8, 4))
plt.bar(range(len(fi)), fi[idx], color="#10B981")
plt.xticks(range(len(fi)), [FEATURE_NAMES[i] for i in idx], rotation=45, ha="right")
plt.title("System C — XGBoost Feature Importances")
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "feature_importance.png"), dpi=150)
plt.show()

with open(META_PATH, "wb") as f:
    pickle.dump({"scaler": scaler, "model": xgb_meta}, f)
print(f"Meta-classifier saved → {META_PATH}")


# ============================================================
# CELL 17 — Full System Comparison (A vs B vs C)
# ============================================================

def metrics(y_true, y_pred) -> Dict:
    return {
        "accuracy":  accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, average="macro", zero_division=0),
        "recall":    recall_score(y_true, y_pred, average="macro", zero_division=0),
        "f1":        f1_score(y_true, y_pred, average="macro", zero_division=0),
    }

y_pred_a = [score_to_level(system_a_score(
                s.ear_score, s.perclos_score, s.mar_score,
                s.pose_score, s.posture_score))
            for s in test_samples]

cnn_preds = np.argmax(
    sess.run(None, {"input": np.stack([
        (s.face_crop.astype(np.float32)/255.0
         if s.face_crop is not None
         else np.zeros((IMG_SIZE,IMG_SIZE,3), dtype=np.float32))
        for s in test_samples
    ])})[0], axis=1)

m_a = metrics(y_te_m, y_pred_a)
m_b = metrics(y_te_m, cnn_preds)
m_c = metrics(y_te_m, y_pred_c)

print("\n" + "="*62)
print("SYSTEM COMPARISON — DMD Test Set")
print("="*62)
print(f"{'System':<32} {'Acc':>6} {'Prec':>6} {'Rec':>6} {'F1':>6}")
print("-"*62)
for name, m in [("System A  Rule-Based Fusion", m_a),
                ("System B  MobileNetV2 (ONNX)", m_b),
                ("System C  Stacked Ensemble",   m_c)]:
    print(f"{name:<32} {m['accuracy']:>6.1%} {m['precision']:>6.1%} "
          f"{m['recall']:>6.1%} {m['f1']:>6.1%}")
print("="*62)

# Confusion matrices
fig, axes = plt.subplots(1, 3, figsize=(15, 4))
for ax, (name, preds) in zip(axes, [
    ("System A", y_pred_a), ("System B", cnn_preds), ("System C", y_pred_c)
]):
    cm = confusion_matrix(y_te_m, preds, labels=[0,1,2,3])
    sns.heatmap(cm, annot=True, fmt="d", cmap="Greens", ax=ax,
                xticklabels=CLASS_NAMES, yticklabels=CLASS_NAMES)
    ax.set_title(name); ax.set_xlabel("Predicted"); ax.set_ylabel("True")
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "confusion_matrices.png"), dpi=150)
plt.show()


# ============================================================
# CELL 18 — Save All Results to JSON
# ============================================================

final = {
    "dataset": "DMD-Vicomtech (distraction-rgb-ir)",
    "ablation": {k: {kk: round(vv*100,2) for kk,vv in v.items()}
                 for k,v in ablation_results.items()},
    "systems": {
        "A": {k: round(v*100,2) for k,v in m_a.items()},
        "B": {k: round(v*100,2) for k,v in m_b.items()},
        "C": {k: round(v*100,2) for k,v in m_c.items()},
    },
    "onnx_latency_ms": {"p50": round(p50,1), "p95": round(p95,1)},
    "train_groups": TRAIN_GROUPS,
    "val_groups":   VAL_GROUPS,
    "test_groups":  TEST_GROUPS,
}

with open(RESULTS_PATH, "w") as f:
    json.dump(final, f, indent=2)
print(f"Results saved → {RESULTS_PATH}")
print(json.dumps(final, indent=2))


# ============================================================
# CELL 19 — Download Models from Colab
# ============================================================

try:
    from google.colab import files
    files.download(ONNX_PATH)
    files.download(META_PATH)
    files.download(RESULTS_PATH)
    print("Downloads triggered.")
    print("\nNext steps:")
    print("  cp drowsy_mobilenetv2.onnx  finalyearproject/backend/models/")
    print("  cp meta_classifier.pkl      finalyearproject/backend/models/")
except ImportError:
    print(f"Copy manually from: {OUTPUT_DIR}")


# ============================================================
# CELL 20 — Single-Frame Inference Sanity Check
# ============================================================

print("\n── Sanity Check ──")

def predict_frame(frame_bgr: np.ndarray) -> Dict:
    frame_bgr = preprocess(frame_bgr)
    feat      = extract_frame_features(frame_bgr)

    sa = system_a_score(feat.ear_score, 0.0, feat.mar_score,
                        feat.pose_score, feat.posture_score)
    la = score_to_level(sa)

    crop_in = (feat.face_crop.astype(np.float32)/255.0
               if feat.face_crop is not None
               else np.zeros((IMG_SIZE,IMG_SIZE,3), dtype=np.float32))
    probs   = sess.run(None, {"input": crop_in[None]})[0][0].tolist()
    lb      = int(np.argmax(probs))

    mf = np.array([[sa, float(la), feat.ear_score, 0.0, feat.mar_score,
                    feat.pose_score, feat.posture_score, *probs]], dtype=np.float32)
    lc = int(xgb_meta.predict(scaler.transform(mf))[0])

    return {
        "ear": round(feat.ear, 4), "mar": round(feat.mar, 4),
        "pitch": round(feat.pitch,2), "yaw": round(feat.yaw,2),
        "composite_score": round(sa,4),
        "alert_level_A": la, "alert_level_B": lb, "alert_level_C": lc,
        "alert_level":   la,
        "alert_label":   CLASS_NAMES[la],
        "cnn_probs":     [round(p,4) for p in probs],
        "face_detected": feat.face_detected,
    }


result = predict_frame(np.ones((480,640,3), dtype=np.uint8)*120)
for k, v in result.items():
    print(f"  {k:<22}: {v}")
print("\nAll systems operational.")
