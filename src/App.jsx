import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR, XROrigin, createXRStore, useXR } from '@react-three/xr'
import * as THREE from 'three'
import { Inhaler } from './components/3d/Inhaler'
import { Clipboard } from './components/3d/Clipboard'
import { ClinicRoom } from './components/3d/Clinic_vr_scene'
import { ConvaiAvatar } from './components/3d/ConvaiAvatar'
import { FpsControls } from './components/3d/FpsControls'
import { VRLocomotion } from './components/3d/VRLocomotion'
import { TrainingStartPanel3D } from './components/3d/TrainingStartPanel3D'
import { TrainingReviewPanel3D } from './components/3d/TrainingReviewPanel3D'
import { TrainingBranchPanel3D } from './components/3d/TrainingBranchPanel3D'
import { TrainingGuides3D } from './components/3d/TrainingGuides3D'
import { XRControlHints3D } from './components/3d/XRControlHints3D'
import { VideoPanel3D } from './components/3d/VideoPanel3D'
import { ConvaiXRMicControls } from './components/3d/ConvaiXRMicControls'
import { ConvaiProvider } from './convai/ConvaiContext'
import { ConvaiTrainingOrchestrator } from './components/ConvaiTrainingOrchestrator'
import { TrainingHUD } from './components/TrainingHUD'
import { ConvaiRuntime } from './components/ConvaiRuntime'
import { TrainingStepFeedback } from './components/TrainingStepFeedback'
import { AssessmentOrchestrator } from './components/AssessmentOrchestrator'
import { AssessmentEndPanel3D } from './components/3d/AssessmentEndPanel3D'
import { BrandBadge } from './components/BrandBadge'
import { readConvaiConfig } from './convai/config'

function Crosshair() {
    const [locked, setLocked] = useState(false)

    useEffect(() => {
        const onLockChange = () => setLocked(!!document.pointerLockElement)
        document.addEventListener('pointerlockchange', onLockChange)
        return () => document.removeEventListener('pointerlockchange', onLockChange)
    }, [])

    if (!locked) return null

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 20,
        }}>
            <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#4ade80',
                boxShadow: '0 0 4px rgba(0,0,0,0.8)',
            }} />
        </div>
    )
}

const store = createXRStore()
const convaiConfig = readConvaiConfig()
const showConvaiAvatar = convaiConfig.enabled && convaiConfig.isConfigured
const XR_WORLD_SCALE = 1.8
const XR_SPAWN_POSITION = [-2.35, 0, 1.15]
const XR_SPAWN_ROTATION_Y = 0

function ActiveVRLocomotion({ originRef }) {
    const xrMode = useXR((state) => state.mode)

    if (xrMode !== 'immersive-vr') {
        return null
    }

    return <VRLocomotion originRef={originRef} />
}

export default function App() {
    const [collisionLayout, setCollisionLayout] = useState(null)
    const xrOriginRef = useRef(null)
    const handleCollisionLayoutChange = useCallback((nextLayout) => {
        setCollisionLayout(nextLayout)
    }, [])

    useEffect(() => {
        const unsubscribe = store.subscribe((state, prevState) => {
            if (state.mode !== 'immersive-vr' || prevState.mode === 'immersive-vr') {
                return
            }

            const origin = xrOriginRef.current
            if (!origin) {
                return
            }

            origin.position.set(...XR_SPAWN_POSITION)
            origin.rotation.set(0, XR_SPAWN_ROTATION_Y, 0)
            origin.scale.setScalar(XR_WORLD_SCALE)
        })

        return () => {
            unsubscribe()
        }
    }, [])

    return (
        <ConvaiProvider config={convaiConfig}>
            <div style={{ width: '100vw', height: '100vh', background: '#111' }}>
                <Crosshair />
                {convaiConfig.enabled && <ConvaiRuntime config={convaiConfig} />}
                <ConvaiTrainingOrchestrator />
                <AssessmentOrchestrator />
                <TrainingStepFeedback />

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

                <div style={{ position: 'absolute', top: 22, left: 22, zIndex: 10 }}>
                    <BrandBadge subtitle="Immersive coaching" />
                </div>

                <TrainingHUD />

                <Canvas camera={{ position: [-2.35, 1.6, 1.15], rotation: [-0.06, 0, 0], fov: 75 }}>
                    <XR store={store}>
                        <XROrigin
                            ref={xrOriginRef}
                            position={XR_SPAWN_POSITION}
                            scale={[XR_WORLD_SCALE, XR_WORLD_SCALE, XR_WORLD_SCALE]}
                        />
                        <color attach="background" args={['#e9dfcf']} />
                        <fog attach="fog" args={['#e9dfcf', 8, 28]} />
                        <ambientLight intensity={0.9} color={new THREE.Color('#f3ecdf')} />
                        <directionalLight intensity={0.95} position={[4, 5, 3]} color={new THREE.Color('#fff2de')} />
                        <hemisphereLight intensity={0.75} color={new THREE.Color('#f6efe3')} groundColor={new THREE.Color('#7b6655')} />
                        <pointLight intensity={0.55} position={[-2.5, 2.8, -0.8]} color={new THREE.Color('#ffe9c8')} />
                        <pointLight intensity={0.35} position={[0.8, 2.1, -4.6]} color={new THREE.Color('#f6d9ad')} />

                        {/** Tweak these to match your Unity scene layout. */}
                        {null}

                        <ClinicRoom
                            onCollisionLayoutChange={handleCollisionLayoutChange}
                            convaiAvatar={
                                showConvaiAvatar ? (
                                    <React.Suspense fallback={null}>
                                        <ConvaiAvatar scale={[1.25, 1.22, 1.25]} />
                                    </React.Suspense>
                                ) : null
                            }
                        >
                            <Inhaler position={[-2.8, 1.02, -0.5]} rotation={[Math.PI, Math.PI / 2, Math.PI / 2]} scale={0.002} />
                            <Clipboard position={[-2, 1.02, -0.5]} scale={0.008} />
                        </ClinicRoom>
                        <TrainingStartPanel3D position={[-2.35, 1.7, -0.62]} />
                        <TrainingBranchPanel3D position={[-2.35, 1.62, -0.55]} rotation={[0, 0, 0]} />
                        <TrainingReviewPanel3D position={[-2.35, 1.78, -0.72]} />
                        <TrainingGuides3D />
                        <VideoPanel3D position={[-3.6, 1.72, -1.8]} />
                        <XRControlHints3D position={[-1.55, 1.88, -0.15]} />
                        <AssessmentEndPanel3D position={[-2.35, 1.4, -0.15]} />
                        <ActiveVRLocomotion originRef={xrOriginRef} />
                        <FpsControls canLockPointer collisionLayout={collisionLayout} />
                        <ConvaiXRMicControls />
                    </XR>
                </Canvas>
            </div>
        </ConvaiProvider>
    )
}
