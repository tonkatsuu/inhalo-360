import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useTrainingStore, TRAINING_STEPS } from '../../store/useTrainingStore'
import { isFromOverlayElement } from '../../utils/dom'

const MOVE_SPEED = 12
const ROTATE_SPEED = 12
const FOCUS_DISTANCE = 0.8
const SHAKE_SPEED_THRESHOLD = 1.2
const TILT_THRESHOLD = 0.15 // radians, positive = looking up

export function Inhaler(props) {
    const { nodes, materials } = useGLTF('/models/inhaler-transformed.glb')
    const group = useRef()
    const lastPos = useRef(new THREE.Vector3())
    const [isHovering, setIsHovering] = useState(false)
    const materialState = useRef(new Map())
    const original = useRef({
        pos: new THREE.Vector3(),
        quat: new THREE.Quaternion(),
        scale: new THREE.Vector3(),
    })

    const camera = useThree((state) => state.camera)
    const raycaster = useMemo(() => new THREE.Raycaster(), [])
    const forward = useMemo(() => new THREE.Vector3(), [])

    const {
        currentStep,
        isCapOff,
        isInhalerFocused,
        isShaking,
        shakeDuration,
        shakeElapsed,
        sessionPhase,
        setCapOff,
        setInhalerFocused,
        setIsShaking,
        setShakeElapsed,
        setLastUserAction,
        completeShake,
        advanceStep,
        completeStep,
        recordMistake,
    } = useTrainingStore()

    useEffect(() => {
        if (!group.current) return
        original.current.pos.copy(group.current.position)
        original.current.quat.copy(group.current.quaternion)
        original.current.scale.copy(group.current.scale)
        lastPos.current.copy(group.current.position)
    }, [])

    const focusTarget = useMemo(() => new THREE.Vector3(), [])
    const camForward = useMemo(() => new THREE.Vector3(), [])
    const highlightColor = useMemo(() => new THREE.Color('#ffd46b'), [])

    const recordBeforeStartMistake = useCallback(() => {
        recordMistake({
            stepId: currentStep,
            code: 'attempt_action_before_start',
            message: 'The inhaler was used before the training session was started.',
            correction: 'Press Start Training first, then follow the guided checklist from the beginning.',
        })
    }, [currentStep, recordMistake])

    const recordWrongActionMistake = useCallback(() => {
        const step = TRAINING_STEPS[currentStep]
        if (!step) return
        recordMistake({
            stepId: currentStep,
            code: 'wrong_inhaler_action_for_step',
            message: `The inhaler action did not match the current step: "${step.text}".`,
            correction: `Return to the current step and complete it correctly: ${step.text}.`,
        })
    }, [currentStep, recordMistake])

    const handleFocusedActionAttempt = useCallback(() => {
        const step = TRAINING_STEPS[currentStep]
        if (!step) return

        setLastUserAction('inhaler-click')

        if (step.action === 'click') {
            advanceStep()
            return
        }

        if (step.action === 'removeCap' && !isCapOff) {
            setCapOff(true)
            return
        }

        if (step.action === 'replaceCap' && isCapOff) {
            setCapOff(false)
            return
        }

        recordWrongActionMistake()
    }, [advanceStep, currentStep, isCapOff, recordWrongActionMistake, setCapOff, setLastUserAction])

    useEffect(() => {
        if (!group.current) return
        materialState.current.clear()
        group.current.traverse((child) => {
            if (!child.isMesh) return
            const mats = Array.isArray(child.material) ? child.material : [child.material]
            mats.forEach((material) => {
                if (!material || !material.isMaterial) return
                if (!materialState.current.has(material)) {
                    materialState.current.set(material, {
                        emissive: material.emissive ? material.emissive.clone() : new THREE.Color('#000000'),
                        emissiveIntensity: material.emissiveIntensity ?? 0,
                    })
                }
            })
        })
    }, [nodes, materials])

    useEffect(() => {
        const handleGlobalDrop = (event) => {
            if (isFromOverlayElement(event.target)) return
            if (!isInhalerFocused) return
            if (sessionPhase !== 'active') return
            event.preventDefault()
            setInhalerFocused(false)
        }

        const handleGlobalPointerDown = (event) => {
            if (isFromOverlayElement(event.target)) return
            if (event.button === 0 && sessionPhase !== 'active' && isHovering) {
                recordBeforeStartMistake()
                return
            }
            if (event.button === 2) {
                if (isInhalerFocused) {
                    event.preventDefault()
                    setInhalerFocused(false)
                }
                return
            }
            if (event.button === 0) {
                if (!isInhalerFocused && isHovering) {
                    event.preventDefault()
                    setInhalerFocused(true)
                } else if (isInhalerFocused) {
                    handleFocusedActionAttempt()
                }
            }
        }

        window.addEventListener('contextmenu', handleGlobalDrop)
        window.addEventListener('pointerdown', handleGlobalPointerDown)
        return () => {
            window.removeEventListener('contextmenu', handleGlobalDrop)
            window.removeEventListener('pointerdown', handleGlobalPointerDown)
        }
    }, [
        advanceStep,
        currentStep,
        handleFocusedActionAttempt,
        isCapOff,
        isHovering,
        isInhalerFocused,
        recordBeforeStartMistake,
        sessionPhase,
        setCapOff,
        setInhalerFocused,
    ])

    useEffect(() => {
        const shouldHighlight = isHovering || isInhalerFocused
        materialState.current.forEach((originalState, material) => {
            if (!material) return
            if (shouldHighlight) {
                if (material.emissive) {
                    material.emissive.copy(highlightColor)
                }
                material.emissiveIntensity = 0.6
            } else {
                if (material.emissive && originalState.emissive) {
                    material.emissive.copy(originalState.emissive)
                }
                material.emissiveIntensity = originalState.emissiveIntensity
            }
        })
    }, [highlightColor, isHovering, isInhalerFocused])

    useFrame((_state, delta) => {
        if (!group.current) return

        const alphaMove = 1 - Math.exp(-MOVE_SPEED * delta)
        const alphaRotate = 1 - Math.exp(-ROTATE_SPEED * delta)

        if (isInhalerFocused) {
            camera.getWorldDirection(camForward)
            focusTarget.copy(camera.position).add(camForward.multiplyScalar(FOCUS_DISTANCE))

            group.current.position.lerp(focusTarget, alphaMove)
            group.current.quaternion.slerp(camera.quaternion, alphaRotate)

            const movementDelta = group.current.position.distanceTo(lastPos.current)
            lastPos.current.copy(group.current.position)

            // Check if we're on a shake step (step 0 or step 9)
            const isShakeStep = currentStep === 0 || currentStep === 9
            if (isShakeStep) {
                const speed = movementDelta / Math.max(delta, 0.0001)
                if (speed > SHAKE_SPEED_THRESHOLD) {
                    if (!isShaking) setIsShaking(true)
                    const nextElapsed = shakeElapsed + delta
                    setShakeElapsed(nextElapsed)
                    if (nextElapsed >= shakeDuration) {
                        completeShake()
                    }
                } else if (isShaking) {
                    setIsShaking(false)
                }
            }

            // Check if we're on a tilt step (step 3)
            if (currentStep === 3 && camera.rotation.x > TILT_THRESHOLD) {
                completeStep(3)
            }
        } else {
            group.current.position.lerp(original.current.pos, alphaMove)
            group.current.quaternion.slerp(original.current.quat, alphaRotate)
            group.current.scale.lerp(original.current.scale, alphaMove)
            lastPos.current.copy(group.current.position)
        }
    })

    useFrame(() => {
        if (!group.current) return
        if (isInhalerFocused) {
            if (isHovering) setIsHovering(false)
            return
        }
        camera.getWorldDirection(forward)
        raycaster.set(camera.position, forward)
        const hits = raycaster.intersectObject(group.current, true)
        setIsHovering(hits.length > 0)
    })

    const handleReturn = (event) => {
        event.stopPropagation()
        if (isInhalerFocused) setInhalerFocused(false)
    }

    // Handle click to advance through steps that require interaction
    const handleClick = (event) => {
        if (isFromOverlayElement(event.target)) return
        if (sessionPhase !== 'active') {
            recordBeforeStartMistake()
            return
        }
        // If not focused, focus first
        if (!isInhalerFocused) {
            setInhalerFocused(true)
            return
        }

        handleFocusedActionAttempt()
    }

    return (
        <group
            ref={group}
            {...props}
            dispose={null}
            onClick={handleClick}
            onContextMenu={handleReturn}
        >
            <mesh geometry={nodes.mesh_0.geometry} material={materials.matalparts} rotation={[-1.864, 0, 0]} scale={0.91} />
            <mesh geometry={nodes.mesh_0_1.geometry} material={materials.tankinfo} rotation={[-1.864, 0, 0]} scale={0.91} />
            <mesh geometry={nodes.mesh_0_15.geometry} material={materials.lightblue} rotation={[-1.864, 0, 0]} scale={0.91} />
            <mesh
                geometry={nodes.mesh_0_55.geometry}
                material={materials.darkblue}
                rotation={[-1.864, 0, 0]}
                scale={0.91}
                visible={!isCapOff}
            />
        </group>
    )
}

useGLTF.preload('/models/inhaler-transformed.glb')
