import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useXR, useXRControllerButtonEvent, useXRInputSourceEvent } from '@react-three/xr'
import * as THREE from 'three'
import { getVisibleTrainingSteps, useTrainingStore } from '../../store/useTrainingStore'
import { isSessionRunning } from '../../training/engine'
import { isFromOverlayElement } from '../../utils/dom'
import { useXRHardwareState } from './useXRHardwareState'

const MOVE_SPEED = 30
const ROTATE_SPEED = 40
const CHECKLIST_TEXTURE_WIDTH = 1024
const CHECKLIST_TEXTURE_HEIGHT = 1440
const CHECKLIST_PAGE_PADDING_X = 96
const CHECKLIST_PAGE_PADDING_Y = 108

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

function drawRoundedRect(context, x, y, width, height, radius, fillStyle, strokeStyle = null, lineWidth = 1) {
    context.beginPath()
    context.moveTo(x + radius, y)
    context.lineTo(x + width - radius, y)
    context.quadraticCurveTo(x + width, y, x + width, y + radius)
    context.lineTo(x + width, y + height - radius)
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    context.lineTo(x + radius, y + height)
    context.quadraticCurveTo(x, y + height, x, y + height - radius)
    context.lineTo(x, y + radius)
    context.quadraticCurveTo(x, y, x + radius, y)
    context.closePath()

    if (fillStyle) {
        context.fillStyle = fillStyle
        context.fill()
    }

    if (strokeStyle) {
        context.strokeStyle = strokeStyle
        context.lineWidth = lineWidth
        context.stroke()
    }
}

function wrapTextLines(context, text, maxWidth) {
    const words = text.split(/\s+/).filter(Boolean)
    const lines = []
    let currentLine = ''

    for (const word of words) {
        const nextLine = currentLine ? `${currentLine} ${word}` : word
        if (!currentLine || context.measureText(nextLine).width <= maxWidth) {
            currentLine = nextLine
            continue
        }

        lines.push(currentLine)
        currentLine = word
    }

    if (currentLine) {
        lines.push(currentLine)
    }

    return lines
}

function createChecklistTexture({
    completedSteps,
    currentStepId,
    displayedSteps,
    gl,
    isTrainingComplete,
    showBottomEllipsis,
    showTopEllipsis,
}) {
    if (typeof document === 'undefined') {
        return null
    }

    const canvas = document.createElement('canvas')
    canvas.width = CHECKLIST_TEXTURE_WIDTH
    canvas.height = CHECKLIST_TEXTURE_HEIGHT

    const context = canvas.getContext('2d')
    if (!context) {
        return null
    }

    const contentWidth = CHECKLIST_TEXTURE_WIDTH - CHECKLIST_PAGE_PADDING_X * 2
    let cursorY = CHECKLIST_PAGE_PADDING_Y

    context.fillStyle = '#fffdf8'
    context.fillRect(0, 0, canvas.width, canvas.height)

    const headerGradient = context.createLinearGradient(0, 0, canvas.width, 0)
    headerGradient.addColorStop(0, '#f8f0de')
    headerGradient.addColorStop(1, '#eef8fc')
    drawRoundedRect(context, 56, 54, canvas.width - 112, 168, 36, headerGradient, '#d6c2a0', 3)

    context.fillStyle = '#17303f'
    context.font = '700 56px Arial'
    context.textBaseline = 'top'
    context.fillText("Ava's checklist", CHECKLIST_PAGE_PADDING_X, cursorY)

    cursorY += 70
    context.fillStyle = '#466170'
    context.font = '400 28px Arial'
    const introLines = wrapTextLines(
        context,
        'Follow the current instruction card, then use this sheet to review the full flow.',
        contentWidth,
    )
    introLines.forEach((line) => {
        context.fillText(line, CHECKLIST_PAGE_PADDING_X, cursorY)
        cursorY += 34
    })

    cursorY += 50

    if (showTopEllipsis) {
        context.fillStyle = '#7b8794'
        context.font = '700 34px Arial'
        context.fillText('...', CHECKLIST_PAGE_PADDING_X, cursorY)
        cursorY += 42
    }

    displayedSteps.forEach((step) => {
        const isCompleted = completedSteps.includes(step.id)
        const isCurrent = currentStepId === step.id
        const blockTop = cursorY
        const lines = []

        context.font = `${isCurrent ? '700' : '500'} 34px Arial`
        wrapTextLines(context, step.instruction, contentWidth - 116).forEach((line) => {
            lines.push(line)
        })

        const lineHeight = 42
        const blockHeight = Math.max(86, 34 + lines.length * lineHeight)

        if (isCurrent) {
            drawRoundedRect(context, 62, blockTop - 10, canvas.width - 124, blockHeight, 28, '#ebf9ff', '#67cdec', 3)
        }

        context.lineWidth = 4
        context.strokeStyle = isCompleted ? '#4ade80' : isCurrent ? '#67cdec' : '#8a94a3'
        context.strokeRect(CHECKLIST_PAGE_PADDING_X, blockTop + 10, 34, 34)

        if (isCompleted) {
            context.fillStyle = '#4ade80'
            context.font = '700 28px Arial'
            context.fillText('x', CHECKLIST_PAGE_PADDING_X + 9, blockTop + 6)
        } else if (isCurrent) {
            context.fillStyle = '#0b3041'
            context.font = '700 28px Arial'
            context.fillText('>', CHECKLIST_PAGE_PADDING_X + 7, blockTop + 6)
        }

        context.fillStyle = isCompleted ? '#5b6470' : isCurrent ? '#0b3041' : '#1c252e'
        context.font = `${isCurrent ? '700' : '500'} 34px Arial`
        lines.forEach((line, lineIndex) => {
            const lineY = blockTop + lineIndex * lineHeight
            context.fillText(line, CHECKLIST_PAGE_PADDING_X + 58, lineY)

            if (isCompleted) {
                const measuredWidth = context.measureText(line).width
                const strikeY = lineY + 21
                context.strokeStyle = '#7b8794'
                context.lineWidth = 3
                context.beginPath()
                context.moveTo(CHECKLIST_PAGE_PADDING_X + 58, strikeY)
                context.lineTo(CHECKLIST_PAGE_PADDING_X + 58 + measuredWidth, strikeY)
                context.stroke()
            }
        })

        cursorY += blockHeight + 20
    })

    if (showBottomEllipsis) {
        context.fillStyle = '#7b8794'
        context.font = '700 34px Arial'
        context.fillText('...', CHECKLIST_PAGE_PADDING_X, cursorY)
        cursorY += 42
    }

    if (isTrainingComplete) {
        drawRoundedRect(context, 92, canvas.height - 188, canvas.width - 184, 96, 28, '#d1fae5', '#86efac', 3)
        context.fillStyle = '#065f46'
        context.font = '700 42px Arial'
        context.textAlign = 'center'
        context.fillText('Session complete', canvas.width / 2, canvas.height - 156)
        context.textAlign = 'start'
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.flipY = false
    texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    texture.needsUpdate = true
    return texture
}

export function Clipboard(props) {
    const { nodes, materials } = useGLTF('/models/clipboard.glb')
    const group = useRef()
    const [isHovering, setIsHovering] = useState(false)
    const hoverRef = useRef(false)
    const hoverBySourceRef = useRef({
        controller: { left: false, right: false },
        hand: { left: false, right: false },
        desktop: false,
    })
    const focusSourceRef = useRef({ type: null, handedness: null })

    const camera = useThree((state) => state.camera)
    const gl = useThree((state) => state.gl)
    const raycaster = useMemo(() => new THREE.Raycaster(), [])
    const forward = useMemo(() => new THREE.Vector3(), [])
    const focusTarget = useMemo(() => new THREE.Vector3(), [])
    const lookTarget = useMemo(() => new THREE.Vector3(), [])
    const targetQuat = useMemo(() => new THREE.Quaternion(), [])
    const upVector = useMemo(() => new THREE.Vector3(0, 1, 0), [])
    const controllerDir = useMemo(() => new THREE.Vector3(), [])
    const controllerRayPos = useMemo(() => new THREE.Vector3(), [])
    const controllerRayQuat = useMemo(() => new THREE.Quaternion(), [])
    const controllerPos = useMemo(() => new THREE.Vector3(), [])
    const controllerQuat = useMemo(() => new THREE.Quaternion(), [])
    const cameraWorldPos = useMemo(() => new THREE.Vector3(), [])
    const holdOffset = useMemo(() => new THREE.Vector3(0.08, -0.03, -0.16), [])
    const handHoldOffset = useMemo(() => new THREE.Vector3(0.02, -0.025, -0.12), [])
    const desktopTiltQuat = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI * 1.5, Math.PI, 0)), [])
    const holdFacingQuatOffset = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI * 1.5, Math.PI, 0)), [])
    const original = useRef({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: new THREE.Vector3(), captured: false })

    const {
        completedSteps,
        claimXRGrab,
        currentStepId,
        isClipboardFocused,
        isTrainingComplete,
        releaseXRGrab,
        secondDoseChoice,
        setClipboardFocused,
        focusDistanceOffset,
        sessionPhase,
        recordMistake,
        trainingMode,
        setInhalerFocused,
    } = useTrainingStore()

    const visibleSteps = getVisibleTrainingSteps(secondDoseChoice)

    let displayedSteps = visibleSteps
    let showTopEllipsis = false
    let showBottomEllipsis = false
    const MAX_ITEMS = 8

    if (visibleSteps.length > MAX_ITEMS) {
        let startIndex = Math.max(0, visibleSteps.length - MAX_ITEMS)
        const currentIdx = visibleSteps.findIndex((s) => s.id === currentStepId)

        if (currentIdx !== -1 && currentIdx < startIndex) {
            startIndex = currentIdx
        }

        displayedSteps = visibleSteps.slice(startIndex, startIndex + MAX_ITEMS)
        showTopEllipsis = startIndex > 0
        showBottomEllipsis = startIndex + MAX_ITEMS < visibleSteps.length
    }

    const xrMode = useXR((state) => state.mode)
    const { leftController, rightController, leftHand, rightHand, activeController, activeHand } = useXRHardwareState()

    const checklistTexture = useMemo(() => createChecklistTexture({
        completedSteps,
        currentStepId,
        displayedSteps,
        gl,
        isTrainingComplete,
        showBottomEllipsis,
        showTopEllipsis,
    }), [completedSteps, currentStepId, displayedSteps, gl, isTrainingComplete, showBottomEllipsis, showTopEllipsis])

    useEffect(() => {
        return () => {
            checklistTexture?.dispose()
        }
    }, [checklistTexture])

    const focusClipboard = useCallback((type, handedness = null) => {
        if ((type === 'controller' || type === 'hand') && !claimXRGrab('clipboard', { type, handedness })) {
            return false
        }
        focusSourceRef.current = { type, handedness }
        setClipboardFocused(true)
        return true
    }, [claimXRGrab, setClipboardFocused])

    const releaseClipboard = useCallback(() => {
        if (focusSourceRef.current.type === 'controller' || focusSourceRef.current.type === 'hand') {
            releaseXRGrab('clipboard', focusSourceRef.current)
        }
        focusSourceRef.current = { type: null, handedness: null }
        setClipboardFocused(false)
    }, [releaseXRGrab, setClipboardFocused])

    useXRControllerButtonEvent(rightController, 'xr-standard-squeeze', (state) => {
        if (
            state === 'pressed' &&
            isClipboardFocused &&
            focusSourceRef.current.type === 'controller' &&
            (focusSourceRef.current.handedness == null || focusSourceRef.current.handedness === 'right')
        ) {
            releaseClipboard()
        }
    })
    useXRControllerButtonEvent(leftController, 'xr-standard-squeeze', (state) => {
        if (
            state === 'pressed' &&
            isClipboardFocused &&
            focusSourceRef.current.type === 'controller' &&
            (focusSourceRef.current.handedness == null || focusSourceRef.current.handedness === 'left')
        ) {
            releaseClipboard()
        }
    })

    useXRInputSourceEvent('all', 'selectstart', (event) => {
        if (xrMode !== 'immersive-vr') {
            return
        }

        if (isClipboardFocused) {
            return
        }

        const hoverType = event.inputSource.hand == null ? 'controller' : 'hand'
        const hoverHandedness = event.inputSource.handedness ?? 'right'

        if (!hoverBySourceRef.current[hoverType]?.[hoverHandedness]) {
            return
        }

        if (!isSessionRunning(sessionPhase)) {
            recordMistake({
                stepId: currentStepId,
                code: 'attempt_action_before_start',
                message: 'The checklist was opened before the training session was started.',
                correction: 'Press Start Training first, then follow the guided checklist.',
            })
            return
        }

        focusClipboard(hoverType, event.inputSource.handedness ?? null)
    }, [currentStepId, focusClipboard, isClipboardFocused, recordMistake, sessionPhase, xrMode])

    useXRInputSourceEvent('all', 'squeezestart', (event) => {
        if (
            xrMode !== 'immersive-vr' ||
            event.inputSource.hand == null ||
            !isClipboardFocused ||
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

        releaseClipboard()
    }, [isClipboardFocused, releaseClipboard, xrMode])

    useEffect(() => {
        // Reset the captured flag when props change so the resting position
        // is re-snapshotted on the next frame (props.position may have changed).
        original.current.captured = false
    }, [props.position, props.rotation, props.scale])

    useEffect(() => {
        if (!isClipboardFocused) {
            focusSourceRef.current = { type: null, handedness: null }
            return
        }

        hoverBySourceRef.current = createEmptyHoverState()
        if (hoverRef.current) {
            hoverRef.current = false
            setIsHovering(false)
        }
    }, [isClipboardFocused])

    useEffect(() => {
        const handleGlobalDrop = (event) => {
            if (isFromOverlayElement(event.target)) return
            if (!isClipboardFocused) return
            if (!isSessionRunning(sessionPhase)) return
            event.preventDefault()
            releaseClipboard()
        }

        const handleGlobalPointerDown = (event) => {
            if (isFromOverlayElement(event.target)) return
            if (xrMode === 'immersive-vr') return
            if (event.button === 0 && !isSessionRunning(sessionPhase) && isHovering) {
                recordMistake({
                    stepId: currentStepId,
                    code: 'attempt_action_before_start',
                    message: 'The checklist was opened before the training session was started.',
                    correction: 'Press Start Training first, then follow the guided checklist.',
                })
                return
            }
            if (event.button === 2) {
                if (isClipboardFocused) {
                    event.preventDefault()
                    releaseClipboard()
                }
                return
            }
            if (event.button === 0 && !isClipboardFocused && isHovering && isSessionRunning(sessionPhase)) {
                event.preventDefault()
                if (xrMode !== 'immersive-vr') {
                    setInhalerFocused(false)
                }
                focusClipboard('desktop')
            }
        }

        window.addEventListener('contextmenu', handleGlobalDrop)
        window.addEventListener('pointerdown', handleGlobalPointerDown)
        return () => {
            window.removeEventListener('contextmenu', handleGlobalDrop)
            window.removeEventListener('pointerdown', handleGlobalPointerDown)
        }
    }, [currentStepId, focusClipboard, isClipboardFocused, isHovering, recordMistake, releaseClipboard, sessionPhase, setInhalerFocused, xrMode])

    useFrame((_state, delta) => {
        if (!group.current) return

        // Capture the true resting transform on the first frame after mount / prop change,
        // because useEffect([]) fires before R3F has propagated position/rotation/scale props.
        if (!original.current.captured) {
            original.current.pos.copy(group.current.position)
            original.current.quat.copy(group.current.quaternion)
            original.current.scale.copy(group.current.scale)
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

        camera.getWorldPosition(cameraWorldPos)

        if (isClipboardFocused) {
            if (focusedXRSource?.object) {
                focusedXRSource.object.updateWorldMatrix(true, false)
                focusedXRSource.object.getWorldPosition(controllerPos)
                focusedXRSource.object.getWorldQuaternion(controllerQuat)
                focusTarget
                    .copy(focusSourceRef.current.type === 'hand' ? handHoldOffset : holdOffset)
                    .applyQuaternion(controllerQuat)
                    .add(controllerPos)
                group.current.position.lerp(focusTarget, alphaMove)
                lookTarget.copy(cameraWorldPos)
                lookTarget.y = group.current.position.y
                const lookAtMatrix = new THREE.Matrix4()
                lookAtMatrix.lookAt(group.current.position, lookTarget, upVector)
                targetQuat.setFromRotationMatrix(lookAtMatrix)
                targetQuat.multiply(holdFacingQuatOffset)
            } else {
                camera.getWorldDirection(forward)
                const targetDistance = focusDistanceOffset + 0.15
                focusTarget.copy(cameraWorldPos).add(forward.multiplyScalar(targetDistance))
                group.current.position.lerp(focusTarget, alphaMove)

                const lookAtMatrix = new THREE.Matrix4()
                lookAtMatrix.lookAt(group.current.position, cameraWorldPos, upVector)
                targetQuat.setFromRotationMatrix(lookAtMatrix)
                targetQuat.multiply(desktopTiltQuat)
            }

            group.current.quaternion.slerp(targetQuat, alphaRotate)
            group.current.scale.lerp(original.current.scale, alphaMove)
        } else {
            group.current.position.lerp(original.current.pos, alphaMove)
            group.current.quaternion.slerp(original.current.quat, alphaRotate)
            group.current.scale.lerp(original.current.scale, alphaMove)
        }
    })

    const handlePointerEnter = useCallback((event) => {
        if (isClipboardFocused) {
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
    }, [isClipboardFocused])

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

    const handleFocus = () => {
        if (xrMode === 'immersive-vr') {
            return
        }

        if (!isSessionRunning(sessionPhase)) {
            recordMistake({
                stepId: currentStepId,
                code: 'attempt_action_before_start',
                message: 'The checklist was opened before the training session was started.',
                correction: 'Press Start Training first, then follow the guided checklist.',
            })
            return
        }
        if (!isClipboardFocused) {
            if (xrMode !== 'immersive-vr') {
                setInhalerFocused(false)
            }
            focusClipboard('desktop')
        }
    }

    const handleReturn = (event) => {
        if (isFromOverlayElement(event.target)) return
        event.stopPropagation()
        if (isClipboardFocused) releaseClipboard()
    }

    const outlineColor = '#ffd46b'
    const boardEdges = useMemo(() => new THREE.EdgesGeometry(nodes.Mesh002.geometry), [nodes])
    const pageEdges = useMemo(() => new THREE.EdgesGeometry(nodes.page001.geometry), [nodes])
    const highlightVisible = isHovering

    if (trainingMode === 'assessment') return null

    return (
        <group
            ref={group}
            {...props}
            dispose={null}
            onClick={handleFocus}
            onContextMenu={handleReturn}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
        >
            <group position={[0, 0, 0]} rotation={[-Math.PI, 0, 0]} scale={0.009}>
                <group visible={highlightVisible} scale={1.03}>
                    <mesh geometry={nodes.Mesh002.geometry} renderOrder={20}>
                        <meshBasicMaterial
                            color={outlineColor}
                            transparent
                            opacity={0.18}
                            side={THREE.BackSide}
                            depthWrite={false}
                            toneMapped={false}
                        />
                    </mesh>
                    <mesh geometry={nodes.page001.geometry} position={[0, -200, -730]} renderOrder={20}>
                        <meshBasicMaterial
                            color={outlineColor}
                            transparent
                            opacity={0.12}
                            side={THREE.BackSide}
                            depthWrite={false}
                            toneMapped={false}
                        />
                    </mesh>
                </group>

                <mesh geometry={nodes.Mesh002.geometry} material={materials['board.001']} />
                <lineSegments geometry={boardEdges} visible={highlightVisible} renderOrder={21}>
                    <lineBasicMaterial color={outlineColor} linewidth={5} depthTest={false} toneMapped={false} />
                </lineSegments>

                <mesh geometry={nodes.Mesh002_1.geometry} material={materials['metal.001']} />

                <mesh geometry={nodes.page001.geometry} position={[0, -200, -730]}>
                    <meshStandardMaterial color="#ffffff" map={checklistTexture ?? null} roughness={0.92} metalness={0.02} />
                    <lineSegments geometry={pageEdges} visible={highlightVisible} renderOrder={21}>
                        <lineBasicMaterial color={outlineColor} linewidth={5} depthTest={false} toneMapped={false} />
                    </lineSegments>
                </mesh>
            </group>
        </group>
    )
}

useGLTF.preload('/models/clipboard.glb')
