import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
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

    const camera = useThree((state) => state.camera)
    const raycaster = useMemo(() => new THREE.Raycaster(), [])
    const forward = useMemo(() => new THREE.Vector3(), [])
    const focusTarget = useMemo(() => new THREE.Vector3(), [])
    const targetQuat = useMemo(() => new THREE.Quaternion(), [])
    const upVector = useMemo(() => new THREE.Vector3(0, 1, 0), [])
    const original = useRef({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: new THREE.Vector3() })

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
    } = useTrainingStore()

    const visibleSteps = getVisibleTrainingSteps(secondDoseChoice)

    useEffect(() => {
        if (!group.current) return
        original.current.pos.copy(group.current.position)
        original.current.quat.copy(group.current.quaternion)
        original.current.scale.copy(group.current.scale)
    }, [])

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
                setClipboardFocused(true)
            }
        }

        window.addEventListener('contextmenu', handleGlobalDrop)
        window.addEventListener('pointerdown', handleGlobalPointerDown)
        return () => {
            window.removeEventListener('contextmenu', handleGlobalDrop)
            window.removeEventListener('pointerdown', handleGlobalPointerDown)
        }
    }, [currentStepId, isClipboardFocused, isHovering, recordMistake, sessionPhase, setClipboardFocused])

    useFrame((_state, delta) => {
        if (!group.current) return

        const alphaMove = 1 - Math.exp(-MOVE_SPEED * delta)
        const alphaRotate = 1 - Math.exp(-ROTATE_SPEED * delta)

        if (isClipboardFocused) {
            camera.getWorldDirection(forward)
            focusTarget.copy(camera.position).add(forward.multiplyScalar(focusDistanceOffset))
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
            if (isHovering) setIsHovering(false)
            return
        }
        camera.getWorldDirection(forward)
        raycaster.set(camera.position, forward)
        const hits = raycaster.intersectObject(group.current, true)
        setIsHovering(hits.length > 0)
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
        if (!isClipboardFocused) setClipboardFocused(true)
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

    return (
        <group ref={group} {...props} dispose={null} onClick={handleFocus} onContextMenu={handleReturn}>
            <group position={[0, 0, 0]} rotation={[-Math.PI, 0, 0]} scale={0.009}>
                <mesh geometry={nodes.Mesh002.geometry} material={materials['board.001']} />
                <lineSegments geometry={boardEdges} visible={isHovering || isClipboardFocused}>
                    <lineBasicMaterial color={outlineColor} linewidth={5} depthTest={false} />
                </lineSegments>

                <mesh geometry={nodes.Mesh002_1.geometry} material={materials['metal.001']} />

                <mesh geometry={nodes.page001.geometry} material={blankPageMaterial} position={[0, -200, -730]}>
                    <lineSegments geometry={pageEdges} visible={isHovering || isClipboardFocused}>
                        <lineBasicMaterial color={outlineColor} linewidth={5} depthTest={false} />
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
                            {visibleSteps.map((step) => (
                                <ChecklistItem
                                    key={step.id}
                                    step={step}
                                    isCompleted={completedSteps.includes(step.id)}
                                    isCurrent={currentStepId === step.id}
                                />
                            ))}
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
