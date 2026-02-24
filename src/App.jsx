import React from 'react'
import { Canvas } from '@react-three/fiber'
import { XR, createXRStore } from '@react-three/xr'
import { OrbitControls, Sky, ContactShadows } from '@react-three/drei'
import { Inhaler } from './components/3d/Inhaler'
import { Clipboard } from './components/3d/Clipboard'
import { ClinicRoom } from './components/3d/Clinic_vr_scene'

const store = createXRStore()

const initialPositions = {
  inhaler: [0, 1, 0],
  clipboard: [0.4, 1, 0],
}

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#111' }}>
      <button
        style={{
          position: 'absolute',
          zIndex: 10,
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 24px',
        }}
        onClick={() => store.enterVR()}
      >
        Enter VR Training
      </button>

      <Canvas camera={{ position: [0, 1.6, 3], fov: 75 }}>
        <XR store={store}>
          <Sky sunPosition={[100, 20, 100]} />
          <ambientLight intensity={0.7} />
          <directionalLight intensity={1.2} position={[5, 6, 4]} />
          <hemisphereLight intensity={0.5} />

          {/** Tweak these to match your Unity scene layout. */}
          {null}

          <ClinicRoom>
            <Inhaler position={initialPositions.inhaler} scale={0.003} />
            <Clipboard position={initialPositions.clipboard} scale={0.005} />
          </ClinicRoom>

          <ContactShadows opacity={1} scale={10} blur={1} far={10} resolution={256} color="#000000" />
          <OrbitControls makeDefault />
        </XR>
      </Canvas>
    </div>
  )
}