import numpy as np

_DEFAULT_EAR_THRESHOLD    = 0.21
_DEFAULT_BASELINE_LEAN    = 0.30
_DEFAULT_BASELINE_TILT    = 0.05
_MIN_FRAMES_FOR_CALIBRATE = 30    # need at least 1s of data


class Calibration:
    """
    Collects landmark readings for the first ~3 seconds of a session
    and computes personal baselines for EAR threshold and posture.

    While is_complete is False the pipeline returns safe/neutral metrics.
    """

    def __init__(self):
        self._ear_readings: list[float] = []
        self._posture_readings: list[tuple[float, float]] = []
        self.is_complete = False

        # Calibrated values (set by finalise() or use_defaults())
        self.ear_threshold    = _DEFAULT_EAR_THRESHOLD
        self.baseline_lean    = _DEFAULT_BASELINE_LEAN
        self.baseline_tilt    = _DEFAULT_BASELINE_TILT

    def add_frame(
        self,
        ear: float,
        forward_lean: float | None = None,
        shoulder_tilt: float | None = None,
    ):
        if self.is_complete:
            return
        self._ear_readings.append(ear)
        # Only record posture when the body was actually detected this frame.
        # Injecting 0.0 on undetected frames dragged the baseline toward zero,
        # which then made every live frame read as a large posture deviation.
        if forward_lean is not None and shoulder_tilt is not None:
            self._posture_readings.append((forward_lean, shoulder_tilt))

    def finalise(self):
        if len(self._ear_readings) < _MIN_FRAMES_FOR_CALIBRATE:
            self.use_defaults()
            return

        ear_mean = float(np.mean(self._ear_readings))
        # Threshold = 75% of resting EAR
        self.ear_threshold = max(0.10, ear_mean * 0.75)

        if self._posture_readings:
            arr = np.array(self._posture_readings)
            self.baseline_lean = float(arr[:, 0].mean())
            self.baseline_tilt = float(arr[:, 1].mean())
        # else: no reliable pose during calibration — keep posture defaults

        self.is_complete = True

    def use_defaults(self):
        self.ear_threshold = _DEFAULT_EAR_THRESHOLD
        self.baseline_lean = _DEFAULT_BASELINE_LEAN
        self.baseline_tilt = _DEFAULT_BASELINE_TILT
        self.is_complete   = True
