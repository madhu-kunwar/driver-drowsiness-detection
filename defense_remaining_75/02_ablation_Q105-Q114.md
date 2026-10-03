# Ablation Study — Questions 105–114

## 105. What is an ablation study, and why did you perform one?

An ablation study measures performance as components are removed or added. We used it to examine whether the five-cue design changes behaviour beyond using EAR alone.

## 106. Why did accuracy decrease as additional signals were added?

The DMD labels emphasize distraction, while several added cues emphasize drowsiness. The extra cues moved predictions away from the dominant Alert class, reducing majority-driven accuracy while producing somewhat more balanced class behaviour.

## 107. If adding signals reduced accuracy, how can you claim multimodal fusion is better?

We should not claim it is better on every metric. In this experiment, all five cues reduced raw accuracy but raised macro-F1 from 20.1% to 24.3%, showing a trade-off between majority-class accuracy and balanced recognition.

## 108. Which signal produced the largest improvement in macro-F1?

In the progressive table, adding head pose after EAR, PERCLOS, and MAR raised macro-F1 from 20.2% to 24.9%, the largest positive step. Because the experiment is progressive rather than isolated, this does not measure head pose independently.

## 109. Why did adding PERCLOS initially reduce macro-F1?

PERCLOS is a sustained eye-closure measure, but the DMD test labels mainly represent distraction actions. It may therefore add limited alignment with those labels while shifting decisions in a way that harms the fixed configuration.

## 110. Were signals removed one at a time or added progressively?

They were added progressively: EAR only, then PERCLOS, MAR, head pose, and finally posture. This shows the cumulative path but is not a complete leave-one-feature-out study.

## 111. Would leave-one-cue-out ablation provide stronger evidence?

Yes. Removing each cue from the full five-cue system, while keeping the others fixed, would better estimate its marginal contribution; repeating the analysis with re-optimized weights would be stronger still.

## 112. Does the ablation prove that every signal is necessary?

No. It shows that the progressive cue sets produce different results, but it does not prove that every cue is independently necessary under all conditions.

## 113. Were the fusion weights recalibrated for each ablation configuration?

The camera-ready paper does not report re-optimizing weights for every ablation stage. Therefore, the results describe the fixed progressive design and should not be treated as each subset’s optimum.

## 114. Could the ablation results be caused by the mismatch between drowsiness features and distraction labels?

Yes, and the paper explicitly uses that interpretation. Drowsiness-oriented cues are being evaluated against distraction-oriented action labels, so broader testing on drowsiness-specific datasets is necessary.

