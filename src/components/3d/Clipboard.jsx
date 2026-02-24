import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useTrainingStore } from '../../store/useTrainingStore'

const MOVE_SPEED = 12
const ROTATE_SPEED = 12
const CLOSE_ENOUGH = 0.02

const getStepText = ({ hasShaken, isCapOff }) => {
  if (!hasShaken) return "Step 1: Shake the contents well"
  if (!isCapOff) return "Step 2: Remove the cap"
  return "Step 3: Hold the inhaler upright"
}

export function Clipboard(props) {
  const { nodes, materials } = useGLTF('/models/clipboard-transformed.glb')
  const group = useRef()
  const [isHovering, setIsHovering] = useState(false)

  const camera = useThree((state) => state.camera)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const forward = useMemo(() => new THREE.Vector3(), [])
  const focusTarget = useMemo(() => new THREE.Vector3(), [])
  const original = useRef({
    pos: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    scale: new THREE.Vector3(),
  })

  const { hasShaken, isCapOff, isClipboardFocused, setClipboardFocused, focusDistanceOffset } =
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
      group.current.quaternion.slerp(camera.quaternion, alphaRotate)
    } else {
      group.current.position.lerp(original.current.pos, alphaMove)
      group.current.quaternion.slerp(original.current.quat, alphaRotate)
      group.current.scale.lerp(original.current.scale, alphaMove)
    }
  })

  useFrame(() => {
    if (!group.current || isClipboardFocused) return
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

  const highlightMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffd46b' }),
    []
  )

  return (
    <group
      ref={group}
      {...props}
      dispose={null}
      onClick={handleFocus}
      onContextMenu={handleReturn}
    >
      <group position={[-0.085, 0.033, 0.126]} rotation={[-Math.PI, 0, 0]} scale={0.01}>
        <mesh
          geometry={nodes.Mesh002.geometry}
          material={isHovering ? highlightMaterial : materials['board.001']}
        />
        <mesh
          geometry={nodes.Mesh002_1.geometry}
          material={isHovering ? highlightMaterial : materials['metal.001']}
        />
      </group>
      <mesh
        geometry={nodes.page001.geometry}
        material={isHovering ? highlightMaterial : materials['page.001']}
        position={[-0.085, 0.052, 0.196]}
        rotation={[-Math.PI, 0, 0]}
        scale={0.01}
      />

      {isClipboardFocused && (
        <Html distanceFactor={1.5} transform position={[0, 0.18, 0]}>
          <div
            style={{
              background: 'rgba(10, 10, 10, 0.85)',
              color: '#fff',
              padding: '12px 16px',
              borderRadius: 8,
              fontSize: 14,
              maxWidth: 220,
            }}
          >
            {getStepText({ hasShaken, isCapOff })}
          </div>
        </Html>
      )}
    </group>
  )
}

useGLTF.preload('/models/clipboard-transformed.glb')
