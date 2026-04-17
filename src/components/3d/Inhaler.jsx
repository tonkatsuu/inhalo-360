import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useXR, useXRControllerButtonEvent, useXRInputSourceEvent } from '@react-three/xr'
import * as THREE from 'three'
import { getStepById, useTrainingStore } from '../../store/useTrainingStore'
import { isFromOverlayElement } from '../../utils/dom'
import { useXRHardwareState } from './useXRHardwareState'

const MOVE_SPEED = 12
const ROTATE_SPEED = 12
const FOCUS_DISTANCE = 0.8
const STABILITY_SPEED_MAX = 1.1
const MOUTH_OFFSET = new THREE.Vector3(0, -0.06, -0.12)
const DESKTOP_INSPECT_OFFSET = new THREE.Vector3(0.2, -0.16, -0.62)
const DESKTOP_MOUTH_OFFSET = new THREE.Vector3(0.05, -0.08, -0.26)
const INHALER_MESH_ROTATION = new THREE.Euler(-1.864, 0, 0)
const INHALER_MESH_SCALE = 0.91

function createEmptyHoverState() {
    return {
        controller: { left: false, right: false },
        hand: { left: false, right: false },
        desktop: false,
    }
}

function applyHoverEventToState(nextState, event, hovered) {
    const handedness = event.pointerState?.inputSource?.handedness ?? 'right'

    switch (event.pointerType) {
        case 'ray':
            nextState.controller[handedness] = hovered
            break
        case 'grab':
        case 'touch':
            nextState.hand[handedness] = hovered
            break
        default:
            nextState.desktop = hovered
            break
    }
}

function hasAnyHover(hoverState) {
    return (
        hoverState.desktop ||
        hoverState.controller.left ||
        hoverState.controller.right ||
        hoverState.hand.left ||
        hoverState.hand.right
    )
}

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
    const capMeshRef = useRef()
    const lastPos = useRef(new THREE.Vector3())
    const [isHovering, setIsHovering] = useState(false)
    const [isCapHovered, setIsCapHovered] = useState(false)
    const hoverRef = useRef(false)
    const hoverBySourceRef = useRef({
        controller: { left: false, right: false },
        hand: { left: false, right: false },
        desktop: false,
    })
    const capHoverHandednessRef = useRef(null)
    const materialState = useRef(new Map())
    const isPointerDown = useRef(false)
    const hasAutoPressed = useRef(false)
    const original = useRef({
        pos: new THREE.Vector3(),
        quat: new THREE.Quaternion(),
        scale: new THREE.Vector3(),
        captured: false,
    })
    const desktopMotionRef = useRef({
        shakeSpeed: 0,
    })
    const triggerLockRef = useRef({
        left: false,
        right: false,
    })
    const focusSourceRef = useRef({
        type: null,
        handedness: null,
    })

    const camera = useThree((state) => state.camera)
    const raycaster = useMemo(() => new THREE.Raycaster(), [])
    const forward = useMemo(() => new THREE.Vector3(), [])
    const focusTarget = useMemo(() => new THREE.Vector3(), [])
    const focusScaleTarget = useMemo(() => new THREE.Vector3(), [])
    const lookTarget = useMemo(() => new THREE.Vector3(), [])
    const targetQuat = useMemo(() => new THREE.Quaternion(), [])
    const mouthTarget = useMemo(() => new THREE.Vector3(), [])
    const camForward = useMemo(() => new THREE.Vector3(), [])
    const camUp = useMemo(() => new THREE.Vector3(), [])
    const camRight = useMemo(() => new THREE.Vector3(), [])
    const cameraWorldPos = useMemo(() => new THREE.Vector3(), [])
    const cameraWorldQuat = useMemo(() => new THREE.Quaternion(), [])
    const headEuler = useMemo(() => new THREE.Euler(), [])
    const controllerDir = useMemo(() => new THREE.Vector3(), [])
    const controllerRayPos = useMemo(() => new THREE.Vector3(), [])
    const controllerRayQuat = useMemo(() => new THREE.Quaternion(), [])
    const controllerPos = useMemo(() => new THREE.Vector3(), [])
    const controllerQuat = useMemo(() => new THREE.Quaternion(), [])
    const mouthpieceWorld = useMemo(() => new THREE.Vector3(), [])
    const holdOffset = useMemo(() => new THREE.Vector3(0.018, -0.045, -0.035), [])
    const holdFacingQuatOffset = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)), [])
    const upVector = useMemo(() => new THREE.Vector3(0, 1, 0), [])
    const hoverHighlightColor = useMemo(() => new THREE.Color('#ffd46b'), [])
    const promptHighlightColor = useMemo(() => new THREE.Color('#7dd3fc'), [])
    const axesCache = useMemo(
        () => ({
            x: new THREE.Vector3(),
            y: new THREE.Vector3(),
            z: new THREE.Vector3(),
            worldUp: new THREE.Vector3(0, 1, 0),
        }),
        [],
    )
    const mouthpieceLocalOffset = useMemo(() => {
        const geometry = nodes.mesh_0_55.geometry
        if (!geometry.boundingBox) {
            geometry.computeBoundingBox()
        }

        const localOffset = new THREE.Vector3()
        geometry.boundingBox?.getCenter(localOffset)
        localOffset.applyEuler(INHALER_MESH_ROTATION)
        localOffset.multiplyScalar(INHALER_MESH_SCALE)
        return localOffset
    }, [nodes])

    const xrMode = useXR((state) => state.mode)
    const { activeController, activeHand, leftController, rightController, leftHand, rightHand } = useXRHardwareState()

    const {
        claimXRGrab,
        currentStepId,
        currentStepRuntime,
        isCapOff,
        isInhalerFocused,
        focusDistanceOffset,
        releaseXRGrab,
        sessionPhase,
        dispatchTrainingAction,
        recordMistake,
        setCapOff,
        setInhalerFocused,
        setLastUserAction,
        syncTrainingInput,
        setClipboardFocused,
    } = useTrainingStore()

    const currentStep = getStepById(currentStepId)
    const isTargeted = isHovering
    const isPromptedStep = !isInhalerFocused && ['capState', 'shake', 'inhalePress', 'mouthSeal'].includes(currentStep?.validatorType)

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

    const focusInhaler = useCallback((type, handedness = null) => {
        if ((type === 'controller' || type === 'hand') && !claimXRGrab('inhaler', { type, handedness })) {
            return false
        }
        focusSourceRef.current = { type, handedness }
        setInhalerFocused(true)
        return true
    }, [claimXRGrab, setInhalerFocused])

    const releaseInhaler = useCallback(() => {
        if (focusSourceRef.current.type === 'controller' || focusSourceRef.current.type === 'hand') {
            releaseXRGrab('inhaler', focusSourceRef.current)
        }
        focusSourceRef.current = { type: null, handedness: null }
        setInhalerFocused(false)
    }, [releaseXRGrab, setInhalerFocused])

    const handleControllerTrigger = useCallback((handedness, state) => {
        if (state !== 'pressed') {
            triggerLockRef.current[handedness] = false
            return
        }

        if (triggerLockRef.current[handedness]) {
            return
        }

        triggerLockRef.current[handedness] = true
        if (!isInhalerFocused) {
            if (hoverBySourceRef.current.controller[handedness]) {
                focusInhaler('controller', handedness)
            }
            return
        }

        if (
            focusSourceRef.current.type === 'controller' &&
            focusSourceRef.current.handedness === handedness
        ) {
            attemptPrimaryAction()
        }
    }, [attemptPrimaryAction, focusInhaler, isInhalerFocused])

    useXRControllerButtonEvent(rightController, 'xr-standard-trigger', (state) => {
        handleControllerTrigger('right', state)
    })

    useXRControllerButtonEvent(leftController, 'xr-standard-trigger', (state) => {
        handleControllerTrigger('left', state)
    })

    useXRControllerButtonEvent(rightController, 'xr-standard-squeeze', (state) => {
        if (
            state === 'pressed' &&
            isInhalerFocused &&
            focusSourceRef.current.type === 'controller' &&
            (focusSourceRef.current.handedness == null || focusSourceRef.current.handedness === 'right')
        ) {
            releaseInhaler()
        }
    })

    useXRControllerButtonEvent(leftController, 'xr-standard-squeeze', (state) => {
        if (
            state === 'pressed' &&
            isInhalerFocused &&
            focusSourceRef.current.type === 'controller' &&
            (focusSourceRef.current.handedness == null || focusSourceRef.current.handedness === 'left')
        ) {
            releaseInhaler()
        }
    })

    useXRInputSourceEvent('all', 'selectstart', (event) => {
        if (xrMode !== 'immersive-vr' || event.inputSource.hand == null) {
            return
        }

        if (
            isInhalerFocused &&
            currentStep?.validatorType === 'capState' &&
            capHoverHandednessRef.current === event.inputSource.handedness
        ) {
            attemptPrimaryAction()
            return
        }

        if (!isInhalerFocused && hoverBySourceRef.current.hand[event.inputSource.handedness ?? 'right']) {
            if (sessionPhase === 'idle' || sessionPhase === 'starting' || sessionPhase === 'completed') {
                recordBeforeStartMistake()
                return
            }

            focusInhaler('hand', event.inputSource.handedness)
            return
        }

        if (isInhalerFocused && ['capState', 'inhalePress'].includes(currentStep?.validatorType)) {
            attemptPrimaryAction()
        }
    }, [attemptPrimaryAction, currentStep?.validatorType, focusInhaler, isInhalerFocused, recordBeforeStartMistake, sessionPhase, setClipboardFocused, xrMode])

    useXRInputSourceEvent('all', 'squeezestart', (event) => {
        if (
            xrMode !== 'immersive-vr' ||
            event.inputSource.hand == null ||
            !isInhalerFocused ||
            focusSourceRef.current.type !== 'hand'
        ) {
            return
        }

        if (
            focusSourceRef.current.handedness != null &&
            focusSourceRef.current.handedness !== event.inputSource.handedness
        ) {
            return
        }

        releaseInhaler()
    }, [isInhalerFocused, releaseInhaler, xrMode])

    useEffect(() => {
        // Reset the captured flag when props change so the resting position
        // is re-snapshotted on the next frame (props.position may have changed).
        original.current.captured = false
    }, [props.position, props.rotation, props.scale])

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
        if (!isInhalerFocused) {
            focusSourceRef.current = { type: null, handedness: null }
            return
        }

        hoverBySourceRef.current = createEmptyHoverState()
        if (hoverRef.current) {
            hoverRef.current = false
            setIsHovering(false)
        }
    }, [isInhalerFocused])

    useEffect(() => {
        const handleGlobalDrop = (event) => {
            if (isFromOverlayElement(event.target)) return
            if (!isInhalerFocused) return
            if (sessionPhase === 'idle' || sessionPhase === 'starting' || sessionPhase === 'completed') return
            event.preventDefault()
            releaseInhaler()
        }

        const handleGlobalPointerDown = (event) => {
            if (isFromOverlayElement(event.target)) return
            if (xrMode === 'immersive-vr') return
            
            if (event.button === 0) {
                isPointerDown.current = true
            }

            if (event.button === 0 && !isInhalerFocused && isHovering) {
                if (sessionPhase === 'idle' || sessionPhase === 'starting' || sessionPhase === 'completed') {
                    recordBeforeStartMistake()
                    return
                }
                event.preventDefault()
                if (xrMode !== 'immersive-vr') {
                    setClipboardFocused(false)
                }
                focusInhaler('desktop')
                return
            }

            if (event.button === 2) {
                if (isInhalerFocused) {
                    event.preventDefault()
                    releaseInhaler()
                }
                return
            }

            if (event.button === 0 && isInhalerFocused) {
                if (sessionPhase === 'idle' || sessionPhase === 'starting' || sessionPhase === 'completed') {
                    recordBeforeStartMistake()
                    return
                }

                // Only trigger discrete actions on click. Breathing is state-driven in useFrame.
                if (currentStep?.validatorType === 'capState' || (currentStep?.validatorType === 'inhalePress' && xrMode === 'immersive-vr')) {
                    attemptPrimaryAction()
                }
            }
        }

        const handleGlobalPointerUp = (event) => {
            if (event.button === 0) {
                isPointerDown.current = false
                hasAutoPressed.current = false
            }
        }

        window.addEventListener('contextmenu', handleGlobalDrop)
        window.addEventListener('pointerdown', handleGlobalPointerDown)
        window.addEventListener('pointerup', handleGlobalPointerUp)
        return () => {
            window.removeEventListener('contextmenu', handleGlobalDrop)
            window.removeEventListener('pointerdown', handleGlobalPointerDown)
            window.removeEventListener('pointerup', handleGlobalPointerUp)
        }
    }, [attemptPrimaryAction, currentStep?.validatorType, focusInhaler, isHovering, isInhalerFocused, recordBeforeStartMistake, releaseInhaler, sessionPhase, setClipboardFocused, xrMode])

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
        materialState.current.forEach((originalState, material) => {
            if (!material) return
            if (isTargeted) {
                if (material.emissive) {
                    material.emissive.copy(hoverHighlightColor)
                }
                material.emissiveIntensity = 0.42
            } else if (isPromptedStep) {
                if (material.emissive) {
                    material.emissive.copy(promptHighlightColor)
                }
                material.emissiveIntensity = 0.12
            } else {
                if (material.emissive && originalState.emissive) {
                    material.emissive.copy(originalState.emissive)
                }
                material.emissiveIntensity = originalState.emissiveIntensity
            }
        })
    }, [hoverHighlightColor, isInhalerFocused, isPromptedStep, isTargeted, promptHighlightColor])

    useFrame((_state, delta) => {
        if (!group.current) return

        // Capture the true resting transform on the first frame after mount / prop change,
        // because useEffect([]) fires before R3F has propagated position/rotation/scale props.
        if (!original.current.captured) {
            original.current.pos.copy(group.current.position)
            original.current.quat.copy(group.current.quaternion)
            original.current.scale.copy(group.current.scale)
            lastPos.current.copy(group.current.position)
            original.current.captured = true
        }

        const alphaMove = 1 - Math.exp(-MOVE_SPEED * delta)
        const alphaRotate = 1 - Math.exp(-ROTATE_SPEED * delta)
        const focusedXRSource =
            focusSourceRef.current.type === 'controller'
                ? (
                    focusSourceRef.current.handedness === 'left'
                        ? leftController
                        : focusSourceRef.current.handedness === 'right'
                            ? rightController
                            : activeController
                )
                : focusSourceRef.current.type === 'hand'
                    ? (
                        focusSourceRef.current.handedness === 'left'
                            ? leftHand
                            : focusSourceRef.current.handedness === 'right'
                                ? rightHand
                                : activeHand
                    )
                    : undefined
        const usingXRInputSource = Boolean(isInhalerFocused && focusedXRSource?.object)
        const desktopPointerDown = isPointerDown.current && !usingXRInputSource && isInhalerFocused

        camera.getWorldPosition(cameraWorldPos)
        camera.getWorldQuaternion(cameraWorldQuat)
        camera.getWorldDirection(camForward)
        camera.getWorldDirection(forward)
        camUp.set(0, 1, 0).applyQuaternion(cameraWorldQuat)
        camRight.crossVectors(camForward, camUp).normalize()
        mouthTarget
            .copy(cameraWorldPos)
            .add(camForward.clone().multiplyScalar(-MOUTH_OFFSET.z))
            .add(camUp.clone().multiplyScalar(MOUTH_OFFSET.y))
            .add(camRight.clone().multiplyScalar(0.02))

        if (isInhalerFocused) {
            if (usingXRInputSource) {
                focusedXRSource.object.updateWorldMatrix(true, false)
                focusedXRSource.object.getWorldPosition(controllerPos)
                focusedXRSource.object.getWorldQuaternion(controllerQuat)
                focusTarget.copy(holdOffset).applyQuaternion(controllerQuat).add(controllerPos)
                group.current.position.lerp(focusTarget, alphaMove)
                lookTarget.copy(cameraWorldPos)
                lookTarget.y = group.current.position.y
                const lookAtMatrix = new THREE.Matrix4()
                lookAtMatrix.lookAt(group.current.position, lookTarget, upVector)
                targetQuat.setFromRotationMatrix(lookAtMatrix)
                targetQuat.multiply(holdFacingQuatOffset)
                group.current.quaternion.slerp(targetQuat, alphaRotate)
                focusScaleTarget.copy(original.current.scale)
            } else {
                const mouthPoseActive =
                    ['mouthSeal', 'inhalePress'].includes(currentStep?.validatorType) &&
                    desktopPointerDown
                if (mouthPoseActive) {
                    focusTarget
                        .copy(cameraWorldPos)
                        .add(camForward.clone().multiplyScalar(-DESKTOP_MOUTH_OFFSET.z))
                        .add(camUp.clone().multiplyScalar(DESKTOP_MOUTH_OFFSET.y))
                        .add(camRight.clone().multiplyScalar(DESKTOP_MOUTH_OFFSET.x))
                } else {
                    const inspectDistance = Math.max(FOCUS_DISTANCE, focusDistanceOffset ?? FOCUS_DISTANCE)
                    focusTarget
                        .copy(cameraWorldPos)
                        .add(camForward.clone().multiplyScalar(Math.max(inspectDistance, -DESKTOP_INSPECT_OFFSET.z)))
                        .add(camUp.clone().multiplyScalar(DESKTOP_INSPECT_OFFSET.y))
                        .add(camRight.clone().multiplyScalar(DESKTOP_INSPECT_OFFSET.x))
                }

                group.current.position.lerp(focusTarget, alphaMove)
                group.current.quaternion.slerp(cameraWorldQuat, alphaRotate)
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
        mouthpieceWorld.copy(mouthpieceLocalOffset)
        group.current.localToWorld(mouthpieceWorld)
        const mouthDistance = mouthpieceWorld.distanceTo(mouthTarget)
        const thumbstickState = activeController?.gamepad?.['xr-standard-thumbstick']
        const aButtonState = activeController?.gamepad?.['a-button']
        const bButtonState = activeController?.gamepad?.['b-button']

        // Context-aware desktop button mapping
        const inhaleActive = (desktopPointerDown && currentStep?.validatorType === 'inhalePress') || (thumbstickState?.yAxis ?? 0) < -0.25
        const breathOutActive =
            (desktopPointerDown && (currentStep?.validatorType === 'breathOut' || currentStep?.validatorType === 'branchChoice')) ||
            (thumbstickState?.yAxis ?? 0) > 0.25 ||
            aButtonState?.state === 'pressed'
        const holdBreathActive = (desktopPointerDown && currentStep?.validatorType === 'holdBreath') || bButtonState?.state === 'pressed'
        
        // Auto-press mechanism for desktop inhalation timing
        if (desktopPointerDown && currentStep?.validatorType === 'inhalePress' && !hasAutoPressed.current) {
            if ((currentStepRuntime?.inhaleLeadMs ?? 0) >= 500) {
                attemptPrimaryAction()
                hasAutoPressed.current = true
            }
        }

        const stabilityScore = 1 - Math.min(1, speed / STABILITY_SPEED_MAX)
        const shakeSpeed = Math.max(speed, desktopMotionRef.current.shakeSpeed)
        headEuler.setFromQuaternion(cameraWorldQuat, 'YXZ')

        syncTrainingInput({
            deltaMs: delta * 1000,
            inputMode: usingXRInputSource ? 'xr' : 'desktop',
            isXR: usingXRInputSource,
            shakeSpeed: isInhalerFocused ? shakeSpeed : 0,
            uprightScore: isInhalerFocused ? uprightScore : 0,
            headTilt: headEuler.x,
            mouthDistance: isInhalerFocused ? mouthDistance : 1,
            inhaleActive: isInhalerFocused ? inhaleActive : false,
            breathOutActive: isInhalerFocused ? breathOutActive : false,
            holdBreathActive: isInhalerFocused ? holdBreathActive : false,
            stabilityScore: isInhalerFocused ? stabilityScore : 0,
            inhalerPosition: mouthpieceWorld.toArray(),
            mouthTargetPosition: mouthTarget.toArray(),
            sessionPhase,
        })
    })

    useFrame(() => {
        if (!group.current) return

        if (
            xrMode === 'immersive-vr' &&
            isInhalerFocused &&
            currentStep?.validatorType === 'capState' &&
            capMeshRef.current &&
            !isCapOff
        ) {
            let nextCapHoverHandedness = null

            for (const handSource of [leftHand, rightHand]) {
                if (!handSource?.object) {
                    continue
                }

                handSource.object.updateWorldMatrix(true, false)
                handSource.object.getWorldPosition(controllerRayPos)
                handSource.object.getWorldQuaternion(controllerRayQuat)
                controllerDir.set(0, 0, -1).applyQuaternion(controllerRayQuat)
                raycaster.set(controllerRayPos, controllerDir)

                if (raycaster.intersectObject(capMeshRef.current, true).length > 0) {
                    nextCapHoverHandedness = handSource.inputSource.handedness
                    break
                }
            }

            capHoverHandednessRef.current = nextCapHoverHandedness
            const nextCapHovered = nextCapHoverHandedness != null
            if (nextCapHovered !== isCapHovered) {
                setIsCapHovered(nextCapHovered)
            }
        } else {
            capHoverHandednessRef.current = null
            if (isCapHovered) {
                setIsCapHovered(false)
            }
        }

    })

    const handlePointerEnter = useCallback((event) => {
        if (isInhalerFocused) {
            return
        }

        const nextHoverState = {
            controller: { ...hoverBySourceRef.current.controller },
            hand: { ...hoverBySourceRef.current.hand },
            desktop: hoverBySourceRef.current.desktop,
        }
        applyHoverEventToState(nextHoverState, event, true)
        hoverBySourceRef.current = nextHoverState

        const nextHover = hasAnyHover(nextHoverState)
        if (nextHover !== hoverRef.current) {
            hoverRef.current = nextHover
            setIsHovering(nextHover)
        }
    }, [isInhalerFocused])

    const handlePointerLeave = useCallback((event) => {
        const nextHoverState = {
            controller: { ...hoverBySourceRef.current.controller },
            hand: { ...hoverBySourceRef.current.hand },
            desktop: hoverBySourceRef.current.desktop,
        }
        applyHoverEventToState(nextHoverState, event, false)
        hoverBySourceRef.current = nextHoverState

        const nextHover = hasAnyHover(nextHoverState)
        if (nextHover !== hoverRef.current) {
            hoverRef.current = nextHover
            setIsHovering(nextHover)
        }
    }, [])

    const handleReturn = (event) => {
        event.stopPropagation()
        if (isInhalerFocused) releaseInhaler()
    }

    const handleClick = (event) => {
        if (isFromOverlayElement(event.target)) return
        if (xrMode === 'immersive-vr') return
        if (sessionPhase === 'idle' || sessionPhase === 'starting' || sessionPhase === 'completed') {
            recordBeforeStartMistake()
            return
        }

        if (!isInhalerFocused) {
            if (xrMode !== 'immersive-vr') {
                setClipboardFocused(false)
            }
            focusInhaler('desktop')
            return
        }
    }

    return (
        <group
            ref={group}
            {...props}
            dispose={null}
            onClick={handleClick}
            onContextMenu={handleReturn}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
        >
            <group visible={isTargeted} scale={1.045}>
                <mesh geometry={nodes.mesh_0.geometry} rotation={[-1.864, 0, 0]} scale={INHALER_MESH_SCALE} renderOrder={20}>
                    <meshBasicMaterial
                        color="#ffd46b"
                        transparent
                        opacity={0.12}
                        side={THREE.BackSide}
                        depthWrite={false}
                        toneMapped={false}
                    />
                </mesh>
                <mesh geometry={nodes.mesh_0_1.geometry} rotation={[-1.864, 0, 0]} scale={INHALER_MESH_SCALE} renderOrder={20}>
                    <meshBasicMaterial
                        color="#ffd46b"
                        transparent
                        opacity={0.1}
                        side={THREE.BackSide}
                        depthWrite={false}
                        toneMapped={false}
                    />
                </mesh>
                <mesh geometry={nodes.mesh_0_15.geometry} rotation={[-1.864, 0, 0]} scale={INHALER_MESH_SCALE} renderOrder={20}>
                    <meshBasicMaterial
                        color="#ffd46b"
                        transparent
                        opacity={0.1}
                        side={THREE.BackSide}
                        depthWrite={false}
                        toneMapped={false}
                    />
                </mesh>
                <mesh
                    geometry={nodes.mesh_0_55.geometry}
                    rotation={[-1.864, 0, 0]}
                    scale={INHALER_MESH_SCALE}
                    visible={!isCapOff}
                    renderOrder={20}
                >
                    <meshBasicMaterial
                        color="#ffd46b"
                        transparent
                        opacity={0.1}
                        side={THREE.BackSide}
                        depthWrite={false}
                        toneMapped={false}
                    />
                </mesh>
            </group>

            <mesh geometry={nodes.mesh_0.geometry} material={materials.matalparts} rotation={[-1.864, 0, 0]} scale={INHALER_MESH_SCALE} />
            <mesh geometry={nodes.mesh_0_1.geometry} material={materials.tankinfo} rotation={[-1.864, 0, 0]} scale={INHALER_MESH_SCALE} />
            <mesh geometry={nodes.mesh_0_15.geometry} material={materials.lightblue} rotation={[-1.864, 0, 0]} scale={INHALER_MESH_SCALE} />
            <mesh
                ref={capMeshRef}
                geometry={nodes.mesh_0_55.geometry}
                material={materials.darkblue}
                rotation={[-1.864, 0, 0]}
                scale={INHALER_MESH_SCALE}
                visible={!isCapOff}
            />
            <mesh
                geometry={nodes.mesh_0_55.geometry}
                rotation={[-1.864, 0, 0]}
                scale={0.95}
                visible={!isCapOff && isCapHovered}
                renderOrder={21}
            >
                <meshBasicMaterial
                    color="#7dd3fc"
                    transparent
                    opacity={0.18}
                    side={THREE.BackSide}
                    depthWrite={false}
                    toneMapped={false}
                />
            </mesh>
        </group>
    )
}

useGLTF.preload('/models/inhaler-transformed.glb')
