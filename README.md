# Inhalo 360 (React Three Fiber)

VR training prototype migrated from Unity to React Three Fiber + XR.

## Tech Stack

- React + Vite
- three.js / `@react-three/fiber`
- `@react-three/drei`
- `@react-three/xr`
- Zustand
- Convai Web SDK scaffold for future NPC integration

## Getting Started

```bash
npm install
npm run dev
```

Open the URL from Vite, usually `http://localhost:5173`.

## Phase 1 Convai Scaffold Setup

Phase 1 adds only the baseline Convai integration scaffold. It does not yet render agent audio, UI, or the avatar.

```bash
cp .env.example .env
```

Leave `VITE_ENABLE_CONVAI=false` unless you are explicitly testing the scaffold.

Available env vars:

- `VITE_ENABLE_CONVAI=false`
- `VITE_CONVAI_API_KEY=`
- `VITE_CONVAI_CHARACTER_ID=`

## How to Use

- Click **Enter VR Training** to start XR.
- Click the inhaler to focus it.
- Shake by moving the inhaler with the mouse.
- Click to advance the interaction steps when prompted.
- Click the clipboard to view step instructions.
- Right-click to return focused items.

## Project Structure

- `public/models/` raw and transformed GLB assets
- `src/components/3d/` R3F scene and interactable components
- `src/components/ConvaiRuntime.jsx` flag-gated Convai scaffold runtime
- `src/convai/config.js` centralized Convai env parsing
- `src/hooks/useConvaiNpc.js` minimal Convai client hook
- `src/store/useTrainingStore.js` inhaler training state
- `src/App.jsx` app shell and scene mounting

## Notes

- Model positions can be tweaked in `src/App.jsx`.
- The deeper phase-by-phase integration plan lives in `CONVAI_INTEGRATION_REFERENCE.md`.
