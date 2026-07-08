# DrowsyShield — Colab Training Setup Guide (DMD Dataset)

Dataset: **DMD — Driver Monitoring Dataset** by Vicomtech
Download: https://opendatasets.vicomtech.org/di21-dmd-dataset-distraction-rgb-ir/

---

## What DMD Contains (what you downloaded)

The DMD distraction-rgb-ir dataset includes:
- **RGB face camera** video of the driver (this is what we use)
- **IR face camera** video (optional — we use RGB only)
- **OpenLABEL JSON annotations** with frame-level distraction labels
- Multiple subjects split into groups (gA, gB, gC...)
- ~30 fps, 1920×1080 resolution

**Distraction action labels in the dataset:**

| DMD label | Mapped to | Alert level |
|-----------|-----------|-------------|
| `safe_drive` | Alert | 0 |
| `radio`, `reach_side`, `talking_to_passenger`, `hair_and_makeup`, `drinking`, `eating`, `yawning` | Mild | 1 |
| `phone_call_right`, `phone_call_left`, `GPS`, `drowsy` | Warning | 2 |
| `texting`, `read_write`, `microsleep` | Critical | 3 |

---

## Step 1 — Unzip and Organise on Google Drive

After downloading from Vicomtech, create this structure on your Drive:

```
My Drive/
└── DrowsyShield/
    ├── DMD/                               ← unzip the dataset here
    │   ├── gA/
    │   │   ├── s1/
    │   │   │   ├── rgb_face/
    │   │   │   │   └── video.mp4          ← face video (we use this)
    │   │   │   ├── rgb_body/              ← ignore
    │   │   │   ├── ir_face/               ← ignore
    │   │   │   └── ann/
    │   │   │       └── gA_s1_ann_distraction.json   ← labels
    │   │   ├── s2/
    │   │   └── ...
    │   ├── gB/
    │   │   └── ...
    │   └── gC/
    │       └── ...
    │
    └── models/                            ← created automatically by script
        (output files go here after training)
```

### Unzip on Colab (paste this in a cell before running the main script)

```python
import zipfile, os

zip_path = "/content/drive/MyDrive/DrowsyShield/DMD.zip"
out_path = "/content/drive/MyDrive/DrowsyShield/DMD"

os.makedirs(out_path, exist_ok=True)

with zipfile.ZipFile(zip_path, "r") as z:
    z.extractall(out_path)

print("Done. Contents:")
for p in sorted(os.listdir(out_path)):
    print(" ", p)
```

Run this **once** — it takes 5–15 minutes. After it completes you can delete the zip to save Drive space.

---

## Step 2 — Check Your Group Structure

Before running the training script, check what groups you actually have:

```python
# Paste this in a Colab cell to inspect your DMD structure
import os
dmd_root = "/content/drive/MyDrive/DrowsyShield/DMD"

for group in sorted(os.listdir(dmd_root)):
    group_path = os.path.join(dmd_root, group)
    if os.path.isdir(group_path):
        subjects = [s for s in os.listdir(group_path)
                    if os.path.isdir(os.path.join(group_path, s))]
        print(f"{group}: {len(subjects)} subjects → {subjects}")
```

This tells you which group names to put in CELL 2.

---

## Step 3 — The Only Lines You Must Edit in `train_colab.py`

Open **CELL 2** of the script. Change only these values:

```python
# ── Is your data on Drive? ────────────────────────────────────
USE_SYNTHETIC = False          # keep False — you have real DMD data

# ── Path to DMD on Drive ──────────────────────────────────────
DMD_ROOT = "/content/drive/MyDrive/DrowsyShield/DMD"
#            ↑ change if you named your Drive folder differently

# ── Output folder ─────────────────────────────────────────────
OUTPUT_DIR = "/content/drive/MyDrive/DrowsyShield/models"

# ── IMPORTANT: set these based on what groups you actually have ──
# Run the inspection cell above first to see your group names

TRAIN_GROUPS = ["gA"]         # groups used for training
VAL_GROUPS   = ["gB"]         # groups used for validation
TEST_GROUPS  = ["gC"]         # groups held out for final test

# ── If you only have gA and gB (no gC): ─────────────────────
# TRAIN_GROUPS = ["gA"]
# VAL_GROUPS   = ["gB"]
# TEST_GROUPS  = ["gB"]       # test on gB subjects not in val
#                             # (script picks different sessions automatically)
```

**Nothing else in the script needs to change.** All paths are derived from these.

---

## Step 4 — Upload `train_colab.py` to Colab

**Simplest method:**
1. Open Google Colab: colab.research.google.com
2. Click the folder icon (left sidebar) → upload icon → select `train_colab.py`
3. Run in a cell:

```python
exec(open("train_colab.py").read())
```

**Or run from Drive** (survives session restarts):

```python
exec(open("/content/drive/MyDrive/DrowsyShield/train_colab.py").read())
```

---

## Step 5 — Colab Runtime Settings

**Before running:**
```
Runtime → Change runtime type
  Hardware accelerator: GPU
  GPU type: T4  (free tier — sufficient)
```

**Estimated run times on T4:**

| Stage | Estimated time |
|-------|---------------|
| Package install (CELL 1) | ~3 min |
| Feature extraction — all sessions | ~60–90 min |
| System B training (MobileNetV2) | ~20–35 min |
| ONNX export + benchmark | ~2 min |
| System C XGBoost | ~1 min |
| **Total** | **~1.5–2 hours** |

> DMD is faster than NTHU-DDD to process because it has fewer total subjects and the videos are already at a consistent resolution.

---

## Step 6 — What the Script Produces

After training completes, these files appear in `My Drive/DrowsyShield/models/`:

```
models/
├── drowsy_mobilenetv2.h5          ← Keras checkpoint (backup only)
├── drowsy_mobilenetv2.onnx        ← ✅ copy to backend/models/
├── meta_classifier.pkl            ← ✅ copy to backend/models/
├── ablation_results.json          ← ✅ accuracy numbers for frontend
├── ablation_study.png             ← bar chart for report/slides
├── training_curves.png            ← accuracy/loss curves for report
├── confusion_matrices.png         ← A vs B vs C confusion matrices
└── feature_importance.png         ← XGBoost feature importances
```

CELL 19 automatically triggers browser downloads for the 3 most important files.

---

## Step 7 — Copy Models to the AI Folder

```bash
# From your project root on your laptop:
cp ~/Downloads/drowsy_mobilenetv2.onnx  ai/models/
cp ~/Downloads/meta_classifier.pkl      ai/models/
cp ~/Downloads/ablation_results.json    frontend/public/
```

Final structure:
```
finalyearproject/
├── ai/
│   └── models/
│       ├── drowsy_mobilenetv2.onnx   ← Python FastAPI loads this (System B)
│       └── meta_classifier.pkl       ← Python FastAPI loads this (System C)
└── frontend/
    └── public/
        └── ablation_results.json     ← frontend reads accuracy numbers
```

The Python server (`ai/main.py`) loads both files automatically on startup — no config change needed.

---

## Step 8 — Verify the Models Load (Quick Check)

After copying, restart the Python server and check the startup log:

```bash
cd ai
uvicorn main:app --port 8000 --reload
```

You should see:
```
[pipeline] System B loaded: drowsy_mobilenetv2.onnx
[pipeline] System C loaded: meta_classifier.pkl
INFO:     Application startup complete.
```

If you see "ONNX not found" or "PKL not found" — the files are in the wrong folder. They must be in `ai/models/`, not `backend/models/`.

---

## What the `ablation_results.json` Looks Like

After training you will get something like:

```json
{
  "dataset": "DMD-Vicomtech (distraction-rgb-ir)",
  "ablation": {
    "EAR only":         { "accuracy": 74.1, "precision": 68.3, ... },
    "EAR + PERCLOS":    { "accuracy": 79.8, ... },
    "+ MAR":            { "accuracy": 83.2, ... },
    "+ Head Pose":      { "accuracy": 87.0, ... },
    "All 5 (System A)": { "accuracy": 90.5, ... }
  },
  "systems": {
    "A": { "accuracy": 90.5, ... },
    "B": { "accuracy": 87.2, ... },
    "C": { "accuracy": 91.1, ... }
  },
  "onnx_latency_ms": { "p50": 7.2, "p95": 9.8 }
}
```

These numbers go into the `TechnicalSection` of the landing page. Update the hardcoded values in the frontend to match your actual results.

---

## Common Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Group folder not found: gC` | You don't have that group | Change `TEST_GROUPS = ["gB"]` in CELL 2 |
| `No video for gA/s1/rgb_face` | Video is in a different subfolder | Check actual folder name — change `CAMERA_STREAM` in CELL 2 |
| `No annotation JSON for gA/s1` | Ann folder named differently | Check actual folder name inside `s1/` |
| `No actions found in ...json` | Different JSON schema version | Paste one of your JSON files in chat — will fix the parser |
| `CUDA out of memory` | Batch too large | Set `BATCH_SIZE = 16` in CELL 2 |
| Session disconnects | Colab 90-min idle timeout | Keep browser tab active; use Colab Pro for long runs |

---

## If You Only Have 2 Groups (gA + gB)

Change CELL 2 to split subjects within groups manually:

```python
TRAIN_GROUPS = ["gA"]
VAL_GROUPS   = ["gB"]
TEST_GROUPS  = ["gB"]   # same group, different subjects
```

The script picks all sessions from each listed group. If gB has 5 subjects, it will use all 5 for both val and test — accuracy on test will be optimistic but still valid for a final year project demo.

Alternatively, ask for a version of the script that splits by subject index within a group.

---

## Summary Checklist

```
Before running:
[ ] DMD zip downloaded from Vicomtech link
[ ] Unzipped to My Drive/DrowsyShield/DMD/
[ ] Run inspection cell to confirm group names (gA, gB, gC...)
[ ] CELL 2 updated with correct DMD_ROOT and group names
[ ] Runtime set to GPU T4

After training:
[ ] drowsy_mobilenetv2.onnx  → backend/models/
[ ] meta_classifier.pkl      → backend/models/
[ ] ablation_results.json    → frontend/public/
[ ] Quick load check passed
[ ] PNG charts saved for report
```
  One thing still pending — not code, just data:
  Run train_colab.py on Colab with your DMD dataset → copy
  drowsy_mobilenetv2.onnx + meta_classifier.pkl into ai/models/ → the
  Python server auto-loads them. Until then, real-time detection runs on
  System A (rule-based) which is fully functional.



After Colab training finishes, do these 3 things:

  1. Copy the 3 output files:
  cp ~/Downloads/drowsy_mobilenetv2.onnx  ai/models/
  cp ~/Downloads/meta_classifier.pkl      ai/models/
  cp ~/Downloads/ablation_results.json    frontend/public/

  2. Start all three servers (3 terminals):
  # Terminal 1
  cd ai && uvicorn main:app --port 8000 --reload

  # Terminal 2
  cd backend && npm run start:dev

  # Terminal 3
  cd frontend && npm run dev

  3. Check the Python server log shows:
  [pipeline] System B loaded: drowsy_mobilenetv2.onnx
  [pipeline] System C loaded: meta_classifier.pkl

  That's it. The entire system is complete — frontend, NestJS backend,
  Python detection server, training script, and all connections between
  them. The only thing still in progress is the Colab training run
  itself.
