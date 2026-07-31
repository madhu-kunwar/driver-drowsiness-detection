import numpy as np

# Index positions:  0=left corner  1=upper-L  2=lower-L  3=upper-center
#                    4=upper-R      5=lower-R  6=lower-center  7=right corner
OUTER_LIP = [78, 82, 87, 13, 312, 317, 402, 308]

YAWN_THRESHOLD  = 0.60   # MAR must exceed this
YAWN_FRAMES_MIN = 45     # sustained for 1.5s at 30fps


def compute_mar(landmarks) -> float:
    """
    Mouth Aspect Ratio = mean vertical lip gap / horizontal mouth width.
    The three numerator terms MUST pair vertically aligned upper/lower lip
    points; the denominator is the corner-to-corner width. Pairing an upper
    lip point with a mouth corner (a diagonal) inflates MAR so badly that a
    closed mouth reads ~0.88 and trips the yawn detector constantly.
    """
    p = [np.array([landmarks[i].x, landmarks[i].y]) for i in OUTER_LIP]
    A = np.linalg.norm(p[1] - p[2])   # left   vertical (82 ↔ 87)
    B = np.linalg.norm(p[4] - p[5])   # right  vertical (312 ↔ 317)
    C = np.linalg.norm(p[3] - p[6])   # center vertical (13 ↔ 402)
    D = np.linalg.norm(p[0] - p[7])   # horizontal width (78 ↔ 308)
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
