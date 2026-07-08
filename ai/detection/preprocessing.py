import cv2
import numpy as np


def decode_jpeg(data: bytes) -> np.ndarray:
    """Decode JPEG bytes from browser WebSocket into a BGR numpy array."""
    arr = np.frombuffer(data, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Failed to decode JPEG frame")
    return frame


def resize_frame(frame: np.ndarray, w: int = 640, h: int = 480) -> np.ndarray:
    if frame.shape[1] != w or frame.shape[0] != h:
        frame = cv2.resize(frame, (w, h), interpolation=cv2.INTER_AREA)
    return frame


def apply_clahe(frame_bgr: np.ndarray) -> np.ndarray:
    """Boost contrast in low-light frames using CLAHE on the L channel."""
    lab = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)


def preprocess(frame_bgr: np.ndarray) -> tuple[np.ndarray, bool]:
    """
    Full preprocessing pipeline.
    Returns (processed_bgr, low_light_flag).
    """
    frame_bgr = resize_frame(frame_bgr)
    low_light = frame_bgr.mean() < 60
    if low_light:
        frame_bgr = apply_clahe(frame_bgr)
    return frame_bgr, low_light
