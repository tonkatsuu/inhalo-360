import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import { useXR, useXRControllerButtonEvent, useXRInputSourceState } from '@react-three/xr'
import * as THREE from 'three'
import { getVisibleTrainingSteps, useTrainingStore } from '../../store/useTrainingStore'
import { isSessionRunning } from '../../training/engine'
import { isFromOverlayElement } from '../../utils/dom'

const MOVE_SPEED = 30
const ROTATE_SPEED = 40

function ChecklistItem({ step, isCompleted, isCurrent }) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '4px 0',
                opacity: isCompleted ? 0.55 : 1,
            }}
        >
            <div
                style={{
                    width: '15px',
                    height: '15px',
                    borderRadius: '999px',
                    border: '2px solid',
                    borderColor: isCompleted ? '#4ade80' : isCurrent ? '#67cdec' : '#666',
                    backgroundColor: isCompleted ? '#4ade80' : isCurrent ? 'rgba(103, 205, 236, 0.18)' : 'transparent',
                    flexShrink: 0,
                    marginTop: '2px',
                }}
            />
            <span
                style={{
                    fontSize: '12px',
                    color: isCurrent ? '#0b3041' : '#111',
                    textDecoration: isCompleted ? 'line-through' : 'none',
                    lineHeight: '1.25',
                    fontWeight: isCurrent ? 700 : 500,
                }}
            >
                {step.instruction}
            </span>
        </div>
    )
}

export function Clipboard(props) {
    const { nodes, materials } = useGLTF('/models/clipboard.glb')
    const group = useRef()
    const [isHovering, setIsHovering] = useState(false)
    const hoverRef = useRef(false)

    const camera = useThree((state) => state.camera)
    const raycaster = useMemo(() => new THREE.Raycaster(), [])
    const forward = useMemo(() => new THREE.Vector3(), [])
    const focusTarget = useMemo(() => new THREE.Vector3(), [])
    const targetQuat = useMemo(() => new THREE.Quaternion(), [])
    const upVector = useMemo(() => new THREE.Vector3(0, 1, 0), [])
    const controllerDir = useMemo(() => new THREE.Vector3(), [])
    const controllerRayPos = useMemo(() => new THREE.Vector3(), [])
    const original = useRef({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: new THREE.Vector3(), captured: false })

    const {
        completedSteps,
        currentStepId,
        isClipboardFocused,
        isTrainingComplete,
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
    const rightController = useXRInputSourceState('controller', 'right')
    const leftController = useXRInputSourceState('controller', 'left')
    const activeController = rightController ?? leftController

    useXRControllerButtonEvent(rightController, 'xr-standard-squeeze', (state) => {
        if (state === 'pressed' && isClipboardFocused) setClipboardFocused(false)
    })
    useXRControllerButtonEvent(leftController, 'xr-standard-squeeze', (state) => {
        if (state === 'pressed' && isClipboardFocused) setClipboardFocused(false)
    })

    useEffect(() => {
        // Reset the captured flag when props change so the resting position
        // is re-snapshotted on the next frame (props.position may have changed).
        original.current.captured = false
    }, [props.position, props.rotation, props.scale])

    useEffect(() => {
        const handleGlobalDrop = (event) => {
            if (isFromOverlayElement(event.target)) return
            if (!isClipboardFocused) return
            if (!isSessionRunning(sessionPhase)) return
            event.preventDefault()
            setClipboardFocused(false)
        }

        const handleGlobalPointerDown = (event) => {
            if (isFromOverlayElement(event.target)) return
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
                    setClipboardFocused(false)
                }
                return
            }
            if (event.button === 0 && !isClipboardFocused && isHovering && isSessionRunning(sessionPhase)) {
                event.preventDefault()
                if (xrMode !== 'immersive-vr') {
                    setInhalerFocused(false)
                }
                setClipboardFocused(true)
            }
        }

        window.addEventListener('contextmenu', handleGlobalDrop)
        window.addEventListener('pointerdown', handleGlobalPointerDown)
        return () => {
            window.removeEventListener('contextmenu', handleGlobalDrop)
            window.removeEventListener('pointerdown', handleGlobalPointerDown)
        }
    }, [currentStepId, isClipboardFocused, isHovering, recordMistake, sessionPhase, setClipboardFocused, setInhalerFocused, xrMode])

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

        if (isClipboardFocused) {
            camera.getWorldDirection(forward)
            const targetDistance = focusDistanceOffset + 0.15
            focusTarget.copy(camera.position).add(forward.multiplyScalar(targetDistance))
            group.current.position.lerp(focusTarget, alphaMove)

            const lookAtMatrix = new THREE.Matrix4()
            lookAtMatrix.lookAt(group.current.position, camera.position, upVector)
            targetQuat.setFromRotationMatrix(lookAtMatrix)
            const tiltQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI * 1.5, Math.PI, 0))
            targetQuat.multiply(tiltQuat)
            group.current.quaternion.slerp(targetQuat, alphaRotate)
        } else {
            group.current.position.lerp(original.current.pos, alphaMove)
            group.current.quaternion.slerp(original.current.quat, alphaRotate)
            group.current.scale.lerp(original.current.scale, alphaMove)
        }
    })

    useFrame(() => {
        if (!group.current) return
        if (isClipboardFocused) {
            if (hoverRef.current) {
                hoverRef.current = false
                setIsHovering(false)
            }
            return
        }

        if (xrMode === 'immersive-vr' && activeController?.object) {
            activeController.object.updateWorldMatrix(true, false)
            activeController.object.getWorldPosition(controllerRayPos)
            controllerDir.set(0, 0, -1).applyQuaternion(activeController.object.quaternion)
            raycaster.set(controllerRayPos, controllerDir)
        } else {
            camera.getWorldDirection(forward)
            raycaster.set(camera.position, forward)
        }

        const hits = raycaster.intersectObject(group.current, true)
        const nextHover = hits.length > 0
        if (nextHover !== hoverRef.current) {
            hoverRef.current = nextHover
            setIsHovering(nextHover)
        }
    })

    const handleFocus = () => {
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
            setClipboardFocused(true)
        }
    }

    const handleReturn = (event) => {
        if (isFromOverlayElement(event.target)) return
        event.stopPropagation()
        if (isClipboardFocused) setClipboardFocused(false)
    }

    const blankPageMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff' }), [])
    const outlineColor = '#ffd46b'
    const boardEdges = useMemo(() => new THREE.EdgesGeometry(nodes.Mesh002.geometry), [nodes])
    const pageEdges = useMemo(() => new THREE.EdgesGeometry(nodes.page001.geometry), [nodes])
    const highlightVisible = isHovering

    if (trainingMode === 'assessment') return null

    return (
        <group ref={group} {...props} dispose={null} onClick={handleFocus} onContextMenu={handleReturn}>
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

                <mesh geometry={nodes.page001.geometry} material={blankPageMaterial} position={[0, -200, -730]}>
                    <lineSegments geometry={pageEdges} visible={highlightVisible} renderOrder={21}>
                        <lineBasicMaterial color={outlineColor} linewidth={5} depthTest={false} toneMapped={false} />
                    </lineSegments>

                    <Html transform occlude={false} position={[0, 0, 2]} rotation={[Math.PI / 2, 0, 0]} distanceFactor={10000} zIndexRange={[0, 0]}>
                        <div
                            style={{
                                background: 'transparent',
                                color: '#000000',
                                padding: '5px',
                                fontSize: 13,
                                width: 290,
                                height: 380,
                                lineHeight: 1.45,
                                pointerEvents: 'none',
                            }}
                        >
                            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Ava&apos;s checklist</div>
                            <div style={{ fontSize: 12, marginBottom: 8, color: '#34515b' }}>
                                Follow the current instruction card, then use this sheet to review the full flow.
                            </div>
                            {showTopEllipsis && (
                                <div style={{ textAlign: 'center', opacity: 0.55, margin: '2px 0', fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px' }}>•••</div>
                            )}
                            {displayedSteps.map((step) => (
                                <ChecklistItem
                                    key={step.id}
                                    step={step}
                                    isCompleted={completedSteps.includes(step.id)}
                                    isCurrent={currentStepId === step.id}
                                />
                            ))}
                            {showBottomEllipsis && (
                                <div style={{ textAlign: 'center', opacity: 0.55, margin: '2px 0', fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px' }}>•••</div>
                            )}
                            {isTrainingComplete && (
                                <div
                                    style={{
                                        marginTop: '10px',
                                        padding: '8px',
                                        background: '#d1fae5',
                                        color: '#065f46',
                                        borderRadius: '8px',
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                    }}
                                >
                                    Session complete
                                </div>
                            )}
                        </div>
                    </Html>
                </mesh>
            </group>
        </group>
    )
}

useGLTF.preload('/models/clipboard.glb')
