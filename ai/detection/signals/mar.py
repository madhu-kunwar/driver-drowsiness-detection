import numpy as np

OUTER_LIP = [78, 82, 87, 13, 312, 317, 402, 308]

YAWN_THRESHOLD  = 0.60   # MAR must exceed this
YAWN_FRAMES_MIN = 45     # sustained for 1.5s at 30fps


def compute_mar(landmarks) -> float:
    p = [np.array([landmarks[i].x, landmarks[i].y]) for i in OUTER_LIP]
    A = np.linalg.norm(p[1] - p[7])
    B = np.linalg.norm(p[2] - p[6])
    C = np.linalg.norm(p[3] - p[5])
    D = np.linalg.norm(p[0] - p[4])
    return float((A + B + C) / (2.0 * D + 1e-6))


def normalise_mar(mar: float) -> float:
    return float(np.clip((mar - 0.30) / 0.60, 0.0, 1.0))


class YawnDetector:
    def __init__(self):
        self._counter = 0
        self.yawn_count = 0

    def update(self, mar: float) -> bool:
        if mar > YAWN_THRESHOLD:
            self._counter += 1
        else:
            # Hysteresis: decay rather than instant reset
            self._counter = max(0, self._counter - 2)

        yawning = self._counter >= YAWN_FRAMES_MIN

        # Rising edge — count new yawn events
        if yawning and self._counter == YAWN_FRAMES_MIN:
            self.yawn_count += 1

        return yawning

    def reset(self):
        self._counter = 0
        self.yawn_count = 0
