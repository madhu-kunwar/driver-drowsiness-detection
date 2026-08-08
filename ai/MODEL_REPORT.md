# AI Model Report — DrowsyShield Detection System

**Project:** Multimodal Driver Drowsiness & Distraction Detection
**Scope of this document:** everything in the `ai/` folder — what we built, *why* we built it that way, what technologies/datasets we used and *why we chose them over alternatives*, how the model is trained, and a full teacher/examiner Q&A.

---

## 1. One-paragraph summary

DrowsyShield detects driver drowsiness and distraction in real time from a **standard webcam** — no special hardware. It runs **three cooperating detection systems**: **System A** (a rule-based fusion of five facial/postural signals), **System B** (a fine-tuned MobileNetV2 CNN), and **System C** (an XGBoost ensemble that stacks A + B). Each classifies the driver's state into **four alert levels** — *Alert / Mild / Warning / Critical*. The CNN and ensemble were trained on the **DMD (Driver Monitoring Dataset)** using a **subject-independent** split. The runtime is a **FastAPI + WebSocket** server that streams metrics to the Next.js frontend at ~30 fps.

---

## 2. What's in the `ai/` folder

| Path | Purpose |
|---|---|
| `main.py` | FastAPI server. WebSocket `/ws/detect` receives JPEG frames, returns metrics JSON; `/health` check. One pipeline per connection = one driver per session. |
| `detection/pipeline.py` | The orchestrator. Runs preprocessing → signals → System A/B/C → smoothing → final alert level. |
| `detection/preprocessing.py` | Decodes JPEG, resizes, CLAHE contrast boost in low light. |
| `detection/calibration.py` | First ~3 s of a session → personal EAR threshold + posture baseline. |
| `detection/signals/ear.py` | Eye Aspect Ratio, PERCLOS tracker, blink tracker. |
| `detection/signals/mar.py` | Mouth Aspect Ratio + yawn detector. |
| `detection/signals/head_pose.py` | Head pitch/yaw/roll via `solvePnP`. |
| `detection/signals/posture.py` | Shoulder/ear geometry → forward-lean + tilt. |
| `train_colab.py` | The **training script** (Google Colab). Builds the DMD dataset, trains System B + C, runs the ablation study, exports ONNX + PKL + graphs. |
| `regen_metrics.py` | Regenerates report artifacts (JSON, confusion matrices, ROC) locally from the deployed models. |
| `models/` | Trained artifacts: `drowsy_mobilenetv2.onnx`, `meta_classifier.pkl`, `ablation_results.json`, graphs. |
| `DMD_DATASET_GUIDE.md` | The official DMD dataset documentation (structure, labels, license). |
| `SETUP.md` | Training/setup instructions. |
| `requirements.txt` | Runtime server dependencies (note: **no TensorFlow** — see §7). |

---

## 3. Why three systems? (the core design idea)

A single signal or single model is **fragile**. Our architecture is deliberately layered so each system covers the others' weaknesses:

| System | Type | Trained? | Strength | Weakness |
|---|---|---|---|---|
| **A** | Rule-based fusion | No | Interpretable, works instantly at cold-start, robust to appearance | Hand-tuned thresholds, can't learn complex patterns |
| **B** | MobileNetV2 CNN | Yes | Learns visual patterns rules can't express | Needs data, can overfit, black-box |
| **C** | XGBoost ensemble | Yes | Combines A + B; usually most balanced | Only as good as its inputs |

**The academic contribution is the comparison itself**: rule-based vs deep-learning vs ensemble, plus an **ablation study** showing how each signal contributes. That is *why we train* — not just to get a model, but to produce a benchmarked, defensible evaluation.

---

## 4. System A — rule-based fusion (5 signals)

System A computes a **composite drowsiness/distraction score** in `[0,1]` as a weighted sum of five normalized signals, then maps it to a level.

**Weights:** EAR 0.30 · PERCLOS 0.25 · MAR 0.20 · head-pose 0.15 · posture 0.10.
**Level thresholds:** `<0.25`→Alert, `<0.50`→Mild, `<0.75`→Warning, else Critical.

| Signal | What it measures | Formula (in code) | Why it matters |
|---|---|---|---|
| **EAR** (Eye Aspect Ratio) | Eye openness | `(‖p1−p5‖+‖p2−p4‖)/(2‖p0−p3‖)` over 6 eye landmarks | Primary drowsiness cue — eyes closing |
| **PERCLOS** | % of time eyes closed over 60 s | rolling window of `EAR < threshold` | The clinically validated drowsiness metric |
| **MAR** (Mouth Aspect Ratio) | Mouth opening / yawning | `(3 vertical lip gaps)/(2×width)`; yawn if MAR>0.60 for 45 frames (1.5 s) | Yawning = early fatigue sign |
| **Head pose** | Pitch/yaw/roll | `cv2.solvePnP` on 6 face points | Nodding (pitch) = drowsy; yaw = looking away = distraction |
| **Posture** | Forward-lean + shoulder tilt | MediaPipe Pose shoulder/ear geometry vs baseline | Slouching/leaning = fatigue |

**Calibration (`calibration.py`):** for the first ~3 s the system records the driver's *resting* EAR and posture, then sets a **personal EAR threshold = 0.75 × resting EAR**. This makes it robust to different eye shapes/glasses instead of a fixed threshold. During calibration the pipeline returns neutral values.

**Smoothing (`pipeline.py`):** the composite score is passed through an **exponential moving average (α=0.3)** and the alert *level* uses **hysteresis** (different up/down thresholds) so alarms don't flicker frame-to-frame.

---

## 5. System B — MobileNetV2 CNN

- **Input:** 112×112 RGB **face crop** (detected via MediaPipe, padded 15%).
- **Output:** softmax over the 4 alert levels.
- **Backbone:** MobileNetV2 pretrained on ImageNet (transfer learning).
- **Training:** two phases — (1) train the new head with the backbone frozen, (2) unfreeze the **last 30 layers** and fine-tune. Uses **class weights** (to counter imbalance) and **data augmentation** (flip, rotation, zoom, brightness, noise).
- **Export:** converted to **ONNX** (opset 13). Size **9.6 MB**, latency **~1–3 ms/frame**, output shape `(1,4)`.

---

## 6. System C — XGBoost meta-classifier (stacked ensemble)

- **Input:** an **11-feature vector** per frame:
  `[composite_A, level_A, ear, perclos, mar, pose, posture, cnn_p_alert, cnn_p_mild, cnn_p_warning, cnn_p_critical]`
  i.e. System A's signals **+** System B's 4 class probabilities.
- **Preprocessing:** `StandardScaler`.
- **Model:** XGBoost (200 trees, depth 4, early stopping). A Logistic Regression baseline is also trained for comparison.
- **Why stacking:** it lets a learned model decide *how much to trust* A vs B per situation, which is why System C ends up the **most balanced** (see results).

---

## 7. Technology choices — and why, over the alternatives

| We used | Alternatives | Why we chose it |
|---|---|---|
| **MediaPipe FaceMesh/Pose** | dlib 68-point, OpenCV Haar cascades | 468 **3D** landmarks, refined eye/iris points, robust "in the wild", runs real-time on CPU with no GPU. dlib is slower and less robust to head rotation/lighting; Haar cascades are far less accurate. |
| **MobileNetV2** | ResNet50, EfficientNet, VGG16 | Designed for **edge/real-time**: 2.4 M params, 9.6 MB, ~2 ms on CPU — matches our "runs on a laptop webcam" goal. ResNet50 (25 M) / VGG (138 M) are too heavy; EfficientNet is more accurate but slower and harder to export cleanly. |
| **XGBoost** (System C) | Logistic Regression, Random Forest, a neural net | Best for small **tabular** meta-features; captures non-linear interactions, robust to feature scaling, fast. We *did* run LogReg as a baseline — it scored lower (42–51%). A neural net is overkill for 11 features + a few thousand rows. |
| **ONNX Runtime** (serving) | Serving the raw Keras/TF model | The production server stays **lightweight and TF-free** (`requirements.txt` has no TensorFlow). ONNX is cross-platform and fast on CPU. TF at runtime would add ~500 MB and a heavy cold-start. |
| **FastAPI + WebSocket** | Flask + REST polling | Real-time video needs **low-latency streaming**; WebSocket pushes 30 fps frames both ways. FastAPI is async and modern. REST polling would add latency and overhead. |
| **Rule-based System A at all** | Pure end-to-end deep learning | Rules are **interpretable**, need **no training data**, work during the cold-start/calibration window, and are robust to appearance. Deep learning alone can't explain *why* it alarmed — important for a safety system and for insurers. |
| **4 graded alert levels** | Binary drowsy/not | Enables a **proportionate response** (gentle nudge → loud alarm) instead of one blunt alarm. |

---

## 8. The dataset — DMD, and why not the others

**We used the DMD (Driver Monitoring Dataset, Vicomtech) — distraction-RGB subset.**

- **Structure:** groups of ~5 subjects → sessions `s1/s2/s3` → three-camera videos + an **OpenLABEL JSON** with per-frame action labels.
- **Labels:** the `driver_actions/*` annotation track (safe_drive, radio, drinking, reach_side, phonecall, texting, reach_backseat, …). We map these to our **4 levels**:
  - 0 Alert ← `safe_drive`
  - 1 Mild ← radio, drinking, reach_side, hair_and_makeup, talking_to_passenger
  - 2 Warning ← phonecall (left/right)
  - 3 Critical ← texting (left/right), reach_backseat
- **Split:** **subject-independent** — TRAIN=gA, VAL=gB, TEST=gC (different drivers in each), so the model is tested on people it never trained on.

| Dataset | Why we did NOT use it as primary |
|---|---|
| **SUST-DDD** | Binary drowsy/not-drowsy only, **no distraction** labels — can't produce 4 graded levels. |
| **NTHU-DDD** | Drowsiness-only (IR), no distraction actions. |
| **State Farm / AUC** | Still **images**, not video — no temporal signals (PERCLOS/yawn duration) and no drowsiness. |
| **UTA-RLDD** | Drowsiness-only. |
| **DMD** ✅ | The **only** option giving frame-level, graded **distraction** labels + video for temporal signals — matches our multimodal, 4-level design. |

---

## 9. How to train (reproduce the model)

1. **Data → Google Drive:** `MyDrive/drowsiness/dmd/{gA,gB,gC}/<subject>/{s1,s2,s3}/…rgb_face.mp4 + …ann_distraction.json`.
2. **Colab:** upload `ai/train_colab.py`, set Runtime → **T4 GPU**.
3. **Install deps, then RESTART the runtime, then run** `exec(open("train_colab.py").read())`.
   - Pinned versions matter (Colab, Python 3.12): `tensorflow==2.17.1`, `protobuf==4.25.8`, `numpy<2`, `mediapipe==0.10.14`, `tf-keras==2.17.0` (+ `TF_USE_LEGACY_KERAS=1`), `onnx==1.16.2`, `xgboost` 3.x. These resolve real conflicts (mediapipe needs protobuf 4.x but Colab's default TF 2.18 needs 5.x; onnx 1.17+ breaks against ml_dtypes 0.4; XGBoost 3.x moved `early_stopping_rounds` into the constructor).
4. The script: finds sessions → **sanity check** (prints label distribution, fails fast on bad paths) → extracts features (**cached to Drive** so re-runs are instant) → ablation → trains B → exports ONNX → trains C → saves graphs + JSON.
5. **Deploy:** copy `drowsy_mobilenetv2.onnx` + `meta_classifier.pkl` → `ai/models/`; `ablation_results.json` → `frontend/public/`. The server auto-loads them (`[pipeline] System B/C loaded`).

**Why train at all?** To produce the learned model (B), the ensemble (C), and — crucially — the **benchmark + ablation** that is the project's academic contribution.

---

## 10. Results (3-driver subject-independent test set, 3,605 frames)

| System | Accuracy | Macro-F1 | Macro ROC-AUC |
|---|---|---|---|
| A — rule-based | 46.2% | 0.24 | — (single score) |
| B — MobileNetV2 | **57.2%** | 0.23 | 0.67 |
| C — ensemble | 54.2% | **0.31** | **0.69** |

**Ablation (System A, adding signals):** EAR-only 53.7% → +PERCLOS 53.4% → +MAR 50.3% → +HeadPose 45.6% → All-5 46.2%. *(Accuracy drops as drowsiness-oriented signals are added because the test labels are **distraction**, not drowsiness — see §11.)*

**Per-class ROC-AUC** (System C): Alert 0.75 · Mild 0.63 · Warning **0.77** · Critical 0.60. All above 0.5 (random), so the model genuinely separates the classes.

Artifacts: `models/ablation_results.json`, `confusion_matrices.png`, `roc_curves.png`, `ablation_study.png`, `training_curves.png`, `feature_importance.png`.

---

## 11. Honest limitations (state these before the examiner does)

1. **Face-only input limits distraction detection.** Texting/phone are *hand* actions; a face crop can't see hands (those are in DMD's `rgb_hands`/`rgb_body` cameras we don't use). So Warning/Critical **recall is low (~0–5%)** even though their **ROC-AUC is 0.6–0.77** — the signal exists, but the accuracy is capped by the input view and class imbalance.
2. **Class imbalance.** ~50% of frames are "Alert," so raw accuracy is majority-biased. We report **macro-F1 and ROC-AUC** precisely because they're honest under imbalance.
3. **System A is drowsiness-oriented, evaluated on distraction labels** → its ~46% is expected, and it *motivates* the learned System B/C.
4. **Small subject count (3 drivers).** It's a valid *subject-independent* split, but more drivers (the design supports 2 per group = 6) would give steadier numbers.
5. **Acted distraction.** DMD S2/S3 are recorded with the car parked; behaviors are performed, not fully natural.
6. **Live decision uses System A.** By design, the runtime's `alertLevel` currently comes from System A (calibrated + smoothed + hysteresis); System B/C are computed and shown for comparison. Wiring B/C into the live decision is a documented future step.

---

## 12. Full Q&A — likely examiner questions

**Q1. Why three systems instead of one?** Robustness + the academic contribution. Rules work at cold-start and are interpretable; the CNN learns patterns; the ensemble combines both. Comparing them (with an ablation) is the core evaluation.

**Q2. Why is System A's accuracy only ~46%?** Because System A uses drowsiness signals (eyes/mouth/pose) but the DMD test labels are *distraction* actions. A texting driver has open eyes, so eye-based rules can't rank distraction — an expected, honest result that justifies the learned models.

**Q3. Your best accuracy is ~57%. Isn't that low?** For a 4-class, subject-independent, *distraction-from-face-only* task with class imbalance, raw accuracy is the wrong headline. The **ROC-AUC (up to 0.77, macro 0.69)** shows the model genuinely discriminates the classes; low recall on Warning/Critical is a threshold/imbalance effect plus the face-only view — fixable with the hands camera or threshold tuning.

**Q4. Why MobileNetV2 and not ResNet/EfficientNet?** Real-time on a laptop CPU. MobileNetV2 is 2.4 M params / 9.6 MB / ~2 ms; ResNet50 is 10× larger. The whole point is deployability without special hardware.

**Q5. Why XGBoost for the ensemble and not a neural net?** 11 tabular features and a few thousand rows — a gradient-boosted tree is the right tool: fast, robust, captures interactions, no scaling issues. We ran Logistic Regression as a baseline (lower). A neural net would overfit and add no value here.

**Q6. Why ONNX instead of running the Keras model directly?** To keep the production server lightweight and TensorFlow-free (see `requirements.txt`). ONNX Runtime is small, cross-platform, and fast on CPU.

**Q7. Why MediaPipe and not dlib/OpenCV?** MediaPipe gives 468 refined 3D landmarks, is robust to lighting/rotation, and runs real-time on CPU. dlib's 68-point model is slower and less robust in real conditions.

**Q8. What are EAR, PERCLOS, MAR?** EAR = eye openness ratio (drowsiness); PERCLOS = % of time eyes are closed over 60 s (the validated fatigue metric); MAR = mouth openness (yawning). Formulas in §4.

**Q9. How do you handle different faces/eye shapes?** Per-driver **calibration**: the first ~3 s set a personal EAR threshold (0.75 × resting EAR) and posture baseline, rather than a fixed global threshold.

**Q10. Why 4 alert levels?** Graded, proportionate response (gentle → urgent) instead of a single blunt binary alarm.

**Q11. How did you avoid data leakage / test fairly?** **Subject-independent** split — train on group gA drivers, validate on gB, test on gC. No driver appears in two splits, so we test generalization to unseen people.

**Q12. Why DMD and not [SUST/NTHU/State Farm]?** DMD is the only public dataset with frame-level, graded **distraction** labels *and* video (for temporal signals). The others are drowsiness-only or still images (§8).

**Q13. Is the distraction data real driving?** S1 is real driving (safe behaviors only, for safety/legality); S2/S3 are acted in a parked car (phone/texting are dangerous to do while driving). We disclose this.

**Q14. How is the model served in real time?** A FastAPI WebSocket receives JPEG frames at ~30 fps; the pipeline runs signals + ONNX + XGBoost per frame and returns metrics JSON. Latency is dominated by MediaPipe (a few ms) + ~2 ms ONNX.

**Q15. What prevents flickering alarms?** An EMA (α=0.3) on the score and **hysteresis** on level transitions (harder to escalate/de-escalate than a single frame).

**Q16. What's the ablation study for?** It quantifies each signal's contribution to System A — a required part of showing the design is justified, not arbitrary.

**Q17. Which features matter most to System C?** Feature-importance shows the **CNN class probabilities** (esp. `cnn_p_warning`, `cnn_p_alert`) dominate, then PERCLOS/EAR — i.e. the ensemble leans on the CNN but the rule signals still help.

**Q18. How would you improve distraction accuracy?** Use the **hands/body camera** (or the aligned mosaic) so the CNN can see the phone/hands; add more drivers; tune decision thresholds for the minority classes; add temporal modeling (LSTM over frames).

**Q19. Why not train System A?** It's a deterministic rule fusion — no parameters to learn beyond the per-user calibration. Its weights are set from domain knowledge (EAR/PERCLOS are the strongest drowsiness cues).

**Q20. Does it need a GPU?** Training used a Colab T4 GPU. **Inference runs on CPU** (ONNX + MediaPipe) — that's the deployability claim.

**Q21. What were the hardest engineering problems?** Dependency conflicts on Colab (mediapipe↔protobuf↔TensorFlow), matching the real DMD label vocabulary (namespaced `driver_actions/*` across 7 annotation tracks), the folder nesting, and API changes (XGBoost 3.x, ONNX/ml_dtypes). All documented in `train_colab.py`.

**Q22. Is 3 drivers enough?** It's a valid subject-independent evaluation but small; we note it as a limitation and the pipeline supports adding a 2nd subject per group (6 drivers) with no code change.

**Q23. Could this run in a real car?** Yes in principle — it's CPU-only and camera-based. Real deployment would add the hands/body camera, night/IR handling (we already do CLAHE low-light contrast), and more subjects.

**Q24. What's the difference between drowsiness and distraction here?** Drowsiness = physiological (eyes/yawn/nod), captured by EAR/PERCLOS/MAR/pitch. Distraction = attentional (looking/reaching away), captured by yaw/posture and, for actions, the CNN. DMD gives us distraction labels; drowsiness is handled by the rule signals.

**Q25. Why is macro-F1 higher for System C than System B, even though B has higher accuracy?** Because C is **more balanced** — it detects Mild (recall 0.59) instead of over-predicting the majority "Alert." Accuracy rewards majority-guessing; macro-F1 rewards balance. This is exactly why the ensemble is valuable.

---

## 13. How to run the whole thing

```bash
# Python detection server (loads the models)
cd ai && uvicorn main:app --host 0.0.0.0 --port 8000
#   → [pipeline] System B loaded: drowsy_mobilenetv2.onnx
#   → [pipeline] System C loaded: meta_classifier.pkl

# then the NestJS backend and Next.js frontend (see project README)
```

To regenerate report metrics/graphs locally from the deployed models: `cd ai && python regen_metrics.py`.

---

*Numbers in this report are from the 3-driver subject-independent DMD run (2026-08-09) and match `ai/models/ablation_results.json`.*
