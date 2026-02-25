# Inhalo 360 (React Three Fiber)

VR training prototype migrated from Unity to React Three Fiber + XR.

## Tech Stack
- React + Vite
- three.js / @react-three/fiber
- @react-three/drei
- @react-three/xr
- Zustand

## Getting Started
bash
npm install
npm run dev


Open the URL from Vite (usually http://localhost:5173).
## How to Use
- Click **Enter VR Training** to start XR.
- Click the inhaler to focus it.
- Shake by moving the inhaler (mouse).
- Double‑click to toggle the cap after shaking.
- Click the clipboard to view step instructions.
- Right‑click to return focused items.

## Project Structure
public/models/ # Raw + transformed GLB assets
src/components/3d/ # R3F components (ClinicRoom, Inhaler, Clipboard)
src/store/useTrainingStore.js
src/App.jsx


## Notes
- Model positions can be tweaked in `src/App.jsx` via `initialPositions`.
