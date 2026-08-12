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
    # ── Dependency compatibility notes (Colab, Python 3.12) ───────────────
    # mediapipe 0.10.14 is the last version with the legacy mp.solutions API
    # (face_mesh / pose / face_detection) this script uses. It requires
    # protobuf 4.x. Colab's default TensorFlow 2.18 requires protobuf 5.26+,
    # which conflicts (ImportError: cannot import name 'runtime_version').
    # Fix: pin TensorFlow 2.17.x — it lives on protobuf 4.x, so mediapipe and
    # TF agree. numpy is pinned <2 for mediapipe 0.10.14 compatibility.
    # tf-keras + TF_USE_LEGACY_KERAS=1 (set in CELL 4) keep tf2onnx export
    # working under the Keras 3 default.
    "protobuf==4.25.8",
    "tensorflow==2.17.1",
    "tf-keras==2.17.0",
    "mediapipe==0.10.14",
    "numpy>=1.26.0,<2.0",
    "opencv-python-headless>=4.9.0",
    "scipy>=1.12.0",
    "scikit-learn>=1.4.0",
    "xgboost>=2.0.0",
    # onnx 1.17+ references ml_dtypes.float4_e2m1fn (needs ml_dtypes>=0.5),
    # but TF 2.17 pins ml_dtypes 0.4.x → AttributeError on `import tf2onnx`.
    # Pin onnx to the last 0.4-compatible release.
    "onnx==1.16.2",
    "onnxruntime>=1.17.0",
    "tf2onnx>=1.16.0",
    "matplotlib>=3.8.0",
    "seaborn>=0.13.0",
    "tqdm>=4.66.0",
    "Pillow>=10.0.0",
)

print("All packages installed.")

# The install above DOWNGRADED TensorFlow / numpy / protobuf. Downgraded C
# extensions only load cleanly in a FRESH process — otherwise you get
# "cannot import name 'runtime_version'" (protobuf) or "numpy.dtype size
# changed" (numpy) when the next cell imports mediapipe/TF. So force a
# ONE-TIME automatic kernel restart. A flag file prevents a restart loop:
# after the auto-restart this block is skipped and the script runs straight
# through — you just re-run the script once.
import os as _os
_DEPS_FLAG = "/content/.drowsyshield_deps_ready"
if not _os.path.exists(_DEPS_FLAG):
    open(_DEPS_FLAG, "w").close()
    print("\n" + ">" * 64)
    print(">>> Dependencies installed. Auto-restarting the runtime so they load")
    print(">>> cleanly. THIS IS EXPECTED — not a crash. When it reconnects,")
    print(">>> just run this script again; it will continue past this point.")
    print(">" * 64)
    _os.kill(_os.getpid(), 9)   # force Colab to restart the kernel
else:
    print("Dependencies already active in a fresh runtime — continuing.")


# ============================================================
# CELL 2 — Configuration  ← EDIT THESE BEFORE RUNNING
# ============================================================

import os

# ── Set to True only to smoke-test without any dataset ───────
USE_SYNTHETIC = False

# ── Root folder of DMD on your Google Drive ──────────────────
# Your Drive must have the groups side by side under one folder, e.g.:
#   MyDrive/drowsiness/dmd/gA/1/s1/gA_1_s1_<ts>_rgb_face.mp4
#                         gA/1/s1/gA_1_s1_<ts>_rgb_ann_distraction.json
#                         gB/6/s1/...
#                         gC/13/s1/...
# (consolidate the dmd / dmd 2 / dmd 3 folders into one `dmd` first)
DMD_ROOT = "/content/drive/MyDrive/drowsiness/dmd"

# ── Output folder (created automatically) ────────────────────
OUTPUT_DIR = "/content/drive/MyDrive/drowsiness/models"

# ── Camera stream to use — rgb_face is the face-view video ───
# Options inside each subject folder: rgb_face / rgb_body / ir_face
CAMERA_STREAM = "rgb_face"

# ── Train / Val / Test split by group name ───────────────────
# Split is SUBJECT-INDEPENDENT: no driver appears in more than one split.
# Each group folder holds 2 subjects (dmd/gA/<s1>, dmd/gA/<s2>, …) and they're
# all picked up automatically → 2 drivers per split, 6 total.
TRAIN_GROUPS = ["gA"]   # 2 subjects
VAL_GROUPS   = ["gB"]   # 2 subjects
TEST_GROUPS  = ["gC"]   # 2 subjects

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
    # Idempotent: if Drive is already mounted (e.g. you ran a verify cell that
    # called drive.mount), skip re-mounting. Mounting twice raises
    # "Mountpoint must not already contain files".
    if os.path.isdir("/content/drive/MyDrive"):
        print("Drive already mounted — skipping.")
    else:
        drive.mount("/content/drive")
        print("Drive mounted.")
except ImportError:
    print("Not on Colab — skipping drive mount.")
    USE_SYNTHETIC = True


# ============================================================
# CELL 4 — Imports
# ============================================================

# Force Keras 2 (via the tf-keras package) BEFORE TensorFlow is imported
# anywhere, so tf2onnx.convert.from_keras works. TF 2.17 defaults to Keras 3,
# which tf2onnx does not reliably convert. Must be set before `import tensorflow`.
import os
os.environ["TF_USE_LEGACY_KERAS"] = "1"

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
# DMD annotates 7 PARALLEL "levels" (tracks) per frame; within each track the
# labels are mutually exclusive. The real annotation `type` strings are
# NAMESPACED, e.g. "driver_actions/safe_drive", "gaze_on_road/looking_road",
# "hands_using_wheel/both". Only the `driver_actions/*` track describes the
# distraction *action*, so that is the one we convert into an alert level.
# Every other track (gaze_on_road/*, hands_using_wheel/*, talking/*,
# objects_in_scene/*, occlusion/*, hand_on_gear/*) is ignored here.
#
#  driver_actions leaf → level:
#   safe_drive                              → 0  attentive
#   radio / drinking / reach_side /
#     hair_and_makeup / talking_to_passenger /
#     change_gear / standstill_or_waiting   → 1  mild
#   phonecall_right / phonecall_left        → 2  warning (phone to ear)
#   texting_right / texting_left /
#     reach_backseat                        → 3  critical (eyes+hands off road)
#   unclassified                            → skipped (no reliable label)
#
# Frames with no driver_actions label keep the default 0 (Alert) — conservative.

DMD_DRIVER_ACTION_MAP: Dict[str, int] = {
    # ── safe / attentive (0) ────────────────────────────────
    "safe_drive":            0,
    # ── mild (1) ────────────────────────────────────────────
    "radio":                 1,
    "drinking":              1,
    "reach_side":            1,
    "hair_and_makeup":       1,
    "talking_to_passenger":  1,
    "change_gear":           1,
    "standstill_or_waiting": 1,
    "stand_still_waiting":   1,   # tolerate naming variant
    # ── warning (2) ─────────────────────────────────────────
    "phonecall_right":       2,
    "phonecall_left":        2,
    # ── critical (3) ────────────────────────────────────────
    "texting_right":         3,
    "texting_left":          3,
    "reach_backseat":        3,
    # "unclassified" intentionally absent → returns None → skipped
}

CLASS_NAMES = ["Alert", "Mild", "Warning", "Critical"]

DRIVER_ACTIONS_PREFIX = "driver_actions/"


def map_dmd_label(action_type: str) -> Optional[int]:
    """
    Map a DMD OpenLABEL action `type` to a 0-3 alert level.

    Returns None when the action is NOT a driver_actions distraction label
    (it belongs to another annotation track, or is `unclassified`), so the
    caller can skip it instead of forcing a wrong level onto those frames.
    """
    t = action_type.strip().lower()
    if not t.startswith(DRIVER_ACTIONS_PREFIX):
        return None
    leaf = t[len(DRIVER_ACTIONS_PREFIX):]
    return DMD_DRIVER_ACTION_MAP.get(leaf, None)


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

    # Only the driver_actions track yields a distraction level. map_dmd_label
    # returns None for every other track (gaze / hands / talking / objects / …)
    # and for `unclassified`, so those frames keep the default 0 (Alert).
    # driver_actions labels are mutually exclusive within the track, so the
    # intervals we write here never conflict with each other.
    for action in actions.values():
        level = map_dmd_label(action.get("type", ""))
        if level is None:
            continue
        for fi in action.get("frame_intervals", []):
            start = fi.get("frame_start", 0)
            end   = fi.get("frame_end",   0)
            labels[start:end + 1] = level

    return labels


def find_dmd_sessions(dmd_root: str, groups: List[str],
                      camera: str = CAMERA_STREAM) -> List[Tuple[Path, Path, str]]:
    """
    Walk the DMD folder tree and return (video_path, ann_json_path, session_id).

    Real DMD layout is  group / subject / session / files, e.g.
        gA/1/s1/gA_1_s1_<timestamp>_rgb_face.mp4
        gA/1/s1/gA_1_s1_<timestamp>_rgb_ann_distraction.json
    (the videos + annotation JSON live directly inside each session folder).
    session_id = "gA_1_s1" style string for logging.
    """
    root     = Path(dmd_root)
    sessions = []

    for group in groups:
        group_dir = root / group
        if not group_dir.exists():
            print(f"  [warn] Group folder not found: {group_dir}")
            continue

        for subj_dir in sorted(p for p in group_dir.iterdir() if p.is_dir()):
            for sess_dir in sorted(p for p in subj_dir.iterdir() if p.is_dir()):
                # Face video for this session (camera defaults to rgb_face)
                vids = (sorted(sess_dir.glob(f"*{camera}*.mp4")) or
                        sorted(sess_dir.glob(f"*{camera}*.avi")))
                if not vids:
                    print(f"  [warn] No {camera} video in "
                          f"{group}/{subj_dir.name}/{sess_dir.name}")
                    continue
                video = vids[0]

                # Distraction annotation JSON in the same session folder
                anns = (sorted(sess_dir.glob("*ann_distraction*.json")) or
                        sorted(sess_dir.glob("*.json")))
                if not anns:
                    print(f"  [warn] No annotation JSON in "
                          f"{group}/{subj_dir.name}/{sess_dir.name} — skipping")
                    continue
                ann_json = anns[0]

                session_id = f"{group}_{subj_dir.name}_{sess_dir.name}"
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


def build_or_load_dataset(sessions: List[Tuple[Path, Path, str]], tag: str) -> List[Sample]:
    """
    Cache extracted features to Drive so re-runs skip the slow (~25-40 min)
    MediaPipe extraction. The cache key includes the exact sessions found plus
    FRAME_SKIP / MAX_FRAMES_PER_SESSION, so it auto-invalidates when you add a
    subject or change sampling — but a plain re-run (e.g. to fix ONNX export or
    retrain) loads features in seconds.
    Delete the .pkl files in OUTPUT_DIR to force a fresh extraction.
    """
    import hashlib
    sig  = "|".join(sorted(sid for _, _, sid in sessions))
    key  = hashlib.md5(f"{sig}|skip{FRAME_SKIP}|max{MAX_FRAMES_PER_SESSION}".encode()).hexdigest()[:8]
    path = os.path.join(OUTPUT_DIR, f"features_{tag}_{key}.pkl")

    if os.path.exists(path):
        print(f"  [cache] loading {tag} features → {path}")
        with open(path, "rb") as f:
            samples = pickle.load(f)
        counts = {c: sum(1 for s in samples if s.label == c) for c in range(4)}
        print(f"  → {len(samples)} cached samples | distribution: {counts}")
        return samples

    samples = build_dataset(sessions)
    try:
        with open(path, "wb") as f:
            pickle.dump(samples, f)
        print(f"  [cache] saved {tag} features → {path}")
    except Exception as e:
        print(f"  [cache] could not save {tag} cache ({e}) — continuing")
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

    # ── Sanity check (fail fast BEFORE the ~1h feature extraction) ──────
    # Prints how many sessions were found per split and the per-level frame
    # distribution from the annotations. If a split shows 0 sessions your
    # DMD_ROOT / group names are wrong; if labels are all one class your data
    # or mapping is off. Catch it here — not after an hour of MediaPipe.
    def _label_dist(sessions):
        counts = {0: 0, 1: 0, 2: 0, 3: 0}
        for _video, ann, _sid in sessions:
            labels = parse_openlabel_json(Path(ann))
            if labels is None:
                continue
            for lvl in range(4):
                counts[lvl] += int((labels == lvl).sum())
        return counts

    print("\n" + "=" * 60)
    print("SANITY CHECK — sessions found + label distribution")
    print("=" * 60)
    _bad = False
    for _name, _grp, _sess in [("TRAIN", TRAIN_GROUPS, train_sessions),
                               ("VAL",   VAL_GROUPS,   val_sessions),
                               ("TEST",  TEST_GROUPS,  test_sessions)]:
        dist  = _label_dist(_sess)
        total = sum(dist.values())
        pct   = {k: (100 * v / total if total else 0) for k, v in dist.items()}
        print(f"  {_name:5s} groups={_grp} sessions={len(_sess):2d}  "
              f"frames={total:6d}  "
              f"A:{pct[0]:4.1f}% M:{pct[1]:4.1f}% W:{pct[2]:4.1f}% C:{pct[3]:4.1f}%")
        if len(_sess) == 0:
            print(f"    [ERROR] No sessions for {_name} — check DMD_ROOT / group names.")
            _bad = True
    if _bad:
        raise RuntimeError("Sanity check failed — fix DMD_ROOT / groups in CELL 2 "
                           "before continuing (no data was extracted).")
    print("Sanity check passed — proceeding to feature extraction.\n")

    print("TRAIN features …")
    train_samples = build_or_load_dataset(train_sessions, "train")
    print("VAL features …")
    val_samples   = build_or_load_dataset(val_sessions, "val")
    print("TEST features …")
    test_samples  = build_or_load_dataset(test_sessions, "test")

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
# XGBoost 2.0+ moved `early_stopping_rounds` from .fit() into the constructor
# and removed `use_label_encoder`. This targets xgboost 3.x (Colab default).
xgb_meta = xgb.XGBClassifier(
    objective="multi:softprob", num_class=4,
    max_depth=4, n_estimators=200, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8,
    eval_metric="mlogloss", early_stopping_rounds=15,
    random_state=42, n_jobs=-1,
)
xgb_meta.fit(X_tr_sc, y_tr_m,
             eval_set=[(X_va_sc, y_va_m)],
             verbose=False)

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
# CELL 17b — ROC Curves + AUC (one-vs-rest, Systems B & C)
# ============================================================
# ROC needs class probabilities, so it is drawn for the two systems that
# output them: System B (CNN softmax) and System C (XGBoost predict_proba).
# System A emits a single composite score, not per-class probabilities, so it
# has no multi-class ROC (its behaviour is captured by the confusion matrix).

from sklearn.preprocessing import label_binarize
from sklearn.metrics import roc_curve, auc

y_bin = label_binarize(y_te_m, classes=[0, 1, 2, 3])

# System B probabilities — run the ONNX model over the test face crops
cnn_test_probs = sess.run(None, {"input": np.stack([
    (s.face_crop.astype(np.float32) / 255.0
     if s.face_crop is not None
     else np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.float32))
    for s in test_samples
])})[0]

# System C probabilities — XGBoost meta-classifier
xgb_test_probs = xgb_meta.predict_proba(X_te_sc)


def _plot_roc(ax, y_bin_, probs, title) -> Dict[str, float]:
    aucs: Dict[str, float] = {}
    for i, cname in enumerate(CLASS_NAMES):
        if y_bin_[:, i].sum() == 0:      # class absent from the test split
            continue
        fpr, tpr, _ = roc_curve(y_bin_[:, i], probs[:, i])
        a = auc(fpr, tpr)
        aucs[cname] = float(a)
        ax.plot(fpr, tpr, label=f"{cname} (AUC={a:.2f})")
    # macro-average AUC across the classes that were present
    if aucs:
        aucs["macro"] = float(np.mean(list(aucs.values())))
    ax.plot([0, 1], [0, 1], "k--", alpha=0.4)
    ax.set_xlim(0, 1); ax.set_ylim(0, 1.02)
    ax.set_xlabel("False Positive Rate"); ax.set_ylabel("True Positive Rate")
    ax.set_title(title); ax.legend(loc="lower right", fontsize=8)
    return aucs


fig, axes = plt.subplots(1, 2, figsize=(12, 5))
auc_b = _plot_roc(axes[0], y_bin, cnn_test_probs, "System B — MobileNetV2 ROC (OvR)")
auc_c = _plot_roc(axes[1], y_bin, xgb_test_probs, "System C — Ensemble ROC (OvR)")
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "roc_curves.png"), dpi=150)
plt.show()

print("Per-class AUC — System B:", {k: round(v, 3) for k, v in auc_b.items()})
print("Per-class AUC — System C:", {k: round(v, 3) for k, v in auc_c.items()})


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
    "roc_auc": {
        "B": {k: round(v, 3) for k, v in auc_b.items()},
        "C": {k: round(v, 3) for k, v in auc_c.items()},
    },
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
    print("  cp drowsy_mobilenetv2.onnx  finalyearproject/ai/models/")
    print("  cp meta_classifier.pkl      finalyearproject/ai/models/")
    print("  cp ablation_results.json    finalyearproject/frontend/public/")
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
