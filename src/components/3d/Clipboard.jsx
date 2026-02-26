import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useTrainingStore, TRAINING_STEPS } from '../../store/useTrainingStore'

const MOVE_SPEED = 30
const ROTATE_SPEED = 40

function ChecklistItem({ step, isCompleted, isCurrent }) { 
    // div element for checklist items
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyItems: 'center',
                gap: '8px',
                padding: '4px 0',
                opacity: isCompleted ? 0.6 : 1,
            }}
        >
            <div
                style={{
                    width: '15px',
                    height: '15px',
                    borderRadius: '3px',
                    border: '2px solid',
                    borderColor: isCompleted ? '#4ade80' : isCurrent ? '#fbbf24' : '#666',
                    backgroundColor: isCompleted ? '#4ade80' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '1px',
                }}
            >
                {isCompleted && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                )}
            </div>
            <span
                style={{
                    fontSize: '12px',
                    color: isCurrent ? '#9f008c' : '#111',
                    textDecoration: isCompleted ? 'line-through' : 'none',
                    lineHeight: '1.2',
                }}
            >
                {step.text}
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

    const { currentStep, completedSteps, isClipboardFocused, setClipboardFocused, focusDistanceOffset, isTrainingComplete } =
        useTrainingStore()

    useEffect(() => {
        if (!group.current) return
        original.current.pos.copy(group.current.position)
        original.current.quat.copy(group.current.quaternion)
        original.current.scale.copy(group.current.scale)
    }, [])

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
        if (!isClipboardFocused) setClipboardFocused(true)
    }

    const handleReturn = (event) => {
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

                    <Html transform occlude={false} position={[0, 0, 2]} rotation={[Math.PI / 2, 0, 0]} distanceFactor={10000}>
                        <div
                            style={{
                                background: 'transparent',
                                color: '#000000',
                                padding: '5px',
                                fontSize: 13,
                                width: 280,
                                height: 380,
                                lineHeight: 1.45,
                                pointerEvents: 'none',
                            }}
                        >
                            <div style={{ fontWeight: 'bold', marginBottom: 10 }}>Inhaler Usage Steps</div>
                            {TRAINING_STEPS.map((step) => (
                                <ChecklistItem style={{ pointerEvents: 'none', fontSize: 12 }}
                                    key={step.id}
                                    step={step}
                                    isCompleted={completedSteps.includes(step.id)}
                                    isCurrent={currentStep === step.id}
                                />
                            ))}
                            {isTrainingComplete && (
                                <div
                                    style={{
                                        marginTop: '10px',
                                        padding: '6px',
                                        background: '#d1fae5',
                                        color: '#065f46',
                                        borderRadius: '6px',
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                    }}
                                >
                                    ✓ Training Complete!
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
