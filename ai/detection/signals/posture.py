import numpy as np

# MediaPipe Pose landmark indices
_L_SHOULDER = 11
_R_SHOULDER = 12
_L_EAR      = 7
_R_EAR      = 8

_DEFAULT_LEAN = 0.30
_DEFAULT_TILT = 0.05

# Below this MediaPipe visibility the joint is out of frame / occluded and its
# coordinates are unreliable — computing posture from them yields garbage.
_MIN_VISIBILITY = 0.5


def pose_reliable(pose_landmarks) -> bool:
    """True only when both shoulders and both ears are confidently visible."""
    pl = pose_landmarks.landmark
    return all(
        pl[i].visibility >= _MIN_VISIBILITY
        for i in (_L_SHOULDER, _R_SHOULDER, _L_EAR, _R_EAR)
    )


def measure_posture(pose_landmarks) -> tuple[float, float]:
    """Raw (forward_lean, shoulder_tilt) — used both live and during calibration."""
    pl = pose_landmarks.landmark
    ls, rs = pl[_L_SHOULDER], pl[_R_SHOULDER]
    le, re = pl[_L_EAR], pl[_R_EAR]

    shoulder_mid = np.array([(ls.x + rs.x) / 2, (ls.y + rs.y) / 2])
    ear_mid      = np.array([(le.x + re.x) / 2, (le.y + re.y) / 2])

    forward_lean  = float(np.linalg.norm(ear_mid - shoulder_mid))
    shoulder_tilt = float(np.arctan2(abs(ls.y - rs.y), abs(ls.x - rs.x) + 1e-6))
    return forward_lean, shoulder_tilt


def compute_posture(
    pose_landmarks,
    baseline_lean: float = _DEFAULT_LEAN,
    baseline_tilt: float = _DEFAULT_TILT,
) -> float:
    """
    Returns a 0–1 posture deviation score.
    0 = upright (calibrated baseline), 1 = severe slouch/tilt.
    Both lean and tilt are measured as deviations from the calibrated baseline.
    """
    forward_lean, shoulder_tilt = measure_posture(pose_landmarks)

    lean_dev = abs(forward_lean - baseline_lean) / 0.15
    tilt_dev = abs(shoulder_tilt - baseline_tilt) / 0.35

    return float(min(1.0, lean_dev * 0.6 + tilt_dev * 0.4))
