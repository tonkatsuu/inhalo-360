import { useFrame } from '@react-three/fiber'
import { useXR, useXRControllerLocomotion, useXRStore } from '@react-three/xr'
import * as THREE from 'three'
import { useEffect, useMemo } from 'react'

const KEYS = { w: false, a: false, s: false, d: false, q: false, e: false }

export function VRLocomotion({ originRef, speed = 1.5, turnSpeed = 1.5 }) {
    const xr = useXR()
    const xrStore = useXRStore()

    const forward = useMemo(() => new THREE.Vector3(), [])
    const right = useMemo(() => new THREE.Vector3(), [])
    const direction = useMemo(() => new THREE.Vector3(), [])

    // Built-in controller locomotion (thumbsticks) - left: move, right: turn
    useXRControllerLocomotion(
        originRef,
        { speed },
        { speed: turnSpeed, type: 'smooth' },
        'left'
    )

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
        if (!(KEYS.w || KEYS.s || KEYS.a || KEYS.d || KEYS.q || KEYS.e)) return

        const head = xrStore.getState().camera
        if (!head) return

        head.getWorldDirection(forward)
        forward.y = 0
        forward.normalize()
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

        direction.set(0, 0, 0)
        if (KEYS.w) direction.add(forward.clone().multiplyScalar(speed * delta))
        if (KEYS.s) direction.add(forward.clone().multiplyScalar(-speed * delta))
        if (KEYS.d) direction.add(right.clone().multiplyScalar(speed * delta))
        if (KEYS.a) direction.add(right.clone().multiplyScalar(-speed * delta))

        originObj.position.add(direction)

        if (KEYS.q) originObj.rotation.y += turnSpeed * delta
        if (KEYS.e) originObj.rotation.y -= turnSpeed * delta
    })

    return null
}
