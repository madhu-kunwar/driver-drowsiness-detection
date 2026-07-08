"""
DrowsyShield — Python FastAPI Detection Server
===============================================
Runs on port 8000. The Next.js frontend connects via WebSocket.

Start:
  cd ai
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload

Endpoints:
  WS   /ws/detect          ← browser sends JPEG blobs, receives JSON metrics
  GET  /health             ← health check
  POST /api/calibrate      ← force re-calibration for current session (not used yet)
"""

import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from detection.pipeline import DetectionPipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("drowsyshield")


# ── App lifecycle ────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("DrowsyShield detection server starting…")
    log.info("WebSocket endpoint: ws://localhost:8000/ws/detect")
    yield
    log.info("Server shutting down.")


app = FastAPI(
    title="DrowsyShield Detection API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health check ─────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "drowsyshield-detection"}


# ── WebSocket detection endpoint ─────────────────────────────────────

@app.websocket("/ws/detect")
async def detection_ws(websocket: WebSocket):
    """
    One pipeline instance per connection = one driver per session.
    Browser sends JPEG blob every ~33ms (30fps).
    Server responds with DetectionMetrics JSON.
    """
    await websocket.accept()
    pipeline = DetectionPipeline()
    client   = websocket.client
    log.info(f"Client connected: {client}")

    try:
        while True:
            # Accept both bytes (JPEG blob) and text (control messages)
            data = await websocket.receive()

            if "bytes" in data and data["bytes"]:
                try:
                    result = await pipeline.process(data["bytes"])
                    await websocket.send_text(json.dumps(result.to_dict()))
                except ValueError as e:
                    # Bad frame — skip silently
                    log.debug(f"Frame decode error: {e}")
                except Exception as e:
                    log.warning(f"Pipeline error: {e}")
                    await websocket.send_text(json.dumps({
                        "error": str(e),
                        "alertLevel": 0,
                        "alertLabel": "Alert",
                        "compositeScore": 0.0,
                        "timestamp": "",
                    }))

            elif "text" in data and data["text"]:
                msg = data["text"]
                if msg == "calibrate":
                    pipeline.reset()
                    log.info(f"Re-calibration triggered by {client}")
                    await websocket.send_text(json.dumps({"event": "calibrating"}))

    except WebSocketDisconnect:
        log.info(f"Client disconnected: {client}")
    except Exception as e:
        log.error(f"Unexpected error for {client}: {e}")
    finally:
        log.info(f"Session ended: {client}")
