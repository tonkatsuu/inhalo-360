import { Billboard, RoundedBox, Text, useVideoTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useXR } from '@react-three/xr'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useConvaiRuntime } from '../../convai/useConvaiRuntime'
import { getStepIndex } from '../../training/engine'
import { useTrainingStore } from '../../store/useTrainingStore'

const PANEL_WIDTH = 0.72
const PANEL_HEIGHT = 0.52
const FLOAT_AMPLITUDE = 0.008



const STEP_VIDEO_FILES = {
    shake_initial: '/shake_initial.mp4',
    second_dose_shake: '/shake_initial.mp4',
    hold_upright: '/hold_upright.mp4',
    breathe_out: '/breathe_out.mp4',
    second_dose_breathe_out: '/breathe_out.mp4',
    mouth_seal: '/mouth_seal.mp4',
    second_dose_mouth_seal: '/mouth_seal.mp4',
    inhale_press: '/inhale_press.mp4',
    second_dose_inhale_press: '/inhale_press.mp4',
    hold_breath: '/hold_breath.mp4',
    second_dose_hold_breath: '/hold_breath.mp4',
    second_dose_decision: '/second_dose_decision.mp4',
}

const videoStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '8px',
}

function VideoContent({ src, opacity }) {
    const texture = useVideoTexture(src, {
        unsuspended: 'canplay',
        muted: true,
        loop: true,
        playsInline: true,
    })

    return (
        <mesh position={[0, -0.015, 0.025]}>
            <planeGeometry args={[0.64, 0.64 * (9 / 16)]} />
            <meshBasicMaterial 
                map={texture} 
                toneMapped={false} 
                transparent 
                opacity={opacity}
                side={THREE.DoubleSide}
            />
        </mesh>
    )
}


export function VideoPanel3D({ ...props }) {
    const { state } = useConvaiRuntime()
    const currentStepId = useTrainingStore((s) => s.currentStepId)
    const sessionPhase = useTrainingStore((s) => s.sessionPhase)
    const secondDoseChoice = useTrainingStore((s) => s.secondDoseChoice)
    const isClipboardFocused = useTrainingStore((s) => s.isClipboardFocused)
    const camera = useThree((s) => s.camera)
    const xrMode = useXR((s) => s.mode)

    const root = useRef()
    const glassMaterial = useRef()
    const borderMaterial = useRef()
    const shadowMaterial = useRef()
    const headerMaterial = useRef()
    const dotMaterial = useRef()
    const fadeRef = useRef(0)
    const floatTimeRef = useRef(0)
    const [isMounted, setIsMounted] = useState(false)

    const isConnected = state?.isConnected === true
    const currentVideoFile = STEP_VIDEO_FILES[currentStepId]
    const isBranching = sessionPhase === 'branching' && currentStepId === 'second_dose_decision'
    const isVisible = isConnected && !!currentVideoFile && !isClipboardFocused && !isBranching
    const isRendered = isMounted || isVisible
    const stepNumber = getStepIndex(currentStepId, secondDoseChoice) + 1

    // Trigger mount when connected
    if (isVisible && !isMounted) {
        setIsMounted(true)
    }

    const lookTarget = useRef(new THREE.Vector3())



    useFrame((_frameState, delta) => {
        if (!isRendered || !root.current) {
            return
        }

        fadeRef.current = THREE.MathUtils.damp(fadeRef.current, isVisible ? 1 : 0, 8, delta)
        const opacity = fadeRef.current
        const scale = 0.9 + opacity * 0.1
        root.current.scale.setScalar(scale)

        floatTimeRef.current += delta
        root.current.position.y = Math.sin(floatTimeRef.current * 1.4) * FLOAT_AMPLITUDE


        // Face the camera
        lookTarget.current.copy(camera.position)
        root.current.lookAt(lookTarget.current)


        if (glassMaterial.current) {
            glassMaterial.current.opacity = 0.68 * opacity
        }

        if (borderMaterial.current) {
            borderMaterial.current.opacity = 0.72 * opacity
        }

        if (shadowMaterial.current) {
            shadowMaterial.current.opacity = 0.2 * opacity
        }

        if (headerMaterial.current) {
            headerMaterial.current.opacity = 0.75 * opacity
        }

        if (dotMaterial.current) {
            dotMaterial.current.opacity = 0.9 * opacity
        }

        if (!isVisible && opacity < 0.025) {
            setIsMounted(false)
        }
    })

    if (!isRendered) {
        return null
    }

    return (
        <Billboard {...props} follow lockX={false} lockY={false} lockZ={false}>
            <group ref={root}>
                {/* Shadow layer */}
                <RoundedBox
                    args={[PANEL_WIDTH + 0.12, PANEL_HEIGHT + 0.12, 0.015]}
                    radius={0.06}
                    smoothness={6}
                    position={[0, 0, -0.03]}
                >
                    <meshStandardMaterial
                        ref={shadowMaterial}
                        color="#02060a"
                        transparent
                        opacity={0.2}
                    />
                </RoundedBox>

                {/* Border */}
                <RoundedBox
                    args={[PANEL_WIDTH + 0.05, PANEL_HEIGHT + 0.05, 0.025]}
                    radius={0.05}
                    smoothness={6}
                    position={[0, 0, -0.015]}
                >
                    <meshStandardMaterial
                        ref={borderMaterial}
                        color="#46788c"
                        transparent
                        opacity={0.72}
                    />
                </RoundedBox>

                {/* Glass panel */}
                <RoundedBox
                    args={[PANEL_WIDTH, PANEL_HEIGHT, 0.03]}
                    radius={0.045}
                    smoothness={6}
                >
                    <meshStandardMaterial
                        ref={glassMaterial}
                        color="#0b1620"
                        transparent
                        opacity={0.68}
                        roughness={0.86}
                        metalness={0.03}
                    />
                </RoundedBox>

                {/* Header bar with status dot and label */}
                <group position={[-0.08, PANEL_HEIGHT * 0.5 - 0.065, 0.025]}>
                    <RoundedBox
                        args={[0.48, 0.1, 0.015]}
                        radius={0.035}
                        smoothness={4}
                    >
                        <meshStandardMaterial
                            ref={headerMaterial}
                            color="#102734"
                            transparent
                            opacity={0.75}
                        />
                    </RoundedBox>
                    <mesh position={[-0.19, 0, 0.012]}>
                        <sphereGeometry args={[0.018, 16, 16]} />
                        <meshStandardMaterial
                            ref={dotMaterial}
                            color="#f43f5e"
                            transparent
                            opacity={0.9}
                        />
                    </mesh>
                    <Text
                        position={[0.03, -0.001, 0.015]}
                        fontSize={0.038}
                        anchorX="center"
                        anchorY="middle"
                        color="#f8fafc"
                    >
                        {`Step ${stepNumber} Video`}
                    </Text>
                </group>

                {/* Local Video via VideoTexture */}
                {currentVideoFile && (
                    <VideoContent
                        key={currentVideoFile}
                        src={currentVideoFile}
                        opacity={fadeRef.current}
                    />
                )}
            </group>
        </Billboard>
    )
}
