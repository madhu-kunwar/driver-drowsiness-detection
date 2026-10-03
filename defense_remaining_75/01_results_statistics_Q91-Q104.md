# Results and Statistical Interpretation — Questions 91–104

## 91. Why is accuracy misleading for your dataset?

The test set is imbalanced: 1,997 of 3,605 frames belong to the Alert class. A model can obtain apparently reasonable accuracy by predicting Alert frequently while failing on Mild, Warning, and Critical, so we also report confusion matrices and macro-averaged metrics.

## 92. Your best accuracy is only 57.2%. Why should the system be considered useful?

We do not present 57.2% as deployment-ready performance. The study is useful because it demonstrates a functioning real-time pipeline, exposes the effect of imbalance and limited camera view, and provides preliminary subject-independent evidence that guides the next experiments.

## 93. Why was the Critical class almost never predicted?

Critical is the rarest class, with only 262 test frames, and its mapped actions—such as texting and reaching—depend strongly on hand and body information. The learned model used a face crop, so much of the decisive evidence was outside the input view.

## 94. If Critical recall is approximately zero, can the system genuinely claim to provide a Critical warning?

The rule-based score contains a Critical operating level, but the evaluated classifiers did not reliably recognize the dataset’s Critical class. Therefore, we can claim that a Critical alert mechanism exists, but not that Critical behaviour has been validated reliably.

## 95. Why did the CNN predict the majority Alert class despite class weighting?

Class weighting changes the loss penalty but does not create missing visual information or enough minority examples. The face-only input and strong imbalance still made the majority class the easiest decision under the final classifier.

## 96. What does a macro ROC-AUC of 0.69 mean?

It is the average one-vs-rest ranking performance across the four classes. A value of 0.69 means the ensemble has discrimination above the 0.5 chance level, but it is still far from strong or deployment-ready separation.

## 97. How can ROC-AUC be above random when thresholded recall is nearly zero?

ROC-AUC evaluates ranking across all possible thresholds, whereas recall is measured at the chosen final decision rule. A class can receive higher scores for true examples without becoming the largest score selected by argmax.

## 98. Would precision–recall curves be more informative than ROC curves for your imbalanced dataset?

Yes, precision–recall curves would be a valuable addition because they focus directly on minority-class detection and false positives. The submitted paper reports macro metrics, confusion matrices, and ROC-AUC, but future evaluation should add per-class precision–recall curves and average precision.

## 99. Did you calculate confidence intervals or statistical significance?

No confidence intervals or hypothesis tests are reported in the camera-ready paper. The values should therefore be described as results on this particular split, not precise population estimates.

## 100. Can you claim that System C is significantly better than the other systems?

No. We can say System C achieved the highest observed macro recall, macro-F1, and macro ROC-AUC on this split, but statistical superiority was not established.

## 101. What does the confusion matrix reveal that overall accuracy does not?

It shows which true classes are being confused with which predicted classes. In our results it reveals that System B’s accuracy comes mainly from Alert predictions and that all systems struggle severely with Critical examples.

## 102. Were thresholds selected using the validation set or the test set?

The paper does not report test-set tuning of thresholds, and we should not imply that it does. The composite-score thresholds are design thresholds, while any future class-specific threshold calibration must be performed on validation data and evaluated once on untouched test data.

## 103. Did you perform repeated experiments using different random seeds?

Repeated-seed results are not reported in the submitted paper. Future work should repeat training and subject splits, then report mean performance and uncertainty.

## 104. How reproducible are your reported values?

The paper specifies the dataset, subject-independent protocol, model families, class-aware metrics, and final results, so the experimental logic is reproducible. Full numerical replication still depends on preserving the exact split, preprocessing, labels, training configuration, random seeds, and model artifacts.

