# DrowsyShield — Backend API Specification

> **Purpose:** Complete contract between the frontend and both backend services. Every shape,
> endpoint, WebSocket protocol, and algorithm note here is derived from the frontend's type
> system and store mocks. Implement exactly these contracts and the frontend connects with
> zero changes.
>
> **Last updated:** June 29, 2026

---

## Architecture Overview

```
Browser (Next.js)
    │
    ├── REST  HTTP  ──► NestJS  :3001  ──► PostgreSQL :5432
    │   (auth, sessions, claims, fleet, reports)
    │
    └── WS  Binary ──► Python FastAPI  :8000
        (live frame → DetectionMetrics JSON per frame)
```

### Environment variables (frontend `.env.local`)

```
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/detect
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

## Part 1 — Python FastAPI Detection Service

**Port:** `8000`  
**Framework:** FastAPI + MediaPipe + OpenCV  
**Purpose:** Receives raw webcam frames, runs the 5-signal drowsiness pipeline, returns metrics JSON per frame.

---

### 1.1 WebSocket Endpoint

```
GET ws://localhost:8000/ws/detect
Upgrade: websocket
```

**Protocol flow:**

```
CLIENT                              SERVER
  │                                   │
  │── WS Handshake ──────────────────►│
  │                                   │  (calibration window — first 3 seconds)
  │── JPEG binary frame (blob) ──────►│  ← repeat at 30 fps
  │◄─ DetectionMetrics JSON ──────────│  ← one JSON response per frame
  │── JPEG binary frame (blob) ──────►│
  │◄─ DetectionMetrics JSON ──────────│
  │   ...                             │
  │── close ────────────────────────►│
```

**Input (client → server):**  
Raw binary WebSocket message containing a JPEG image blob.
- Encoding: `image/jpeg`, quality `0.75`
- Resolution: up to 640 × 480 (mobile may send lower)
- Frame rate: 30 fps on desktop, may drop on mobile

**Output (server → client):**  
UTF-8 JSON string matching `DetectionMetrics` exactly:

```json
{
  "ear":            0.31,
  "perclos":        8.4,
  "mar":            0.22,
  "pitch":         -3.1,
  "yaw":            1.8,
  "roll":           0.5,
  "postureScore":   0.12,
  "compositeScore": 0.18,
  "alertLevel":     0,
  "alertLabel":     "Alert",
  "yawnDetected":   false,
  "blinkRate":     16.2,
  "timestamp":     "2026-06-29T14:30:00.123Z"
}
```

#### Full `DetectionMetrics` field reference

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `ear` | `number` | `0.0–0.45` | Eye Aspect Ratio — mean of left and right eye. `< 0.21` = drowsy threshold |
| `perclos` | `number` | `0–100` (%) | % of time eyes ≥ 80% closed in rolling 60-second window |
| `mar` | `number` | `0.0–1.0` | Mouth Aspect Ratio — `> 0.6` sustained ≥ 1.5 s = yawn |
| `pitch` | `number` | `−90–+90` (°) | Head pitch — positive = looking up, negative = nodding down |
| `yaw` | `number` | `−90–+90` (°) | Head yaw — positive = looking right |
| `roll` | `number` | `−90–+90` (°) | Head roll — lateral tilt |
| `postureScore` | `number` | `0.0–1.0` | Euclidean deviation from calibrated baseline. `> 0.4` = warning |
| `compositeScore` | `number` | `0.0–1.0` | Weighted fusion of all 5 signals (see §1.3) |
| `alertLevel` | `0\|1\|2\|3` | integer | 0 = Alert, 1 = Mild, 2 = Warning, 3 = Critical |
| `alertLabel` | `string` | — | Human label matching alertLevel: `"Alert"` / `"Mild"` / `"Warning"` / `"Critical"` |
| `yawnDetected` | `boolean` | — | `true` if MAR > 0.6 sustained for ≥ 1.5 s in the current observation window |
| `blinkRate` | `number` | `0–40` | Blinks per minute — rolling 60-second estimate |
| `timestamp` | `string` | ISO 8601 | Server UTC timestamp at frame processing time |

---

### 1.2 Signal Computation

#### EAR — Eye Aspect Ratio
```
EAR = (||p2−p6|| + ||p3−p5||) / (2 × ||p1−p4||)

MediaPipe FaceMesh landmark indices:
  Left eye:  p1=362, p2=385, p3=387, p4=263, p5=373, p6=380
  Right eye: p1=33,  p2=160, p3=158, p4=133, p5=153, p6=144

Use mean EAR of both eyes.
Adaptive threshold: calibrated from mean EAR of first 90 frames (3 seconds).
Default threshold if calibration fails: 0.21
```

#### PERCLOS — Percentage Eye Closure
```
Rolling deque of length = fps × 60 (e.g. 1800 entries at 30fps)
Each frame: push 1 if EAR < threshold × 0.8, else push 0
PERCLOS = (sum of deque / len(deque)) × 100
```

#### MAR — Mouth Aspect Ratio
```
MAR = (||p2−p8|| + ||p3−p7|| + ||p4−p6||) / (2 × ||p1−p5||)

MediaPipe FaceMesh landmark indices (outer lip):
  p1=78, p2=82, p3=87, p4=13, p5=312, p6=317, p7=402, p8=308

yawnDetected = MAR > 0.6 sustained for ≥ 45 consecutive frames at 30fps
```

#### Head Pose — Pitch / Yaw / Roll
```
3D model points (generic face):
  Nose tip:        (0, 0, 0)
  Chin:            (0, -63, -12)
  Left eye corner: (-43, 32, -26)
  Right eye corner: (43, 32, -26)
  Left mouth:      (-28, -28, -24)
  Right mouth:     (28, -28, -24)

Camera matrix: estimated from image width/height + focal length approximation
cv2.solvePnP → rvec → cv2.Rodrigues → rotation matrix → Euler angles
```

#### Posture Score
```
MediaPipe Pose landmarks:
  Left shoulder:  11
  Right shoulder: 12
  Left ear:       7
  Right ear:      8

baseline_midpoint = calibrated mean shoulder midpoint from first 90 frames
baseline_ear_y    = calibrated mean ear Y from first 90 frames

shoulder_tilt = arctan(abs(left_shoulder.y - right_shoulder.y) /
                        abs(left_shoulder.x - right_shoulder.x))
forward_lean  = euclidean((left_ear + right_ear)/2, (left_shoulder + right_shoulder)/2)
                − baseline_forward_lean

postureScore = min(1.0, (shoulder_tilt / 0.35) × 0.4 + (forward_lean / 80) × 0.6)
```

---

### 1.3 Composite Score Fusion

```
compositeScore =   (EAR_norm   × 0.30)
               + (PERCLOS_norm × 0.25)
               + (MAR_norm     × 0.20)
               + (pose_norm    × 0.15)
               + (postureScore × 0.10)

Where:
  EAR_norm     = clamp((threshold − ear) / threshold, 0, 1)
  PERCLOS_norm = clamp(perclos / 40, 0, 1)
  MAR_norm     = clamp((mar − 0.3) / 0.6, 0, 1)
  pose_norm    = clamp(max(|pitch|/30, |yaw|/35, |roll|/20), 0, 1)

Alert level thresholds:
  0 (Alert)    → compositeScore < 0.25
  1 (Mild)     → 0.25 ≤ compositeScore < 0.50
  2 (Warning)  → 0.50 ≤ compositeScore < 0.75
  3 (Critical) → compositeScore ≥ 0.75
```

---

### 1.4 Calibration Protocol

The frontend sends frames immediately on "Start Monitoring" but shows a `CalibrationOverlay` for 3 seconds. During these 3 seconds the server **must** collect calibration frames silently without the composite score spiking.

```python
CALIBRATION_FRAMES = 90  # 3s × 30fps

# On new WebSocket connection:
calibration_buffer = []
calibrated = False

# On each frame during calibration:
if len(calibration_buffer) < CALIBRATION_FRAMES:
    calibration_buffer.append(current_ear)
    ear_baseline = mean(calibration_buffer)
    # Return neutral metrics during calibration:
    return DetectionMetrics(
        compositeScore=0.05,
        alertLevel=0,
        alertLabel="Alert",
        ...  # real ear/perclos/etc still computed and returned
    )
else:
    calibrated = True
    ear_threshold = ear_baseline * 0.75  # 75% of baseline = drowsy
```

---

### 1.5 CORS & Connection Headers

```python
# FastAPI CORS config
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 1.6 Error Handling

If a frame cannot be decoded (corrupt JPEG, empty message), the server **must not close the connection**. Skip the frame silently.

```python
try:
    frame = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        return  # skip corrupt frame
    metrics = pipeline.process(frame)
    await ws.send_text(metrics.model_dump_json())
except Exception:
    pass  # never close the WS on a single bad frame
```

---

## Part 2 — NestJS Application Backend

**Port:** `3001`  
**Base path:** `/api`  
**Auth:** JWT Bearer tokens  
**Database:** PostgreSQL

---

### 2.1 Auth Endpoints

#### `POST /api/auth/login`

The **only** endpoint the frontend calls without a token. This is the first thing called when a user submits the login form.

**Request:**
```json
{
  "email":    "driver@demo.com",
  "password": "demo123"
}
```

**Response `200 OK`:**
```json
{
  "user": {
    "id":             "u-driver-01",
    "name":           "Alex Driver",
    "email":          "driver@demo.com",
    "role":           "driver",
    "licenseNo":      "NP-D-4821",
    "avatarInitials": "AD"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response `401 Unauthorized`:**
```json
{ "message": "Invalid email or password" }
```

**Response `422 Unprocessable Entity`** (validation):
```json
{ "message": "Validation failed", "errors": ["email must be an email"] }
```

**JWT payload:**
```json
{
  "sub":   "u-driver-01",
  "role":  "driver",
  "email": "driver@demo.com",
  "iat":   1719662400,
  "exp":   1719748800
}
```

**Notes:**
- Token expiry: 24 hours
- The frontend stores the token in Zustand + localStorage + cookie (`drowsy_token`)
- Role is stored in a separate cookie (`drowsy_role`) for the Next.js middleware to read without decoding JWT

---

#### `POST /api/auth/refresh`

**Request header:** `Authorization: Bearer <token>`  
**Response `200 OK`:** Same shape as login response with a new token.

---

#### `GET /api/auth/me`

**Request header:** `Authorization: Bearer <token>`  
**Response `200 OK`:** `AuthUser` object (same as the `user` field in login response).

---

### 2.2 `AuthUser` Shape

All role-specific optional fields:

```typescript
interface AuthUser {
  id:             string;  // "u-driver-01"
  name:           string;  // "Alex Driver"
  email:          string;
  role:           "driver" | "insurer" | "admin";
  licenseNo?:     string;  // drivers only — "NP-D-4821"
  companyId?:     string;  // insurers only — "HBI-Nepal"
  avatarInitials?: string; // "AD"
}
```

---

### 2.3 Session Endpoints

All session endpoints require `Authorization: Bearer <token>` and are scoped to the authenticated driver.

---

#### `POST /api/sessions/start`

Called when the driver clicks "Start Monitoring" (after calibration).

**Request:**
```json
{
  "driverId":  "u-driver-01",
  "startedAt": "2026-06-29T14:30:00.000Z",
  "demoMode":  false
}
```

**Response `201 Created`:**
```json
{
  "sessionId": "sess-20260629-143000-abc123"
}
```

---

#### `POST /api/sessions/:id/end`

Called when the driver clicks "Stop Session".

**Request:**
```json
{
  "endedAt":    "2026-06-29T15:15:30.000Z",
  "durationS":  2730,
  "avgScore":   0.22,
  "peakScore":  0.61,
  "alertCount": { "0": 2487, "1": 203, "2": 38, "3": 2 },
  "riskBand":   "B",
  "premiumAdjustment": 0.92,
  "events": [
    {
      "timestamp": "2026-06-29T14:47:13.000Z",
      "level":     2,
      "score":     0.53,
      "ear":       0.24,
      "perclos":   18.2,
      "mar":       0.31
    }
  ]
}
```

**Response `200 OK`:**
```json
{
  "session": {
    "id":          "sess-20260629-143000-abc123",
    "startedAt":   "2026-06-29T14:30:00.000Z",
    "endedAt":     "2026-06-29T15:15:30.000Z",
    "durationS":   2730,
    "avgScore":    0.22,
    "peakScore":   0.61,
    "alertCount":  { "0": 2487, "1": 203, "2": 38, "3": 2 },
    "riskBand":    "B",
    "premiumAdjustment": 0.92,
    "events": [ ... ]
  }
}
```

---

#### `GET /api/sessions`

Returns all sessions for the authenticated driver, newest first.

**Query params:**
- `limit`  — default `50`, max `200`
- `offset` — default `0`
- `band`   — optional filter: `"A"|"B"|"C"|"D"|"F"`

**Response `200 OK`:**
```json
{
  "sessions": [
    {
      "id":          "sess-20260629-143000-abc123",
      "startedAt":   "2026-06-29T14:30:00.000Z",
      "endedAt":     "2026-06-29T15:15:30.000Z",
      "durationS":   2730,
      "avgScore":    0.22,
      "peakScore":   0.61,
      "alertCount":  { "0": 2487, "1": 203, "2": 38, "3": 2 },
      "riskBand":    "B",
      "premiumAdjustment": 0.92,
      "events":      []
    }
  ],
  "total":  12,
  "offset": 0,
  "limit":  50
}
```

---

#### `GET /api/sessions/:id`

Returns a single session with full `events` array.

**Response `200 OK`:** Single `Session` object (same shape as above, with `events` populated).

**Response `404 Not Found`:**
```json
{ "message": "Session not found" }
```

---

### 2.4 Fleet / Driver Endpoints

These endpoints require `role: "insurer" | "admin"`.

---

#### `GET /api/fleet/summary`

**Response `200 OK`:**
```json
{
  "companyName":          "Himalayan Bus & Insurance — Nepal",
  "totalDrivers":         24,
  "activeThisWeek":       18,
  "fleetRiskBand":        "B",
  "avgPremiumAdjustment": 0.974,
  "l3AlertsThisWeek":     14,
  "l3AlertsChangePercent": -12,
  "bandDistribution": {
    "A": 5,
    "B": 8,
    "C": 6,
    "D": 4,
    "F": 1
  }
}
```

---

#### `GET /api/fleet/drivers`

**Query params:**
- `band`   — filter by risk band
- `trend`  — `"improving"|"stable"|"declining"`
- `sortBy` — `"band"|"avgScore"|"l3AlertsThisWeek"|"premiumAdjustment"`
- `order`  — `"asc"|"desc"` (default `"asc"`)
- `limit`  — default `50`
- `offset` — default `0`

**Response `200 OK`:**
```json
{
  "drivers": [
    {
      "id":                   "driver-001",
      "name":                 "Ram Bahadur Thapa",
      "email":                "ram.bahadur.thapa@fleet.hbi",
      "licenseNo":            "NP-D-4800",
      "vehicle":              "Toyota Hiace · BA 1 KHA 234",
      "riskBand":             "A",
      "avgScore":             0.11,
      "peakScore":            0.29,
      "totalSessions":        14,
      "totalHoursMonitored":  18.5,
      "l3AlertsThisWeek":     0,
      "l3AlertsThisMonth":    0,
      "premiumAdjustment":    0.85,
      "lastSessionDate":      "2026-06-28T08:15:00.000Z",
      "trend":                "stable",
      "scoreHistory":         [0.12, 0.11, 0.10, 0.13, 0.11, 0.12, 0.10]
    }
  ],
  "total":  24,
  "offset": 0,
  "limit":  50
}
```

---

#### `GET /api/fleet/drivers/:driverId`

Single driver profile with full score history.

**Response `200 OK`:** Single `FleetDriver` object.

---

#### `GET /api/fleet/drivers/:driverId/sessions`

All sessions for a specific driver (insurer view).

**Response `200 OK`:** Same shape as `GET /api/sessions` but for any driver.

---

### 2.5 Claims Endpoints

Require `role: "insurer" | "admin"`.

---

#### `GET /api/claims`

**Query params:**
- `status` — `"open"|"investigating"|"resolved"|"denied"`
- `type`   — `"fatigue-related"|"collision"|"other"`
- `driverId` — filter by driver
- `limit`, `offset`

**Response `200 OK`:**
```json
{
  "claims": [
    {
      "id":                       "CLM-2026-1001",
      "driverId":                 "driver-014",
      "driverName":               "Tek Bahadur Limbu",
      "vehicle":                  "Tata Prima · BA 1 GA 788",
      "incidentDate":             "2026-06-22T09:30:00.000Z",
      "reportedDate":             "2026-06-24T14:00:00.000Z",
      "type":                     "fatigue-related",
      "status":                   "investigating",
      "amountNPR":                50000,
      "alertLevelAtIncident":     1,
      "compositeScoreAtIncident": 0.41,
      "evidenceFrames":           5,
      "notes":                    "Level 1 drowsiness alert recorded 3 min before incident.",
      "frames":                   []
    }
  ],
  "total":  8,
  "offset": 0,
  "limit":  50
}
```

---

#### `GET /api/claims/:claimId`

Single claim with full `frames` array populated.

**Response `200 OK`:**
```json
{
  "id":    "CLM-2026-1001",
  "...":   "...all claim fields...",
  "frames": [
    {
      "frameId":                "CLM-2026-1001-F001",
      "capturedAt":             "2026-06-22T09:25:00.000Z",
      "secondsBeforeIncident":  300,
      "alertLevel":             0,
      "compositeScore":         0.06,
      "ear":                    0.37,
      "perclos":                2.1,
      "hash":                   "a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1"
    }
  ]
}
```

#### `EvidenceFrame` field reference

| Field | Type | Description |
|-------|------|-------------|
| `frameId` | `string` | Format: `"{claimId}-F{padded_index}"` e.g. `"CLM-2026-1001-F048"` |
| `capturedAt` | `string` | ISO 8601 UTC timestamp of frame capture |
| `secondsBeforeIncident` | `number` | Seconds before the incident time. `0` = incident frame |
| `alertLevel` | `0\|1\|2\|3` | Alert level at time of capture |
| `compositeScore` | `number` | `0.0–1.0` |
| `ear` | `number` | Eye Aspect Ratio at capture |
| `perclos` | `number` | PERCLOS value at capture |
| `hash` | `string` | SHA-256 hex (64 chars) of raw JPEG bytes + timestamp + GPS |

**Hash computation (server-side):**
```python
import hashlib, json

def frame_hash(jpeg_bytes: bytes, timestamp: str, gps: dict | None) -> str:
    payload = jpeg_bytes + timestamp.encode() + json.dumps(gps or {}).encode()
    return hashlib.sha256(payload).hexdigest()
```

---

#### `PATCH /api/claims/:claimId`

Update claim status or notes.

**Request:**
```json
{
  "status": "resolved",
  "notes":  "Claim verified. Evidence frames confirm Level 1 alert 3 min prior. Settlement approved."
}
```

**Response `200 OK`:** Updated `Claim` object.

---

### 2.6 Reports / Export Endpoints

---

#### `GET /api/reports/actuarial`

CSV export of all driver risk scores for actuarial calculation.

**Query params:**
- `format` — `"csv"` (default) or `"json"`

**Response `200 OK` (CSV):**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="drowsyshield-actuarial-2026-06-29.csv"

driver_id,name,license_no,vehicle,risk_band,avg_score,peak_score,
total_sessions,total_hours,l3_alerts_week,l3_alerts_month,premium_adjustment,trend
driver-001,Ram Bahadur Thapa,NP-D-4800,Toyota Hiace · BA 1 KHA 234,A,0.11,0.29,14,18.5,0,0,0.85,stable
...
```

---

#### `GET /api/reports/session/:sessionId/pdf`

Generates and streams a session PDF report.

**Response `200 OK`:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="DrowsyShield-sess-xxx-Report.pdf"
```

---

#### `GET /api/reports/claim/:claimId/evidence`

Streams the evidence PDF for a claim (same content as the frontend-generated PDF, but server-signed for legal admissibility).

**Response `200 OK`:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="DrowsyShield-CLM-2026-1001-Evidence.pdf"
```

---

### 2.7 CORS Configuration

```typescript
// main.ts
app.enableCors({
  origin:      'http://localhost:3000',
  credentials: true,
  methods:     ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

---

### 2.8 JWT Guard

All endpoints except `POST /api/auth/login` require:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Return `401` with `{ "message": "Unauthorized" }` if token is missing, invalid, or expired.

---

### 2.9 PostgreSQL Schema (reference)

```sql
-- Users
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(200) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            VARCHAR(20)  NOT NULL CHECK (role IN ('driver','insurer','admin')),
  license_no      VARCHAR(50),
  company_id      VARCHAR(100),
  avatar_initials VARCHAR(4),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions
CREATE TABLE sessions (
  id                  VARCHAR(60)  PRIMARY KEY,
  driver_id           UUID         NOT NULL REFERENCES users(id),
  started_at          TIMESTAMPTZ  NOT NULL,
  ended_at            TIMESTAMPTZ,
  duration_s          INTEGER,
  avg_score           REAL,
  peak_score          REAL,
  alert_count_0       INTEGER DEFAULT 0,
  alert_count_1       INTEGER DEFAULT 0,
  alert_count_2       INTEGER DEFAULT 0,
  alert_count_3       INTEGER DEFAULT 0,
  risk_band           CHAR(1) CHECK (risk_band IN ('A','B','C','D','F')),
  premium_adjustment  REAL,
  demo_mode           BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Session alert events
CREATE TABLE alert_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  VARCHAR(60) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  timestamp   TIMESTAMPTZ NOT NULL,
  level       SMALLINT    NOT NULL,
  score       REAL,
  ear         REAL,
  perclos     REAL,
  mar         REAL
);

-- Claims
CREATE TABLE claims (
  id                          VARCHAR(30)  PRIMARY KEY,
  driver_id                   UUID         NOT NULL REFERENCES users(id),
  vehicle                     VARCHAR(100),
  incident_date               TIMESTAMPTZ  NOT NULL,
  reported_date               TIMESTAMPTZ  NOT NULL,
  type                        VARCHAR(30)  CHECK (type IN ('fatigue-related','collision','other')),
  status                      VARCHAR(20)  CHECK (status IN ('open','investigating','resolved','denied')),
  amount_npr                  INTEGER,
  alert_level_at_incident     SMALLINT,
  composite_score_at_incident REAL,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ  DEFAULT NOW()
);

-- Evidence frames (linked to claims)
CREATE TABLE evidence_frames (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id                VARCHAR(30) NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  frame_index             INTEGER     NOT NULL,
  captured_at             TIMESTAMPTZ NOT NULL,
  seconds_before_incident INTEGER,
  alert_level             SMALLINT,
  composite_score         REAL,
  ear                     REAL,
  perclos                 REAL,
  hash                    CHAR(64)    NOT NULL,
  jpeg_s3_key             VARCHAR(255)  -- S3/Minio path to raw frame
);

-- Indexes for common queries
CREATE INDEX idx_sessions_driver   ON sessions(driver_id, started_at DESC);
CREATE INDEX idx_alert_events_sess ON alert_events(session_id);
CREATE INDEX idx_claims_driver     ON claims(driver_id);
CREATE INDEX idx_evidence_claim    ON evidence_frames(claim_id, frame_index);
```

---

## Part 3 — Quick Reference: What Each Frontend Page Calls

| Page | Endpoint called |
|------|----------------|
| `/login` | `POST /api/auth/login` |
| `/monitor` (start) | `POST /api/sessions/start` |
| `/monitor` (live) | `WS ws://localhost:8000/ws/detect` |
| `/monitor` (stop) | `POST /api/sessions/:id/end` |
| `/dashboard` | `GET /api/sessions?limit=50` |
| `/sessions` | `GET /api/sessions` |
| `/sessions/:id` | `GET /api/sessions/:id` |
| `/insurer` | `GET /api/fleet/summary` + `GET /api/fleet/drivers` |
| `/insurer/driver/:id` | `GET /api/fleet/drivers/:id` + `GET /api/fleet/drivers/:id/sessions` |
| `/insurer/claims` | `GET /api/claims` |
| `/insurer/claims/:id` | `GET /api/claims/:id` |
| `/driver/risk-card` | `GET /api/sessions` (derive band client-side) |
| Export PDF (claims) | frontend-only via `@react-pdf/renderer` |
| Actuarial CSV | `GET /api/reports/actuarial?format=csv` |

---

## Part 4 — Demo Credentials (seeded in DB)

```
email: driver@demo.com         password: demo123  → role: driver
email: insurer@fleet.com       password: demo123  → role: insurer
email: admin@drowsyshield.com  password: demo123  → role: admin
```

The frontend falls back to these via in-memory mock if the backend is offline. Seed them in the DB so the same credentials work with a live backend.

---

## Part 5 — Environment Variables (Backend)

### Python FastAPI
```
HOST=0.0.0.0
PORT=8000
CORS_ORIGIN=http://localhost:3000
CALIBRATION_FRAMES=90
EAR_THRESHOLD_DEFAULT=0.21
EAR_THRESHOLD_MULTIPLIER=0.75
PERCLOS_WINDOW_SECONDS=60
MAR_YAWN_THRESHOLD=0.6
MAR_YAWN_DURATION_FRAMES=45
COMPOSITE_WEIGHTS=0.30,0.25,0.20,0.15,0.10
```

### NestJS
```
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/drowsyshield
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:3000
BCRYPT_ROUNDS=12
```

---

*This document should be kept in sync with `types/detection.ts`, `types/insurer.ts`, and `types/auth.ts`. If any TypeScript type changes, update this spec first.*
