# Eye Aspect Ratio (EAR) Research Notes

## Formula
EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)

Where p1-p6 are the 6 eye landmarks.

## Threshold
- EAR < 0.25 for ~20 consecutive frames indicates drowsiness
- Based on Soukupová & Čech (2016) paper

## Implementation Notes
- Use MediaPipe Face Mesh for 468 landmarks
- Extract relevant eye landmark indices
- Calculate EAR for both eyes and average
