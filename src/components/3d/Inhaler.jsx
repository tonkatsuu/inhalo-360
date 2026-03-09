import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useXR, useXRControllerButtonEvent, useXRInputSourceState } from '@react-three/xr'
import * as THREE from 'three'
import { getStepById, useTrainingStore } from '../../store/useTrainingStore'
import { isFromOverlayElement } from '../../utils/dom'

const MOVE_SPEED = 12
const ROTATE_SPEED = 12
const FOCUS_DISTANCE = 0.8
const STABILITY_SPEED_MAX = 1.1
const MOUTH_OFFSET = new THREE.Vector3(0, -0.06, -0.12)
const DESKTOP_INSPECT_OFFSET = new THREE.Vector3(0.2, -0.16, -0.62)
const DESKTOP_MOUTH_OFFSET = new THREE.Vector3(0.05, -0.08, -0.26)

function getUprightScore(quaternion, axesCache) {
    axesCache.x.set(1, 0, 0).applyQuaternion(quaternion)
    axesCache.y.set(0, 1, 0).applyQuaternion(quaternion)
    axesCache.z.set(0, 0, 1).applyQuaternion(quaternion)

    return Math.max(
        Math.abs(axesCache.x.dot(axesCache.worldUp)),
        Math.abs(axesCache.y.dot(axesCache.worldUp)),
        Math.abs(axesCache.z.dot(axesCache.worldUp)),
    )
}

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
    const desktopInputs = useRef({
        inhaleActive: false,
        breathOutActive: false,
        holdBreathActive: false,
        mouthPoseActive: false,
    })
    const desktopMotionRef = useRef({
        shakeSpeed: 0,
    })
    const actionLockRef = useRef(false)

    const camera = useThree((state) => state.camera)
    const raycaster = useMemo(() => new THREE.Raycaster(), [])
    const forward = useMemo(() => new THREE.Vector3(), [])
    const focusTarget = useMemo(() => new THREE.Vector3(), [])
    const focusScaleTarget = useMemo(() => new THREE.Vector3(), [])
    const mouthTarget = useMemo(() => new THREE.Vector3(), [])
    const camForward = useMemo(() => new THREE.Vector3(), [])
    const camUp = useMemo(() => new THREE.Vector3(), [])
    const camRight = useMemo(() => new THREE.Vector3(), [])
    const controllerPos = useMemo(() => new THREE.Vector3(), [])
    const controllerQuat = useMemo(() => new THREE.Quaternion(), [])
    const holdOffset = useMemo(() => new THREE.Vector3(0.018, -0.045, -0.035), [])
    const holdQuatOffset = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, Math.PI / 2)), [])
    const highlightColor = useMemo(() => new THREE.Color('#ffd46b'), [])
    const axesCache = useMemo(
        () => ({
            x: new THREE.Vector3(),
            y: new THREE.Vector3(),
            z: new THREE.Vector3(),
            worldUp: new THREE.Vector3(0, 1, 0),
        }),
        [],
    )

    const xrMode = useXR((state) => state.mode)
    const rightController = useXRInputSourceState('controller', 'right')
    const leftController = useXRInputSourceState('controller', 'left')
    const activeController = rightController ?? leftController

    const {
        currentStepId,
        isCapOff,
        isInhalerFocused,
        focusDistanceOffset,
        sessionPhase,
        dispatchTrainingAction,
        recordMistake,
        setCapOff,
        setInhalerFocused,
        setLastUserAction,
        syncTrainingInput,
    } = useTrainingStore()

    const currentStep = getStepById(currentStepId)
    const isXRInput = xrMode === 'immersive-vr' && activeController?.object

    const recordBeforeStartMistake = useCallback(() => {
        recordMistake({
            stepId: currentStepId,
            code: 'attempt_action_before_start',
            message: 'The inhaler was used before the training session was started.',
            correction: 'Press Start Training first, then wait for the pharmacist to guide the session.',
        })
    }, [currentStepId, recordMistake])

    const attemptPrimaryAction = useCallback(() => {
        if (!currentStep) {
            return
        }

        setLastUserAction('primary-action')

        if (currentStep.validatorType === 'capState') {
            const shouldRemove = currentStep.successWindow?.capOff === true
            const nextAction = shouldRemove ? 'remove-cap' : 'replace-cap'
            setCapOff(shouldRemove)
            dispatchTrainingAction({ type: nextAction })
            return
        }

        dispatchTrainingAction({ type: 'press-canister' })
    }, [currentStep, dispatchTrainingAction, setCapOff, setLastUserAction])

    useXRControllerButtonEvent(activeController, 'xr-standard-trigger', (state) => {
        if (state !== 'pressed') {
            actionLockRef.current = false
            return
        }

        if (actionLockRef.current) {
            return
        }

        actionLockRef.current = true
        if (!isInhalerFocused) {
            setInhalerFocused(true)
            return
        }

        attemptPrimaryAction()
    })

    useEffect(() => {
        if (!group.current) return
        original.current.pos.copy(group.current.position)
        original.current.quat.copy(group.current.quaternion)
        original.current.scale.copy(group.current.scale)
        lastPos.current.copy(group.current.position)
    }, [])

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
            if (sessionPhase === 'idle' || sessionPhase === 'starting' || sessionPhase === 'completed') return
            event.preventDefault()
            setInhalerFocused(false)
        }

        const handleGlobalPointerDown = (event) => {
            if (isFromOverlayElement(event.target)) return
            if (event.button === 0 && !isInhalerFocused && isHovering) {
                if (sessionPhase === 'idle' || sessionPhase === 'starting' || sessionPhase === 'completed') {
                    recordBeforeStartMistake()
                    return
                }
                event.preventDefault()
                setInhalerFocused(true)
                return
            }

            if (event.button === 2) {
                if (isInhalerFocused) {
                    event.preventDefault()
                    setInhalerFocused(false)
                }
                return
            }

            if (event.button === 0 && isInhalerFocused) {
                if (sessionPhase === 'idle' || sessionPhase === 'starting' || sessionPhase === 'completed') {
                    recordBeforeStartMistake()
                    return
                }

                attemptPrimaryAction()
            }
        }

        window.addEventListener('contextmenu', handleGlobalDrop)
        window.addEventListener('pointerdown', handleGlobalPointerDown)
        return () => {
            window.removeEventListener('contextmenu', handleGlobalDrop)
            window.removeEventListener('pointerdown', handleGlobalPointerDown)
        }
    }, [attemptPrimaryAction, isHovering, isInhalerFocused, recordBeforeStartMistake, sessionPhase, setInhalerFocused])

    useEffect(() => {
        const handleKeyChange = (event, value) => {
            if (isFromOverlayElement(event.target)) return

            if (event.code === 'KeyI') {
                desktopInputs.current.inhaleActive = value
            }
            if (event.code === 'KeyE') {
                desktopInputs.current.breathOutActive = value
            }
            if (event.code === 'Space' || event.code === 'KeyH') {
                desktopInputs.current.holdBreathActive = value
            }
            if (event.code === 'KeyM') {
                desktopInputs.current.mouthPoseActive = value
            }

            if (!value) {
                return
            }

            if (event.code === 'KeyY') {
                dispatchTrainingAction({ type: 'branch-choice', choice: true })
            }
            if (event.code === 'KeyN') {
                dispatchTrainingAction({ type: 'branch-choice', choice: false })
            }
        }

        const handleKeyDown = (event) => handleKeyChange(event, true)
        const handleKeyUp = (event) => handleKeyChange(event, false)

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [dispatchTrainingAction])

    useEffect(() => {
        const handleMouseMove = (event) => {
            if (!isInhalerFocused) {
                return
            }

            const pointerMotion = Math.hypot(event.movementX, event.movementY)
            if (pointerMotion <= 0) {
                return
            }

            desktopMotionRef.current.shakeSpeed = Math.max(
                desktopMotionRef.current.shakeSpeed,
                pointerMotion * 0.055,
            )
        }

        window.addEventListener('mousemove', handleMouseMove)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
        }
    }, [isInhalerFocused])

    useEffect(() => {
        const shouldHighlight = isHovering || isInhalerFocused || ['capState', 'shake', 'inhalePress', 'mouthSeal'].includes(currentStep?.validatorType)
        materialState.current.forEach((originalState, material) => {
            if (!material) return
            if (shouldHighlight) {
                if (material.emissive) {
                    material.emissive.copy(highlightColor)
                }
                material.emissiveIntensity = isInhalerFocused ? 0.95 : 0.55
            } else {
                if (material.emissive && originalState.emissive) {
                    material.emissive.copy(originalState.emissive)
                }
                material.emissiveIntensity = originalState.emissiveIntensity
            }
        })
    }, [currentStep?.validatorType, highlightColor, isHovering, isInhalerFocused])

    useFrame((_state, delta) => {
        if (!group.current) return

        const alphaMove = 1 - Math.exp(-MOVE_SPEED * delta)
        const alphaRotate = 1 - Math.exp(-ROTATE_SPEED * delta)
        const usingXRController = Boolean(isXRInput && isInhalerFocused)

        camera.getWorldDirection(camForward)
        camera.getWorldDirection(forward)
        camUp.set(0, 1, 0).applyQuaternion(camera.quaternion)
        camRight.crossVectors(camForward, camUp).normalize()
        mouthTarget
            .copy(camera.position)
            .add(camForward.clone().multiplyScalar(-MOUTH_OFFSET.z))
            .add(camUp.clone().multiplyScalar(MOUTH_OFFSET.y))
            .add(camRight.clone().multiplyScalar(0.02))

        if (isInhalerFocused) {
            if (usingXRController) {
                activeController.object.updateWorldMatrix(true, false)
                activeController.object.getWorldPosition(controllerPos)
                activeController.object.getWorldQuaternion(controllerQuat)
                focusTarget.copy(holdOffset).applyQuaternion(controllerQuat).add(controllerPos)
                group.current.position.lerp(focusTarget, alphaMove)
                group.current.quaternion.slerp(controllerQuat.clone().multiply(holdQuatOffset), alphaRotate)
                focusScaleTarget.copy(original.current.scale)
            } else {
                const mouthPoseActive =
                    ['mouthSeal', 'inhalePress'].includes(currentStep?.validatorType) &&
                    (desktopInputs.current.mouthPoseActive || desktopInputs.current.inhaleActive)
                if (mouthPoseActive) {
                    focusTarget
                        .copy(camera.position)
                        .add(camForward.clone().multiplyScalar(-DESKTOP_MOUTH_OFFSET.z))
                        .add(camUp.clone().multiplyScalar(DESKTOP_MOUTH_OFFSET.y))
                        .add(camRight.clone().multiplyScalar(DESKTOP_MOUTH_OFFSET.x))
                } else {
                    const inspectDistance = Math.max(FOCUS_DISTANCE, focusDistanceOffset ?? FOCUS_DISTANCE)
                    focusTarget
                        .copy(camera.position)
                        .add(camForward.clone().multiplyScalar(Math.max(inspectDistance, -DESKTOP_INSPECT_OFFSET.z)))
                        .add(camUp.clone().multiplyScalar(DESKTOP_INSPECT_OFFSET.y))
                        .add(camRight.clone().multiplyScalar(DESKTOP_INSPECT_OFFSET.x))
                }

                group.current.position.lerp(focusTarget, alphaMove)
                group.current.quaternion.slerp(camera.quaternion, alphaRotate)
                focusScaleTarget.copy(original.current.scale).multiplyScalar(mouthPoseActive ? 0.76 : 0.84)
            }
            group.current.scale.lerp(focusScaleTarget, alphaMove)
        } else {
            group.current.position.lerp(original.current.pos, alphaMove)
            group.current.quaternion.slerp(original.current.quat, alphaRotate)
            group.current.scale.lerp(original.current.scale, alphaMove)
        }

        const movementDelta = group.current.position.distanceTo(lastPos.current)
        const speed = movementDelta / Math.max(delta, 0.0001)
        lastPos.current.copy(group.current.position)
        desktopMotionRef.current.shakeSpeed = Math.max(0, desktopMotionRef.current.shakeSpeed - delta * 2.8)

        const uprightScore = getUprightScore(group.current.quaternion, axesCache)
        const mouthDistance = group.current.position.distanceTo(mouthTarget)
        const thumbstickState = activeController?.gamepad?.['xr-standard-thumbstick']
        const aButtonState = activeController?.gamepad?.['a-button']
        const bButtonState = activeController?.gamepad?.['b-button']
        const inhaleActive = desktopInputs.current.inhaleActive || (thumbstickState?.yAxis ?? 0) < -0.25
        const breathOutActive =
            desktopInputs.current.breathOutActive ||
            (thumbstickState?.yAxis ?? 0) > 0.25 ||
            aButtonState?.state === 'pressed'
        const holdBreathActive = desktopInputs.current.holdBreathActive || bButtonState?.state === 'pressed'
        const stabilityScore = 1 - Math.min(1, speed / STABILITY_SPEED_MAX)
        const shakeSpeed = Math.max(speed, desktopMotionRef.current.shakeSpeed)

        syncTrainingInput({
            deltaMs: delta * 1000,
            inputMode: usingXRController ? 'xr' : 'desktop',
            isXR: usingXRController,
            shakeSpeed: isInhalerFocused ? shakeSpeed : 0,
            uprightScore: isInhalerFocused ? uprightScore : 0,
            headTilt: camera.rotation.x,
            mouthDistance: isInhalerFocused ? mouthDistance : 1,
            inhaleActive: isInhalerFocused ? inhaleActive : false,
            breathOutActive: isInhalerFocused ? breathOutActive : false,
            holdBreathActive: isInhalerFocused ? holdBreathActive : false,
            stabilityScore: isInhalerFocused ? stabilityScore : 0,
            inhalerPosition: group.current.position.toArray(),
            mouthTargetPosition: mouthTarget.toArray(),
            sessionPhase,
        })
    })

    useFrame(() => {
        if (!group.current) return
        if (isInhalerFocused) {
            if (isHovering) setIsHovering(false)
            return
        }
        if (xrMode === 'immersive-vr') {
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

    const handleClick = (event) => {
        if (isFromOverlayElement(event.target)) return
        if (sessionPhase === 'idle' || sessionPhase === 'starting' || sessionPhase === 'completed') {
            recordBeforeStartMistake()
            return
        }

        if (!isInhalerFocused) {
            setInhalerFocused(true)
            return
        }

        attemptPrimaryAction()
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
