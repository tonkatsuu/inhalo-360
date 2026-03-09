import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const PLAYER_RADIUS = 0.28
const PLAYER_HEIGHT = 1.65
const PLAYER_HEAD_MARGIN = 0.1

function isHeightOverlapping(position, obstacle) {
  const bodyBottom = position.y - PLAYER_HEIGHT
  const bodyTop = position.y + PLAYER_HEAD_MARGIN
  return bodyTop > obstacle.min[1] && bodyBottom < obstacle.max[1]
}

function isInsideRoomBounds(position, room) {
  if (!room) {
    return true
  }

  return (
    position.x - PLAYER_RADIUS >= room.min[0] &&
    position.x + PLAYER_RADIUS <= room.max[0] &&
    position.z - PLAYER_RADIUS >= room.min[2] &&
    position.z + PLAYER_RADIUS <= room.max[2]
  )
}

function isIntersectingObstacle(position, obstacle) {
  if (!isHeightOverlapping(position, obstacle)) {
    return false
  }

  return (
    position.x + PLAYER_RADIUS > obstacle.min[0] &&
    position.x - PLAYER_RADIUS < obstacle.max[0] &&
    position.z + PLAYER_RADIUS > obstacle.min[2] &&
    position.z - PLAYER_RADIUS < obstacle.max[2]
  )
}

function canOccupyPosition(position, collisionLayout) {
  if (!collisionLayout) {
    return true
  }

  if (!isInsideRoomBounds(position, collisionLayout.room)) {
    return false
  }

  return !collisionLayout.obstacles?.some((obstacle) => isIntersectingObstacle(position, obstacle))
}

export function FpsControls({ moveSpeed = 2.5, lookSpeed = 0.002, canLockPointer = true, collisionLayout = null }) {
  const { camera, gl } = useThree()
  const cameraRef = useRef()
  const keys = useRef({})
  const yaw = useRef(0)
  const pitch = useRef(0)
  const isLocked = useRef(false)
  const up = useRef(new THREE.Vector3(0, 1, 0))
  const lookEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const proposedPosition = useRef(new THREE.Vector3())

  useEffect(() => {
    const initialEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
    yaw.current = initialEuler.y
    pitch.current = initialEuler.x
    cameraRef.current = camera
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
    if (!isLocked.current || !cameraRef.current) {
      return
    }

    const activeCamera = cameraRef.current
    const forward = new THREE.Vector3()
    activeCamera.getWorldDirection(forward)
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
      proposedPosition.current.copy(activeCamera.position)
      proposedPosition.current.x += direction.x
      if (canOccupyPosition(proposedPosition.current, collisionLayout)) {
        activeCamera.position.setX(proposedPosition.current.x)
      }

      proposedPosition.current.copy(activeCamera.position)
      proposedPosition.current.z += direction.z
      if (canOccupyPosition(proposedPosition.current, collisionLayout)) {
        activeCamera.position.setZ(proposedPosition.current.z)
      }
    }
  })

  return null
}
