import cv2
import numpy as np

# 6 canonical 3D face model points (mm).
# NOTE: Y and Z are oriented for image coordinates (Y grows DOWN, matching
# landmark pixel coords). A Y-up model is mirrored relative to the image, so
# solvePnP returns a ~180° rotation and pitch reads ~178° for a straight face
# instead of ~0°. Image-oriented model → a frontal face resolves to ~(0,0,0).
_MODEL_3D = np.array([
    ( 0.0,   0.0,   0.0),    # nose tip
    ( 0.0,  63.6,  12.5),    # chin              (below nose → +Y)
    (-43.3, -32.7, 26.0),    # left eye corner   (above nose → -Y)
    ( 43.3, -32.7, 26.0),    # right eye corner
    (-28.9,  28.9, 24.1),    # left mouth corner (below nose → +Y)
    ( 28.9,  28.9, 24.1),    # right mouth corner
], dtype=np.float64)

# Matching MediaPipe FaceMesh landmark indices
_POSE_IDX = [4, 152, 33, 263, 61, 291]


def _unwrap(angle: float) -> float:
    """Fold a ±180°-wrapped Euler angle back into [-90, 90]. Head pose never
    legitimately exceeds ~90° on any axis while the face is still visible."""
    if angle > 90:
        angle -= 180
    elif angle < -90:
        angle += 180
    return angle


def compute_head_pose(
    landmarks, w: int, h: int
) -> tuple[float, float, float]:
    """
    Returns (pitch, yaw, roll) in degrees using cv2.solvePnP.
    Pitch > 0 = nodding down, Yaw > 0 = looking right, Roll > 0 = tilting right.
    """
    img_pts = np.array(
        [(landmarks[i].x * w, landmarks[i].y * h) for i in _POSE_IDX],
        dtype=np.float64,
    )
    fl = float(w)
    cam = np.array([[fl, 0, w/2], [0, fl, h/2], [0, 0, 1]], dtype=np.float64)

    ok, rvec, _ = cv2.solvePnP(
        _MODEL_3D, img_pts, cam, np.zeros((4, 1)),
        flags=cv2.SOLVEPNP_ITERATIVE,
    )
    if not ok:
        return 0.0, 0.0, 0.0

    rmat, _ = cv2.Rodrigues(rvec)
    angles, *_ = cv2.RQDecomp3x3(rmat)
    return _unwrap(angles[0]), _unwrap(angles[1]), _unwrap(angles[2])


def normalise_pose(pitch: float, yaw: float, roll: float) -> float:
    """Returns a 0–1 score: 0 = head straight, 1 = head at max deviation."""
    return float(min(1.0, max(
        abs(pitch) / 30.0,
        abs(yaw)   / 35.0,
        abs(roll)  / 20.0,
    )))
