import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

export function FpsControls({ moveSpeed = 2.5, lookSpeed = 0.002, canLockPointer = true }) {
  const { camera, gl } = useThree()
  const keys = useRef({})
  const yaw = useRef(0)
  const pitch = useRef(0)
  const isLocked = useRef(false)
  const up = useRef(new THREE.Vector3(0, 1, 0))
  const lookEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))

  useEffect(() => {
    const initialEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
    yaw.current = initialEuler.y
    pitch.current = initialEuler.x
  }, [camera])

  useEffect(() => {
    const handleKeyDown = (event) => {
      keys.current[event.code] = true
    }

    const handleKeyUp = (event) => {
      keys.current[event.code] = false
    }

    const handleMouseMove = (event) => {
      if (!isLocked.current) return
      yaw.current -= event.movementX * lookSpeed
      pitch.current -= event.movementY * lookSpeed
      const maxPitch = Math.PI / 2 - 0.01
      pitch.current = Math.max(-maxPitch, Math.min(maxPitch, pitch.current))
      lookEuler.current.set(pitch.current, yaw.current, 0, 'YXZ')
      camera.quaternion.setFromEuler(lookEuler.current)
    }

    const handlePointerLockChange = () => {
      isLocked.current = document.pointerLockElement === gl.domElement
    }

    const handleClick = () => {
      if (!canLockPointer) return
      if (document.pointerLockElement !== gl.domElement) {
        gl.domElement.requestPointerLock()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('pointerlockchange', handlePointerLockChange)
    gl.domElement.addEventListener('click', handleClick)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
      gl.domElement.removeEventListener('click', handleClick)
    }
  }, [camera, canLockPointer, gl, lookSpeed])

  useEffect(() => {
    if (canLockPointer) {
      return undefined
    }

    if (document.pointerLockElement === gl.domElement) {
      document.exitPointerLock?.()
    }

    isLocked.current = false
    return undefined
  }, [canLockPointer, gl])

  useFrame((_state, delta) => {
    if (!isLocked.current) {
      return
    }

    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()

    const right = new THREE.Vector3().crossVectors(forward, up.current).normalize()
    const direction = new THREE.Vector3()

    if (keys.current.KeyW) direction.add(forward)
    if (keys.current.KeyS) direction.sub(forward)
    if (keys.current.KeyD) direction.add(right)
    if (keys.current.KeyA) direction.sub(right)

    if (direction.lengthSq() > 0) {
      direction.normalize().multiplyScalar(moveSpeed * delta)
      camera.position.add(direction)
    }
  })

  return null
}
