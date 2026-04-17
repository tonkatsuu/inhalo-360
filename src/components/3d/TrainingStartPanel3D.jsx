import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { useCallback, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useConvaiRuntime } from '../../convai/useConvaiRuntime'
import { useTrainingStore } from '../../store/useTrainingStore'
import { BrandChip3D } from './BrandChip3D'
import { faceCameraUpright } from './faceCameraUpright'
import { useHoverSelectAction } from './useHoverSelectAction'
import { useXRHardwareState } from './useXRHardwareState'

const PANEL_WIDTH = 1.2
const PANEL_HEIGHT = 0.84
const PANEL_DEPTH = 0.04
const BUTTON_WIDTH = 0.52
const BUTTON_HEIGHT = 0.16
const TOGGLE_WIDTH = 0.34
const TOGGLE_HEIGHT = 0.09
const FLOAT_AMPLITUDE = 0.015
const HUD_DISTANCE = 1.35
const HUD_FOLLOW_SPEED = 4.5
const HUD_VERTICAL_OFFSET = -0.05

export function TrainingStartPanel3D(props) {
    const root = useRef()
    const glassMaterial = useRef()
    const borderMaterial = useRef()
    const chipMaterial = useRef()
    const shadowMaterial = useRef()
    const hoverRef = useRef(false)
    const fadeRef = useRef(0)
    const floatTimeRef = useRef(0)
    const [isMounted, setIsMounted] = useState(true)
    const [hoveredButton, setHoveredButton] = useState(null) // 'learning' | 'assessment' | null

    const camera = useThree((state) => state.camera)
    const raycaster = useMemo(() => new THREE.Raycaster(), [])
    const forward = useMemo(() => new THREE.Vector3(), [])
    const lookTarget = useMemo(() => new THREE.Vector3(), [])
    const controllerDir = useMemo(() => new THREE.Vector3(), [])
    const controllerRayPos = useMemo(() => new THREE.Vector3(), [])
    const hudTarget = useMemo(() => new THREE.Vector3(), [])
    const tempUp = useMemo(() => new THREE.Vector3(), [])

    const xrMode = useXR((state) => state.mode)
    const { activePointerSource } = useXRHardwareState()

    const { enabled, isConfigured } = useConvaiRuntime()
    const { assessmentRequireSpeech, sessionPhase, sessionError, setAssessmentRequireSpeech, startTraining } = useTrainingStore()

    const isVisible = sessionPhase === 'idle' || sessionPhase === 'starting'
    const isRendered = isMounted || isVisible
    const isStarting = sessionPhase === 'starting'
    const hasStartError = Boolean(sessionError)
    const canStart = enabled && isConfigured && (!isStarting || hasStartError)
    
    const helperText = sessionError
        ? sessionError
        : isStarting
            ? 'Connecting to Pharmacist Ava...'
            : enabled && isConfigured
                ? 'Choose a mode to begin your session.'
                : 'Convai must be configured before training can begin.'

    const tryStartLearning = useCallback(() => {
        if (!canStart || sessionPhase === 'starting') return
        startTraining('learning')
    }, [canStart, startTraining, sessionPhase])

    const tryStartAssessment = useCallback(() => {
        if (!canStart || sessionPhase === 'starting') return
        startTraining('assessment')
    }, [canStart, startTraining, sessionPhase])

    const toggleAssessmentSpeech = useCallback(() => {
        if (sessionPhase === 'starting') return
        setAssessmentRequireSpeech(!assessmentRequireSpeech)
    }, [assessmentRequireSpeech, sessionPhase, setAssessmentRequireSpeech])

    const hoverHandlers = useMemo(() => ({
        learning: tryStartLearning,
        assessment: tryStartAssessment,
        voice: toggleAssessmentSpeech,
    }), [toggleAssessmentSpeech, tryStartAssessment, tryStartLearning])

    useHoverSelectAction(isRendered, hoverRef, hoverHandlers)

    useFrame((_state, delta) => {
        if (!isRendered || !root.current) {
            return
        }

        fadeRef.current = THREE.MathUtils.damp(fadeRef.current, isVisible ? 1 : 0, 11, delta)

        const opacity = fadeRef.current
        const scale = 0.92 + opacity * 0.08
        root.current.scale.setScalar(scale)
        floatTimeRef.current += delta
        
        if (xrMode === 'immersive-vr') {
            camera.getWorldPosition(lookTarget)
            camera.getWorldDirection(forward)
            tempUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize()

            hudTarget
                .copy(lookTarget)
                .add(forward.clone().multiplyScalar(HUD_DISTANCE))
                .add(tempUp.multiplyScalar(HUD_VERTICAL_OFFSET))

            if (root.current.parent) {
                root.current.parent.worldToLocal(hudTarget)
                root.current.position.lerp(hudTarget, Math.min(1, delta * HUD_FOLLOW_SPEED))
            } else {
                root.current.position.lerp(hudTarget, Math.min(1, delta * HUD_FOLLOW_SPEED))
            }

            faceCameraUpright(root.current, camera)
        } else {
            root.current.position.y = 0.04 + Math.sin(floatTimeRef.current * 1.6) * FLOAT_AMPLITUDE
            faceCameraUpright(root.current, camera)
        }

        const learningButton = root.current.getObjectByName('learning-button')
        const assessmentButton = root.current.getObjectByName('assessment-button')
        const voiceButton = root.current.getObjectByName('voice-button')

        if (learningButton && assessmentButton && voiceButton) {
            // In XR mode, raycast from the controller; on desktop, use camera gaze
            if (xrMode === 'immersive-vr' && activePointerSource?.object) {
                activePointerSource.object.updateWorldMatrix(true, false)
                activePointerSource.object.getWorldPosition(controllerRayPos)
                controllerDir.set(0, 0, -1).applyQuaternion(activePointerSource.object.quaternion)
                raycaster.set(controllerRayPos, controllerDir)
            } else {
                camera.getWorldDirection(forward)
                raycaster.set(camera.position, forward)
            }

            let nextHover = null
            if (raycaster.intersectObject(learningButton, true).length > 0) {
                nextHover = 'learning'
            } else if (raycaster.intersectObject(assessmentButton, true).length > 0) {
                nextHover = 'assessment'
            } else if (raycaster.intersectObject(voiceButton, true).length > 0) {
                nextHover = 'voice'
            }

            hoverRef.current = nextHover
            if (nextHover !== hoveredButton) {
                setHoveredButton(nextHover)
            }
        } else if (hoveredButton) {
            hoverRef.current = null
            setHoveredButton(null)
        }

        if (glassMaterial.current) {
            glassMaterial.current.opacity = 0.72 * opacity
        }

        if (borderMaterial.current) {
            borderMaterial.current.opacity = 0.78 * opacity
        }

        if (chipMaterial.current) {
            chipMaterial.current.opacity = 0.82 * opacity
        }

        if (shadowMaterial.current) {
            shadowMaterial.current.opacity = 0.22 * opacity
        }

        if (!isVisible && opacity < 0.025) {
            hoverRef.current = null
            if (hoveredButton) {
                setHoveredButton(null)
            }
            setIsMounted(false)
        }
    })

    if (!isRendered) {
        return null
    }

    return (
        <group {...props}>
            <group ref={root}>
                <RoundedBox args={[PANEL_WIDTH + 0.18, PANEL_HEIGHT + 0.18, 0.02]} radius={0.085} smoothness={6} position={[0, 0.02, -0.04]}>
                    <meshStandardMaterial ref={shadowMaterial} color="#02060a" transparent opacity={0.28} />
                </RoundedBox>

                <RoundedBox args={[PANEL_WIDTH + 0.06, PANEL_HEIGHT + 0.06, PANEL_DEPTH]} radius={0.065} smoothness={6} position={[0, 0.02, -0.02]}>
                    <meshStandardMaterial ref={borderMaterial} color="#46788c" transparent opacity={0.78} />
                </RoundedBox>

                <RoundedBox args={[PANEL_WIDTH, PANEL_HEIGHT, PANEL_DEPTH]} radius={0.06} smoothness={6} position={[0, 0.02, 0]}>
                    <meshStandardMaterial
                        ref={glassMaterial}
                        color="#0b1620"
                        transparent
                        opacity={0.72}
                        roughness={0.86}
                        metalness={0.03}
                    />
                </RoundedBox>

                <BrandChip3D position={[-0.18, 0.28, 0.03]} width={0.56} materialRef={chipMaterial} />

                <Text
                    position={[0, 0.12, 0.05]}
                    fontSize={0.088}
                    maxWidth={0.82}
                    lineHeight={0.96}
                    textAlign="center"
                    anchorX="center"
                    anchorY="middle"
                    color="#f8fafc"
                >
                    Guided Inhaler Training
                </Text>

                <Text
                    position={[0, -0.095, 0.05]}
                    fontSize={0.047}
                    maxWidth={0.74}
                    lineHeight={1.18}
                    textAlign="center"
                    anchorX="center"
                    anchorY="middle"
                    color="#c8d6e3"
                >
                    Meet Pharmacist Ava. Start a guided inhaler session and ask questions anytime.
                </Text>

                <Text
                    position={[0, -0.25, 0.05]}
                    fontSize={0.04}
                    maxWidth={0.8}
                    lineHeight={1.15}
                    textAlign="center"
                    anchorX="center"
                    anchorY="middle"
                    color={sessionError ? '#fca5a5' : '#c8d6e3'}
                >
                    {helperText}
                </Text>

                <group position={[0.3, -0.58, 0.04]}>
                    <RoundedBox name="voice-button" args={[TOGGLE_WIDTH, TOGGLE_HEIGHT, 0.04]} radius={0.03} smoothness={5} onClick={toggleAssessmentSpeech}>
                        <meshStandardMaterial
                            color={assessmentRequireSpeech ? (hoveredButton === 'voice' ? '#7c3aed' : '#6d28d9') : (hoveredButton === 'voice' ? '#436675' : '#34515d')}
                            transparent
                            opacity={0.94}
                            emissive={hoveredButton === 'voice' ? '#10232b' : '#000000'}
                            emissiveIntensity={hoveredButton === 'voice' ? 0.4 : 0}
                        />
                    </RoundedBox>
                    <Text
                        position={[0, 0.012, 0.04]}
                        fontSize={0.026}
                        maxWidth={TOGGLE_WIDTH * 0.9}
                        anchorX="center"
                        anchorY="middle"
                        textAlign="center"
                        color="#f8fafc"
                    >
                        {assessmentRequireSpeech ? 'Voice Check: On' : 'Voice Check: Off'}
                    </Text>
                </group>

                <group position={[-0.3, -0.58, 0.04]}>
                    <RoundedBox name="learning-button" args={[BUTTON_WIDTH, BUTTON_HEIGHT, 0.05]} radius={0.04} smoothness={5} onClick={tryStartLearning}>
                        <meshStandardMaterial 
                            color={canStart ? (hoveredButton === 'learning' ? '#34d399' : '#22c55e') : '#5f6b7a'} 
                            transparent 
                            opacity={0.96} 
                            emissive={hoveredButton === 'learning' ? '#123524' : '#000000'}
                            emissiveIntensity={hoveredButton === 'learning' ? 0.55 : 0}
                        />
                    </RoundedBox>
                    <Text
                        position={[0, 0, 0.04]}
                        fontSize={0.042}
                        maxWidth={BUTTON_WIDTH * 0.9}
                        anchorX="center"
                        anchorY="middle"
                        textAlign="center"
                        color={canStart ? '#04130a' : '#d7dee7'}
                    >
                        {isStarting && !hasStartError ? 'Connecting...' : 'Learning Mode'}
                    </Text>
                </group>

                <group position={[0.3, -0.48, 0.04]}>
                    <RoundedBox name="assessment-button" args={[BUTTON_WIDTH, BUTTON_HEIGHT, 0.05]} radius={0.04} smoothness={5} onClick={tryStartAssessment}>
                        <meshStandardMaterial 
                            color={canStart ? (hoveredButton === 'assessment' ? '#5c97af' : '#46788c') : '#5f6b7a'} 
                            transparent 
                            opacity={0.96} 
                            emissive={hoveredButton === 'assessment' ? '#0f2a35' : '#000000'}
                            emissiveIntensity={hoveredButton === 'assessment' ? 0.55 : 0}
                        />
                    </RoundedBox>
                    <Text
                        position={[0, 0, 0.04]}
                        fontSize={0.042}
                        anchorX="center"
                        anchorY="middle"
                        textAlign="center"
                        color={canStart ? '#f8fafc' : '#d7dee7'}
                    >
                        Assessment Mode
                    </Text>
                </group>
            </group>
        </group>
    )
}
