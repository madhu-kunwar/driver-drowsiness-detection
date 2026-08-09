# API Endpoints Documentation

## Base URL
`http://localhost:8000/api/v1`

## Endpoints

### POST /detect
Process a single frame for drowsiness detection.

**Request:**
- Content-Type: multipart/form-data
- Body: `frame` (image file)

**Response:**
```json
{
  "status": "success",
  "data": {
    "is_drowsy": false,
    "is_yawning": false,
    "is_distracted": false,
    "ear_value": 0.31,
    "mar_value": 0.42,
    "head_pose": {
      "pitch": 5.2,
      "yaw": -3.1,
      "roll": 1.8
    },
    "alert_level": 0,
    "confidence": 0.94
  }
}
```

### WebSocket /ws/detect
Real-time detection stream.

**Message Format (Client → Server):**
- Binary frame data (JPEG encoded)

**Message Format (Server → Client):**
```json
{
  "ear": 0.28,
  "mar": 0.35,
  "drowsy": false,
  "yawning": false,
  "distracted": false,
  "alert_level": 0,
  "fps": 24
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "version": "1.0.0"
}
```
