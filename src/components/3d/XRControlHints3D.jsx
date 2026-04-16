import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getStepById, useTrainingStore } from '../../store/useTrainingStore'
import { isSessionRunning } from '../../training/engine'
import { useConvaiRuntime } from '../../convai/useConvaiRuntime'

const PANEL_WIDTH = 0.72
const PANEL_HEIGHT = 0.42
const FLOAT_AMPLITUDE = 0.006

function getXRHintForStep(step) {
    if (!step) {
        return { action: '', detail: '' }
    }

    switch (step.validatorType) {
        case 'shake':
            return {
                action: 'Shake the controller',
                detail: 'Move your hand side-to-side firmly to mix the medicine.',
            }
        case 'capState': {
            const removing = step.successWindow?.capOff === true
            return {
                action: removing ? 'Trigger = Remove cap' : 'Trigger = Replace cap',
                detail: removing
                    ? 'Pull the trigger to take the mouthpiece cover off.'
                    : 'Pull the trigger to put the cap back on.',
            }
        }
        case 'uprightHold':
            return {
                action: 'Hold controller upright',
                detail: 'Keep the controller vertical and steady for a moment.',
            }
        case 'headTilt':
            return {
                action: 'Tilt your head back',
                detail: 'Look up slightly — the headset tracks your head angle.',
            }
        case 'breathOut':
            return {
                action: 'Thumbstick ↓ or A = Exhale',
                detail: 'Push the thumbstick down or press A to simulate breathing out.',
            }
        case 'mouthSeal':
            return {
                action: 'Bring controller to your face',
                detail: 'Move the inhaler close to your mouth and keep it upright.',
            }
        case 'inhalePress':
            return {
                action: 'Thumbstick ↑ = Inhale, then Trigger',
                detail: 'Push thumbstick up to inhale, then pull the trigger to press the canister.',
            }
        case 'holdBreath':
            return {
                action: 'Press B = Hold breath',
                detail: 'Press and hold the B button to hold your breath steadily.',
            }
        case 'branchChoice':
            return {
                action: 'Point and select Yes or No',
                detail: 'Aim your controller at the panel and pull the trigger to choose.',
            }
        default:
            return {
                action: 'Follow the current instruction',
                detail: 'Ava will guide you through this step.',
            }
    }
}

export function XRControlHints3D(props) {
    const root = useRef()
    const glassMat = useRef()
    const borderMat = useRef()
    const floatTime = useRef(0)

    const camera = useThree((state) => state.camera)
    const lookTarget = useMemo(() => new THREE.Vector3(), [])

    const xrMode = useXR((state) => state.mode)
    const {
        currentStepId,
        liveHint,
        sessionPhase,
        stepProgress,
        trainingMode,
    } = useTrainingStore()

    const { state: convaiState, audioControls } = useConvaiRuntime()
    const isRecording = convaiState?.isConnected === true && audioControls?.isAudioMuted === false

    const currentStep = getStepById(currentStepId)
    const isRunning = isSessionRunning(sessionPhase)
    const isVisible = trainingMode !== 'assessment' && xrMode === 'immersive-vr' && isRunning && currentStep

    const hint = getXRHintForStep(currentStep)

    useFrame((_state, delta) => {
        if (!root.current || !isVisible) {
            return
        }

        floatTime.current += delta
        root.current.position.y = Math.sin(floatTime.current * 1.4) * FLOAT_AMPLITUDE

        lookTarget.copy(camera.position)
        root.current.lookAt(lookTarget)

        if (glassMat.current) {
            glassMat.current.opacity = 0.88
        }
        if (borderMat.current) {
            borderMat.current.opacity = 0.68
        }
    })

    if (!isVisible) {
        return null
    }

    return (
        <group {...props}>
            <group ref={root}>
                {/* Border */}
                <RoundedBox
                    args={[PANEL_WIDTH + 0.04, PANEL_HEIGHT + 0.04, 0.02]}
                    radius={0.045}
                    smoothness={5}
                    position={[0, 0, -0.01]}
                >
                    <meshStandardMaterial ref={borderMat} color="#3b6a80" transparent opacity={0.68} />
                </RoundedBox>

                {/* Glass body */}
                <RoundedBox args={[PANEL_WIDTH, PANEL_HEIGHT, 0.02]} radius={0.04} smoothness={5}>
                    <meshStandardMaterial
                        ref={glassMat}
                        color="#0a151e"
                        transparent
                        opacity={0.88}
                        roughness={0.88}
                        metalness={0.02}
                    />
                </RoundedBox>

                {/* "XR Controls" label */}
                <Text
                    position={[0, 0.155, 0.02]}
                    fontSize={0.028}
                    maxWidth={0.62}
                    textAlign="center"
                    anchorX="center"
                    anchorY="middle"
                    color="#7ec8e3"
                    letterSpacing={0.08}
                >
                    {'XR CONTROLS'}
                </Text>

                {/* Primary action hint */}
                <Text
                    position={[0, 0.09, 0.02]}
                    fontSize={0.038}
                    maxWidth={0.62}
                    textAlign="center"
                    anchorX="center"
                    anchorY="middle"
                    color="#f0f9ff"
                    fontWeight="bold"
                >
                    {hint.action}
                </Text>

                {/* Detail text */}
                <Text
                    position={[0, 0.015, 0.02]}
                    fontSize={0.024}
                    maxWidth={0.62}
                    lineHeight={1.25}
                    textAlign="center"
                    anchorX="center"
                    anchorY="middle"
                    color="#b4d5e5"
                >
                    {hint.detail}
                </Text>

                {/* Live hint from engine */}
                {liveHint && (
                    <Text
                        position={[0, -0.06, 0.02]}
                        fontSize={0.022}
                        maxWidth={0.62}
                        lineHeight={1.2}
                        textAlign="center"
                        anchorX="center"
                        anchorY="middle"
                        color="#94b8c8"
                        fontStyle="italic"
                    >
                        {liveHint}
                    </Text>
                )}

                {/* Progress bar background */}
                <mesh position={[0, -0.135, 0.02]}>
                    <planeGeometry args={[0.56, 0.028]} />
                    <meshBasicMaterial color="#1a2e3b" transparent opacity={0.7} />
                </mesh>

                {/* Progress bar fill */}
                <mesh position={[-0.28 + (0.56 * Math.max(0, Math.min(1, stepProgress ?? 0))) / 2, -0.135, 0.025]}>
                    <planeGeometry args={[0.56 * Math.max(0.001, Math.min(1, stepProgress ?? 0)), 0.028]} />
                    <meshBasicMaterial color="#22c55e" transparent opacity={0.85} />
                </mesh>

                {/* Step label */}
                <Text
                    position={[0, -0.175, 0.02]}
                    fontSize={0.019}
                    maxWidth={0.62}
                    textAlign="center"
                    anchorX="center"
                    anchorY="middle"
                    color="#6a97a8"
                >
                    {currentStep?.shortLabel ?? ''}
                </Text>

                {/* Recording Indicator */}
                {isRecording && (
                    <Text
                        position={[0, PANEL_HEIGHT / 2 + 0.05, 0.02]}
                        fontSize={0.03}
                        color="#ef4444"
                        fontWeight="bold"
                        textAlign="center"
                        anchorX="center"
                        anchorY="middle"
                    >
                        ● Recording...
                    </Text>
                )}
                {/* Locomotion Hint */}
                <Text
                    position={[0, -PANEL_HEIGHT / 2 + 0.03, 0.02]}
                    fontSize={0.018}
                    color="#4b7c91"
                    textAlign="center"
                    anchorX="center"
                    anchorY="middle"
                >
                    Left Thumbstick = Move  |  Right Thumbstick (L/R) = Turn
                </Text>
            </group>
        </group>
    )
}
