# Reliability, Safety, Privacy, and Ethics — Questions 130–153

## 130. What happens if the system produces a false positive?

The driver may receive an unnecessary warning. Repeated false positives can cause annoyance and alarm fatigue, which is why temporal smoothing, hysteresis, and false-alarm evaluation are important.

## 131. What happens if it produces a false negative?

An unsafe driver state may go unwarned, which can have serious consequences. The near-zero Critical recall means the current prototype cannot be relied upon as the only safety mechanism.

## 132. Which is more dangerous: false positives or false negatives?

False negatives carry immediate safety risk, while excessive false positives can cause drivers to ignore future alerts. A valid system must manage both using class-specific safety requirements rather than choosing only one global metric.

## 133. Could frequent false alarms cause alert fatigue?

Yes. EMA and hysteresis reduce short-lived alarms, but alarm-fatigue rates were not evaluated in the paper and require longitudinal user testing.

## 134. How would you validate the system before installing it in a real vehicle?

We would test more drivers across lighting, eyewear, seating, road, and camera conditions; measure event-level false alarms and misses; benchmark end-to-end latency; perform controlled simulator and closed-track studies; and then conduct safety-reviewed road trials.

## 135. Can this preliminary system be described as safety-critical?

It addresses a safety-relevant problem, but the prototype is not validated or certified as a safety-critical product. The paper explicitly limits its conclusion to technical feasibility.

## 136. What fail-safe mechanism is used if the camera or model stops working?

The camera-ready paper does not describe a certified fail-safe mechanism. A production system should detect loss of camera, face, model, or communication and clearly report that monitoring is unavailable rather than silently returning a safe state.

## 137. How would sunlight, vibration, road bumps, or camera movement affect detection?

They can change illumination and landmark geometry, creating noise in EAR, pose, and posture. Camera mounting, stabilization, confidence filtering, and real-road robustness testing are required.

## 138. Would an infrared camera improve performance at night?

Yes, near-infrared imaging could improve face and eye visibility under low light. It would add hardware cost and require retraining or validation on infrared data.

## 139. How would you test the system under real-world driving conditions safely?

We would begin with a simulator, then a closed track with a safety driver and predefined non-dangerous behaviours, and only later conduct ethics- and safety-approved road studies. Participants should never be instructed to perform dangerous texting while driving.

## 140. What standards or regulatory approvals would be required for deployment?

That depends on jurisdiction and how the system is marketed or integrated into a vehicle. The submitted paper does not establish compliance, so formal automotive functional-safety, cybersecurity, human-factors, privacy, and driver-monitoring requirements would need specialist review.

## 141. What driver data is stored by the system?

The paper focuses on the monitoring pipeline and does not define a production data-retention design. A privacy-preserving deployment should store only necessary derived events and avoid retaining raw video unless there is explicit consent and a justified purpose.

## 142. Is continuous video recording necessary?

No. Continuous analysis can be performed without permanently recording the stream; recording and real-time processing are separate design choices.

## 143. How do you protect biometric and behavioural data?

Prefer local processing, minimize collection, encrypt data in transit and at rest, apply strict access control, log access, define short retention periods, and obtain informed consent. These controls are deployment requirements, not validated contributions of the paper.

## 144. How long should evidence frames be retained?

Only for the shortest period justified by the declared purpose and applicable law. The research does not establish a universal retention period.

## 145. Can drivers request deletion of their data?

A responsible deployment should provide access and deletion mechanisms where required by law, subject to narrowly defined legal retention obligations. This was outside the experimental scope of the paper.

## 146. How would you obtain informed consent?

Drivers should receive a clear explanation of what is captured, why it is processed, what is stored, who can access it, how long it is retained, and how consent can be withdrawn.

## 147. Could insurers misuse drowsiness data to increase premiums unfairly?

Yes. Behavioural data can be misinterpreted or used without adequate context, so insurance use would require validated accuracy, transparency, consent, fairness testing, human review, and an appeal process.

## 148. How would you prevent biased scoring across ethnicity, age, disability, or eye shape?

Use a demographically diverse dataset, report subgroup performance, calibrate appropriately, audit error disparities, and avoid deployment where a subgroup performs inadequately. Personal calibration helps with individual variation but does not replace fairness evaluation.

## 149. Did you evaluate demographic fairness?

No demographic subgroup analysis is reported in the camera-ready paper. We must present fairness evaluation as required future work.

## 150. Who is liable if the system fails to warn before an accident?

Liability depends on product claims, jurisdiction, integration, and contracts and cannot be determined by this research. The prototype should be treated as an assistive warning tool, not a guarantee of driver safety.

## 151. Should automated drowsiness evidence be accepted during claim investigation?

Not without validated reliability, chain-of-custody controls, contextual review, and an opportunity to contest the evidence. The submitted study did not evaluate legal admissibility or claims use.

## 152. How do you prove that an evidence frame has not been modified?

A cryptographic hash recorded in a protected audit trail can later show whether the bytes have changed. However, evidence-chain implementation was not evaluated as part of the camera-ready paper’s main experimental contribution.

## 153. What can SHA-256 verification prove, and what can it not prove?

It can show that a file matches the bytes that were originally hashed. It cannot prove that the camera captured the correct person, that the timestamp is genuine, that the frame was not staged before hashing, or that the model’s interpretation is correct.

