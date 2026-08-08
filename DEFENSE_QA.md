# Project Defense — Critical Q&A

**Project:** Multimodal Driver Drowsiness & Distraction Detection
**Team:** Pranav Bhandari (221732), Madhu Kunwar (221721), Madhusudan Bhandari (221722), Samrat Giri (221740)
**Institution:** Pokhara University / NCIT — Dept. of Software Engineering

> 50 likely defense questions with grounded answers (Sections A–F cover the project; **Section G is the deep technical / ML drill-down**). Where a question is a common "gotcha," the honest/defensible line is flagged so you don't get cornered.

---

## ★ Key numbers to memorize (viva cheat sheet)

**Results (3-driver, subject-independent DMD test set, 3,605 frames):**
| System | Accuracy | Macro-F1 | Macro ROC-AUC |
|---|---|---|---|
| A rule-based | 46.2% | 0.24 | — |
| B MobileNetV2 | **57.2%** | 0.23 | 0.67 |
| C ensemble | 54.2% | **0.31** | **0.69** |

- **Per-class AUC (System C):** Alert 0.75 · Mild 0.63 · **Warning 0.77** · Critical 0.60
- **Split:** train gA / val gB / test gC (different drivers — subject-independent)
- **Signal weights:** EAR 0.30 · PERCLOS 0.25 · MAR 0.20 · head-pose 0.15 · posture 0.10
- **Level thresholds:** <0.25 Alert · <0.50 Mild · <0.75 Warning · ≥0.75 Critical
- **System B:** MobileNetV2, 112×112 face crop, ~2.4 M params, **9.6 MB** ONNX, **~1–3 ms/frame** CPU
- **System C:** XGBoost, **11 features** (7 rule signals + 4 CNN probs), 200 trees, depth 4
- **Calibration:** first ~3 s → personal EAR threshold = **0.75 × resting EAR**
- **Smoothing:** EMA α=0.3 · PERCLOS 60 s window · yawn = MAR>0.60 for 45 frames (1.5 s)
- **Dataset:** DMD distraction-RGB (Vicomtech), OpenLABEL `driver_actions` → 4 levels
- **Ports:** Python detection 8000 (WS `/ws/detect`) · NestJS 3001 · frontend 3000

---

## A. Problem, Motivation & Scope

### 1. What problem does your project solve and why does it matter?
Driver drowsiness and distraction cause a large share of road accidents. Existing solutions need special hardware (steering sensors, wearables, IR cameras in premium cars). Ours detects drowsiness in real time using only a standard laptop and USB webcam — no special hardware — making it deployable and affordable, especially for fleets in markets like Nepal.

### 2. Why "multimodal"? Why not just detect eye closure?
A single signal is fragile. Eye closure alone fails when someone wears glasses, looks down, or the lighting is poor. We fuse five signals — EAR, PERCLOS, MAR (yawning), head pose (nodding/looking away), and posture (slouching). If one signal is unreliable, the others compensate, which reduces false positives and catches drowsiness that a single cue would miss.

### 3. What's the difference between drowsiness and distraction, and do you detect both?
Drowsiness is a physiological state — slow eye closure, yawning, head nodding. Distraction is attentional — looking away from the road, turning the head. We capture drowsiness through EAR/PERCLOS/MAR and head-nod (pitch); distraction shows up primarily through head yaw (looking away) and posture. Our composite score is weighted toward drowsiness because that's the higher-severity, better-defined problem.

### 4. Who is the target user?
Two segments: individual drivers (a browser-based safety app) and fleet operators/insurers, where the dashboard aggregates driver sessions, alert history, and risk analytics. The fleet/insurer angle is our commercial differentiator over academic-only projects.

---

## B. System Architecture

### 5. Walk me through your architecture end-to-end.
The browser captures webcam frames via `getUserMedia()` and sends JPEG frames over a WebSocket to a Python FastAPI server (port 8000). Python runs MediaPipe + OpenCV, computes the five signals, fuses them into a composite score and alert level, and returns JSON. The Next.js frontend renders the live HUD and alerts. A separate NestJS backend (port 3001) handles auth, user profiles, and persistent session/alert storage in PostgreSQL.

### 6. Why send frames to a Python server instead of running ML in the browser?
MediaPipe and OpenCV are mature and accurate in Python, and keeping ML server-side lets us run heavier models (a CNN, a meta-classifier) without being limited by the browser. The trade-off is network latency and bandwidth — which is why we send compressed JPEGs and process per-frame statelessly except for per-session trackers.

### 7. Why WebSocket and not REST for the video stream?
Detection is continuous and bidirectional at ~30fps. REST would mean a new HTTP request per frame with connection overhead. WebSocket keeps one persistent connection — frames up, JSON results down — with much lower latency.

### 8. How do you keep per-driver state separate?
One `DetectionPipeline` instance is created per WebSocket connection. Each driver gets their own calibration, PERCLOS buffer, blink tracker, yawn counter, and smoothing state, so sessions never interfere.

### 9. What happens if two people are in frame?
MediaPipe is set to detect up to 2 faces, and we lock onto the *largest* face — the driver, closest to the camera — so a passenger can't silently steal tracking.

---

## C. The Detection Signals (technical core)

### 10. What is EAR and how do you compute it?
Eye Aspect Ratio — the ratio of vertical eye-opening to horizontal eye width, using 6 landmarks per eye from MediaPipe FaceMesh. We average left and right. When eyes close, the vertical distances shrink and EAR drops. It's our highest-weighted signal (0.30).

### 11. EAR never reaches zero even with eyes fully closed — how did you handle that?
Correct — with the 6-point formula, fully closed eyes bottom out around 0.10–0.15, not 0. Naively normalizing against 0 meant closed eyes only scored ~0.4–0.5 on our strongest signal, which structurally capped the composite below the critical threshold. We fixed this by mapping the range `[closed_level → threshold]` onto `[1 → 0]`, where closed_level is 55% of the personal threshold, so shut eyes correctly score ≈1.0.

### 12. What is PERCLOS and why is it important?
PERCLOS = percentage of time eyes are closed over a rolling window (we use 60 seconds). It's the industry-standard drowsiness metric because it distinguishes a normal quick blink from sustained micro-sleeps. A single closed frame means nothing; 30% closure over a minute is a strong drowsiness indicator. Weight 0.25.

### 13. What is MAR and how do you avoid confusing yawning with talking?
Mouth Aspect Ratio — vertical mouth opening over width, for yawning detection. Talking produces brief, oscillating openings; a yawn is a sustained wide opening. We use a dedicated YawnDetector that requires the mouth to stay open past a duration/threshold before counting it, rather than firing on any open mouth. Weight 0.20.

### 14. How do you compute head pose?
OpenCV's `solvePnP` maps 2D facial landmarks to a 3D face model to recover pitch, yaw, and roll. Pitch catches nodding (falling asleep), yaw catches looking away (distraction), roll catches head tilting. Weight 0.15.

### 15. How is posture measured?
MediaPipe Pose gives a 33-point skeleton. We measure forward lean and shoulder tilt relative to the driver's calibrated baseline to detect slouching or slumping. It's the lowest weight (0.10) because pose detection is the least reliable of the signals — it fails often in a seated, partially-occluded driving position, so we only feed it when the body is actually detected.

---

## D. Fusion & Decision Logic

### 16. How do you combine five signals into one decision?
Weighted linear fusion: `score = 0.30·EAR + 0.25·PERCLOS + 0.20·MAR + 0.15·pose + 0.10·posture`, clipped to [0,1]. That maps to four alert levels: Alert (<0.25), Mild, Warning, and Critical (>0.75), driving visual and audio alerts.

### 17. How did you choose those weights? Isn't that arbitrary?
**Be honest here.** The weights are expert-set based on the reliability and clinical relevance of each signal — EAR and PERCLOS are the most validated drowsiness indicators, so they get the most weight; posture the least because it's the noisiest. They're a defensible prior, not tuned magic numbers. The principled next step (and this is what an examiner wants to hear) is our **ablation study** and the learned meta-classifier that replaces hand-set weights with data-driven ones.

### 18. A linear weighted sum is simplistic. Why not train an end-to-end model?
We designed three stacked systems. System A is the rule-based fusion — always available, fully explainable, needs no data. System B is a fine-tuned MobileNetV2 CNN (4-class) on face crops. System C is an XGBoost meta-classifier stacked over A's and B's outputs to learn the optimal combination. The rule-based layer guarantees the product works even if models are absent, and gives us interpretability — critical for an insurance/safety context where you must justify every alert.

### 19. Your score jumps around frame to frame — how do you prevent flickering alerts?
Two mechanisms. First, an exponential moving average (α=0.3) smooths the composite score so a single noisy frame can't spike it. Second, **hysteresis** on the alert level: the threshold to escalate is higher than the threshold to de-escalate (e.g., go up to Level 2 at 0.77 but only drop back at 0.70). This prevents rapid oscillation at boundaries.

### 20. What is calibration and why do you need it?
People have different natural eye openings, face shapes, and sitting postures. For the first ~3 seconds we collect the driver's resting EAR and posture, then set a personal EAR threshold at 75% of their resting value and posture baselines from their own readings. Without this, someone with naturally narrow eyes would be flagged as constantly drowsy. If we don't get enough clean frames, we fall back to sensible defaults.

---

## E. Machine Learning & Training

### 21. What dataset did you train on and how is it labeled?
The **DMD (Driver Monitoring Dataset, Vicomtech)** — the distraction-RGB subset. Each video ships with an **OpenLABEL JSON** that labels, per frame, the driver's state across **7 parallel annotation tracks**. We use the `driver_actions/*` track (safe_drive, radio, drinking, reach_side, phonecall, texting, reach_backseat, …) and map those actions to our **4 alert levels** (safe→Alert; radio/drink/reach→Mild; phonecall→Warning; texting/reach-backseat→Critical). We extract 112×112 face crops per sampled frame plus the five rule-based signals. The split is **subject-independent** — train on group gA drivers, validate on gB, test on gC — so we evaluate on people the model never saw. *(Full details in `ai/MODEL_REPORT.md`.)*

### 22. How do you handle class imbalance?
**Honest answer.** "Alert" dominates (~50% of frames). We (1) apply **balanced class weights** in the CNN loss (weight ∝ 1/class-frequency, so a Critical error is penalized ~6× an Alert error), and (2) report **macro-F1 and ROC-AUC**, not raw accuracy — because a model that always predicts "Alert" would score ~51% accuracy yet be useless. Our System C reaches macro-F1 0.31 vs System B's 0.23 precisely because the ensemble is more *balanced*, not because it's more accurate.

### 23. Why MobileNetV2 specifically?
It's lightweight and fast enough for near-real-time CPU inference, which matters because we target commodity hardware with no GPU. We fine-tune a pretrained ImageNet backbone rather than training from scratch, since our dataset is too small to learn good features from zero. We export to ONNX for efficient runtime inference.

### 24. Why an XGBoost meta-classifier on top instead of trusting the CNN?
Stacking. The CNN sees pixels; the rule-based system sees interpretable geometric features (EAR, PERCLOS, etc.). They make different errors. XGBoost learns to weight their outputs, typically beating either alone, and gives us feature-importance for interpretability. It's a small model over a handful of features, so it's cheap and won't overfit easily.

### 25. How do you evaluate the system? What metrics?
Per-class precision, recall, F1, and confusion matrix on a held-out split — not just accuracy. For a safety system, **recall on the drowsy classes matters most** (a missed drowsy driver is far worse than a false alarm). We also run an ablation study, removing one signal at a time, to prove each modality contributes and to justify the fusion design.

---

## F. Limitations, Challenges & Ethics

### 26. What are the biggest limitations of your system?
**Honest list.** (1) **Face-only input limits distraction detection** — texting/phone are *hand* actions the face crop can't see, so Warning/Critical recall is low (their ROC-AUC is 0.6–0.77, so the signal exists, but the face view caps it); the fix is the hands/body camera. (2) Webcam vision fails in darkness — no IR, so night driving is weak. (3) Sunglasses defeat EAR. (4) Posture detection is unreliable in a seated driving pose. (5) Trained/tested on 3 drivers — a valid subject-independent split but small. (6) DMD's phone/texting clips are *acted* in a parked car. State these upfront rather than have the panel find them.

### 27. How does it perform in low light or at night?
Poorly with a standard RGB webcam — that's a known limitation. We do brightness normalization and detect low-light conditions to avoid emitting confident wrong scores, but the real solution is an IR/NIR camera, which we scope as future work.

### 28. What about privacy? You're recording a driver's face continuously.
Serious concern we address by design: detection is computed frame-by-frame and we don't need to persist raw video — we store derived metrics and alert events, not the video stream. For the insurance/evidence use case, any frame capture must be consent-based and access-controlled. This is a genuine ethical and legal consideration, not an afterthought.

### 29. What was the hardest technical challenge you faced?
Two, one per side. **Runtime:** scoring bugs that made the system structurally unable to reach a critical alert — the EAR normalization capping the top signal at ~0.5, and PERCLOS stuck at 0% from an over-aggressive closure threshold; we traced why fully-closed eyes never hit Level 3 and fixed the normalization math and closure definition. **Training:** matching the *real* DMD data — its labels are namespaced across 7 annotation tracks (`driver_actions/safe_drive` etc.), the folder nesting is group/subject/session, and the Colab environment had hard dependency conflicts (mediapipe needs protobuf 4.x but the default TensorFlow needs 5.x). We fixed the label parser, the discovery walk, and pinned a compatible stack (TF 2.17 + protobuf 4.25 + onnx 1.16). All documented in `ai/train_colab.py`.

### 30. If you had more time / how would you extend this?
IR camera for night driving; on-device inference to remove the server round-trip and improve privacy; real in-vehicle testing with actual drivers instead of dataset videos; personalized adaptive thresholds that learn over multiple sessions; and integrating the insurer risk-scoring engine so drowsiness patterns feed telematics-based premiums.

---

## G. Deep Technical (ML / implementation drill-down)

### 31. What is MobileNetV2's architecture — why is it efficient?
It uses **depthwise-separable convolutions** (a depthwise conv per channel + a 1×1 pointwise conv) instead of full convolutions, cutting compute ~8–9×. It also uses **inverted residual blocks with linear bottlenecks** — expand → depthwise → project — which keeps memory low. That's why it's 2.4 M params / 9.6 MB and runs in ~2 ms on CPU.

### 32. Why 112×112 input instead of the usual 224×224?
Half the resolution = ~4× less compute, and a face crop doesn't need 224² detail to read eye/mouth/head state. It keeps per-frame latency inside our real-time budget.

### 33. Why freeze the backbone first, then unfreeze only the last 30 layers?
**Two-phase transfer learning.** Phase 1 trains the new head on frozen ImageNet features so the randomly-initialized head doesn't send huge gradients that wreck the pretrained weights. Phase 2 unfreezes the *last* 30 layers (the most task-specific ones) at a low LR to adapt high-level features to faces/distraction, while early layers (generic edges/textures) stay frozen — we don't have enough data to retrain them safely.

### 34. What loss function, and why?
**Sparse categorical cross-entropy** — standard for single-label multi-class classification with integer labels and a softmax output. Combined with balanced class weights for imbalance.

### 35. How exactly are class weights computed?
`weight_c = n_samples / (n_classes × count_c)` (sklearn "balanced"). For our data that's roughly Alert 0.50, Mild 0.91, Warning 1.73, Critical 3.14 — so a Critical mistake costs ~6× an Alert mistake during training.

### 36. Which augmentations did you use and why those?
Horizontal flip, ±10% rotation, ±10% zoom, ±30% brightness, small Gaussian noise. They simulate real webcam variation (head tilt, distance, lighting, sensor noise). We do **not** vertical-flip — an upside-down face is unrealistic and would hurt.

### 37. You scale features before XGBoost — but trees don't need scaling. Why?
**Honest/gotcha answer.** Correct — gradient-boosted trees are scale-invariant, so `StandardScaler` is *unnecessary* for XGBoost. We keep it because the **Logistic Regression baseline** (trained on the same vector) *does* need it, and using one pipeline for both keeps the comparison clean. It doesn't hurt the trees.

### 38. How did you know System B was overfitting?
During Phase 2, **training accuracy rose (0.28→0.40) while validation loss rose (1.04→1.17)** and val-accuracy stalled at the majority baseline. Train improving while val degrades is the textbook overfitting signature. Mitigations already in place: dropout (0.3), heavy augmentation, class weights, **early stopping** (restore best weights), and ReduceLROnPlateau.

### 39. Explain precision, recall, F1 — and macro vs weighted average.
Precision = TP/(TP+FP) (of what I flagged, how much was right). Recall = TP/(TP+FN) (of the real cases, how many I caught). F1 = harmonic mean. **Macro** averages the per-class F1 equally (so rare classes count as much as common ones); **weighted** averages by support (dominated by the majority). We lead with **macro** because it exposes weakness on the rare, safety-critical classes.

### 40. What is ROC-AUC, and why report it over accuracy here?
The ROC curve plots true-positive vs false-positive rate as the decision threshold sweeps; **AUC = probability the model ranks a random positive above a random negative**. It's **threshold-independent and imbalance-robust**, so it measures whether the model *separates* the classes regardless of the majority bias that inflates accuracy. We compute it one-vs-rest per class.

### 41. How can AUC be 0.77 for Warning while its recall is ~0?
Because AUC measures **ranking**, recall measures a **single threshold's decisions**. The model assigns Warning frames higher Warning-probability than non-Warning frames (good ranking → high AUC), but `argmax` still picks the majority "Alert" because of class imbalance. Fix = threshold tuning / calibration, not more training.

### 42. Why a subject-independent split? What would a random split hide?
A random frame split would put the *same driver* in train and test, so the CNN could memorize that face and score high without generalizing — **data leakage**. Splitting by subject (gA/gB/gC) forces evaluation on unseen people, which is the honest measure for a real product.

### 43. What exactly is in the System C feature vector?
11 features per frame: `composite_A, level_A, ear, perclos, mar, pose, posture` (System A's 7) **+** `cnn_p_alert, cnn_p_mild, cnn_p_warning, cnn_p_critical` (System B's 4 softmax probs). So C sees both the interpretable signals and the CNN's opinion.

### 44. What is ONNX and why export to it?
ONNX is a framework-neutral model format. We train in TensorFlow/Keras but serve via **ONNX Runtime**, so the production server needs **no TensorFlow** (saving ~500 MB and a slow cold-start), runs fast on CPU, and is portable. We used opset 13.

### 45. What's your real-time latency budget and where does the time go?
At 30 fps we have ~33 ms/frame. The dominant cost is **MediaPipe** landmark extraction (a few ms) + **ONNX** inference (~1–3 ms) + the rule math (negligible). We comfortably fit the budget on CPU.

### 46. Walk me through the head-pose math (solvePnP).
We take 6 known 3D points of a canonical face model and their 2D landmark positions, assume camera intrinsics (focal length ≈ image width, principal point = image center, no distortion), and solve the **Perspective-n-Point** problem for the rotation vector. `Rodrigues` converts it to a rotation matrix, then we decompose to Euler angles (pitch/yaw/roll). We **unwrap** angles near ±180° because a frontal face can otherwise read as flipped.

### 47. Why sample every 3rd frame (FRAME_SKIP) in training?
Consecutive video frames are nearly identical — training on all of them adds compute and redundancy without new information. Sampling ~10 fps from 30 fps gives temporal diversity while cutting extraction time.

### 48. What does the EMA α=0.3 actually do?
`score_t = 0.3·new + 0.7·score_{t-1}` — a low-pass filter with an effective memory of ~1/(1−α) ≈ 3 frames. It suppresses single-frame spikes so one bad landmark reading can't trigger an alarm.

### 49. How does MediaPipe FaceMesh get 468 landmarks?
A lightweight face detector (BlazeFace) finds the face, then a regression network predicts 468 3D mesh vertices; `refine_landmarks=True` adds detailed iris/eye points. It runs real-time on CPU, which is why we chose it over dlib.

### 50. If you had to improve accuracy the most with one change, what is it?
Feed the CNN the **hands/body camera (or the aligned mosaic)** instead of the face crop — that's where the phone/hands are, which is exactly the information a face view lacks for distraction. Second-best: threshold calibration for the minority classes.

---

## Two things that will save you in the viva
- When you don't know an exact number, say **what you measured and how** — examiners reward honest methodology over confident guessing.
- Your strongest defensible line is **"rule-based for reliability and explainability, ML on top for accuracy"** — lean on it whenever they push on "why is this simplistic."
