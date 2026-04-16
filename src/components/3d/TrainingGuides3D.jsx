import { Line, RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getStepById, useTrainingStore } from '../../store/useTrainingStore'
import { isSessionRunning } from '../../training/engine'

const MOUTH_GUIDE_STEPS = new Set(['mouthSeal', 'inhalePress'])
const PANEL_POSITION = [-1.52, 1.58, -0.18]
const PANEL_OFFSET = new THREE.Vector3(0, 0.22, 0)

export function TrainingGuides3D() {
    const haloRef = useRef()
    const outerHaloRef = useRef()
    const panelRef = useRef()
    const camera = useThree((state) => state.camera)
    const xrMode = useXR((state) => state.mode)
    const {
        currentStepId,
        isInhalerFocused,
        lastInputFrame,
        liveHint,
        sessionPhase,
        stepProgress,
        trainingMode,
    } = useTrainingStore()

    const currentStep = getStepById(currentStepId)
    const isRunning = isSessionRunning(sessionPhase)
    const isXR = xrMode === 'immersive-vr'

    const showMouthGuide =
        trainingMode !== 'assessment' &&
        isRunning &&
        isInhalerFocused &&
        currentStep &&
        MOUTH_GUIDE_STEPS.has(currentStep.validatorType) &&
        Array.isArray(lastInputFrame?.mouthTargetPosition) &&
        Array.isArray(lastInputFrame?.inhalerPosition)

    // In XR, show the hint panel for ALL step types (not just mouth steps)
    const showHintPanel =
        trainingMode !== 'assessment' &&
        isRunning &&
        currentStep &&
        (showMouthGuide || (isXR && isInhalerFocused))

    const mouthTarget = useMemo(() => new THREE.Vector3(), [])
    const inhalerPosition = useMemo(() => new THREE.Vector3(), [])
    const panelPosition = useMemo(() => new THREE.Vector3(...PANEL_POSITION), [])
    const lookTarget = useMemo(() => new THREE.Vector3(), [])

    if (Array.isArray(lastInputFrame?.mouthTargetPosition)) {
        mouthTarget.fromArray(lastInputFrame.mouthTargetPosition)
    }

    if (Array.isArray(lastInputFrame?.inhalerPosition)) {
        inhalerPosition.fromArray(lastInputFrame.inhalerPosition)
    }

    useFrame((_state, delta) => {
        if (!showMouthGuide && !showHintPanel) {
            return
        }

        if (haloRef.current && outerHaloRef.current) {
            const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.08
            haloRef.current.scale.setScalar(0.9 + stepProgress * 0.22)
            outerHaloRef.current.scale.setScalar(pulse + stepProgress * 0.16)
            haloRef.current.rotation.z += delta * 0.35
            outerHaloRef.current.rotation.z -= delta * 0.25
        }

        if (panelRef.current) {
            lookTarget.copy(camera.position)
            panelRef.current.lookAt(lookTarget)
        }
    })

    if (!showMouthGuide && !showHintPanel) {
        return null
    }

    const panelTitle = showMouthGuide ? 'Mouth target' : currentStep?.shortLabel ?? 'Current step'
    const panelSubtitle = showMouthGuide
        ? 'Step back if needed. The ring marks where the mouthpiece should land.'
        : isXR
            ? 'Follow the XR Controls panel for controller actions.'
            : ''

    return (
        <group>
            {/* Mouth-target ring — only for mouthSeal / inhalePress */}
            {showMouthGuide && (
                <>
                    <group position={mouthTarget.toArray()}>
                        <mesh ref={outerHaloRef} rotation={[Math.PI / 2, 0, 0]}>
                            <torusGeometry args={[0.065, 0.006, 18, 48]} />
                            <meshBasicMaterial color="#7dd3fc" transparent opacity={0.3} depthWrite={false} />
                        </mesh>
                        <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]}>
                            <torusGeometry args={[0.045, 0.005, 18, 48]} />
                            <meshBasicMaterial color="#22c55e" transparent opacity={0.62} depthWrite={false} />
                        </mesh>
                    </group>

                    <Line
                        points={[inhalerPosition.toArray(), mouthTarget.toArray()]}
                        color="#67cdec"
                        lineWidth={1.5}
                        transparent
                        opacity={0.45}
                    />
                </>
            )}

            {/* Floating hint panel — always visible when hint panel should show */}
            {showHintPanel && (
                <group ref={panelRef} position={panelPosition.clone().add(PANEL_OFFSET).toArray()}>
                    <RoundedBox args={[0.86, 0.32, 0.02]} radius={0.04} smoothness={5}>
                        <meshStandardMaterial color="#0f1c24" transparent opacity={0.9} />
                    </RoundedBox>
                    <RoundedBox args={[0.82, 0.28, 0.02]} radius={0.035} smoothness={5} position={[0, 0, 0.012]}>
                        <meshStandardMaterial color="#132a35" transparent opacity={0.94} />
                    </RoundedBox>
                    <Text
                        position={[0, 0.085, 0.03]}
                        fontSize={0.034}
                        maxWidth={0.7}
                        textAlign="center"
                        anchorX="center"
                        anchorY="middle"
                        color="#dff8ff"
                    >
                        {panelTitle}
                    </Text>
                    <Text
                        position={[0, -0.01, 0.03]}
                        fontSize={0.026}
                        maxWidth={0.72}
                        lineHeight={1.2}
                        textAlign="center"
                        anchorX="center"
                        anchorY="middle"
                        color="#f8fafc"
                    >
                        {liveHint}
                    </Text>
                    {panelSubtitle ? (
                        <Text
                            position={[0, -0.11, 0.03]}
                            fontSize={0.022}
                            maxWidth={0.66}
                            textAlign="center"
                            anchorX="center"
                            anchorY="middle"
                            color="#84afc0"
                        >
                            {panelSubtitle}
                        </Text>
                    ) : null}
                </group>
            )}
        </group>
    )
}

