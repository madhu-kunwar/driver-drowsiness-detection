# Limitations and Future Work — Questions 154–165

## 154. What is the most serious limitation of your research?

The most serious limitation is that the face-only view and class imbalance prevent reliable recognition of severe hand-based distraction, especially the Critical class.

## 155. Which claim should be interpreted most cautiously?

The claim of joint drowsiness and distraction monitoring should be interpreted cautiously because the experimental labels emphasize distraction, while several rule-based cues target drowsiness, and broader benchmark validation remains incomplete.

## 156. Why do you describe the results as preliminary?

The study uses a small three-driver subject-independent split, contains severe class imbalance, lacks robust Critical detection, and does not fully test lighting, eyewear, occlusion, seating, or real-road conditions.

## 157. What additional data would most improve the system?

More subject-diverse video with synchronized face, hands, and upper-body views; more Warning and Critical events; genuine drowsiness sequences; and varied lighting, eyewear, seating, and camera positions would be most valuable.

## 158. Would adding a hands/body camera solve the Critical-class problem?

It would address the main missing-information problem because texting and reaching are visible in the hands and body. It would not solve everything: more minority examples, temporal modeling, calibration, and validation would still be required.

## 159. Why not use the full-body or hands view already available in DMD?

The evaluated CNN used face crops to preserve a lightweight single-camera facial pipeline. In retrospect, using aligned hands/body views is the clearest next experiment and is directly motivated by the Critical-class failure.

## 160. Would an LSTM, temporal CNN, or transformer be better for video sequences?

Potentially, because prolonged closure, yawning, nodding, and distraction are temporal events. The correct answer requires comparison under the same subject-independent split rather than assuming a more complex model is automatically better.

## 161. How would you optimize the fusion weights using data?

Optimize them only on training and validation subjects using a class-aware objective such as macro-F1 or balanced accuracy, constrain the weights if interpretability is required, and report final performance once on untouched test subjects.

## 162. How would you improve minority-class recall?

Collect more minority data, add hands/body context, use balanced sampling or class-aware losses, tune per-class thresholds on validation data, calibrate probabilities, and evaluate temporal models.

## 163. What experiment would you perform next with one additional month?

We would add the DMD hands/body view, retrain under the same subject-independent protocol, tune class thresholds only on validation data, and compare Critical recall and macro-F1 against the face-only baseline.

## 164. What changes are required before commercial deployment?

The system needs larger and more diverse validation, robust severe-class detection, end-to-end performance measurement, low-light capability, failure detection, privacy and cybersecurity controls, fairness analysis, human-factors testing, and relevant regulatory approval.

## 165. If you repeated the project from the beginning, what would you do differently?

We would align the sensing view and dataset labels with the target problem from the beginning, include hands/body and drowsiness-specific data, recruit more subjects, predefine class-aware metrics, and design robustness and timing experiments alongside implementation.

