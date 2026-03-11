import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useConvaiRuntime } from '../../convai/useConvaiRuntime'
import { useTrainingStore } from '../../store/useTrainingStore'
import { BrandChip3D } from './BrandChip3D'

const PANEL_WIDTH = 1.2
const PANEL_HEIGHT = 0.8
const PANEL_DEPTH = 0.04
const BUTTON_WIDTH = 0.82
const BUTTON_HEIGHT = 0.2
const FLOAT_AMPLITUDE = 0.015

function getButtonLabel(isStarting, hasStartError) {
    if (isStarting && !hasStartError) {
        return 'Connecting...'
    }

    if (hasStartError) {
        return 'Retry Start'
    }

    return 'Start Training'
}

export function TrainingStartPanel3D(props) {
    const root = useRef()
    const buttonRef = useRef()
    const glassMaterial = useRef()
    const borderMaterial = useRef()
    const chipMaterial = useRef()
    const buttonMaterial = useRef()
    const shadowMaterial = useRef()
    const hoverRef = useRef(false)
    const fadeRef = useRef(0)
    const floatTimeRef = useRef(0)
    const [isMounted, setIsMounted] = useState(true)
    const [isHoveringButton, setIsHoveringButton] = useState(false)

    const camera = useThree((state) => state.camera)
    const raycaster = useMemo(() => new THREE.Raycaster(), [])
    const forward = useMemo(() => new THREE.Vector3(), [])
    const lookTarget = useMemo(() => new THREE.Vector3(), [])
    const controllerDir = useMemo(() => new THREE.Vector3(), [])
    const controllerRayPos = useMemo(() => new THREE.Vector3(), [])

    const xrMode = useXR((state) => state.mode)
    const rightController = useXRInputSourceState('controller', 'right')
    const leftController = useXRInputSourceState('controller', 'left')
    const activeController = rightController ?? leftController

    const { enabled, isConfigured } = useConvaiRuntime()
    const { sessionPhase, sessionError, startTraining } = useTrainingStore()

    const isVisible = sessionPhase === 'idle' || sessionPhase === 'starting'
    const isRendered = isMounted || isVisible
    const isStarting = sessionPhase === 'starting'
    const hasStartError = Boolean(sessionError)
    const canStart = enabled && isConfigured && (!isStarting || hasStartError)
    const buttonLabel = getButtonLabel(isStarting, hasStartError)
    const helperText = sessionError
        ? sessionError
        : isStarting
            ? 'Connecting to Pharmacist Ava...'
            : enabled && isConfigured
                ? 'Look at Start Training and click to begin.'
                : 'Convai must be configured before training can begin.'

    const tryStartTraining = useCallback(() => {
        if (!canStart) return
        startTraining()
    }, [canStart, startTraining])

    useEffect(() => {
        if (!isRendered) {
            return undefined
        }

        const handlePointerDown = (event) => {
            if (event.button !== 0) return
            if (!hoverRef.current) return
            event.preventDefault()
            tryStartTraining()
        }

        window.addEventListener('pointerdown', handlePointerDown)
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown)
        }
    }, [isRendered, tryStartTraining])

    useFrame((_state, delta) => {
        if (!isRendered || !root.current) {
            return
        }

        fadeRef.current = THREE.MathUtils.damp(fadeRef.current, isVisible ? 1 : 0, 11, delta)

        const opacity = fadeRef.current
        const scale = 0.92 + opacity * 0.08
        root.current.scale.setScalar(scale)
        floatTimeRef.current += delta
        root.current.position.y = 0.04 + Math.sin(floatTimeRef.current * 1.6) * FLOAT_AMPLITUDE
        lookTarget.copy(camera.position)
        root.current.lookAt(lookTarget)

        if (buttonRef.current) {
            // In XR mode, raycast from the controller; on desktop, use camera gaze
            if (xrMode === 'immersive-vr' && activeController?.object) {
                activeController.object.updateWorldMatrix(true, false)
                activeController.object.getWorldPosition(controllerRayPos)
                controllerDir.set(0, 0, -1).applyQuaternion(activeController.object.quaternion)
                raycaster.set(controllerRayPos, controllerDir)
            } else {
                camera.getWorldDirection(forward)
                raycaster.set(camera.position, forward)
            }
            const hits = raycaster.intersectObject(buttonRef.current, true)
            const nextHover = hits.length > 0 && canStart
            hoverRef.current = nextHover
            if (nextHover !== isHoveringButton) {
                setIsHoveringButton(nextHover)
            }
        } else if (isHoveringButton) {
            hoverRef.current = false
            setIsHoveringButton(false)
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

        if (buttonMaterial.current) {
            const color = canStart ? (isHoveringButton ? '#34d399' : '#22c55e') : '#5f6b7a'
            buttonMaterial.current.color.set(color)
            buttonMaterial.current.opacity = 0.96 * opacity
            buttonMaterial.current.emissive.set(isHoveringButton ? '#123524' : '#000000')
            buttonMaterial.current.emissiveIntensity = isHoveringButton ? 0.55 : 0
        }

        if (!isVisible && opacity < 0.025) {
            hoverRef.current = false
            if (isHoveringButton) {
                setIsHoveringButton(false)
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
                    position={[0, -0.30, 0.05]}
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

                <group position={[0, -0.49, 0.04]}>
                    <RoundedBox ref={buttonRef} args={[BUTTON_WIDTH, BUTTON_HEIGHT, 0.05]} radius={0.05} smoothness={5} onClick={tryStartTraining}>
                        <meshStandardMaterial ref={buttonMaterial} color="#22c55e" transparent opacity={0.96} />
                    </RoundedBox>
                    <Text
                        position={[0, 0, 0.04]}
                        fontSize={0.064}
                        maxWidth={0.62}
                        anchorX="center"
                        anchorY="middle"
                        textAlign="center"
                        color={canStart ? '#04130a' : '#d7dee7'}
                    >
                        {buttonLabel}
                    </Text>
                </group>
            </group>
        </group>
    )
}
