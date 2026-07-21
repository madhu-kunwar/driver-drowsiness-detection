# Frontend Architecture

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- TailwindCSS for styling

## Component Structure
```
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── detection/
│       └── page.tsx
├── components/
│   ├── detection/
│   │   ├── WebcamCapture.tsx    # Main webcam feed component
│   │   ├── DetectionOverlay.tsx # Canvas overlay for landmarks
│   │   └── AlertBanner.tsx     # Drowsiness alert UI
│   └── ui/
│       ├── Button.tsx
│       └── Card.tsx
└── lib/
    ├── api.ts                  # Backend API client
    └── detection-utils.ts      # Client-side detection helpers
```

## Data Flow
1. WebcamCapture captures video frames
2. Frames sent to backend via WebSocket/REST
3. Backend processes with MediaPipe + ML model
4. Results returned and displayed on DetectionOverlay
5. AlertBanner shows warnings when drowsiness detected
