# Real-Time Implementation — Questions 115–129

## 115. Describe the complete flow from webcam capture to the displayed warning.

An RGB frame is captured and preprocessed, MediaPipe extracts facial and body landmarks, five cues are calculated and normalized, the fusion/model produces a score, EMA and hysteresis stabilize it, and the resulting level is streamed through FastAPI/WebSocket to the Next.js dashboard.

## 116. Why did you choose FastAPI and WebSocket communication?

FastAPI fits the Python computer-vision pipeline, and WebSocket maintains a persistent bidirectional connection for repeated frame and state exchange. This avoids creating a separate HTTP transaction for every frame.

## 117. Why would REST polling be less suitable for live video processing?

REST polling adds repeated request headers, connection handling, and polling delay. A persistent WebSocket reduces that overhead and supports continuous server responses.

## 118. What data is sent through the WebSocket?

The system exchanges image frames and returns synchronized detection state, including signal measurements, composite score, and alert level. The exact production serialization and privacy policy require separate deployment specification.

## 119. Is video processed locally or uploaded to a remote server?

In the prototype, frames are processed by the FastAPI service connected to the browser. The paper does not claim a remote cloud deployment; a production version should prefer on-device or local processing where possible for privacy and latency.

## 120. What is the end-to-end latency, including MediaPipe, networking, fusion, and rendering?

The submitted paper does not report a rigorous end-to-end latency distribution. It reports only MobileNetV2 inference at 1.0 ms p50 and 1.3 ms p95, plus manual observation of continuous dashboard updates.

## 121. Does the reported 1.0–1.3 ms latency refer to the entire system or only MobileNetV2 inference?

It refers only to the exported MobileNetV2 model’s inference time per frame. We must not present it as total pipeline latency.

## 122. Can the complete pipeline sustain 30 frames per second on an ordinary laptop?

The system targets approximately 30 fps, and manual testing showed continuous updates without noticeable interruption. A controlled benchmark of complete throughput across specified hardware remains necessary before claiming guaranteed 30 fps.

## 123. Why did you export MobileNetV2 to ONNX?

ONNX enables lightweight, framework-independent inference with ONNX Runtime and avoids requiring the full training framework in the serving environment.

## 124. What happens when MediaPipe cannot detect the face?

Feature computation is skipped for that frame while the session continues. A production system should also notify the user when tracking confidence remains low or the camera is obstructed.

## 125. How does the system behave under low light?

It applies contrast-limited adaptive histogram equalization, but RGB landmark reliability still falls in darkness and strong backlighting. Low-light robustness was not fully validated.

## 126. What happens when the driver wears glasses, sunglasses, or a mask?

Glasses reflections and occlusion can degrade eye and face landmarks; sunglasses may prevent reliable EAR entirely, while masks mainly affect MAR. The present paper identifies such conditions as limitations requiring robustness testing.

## 127. Can the system monitor multiple drivers simultaneously?

The submitted work describes monitoring one driver from one webcam stream. Multi-driver monitoring was not evaluated and would require separate tracking state and calibration for every person.

## 128. What hardware was used for training and testing?

The camera-ready paper states that the implementation targets conventional commodity hardware but does not provide a complete hardware specification for every experiment. We should not invent a processor or GPU model during the defense.

## 129. Does the production system require a GPU?

The lightweight MediaPipe and ONNX design targets inference on commodity hardware rather than requiring a dedicated GPU. This does not mean training was performed without accelerated hardware.

