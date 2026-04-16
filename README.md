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

Copy the example env first:

```bash
cp .env.example .env
```

Keep `VITE_ENABLE_CONVAI=false` unless you are explicitly testing the Convai-guided experience.

Available env vars:

- `VITE_ENABLE_CONVAI=false`
- `VITE_CONVAI_API_KEY=`
- `VITE_CONVAI_CHARACTER_ID=`
- `VITE_SHOW_CONVAI_DEBUG_PANEL=false`

The Convai desktop debug panel is hidden by default and is only meant for local debugging.

## How to Use

- Click **Enter VR Training** to start XR.
- In desktop mode, look at the in-world start kiosk on the table and click **Start Training**.
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
