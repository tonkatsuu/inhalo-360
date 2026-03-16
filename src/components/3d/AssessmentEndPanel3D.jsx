import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useTrainingStore } from '../../store/useTrainingStore'
import { isSessionRunning } from '../../training/engine'

const WIDTH = 0.38
const HEIGHT = 0.1
const DEPTH = 0.025

export function AssessmentEndPanel3D(props) {
    const { trainingMode, sessionPhase, finishAssessment } = useTrainingStore()
    const [hovered, setHovered] = useState(false)
    const hoverRef = useRef(false)
    const root = useRef()
    const buttonRef = useRef()
    const camera = useThree((state) => state.camera)
    const raycaster = useRef(new THREE.Raycaster())
    const direction = useRef(new THREE.Vector3())
    const lookTarget = useRef(new THREE.Vector3())
    const controllerDir = useMemo(() => new THREE.Vector3(), [])
    const controllerRayPos = useMemo(() => new THREE.Vector3(), [])

    const xrMode = useXR((state) => state.mode)
    const rightController = useXRInputSourceState('controller', 'right')
    const leftController = useXRInputSourceState('controller', 'left')
    const activeController = rightController ?? leftController

    const isVisible = trainingMode === 'assessment' && isSessionRunning(sessionPhase)

    useFrame(() => {
        if (!root.current) return
        if (!isVisible) {
            hoverRef.current = false
            if (hovered) {
                setHovered(false)
            }
            return
        }

        lookTarget.current.copy(camera.position)
        root.current.lookAt(lookTarget.current)

        if (xrMode === 'immersive-vr' && activeController?.object) {
            activeController.object.updateWorldMatrix(true, false)
            activeController.object.getWorldPosition(controllerRayPos)
            controllerDir.set(0, 0, -1).applyQuaternion(activeController.object.quaternion)
            raycaster.current.set(controllerRayPos, controllerDir)
        } else {
            camera.getWorldDirection(direction.current)
            raycaster.current.set(camera.position, direction.current)
        }

        if (buttonRef.current) {
            const intersects = raycaster.current.intersectObject(buttonRef.current, true)
            const isHovered = intersects.length > 0
            hoverRef.current = isHovered
            if (isHovered !== hovered) {
                setHovered(isHovered)
            }
        }
    })

    const handleClick = useCallback(() => {
        if (isVisible) {
            finishAssessment()
        }
    }, [isVisible, finishAssessment])

    useEffect(() => {
        if (!isVisible) {
            hoverRef.current = false
            return undefined
        }

        const handlePointerDown = (event) => {
            if (event.button !== 0) return
            if (!hoverRef.current) return
            event.preventDefault()
            handleClick()
        }

        window.addEventListener('pointerdown', handlePointerDown)
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown)
        }
    }, [handleClick, isVisible])

    if (!isVisible) return null

    return (
        <group {...props} ref={root}>
            <RoundedBox 
                ref={buttonRef} 
                args={[WIDTH, HEIGHT, DEPTH]} 
                radius={0.03} 
                onClick={handleClick}
            >
                <meshStandardMaterial 
                    color={hovered ? '#ef4444' : '#b91c1c'} 
                    transparent 
                    opacity={0.9} 
                />
            </RoundedBox>
            <Text
                position={[0, 0, 0.02]}
                fontSize={0.026}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
            >
                End Assessment
            </Text>
        </group>
    )
}
