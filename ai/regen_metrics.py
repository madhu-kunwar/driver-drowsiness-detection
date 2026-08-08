"""
Regenerate the report artifacts that the interrupted Colab run never produced:
  - ablation_results.json
  - confusion_matrices.png
  - roc_curves.png

Runs entirely locally from the cached TEST features + the DEPLOYED models, so
the numbers match exactly what is in ai/models/. No Colab, no retraining.

    python regen_metrics.py
"""
import os
import json
import time
import pickle
from dataclasses import dataclass
from typing import Optional

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import onnxruntime as ort
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_curve, auc,
)
from sklearn.preprocessing import label_binarize

HERE        = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR  = os.path.join(HERE, "models")
FEATS_TEST  = os.path.join(MODELS_DIR, "features_test_4d1c2aa4.pkl")
ONNX_PATH   = os.path.join(MODELS_DIR, "drowsy_mobilenetv2.onnx")
META_PATH   = os.path.join(MODELS_DIR, "meta_classifier.pkl")
RESULTS_JSON= os.path.join(MODELS_DIR, "ablation_results.json")
FRONTEND_JSON = os.path.join(HERE, "..", "frontend", "public", "ablation_results.json")

IMG_SIZE    = 112
CLASS_NAMES = ["Alert", "Mild", "Warning", "Critical"]

# ── System A constants (identical to train_colab.py) ─────────────────────
WEIGHTS_A = {"ear": 0.30, "perclos": 0.25, "mar": 0.20, "pose": 0.15, "posture": 0.10}
ABLATION_CONFIGS = {
    "EAR only":         {"ear": 1.00, "perclos": 0.00, "mar": 0.00, "pose": 0.00, "posture": 0.00},
    "EAR + PERCLOS":    {"ear": 0.55, "perclos": 0.45, "mar": 0.00, "pose": 0.00, "posture": 0.00},
    "+ MAR":            {"ear": 0.40, "perclos": 0.33, "mar": 0.27, "pose": 0.00, "posture": 0.00},
    "+ Head Pose":      {"ear": 0.33, "perclos": 0.28, "mar": 0.22, "pose": 0.17, "posture": 0.00},
    "All 5 (System A)": WEIGHTS_A,
}


def system_a_score(ear_s, perclos_s, mar_s, pose_s, posture_s, weights=WEIGHTS_A):
    raw = (ear_s * weights["ear"] + perclos_s * weights["perclos"] +
           mar_s * weights["mar"] + pose_s * weights["pose"] +
           posture_s * weights["posture"])
    return float(np.clip(raw, 0.0, 1.0))


def score_to_level(score):
    if score < 0.25: return 0
    if score < 0.50: return 1
    if score < 0.75: return 2
    return 3


# ── The dataclass the cache was pickled with ─────────────────────────────
@dataclass
class Sample:
    ear_score:     float
    perclos_score: float
    mar_score:     float
    pose_score:    float
    posture_score: float
    face_crop:     Optional[np.ndarray]
    label:         int


class _SampleUnpickler(pickle.Unpickler):
    # Map the cached "Sample" to our local class regardless of the module it
    # was pickled under (Colab pickles it as __main__.Sample).
    def find_class(self, module, name):
        if name == "Sample":
            return Sample
        return super().find_class(module, name)


def metrics(y_true, y_pred):
    return {
        "accuracy":  accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, average="macro", zero_division=0),
        "recall":    recall_score(y_true, y_pred, average="macro", zero_division=0),
        "f1":        f1_score(y_true, y_pred, average="macro", zero_division=0),
    }


def main():
    print(f"Loading test features … {FEATS_TEST}")
    with open(FEATS_TEST, "rb") as f:
        test_samples = _SampleUnpickler(f).load()
    print(f"  {len(test_samples)} test samples")

    y_true = np.array([s.label for s in test_samples], dtype=np.int32)

    # ── Face-crop stack for the CNN (zeros where no face was detected) ────
    crops = np.stack([
        (s.face_crop.astype(np.float32) / 255.0
         if s.face_crop is not None
         else np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.float32))
        for s in test_samples
    ])

    # ── System B — ONNX CNN probabilities ────────────────────────────────
    sess = ort.InferenceSession(ONNX_PATH, providers=["CPUExecutionProvider"])
    inp  = sess.get_inputs()[0].name
    cnn_probs = []
    for i in range(0, len(crops), 128):
        cnn_probs.append(sess.run(None, {inp: crops[i:i + 128]})[0])
    cnn_probs = np.concatenate(cnn_probs, axis=0)
    cnn_preds = np.argmax(cnn_probs, axis=1)

    # latency benchmark (single frame)
    dummy = np.random.rand(1, IMG_SIZE, IMG_SIZE, 3).astype(np.float32)
    times = []
    for _ in range(50):
        t0 = time.perf_counter(); sess.run(None, {inp: dummy}); times.append((time.perf_counter() - t0) * 1000)
    p50, p95 = float(np.percentile(times, 50)), float(np.percentile(times, 95))

    # ── System A predictions (default weights) ───────────────────────────
    y_pred_a = np.array([
        score_to_level(system_a_score(s.ear_score, s.perclos_score, s.mar_score,
                                      s.pose_score, s.posture_score))
        for s in test_samples
    ])

    # ── System C — meta-classifier ───────────────────────────────────────
    with open(META_PATH, "rb") as f:
        bundle = pickle.load(f)
    scaler, meta_model = bundle["scaler"], bundle["model"]
    X_meta = []
    for idx, s in enumerate(test_samples):
        sa = system_a_score(s.ear_score, s.perclos_score, s.mar_score, s.pose_score, s.posture_score)
        la = score_to_level(sa)
        p0, p1, p2, p3 = cnn_probs[idx]
        X_meta.append([sa, float(la), s.ear_score, s.perclos_score, s.mar_score,
                       s.pose_score, s.posture_score, p0, p1, p2, p3])
    X_meta   = np.array(X_meta, dtype=np.float32)
    X_meta_sc = scaler.transform(X_meta)
    y_pred_c  = meta_model.predict(X_meta_sc)
    meta_probs = meta_model.predict_proba(X_meta_sc)

    # ── Metrics ──────────────────────────────────────────────────────────
    m_a, m_b, m_c = metrics(y_true, y_pred_a), metrics(y_true, cnn_preds), metrics(y_true, y_pred_c)
    print("\nSYSTEM COMPARISON (DMD test set)")
    for name, m in [("A rule-based", m_a), ("B MobileNetV2", m_b), ("C ensemble", m_c)]:
        print(f"  {name:15s} Acc={m['accuracy']:.1%}  P={m['precision']:.1%}  "
              f"R={m['recall']:.1%}  F1={m['f1']:.1%}")
    print("\nSystem C report:\n", classification_report(y_true, y_pred_c, target_names=CLASS_NAMES, zero_division=0))

    # ── Ablation (System A weight configs) ───────────────────────────────
    ablation = {}
    for cfg, w in ABLATION_CONFIGS.items():
        preds = np.array([score_to_level(system_a_score(
            s.ear_score, s.perclos_score, s.mar_score, s.pose_score, s.posture_score, weights=w))
            for s in test_samples])
        ablation[cfg] = metrics(y_true, preds)

    # ── confusion_matrices.png (A / B / C) ───────────────────────────────
    fig, axes = plt.subplots(1, 3, figsize=(15, 4))
    for ax, (name, preds) in zip(axes, [("System A", y_pred_a), ("System B", cnn_preds), ("System C", y_pred_c)]):
        cm = confusion_matrix(y_true, preds, labels=[0, 1, 2, 3])
        im = ax.imshow(cm, cmap="Greens")
        ax.set_xticks(range(4)); ax.set_yticks(range(4))
        ax.set_xticklabels(CLASS_NAMES, rotation=45, ha="right"); ax.set_yticklabels(CLASS_NAMES)
        ax.set_title(name); ax.set_xlabel("Predicted"); ax.set_ylabel("True")
        for i in range(4):
            for j in range(4):
                ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                        color="white" if cm[i, j] > cm.max() / 2 else "black", fontsize=9)
    plt.tight_layout()
    cm_path = os.path.join(MODELS_DIR, "confusion_matrices.png")
    plt.savefig(cm_path, dpi=150); plt.close()
    print(f"\nSaved → {cm_path}")

    # ── roc_curves.png (B & C, one-vs-rest) ──────────────────────────────
    y_bin = label_binarize(y_true, classes=[0, 1, 2, 3])
    def plot_roc(ax, probs, title):
        aucs = {}
        for i, c in enumerate(CLASS_NAMES):
            if y_bin[:, i].sum() == 0:
                continue
            fpr, tpr, _ = roc_curve(y_bin[:, i], probs[:, i])
            a = auc(fpr, tpr); aucs[c] = float(a)
            ax.plot(fpr, tpr, label=f"{c} (AUC={a:.2f})")
        if aucs:
            aucs["macro"] = float(np.mean(list(aucs.values())))
        ax.plot([0, 1], [0, 1], "k--", alpha=0.4)
        ax.set_xlim(0, 1); ax.set_ylim(0, 1.02)
        ax.set_xlabel("False Positive Rate"); ax.set_ylabel("True Positive Rate")
        ax.set_title(title); ax.legend(loc="lower right", fontsize=8)
        return aucs
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    auc_b = plot_roc(axes[0], cnn_probs,  "System B — MobileNetV2 ROC (OvR)")
    auc_c = plot_roc(axes[1], meta_probs, "System C — Ensemble ROC (OvR)")
    plt.tight_layout()
    roc_path = os.path.join(MODELS_DIR, "roc_curves.png")
    plt.savefig(roc_path, dpi=150); plt.close()
    print(f"Saved → {roc_path}")

    # ── ablation_results.json ────────────────────────────────────────────
    final = {
        "dataset": "DMD-Vicomtech (distraction-rgb-ir)",
        "ablation": {k: {kk: round(vv * 100, 2) for kk, vv in v.items()} for k, v in ablation.items()},
        "systems": {
            "A": {k: round(v * 100, 2) for k, v in m_a.items()},
            "B": {k: round(v * 100, 2) for k, v in m_b.items()},
            "C": {k: round(v * 100, 2) for k, v in m_c.items()},
        },
        "onnx_latency_ms": {"p50": round(p50, 1), "p95": round(p95, 1)},
        "roc_auc": {"B": {k: round(v, 3) for k, v in auc_b.items()},
                    "C": {k: round(v, 3) for k, v in auc_c.items()}},
        "train_groups": ["gA"], "val_groups": ["gB"], "test_groups": ["gC"],
        "note": "3-driver subject-independent split; regenerated locally from deployed models.",
    }
    with open(RESULTS_JSON, "w") as f:
        json.dump(final, f, indent=2)
    print(f"Saved → {RESULTS_JSON}")
    try:
        os.makedirs(os.path.dirname(FRONTEND_JSON), exist_ok=True)
        with open(FRONTEND_JSON, "w") as f:
            json.dump(final, f, indent=2)
        print(f"Saved → {os.path.normpath(FRONTEND_JSON)}")
    except Exception as e:
        print(f"[warn] could not write frontend copy: {e}")

    print("\nDone — all three artifacts regenerated.")


if __name__ == "__main__":
    main()
