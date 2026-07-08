# Multimodal Driver Drowsiness & Distraction Detection
## Final Year Project — Complete Build Plan

**Team:** Pranav Bhandari (221732), Madhu Kunwar (221721), Madhusudan Bhandari (221722), Samrat Giri (221740)  
**Submission:** 29th May 2026 | Pokhara University / NCIT  
**Stack:** Next.js + Python FastAPI + NestJS (optional) + MediaPipe

---

## Table of Contents

1. [Project Summary](#1-project-summary)
2. [System Architecture](#2-system-architecture)
3. [ML Pipeline — Python (Core)](#3-ml-pipeline--python-core)
4. [Frontend — Next.js](#4-frontend--nextjs)
5. [Backend — NestJS (Optional but Recommended)](#5-backend--nestjs-optional-but-recommended)
6. [Database Design](#6-database-design)
7. [Tech Stack Summary](#7-tech-stack-summary)
8. [Development Phases & Timeline](#8-development-phases--timeline)
9. [Standout Features to Add](#9-standout-features-to-add)
10. [What to Train vs What to Use Pre-built](#10-what-to-train-vs-what-to-use-pre-built)
11. [Evaluation Strategy](#11-evaluation-strategy)
12. [How to Impress Big Companies](#12-how-to-impress-big-companies)
13. [Risks & Mitigations](#13-risks--mitigations)
14. [Open Questions](#14-open-questions)

---

## 1. Project Summary

Build a **multimodal, real-time driver drowsiness and distraction detection system** that runs entirely on a standard laptop + USB webcam. No wearables, no special hardware.

**What it detects (5 signals):**
| Signal | Method | What it catches |
|--------|---------|-----------------|
| EAR (Eye Aspect Ratio) | MediaPipe FaceMesh | Prolonged eye closure, blink patterns |
| PERCLOS | Rolling EAR window | Sustained drowsiness vs. normal blinking |
| MAR (Mouth Aspect Ratio) | MediaPipe FaceMesh | Yawning detection |
| Head Pose | OpenCV solvePnP | Nodding (pitch), looking away (yaw), tilting (roll) |
| Posture | MediaPipe Pose | Slouching, leaning, forward slumping |

**How it decides:** Weighted fusion → single Composite Drowsiness Score (0.0–1.0)  
**Weights:** EAR=0.30, PERCLOS=0.25, MAR=0.20, HeadPose=0.15, Posture=0.10

**Alert levels:**
- Level 0: Silent (score < 0.25) — just logging
- Level 1: Mild visual (0.25–0.50) — yellow banner
- Level 2: Audio + visual (0.50–0.75) — chime + orange warning
- Level 3: Urgent alarm (>0.75) — red alert + loud alarm + log event

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    BROWSER (Next.js App)                      │
│  ┌─────────────┐   ┌──────────────┐   ┌───────────────────┐ │
│  │ Live Camera │   │  Dashboard   │   │  Session History  │ │
│  │ Feed + HUD  │   │  (Metrics)   │   │  & Alert Logs     │ │
│  └──────┬──────┘   └──────────────┘   └───────────────────┘ │
│         │ getUserMedia() → JPEG frames                        │
└─────────┼────────────────────────────────────────────────────┘
          │ WebSocket (frames up, results down)
          ▼
┌──────────────────────────────────────────────────────────────┐
│                  PYTHON FastAPI Server (localhost)            │
│  OpenCV → MediaPipe → EAR/PERCLOS/MAR/HeadPose/Posture      │
│  → Fusion Engine → Composite Score → Alert Level            │
│  → WebSocket response (JSON) → SQLite/Postgres log          │
└──────────────────────────────────────────────────────────────┘
          │ REST API (optional — for user/session management)
          ▼
┌──────────────────────────────────────────────────────────────┐
│               NESTJS Server (optional)                        │
│  User auth, driver profiles, fleet management, REST APIs     │
│  PostgreSQL for persistent session/alert history             │
└──────────────────────────────────────────────────────────────┘
```

**Key decision:** The browser captures webcam frames via `getUserMedia()` and sends JPEG frames to the Python server via WebSocket. Python does all ML processing and sends back JSON results. This keeps the heavy lifting in Python (where MediaPipe/OpenCV live) while the frontend stays purely display-focused.

---

## 3. ML Pipeline — Python (Core)

### 3.1 Setup & Dependencies

```
Python 3.10+
mediapipe>=0.10
opencv-python>=4.9
numpy>=1.26
scipy>=1.12
fastapi>=0.111
uvicorn[standard]
websockets
python-jose (for JWT if auth needed)
sqlalchemy + aiosqlite (for local DB)
```

### 3.2 Pipeline Modules

#### Module 1: Video Capture / Frame Receiver
```
- Accept JPEG frames from WebSocket (browser sends)
- OR: capture from local webcam with cv2.VideoCapture(0) (desktop mode)
- Convert BGR → RGB for MediaPipe
- Target: 30 fps, reject frames older than 50ms
```

#### Module 2: Face & Pose Detection (MediaPipe)
```
- MediaPipe FaceMesh: 468 facial landmarks
  - Static image mode: False (video mode for tracking continuity)
  - Max faces: 1 (single driver)
  - Min detection confidence: 0.5
  - Min tracking confidence: 0.5

- MediaPipe Pose: 33-point skeleton
  - Only upper body landmarks needed (shoulders, ears, neck)
  - Model complexity: 1 (balanced speed/accuracy)
```

#### Module 3: EAR Computation
```python
# Key landmark indices (MediaPipe FaceMesh)
LEFT_EYE  = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33, 160, 158, 133, 153, 144]

def compute_ear(landmarks, eye_indices):
    p = [landmarks[i] for i in eye_indices]
    A = dist(p[1], p[5])
    B = dist(p[2], p[4])
    C = dist(p[0], p[3])
    return (A + B) / (2.0 * C)

ear = (left_ear + right_ear) / 2.0

# Adaptive threshold: calibrate first 90 frames (3 seconds)
# threshold = mean_ear - (1.5 * std_ear)
# Flag: ear < threshold for > 3 consecutive frames
```

#### Module 4: PERCLOS Computation
```python
# Rolling window = 60 seconds × fps frames
# PERCLOS = (closed_frames / total_frames) × 100
# >15% = drowsy, >30% = severely drowsy
# Update every frame using deque(maxlen=N)
```

#### Module 5: MAR Computation
```python
# Mouth landmarks (MediaPipe indices)
MOUTH = [61, 291, 39, 181, 0, 17, 269, 405]

def compute_mar(landmarks):
    # Three vertical measurements for asymmetry robustness
    ...
    return mar

# Yawn: MAR > 0.6 sustained for 1.5 seconds
```

#### Module 6: Head Pose Estimation
```python
# 6 canonical 3D facial points: nose tip, chin, left/right eye corners, left/right mouth corners
# 2D projections from FaceMesh
# cv2.solvePnP(model_points, image_points, camera_matrix, dist_coeffs)
# → Rodrigues → Euler angles (pitch, yaw, roll)

# Thresholds:
# Pitch > ±20°: nodding/drooping
# Yaw   > ±25°: looking away (distraction)
# Roll  > ±15°: tilting (severe lean)
```

#### Module 7: Posture Analysis
```python
# MediaPipe Pose landmarks used:
# LEFT_SHOULDER = 11, RIGHT_SHOULDER = 12
# LEFT_EAR = 7, RIGHT_EAR = 8

# Shoulder tilt angle: arctan(Δy_shoulders / Δx_shoulders)
# Forward lean: head_centroid - shoulder_midpoint (normalized)
# Deviation score: Euclidean norm of [shoulder_tilt, forward_lean]
# Normalize against per-session calibrated baseline (first 3 seconds)
```

#### Module 8: Fusion Engine
```python
weights = {
    'ear':      0.30,
    'perclos':  0.25,
    'mar':      0.20,
    'headpose': 0.15,
    'posture':  0.10,
}

def compute_composite_score(features):
    # Normalize each feature to [0, 1]
    # Weighted sum
    score = sum(weights[k] * features[k] for k in weights)
    return min(max(score, 0.0), 1.0)
```

#### Module 9: Alert Engine
```python
ALERT_LEVELS = {
    0: {'range': (0.00, 0.25), 'label': 'Alert',    'color': 'green',  'sound': None},
    1: {'range': (0.25, 0.50), 'label': 'Mild',     'color': 'yellow', 'sound': None},
    2: {'range': (0.50, 0.75), 'label': 'Warning',  'color': 'orange', 'sound': 'chime'},
    3: {'range': (0.75, 1.00), 'label': 'Critical', 'color': 'red',    'sound': 'alarm'},
}
```

#### Module 10: FastAPI WebSocket Server
```python
@app.websocket("/ws/detect")
async def detection_ws(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_bytes()   # JPEG frame from browser
        frame = decode_jpeg(data)
        result = pipeline.process_frame(frame)   # returns dict
        await websocket.send_json(result)
        # result = {
        #   "ear": 0.28, "perclos": 12.3, "mar": 0.41,
        #   "pitch": -5.2, "yaw": 3.1, "roll": 1.0,
        #   "posture_score": 0.08,
        #   "composite_score": 0.32,
        #   "alert_level": 1,
        #   "alert_label": "Mild",
        #   "yawn_detected": false,
        #   "timestamp": "2026-01-01T00:00:00Z"
        # }
```

### 3.3 Python FastAPI REST Endpoints

```
POST   /api/session/start          — start a new monitoring session
POST   /api/session/end            — end session, save summary
GET    /api/session/{id}           — get session details + metrics
GET    /api/sessions               — list all sessions
GET    /api/alerts                 — get alert history
POST   /api/calibrate              — trigger re-calibration
GET    /api/health                 — health check
```

---

## 4. Frontend — Next.js

### 4.1 Stack

```
Next.js 15 (App Router)
TypeScript
Tailwind CSS
shadcn/ui
Lucide React (icons)
Recharts or Tremor (live charts)
react-webcam (webcam access)
socket.io-client or native WebSocket
date-fns (timestamps)
zustand (state management)
```

### 4.2 Pages / Routes

```
/                    → Landing/Home (product overview, start session CTA)
/monitor             → MAIN MONITORING PAGE (live detection)
/dashboard           → Analytics dashboard (historical data)
/sessions            → Session history list
/sessions/[id]       → Individual session detail + playback
/settings            → Threshold configuration, calibration
/admin               → Admin panel (if multi-user)
```

### 4.3 Core Components

#### `/monitor` — Main Monitoring Page
```
Layout:
┌─────────────────────────────────────────────┐
│  [Status Bar: Alert Level + Score]          │
├────────────────────────┬────────────────────┤
│                        │  Live Metrics Panel │
│   Webcam Feed          │  ─────────────────  │
│   (with landmark       │  EAR:    0.28 ██░░  │
│    overlay drawn       │  PERCLOS:12% ████░  │
│    on canvas)          │  MAR:    0.41 ██░░  │
│                        │  Pitch:  -5° ████░  │
│                        │  Posture: OK ████░  │
│                        │  ─────────────────  │
│                        │  Score: 0.32        │
│                        │  [●●●○] MILD        │
│                        │  ─────────────────  │
│                        │  Blinks: 18/min     │
│                        │  Yawns:  2          │
│                        │  Session: 00:14:23  │
├────────────────────────┴────────────────────┤
│  [Composite Score Timeline — last 60s]      │
└─────────────────────────────────────────────┘
```

Key components:
- `<WebcamCapture />` — uses `getUserMedia()`, draws on `<canvas>`, sends frames via WebSocket
- `<MetricsPanel />` — live updating bars for each signal
- `<AlertBanner />` — color-coded alert display with animation
- `<ScoreTimeline />` — rolling 60-second line chart (Recharts)
- `<SessionTimer />` — elapsed time display

#### `/dashboard` — Analytics Dashboard
```
- Total sessions count, total monitoring hours
- Drowsiness score distribution (histogram)
- Alert frequency over time (bar chart)
- Peak risk hours heatmap (hour of day × day of week)
- Average score trend (line chart — getting better or worse?)
- Top alert events table with timestamps
```

#### `/sessions/[id]` — Session Detail
```
- Full timeline of score throughout the session
- Alert events marked on timeline
- Per-signal breakdown charts
- Session summary stats (avg score, peak score, alert counts)
- Export as PDF button
```

#### `/settings` — Configuration
```
- EAR threshold slider (with live preview)
- MAR threshold slider
- Head pose thresholds (pitch/yaw/roll)
- Fusion weight sliders (must sum to 1.0)
- Alert sound toggle
- Camera selection dropdown
- Calibration trigger button
```

### 4.4 WebSocket Connection (Browser Side)

```typescript
// hooks/useDetection.ts
const ws = useRef<WebSocket>();

function startDetection() {
  ws.current = new WebSocket('ws://localhost:8000/ws/detect');
  ws.current.onmessage = (event) => {
    const result = JSON.parse(event.data);
    updateMetrics(result);           // update state
    handleAlert(result.alert_level); // trigger alert UI
    appendToTimeline(result);        // update chart
  };
}

// Send frames: capture canvas every 33ms (30fps), send as JPEG blob
```

### 4.5 Alert UX

```
Level 0: Nothing visible — just background logging
Level 1: Yellow banner slides in from top, subtle pulse animation
Level 2: Orange banner + browser notification + audio chime (Web Audio API)
Level 3: Full-screen red overlay flash + loud alarm sound + vibration (mobile)
         Banner says: "CRITICAL DROWSINESS DETECTED — Please Pull Over"
```

### 4.6 Key Libraries

| Purpose | Library |
|---------|---------|
| UI Components | shadcn/ui |
| Icons | lucide-react |
| Styling | Tailwind CSS |
| Charts | recharts |
| Webcam | react-webcam |
| State | zustand |
| Data fetching | TanStack Query |
| Forms | react-hook-form + zod |
| Dates | date-fns |
| Animations | framer-motion |
| PDF export | @react-pdf/renderer |
| Audio alerts | Howler.js |

---

## 5. Backend — NestJS (Optional but Recommended)

**Should you use NestJS?** YES, for these reasons:
1. User/driver profiles with login (for fleet use case)
2. Persistent session storage in PostgreSQL
3. Admin APIs for fleet managers
4. REST endpoints that the frontend calls for historical data
5. Demonstrates full-stack competency to employers

**If it's just a demo prototype:** Skip NestJS, let Python FastAPI handle everything.

### 5.1 NestJS Modules

```
AuthModule        — JWT auth, bcrypt, login/register
UsersModule       — Driver profiles (name, photo, license, calibration baseline)
SessionsModule    — Session CRUD, summary generation
AlertsModule      — Alert log CRUD, severity stats
ThresholdsModule  — Per-user configurable thresholds
ReportsModule     — PDF report generation
```

### 5.2 Key NestJS Endpoints

```
POST  /auth/login
POST  /auth/register
GET   /users/me
PATCH /users/me/thresholds

POST  /sessions
GET   /sessions
GET   /sessions/:id
PATCH /sessions/:id (update with summary on end)

GET   /alerts?sessionId=&severity=
GET   /reports/:sessionId (generate PDF)

GET   /analytics/heatmap
GET   /analytics/trend
GET   /analytics/summary
```

### 5.3 NestJS Stack

```
NestJS 10+
TypeScript
@nestjs/jwt + passport-jwt
bcrypt
TypeORM + PostgreSQL (or Prisma)
class-validator + class-transformer
@nestjs/swagger (auto-docs — very impressive to show)
```

---

## 6. Database Design

### Sessions Table
```sql
sessions (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  started_at  TIMESTAMP,
  ended_at    TIMESTAMP,
  duration_s  INTEGER,
  avg_score   FLOAT,
  peak_score  FLOAT,
  alert_count JSON,   -- {0: 120, 1: 45, 2: 12, 3: 2}
  metadata    JSON    -- {device, fps, calibration_ear}
)
```

### Alert Events Table
```sql
alert_events (
  id           UUID PRIMARY KEY,
  session_id   UUID REFERENCES sessions(id),
  timestamp    TIMESTAMP,
  alert_level  INTEGER,
  score        FLOAT,
  ear          FLOAT,
  perclos      FLOAT,
  mar          FLOAT,
  head_pitch   FLOAT,
  head_yaw     FLOAT,
  posture_score FLOAT
)
```

### Users Table
```sql
users (
  id              UUID PRIMARY KEY,
  name            VARCHAR,
  email           VARCHAR UNIQUE,
  password_hash   VARCHAR,
  role            ENUM('driver', 'admin'),
  calibration_ear FLOAT,   -- personal baseline
  created_at      TIMESTAMP
)
```

---

## 7. Tech Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 15 + TypeScript | Web UI, webcam capture, real-time display |
| Styling | Tailwind CSS + shadcn/ui | Components, responsive design |
| Icons | Lucide React | Icons throughout |
| Charts | Recharts | Live metrics + historical analytics |
| ML Core | Python 3.10 + FastAPI | Detection pipeline, WebSocket server |
| CV | MediaPipe + OpenCV | Landmark detection, frame processing |
| Math | NumPy + SciPy | EAR/MAR/PERCLOS computations |
| Backend API | NestJS (optional) | Auth, user management, REST APIs |
| Database | PostgreSQL / SQLite | Session logs, user data |
| ORM | Prisma (NestJS) or SQLAlchemy (Python) | DB access |
| Auth | JWT (NestJS) or FastAPI-Users | Login/profiles |

---

## 8. Development Phases & Timeline

### Phase 1 — ML Core (Weeks 1–3)
- [ ] Set up Python FastAPI project
- [ ] Implement MediaPipe FaceMesh + Pose pipeline
- [ ] Implement EAR computation + adaptive calibration
- [ ] Implement PERCLOS rolling window
- [ ] Test with local webcam — verify EAR values are correct
- [ ] Unit tests for all geometric computations

### Phase 2 — Full Detection Pipeline (Weeks 3–6)
- [ ] Implement MAR + yawn detection
- [ ] Implement Head Pose with solvePnP
- [ ] Implement Posture analysis
- [ ] Implement Fusion Engine
- [ ] Implement Alert Engine
- [ ] WebSocket server endpoint
- [ ] Test full pipeline end-to-end with webcam

### Phase 3 — Frontend (Weeks 6–9)
- [ ] Next.js project setup (shadcn, tailwind, lucide)
- [ ] Webcam capture + WebSocket connection
- [ ] Live monitoring page with HUD overlay
- [ ] Real-time metrics panel
- [ ] Alert UI (all 4 levels)
- [ ] Score timeline chart
- [ ] Settings page (threshold sliders)

### Phase 4 — Backend + Data (Weeks 9–10)
- [ ] NestJS project setup (or Python REST routes)
- [ ] Database schema + migrations
- [ ] Session start/end APIs
- [ ] Alert event logging
- [ ] Historical data APIs

### Phase 5 — Analytics + Polish (Weeks 10–11)
- [ ] Dashboard with historical charts
- [ ] Session detail page
- [ ] PDF export
- [ ] Responsive design polish
- [ ] Demo recording

### Phase 6 — Evaluation (Weeks 11–12)
- [ ] Test on multiple people (different lighting, glasses, skin tones)
- [ ] Measure accuracy vs. manual labels
- [ ] Ablation study (remove each signal, measure accuracy drop)
- [ ] Performance profiling (latency per frame)
- [ ] Write evaluation report

---

## 9. Standout Features to Add

These go beyond the proposal and will make the project memorable:

### 9.1 Adaptive Per-Driver Calibration (Already in proposal — make it visual)
- Show the calibration progress on-screen with a 3-second countdown
- Display the driver's personal EAR baseline after calibration
- Explain in plain English: "Your eyes are naturally slightly more closed than average — thresholds adjusted"

### 9.2 Fleet Management Mode
- Admin dashboard showing ALL drivers and their current status
- Heatmap of which drivers / routes have highest drowsiness risk
- Daily summary email for fleet managers
- **This is commercially relevant** — trucking companies, bus operators, ride-share

### 9.3 Session Replay / Drowsiness Timeline
- After a session, show a visual timeline of when the driver was drowsy
- Correlate with timestamps ("You were most drowsy at 11:45 PM")
- Very impressive demo feature

### 9.4 Distraction vs. Drowsiness Differentiation
- Currently the proposal lumps these together
- Explicitly label events: "Yawning (fatigue)" vs. "Looking away (distraction)" vs. "Nodding (microsleep)"
- Color-code the timeline by type of event

### 9.5 Glasses/Occlusion Robustness Flag
- Detect when EAR is unreliable (glasses detected by high landmark jitter)
- Automatically down-weight EAR and increase weight on PERCLOS + posture
- Show a small warning icon: "Glasses mode active — using enhanced posture detection"

### 9.6 Mobile PWA
- Make the Next.js app a Progressive Web App
- Can be installed on a phone mounted on the dashboard
- Vibration alerts via `navigator.vibrate()`
- Offline capability for the monitoring page

### 9.7 Nighttime / Low-Light Mode
- Detect low ambient light from the video feed (mean pixel intensity)
- Switch to grayscale + contrast enhancement automatically
- Show indicator: "Low light mode active"

### 9.8 Report Export (PDF)
- One-click PDF report of any session
- Includes: score timeline chart, alert count breakdown, recommendation
- Use case: driver submits to employer, insurance company, or health provider

---

## 10. What to Train vs. What to Use Pre-built

### Pre-built (No Training Needed)
| Component | Source |
|-----------|--------|
| Face landmark detection | MediaPipe FaceMesh (Google) |
| Body pose detection | MediaPipe Pose (Google) |
| EAR / MAR / PERCLOS | Pure math — no training |
| Head pose (solvePnP) | OpenCV — no training |
| Posture deviation | Pure math — no training |
| Fusion weights | Hand-tuned (from literature) |

### Optional: Train a Classifier (Highly Recommended for Marks + Portfolio)
Train a lightweight binary classifier on top of the 5 extracted features:

**Input:** [ear_norm, perclos, mar_norm, head_deviation, posture_score] (5 features per frame)  
**Output:** drowsy (1) or alert (0)

**How:**
1. Collect ~2 hours of labelled data (yourself + teammates acting drowsy/alert)
2. OR use UTA-RLDD / NTHU-DDD dataset (publicly available)
3. Train: Random Forest, SVM, or a tiny MLP (3 layers) in scikit-learn / PyTorch
4. Export model and use it in the Python pipeline alongside the rule-based system
5. Compare: trained classifier vs. rule-based weighted fusion → this IS the ablation study

**Why this matters:** The proposal says "weights will be refined during evaluation" — actually training a model makes this claim real and publishable.

### Datasets to Use
| Dataset | Size | Notes |
|---------|------|-------|
| UTA-RLDD | 60 subjects | Real-life drowsiness, RGB video |
| NTHU-DDD | 36 subjects | 4 distraction categories, good labels |
| YawDD | 107 subjects | Yawning-specific |
| DROZY | 14 subjects | Multi-signal, has EEG ground truth |

**Colab Plan:** Load dataset → extract features using your Python pipeline → train classifier → save as `.pkl` or ONNX → load in FastAPI → compare to weighted fusion.

---

## 11. Evaluation Strategy

### Metrics to Report (from proposal)
- Accuracy > 90%
- Precision > 88%
- Recall > 90%
- F1 Score
- Latency < 100ms per frame

### Ablation Study (This is What Makes the Grade)
Run the system 6 ways and measure accuracy each time:

| Configuration | Expected Accuracy |
|---------------|-------------------|
| EAR only | baseline (~75%) |
| EAR + PERCLOS | better (~80%) |
| + MAR | better (~83%) |
| + Head Pose | better (~86%) |
| + Posture | better (~88%) |
| All 5 (full system) | best (~91%+) |

This proves that each signal adds value — the core argument of the proposal.

### Testing Protocol
1. **Controlled:** 5 people × 30 min session (15 min alert, 15 min simulated drowsy)
2. **Varied lighting:** test in bright, dim, backlit conditions
3. **Accessories:** test with glasses, sunglasses, hat
4. **Head positions:** test with slight head turns
5. **Manual ground truth:** video reviewer labels drowsy/alert segments independently

---

## 12. How to Impress Big Companies

### Things That Get Noticed

1. **Polished demo video** (2 minutes): Show real-time detection, all 4 alert levels, then the analytics dashboard. Host on YouTube. Link in GitHub README.

2. **Clean GitHub repo** with:
   - Professional README with GIFs
   - Architecture diagram
   - One-command Docker setup: `docker compose up`
   - Code quality: typed Python, TypeScript strict mode
   - Test coverage badge

3. **Actual evaluation on a real dataset** — not just "we tested on ourselves." Even if results are modest, showing rigorous methodology is what engineers at Tesla/Mobileye care about.

4. **Ablation study in the README** — a table showing accuracy with/without each signal. This shows scientific thinking.

5. **Addressing the hard problem** — explicitly say in the README: "Most systems fail with glasses/low light. Ours degrades gracefully by reweighting signals." Show this working.

6. **Commercial framing** — have a "Fleet Management" section. Companies like Lytx, Samsara, Mobileye will understand the use case immediately.

7. **WebSocket latency profiling** — include a chart showing frame processing latency distribution. Proves you think about production performance.

8. **Privacy note** — no video is stored, all processing is local. This matters enormously for real-world deployment and shows product thinking.

### Companies That Actively Hire for This Domain
- **Mobileye** (Intel) — ADAS, DMS
- **Seeing Machines** — eye tracking for vehicles
- **Samsara** — fleet safety
- **Lytx** — commercial vehicle DMS
- **Waymo / Cruise** — autonomous vehicles
- **Bosch / Continental** — automotive sensor fusion
- **NVIDIA** (DriveAV platform) — automotive AI

### Keywords to Put in Your Resume/LinkedIn
`Computer Vision`, `MediaPipe`, `OpenCV`, `Real-time Inference`, `Sensor Fusion`, `ADAS`, `Driver Monitoring Systems (DMS)`, `WebSocket`, `FastAPI`, `Next.js`, `Multimodal AI`

---

## 13. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Webcam feed lag causes >100ms latency | Medium | Lower JPEG quality, reduce resolution to 480p, profile per-module |
| EAR unreliable with glasses | High | Detect glasses (jitter), auto-reweight signals |
| False alarms from speech (MAR) | Medium | 1.5s persistence requirement already in proposal |
| Low accuracy in dark conditions | Medium | Histogram equalization before MediaPipe |
| MediaPipe fails to detect face at extreme angles | Medium | Fallback to last-known values + visual warning |
| WebSocket connection drops | Low | Auto-reconnect logic in frontend |
| Different people have different baselines | High | Per-session adaptive calibration (already planned) |
| Colab training too slow | Low | Use free GPU, lightweight model (sklearn RF ≤ 1 min training) |

---

## 14. Open Questions

Before building, need to decide:

1. **Local-only vs. hosted?** Will this run only on localhost (laptop), or should the Python server be deployable to a cloud VM? Cloud adds latency but allows mobile use.

2. **Single driver vs. fleet?** Is this just a demo prototype for one person, or should it have multi-user login? NestJS is only worth the effort if multi-user.

3. **Who trains the classifier?** One person owns the Colab notebook end-to-end. Who?

4. **Dataset:** Do you have access to UTA-RLDD/NTHU-DDD, or will you record your own labelled dataset?

5. **Deployment demo:** Will the final demo be:
   - Live in front of evaluators (requires laptop + webcam in the room)
   - Pre-recorded video
   - Both (recommended)

6. **Mobile?** Do you want this to work on a phone camera too? (changes WebSocket frame format slightly)

7. **NestJS:** Is the team comfortable with NestJS, or would it be better to put all REST APIs in Python FastAPI? Both are valid — FastAPI is simpler, NestJS is more scalable and impressive as a portfolio piece for backend roles.

---

---

## 15. State-of-the-Art Research Update (June 2026)

> Researched on 21 June 2026. This section directly informs what you need to do differently to stay competitive.

### What the Field Looks Like Right Now

The research landscape has moved significantly beyond rule-based EAR/PERCLOS systems:

| Approach | Accuracy on NTHU-DDD | Notes |
|----------|----------------------|-------|
| Rule-based EAR only | ~75–80% | What most GitHub repos do |
| EAR + PERCLOS + MAR fusion (your proposal baseline) | ~88–91% | Where your proposal sits |
| Traditional CNN (VGG16, ResNet) | ~92–97% | Standard deep learning |
| CNN-Transformer hybrid (CNN-ViT) | ~97.5–99.76% | Current SOTA (2026) |
| YOLOv8 + Swin Transformer (semi-supervised) | 99.99% on NTHU-DDD | Highest reported |

**Key insight:** Pure rule-based systems are being left behind. The SOTA is CNN-Transformer hybrids trained end-to-end on benchmark datasets.

### What This Means for Your Project

**The danger:** If your evaluators have read recent papers, a purely rule-based weighted fusion (your current plan) may look outdated compared to what's been published.

**The opportunity:** Your architecture is modular. You can ADD a lightweight trained model in Colab and plug it in alongside the rule-based fusion. This becomes a genuine contribution.

### Recommended Upgrade: Hybrid Approach

Run THREE systems in parallel and compare them (this becomes your ablation + novelty):

```
System A (Rule-based):  EAR + PERCLOS + MAR + HeadPose + Posture → weighted fusion
System B (DL only):     Fine-tuned MobileNetV2 / EfficientNet on NTHU-DDD frames
System C (Hybrid):      Rule-based features + DL features → meta-classifier
```

- Train System B in Colab using NTHU-DDD or UTA-RLDD (~1–2 hours of Colab GPU time)
- Expose all three via the Python FastAPI with a toggle in the settings UI
- Report accuracy for all three in your evaluation chapter → this IS the paper-worthy contribution

### Mobileye Industry Signal (March 2026)

Mobileye just secured a major DMS production contract with a leading US automaker (start of production 2027, millions of vehicles). Their system runs at **60 fps** with infrared cameras, correlates driver gaze with road conditions, and is targeting **Euro NCAP 2026 and 2029** compliance.

**What this tells you:**
1. DMS is not a dead field — it's actively growing with regulatory mandates
2. The commercial systems use infrared (you're using RGB — explicitly mention this as your accessibility advantage: "works with a $25 webcam")
3. Euro NCAP 2026 compliance means **OEMs must ship DMS** — the market need is real and funded
4. Mention this in your introduction: "Systems like Mobileye DMS exist but cost thousands. We target the unserved market — the 1+ billion vehicles with no DMS at all."

### Low-Light Detection (Active Research Gap — June 2026)

A Nature Scientific Reports paper (June 2026) specifically targets low-light driver drowsiness detection using dual attention mechanisms + LLFormer (low-light image enhancement). This is an **open problem**.

**Quick win for your project:** Add a low-light pre-processing step using CLAHE (Contrast Limited Adaptive Histogram Equalization) from OpenCV. It's 3 lines of code, mention it explicitly, and show a before/after in your demo. No existing student projects do this properly.

### Datasets to Use (Benchmark Standard as of 2026)

| Dataset | Best Reported Accuracy | Available |
|---------|----------------------|-----------|
| NTHU-DDD | 99.99% (YOLOv8+Swin) | Yes, request via NTHU |
| UTA-RLDD | 95.94% (YOLOv8+Swin) | Yes, open access |
| YawDD | 99.34% | Yes, open access |

Train on NTHU-DDD or UTA-RLDD. Even if you get 88–92% with a simple fine-tuned MobileNetV2, that's respectable and publishable for a final year project.

### Summary: What You Must Do Differently (Updated Priorities)

1. **Add CLAHE low-light preprocessing** — 3 lines of code, huge credibility boost
2. **Train a lightweight CNN in Colab** (MobileNetV2 or EfficientNet-B0) on NTHU-DDD, export as ONNX, load in FastAPI
3. **Run three systems and compare** — rule-based vs. CNN vs. hybrid. This is your academic contribution
4. **Reference Euro NCAP 2026** in your introduction — connects your work to live industry regulation
5. **Keep the web dashboard** — this is still unique. No published paper in this space has a polished Next.js frontend with session analytics. This is your demo differentiator.

---

*Last updated: 21 June 2026 | Claude Code — includes live research from June 2026*
