# Backend Setup Guide

## Requirements
- Python 3.9+
- FastAPI
- MediaPipe
- OpenCV
- NumPy

## Environment Variables
- `MODEL_PATH` - Path to trained model weights
- `CONFIDENCE_THRESHOLD` - Detection confidence (default: 0.7)
- `FRAME_SKIP` - Process every Nth frame for performance (default: 2)

## Running
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
