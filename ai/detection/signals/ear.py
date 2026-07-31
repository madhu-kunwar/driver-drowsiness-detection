from collections import deque
import numpy as np

LEFT_EYE  = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33,  160, 158, 133, 153, 144]

def _ear_single(lm, indices) -> float:
    p = [np.array([lm[i].x, lm[i].y]) for i in indices]
    A = np.linalg.norm(p[1] - p[5])
    B = np.linalg.norm(p[2] - p[4])
    C = np.linalg.norm(p[0] - p[3])
    return float((A + B) / (2.0 * C + 1e-6))


def compute_ear(landmarks) -> float:
    return (_ear_single(landmarks, LEFT_EYE) + _ear_single(landmarks, RIGHT_EYE)) / 2.0


# EAR at full eye closure never reaches 0 with the 6-point formula — it bottoms
# out around 0.10–0.15. Normalising against 0 (the old code) meant fully closed
# eyes only scored ~0.4–0.5 on the strongest, highest-weighted drowsiness signal,
# which structurally capped the composite score below the Level-3 threshold.
# Map [closed_level → threshold] onto [1 → 0] so shut eyes score ≈ 1.0.
_EAR_CLOSED_FRACTION = 0.55   # ear at/below 55% of threshold == fully closed


def normalise_ear(ear: float, threshold: float) -> float:
    closed_level = threshold * _EAR_CLOSED_FRACTION
    span = threshold - closed_level
    return float(np.clip((threshold - ear) / (span + 1e-6), 0.0, 1.0))


class PerclosTracker:
    """Rolling 60-second PERCLOS window."""

    def __init__(self, fps: float = 30.0, window_s: float = 60.0):
        self._buf: deque[int] = deque(maxlen=max(int(fps * window_s), 1))
        self.fps = fps

    def update(self, ear: float, threshold: float) -> float:
        # A frame counts as "eyes closed" when EAR falls below the calibrated
        # threshold (0.75 × resting EAR). This is the same closure definition
        # used by BlinkTracker. The previous code multiplied by 0.20 on top,
        # demanding EAR < ~0.04 — a level real closed eyes never reach — so
        # PERCLOS was stuck at 0% permanently.
        self._buf.append(1 if ear < threshold else 0)
        if not self._buf:
            return 0.0
        return (sum(self._buf) / len(self._buf)) * 100.0

    def reset(self):
        self._buf.clear()


class BlinkTracker:
    """Counts blinks and returns blinks-per-minute over a 60s window."""

    def __init__(self, fps: float = 30.0):
        self._buf: deque[int] = deque(maxlen=max(int(fps * 60), 1))
        self._was_closed = False

    def update(self, ear: float, threshold: float) -> float:
        is_closed = ear < threshold
        # Rising edge on reopening = one complete blink
        blink = int(self._was_closed and not is_closed)
        self._was_closed = is_closed
        self._buf.append(blink)
        window_s = len(self._buf) / 30.0
        return round((sum(self._buf) / max(window_s, 1e-6)) * 60.0, 1)

    def reset(self):
        self._buf.clear()
        self._was_closed = False
