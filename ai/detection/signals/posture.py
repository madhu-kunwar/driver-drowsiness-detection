import numpy as np

# MediaPipe Pose landmark indices
_L_SHOULDER = 11
_R_SHOULDER = 12
_L_EAR      = 7
_R_EAR      = 8

_DEFAULT_LEAN = 0.30
_DEFAULT_TILT = 0.05


def compute_posture(
    pose_landmarks,
    baseline_lean: float = _DEFAULT_LEAN,
    baseline_tilt: float = _DEFAULT_TILT,
) -> float:
    """
    Returns a 0–1 posture deviation score.
    0 = upright (calibrated baseline), 1 = severe slouch/tilt.
    """
    pl = pose_landmarks.landmark
    ls = pl[_L_SHOULDER]
    rs = pl[_R_SHOULDER]
    le = pl[_L_EAR]
    re = pl[_R_EAR]

    shoulder_mid = np.array([(ls.x + rs.x) / 2, (ls.y + rs.y) / 2])
    ear_mid      = np.array([(le.x + re.x) / 2, (le.y + re.y) / 2])

    forward_lean = float(np.linalg.norm(ear_mid - shoulder_mid))
    dx = abs(ls.x - rs.x)
    dy = abs(ls.y - rs.y)
    shoulder_tilt = float(np.arctan2(dy, dx + 1e-6))

    lean_dev = abs(forward_lean - baseline_lean) / 0.15
    tilt_dev = shoulder_tilt / 0.35

    return float(min(1.0, lean_dev * 0.6 + tilt_dev * 0.4))
