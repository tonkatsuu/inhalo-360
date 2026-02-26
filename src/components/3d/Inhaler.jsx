import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useTrainingStore, TRAINING_STEPS } from '../../store/useTrainingStore'

const MOVE_SPEED = 12
const ROTATE_SPEED = 12
const FOCUS_DISTANCE = 0.45
const SHAKE_SPEED_THRESHOLD = 1.2

export function Inhaler(props) {
  const { nodes, materials } = useGLTF('/models/inhaler-transformed.glb')
  const group = useRef()
  const lastPos = useRef(new THREE.Vector3())
  const original = useRef({
    pos: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    scale: new THREE.Vector3(),
  })

  const camera = useThree((state) => state.camera)

  const {
    currentStep,
    isCapOff,
    isInhalerFocused,
    isShaking,
    shakeDuration,
    shakeElapsed,
    setCapOff,
    setInhalerFocused,
    setIsShaking,
    setShakeElapsed,
    completeShake,
    advanceStep,
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
    } else {
      group.current.position.lerp(original.current.pos, alphaMove)
      group.current.quaternion.slerp(original.current.quat, alphaRotate)
      group.current.scale.lerp(original.current.scale, alphaMove)
      lastPos.current.copy(group.current.position)
    }
  })

  const handleReturn = (event) => {
    event.stopPropagation()
    if (isInhalerFocused) setInhalerFocused(false)
  }

  const handleToggleCap = (event) => {
    event.stopPropagation()
    // Only allow cap removal after shake (step 1), or cap replacement at step 10
    if (currentStep === 1 && !isCapOff) {
      setCapOff(true)
    } else if (currentStep === 10 && isCapOff) {
      setCapOff(false)
    }
  }

  // Handle click to advance through steps that require interaction
  const handleClick = (event) => {
    // If not focused, focus first
    if (!isInhalerFocused) {
      setInhalerFocused(true)
      return
    }
    
    // If focused and on a click-based step, advance
    const step = TRAINING_STEPS[currentStep]
    if (step && step.action === 'click') {
      advanceStep()
    }
  }

  return (
    <group
      ref={group}
      {...props}
      dispose={null}
      onClick={handleClick}
      onContextMenu={handleReturn}
      onDoubleClick={handleToggleCap}
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
