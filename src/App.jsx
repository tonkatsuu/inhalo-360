import React from 'react'
import { Canvas } from '@react-three/fiber'
import { XR, createXRStore } from '@react-three/xr'
import { Inhaler } from './components/3d/Inhaler'
import { Clipboard } from './components/3d/Clipboard'
import { ClinicRoom } from './components/3d/Clinic_vr_scene'
import { ConvaiAvatar } from './components/3d/ConvaiAvatar'
import { FpsControls } from './components/3d/FpsControls'
import { ConvaiProvider } from './convai/ConvaiContext'
import { TrainingHUD } from './components/TrainingHUD'
import { ConvaiRuntime } from './components/ConvaiRuntime'
import { readConvaiConfig } from './convai/config'

const store = createXRStore()
const convaiConfig = readConvaiConfig()
const showConvaiAvatar = convaiConfig.enabled && convaiConfig.isConfigured

export default function App() {
    return (
        <ConvaiProvider config={convaiConfig}>
            <div style={{ width: '100vw', height: '100vh', background: '#111' }}>
                {convaiConfig.enabled && <ConvaiRuntime config={convaiConfig} />}

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

                <TrainingHUD />

                <Canvas camera={{ position: [0, 1.6, 3], fov: 75 }}>
                    <XR store={store}>
                        <ambientLight intensity={0.7} />
                        <directionalLight intensity={1.2} position={[5, 6, 4]} />
                        <hemisphereLight intensity={0.5} />

                        {/** Tweak these to match your Unity scene layout. */}
                        {null}

                        <ClinicRoom>
                            <Inhaler position={[-2.8, 1.02, -0.5]} rotation={[Math.PI, Math.PI / 2, Math.PI / 2]} scale={0.002} />
                            <Clipboard position={[-2, 1.02, -0.5]} scale={0.008} />
                            {showConvaiAvatar && (
                                <React.Suspense fallback={null}>
                                    <ConvaiAvatar position={[1.4, 0, -1.2]} />
                                </React.Suspense>
                            )}
                        </ClinicRoom>
                        <FpsControls />
                    </XR>
                </Canvas>
            </div>
        </ConvaiProvider>
    )
}
