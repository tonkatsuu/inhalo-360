import { useFrame } from '@react-three/fiber'
import { useXR, useXRStore } from '@react-three/xr'
import * as THREE from 'three'
import { useEffect, useMemo } from 'react'

const KEYS = { w: false, a: false, s: false, d: false, q: false, e: false }

export function VRLocomotion({ originRef, speed = 1.5, turnSpeed = 1.5 }) {
    const xr = useXR()
    const xrStore = useXRStore()

    const forward = useMemo(() => new THREE.Vector3(), [])
    const right = useMemo(() => new THREE.Vector3(), [])
    const direction = useMemo(() => new THREE.Vector3(), [])
    const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])

    // Keyboard listeners for desktop fallback while an XR session is active.
    useEffect(() => {
        const handleKeyDown = (e) => {
            const key = e.key.toLowerCase()
            if (KEYS[key] !== undefined) KEYS[key] = true
        }
        const handleKeyUp = (e) => {
            const key = e.key.toLowerCase()
            if (KEYS[key] !== undefined) KEYS[key] = false
        }
        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [])

    // Keyboard fallback when in VR
    useFrame((_state, delta) => {
        const originObj = originRef?.current
        if (!originObj || !xr || xr.mode !== 'immersive-vr') return

        const head = xrStore.getState().camera
        if (!head) return
        const inputSourceStates = xrStore.getState().inputSourceStates
        const leftController = inputSourceStates.find(
            (state) => state.type === 'controller' && state.inputSource.handedness === 'left'
        )
        const rightController = inputSourceStates.find(
            (state) => state.type === 'controller' && state.inputSource.handedness === 'right'
        )

        head.getWorldDirection(forward)
        forward.y = 0
        if (forward.lengthSq() > 0) {
            forward.normalize()
        }
        right.crossVectors(forward, up).normalize()

        direction.set(0, 0, 0)
        const leftStick = leftController?.gamepad?.['xr-standard-thumbstick']
        const rightStick = rightController?.gamepad?.['xr-standard-thumbstick']

        if (leftStick) {
            direction.addScaledVector(right, (leftStick.xAxis ?? 0) * speed * delta)
            direction.addScaledVector(forward, (leftStick.yAxis ?? 0) * speed * delta)
        }

        if (KEYS.w) direction.add(forward.clone().multiplyScalar(speed * delta))
        if (KEYS.s) direction.add(forward.clone().multiplyScalar(-speed * delta))
        if (KEYS.d) direction.add(right.clone().multiplyScalar(speed * delta))
        if (KEYS.a) direction.add(right.clone().multiplyScalar(-speed * delta))

        if (direction.lengthSq() > 0) {
            originObj.position.add(direction)
        }

        let rotationDelta = 0
        const rightXAxis = rightStick?.xAxis ?? 0
        if (Math.abs(rightXAxis) > 0.5) {
            rotationDelta += (rightXAxis < 0 ? -1 : 1) * turnSpeed * delta
        }

        if (KEYS.q) rotationDelta += turnSpeed * delta
        if (KEYS.e) rotationDelta -= turnSpeed * delta

        if (rotationDelta !== 0) {
            originObj.rotation.y += rotationDelta
        }
    })

    return null
}
