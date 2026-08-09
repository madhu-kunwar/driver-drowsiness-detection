"""
Constants and configuration for the detection pipeline.
"""

# Eye Aspect Ratio thresholds
EAR_THRESHOLD = 0.25
EAR_CONSEC_FRAMES = 20  # Number of consecutive frames below threshold

# Mouth Aspect Ratio thresholds  
MAR_THRESHOLD = 0.6
MAR_CONSEC_FRAMES = 15

# Head pose thresholds (degrees)
HEAD_TILT_THRESHOLD = 30  # Side tilt angle
HEAD_NOD_THRESHOLD = 25   # Forward nod angle

# Alert levels
ALERT_NONE = 0
ALERT_WARNING = 1
ALERT_DANGER = 2

# MediaPipe Face Mesh landmark indices for eyes
LEFT_EYE_INDICES = [362, 385, 387, 263, 373, 380]
RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144]

# MediaPipe Face Mesh landmark indices for mouth
MOUTH_INDICES = [61, 291, 0, 17, 78, 308, 13, 14]

# Model confidence
MIN_DETECTION_CONFIDENCE = 0.7
MIN_TRACKING_CONFIDENCE = 0.5

# Performance
FRAME_PROCESS_INTERVAL = 2  # Process every Nth frame
MAX_NUM_FACES = 1
