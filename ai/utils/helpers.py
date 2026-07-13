"""
Utility helper functions for the AI detection module.
"""
import numpy as np
from typing import List, Tuple


def calculate_ear(eye_landmarks: List[Tuple[float, float]]) -> float:
    """
    Calculate Eye Aspect Ratio (EAR) from 6 eye landmarks.
    
    EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
    
    Args:
        eye_landmarks: List of 6 (x, y) tuples for eye landmarks
    
    Returns:
        Float value of the EAR
    """
    p1, p2, p3, p4, p5, p6 = eye_landmarks
    
    # Vertical distances
    v1 = np.linalg.norm(np.array(p2) - np.array(p6))
    v2 = np.linalg.norm(np.array(p3) - np.array(p5))
    
    # Horizontal distance
    h = np.linalg.norm(np.array(p1) - np.array(p4))
    
    if h == 0:
        return 0.0
    
    ear = (v1 + v2) / (2.0 * h)
    return ear


def calculate_mar(mouth_landmarks: List[Tuple[float, float]]) -> float:
    """
    Calculate Mouth Aspect Ratio (MAR) for yawn detection.
    
    Args:
        mouth_landmarks: List of mouth landmark (x, y) tuples
    
    Returns:
        Float value of the MAR
    """
    if len(mouth_landmarks) < 8:
        return 0.0
    
    # Vertical distances (inner lip landmarks)
    v1 = np.linalg.norm(np.array(mouth_landmarks[2]) - np.array(mouth_landmarks[6]))
    v2 = np.linalg.norm(np.array(mouth_landmarks[3]) - np.array(mouth_landmarks[5]))
    
    # Horizontal distance
    h = np.linalg.norm(np.array(mouth_landmarks[0]) - np.array(mouth_landmarks[4]))
    
    if h == 0:
        return 0.0
    
    mar = (v1 + v2) / (2.0 * h)
    return mar
